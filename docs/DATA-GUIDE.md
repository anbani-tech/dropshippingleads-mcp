# DropshippingLeads MCP 数据接入与版本管理

[介绍](../README.md) · [工具说明](TOOL-REFERENCE.md) · [许可说明](LICENSE-NOTICE.md)

框架与数据分开管理。当前框架为 `0.2.0`；免费体验使用远程 Streamable HTTP 服务 `https://mcp.dropshippingleads.com/mcp`，实际启用状态、版本和覆盖范围以 `get_data_coverage` 为准。源码包不含真实 catalog，首次 `init-catalog` 仍创建 `not_ready` 空包；MCP 不直接连接内部数据库。

## 面向一件代发平台的商家数据

DropshippingLeads 为一件代发平台提供海外小 B 商家数据，帮助平台从全网发现独立在线零售商，拓展商家客户。我们结合 Google 搜索发现与公开网站采集，跨 Shopify、WooCommerce 等建站平台及自建网站持续发现商家，为商家研究、合作适配评估和客户开发提供数据支持。

这里的“海外小 B”指一件代发平台希望拓展的海外中小商家，例如独立站经营者和小型在线零售商。它是服务定位，不是每条记录已经核实的企业规模标签。初始免费池不提供员工数、营收或采购量证据，也不证明商家已使用一件代发或有采购意向。

“全网”描述跨建站平台、跨独立网站的发现与采集范围，不代表已收录全部商家或每个平台。具体可提供的数据以当前数据版本及合作约定为准。MCP 查询已有公开快照，不在调用时执行 Google 搜索或实时爬取网站。

### 地域口径：经营所在地

采集重点为经营所在地位于中国、印度、土耳其和俄罗斯以外的商家，地域口径按商家经营所在地判断；网站面向的销售市场单独区分。这是业务采集方向；当前免费池未逐条核实商家的经营所在地。现有 `market` 字段仍为销售市场标签，不能用来证明经营所在地或四国排除条件。

## 公开范围

初始免费池为 **14 个大类，每类 100 条免费数据，不含食品饮料**。按当前来源已有明确类别与用户授权范围选取，排除待确认分类，保留真实类目归属。初始记录仅包含真实店铺网址、明确类目、有记录的市场标签与公开商家网站来源；`products`、`contacts` 为空，未知 `observed_at` 为 `null`。这不表示逐站人工核验或实时验证。商业库、内部源表和未确认记录不进入公开包。

| 可进入免费池 | 留在内部或单独约定的交付中 |
| --- | --- |
| 明确批准公开的商家网址、确认品类、已记录市场标签 | 未批准开放的记录、待确认分类、未审核原始抓取结果 |
| 明确允许开放的产品信息、公开联系方式和来源 | 客户备注、报价、交付名单、内部工作簿地址、访问凭证 |
| 已知且真实的观察时间，或未知时的 `null` | 为显得新而补写的采集日期、从发布时间推断的观察日期 |

是否开放一条数据及一个字段，应由 DropshippingLeads 按真实业务权限决定。联系方式出现在公开网页上不等于已获得任意再分发许可；程序格式校验不能代替这项审核。

## 分类语言与内部数据

