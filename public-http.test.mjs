import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createHttpServer, MAX_BODY_BYTES } from './http.mjs';
import { loadHttpConfig } from './http-config.mjs';

const publicOrigin = 'https://mcp.dsl-test.net';
const proxyHeaders = (ip = '198.51.100.10') => ({
  Host: 'mcp.dsl-test.net',
  'X-Forwarded-Proto': 'https',
  'X-Forwarded-For': ip
});

async function fixture(overrides = {}, configTransform = config => config) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsl-proxy-acceptance-'));
  const datasetPath = path.join(dir, 'empty.json');
  const empty = JSON.stringify({ schemaVersion: 1, status: 'not_ready', version: null, release_period: null, published_at: null, records: [] });
  await fs.writeFile(datasetPath, empty);
  const environment = {
    DSL_HTTP_MODE: 'proxy', DSL_PUBLIC_ORIGIN: publicOrigin,
    DSL_TRUSTED_PROXY_IPS: '127.0.0.1',
    DSL_RATE_PER_MINUTE: '600', DSL_RATE_BURST: '100',
    ...overrides
  };
  if (environment.DSL_HTTP_MODE === 'local') {
    delete environment.DSL_PUBLIC_ORIGIN;
    delete environment.DSL_TRUSTED_PROXY_IPS;
    delete environment.DSL_ALLOWED_ORIGINS;
  }
  const config = configTransform(loadHttpConfig(environment));
  const app = createHttpServer({ datasetPath, config });
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(0, '127.0.0.1', resolve); });
  return {
    app, config, datasetPath,
    origin: `http://127.0.0.1:${app.server.address().port}`,
    async close() {
      await app.close();
      assert.equal(await fs.readFile(datasetPath, 'utf8'), empty, 'HTTP use must not alter or populate the catalog');
      const resolved = path.resolve(dir);
      assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep));
      await fs.rm(resolved, { recursive: true, force: true });
    }
  };
}

function request(origin, { target = '/health', method = 'GET', headers = proxyHeaders(), chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(origin, { path: target, method, headers, agent: false }, res => {
      const bytes = [];
      res.on('data', b => bytes.push(b));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(bytes).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('local acceptance request timed out')));
    for (const chunk of chunks) req.write(chunk);
    req.end();
  });
}

