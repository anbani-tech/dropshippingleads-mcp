# DropshippingLeads｜海外小 B 商家数据，助力一件代发平台获客

[English](README.en.md) · [接入说明](docs/CONNECTION-GUIDE.md) · [工具参数](docs/TOOL-REFERENCE.md) · [免费数据使用条款](docs/FREE-DATA-TERMS.md) · [许可说明](docs/LICENSE-NOTICE.md)

DropshippingLeads 为一件代发平台提供海外小 B 商家数据，帮助平台从全网发现独立在线零售商，拓展商家客户。我们结合 Google 搜索发现与公开网站采集，跨 Shopify、WooCommerce 等建站平台及自建网站持续发现商家，为商家研究、合作适配评估和客户开发提供数据支持。 DropshippingLeads MCP 是这项数据服务的免费体验入口：通过支持 Model Context Protocol（MCP）的 AI 客户端，按品类与已有销售市场标签查询已配置的公开数据快照，查看网站网址、类别、市场标签和公开来源。

这里的“海外小 B”指一件代发平台希望拓展的海外中小商家，例如独立站经营者和小型在线零售商。它是服务定位，不是每条记录已经核实的企业规模标签。初始免费池不提供员工数、营收或采购量证据，也不证明商家已使用一件代发或有采购意向。

“全网”描述跨建站平台、跨独立网站的发现与采集范围，不代表已收录全部商家或每个平台。具体可提供的数据以当前数据版本及合作约定为准。MCP 查询已有公开快照，不在调用时执行 Google 搜索或实时爬取网站。

采集重点为经营所在地位于中国、印度、土耳其和俄罗斯以外的商家，地域口径按商家经营所在地判断；网站面向的销售市场单独区分。这是业务采集方向；当前免费池未逐条核实商家的经营所在地。现有 `market` 字段仍为销售市场标签，不能用来证明经营所在地或四国排除条件。

**初始免费池：14 个大类，每类 100 条免费数据，不含食品饮料。** 免费体验优先连接远程 MCP，实际启用状态、版本、覆盖范围和日期以 `get_data_coverage` 返回为准。本仓库和下载 ZIP 不含真实 catalog；首次运行 `init-catalog.mjs` 仍创建 `not_ready` 空包。真实数据包与源码分开管理。

## 远程接入

免费体验优先连接远程 **Streamable HTTP** 服务：`https://mcp.dropshippingleads.com/mcp`，无需服务 API Key。GitHub 仓库为 `meacheal-ai/dsl-public-mcp`；官网及 MCP 平台介绍页提供说明与接入入口。真实查询由远程服务提供，下载源码不附真实 catalog。客户端产品可能另有账号、套餐或管理员要求；具体接入方式见[完整接入说明](docs/CONNECTION-GUIDE.md)。

## 代码许可与免费数据规则

框架代码采用标准 [MIT 许可证](LICENSE.txt)，版权主体为北京安巴尼科技有限公司（Beijing Anbani Technology Co., Ltd.）。**MIT 仅适用于已许可代码，不适用于实际数据。** 免费数据允许用于自身业务的内部研究、保存和必要的私密 AI 分析；未经另行明确书面许可，不得转卖或公开再分发单条、少量或整批记录，也不得通过对外 API、MCP 或客户交付物再次提供。见[免费数据使用条款 1.0](docs/FREE-DATA-TERMS.md)和[代码/数据范围说明](docs/LICENSE-NOTICE.md)。

免费数据条款版本为 **1.0**，生效日期为 **2026-10-30**。使用数据前请阅读完整条款；代码的 MIT 许可与数据使用许可分别适用。

## 免费体验与付费合作

MCP 的用途是免费体验和发现 DropshippingLeads 数据服务。免费池可以用于检索和评估数据是否适合自己的业务，不设付费 MCP 层。

需要更近期、更多或按需求筛选的数据时，联系 DropshippingLeads，私下确认品类、市场、字段、数据时点、数量、使用范围及季度报价。成交后交付的是**一批双方约定的数据，通过邮件交付**。MCP 不处理付款，不因付款自动解锁更多记录，也不替代邮件交付。