内部 catalog 保留来源已有中文分类，API 的对外语言映射不改写数据文件。当前 14 类在 `get_data_coverage.categories`、搜索记录和详情的 `categories` 中统一返回英文；`category` 同时接受英文正式名（忽略大小写）与原中文别名。关键词可匹配分类的两种语言名称。完整对应表见[工具说明](TOOL-REFERENCE.md#category-language)。

网站中文与英文展示使用同一份映射；计数、记录 ID、所属类别和分页顺序保持一致。市场标签仍是原有销售市场信息，来源和商品文本不随分类显示语言翻译。

## 三种时间与版本

| 层次 | 字段 / 约定 | 含义 |
| --- | --- | --- |
| 业务采集 | 内部持续采集 | 每天补充业务数据，不自动触发免费池更新。 |
| 商业交付 | 私下确认的季度报价与数据时点 | 交付一批约定数据，邮件完成；具体范围写入双方约定。 |
| 免费池版本 | `version`、`release_period`、`published_at` | 标识这一次公开包；不能声称它始终是完整最新库。 |
| 单条记录 | `observed_at` | 记录已知的观察时间；不知道时为 `null`。 |

`release_period` 是 `YYYY-Q1` 至 `YYYY-Q4` 格式的发布季度，不保证每条记录都在该季度采集。`published_at` 是这一版免费池的发布标记，不能复制到每条记录冒充观察时间。版本元数据不能替代接口可用性或记录观察时间的验证。

## 默认空包

```json
{
  "schemaVersion": 1,
  "status": "not_ready",
  "version": null,
  "release_period": null,
  "published_at": null,
  "records": []
}
```

在仓库根目录执行 `node init-catalog.mjs`，仅在默认 `data/catalog.json` 缺失时生成此空包。已有数据不被覆盖。`not_ready` 只能配合空记录及三个为 `null` 的版本字段使用。

## 正式数据包结构

顶层仅允许以下字段：

| 字段 | 要求 |
| --- | --- |
| `schemaVersion` | 固定为数字 `1`。 |
| `status` | `ready` 或 `not_ready`。 |
| `version` | `ready` 时为非空字符串，最多 80 字符；每次发布使用可辨识的独立版本。 |
| `release_period` | `ready` 时为 `YYYY-Q1` / `Q2` / `Q3` / `Q4` 格式。 |
| `published_at` | `ready` 时为有效 ISO UTC 日期时间，如 `2026-10-30T00:00:00Z`；该日期只说明格式，不是本项目已发布的日期。 |
| `records` | `ready` 时必须非空，最多 100000 条；运行时文件不超过 64 MiB。技术上限不是承诺的开放规模。 |

每条记录仅允许：

| 字段 | 要求 |
| --- | --- |
| `id` | 必须由 `stableMerchantId(store_url)` 生成；不能手写任意 ID。 |
| `store_url` | 公开的绝对 HTTP(S) 商家网址，无用户名、密码或凭证参数。 |
| `categories` | 内部文件保留原有分类：1–30 个非空标签，每项最多 120 字符，不重复；必须已确认。对外响应再映射为英文名称。 |
| `markets` | 0–40 个非空标签，每项最多 120 字符，不重复；未知为 `[]`。查询参数的单个市场筛选值最多 40 字符，建议使用简短一致的标签。 |
| `products` | 最多 30 个 `{ "url": "公开产品网址", "title": "可选标题" }`；标题最多 300 字符。 |
| `contacts` | 最多 20 个 `{ "type": "类型", "value": "值" }`；没有已审核联系方式时为 `[]`。 |
| `sources` | 1–20 个 `{ "url": "公开来源网址", "label": "可选标签" }`；标签最多 160 字符。 |
| `observed_at` | 明确写 `null`，或有效 ISO UTC 日期时间。 |
| `classification_status` | 固定为 `"confirmed"`。 |
| `approved_for_public` | 固定为布尔值 `true`，代表已按本次用户授权及选取规则纳入公开范围；不能据此声称已逐站人工核验。程序只校验显式标记。 |

允许的 `contacts.type`：`email`、`website`、`facebook`、`instagram`、`linkedin`、`whatsapp`、`other_public_url`。`email` 填邮箱；其余类型填公开 HTTP(S) 地址，不能直接填电话号码或内部 URL。

公开 URL 会拒绝本机 / IP 地址、部分内部域名、Google Docs / Drive 工作簿域名以及明显带凭证的查询参数。这是边界检查，不是对网页是否可访问、版权或信息准确性的核验。

所有未知字段会导致候选包被拒绝，不会自动去掉敏感列后继续安装。导出前先明确字段白名单。来源不能用内部原始表格地址代替公开证据。

### ID 与去重

在准备数据的 Node.js 脚本中调用项目导出函数：

```js
import { stableMerchantId } from './data.mjs';

const id = stableMerchantId('https://merchant.example/');
```

这是格式演示，`.example` 为虚构网址，不能当作真实商家。ID 基于规范化域名、非根路径和查询参数生成；协议、域名前的 `www.` 和根路径斜杠差异会合并。同一规范化网址的重复 ID 会被拒绝。

这一规则**不是企业级去重**：一个企业有多个域名、路径或 URL 参数时仍可能产生多条记录。请在导出前确认商家网址、剔除跟踪参数并按业务规则去重，不要声称程序已识别同一企业的全部网站。

## 候选包到本地启用

1. 按当前已确认类别与用户授权范围准备版本化候选 JSON，保留内部选取记录。首批为 14 个大类、每类 100 条免费数据，不含食品饮料；后续版本沿用分类与字段边界检查。
2. 仅校验候选文件，不修改当前数据：

```sh
node catalog-cli.mjs check path/to/reviewed-catalog.json
```

3. 确认候选包内容和状态后，安装到本地默认 `data/catalog.json`：

```sh
node catalog-cli.mjs install path/to/reviewed-catalog.json
```

`install` 只接受 `ready` 数据包。它备份已有默认文件到 `data/backups/`，再替换默认数据文件。该操作仅发生在本地，不会部署网站、发布 GitHub 或连接内部数据库。

4. 重启 stdio 或 HTTP MCP 进程，以激活新快照。检查 `get_data_coverage` 的状态、版本、记录数、标签，并抽查检索、分页、详情、来源和未知日期。
5. 数据更新后复核实际公开包、运行环境、范围和字段；确认远程服务返回新版本后再更新对外说明。本地安装数据不会自动更新远程部署。

运行时默认读取 `data/catalog.json`。运营方也可以通过启动环境变量 `DSL_PUBLIC_DATASET` 指定绝对文件路径；客户端不能通过工具参数修改它。注意：`catalog-cli.mjs install` 始终写入默认路径，如果服务使用自定义路径，需要运营方按同样审核流程更新实际使用的文件，再重启核实版本。

## 备份与回退

发现候选数据有问题时停止当前进程，核对 `data/backups/` 中的上一个文件，再将正确文件恢复至实际使用的数据路径并重新启动。恢复前保留当前文件以便查明问题。旧版若为 `not_ready`，可恢复该空包；不要使用只接受 `ready` 的 `install` 命令来安装空包。

免费池、内部源数据和本地备份默认不应提交到说明仓库。仓库中的 `.gitignore` 只是防止常见误加入，不会撤销已提交或已公开过的数据。若以后要公开下载某个免费版本，应单独明确该版本及其使用许可。

## 测试样例与验收

`examples/catalog.synthetic-example.json` 为虚构结构样例，不证明真实品类覆盖、商家数量或数据质量。新下载源码未配置真实包时保持 `not_ready`，不要用虚构样例冒充已配置的初始免费池。

```sh
node --test data.test.mjs transport.test.mjs
```

自动测试用于验证接口与边界行为。最终真实数据仍需检查：公开范围与分类审核是否完成、来源能否支撑字段、日期是否真实、计数是否与候选文件一致。程序通过不等于业务数据已经审完。

## 已确认的数据使用边界 / Approved data-use boundaries

[免费数据使用条款 1.0](FREE-DATA-TERMS.md)允许自身业务的内部研究、保存和必要的私密 AI 分析；未经另行明确书面许可，不得转卖或公开再分发任何记录。框架代码的 [MIT 许可](../LICENSE.txt)不适用于实际 catalog、MCP 商家记录响应或记录导出。数据条款版本为 1.0，生效日期为 2026-10-30。

[Free Data Terms 1.0](FREE-DATA-TERMS.md) permit internal research for your own business, retention and necessary private AI analysis, without resale or public redistribution of any records absent separate express written permission. The [MIT code license](../LICENSE.txt) does not cover real catalogs, MCP merchant-record responses or record exports. Free Data Terms version 1.0 take effect on 30 October 2026.
