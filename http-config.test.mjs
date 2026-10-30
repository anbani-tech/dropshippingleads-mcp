import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHttpConfig, normalizeIp} from './http-config.mjs';

const proxyEnv={DSL_HTTP_MODE:'proxy',DSL_PUBLIC_ORIGIN:'https://mcp.dsl-configuration.net',DSL_TRUSTED_PROXY_IPS:'127.0.0.1'};
test('HTTP configuration defaults to loopback; explicit production origin, trust and limits are frozen',()=>{
  const local=loadHttpConfig({});assert.equal(local.mode,'local');assert.equal(local.bindHost,'127.0.0.1');assert.equal(local.port,54170);
  assert.deepEqual(local.limits,{requestsPerMinute:60,burst:10,maxConcurrentPerClient:4,maxConcurrentTotal:64,maxClients:10000});
  const proxy=loadHttpConfig({...proxyEnv,DSL_HTTP_PORT:'54172',DSL_ALLOWED_ORIGINS:'https://mcp.dsl-configuration.net,https://app.dsl-configuration.net'});
  assert.equal(proxy.publicHost,'mcp.dsl-configuration.net');assert.equal(proxy.allowedOrigins.length,2);assert.equal(proxy.port,54172);
  assert.throws(()=>{proxy.limits.burst=0;});assert.throws(()=>proxy.allowedOrigins.push('*'));
});
test('missing or ambiguous production settings, placeholders, broad trust and invalid limits fail before binding',()=>{
  for(const origin of [undefined,'','https://REPLACE_MCP_HOST','http://mcp.dsl-configuration.net','https://mcp.dsl-configuration.net/','https://mcp.dsl-configuration.net/mcp','https://mcp.dsl-configuration.net?x=1','https://user:pass@mcp.dsl-configuration.net','https://*.dsl-configuration.net','https://127.0.0.1','https://[::1]','https://mcp.example.com','https://mcp.invalid','https://mcp.test','https://mcp.dsl-configuration.net.'])assert.throws(()=>loadHttpConfig({...proxyEnv,DSL_PUBLIC_ORIGIN:origin}),String(origin));
  for(const ips of [undefined,'','*','0.0.0.0/0','192.0.2.1','::1','127.0.0.1,','127.0.0.1,::ffff:127.0.0.1'])assert.throws(()=>loadHttpConfig({...proxyEnv,DSL_TRUSTED_PROXY_IPS:ips}),String(ips));
  for(const origins of ['*','null','https://mcp.dsl-configuration.net,','https://mcp.dsl-configuration.net,https://mcp.dsl-configuration.net'])assert.throws(()=>loadHttpConfig({...proxyEnv,DSL_ALLOWED_ORIGINS:origins}));
  assert.throws(()=>loadHttpConfig({DSL_PUBLIC_ORIGIN:proxyEnv.DSL_PUBLIC_ORIGIN}));assert.throws(()=>loadHttpConfig({DSL_HTTP_MODE:'production'}));assert.throws(()=>loadHttpConfig({DSL_HTTP_HOST:'0.0.0.0'}));
  for(const key of ['DSL_HTTP_PORT','DSL_RATE_PER_MINUTE','DSL_RATE_BURST','DSL_RATE_MAX_CONCURRENT_PER_CLIENT','DSL_RATE_MAX_CONCURRENT_TOTAL','DSL_RATE_MAX_CLIENTS'])for(const bad of ['0','-1','1.1','Infinity','','100000000000000000000'])assert.throws(()=>loadHttpConfig({[key]:bad}),`${key}=${bad}`);
});
test('IP identity is canonical and never accepts an unparsed forwarding chain',()=>{
  assert.equal(normalizeIp('::ffff:192.0.2.1'),'192.0.2.1');assert.equal(normalizeIp('::ffff:c000:201'),'192.0.2.1');
  assert.equal(normalizeIp('2001:0DB8:0:0:0:0:0:1'),'2001:db8::1');
  for(const invalid of ['192.0.2.1, 192.0.2.2','unknown','[::1]','127.0.0.1:123','fe80::1%eth0',null])assert.equal(normalizeIp(invalid),null);
});