业务会每天采集补充数据，并按季度更新数据服务。免费池是单独管理的公开版本，不能据此推断每天同步、包含完整商业数据库或始终为最新数据。

合作入口：[联系 DropshippingLeads](https://dropshippingleads.com/?product=leads&view=application&lang=zh#application) · [contact@dropshippingleads.com](mailto:contact@dropshippingleads.com)。邮件可注明“来自 DropshippingLeads MCP”，并写明目标品类、市场、数据时点和需要的字段。无需先购买 MCP 权限。

## 可以做什么

- 按关键词、已确认的品类和销售市场标签，查找免费池中的商家。
- 查看真实商家网站、现有明确类目、已记录市场标签及公开来源。初始池的商品和联系字段为空，未知观察日期为 `null`。
- 查看这一个免费数据版本的数量、品类覆盖和发布时间。
- 了解数据的解释方法和季度邮件交付的合作方式。

适合提出的问题：

> 先查看 DropshippingLeads 免费数据是否启用，再列出当前版本和可用的品类、市场标签。
>
> 使用覆盖信息中实际存在的品类标签，找出该品类中销售市场为 US 的商家，先给我 10 条，并保留来源链接和数据版本。
>
> 使用覆盖中实际返回的“Apparel, Footwear & Bags”类目查询前 5 条记录。也可以输入中文别名“服装鞋包”；两者查询同一类数据。保留店铺网址与来源，说明哪些字段为空；不要推断采购意向。
>
> 查看刚才某个商家的详情。如果免费池不足以覆盖我的需求，告诉我如何与 DropshippingLeads 确认季度邮件交付。

关键词搜索是对商家网址、已确认品类的中英文名称、产品标题和产品网址进行不区分大小写的字面匹配，**不是语义搜索**。当前 14 类的 MCP 覆盖、搜索和详情统一返回英文分类；`category` 接受正式英文名称（忽略大小写）或对应的原中文别名。市场标签精确匹配但忽略大小写。请先读取覆盖信息，不要假设标签已经齐全。[完整中英文分类对应表](docs/TOOL-REFERENCE.md#category-language)可用于核对别名。内部数据仍保留原中文分类，对外语言映射不改动源数据。初始池按当前来源已有明确标签选取、排除待确认分类；`confirmed` 不表示逐站人工核验，查询也不实时重查网站。

## 本地启动

需要 Node.js 22 或更高版本，以及可用的 pnpm。下载本仓库后，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile --ignore-scripts
node init-catalog.mjs
pnpm test
```

`init-catalog.mjs` 仅在默认数据文件缺失时创建空的 `not_ready` 数据包，已有文件保持不变。启动不会连接内部数据库或读取 Google Sheets。

### stdio

```sh
node server.mjs
```

stdio 由 MCP 客户端通过标准输入输出通信。直接在终端启动后等待输入是正常现象；它不是网页服务器。支持 `mcpServers` 配置格式的客户端可参考：

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

请把占位路径替换为本机的**绝对路径**；Windows JSON 可以使用正斜杠，例如 `C:/YOUR/PATH/dsl-public-mcp/server.mjs`。此示例不代表所有客户端都使用相同配置格式，须按所用客户端的实际入口配置。

### 本地 Streamable HTTP

```sh
node http.mjs
```

- MCP 地址：`http://127.0.0.1:54170/mcp`
- 健康检查：`http://127.0.0.1:54170/health`
- 默认仅监听本机，并检查本机 Host / Origin。

`/mcp` 是协议端点，不是介绍网页。`/health` 只返回服务运行状态、HTTP 模式与 `catalog_status`，不包含商家数据，也不推断是否已经公开部署。远程 AI 客户端无法直接访问你电脑的 `127.0.0.1`；请用正式 HTTPS 地址接入远程服务。ChatGPT、豆包等具体产品是否支持接入，须按当前产品入口、账户条件和实际连接结果判断；本说明不作兼容保证。

### 正式 HTTP 配置与简单限流

已提供显式 `proxy` 模式及[同机 HTTPS 代理配置指南](deploy/HTTP-DEPLOYMENT.md)。它要求精确的正式域名、Origin 允许列表、可信代理 IP 和单个客户端 IP；应用继续只监听回环地址。默认每 IP 平均每分钟补充 60 次请求额度、短时容量 10、并发 4；单进程总体并发 64。单客户端超限返回 `429`，总体容量耗尽返回 `503`，均附 `Retry-After`。

限流是单进程内存控制，重启会清空，不是付费额度或分布式配额。`deploy/production.env.example` 和 `deploy/nginx.conf.example` 保留域名及证书占位符，不能直接部署。自托管时需按实际域名和证书配置 HTTPS 代理，并验证协议、限流与所用客户端。官方免费服务不设付费账号层；公开数据包与 HTTP 配置独立管理。

## 工具与资源

| 工具 | 用途 |
| --- | --- |
| `search_merchants` | 按关键词、品类、市场筛选并分页；每次最多 50 条，默认 10 条。 |
| `get_merchant` | 用检索返回的 ID 读取一个公开商家。 |
| `get_data_coverage` | 查看免费池状态、版本、品类和市场计数。 |
| `get_methodology` | 查看解释边界、更新方式和合作入口。 |

另提供 `dsl://public/coverage` 和 `dsl://public/methodology` 两个只读资源。工具不支持任意 SQL、文件路径查询、全商业库访问、邮件发送或自动购买。[完整参数与返回说明](docs/TOOL-REFERENCE.md)。

### 新下载源码或尚未配置数据时

调用 `search_merchants` 会得到如下业务对象；MCP 响应同时提供文本 JSON 和 `structuredContent`：

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

`not_ready` 表示公开数据尚未启用，**不表示没有符合条件的商家**。只有在 `ready` 状态下，`matched: 0` 才表示这个公开版本中没有匹配结果；它仍不能说明商业数据库或市场上不存在这类商家。

## 为源码配置独立真实数据包

1. 本次已按用户确认的范围准备初始池：14 个大类，每类 100 条免费数据，排除食品饮料及待确认分类。后续新版本继续仅导出明确允许公开且来源类别明确的记录。
2. 按[数据接入指南](docs/DATA-GUIDE.md)准备独立 JSON 数据包，填写该次免费池的版本和发布时间。未知观察日期保留为 `null`。
3. 先验证候选文件，再安装到本地默认数据目录：

```sh
node catalog-cli.mjs check path/to/reviewed-catalog.json
node catalog-cli.mjs install path/to/reviewed-catalog.json
```

4. 重启 MCP 进程，检查覆盖、筛选、来源和日期。`install` 会保留默认数据文件的本地备份，不会发布服务。

`examples/catalog.synthetic-example.json` 仅用于理解结构和测试，包含虚构商家，不能作为首批真实开放数据发布。免费池文件、备份和完整商业库不要随意加入 GitHub 仓库。

## 使用数据时保留这些信息

- `dataset_version` / `release_period`：该次免费池版本及所属季度。
- `published_at`：免费池版本的发布时间，不是每条记录的采集时间。
- `observed_at`：该记录已知的观察时间；未知为 `null`。
- `sources`：已记录的公开来源，工具不会在查询时重新打开网站核验。

市场标签表示记录中的销售市场，不能直接当作商家经营所在地或公司注册地。产品页面不能证明采购意向，公开联系方式也不保证当前仍有效。免费数据按已确认的内部研究使用规则处理；代码 MIT 许可不授予数据再分发权。[许可说明](docs/LICENSE-NOTICE.md)。

## 服务范围与客户端兼容性

服务范围与数据版本以 `get_data_coverage` 为准，使用规则见 `get_methodology` 及免费数据条款。不同 AI 产品对远程 MCP 的支持、账户条件和入口可能不同；本说明不声称 ChatGPT、豆包等产品已经逐一通过实际连接验证。目录收录与成功接入是不同结果，也不保证搜索排序或 AI 回答引用。