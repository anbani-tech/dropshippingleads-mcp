# DropshippingLeads MCP 工具说明 / Tool reference

[中文介绍](../README.md) · [English introduction](../README.en.md) · [数据接入](DATA-GUIDE.md)

本说明对应框架 `0.2.0`。免费体验优先连接 `https://mcp.dropshippingleads.com/mcp`；初始免费池为 14 个大类，每类 100 条免费数据，不含食品饮料，实际启用状态和版本以 `get_data_coverage` 为准。下载源码不带真实 catalog，首次初始化仍为 `not_ready`。四个工具在 stdio 和 Streamable HTTP 中共用同一实现。

服务对象为一件代发平台，研究对象为小型独立在线零售商。全网发现、Google 搜索发现与公开网站采集属于业务采集流程；本 MCP 只查询已有公开快照，不提供实时 Google 搜索或爬虫工具。`market` 为销售市场标签，不是经营所在地筛选器；当前免费池未逐条核实商家的经营所在地。

## 所有工具共同遵循的规则

- 仅访问启动时装入的独立公开 JSON 数据包，不访问内部工作簿或完整商业库。
- 输入对象严格限制字段；额外的字段不被接受。不能传 SQL、数据库名、文件路径或 URL 来改变查询范围。
- 只读工具注解：`readOnlyHint: true`、`destructiveHint: false`、`idempotentHint: true`、`openWorldHint: false`。
- 成功响应同时包含 `content` 中的 JSON 文本和相同的 `structuredContent` 对象。下文示例仅展示其中的业务对象。
- 共同字段：`scope: "public_catalog"`、`status`、`dataset_version`、`release_period`、`published_at`。未启用时后三项为 `null`。
- 进程启动时读取一个数据快照。更换文件后必须重启，进行中的服务不会自动重新装入数据。

## `search_merchants`

按公开字段检索并分页。

| 参数 | 类型 | 默认 / 范围 | 实际语义 |
| --- | --- | --- | --- |
| `keyword` | string | 默认 `""`，最多 120 字符 | 去掉首尾空格后，不区分大小写的字面子串匹配。 |
| `category` | string，可省略 | 提供时须为非空，最多 120 字符 | 当前 14 类接受正式英文名称（忽略大小写）或对应的原中文别名。 |
| `market` | string，可省略 | 提供时须为非空，最多 40 字符 | 与一条销售市场标签精确匹配，忽略大小写。 |
| `limit` | integer | 默认 10，1–50 | 本次最多返回的记录数。 |
| `offset` | integer | 默认 0，0–100000 | 在匹配结果中的分页起点。 |

多个条件同时提供时按 AND 组合。关键词匹配范围是 `store_url`、已确认分类的中英文名称、产品的 `title` 和 `url`，不包含联系方式或来源标签。分类使用固定的双语名称映射，不进行任意文本翻译、语义扩展或隐藏数据库查询。省略关键词时列出满足其他条件的公开记录。输入 `null` 不能代替省略可选参数。

例：

```json
{"keyword":"jacket","limit":10,"offset":0}
```

先读取 `get_data_coverage`，再使用它实际返回的品类和市场名称。例如，只有覆盖中已有 `Apparel, Footwear & Bags` 与 `US` 时，才使用：

```json
{"category":"Apparel, Footwear & Bags","market":"US","limit":10,"offset":0}
```

启用后结果包含：

| 字段 | 含义 |
| --- | --- |
| `query` | 查询参数；已知分类的筛选值统一返回英文正式名。可省略筛选条件在这里为 `null`；未映射的输入原样保留。 |
| `matched` | 当前公开版本中匹配全部条件的记录数。 |
| `returned` | 本页实际记录数。 |
| `next_offset` | 下一页起点；没有下一页时为 `null`。 |
| `records` | 本页商家对象。 |

顺序遵循数据包原有顺序，没有相关性打分。下一页沿用相同条件及 `next_offset`，并保留版本信息。更新版本后不应把不同版本的分页结果当作同一快照。

新下载源码尚未配置数据时的完整业务对象：

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

此状态没有 `query` 或 `returned`，调用方不要假设它们始终存在。`matched: null` 不能转换为零条匹配。


<a id="category-language"></a>

## 分类语言 / Category language

当前初始池的 14 个大类在 MCP 覆盖、搜索记录和详情中统一返回英文。`category` 可输入下表英文正式名（忽略大小写）或对应中文别名；二者筛选相同记录。英文官网使用英文展示，中文官网可按同一映射展示中文；内部 catalog 保留原标签，不修改记录、ID 或数量。关键词也可匹配两种语言的分类名称，不进行任意文本翻译。

For the initial 14 categories, MCP coverage keys and merchant category arrays use canonical English names. The category filter accepts a canonical English name (case-insensitive) or its Chinese alias. Both select the same records, including pagination. Keyword matching also includes both language forms. The mapping does not rewrite the internal catalog or alter records, IDs or coverage counts.

| English category returned by MCP | 中文兼容查询名称 |
| --- | --- |
| Apparel, Footwear & Bags | 服装鞋包 |
| Home & Living | 家居家装 |
| Beauty & Personal Care | 美妆个护 |
| Health & Wellness | 健康保健 |
| Pet Supplies | 宠物用品 |
| Baby, Kids & Toys | 母婴玩具 |
| Electronics & Home Appliances | 数码家电 |
| Sports & Outdoors | 运动户外 |
| Medical Devices | 医疗器械 |
| Gifts & Entertainment | 礼品文娱 |
| General & Other | 综合其他 |
| Jewelry & Watches | 珠宝钟表 |
| Automotive Supplies | 汽车用品 |
| Tools, Hardware & Garden | 五金园艺 |

中文兼容查询 / Chinese-compatible query:

