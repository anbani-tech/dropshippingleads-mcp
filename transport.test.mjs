import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createHttpServer, MAX_BODY_BYTES } from './http.mjs';
import { loadHttpConfig } from './http-config.mjs';
import { stableMerchantId } from './data.mjs';

async function emptyFixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dsl-public-mcp-test-'));
  const file = path.join(dir, 'catalog.json');
  await fs.writeFile(file, JSON.stringify({ schemaVersion: 1, status: 'not_ready', version: null, release_period: null, published_at: null, records: [] }));
  return { file, cleanup: () => fs.rm(dir, { recursive: true, force: true }) };
}

async function verifyProtocol(client) {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['get_data_coverage', 'get_merchant', 'get_methodology', 'search_merchants']);
  assert.ok(tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
  async function call(name, args = {}) { const r = await client.callTool({ name, arguments: args }); assert.ok(!r.isError, JSON.stringify(r)); assert.deepEqual(JSON.parse(r.content[0].text), r.structuredContent); return r.structuredContent; }
  for (const [name, args] of [['search_merchants', {}], ['get_merchant', { id: 'unknown' }], ['get_data_coverage', {}]]) assert.equal((await call(name, args)).status, 'not_ready');
  assert.ok(await call('get_methodology'));
  const { resources } = await client.listResources();
  assert.equal(resources.length, 2);
  for (const r of resources) assert.ok(JSON.parse((await client.readResource({ uri: r.uri })).contents[0].text));
  for (const args of [{ limit: 51 }, { limit: 0 }, { offset: -1 }, { offset: 100001 }, { keyword: 'x'.repeat(121) }, { datasetPath: 'private.sqlite' }, { sql: 'select * from private' }]) assert.equal((await client.callTool({ name: 'search_merchants', arguments: args })).isError, true);
}

test('official stdio client discovers tools/resources and receives explicit not_ready without data', { timeout: 20000 }, async () => {
  const f = await emptyFixture();
  const client = new Client({ name: 'dsl-stdio-test', version: '0.2.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url))], env: { DSL_PUBLIC_DATASET: f.file }, stderr: 'pipe' });
  try { await client.connect(transport); await verifyProtocol(client); }
  finally { await client.close(); await f.cleanup(); }
});

test('official HTTP client works locally; foreign origins, hosts and oversized requests are rejected', { timeout: 20000 }, async () => {
  const f = await emptyFixture();
  const app = createHttpServer({ datasetPath: f.file, config: loadHttpConfig({ DSL_RATE_BURST: '100' }) });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const client = new Client({ name: 'dsl-http-test', version: '0.2.0' });
  try {
    const health = await (await fetch(origin + '/health')).json();
    assert.equal(health.catalog_status, 'not_ready'); assert.equal(health.mode, 'local'); assert.equal('published' in health, false);
    await client.connect(new StreamableHTTPClientTransport(new URL(origin + '/mcp')));
    await verifyProtocol(client);
    assert.equal((await fetch(origin + '/mcp', { method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    const foreignHostStatus = await new Promise((resolve, reject) => {
      const req = http.get(origin + '/health', { headers: { Host: 'example.com' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject);
    });
    assert.equal(foreignHostStatus, 403);
    assert.equal((await fetch(origin + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(MAX_BODY_BYTES + 1) })).status, 413);
    assert.equal((await fetch(origin + '/private.sqlite')).status, 404);
    assert.equal((await fetch(origin + '/mcp?datasetPath=private.sqlite')).status, 404);
  } finally { await client.close(); await app.close(); await f.cleanup(); }
});

test('the same HTTP tools return an approved synthetic release after changing only the dataset file', { timeout: 20000 }, async () => {
  const f = await emptyFixture();
  const record = { id: stableMerchantId('https://example.com'), store_url: 'https://example.com', categories: ['Test category'], markets: ['US'], products: [{ title: 'Synthetic jacket', url: 'https://example.com/jacket' }], contacts: [], sources: [{ url: 'https://example.com', label: 'Synthetic fixture only' }], observed_at: null, classification_status: 'confirmed', approved_for_public: true };
  await fs.writeFile(f.file, JSON.stringify({ schemaVersion: 1, status: 'ready', version: 'synthetic-test-only', release_period: '2026-Q4', published_at: '2026-10-30T00:00:00Z', records: [record] }));
  const app = createHttpServer({ datasetPath: f.file });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const client = new Client({ name: 'dsl-ready-fixture-test', version: '0.2.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + app.server.address().port + '/mcp')));
    const found = (await client.callTool({ name: 'search_merchants', arguments: { keyword: 'jacket', category: 'Test category', market: 'us', limit: 1 } })).structuredContent;
    assert.equal(found.status, 'ready'); assert.equal(found.matched, 1); assert.equal(found.records[0].id, record.id); assert.equal(found.records[0].observed_at, null);
    const detail = (await client.callTool({ name: 'get_merchant', arguments: { id: record.id } })).structuredContent;
    assert.equal(detail.found, true); assert.equal(detail.record.store_url, record.store_url);
    const empty = (await client.callTool({ name: 'search_merchants', arguments: { keyword: 'no-match' } })).structuredContent;
    assert.equal(empty.status, 'ready'); assert.equal(empty.matched, 0);
  } finally { await client.close(); await app.close(); await f.cleanup(); }
});
