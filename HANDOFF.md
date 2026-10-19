# 博学 ASSCUBO 项目交接

更新日期：2026-10-19。本文供换电脑后的 AI 和开发者接续工作，描述截至本次 1.1.6 提交的状态。后续如有新提交，以 Git 和实际代码为准。

## 1. 新电脑先做什么

1. 克隆 https://github.com/smxlrs/asscubo-app.git ，切换 main，拉取最新代码。
2. 阅读本文、根目录 .agents/AGENTS.md 和 student-app/AGENTS.md。旧说明中写“微信文章来源”的部分已经过时：目前文章只展示网站来源；文章与手动通知仍必须严格分离。
3. 检查 git status、git log -5 --oneline 和版本文件。本次目标版本为 1.1.6；本次提交包括本文、火车修复和搜索排序。
4. 恢复本地环境配置及登录，在 student-app 下安装依赖，再运行回归测试。不要把旧电脑路径、局域网 IP 或代理端口照搬为新电脑的配置。
5. 当前没有待执行的 Supabase SQL、数据库迁移或函数部署。本次是客户端更新。下一步通常是按用户指示测试、构建或继续优化；不要未经要求自动发布商店或重跑后台迁移。

## 2. 用户要求和工作习惯

- 用户要求不要在 C 盘安装开发环境。优先复用 G:/fp/PARTTIME 已有环境，缺少时使用 G:/fp/PARTTIME/linshihuanjing；新电脑若盘符不同，先与用户确认可用目录。
- 用户不喜欢反复请求已授权操作的确认；正常检查、修复、测试持续完成即可。
- 不要为修复一个问题破坏之前更新。尤其保留网络兼容、通知图片、文章显示和四语本地化。
- 语言：简体中文、繁体中文、英语、意大利语。用户可见错误说明需要人能看懂，不能武断把所有网络错误归为 DNS 或地区限制。
- 更新说明要简短、列表形式、自然，通常最后加“修复了一些已知问题”。
- 每次用户要求 push/build/deploy 时，按 AGENTS.md 自动递增应用版本最后一段；同步 package.json、app.json、package-lock.json 顶层及 packages[''] 版本。
- 修改版本必须解析 JSON 并只改应用版本。曾经全局替换版本字符串误改了同版本号的依赖条目，已纠正，不能再这样做。
- 写代码前阅读精确版本 Expo 文档：https://docs.expo.dev/versions/v56.0.0/ 。

## 3. 项目与目录

- 旧电脑根目录：G:/fp/PARTTIME/AG，真正的 App 在 student-app/。
- 技术栈：Expo SDK 56、React Native 0.85、Expo Router、TypeScript、Supabase。
- Git 远端：https://github.com/smxlrs/asscubo-app.git ，当前分支 main。
- 网站：https://asscubo.it ，WordPress，由用户控制。
- Expo 项目：@smxlrs/union-student-app；iOS Bundle ID：com.asscuboxue.app。
- supabase/：数据库迁移、Edge Functions、后台测试；integrations/wordpress/：网站桥接插件、部署说明与审计工具。
- student-app/tests/：客户端回归测试，主要用 Node 自带测试框架和 TypeScript 转译执行实际源码。
- ag_features_map.md、待修复.md 等是历史补充资料；未逐项重新审定，不能把其中每项直接视作当前待办。

## 4. 本次 1.1.6：Italo 空详情修复

### 原因证据

用户从 Bologna Centrale 出发站牌点击 Italo 8910，详情显示暂无数据。不是简单的 VPN 或系统差异。

2026-10-19 实测官方车次接口 HTTP 200，但内容为 IsEmpty:true、TrainSchedule:null；8910、8918、9935 等样本都有空详情。官方网页目前也调用同一接口。站牌仍可返回班次、时刻、延误与部分站台信息。

原有站牌回退又未正确识别 VENEZIA S.LUCIA（本地是 Venezia Santa Lucia），所以可用的回退信息没有显示。旧的模糊站名解析还可能把 bologna 识别为其他博洛尼亚小站。

### 当前行为

- 官方完整详情可用时继续使用完整详情。
- 完整详情为空时，可根据用户选中的当日站牌展示明确标注的部分信息。
- 页面提示信息来自车站站牌，不假装有完整行程、实时位置、实际到发时间或“准点/未发车”结论。
- 保留站牌已有计划/实际站台及正确的到达、出发方向；能查询到目的站到达信息时补充。
- 不用今天的实时站牌给其他日期的历史或未来班次编造数据。
- 识别 Venezia S.Lucia、Firenze SMN、Torino P.Nuova/P.Susa、Bazzano FER 等常见别名；存在歧义时不随意猜站。
- 站牌缓存包含车站、方向、车次、出发站和日期时间；手动刷新绕过缓存。
- 请求版本检查防止旧请求和后台补充站台覆盖新的刷新结果。
- Italo 运营方站码转换为本地标准站 ID；计划和实际站台保持独立。

### 关键代码

