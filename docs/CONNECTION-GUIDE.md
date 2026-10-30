# DropshippingLeads MCP 接入说明 / Connection guide

**DropshippingLeads｜海外小 B 商家数据，助力一件代发平台获客**

**DropshippingLeads — Small Online Retailer Data for Dropshipping Platforms**

DropshippingLeads 为一件代发平台提供海外小 B 商家数据，帮助平台从全网发现独立在线零售商，拓展商家客户。我们结合 Google 搜索发现与公开网站采集，跨 Shopify、WooCommerce 等建站平台及自建网站持续发现商家，为商家研究、合作适配评估和客户开发提供数据支持。

DropshippingLeads helps dropshipping platforms discover small, independent online retailers across the web and grow their merchant networks. We combine Google Search discovery with public-website crawling to find e-commerce merchants across Shopify, WooCommerce, other store-building platforms and custom-built websites, supporting merchant research, fit assessment and acquisition.

MCP 查询公开快照，不执行实时搜索或爬取。现有市场参数表示销售市场，不是商家经营所在地。 / MCP queries a public snapshot, not live search or crawling. Its current market filter represents sales markets, not merchant operating locations.

**远程服务：`https://mcp.dropshippingleads.com/mcp` · Streamable HTTP · 无需服务 API Key。 / Remote service: Streamable HTTP, with no service API key required.**

[中文 README](../README.md) · [English README](../README.en.md) · [工具参数](TOOL-REFERENCE.md) · [免费数据使用条款](FREE-DATA-TERMS.md)

## 远程体验

| 设置 | 填写内容 |
| --- | --- |
| 名称 | DropshippingLeads MCP |
| 服务 URL | `https://mcp.dropshippingleads.com/mcp` |
| 传输 | Streamable HTTP |
| 服务鉴权 | 首发免费方案无需 API Key，不设付费 MCP 账号 |
| GitHub | `https://github.com/meacheal-ai/dsl-public-mcp` |
| 中文 / 英文介绍页 | `https://dropshippingleads.com/mcp/zh/` / `https://dropshippingleads.com/mcp/en/` |

在支持远程 MCP 的客户端中新增服务器，填写 URL 和传输类型，按该客户端的流程启用。服务不要求 API Key，不代表客户端产品自身不要求账号、特定套餐或管理员许可。不同客户端入口和配置格式不同；本材料没有承诺 ChatGPT、豆包或所有版本已通过实际连接验证。

连接后先调用 `get_data_coverage`，确认状态为 `ready` 并读取实际类目、版本和市场标签；再调用 `search_merchants`，最后按返回 ID 调用 `get_merchant`。`get_methodology` 提供解释边界和合作方式。示例：

```json
{"name":"search_merchants","arguments":{"category":"Apparel, Footwear & Bags","limit":5,"offset":0}}
```

这是工具参数示例，不是整个客户端的配置文件。当前 14 类的覆盖、搜索和详情分类统一返回英文；`category` 也接受原中文别名，例如“服装鞋包”与“Apparel, Footwear & Bags”查询相同数据。英文正式名忽略大小写；请使用[分类对应表](TOOL-REFERENCE.md#category-language)中的名称，不猜测其他翻译。内部数据不变。

初始范围为 **14 个大类，每类 100 条免费数据，不含食品饮料**。正常分页可用，默认 10 条、单次最多 50 条。免费使用规则见权利人已确认的[免费数据使用条款 1.0](FREE-DATA-TERMS.md)：允许内部研究、保存及私密 AI 分析，不得转卖或公开再分发。代码采用 [MIT](../LICENSE.txt)，实际数据不适用 MIT。更大、更新或定制范围仍由双方确认季度报价和一批约定数据，私下邮件交付，不在 MCP 内解锁。

## 开发者本地启动

普通体验者优先连接远程服务。下载源码用于开发、自托管或检查实现；**源码不含 DropshippingLeads 的真实数据包**。按 README 安装 Node.js 22+ 与锁定依赖，运行 `node init-catalog.mjs` 后，新目录仍为 `not_ready`，须另行配置获准公开的数据包。

- `node http.mjs`：默认 `http://127.0.0.1:54170/mcp`，只供同一电脑上的客户端使用。
- `node server.mjs`：由本地 MCP 客户端通过 stdio 启动。[本地配置模板](../client-config.example.json)中的路径需替换。

`/mcp` 是协议端点，不是普通网页；直接用浏览器打开不构成 MCP 验收。`/health` 只说明进程和数据状态，不证明公网、TLS 或客户端可用。[HTTP 管理员指南](../deploy/HTTP-DEPLOYMENT.md)说明反代和限流。

## 常见状态

| 结果 | 含义与处理 |
| --- | --- |
| `not_ready` | 当前实例未加载真实公开包，不代表没有商家；新源码默认如此 |
| `ready` + `matched: 0` | 这个版本内没有符合筛选的结果；先检查实际标签 |
| HTTP `429` | 单客户端速率/并发超限；按 `Retry-After` 稍后重试 |
| HTTP `503` | 进程容量受限或服务暂不可用；稍后重试并联系维护方 |
| Host / Origin 拒绝 | 由管理员检查域名和已验证客户端 Origin；不要移除保护或设通配符 |
| DNS / TLS 失败 | 核对正式 URL、网络解析和证书；问题持续时联系维护方 |

[remote-connection.example.json](../remote-connection.example.json)仅是供人阅读的统一连接参数，不是通用的可导入客户端配置。GitHub 和 MCP 平台用于发现服务；目录收录不等于客户端已经连接，也不保证搜索排名或 AI 引用。

## English setup

Add a remote MCP server in a compatible client with URL **`https://mcp.dropshippingleads.com/mcp`** and transport **Streamable HTTP**. The free service needs no service API key. Your client may impose its own account, plan or administrator requirements. Compatibility with named AI products must be established for the actual product and account; this guide does not claim individual product certification.

Start with `get_data_coverage`, read the returned status, version, category and market labels, then use `search_merchants` and `get_merchant`. For the initial 14 categories, coverage, search and detail responses return English category names. Query with a canonical English name such as `Apparel, Footwear & Bags` (case-insensitive), or its original Chinese alias; both select the same category. Keyword matching also includes both category-language forms. Internal source labels are preserved. The initial pool covers **14 main categories, 100 free records per category, excluding food and beverages**. Pagination defaults to 10 and permits up to 50 per call. The owner-approved [Free Data Terms 1.0](FREE-DATA-TERMS.md) allow internal research, retention and private AI analysis without resale or public redistribution. Framework code uses [MIT](../LICENSE.txt); real data does not. Commercial cooperation remains a privately agreed quarterly data batch delivered by email; payment does not unlock a paid MCP tier.

The repository is `meacheal-ai/dsl-public-mcp`. GitHub and directory listings provide discovery and instructions; the data service runs remotely. A source download contains no real catalog. Self-hosting requires Node.js 22+, locked dependencies and a separately approved catalog; `init-catalog.mjs` initializes a fresh download as `not_ready`. Local HTTP defaults to `127.0.0.1:54170/mcp`; stdio uses `node server.mjs`. A remote hosted client cannot reach your computer's loopback address.

`not_ready` does not mean no merchant exists. `ready` with zero matches only describes that public release. Respect `Retry-After` on 429/503. Report host/origin or TLS problems to the operator instead of weakening protections. The connection JSON is a parameter reference, not a universal client import file. Neither a directory listing nor a health response proves successful MCP client access.

For cooperation: [English business enquiry](https://dropshippingleads.com/?product=leads&view=application&lang=en#application) or [contact@dropshippingleads.com](mailto:contact@dropshippingleads.com).
