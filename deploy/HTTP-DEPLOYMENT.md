# DropshippingLeads MCP HTTP 配置与同机反向代理

本文件准备独立 DropshippingLeads MCP 的正式 HTTP 配置；当前只做本地验证，不部署、不启用 Nginx、不配置 DNS/TLS，不修改 DropshippingLeads 官网或英文版。正式目标已选定为 https://mcp.dropshippingleads.com/mcp，公网端点未发布；本文件保留通用配置示例，目标配置另见本地 TARGET-DEPLOYMENT.md。本机已配置并验证初始免费池：14 个大类，每类 100 条免费数据，不含食品饮料。源码下载不附真实 catalog，首次初始化仍为 `not_ready`；数据状态与 HTTP 是否公网发布分开判断。免费 MCP 与私下季度报价、邮件交付的商业方式保持一致。

## 一条简单的运行路径

未来运行方式：外部客户端 → 同机 Nginx 的 HTTPS 443 端口 → `127.0.0.1:54170` 上的 DropshippingLeads MCP。应用始终只监听 `127.0.0.1`；`DSL_HTTP_PORT` 可改端口，不能将监听地址改成公网地址。此实现只支持同机可信反向代理，不支持跨机器代理、CDN 转发链或任意 CIDR。

应用提供两种模式：

| 模式 | 用途 | 请求身份与校验 |
|---|---|---|
| `local`（默认） | 本机开发和 stdio 之外的 HTTP 调试 | 只接受本地 Host/Origin；用 socket 对端 IP 限流，不信任转发头 |
| `proxy` | 同机 HTTPS 入口后运行；可在本机模拟 | 对端必须是显式配置的可信 loopback IP；Host 与正式 origin 匹配；X-Forwarded-Proto 必须是 `https`；X-Forwarded-For 必须是单个合法 IP |

`proxy` 模式只说明应用的边界校验启用，不能证明证书、DNS 或公网服务已存在。回环接口上的可信本机进程本就位于这个信任边界内；本实现不声称防止同机恶意进程伪装 Nginx。

## 环境变量

`production.env.example` 只是待填模板，不会自动被 `node http.mjs` 读取。复制成私有配置并填真实值后，Node.js 22+ 可用 `--env-file` 显式加载。保留的 `REPLACE_MCP_HOST` 应令配置校验立即失败，不能误当已配置服务启动。

| 变量 | 默认 / 要求 |
|---|---|
| `DSL_HTTP_MODE` | `local`；只能选 `local` 或 `proxy` |
| `DSL_HTTP_PORT` | `54170`；必须是有效 TCP 端口 |
| `DSL_PUBLIC_ORIGIN` | proxy 必填，规范的 `https://主机[:端口]` origin，无末尾 `/`、路径、账号、查询或 fragment；不接受通配符、占位域名、`.invalid`、`.example` |
| `DSL_ALLOWED_ORIGINS` | proxy 可选，逗号分隔的精确 HTTPS origin；省略时只允许 `DSL_PUBLIC_ORIGIN`；按实际浏览器客户端需要增加，不猜测平台域名 |
| `DSL_TRUSTED_PROXY_IPS` | proxy 必须显式填写，且必须含 `127.0.0.1` 与本版 IPv4 监听一致；可附加 `::1`，不能只填 `::1`；无 CIDR/通配符 |
| `DSL_RATE_PER_MINUTE` | `60`，令牌桶每分钟补充 60 个额度；不是固定分钟窗总数 |
| `DSL_RATE_BURST` | `10`，每个客户端的短时容量 |
| `DSL_RATE_MAX_CONCURRENT_PER_CLIENT` | `4`，每客户端同时处理的请求上限 |
| `DSL_RATE_MAX_CONCURRENT_TOTAL` | `64`，单进程总体并发上限 |
| `DSL_RATE_MAX_CLIENTS` | `10000`，单进程限流状态的客户端容量 |

`/mcp` 和 `/health` 都受请求频率与并发限制，OPTIONS 也消耗请求预算。单客户端额度或并发超限返回 429；单进程总并发或客户端状态容量已满时返回 503。两者都有 `Retry-After`，客户端据此退避。请求完成或连接断开释放并发；空闲客户端在状态已恢复完整额度后可清理。内存限流在进程重启后重置，不是分布式配额或反复制系统；首发一个进程即可。多个 AI 用户可能共用一个出口 IP，实际接入后根据体验和负载调整参数。

业务的查询范围仍只有公开数据包：单次最多 50 条，分页可遍历公开池；限流不等于防下载，免费访问不自动授予转售权。该服务没有客户付费账号、OAuth 订阅或付款解锁。

## 同机 Nginx 的关键约定