- student-app/lib/viaggiaTrenoService.ts：API、解析、站名识别、部分详情回退。
- student-app/app/tools/train/station-board.tsx：站牌、导航参数、刷新、缓存与请求竞争处理。
- student-app/app/tools/train/train-status.tsx：完整/部分详情区分和四语提示。
- student-app/tests/trainRecovery.test.cjs：上述回归验证。

### 当前接口

Italo 直接调用官方接口，不经过 Supabase 代理：

- https://italoinviaggio.italotreno.it/api/RicercaTrenoService?TrainNumber=8910
- https://italoinviaggio.italotreno.it/api/RicercaStazioneService?CodiceStazione=BC_&NomeStazione=bologna
- https://italoinviaggio.italotreno.it/api/RicercaStazioneService?CodiceStazione=VSL&NomeStazione=venezia-santa-lucia

站牌接口一次包含到达和出发数据。请求保留 ITALO_HEADERS 中的 User-Agent、Accept、Referer、Origin；共用 20 秒超时。官方根网址可能重定向到 .com，但这次试过 .com 详情同样为空，单换域名不能解决根因。

Trenitalia/Trenitalia Tper 保留独立链路：先走 Supabase viaggia-treno-proxy，遇指定失败才在剩余超时内回退官方 HTTPS https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno 。不要把 Italo 的逻辑套给全部运营商，不要恢复全局明文 HTTP 或泄露代理凭据到第三方。

## 5. 本次 1.1.6：车站搜索排序

用户要求搜索 Torino 时 Porta Nuova 第一、Porta Susa 第二，主要站优先于不常用的小站。

旧问题：目录中 Porta Susa、Roma Tiburtina 等重要站优先级 p 为 0，且同级偏向短名字，导致小站靠前。

现由 student-app/lib/stationSearch.ts 的 rankStationMatches 统一负责，本地输入建议和 service.searchStations 的本地/官方回退都使用同一规则：

1. 完整站名匹配优先，再按名称前缀、词匹配、子串匹配。
2. 同类匹配中主要出行枢纽优先，再区域枢纽，再其他站。
3. 用稳定站 ID 配置枢纽优先级，不会把 Garibaldi Passante 或 Mestre Ospedale 误当对应主站。
4. 其余城市继续使用原目录优先级；同级以名称和 ID 稳定排序。
5. 保留中文城市别名和小站检索；增加重音符号及标点标准化。页面仍最多显示 8 个建议，服务最多 15 个，没有删除目录车站。

示例：

- Torino：Porta Nuova → Porta Susa → Lingotto。
- Roma：Termini → Tiburtina → Ostiense。
- Milano：Centrale → Porta Garibaldi → Rogoredo。
- Firenze：Santa Maria Novella → Campo di Marte → Rifredi。
- Venezia：Santa Lucia → Mestre。
- Genova：Piazza Principe → Brignole → Sampierdarena。
- Napoli：Centrale → Afragola。

这是人工维护的出行枢纽优先级，不是精确客流概率、用户行为追踪或全意大利官方客流排名。查看过 RFI 官方车站资料 https://www.rfi.it/it/stazioni.html ，尚未取得覆盖全部车站、口径一致的可用客流表，不应向用户声称已导入此类数据。

## 6. 用户问过的两个火车现象

- 五位车次号如 90041 没有站台：实测官方 Trenitalia Tper 数据共 13 站，所有计划/实际站台字段都是 null。这不是按五位数字过滤造成的。代码已兼容有值的描述/数字字段，但不能编造未提供的站台，也不能把内部站台代码当站台号。
- Bazzano (FER)：这是运营方正式名称，FER 为 Ferrovie Emilia Romagna。官方返回 BAZZANO|S07436 与 BAZZANO (FER)|S05975，是不同站。保留区别，不要仅凭同名合并。

## 7. 以前已完成、需要保留的更新

### 文章和通知

- 文章已切换为 asscubo.it 网站来源；用户明确要求 App 不再展示微信外链文章，所有网站文章按原分页逻辑加载。
- 首页/查看全部/文章页保留原有列表逻辑；App 内文章阅读重排版，隐藏网站头部、作者区、长页脚，不改网站的普通访客页面。
- 封面使用完整显示方式，比例不同允许留卡片同色空白，不要裁切关键内容；日期/分类胶囊已调整。
- 手动通知的正文图片此前已修复，并有加载占位/转圈。不要退回只支持封面、不渲染正文图片的旧逻辑。
- 文章与手动通知完全分离：文章表 articles，通知表 notifications。管理通知不能删除或改写文章。
- tabs/notifications.tsx 是“文章”页；tabs/announcements.tsx 是“动态与通知”。名称容易误会，修改前先看实际查询。
- WordPress 桥接资料优先读 integrations/wordpress/README.md 和 DEPLOY.md。同步函数保留 wechat-sync 等历史名称，不代表 App 仍直接展示微信来源。
- 原微信同步插件在旧电脑 G:/fp/PARTTIME/WP/wechat-auto-sync-1.0.4/wechat-auto-sync，不在本仓库根目录，若要继续改它需另行迁移。

### 网络与其他功能