```json
{"category":"服装鞋包","limit":5,"offset":0}
```

该查询与 `{"category":"Apparel, Footwear & Bags","limit":5,"offset":0}` 查询同一类数据，返回的分类仍为英文。市场标签、来源内容及已有商品文本不因分类映射而翻译。未来未映射的新分类保留原始值，不自动生成或猜测英文名称；正式开放前应补齐并验证映射。

## `get_merchant`

输入：

```json
{"id":"<search_merchants 返回的真实 ID>"}
```

`id` 为 1–100 字符的非空字符串。使用检索结果中的 ID，不按商家名称猜测或编造 ID。

- 启用且找到：`found: true`，`record` 为商家对象。
- 启用但未知 ID：`found: false`，`record: null`。
- 未启用：`found: null`，`record: null`，附 `message: "Public catalog not loaded yet."`。

以上均包含共同的状态及版本字段。查询不到 ID 不代表该商家不存在。

## 商家返回字段

| 字段 | 说明 |
| --- | --- |
| `id` | 从规范化网址生成的稳定 ID。 |
| `store_url` | 商家公开网站。 |
| `categories` | 当前 14 类以正式英文名称返回；可多选，不表示完整分类树。内部中文标签不被改写。 |
| `markets` | 记录中的销售市场标签；未知为 `[]`，不是公司注册地。 |
| `products` | 已记录的产品 `{title?, url}`；不代表采购意向。 |
| `contacts` | 审核后允许公开的联系方式；允许 `[]`。 |
| `sources` | 支撑记录的公开来源 `{url, label?}`。 |
| `observed_at` | 已知的观察时间，ISO UTC；未知为 `null`。 |
| `evidence` | 分类状态、观察日期、核验方式与解释限制。 |

内部审核标记 `approved_for_public` 和记录顶层的 `classification_status` 不直接出现在返回顶层。`evidence.classification_status` 为 `confirmed`，`evidence.verification` 为 `recorded_sources_not_live_verified`。这表示返回已记录的证据，并没有在本次调用中实时验证网站。初始池的 `confirmed` 表示来源已有明确分类，不表示逐站人工审核；`products`、`contacts` 为空，`observed_at` 为 `null`，`markets` 仅保留原有记录。

## `get_data_coverage`

输入必须为空对象 `{}`。

| 字段 | 说明 |
| --- | --- |
| `record_count` | `ready` 时为实际公开记录数；`not_ready` 时为 `null`。 |
| `categories` | 正式英文分类名称到记录计数的映射。多标签会重叠，不能相加当作独立商家数。 |
| `markets` | 销售市场标签到记录计数的映射；也可能重叠。 |
| `full_business_database_count` | 当前始终为 `null`；不公开或估算商业库规模。 |
| `all_categories_claimed` | 当前始终为 `false`；不宣称全品类已经覆盖。 |
| `limits.max_results_per_call` | 50。 |
| `note` | 提醒这些计数只代表公开版本，且业务每天采集不表示免费池每天更新。 |

计数来自所装入的文件，不进行实时全网统计或内部数据库统计。

## `get_methodology`

输入必须为空对象 `{}`。返回共同状态及版本字段，以及：

- `provider`：DropshippingLeads。
- `purpose` / `search`：免费公开商家数据用途与实际字面搜索规则。
- `commercial_service`：私下确认范围和季度报价，邮件交付；没有付费 MCP 层。
- `contact.email`：`contact@dropshippingleads.com`。
- `contact.url`：工具返回官网合作页的通用入口；文档直达：[中文合作页](https://dropshippingleads.com/?product=leads&view=application&lang=zh#application) / [English enquiry](https://dropshippingleads.com/?product=leads&view=application&lang=en#application)。
- `updates`：业务每天采集补充，数据服务按季度更新，免费池单独标识版本。
- `boundaries`：只装入分类已确认且允许公开的记录；未知日期留空；没有内部工作簿、客户备注、任意 SQL、对外消息发送或自动付费访问。

读取此工具不会创建询盘或发送邮件。实际联系由用户自行决定并操作。

## 资源

| URI | 内容 | MIME |
| --- | --- | --- |
| `dsl://public/coverage` | 与 `get_data_coverage` 相同的业务对象 | `application/json` |
| `dsl://public/methodology` | 与 `get_methodology` 相同的业务对象 | `application/json` |

## 错误与传输

超出参数范围、额外输入字段或错误类型会被参数校验拒绝。工具执行阶段的错误返回 `isError: true` 和参数 / 数据状态检查提示，不向客户端暴露本机路径或内部异常堆栈。启动时数据文件无效则拒绝启动，不悄悄降级为另一份数据。

本地 HTTP 默认 `127.0.0.1:54170`，MCP 路径为 `/mcp`，请求体上限 64 KiB，并限制 Host / Origin。它不是对公网开放的部署配置。HTTP 传输是否健康与数据是否 `ready` 是两个状态，须分别检查。

## Code and data permissions / 代码与数据权限

The framework code uses [MIT](../LICENSE.txt). Actual tool responses containing merchant records follow the separate, owner-approved [Free Data Terms 1.0](FREE-DATA-TERMS.md): internal research, retention and private AI analysis are allowed; resale, public redistribution and external data services using those records require separate express written permission. The MIT code permission and the data-use permission apply separately; Free Data Terms version 1.0 take effect on 30 October 2026.

框架代码采用 [MIT](../LICENSE.txt)。包含商家记录的实际工具响应按独立、已确认的[免费数据使用条款 1.0](FREE-DATA-TERMS.md)处理：允许内部研究、保存及私密 AI 分析；不得未经另行明确书面许可转卖、公开再分发或用于对外数据服务。代码与数据许可分别适用；数据条款版本为 1.0，生效日期为 2026-10-30。