`nginx.conf.example` 是供未来实际环境填写的 `http {}` 内片段，不能原样安装。它只增加 MCP 自己的命名虚拟主机，不替换官网的 server/default_server，也不增加 80 端口跳转。它保留了域名和证书路径占位符；当前未执行 `nginx -t` 或启动 Nginx。

- HTTPS 由 Nginx 终止，应用只接收同机 loopback 流量。不要在应用前再加入未经实现和验证的代理链。
- 用 `Host $host`（443 模板）和 `X-Forwarded-Proto $scheme` 覆盖请求头。正式 origin 使用非默认端口时，需要一起修改 Host 转发和 origin 配置，不能只换证书。
- `X-Forwarded-For` 必须覆盖为 `$remote_addr`。不能使用 `$proxy_add_x_forwarded_for`，否则会保留调用者伪造的 IP 链。应用只接受一个实际 IP。
- Origin 原样透传，应用按精确允许列表校验；不要把恶意 Origin 改写成可信域名。无 Origin 的服务器客户端按应用规则处理，不受浏览器 CORS 限制，但仍受 Host、可信代理和限流约束。
- `Forwarded`、`X-Forwarded-Host`、`X-Real-IP` 不用于应用放行或识别客户端；模板移除它们以免后续误用。
- 代理关闭响应缓冲与缓存，保留 Streamable HTTP 行为。CORS 和 OPTIONS 由应用返回，不在 Nginx 添加宽泛 CORS 头。
- 该模板直接接收公网客户端，不开启 `real_ip_header` 或外部 CDN 信任配置。若复用现有 Nginx，全局继承的真实 IP 重写可能改变 `$remote_addr`，必须先排除冲突。

这些请求头覆盖及缓冲设置依据 [Nginx 官方代理模块说明](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。MCP 的 Origin 校验与本地 loopback 绑定要求见 [MCP HTTP transport 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。具体工程选择仍以本项目实现和测试为准。

## 本地验证方式

在项目目录先运行以下命令，初始化步骤不会覆盖已有公开包：

```powershell
pnpm install --frozen-lockfile --ignore-scripts
node init-catalog.mjs
pnpm test
node catalog-cli.mjs check data/catalog.json
```

普通本地运行使用 `node http.mjs`，默认回环地址为 `http://127.0.0.1:54170/mcp`。独立终端可以请求 `/health`；此时仍是本地 HTTP。

proxy 模式的本地测试可以使用测试专用的规范 HTTPS origin 字符串，在 loopback 请求中模拟 Nginx 转发的 Host、X-Forwarded-Proto、X-Forwarded-For 和 Origin；域名字符串不需要解析，测试不会连接它。测试文件应自己创建临时端口并关闭服务，避免把模拟配置留给正常进程。测试专用值不能写进 `production.env` 或正式目录资料。

需要覆盖的用例：

1. 不合法配置立即失败，未选域名时模板不能启动。
2. 默认 local 模式保持有效；伪造转发头不能改变客户端 IP 或绕过限流。
3. proxy 合法请求通过；不可信对端、错 Host、缺失或非 HTTPS 转发协议、多 IP 链、非法 IP、非法 Origin 被拒绝。
4. 合法 Origin 的预检和 MCP 请求返回精确 CORS；非法 Origin 不得到允许头；没有 Origin 的服务端请求正常处理。
5. 连续请求触发 429，等待建议时间后恢复；不同真实客户端彼此隔离；并发完成和断开后释放计数；总并发和状态容量耗尽返回 503，客户端容量有界。
6. `/health` 只含 `service`、`status`、`mode`、`catalog_status` 这类最小状态，不出现记录、联系方式、完整 coverage 或 `published` 推断字段。
7. 原有 stdio、工具、分页、数据校验和未激活状态行为仍通过。

这些测试验证的是应用配置和边界，不是实际 TLS 握手、Nginx 配置装载、公网网络质量或 ChatGPT/豆包产品接入。

## 真正上线时只补必要事项

选好真实域名及运行机器后，替换模板中的域名、证书路径，填写同机代理配置，校验 Nginx 实际配置并在批准上线时启动。Node 的最终启动形式为：

```text
node --env-file=deploy/production.env http.mjs
```

上面只是未来命令形式，本轮不运行它，也不生成真实生产配置。正式数据准备好后先校验再装入；从外部实际客户端完成一次搜索、详情和覆盖范围查询，确认 429 及断线重试行为，再公布入口。尚未填数据时 `/health` 可以返回正常运行，但 `catalog_status:not_ready` 表示没有启用正式公开数据，不能据此宣布可用数据已上线。

出现配置错误先恢复上一个已验证配置并重启；第一次上线没有旧版本时关闭公开入口即可。数据问题按公开包备份恢复，不把虚构样本作为回滚数据。代码、数据、环境配置分别记录版本，生产密钥与数据文件不进入公开 GitHub 仓库。