- 公共网络请求使用 20 秒截止时间，涵盖连接和响应体读取。network.ts 的 arrayBuffer + UTF-8 TextDecoder 兼容措施和四语 networkMessages.ts 需保留，不能简单恢复为旧 response.json/text 路径。
- 国内联网故障经过兼容修复后，用户曾通过 Expo Go 确认不开 VPN 也能进入。不要把所有以后出现的 403 或空数据都归为国内网络问题；要分服务看日志和响应。
- 历史会话还处理过反馈多附件、后台历史记录清理、旧搜索请求覆盖新结果、缓存统计、更新提示等；本次未再次逐项真机验证，也没有重新实现。

### iOS 构建和四语元数据

- 上次推送 1.1.5 的最后提交为 6cd7628，包含简繁英意的系统元数据本地化。
- app.json 已有 CFBundleLocalizations（zh-Hans、zh-Hant、en、it）、CFBundleAllowMixedLocalizations:true，以及 Expo 根节点 locales，指向 student-app/locales/ 下四个 JSON。
- 本地化 App 名称及权限文案需要新原生包，不是普通 JS OTA 或 Expo Go 就能完整验证。
- 保留 plugins/withIosPodDeploymentTarget.js，修正 Pods/资源包的旧最低 iOS 版本；当前最低 16.4。
- production iOS 构建镜像在 eas.json 固定为 macos-tahoe-26.5-xcode-26.6。旧失败日志曾出现更新工具链不接受 Pods 的 12.0/12.4/13.4，不能删除现有修复后又盲目归咎业务代码。

## 8. 验证进度与限制

本次业务改动完成后：

- 完整客户端测试 117 项通过、0 失败。
- stationSearch.ts、viaggiaTrenoService.ts、train/index.tsx 的 TypeScript 依赖检查 0 diagnostics。
- 此前已检查 service、station-board、train-status 的类型与语法，并验证真实 Italo/Tper 接口样本。
- 已验证多个城市排序、中文城市、具体小站、完整匹配、官方回退排序一致、不修改原目录。
- git diff --check 已通过；版本及交接文档写入后还会做提交前复核。
- 此次新增回退和排序尚无用户真机验收；未在本地生成新的 IPA/AAB，测试通过不等于已上架。
- 旧电脑测试日志位于被忽略的 .tmp/train-review/，不随 Git 克隆；无需依赖日志文件才能重跑测试。

常用命令（在新电脑用实际可用的 node/npm，以下从仓库根目录执行）：

~~~powershell
cd student-app
npm ci --legacy-peer-deps
cd ..
node --test student-app/tests/*.test.cjs
git diff --check
~~~

## 9. 发布与继续调试

- 本次仅按用户要求提交并 push main，不自动启动构建、创建版本标签或提交商店。
- 根目录 .github/workflows/正式发布.yml：EAS iOS/Android；正式发布安卓.yml：GitHub Android 构建。
- 两个正式发布工作流目前都支持 version 输入：填写 1.1.6 就用该版本；留空会从仓库版本递增为下一版本，并非原样沿用。因此如果要给两平台构建同一个版本，明确填写相同版本。
- EAS production 使用远程 buildNumber/versionCode 自动递增，与展示版本号是不同概念。runtimeVersion 使用 appVersion，OTA 必须考虑版本兼容。
- 新电脑需要重新确认 Expo CLI 登录；旧用户名 smxlrs（Expo 项目所有者同名）。GitHub/Supabase 也可能要重新授权，不要复制或公开旧验证码、会话或访问令牌。
- Expo Go 曾遇到 failed to download remote update / 超时：手机可打开 /status 只说明 Metro 状态端点通，不保证 bundle 下载成功。分别检查 CLI 登录、手机与电脑连通性、防火墙、LAN/隧道和最终 bundle 日志。旧局域网 IP 192.168.101.105 只适用于旧网络。
- 旧电脑 GitHub 直连曾不稳定，最近可用的本地代理是 http://127.0.0.1:33893。新电脑不能直接照搬该端口；先检查自己的网络与代理。
- 若遇 safe.directory，核实仓库位置后按实际路径设置；不要机械复制旧电脑的安全目录设置。

## 10. 换电脑时 Git 之外需要注意的文件

- 本次不会提交无关的未跟踪 promo_posters/。如果用户需要这些海报，须另行复制该文件夹。
- student-app/.env 和其他被 Git 忽略的本地配置、资料、构建产物不会自动跟随克隆；需要时通过安全方式迁移或从用户已有配置重建。不要把私密配置写进本文或提交仓库。
- 环境目录、node_modules、缓存、临时日志不应作为新电脑必须复制的代码；依赖优先按 lockfile 安装。
- 外部 WordPress 插件目录和其他位于仓库外的素材需要单独备份。
- 继续工作前先检查仓库是否已有本次之后的新提交，不要恢复旧备份覆盖最新 main。

## 11. 后续更新本文的约定

每完成一个重要任务或准备再次迁移时，更新日期、当前版本、完成/未完成事项、测试证据及真实阻碍。不要把“代码已修复”“测试已通过”“已 push”“已构建”“已部署”“已上架”混为同一个状态。