test('production proxy policy permits official MCP client without loading real data', { timeout: 20000 }, async () => {
  const f = await fixture();
  const client = new Client({ name: 'dsl-proxy-acceptance', version: '1.0.0' });
  // Exercise a real loopback HTTP forwarding hop. Browser-style fetch can
  // refuse Host overrides, whereas a trusted reverse proxy sets these fields.
  const proxy = http.createServer((req, res) => {
    const upstream = http.request(f.origin, { path: req.url, method: req.method, headers: { ...req.headers, ...proxyHeaders() } }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  try {
    const health = await request(f.origin);
    assert.equal(health.status, 200);
    const h = JSON.parse(health.text);
    assert.equal(h.service, 'dsl-public-mcp');
    assert.equal(h.status, 'ok');
    assert.equal(h.mode, 'proxy');
    assert.equal(h.catalog_status, 'not_ready');
    assert.equal('published' in h, false);
    assert.equal('coverage' in h, false);
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${proxy.address().port}/mcp`), { requestInit: { headers: { Origin: publicOrigin } } }));
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['get_data_coverage', 'get_merchant', 'get_methodology', 'search_merchants']);
    const result = await client.callTool({ name: 'search_merchants', arguments: { keyword: 'jacket', limit: 5 } });
    assert(!result.isError);
    assert.equal(result.structuredContent.status, 'not_ready');
    assert.equal(result.structuredContent.matched, null);
    assert.deepEqual(result.structuredContent.records, []);
    const { resources } = await client.listResources();
    assert.equal(resources.length, 2);
    for (const item of resources) assert.equal(JSON.parse((await client.readResource({ uri: item.uri })).contents[0].text).status, 'not_ready');
  } finally {
    await client.close();
    await new Promise((resolve, reject) => { proxy.close(error => error ? reject(error) : resolve()); proxy.closeIdleConnections(); });
    await f.close();
  }
});

test('production proxy boundary rejects forged hosts, origins, forwarding chains and absolute targets', { timeout: 20000 }, async () => {
  const f = await fixture();
  try {
    for (const change of [
      { Host: 'attacker.net' },
      { Host: 'mcp.dsl-test.net.attacker.net' },
      { Host: '127.0.0.1:' + f.app.server.address().port },
      { Origin: 'https://attacker.net' },
      { Origin: publicOrigin + '.attacker.net' },
      { Origin: 'null' },
      { 'X-Forwarded-Proto': 'http' },
      { 'X-Forwarded-Proto': 'https,http' },
      { 'X-Forwarded-For': '198.51.100.10, 198.51.100.11' },
      { 'X-Forwarded-For': 'not-an-ip' },
      { 'X-Forwarded-For': '198.51.100.10:1234' }
    ]) {
      const r = await request(f.origin, { headers: { ...proxyHeaders(), ...change } });
      assert.equal(r.status, 'X-Forwarded-For' in change ? 400 : 403, JSON.stringify(change));
      assert.equal(r.headers['access-control-allow-origin'], undefined, 'Rejected origins are never reflected');
    }
    for (const name of ['X-Forwarded-Proto', 'X-Forwarded-For']) {
      const headers = proxyHeaders(); delete headers[name];
      assert.equal((await request(f.origin, { headers })).status, name === 'X-Forwarded-For' ? 400 : 403, 'Missing ' + name);
    }
    const ignoredForwardingHeaders = await request(f.origin, { headers: { ...proxyHeaders(), Forwarded: 'for=127.0.0.1;host=attacker.net;proto=http', 'X-Forwarded-Host': 'attacker.net', 'X-Real-IP': '198.51.100.99' } });
    assert.equal(ignoredForwardingHeaders.status, 200, 'Only explicitly documented proxy fields govern identity');
    for (const target of ['http://attacker.net/mcp', publicOrigin + '/mcp', '//attacker.net/mcp']) {
      const r = await request(f.origin, { target });
      assert(r.status >= 400 && r.status < 500, target);
    }
    for (const target of ['/private.sqlite', '/data/catalog.json', '/mcp?datasetPath=private.sqlite', '/health?path=private.sqlite']) {
      assert.equal((await request(f.origin, { target })).status, 404, target);
    }
  } finally { await f.close(); }
});

test('a socket outside the explicit trusted proxy address is rejected despite correct headers', { timeout: 10000 }, async () => {
  // The real config rejects an unusable IPv6-only allowlist while listening on
  // IPv4 loopback. Override only the in-memory fixture to exercise peer denial.
  const f = await fixture({}, config => ({ ...config, trustedProxyIps: ['::1'] }));
  try { assert.equal((await request(f.origin)).status, 403); }
  finally { await f.close(); }
});

test('duplicate security headers are rejected even when both values are identical', { timeout: 10000 }, async () => {
  const f = await fixture();
  try {
    const base = { ...proxyHeaders(), Origin: publicOrigin };
    for (const name of ['Host', 'Origin', 'X-Forwarded-For', 'X-Forwarded-Proto']) {
      // A raw header array emits two header lines, not one comma-joined value.
      const headers = Object.entries(base).flat();
      headers.push(name, base[name]);
      let observed;
      const capture = req => { observed = req.rawHeaders; };
      f.app.server.once('request', capture);
      const rejected = await request(f.origin, { headers });
      f.app.server.removeListener('request', capture);
      assert(rejected.status >= 400 && rejected.status < 500, name);
      if (observed) {
        assert.equal(observed.filter((value, i) => i % 2 === 0 && value.toLowerCase() === name.toLowerCase()).length, 2, name + ' was actually duplicated on the wire');
        assert.equal(rejected.status, 400);
      }
    }
  } finally { await f.close(); }
});

test('CORS preflight permits only explicit browser origins, methods and MCP headers', { timeout: 10000 }, async () => {
  const allowedBrowser = 'https://client.dsl-test.net';
  const f = await fixture({ DSL_ALLOWED_ORIGINS: allowedBrowser });
  try {
    const headers = { ...proxyHeaders(), Origin: allowedBrowser, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id' };
    const allowed = await request(f.origin, { target: '/mcp', method: 'OPTIONS', headers });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], allowedBrowser);
    assert(allowed.headers.vary?.toLowerCase().split(',').map(s => s.trim()).includes('origin'));
    assert.equal(allowed.headers['access-control-allow-credentials'], undefined);
    assert(allowed.headers['access-control-allow-methods'].includes('POST'));
    for (const header of ['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id']) assert(allowed.headers['access-control-allow-headers'].toLowerCase().includes(header));
    for (const change of [{ Origin: 'https://attacker.net' }, { 'Access-Control-Request-Method': 'PUT' }, { 'Access-Control-Request-Headers': 'x-arbitrary-private-token' }]) {
      const blocked = await request(f.origin, { target: '/mcp', method: 'OPTIONS', headers: { ...headers, ...change } });
      assert(blocked.status >= 400 && blocked.status < 500, JSON.stringify(change));
    }
    const actual = await request(f.origin, { headers: { ...proxyHeaders(), Origin: allowedBrowser } });
    assert.equal(actual.headers['access-control-allow-origin'], allowedBrowser);
    assert.equal((await request(f.origin, { headers: { ...proxyHeaders(), Origin: publicOrigin } })).status, 403, 'A configured list is not widened implicitly');
  } finally { await f.close(); }
});

test('rate limit follows trusted client IP and gives actionable 429 without leaking records', { timeout: 10000 }, async () => {
  const f = await fixture({ DSL_RATE_PER_MINUTE: '60', DSL_RATE_BURST: '2' });
  try {
    assert.equal((await request(f.origin)).status, 200);
    assert.equal((await request(f.origin)).status, 200);
    const limited = await request(f.origin);
    assert.equal(limited.status, 429);
    assert(/^[1-9]\d*$/.test(limited.headers['retry-after']));
    assert.equal(limited.headers['cache-control'], 'no-store');
    assert.equal(limited.text.includes('record_count'), false);
    assert.equal((await request(f.origin, { headers: proxyHeaders('198.51.100.11') })).status, 200, 'Independent client has an independent bucket');
    assert.equal((await request(f.origin, { headers: { ...proxyHeaders(), 'X-Real-IP': '198.51.100.12' } })).status, 429, 'X-Real-IP cannot replace reviewed X-Forwarded-For');
  } finally { await f.close(); }
});

test('local mode uses socket identity and cannot be bypassed by spoofing proxy headers', { timeout: 10000 }, async () => {
  const f = await fixture({ DSL_HTTP_MODE: 'local', DSL_RATE_PER_MINUTE: '60', DSL_RATE_BURST: '2' });
  try {
    const host = new URL(f.origin).host;
    for (const ip of ['198.51.100.20', '198.51.100.21']) {
      assert.equal((await request(f.origin, { headers: { ...proxyHeaders(ip), Host: host } })).status, 200);
    }
    const limited = await request(f.origin, { headers: { ...proxyHeaders('198.51.100.22'), Host: host } });
    assert.equal(limited.status, 429);
  } finally { await f.close(); }
});

test('oversized chunked bodies are rejected even without Content-Length', { timeout: 10000 }, async () => {
  const f = await fixture();
  try {
    const r = await request(f.origin, { target: '/mcp', method: 'POST', headers: { ...proxyHeaders(), 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Transfer-Encoding': 'chunked' }, chunks: ['x'.repeat(32768), 'x'.repeat(MAX_BODY_BYTES - 32768 + 1)] });
    assert.equal(r.status, 413);
    assert.equal((await request(f.origin)).status, 200, 'Oversized request did not retain a concurrency slot');
  } finally { await f.close(); }
});

test('disconnect releases a held concurrency slot without requiring a completed MCP body', { timeout: 10000 }, async () => {
  const f = await fixture({ DSL_RATE_MAX_CONCURRENT_PER_CLIENT: '1', DSL_RATE_BURST: '20' });
  let held;
  try {
    let resolveClosed;
    const closed = new Promise(resolve => { resolveClosed = resolve; });
    const received = new Promise(resolve => {
      f.app.server.once('request', (_req, res) => { res.once('close', resolveClosed); resolve(); });
    });
    held = http.request(f.origin + '/mcp', { method: 'POST', headers: { ...proxyHeaders(), 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Transfer-Encoding': 'chunked' }, agent: false });
    held.on('error', () => {}); // Intentional cancellation below.
    held.write('{');
    await received;
    const limited = await request(f.origin);
    assert.equal(limited.status, 429, 'An unfinished accepted request counts toward concurrency');
    held.destroy();
    await closed;
    assert.equal((await request(f.origin)).status, 200, 'Aborted request released its concurrency slot');
  } finally { held?.destroy(); await f.close(); }
});
