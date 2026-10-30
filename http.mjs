import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createCatalog } from './data.mjs';
import { createMcpServer } from './server.mjs';
import { loadHttpConfig, normalizeIp } from './http-config.mjs';
import { createRateLimiter } from './rate-limit.mjs';

export const MAX_BODY_BYTES = 64 * 1024;
const CORS_HEADERS = ['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id'];
function json(res, status, value) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(value));
}
function uniqueHeader(req, name) {
  const count = req.rawHeaders.filter((_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === name).length;
  return count <= 1 && (req.headers[name] === undefined || typeof req.headers[name] === 'string');
}

/** Anonymous access to an approved public pool; loopback only, with an explicit same-host proxy mode. */
export function createHttpServer({catalog, datasetPath = process.env.DSL_PUBLIC_DATASET, config = loadHttpConfig()} = {}) {
  catalog ??= createCatalog(datasetPath);
  const limiter = createRateLimiter(config.limits);
  const handler = createMcpHandler(() => createMcpServer(catalog), {legacy:'stateless', maxRequestBodySize:MAX_BODY_BYTES, maxSubscriptions:8});
  const handleMcp = toNodeHandler(handler, {maxRequestBodySize:MAX_BODY_BYTES});
  const server = http.createServer({maxHeaderSize:16384}, async (req, res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex');
    res.setHeader('Vary','Origin');
    const proxy = config.mode === 'proxy';
    const guardHeaders = ['host','origin', ...(proxy ? ['x-forwarded-for','x-forwarded-proto'] : [])];
    if (!guardHeaders.every(name => uniqueHeader(req,name))) return json(res,400,{error:'AMBIGUOUS_HEADERS'});
    const port = server.address()?.port;
    const hosts = proxy ? [config.publicHost] : [`127.0.0.1:${port}`,`localhost:${port}`];
    const origins = proxy ? config.allowedOrigins : hosts.map(h => 'http://' + h);
    let clientIp = normalizeIp(req.socket.remoteAddress);
    if (proxy) {
      if (!config.trustedProxyIps.includes(clientIp)) return json(res,403,{error:'TRUSTED_PROXY_REQUIRED'});
      if (req.headers['x-forwarded-proto'] !== 'https') return json(res,403,{error:'HTTPS_PROXY_REQUIRED'});
      clientIp = normalizeIp(req.headers['x-forwarded-for']);
      if (!clientIp) return json(res,400,{error:'SINGLE_CLIENT_IP_REQUIRED'});
    }
    if (!clientIp) return json(res,400,{error:'INVALID_CLIENT_ADDRESS'});
    if (!hosts.includes(req.headers.host)) return json(res,403,{error:'HOST_NOT_ALLOWED'});
    const origin = req.headers.origin;
    if (origin !== undefined && !origins.includes(origin)) return json(res,403,{error:'ORIGIN_NOT_ALLOWED'});
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin',origin);
      res.setHeader('Access-Control-Expose-Headers','Mcp-Session-Id, MCP-Protocol-Version, Retry-After');
    }
    // Only canonical origin-form paths. No URL parameters or absolute/protocol-relative targets.
    if (!['/mcp','/health'].includes(req.url)) return json(res,404,{error:'NOT_FOUND'});
    const methods = req.url === '/health' ? ['GET','HEAD'] : ['POST','GET','DELETE','OPTIONS'];
    if (!methods.includes(req.method)) { res.setHeader('Allow',methods.join(', '));return json(res,405,{error:'METHOD_NOT_ALLOWED'}); }
    const admission = limiter.acquire(clientIp);
    if (!admission.allowed) {
      res.setHeader('Retry-After',String(admission.retryAfter));
      if (!req.complete) res.setHeader('Connection','close');
      return json(res,admission.statusCode,{error:admission.statusCode === 429 ? 'RATE_LIMITED':'SERVER_BUSY',reason:admission.reason,retry_after:admission.retryAfter});
    }
    // SSE can outlive the handler call. Release on completion or disconnect.
    res.once('finish',admission.release);res.once('close',admission.release);
    if (req.url === '/health') return json(res,200,{service:'dsl-public-mcp',status:'ok',mode:config.mode,catalog_status:catalog.coverage().status});
    if (req.method === 'OPTIONS') {
      const requestedMethod = req.headers['access-control-request-method'];
      const requestedHeaders = String(req.headers['access-control-request-headers'] ?? '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
      if (!origin || !['POST','GET','DELETE'].includes(requestedMethod) || !requestedHeaders.every(h=>CORS_HEADERS.includes(h))) return json(res,403,{error:'PREFLIGHT_NOT_ALLOWED'});
      res.setHeader('Vary','Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
      res.setHeader('Access-Control-Allow-Methods','POST, GET, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers',CORS_HEADERS.join(', '));
      res.setHeader('Access-Control-Max-Age','600');res.writeHead(204);return res.end();
    }
    if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
      res.setHeader('Connection','close');return json(res,413,{error:'REQUEST_TOO_LARGE'});
    }
    try { await handleMcp(req,res); }
    catch { if (!res.headersSent) json(res,500,{error:'MCP_REQUEST_FAILED'}); else res.destroy(); }
  });
  server.requestTimeout=30000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  server.setTimeout(60000,socket=>socket.destroy());
  return {server,config,async close(){
    await handler.close();
    if (!server.listening) return;
    await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});
  }};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app=createHttpServer();
    app.server.on('error',error=>{console.error('DSL MCP HTTP could not listen:',error.code);process.exitCode=1;});
    app.server.listen(app.config.port,app.config.bindHost,()=>console.log(`DSL MCP HTTP listening on ${app.config.bindHost}:${app.config.port}; mode=${app.config.mode}; catalog status is separate from deployment status.`));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.close();});
  } catch(error) { console.error('DSL MCP HTTP configuration/startup failed:',error.message);process.exitCode=1; }
}
