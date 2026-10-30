# DropshippingLeads — Small Online Retailer Data for Dropshipping Platforms

[中文](README.md) · [Connection guide](docs/CONNECTION-GUIDE.md) · [Tool reference](docs/TOOL-REFERENCE.md) · [Free-data terms](docs/FREE-DATA-TERMS.md) · [License notice](docs/LICENSE-NOTICE.md)

DropshippingLeads helps dropshipping platforms discover small, independent online retailers across the web and grow their merchant networks. We combine Google Search discovery with public-website crawling to find e-commerce merchants across Shopify, WooCommerce, other store-building platforms and custom-built websites, supporting merchant research, fit assessment and acquisition. The DropshippingLeads MCP is a free way to explore the service through MCP-compatible AI clients: query a configured public data snapshot by category and recorded sales-market labels, with store URLs and public sources for further checks.

Small, independent online retailers and small e-commerce businesses are the merchant prospects that dropshipping platforms can research with DropshippingLeads. This is a service focus, not a verified company-size label on every record. The initial free pool does not provide employee-count, revenue or purchase-volume evidence, and inclusion does not establish current dropshipping use or buying intent.

“Web-wide” describes discovery across store-building platforms and standalone websites, not exhaustive coverage of all merchants or every platform. Available data depends on the dataset version and agreed delivery scope. MCP calls query an existing public snapshot; they do not perform Google searches or live website crawling.

Collection focuses on merchants whose business operations are based outside China, India, Türkiye and Russia. This refers to where the merchant operates, separately from the markets its website sells to. This is the business collection focus; merchant operating locations have not been verified for every record in the current free pool. The current `market` field remains a sales-market label and cannot establish operating location or exclusion of those four countries.

**Initial free pool: 14 main categories, 100 free records per category, excluding food and beverages.** Connect to the remote MCP for the free experience; `get_data_coverage` reports the active status, version, scope and dates. This repository and its ZIP contain no real catalog: a fresh `init-catalog.mjs` creates an empty `not_ready` package. The real data package is managed separately from source code.

## Remote connection

Connect to the remote **Streamable HTTP** service at `https://mcp.dropshippingleads.com/mcp`. No service API key is required. The source and documentation repository is `anbani-tech/dropshippingleads-mcp`, linked from the website and MCP directories. Queries run on the remote service; a source download contains no real catalog. Your client may have its own account, plan or administrator requirements. See the [connection guide](docs/CONNECTION-GUIDE.md).

## Code license and free-data rules

The framework code uses the standard [MIT License](LICENSE.txt), with copyright held by Beijing Anbani Technology Co., Ltd. **MIT applies to licensed code, not real data.** Free data may be used for internal research for your own business, retention and necessary private AI analysis. Without separate, express written permission, no individual records, small batches or entire datasets may be resold or publicly redistributed, including through external APIs, MCPs or client deliverables. See [Free Data Terms 1.0](docs/FREE-DATA-TERMS.md) and the [code/data scope notice](docs/LICENSE-NOTICE.md).

Free Data Terms **version 1.0** take effect on **30 October 2026**. Read the full terms before using the data. The MIT code license and the data-use permission apply separately.

## Free discovery and paid cooperation

The MCP is a free way to explore selected data and discover DropshippingLeads's commercial data service. There is no paid MCP tier.

For more recent, larger or tailored data, contact DropshippingLeads to agree on categories, markets, fields, data dates, quantity, permitted use and quarterly pricing. A purchase covers **an agreed batch of data delivered privately by email**. This MCP does not take payments, unlock additional records after payment or replace email delivery.

DropshippingLeads collects additional business data daily and updates its data service quarterly. The free public pool has its own release cycle and version. It must not be presented as a daily synchronized copy, the full commercial database or necessarily the latest data.

