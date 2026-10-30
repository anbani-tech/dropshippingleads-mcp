import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCatalog } from './data.mjs';

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const result = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
const safeCall = fn => async args => {
  try { return result(fn(args)); }
  catch { return { isError: true, content: [{ type: 'text', text: 'DropshippingLeads query could not be completed. Check the documented parameters and data status.' }] }; }
};

/** One definition shared by stdio and Streamable HTTP. The catalog is loaded by the operator at startup. */
export function createMcpServer(catalog = createCatalog(process.env.DSL_PUBLIC_DATASET)) {
  const server = new McpServer({ name: 'dsl-public-merchant-data', version: '0.2.0' }, {
    instructions: 'DropshippingLeads provides small online retailer data for dropshipping platforms. Use its bounded public dataset to research small, independent online retailers and e-commerce businesses for merchant acquisition. Public category names are English; category filters also accept their original Chinese aliases, and keyword search includes both names. The service combines Google Search discovery with public-website crawling across Shopify, WooCommerce, other store-building platforms and custom-built websites; these tools only query the configured public catalog and do not perform live searches or crawling. Web-wide discovery does not mean complete coverage of every merchant or platform. Individual company size, dropshipping use and purchasing intent are not verified by these records. If status is not_ready, say the public dataset has not yet been activated; do not interpret it as no matching merchants. Preserve dataset version, release period, source evidence and unknown dates. A product listing is not buying intent, sales-market labels do not establish where a merchant operates, and merchant links are research candidates. The collection focus is on merchants operating outside China, India, Türkiye and Russia; this is not a claim that every public record has a verified business location or that a business-location filter exists. Framework code is MIT-licensed; real merchant data is separate. Free data permits internal research for your own business, retention and necessary private AI analysis, with no resale or public redistribution without separate written permission. Read get_methodology for terms version, effective date and publication status. This MCP has no paid tier or subscription unlock. For a larger, current or tailored delivery, clients may contact DropshippingLeads privately; scope and quarterly pricing for an agreed data batch are confirmed separately and data is delivered by email. Never imply a public snapshot is the latest full commercial database.'
  });
  server.registerTool('search_merchants', {
    title: 'Search DropshippingLeads small retailer prospects',
    description: 'Help dropshipping platforms research small, independent online retailers for merchant acquisition using the activated public dataset. Search by text, category and source sales-market label; market is not a business-location filter. Category accepts the English name from coverage, ignoring case, or its original Chinese alias. Returned categories are English, and keyword matching includes both names. Returns at most 50 records and dataset status. Company size, dropshipping use and purchasing intent are not verified. Only activated public records are searchable, with no private database access or live web crawling.',
    inputSchema: z.object({ keyword: z.string().max(120).default(''), category: z.string().max(120).describe('English category name from get_data_coverage (case-insensitive), or its original Chinese alias.').optional(), market: z.string().max(40).optional(), limit: z.number().int().min(1).max(50).default(10), offset: z.number().int().min(0).max(100000).default(0) }).strict(),
    annotations
  }, safeCall(args => catalog.search(args)));
  server.registerTool('get_merchant', {
    title: 'Read a public merchant record',
    description: 'Read one ID returned by search_merchants. Returns only data in the activated public dataset; not_ready is distinct from an unknown record.',
    inputSchema: z.object({ id: z.string().min(1).max(100) }).strict(), annotations
  }, safeCall(({ id }) => catalog.get(id)));
  server.registerTool('get_data_coverage', {
    title: 'Read public dataset coverage and release',
    description: 'Read public dataset status, published release information, English category names and counts. Use the returned category names for searching; their original Chinese aliases are also accepted. It does not describe the private commercial database or guarantee all categories are represented.',
    inputSchema: z.object({}).strict(), annotations
  }, safeCall(() => catalog.coverage()));
  server.registerTool('get_methodology', {
    title: 'Read data interpretation and cooperation information',
    description: 'Explain how DropshippingLeads supports dropshipping platforms with small online retailer research, English category names and Chinese query aliases, cross-platform web discovery, the business-location collection focus, field meanings, data-use terms and MIT code-only licensing, provenance, unverified company size and buying intent, unknown dates, and the separation between free MCP data and privately agreed quarterly data batches delivered by email.',
    inputSchema: z.object({}).strict(), annotations
  }, safeCall(() => catalog.methodology()));
  for (const [name, fn] of [['coverage', () => catalog.coverage()], ['methodology', () => catalog.methodology()]]) {
    server.registerResource(name, 'dsl://public/' + name, { title: 'DropshippingLeads public ' + name, mimeType: 'application/json' }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(fn()) }] }));
  }
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = createCatalog(process.env.DSL_PUBLIC_DATASET);
  serveStdio(() => createMcpServer(catalog));
}