Contact: [DropshippingLeads cooperation enquiry](https://dropshippingleads.com/?product=leads&view=application&lang=en#application) · [contact@dropshippingleads.com](mailto:contact@dropshippingleads.com). Mention “DropshippingLeads MCP” and include your target category, market, required data date and fields. No MCP subscription is required to discuss a delivery.

## Useful requests

- Find merchants in the public pool by keyword, confirmed category and recorded sales-market label.
- Read real store URLs, existing explicit categories, recorded market labels and public sources. Product and contact fields are empty in this initial pool; unknown observation dates remain `null`.
- Check the active public release's count, category coverage and publication date.
- Understand the data and how to request a quarterly email delivery.

Example prompts:

> Check whether DropshippingLeads's public dataset is active. Show its version and the category and market labels currently available.
>
> Using an actual category label from the coverage result, find merchants with the sales-market label US. Show 10 records with their sources and dataset version.
>
> Use the returned category “Apparel, Footwear & Bags” to query the first five records. Preserve store URLs and sources, identify empty fields and do not infer buying intent.
>
> Read the details of one merchant from those results. Explain how to contact DropshippingLeads if I need a more recent or tailored email delivery.

Keyword search uses case-insensitive literal matching against store URLs, the English and Chinese names of confirmed categories, product titles and product URLs. It is **not semantic search**. For the initial 14 categories, MCP coverage, search and detail responses use English names. The `category` filter accepts a canonical English name (case-insensitive) or its original Chinese alias; market labels match exactly, ignoring case. Read coverage first rather than assuming a label is available. See the [English–Chinese category map](docs/TOOL-REFERENCE.md#category-language); the Chinese alias “服装鞋包” selects the same category as “Apparel, Footwear & Bags”. Internal category labels and source records remain unchanged. The initial pool uses explicit source labels and excludes pending classifications. `confirmed` does not mean every store was manually verified; queries do not recheck websites live.

## Run locally

Prerequisites: Node.js 22 or later and pnpm. Download this repository and run these commands from its root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node init-catalog.mjs
pnpm test
```

The initialization command creates an empty `not_ready` catalog only when the default file is absent. It does not overwrite an existing catalog. Startup does not connect to an internal database or Google Sheets.

### stdio

```sh
node server.mjs
```

An MCP client communicates over standard input and output. Waiting for input when launched in a terminal is expected; this command does not start a web page. Clients that accept a `mcpServers` configuration can use this template:

```json
{
  "mcpServers": {
    "dsl-public-data": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/dsl-public-mcp/server.mjs"]
    }
  }
}
```

Replace the placeholder with your actual **absolute path**. On Windows, forward slashes work in JSON paths, for example `C:/YOUR/PATH/dsl-public-mcp/server.mjs`. Client configuration formats vary; use your client's supported setup flow.

### Local Streamable HTTP

```sh
node http.mjs
```

- MCP endpoint: `http://127.0.0.1:54170/mcp`
- Health check: `http://127.0.0.1:54170/health`
- The server listens on loopback and checks local Host / Origin values.

`/mcp` is a protocol endpoint, not an introduction page. The health response contains only runtime status, HTTP mode and `catalog_status`; it exposes no merchant records and does not infer publication status. Remote AI clients cannot reach your computer's `127.0.0.1`. Use the official HTTPS address for remote access. Support in specific products such as ChatGPT and Doubao depends on the current product, account conditions and actual connection results; this guide does not guarantee product compatibility.

### Production HTTP configuration and simple rate limits

An explicit `proxy` mode and [same-host HTTPS proxy guide](deploy/HTTP-DEPLOYMENT.md) are included. The application validates the configured public host, exact browser origins, trusted proxy address and a single forwarded client IP, while continuing to listen only on loopback. Defaults are 60 replenished requests per minute per IP, a burst capacity of 10 and 4 concurrent requests per IP, with a process-wide concurrency cap of 64. Per-client limits return `429`; exhausted global capacity returns `503`. Both include `Retry-After`.

This is an in-memory, single-process load control that resets on restart, not a paid or distributed quota. The environment and Nginx examples retain hostname and certificate placeholders and cannot be deployed as-is. For self-hosting, configure the actual hostname, certificate and HTTPS proxy, then verify the protocol, limits and chosen client. The official free service has no paid account tier; the public data package is managed separately from HTTP configuration.

## Tools and resources

| Tool | Purpose |
| --- | --- |
| `search_merchants` | Filter and paginate public records; default 10, maximum 50 per call. |
| `get_merchant` | Read one public record using an ID from search. |
| `get_data_coverage` | Inspect public dataset status, version and category/market counts. |
| `get_methodology` | Read interpretation rules, update information and cooperation details. |

Two read-only resources are also available: `dsl://public/coverage` and `dsl://public/methodology`. There is no arbitrary SQL, client-selected filesystem access, private database search, outbound messaging or automatic purchase. [Full tool reference](docs/TOOL-REFERENCE.md).

### A fresh source download or an unconfigured catalog

`search_merchants` returns the following business object, provided both as JSON text and MCP `structuredContent`:

```json
{
  "scope": "public_catalog",
  "status": "not_ready",
  "dataset_version": null,
  "release_period": null,
  "published_at": null,
  "message": "DropshippingLeads public catalog is not loaded yet. This is not a claim that no matching merchant exists.",
  "records": [],
  "matched": null,
  "next_offset": null
}
```

`not_ready` means the public dataset has not been activated. It does **not** mean that no matching merchant exists. In a `ready` response, `matched: 0` only describes that particular public release, not the commercial database or the whole market.

## Configure a separate real data package

1. The initial pool follows the user-confirmed scope: 14 main categories, 100 free records per category, excluding food and beverages and pending classifications. Apply the same explicit category and public-scope requirements to later versions.
2. Prepare a separate catalog JSON file following the [data guide](docs/DATA-GUIDE.md). Set the public release version and publication timestamp; leave unknown record observation dates as `null`.
3. Validate the candidate, then install it into the default local data location:

```sh
node catalog-cli.mjs check path/to/reviewed-catalog.json
node catalog-cli.mjs install path/to/reviewed-catalog.json
```

4. Restart the MCP process and inspect coverage, filters, sources and dates. Installation preserves a local backup of an existing default catalog; it does not deploy a service.

`examples/catalog.synthetic-example.json` contains fictional merchants for structure illustration and tests. It must not be presented as the real public release. Do not casually include the public pool file, backups or commercial database in a GitHub repository.

## Preserve release and source context

- `dataset_version` / `release_period`: the public release identity and quarter.
- `published_at`: when that public release is published, not when every record was observed.
- `observed_at`: a known record observation timestamp, or `null` when unknown.
- `sources`: recorded public evidence; the server does not recheck websites during queries.

A sales-market label is not a company's domicile. Product listings do not establish purchasing intent. Recorded public contacts are not guaranteed to remain current. Free data follows the approved internal-research rules. MIT code licensing grants no data-redistribution rights. [License notice](docs/LICENSE-NOTICE.md).

## Service scope and client compatibility

Use `get_data_coverage` for the active scope and version, and `get_methodology` plus the Free Data Terms for interpretation and permitted use. Remote MCP support, account requirements and connection workflows vary by AI product. This guide does not claim that ChatGPT, Doubao or other named products have each passed real connection tests. Directory inclusion and successful client access are separate outcomes; search or AI-answer rankings are not guaranteed.