# 参考源码技术学习：方寸棋阁 → 驭棋沙盘

> **用户决策（2026-10-18）**：**只采纳第 8 节的 `.vscode/mcp.json`（设备自动化）**；其余条目（`<stack>` 重构、圆屏 `circle` 适配、interconnect 分片传输、存档迁移、离线授权）**本轮一律不采纳**，仅作记录归档。第三节「圆屏缺口」与第 8 节已按此标注。
>
> 注：`.vscode/mcp.json` 在我这边**写入被拒**（该路径对模型只读，是 MCP 权限配置的保护策略），故配置内容以第 8 节的 JSON 代码块形式留在本文件里，请自行复制到 `.vscode/mcp.json`。

> 对应需求：「根据这一个非常成熟的方寸棋格 vela 快应用项目来优化我们的项目……我们不抄袭，做原创」。
> 本文是这项需求的**技术学习交付物**（此前只做了图片化落地，未交付学习结论）。
> 参考源码位置：`D:\andlua\_decproj`（项目名「方寸棋阁」，包名 `com.ydnac.chess`）。
> 约定：每条结论都标注**证据**（文件路径 + 数值/代码片段）。凡我没有实测或没有读到实现的地方，一律写「未验证 / 读不到」，不做推测。

---

## 0. 一个必须先说清的前提：参考项目是「编译产物」，不是原始源码

这决定了我们能学什么、不能学什么：

- 它的 `.ux` 里 `<script>` 段是**编译后的代码**：变量被重命名为 `v0/v1/arg0`，函数体被展平成顺序赋值。例：
  `D:\andlua\_decproj\src\common\wzqEngine.js:3` → `exports.createGomokuAI = function (arg0) { var v0_1, v1_1, … v69_1; … }`（69 个局部变量，无任何可读函数名）。
- `D:\andlua\_decproj\strings\` 下的 32 个 JSON **不是多语言文案**，而是 **`.jsc` 字节码的 atom（字符串常量）转储**。例：`strings\index__index.json` 开头即
  `{"file":"pages/index/index.jsc","module":"@aiot/index","size":5660,"atomCount":146,"funcCount":37,"eofExact":true,"atoms":[…]}`，
  atoms 里能看到 `"212px"`、`"520px"`、`"absolute"`、`"bg"`。

**结论**：能学的是**架构、协议、数值、组件的用法**；学不到作者的原始写法与算法细节。
「不抄袭」在这里是天然成立的 —— 逐行抄也无从抄起，我们只能吸收设计思路并用**自己的实现**重做。

---

## 1. 页面根容器与层叠方式（最有启发的差异）

| | 方寸棋阁 | 驭棋沙盘（我们） |
|---|---|---|
| 页面根 | `D:\andlua\_decproj\src\pages\more\more.ux:2` → `<stack class="page">`（实测 11 个页面用 `<stack class="page">` 作根：about / more / recom / help / fxqconf / gjxqconf / xqconf / jqconf / dsqconf / wzqconf / wqconf） | 普通 `div.page`（`flex-direction: column`） |
| 整页背景图 | `<image class="bg">` 作为 `<stack>` 的子项，**与内容按文档顺序层叠** | `<image class="bgtex" style="position:absolute">` + 内容加 `position: relative` 兜底 |

`<stack>` 的官方定义（技能库 `components/container/container_stack.md`）：
「子组件排列方式为层叠排列，每个直接子组件按照先后顺序依次堆叠，覆盖前一个子组件。」

**为什么值得学**：用 `<stack>` 当页面根，**背景在前、内容在后即天然分层**，不需要绝对定位、也不存在「绝对定位元素为什么画到静态内容上面」的疑问。
我们当前是「flex column + 绝对定位背景」，所以上一轮我不得不给 9 个页面的内容块补 `position: relative` 来做层叠保险 —— 那是绕路。

**采纳状态**：**待评估**。改用 `<stack>` 根会动到 9 个页面的布局基线（内容块原本靠 `flex: 1` 撑高），需要真机验证后再动；本轮不改（用户已明确「不用改了」）。

---

## 2. 工程与构建配置

证据：`D:\andlua\_decproj\package.json`（全文 60 字节）

```json
{ "devDependencies": { "aiot-toolkit": "^2.0.5" } }
```

- **没有 npm scripts**：构建/运行全靠 IDE（AIoT-IDE）。
- 我们：`package.json` 里固化了 `build` / `test` / `release:jsc` 等脚本，**规则层可 `node` 直跑**（13 个测试文件）。这一项我们更强，继续保持。

`manifest.json` 对比（证据：`D:\andlua\_decproj\src\manifest.json`）：

| 字段 | 方寸棋阁 | 驭棋沙盘 |
|---|---|---|
| `designWidth` | `"device-width"` | `192`（数值画布） |
| `features` | router / prompt / device / storage / vibrator / brightness / **interconnect** | router / storage / vibrator / device / app / brightness |
| `permissions` | `hapjs.permission.DEVICE_INFO` | 无 |
| `minAPILevel` | `1` | 未设置（用 `minPlatformVersion: 1100`） |
| `logLevel` | `"error"` | `"log"` |

- `designWidth: "device-width"` 意味着**设计尺寸≈设备物理宽度，不做整体缩放**，所以对局页可以写死像素（见第 3 节）。
- 我们走的是「192 设计画布 + 按屏宽换算 + `uiScale` 收敛」，**天然适配更宽/更窄的屏**。

**可借鉴**：`DEVICE_INFO` 权限 + `interconnect` 能力（第 5 节要用来做联机/存档迁移）；`logLevel: "error"`（发布包少打日志）。

---

## 3. 多屏适配：它其实**用了**媒体查询，只是用得很少

- 有 `@media` 的证据：`D:\andlua\_decproj\src\pages\more\active\active.ux:133` `@media screen and (shape:circle)`；同文件 `:144` `@media screen and (shape:pill-shaped)`。
- **没有** `@media` 的页面：对局页（如 `xqai.ux`）——它们靠「`device-width` 画布 + 写死像素」适配。

**两条可学的点**：
1. **它处理了圆屏（`shape: circle`），我们没有。**
   我们的 `utils/screen.js` 把屏型归为 `rect` / `pill-small` / `pill` 三档（`shape === 'rect' ? 'rect' : (sw < 100 ? 'pill-small' : 'pill')`），CSS 媒体查询只用 `(shape: pill-shaped)` 与 `(shape: rect)`。
   后果：**466×466 圆屏手表（小米手表系列）会落到 pill 分支**，圆形边缘的控件可能被切。**建议后续补 `(shape: circle)`**（优先级：中，取决于你是否上圆表）。
2. 对局页这种「全屏棋盘」场景，写死像素 + 设备画布也是一种务实选择（省掉缩放换算）；我们用 192 画布 + `uiScale` 换来了通用性，代价是每次都要处理「内联字号 CSS 覆盖不到」的问题（如 `syncFonts()`）。两种路线没有绝对优劣。

---

## 4. 导航分层与「续局」机制

**分层**（证据：`manifest.json` 的 router 表 + `pages/index/gindex/gindex.ux`）：
```
pages/index（棋种总览）
  └─ → pages/index/gindex        （二级菜单：按 gameType 分流「人机/双人/娱乐/规则」）
        └─ → pages/games/<game>conf   （模式与规则选择页）
              └─ → pages/games/<game>conf/<game><mode>   （具体对局页：ai / rr / yl / zh / aq…）
```
- 路由参数用 `protected: { gameType: "wzq" }` 声明（`gindex.ux` 里 `exports.default = { protected: { gameType: "wzq" }, … }`），页面 `onInit` 只 `void (this.gameType)` 即可，参数由框架注入。
- 我们：`index` 卡片直接进 `pages/game`，模式/尺寸在**页内开局面板**里选。
  他们多一层、我们少两次点击。**取舍**：多一层更清晰、可深链、模式页能塞规则说明；页内面板路径更短。**本轮不改为多一层**（我们已定案：棋种卡片直达）。

**续局**（证据 `gindex.ux` 的 `storage.get({ key: … })` 调用 + `onSaveContinue`）：
- 每个「棋种+模式」一个存档 key：`wzqai` / `wzqrr` / `wzqyl` / `xqai` / `xqrr` / `jqai` / `jqaq` / `jqaqai` / `jqrr` / `dsqai` / `dsqrr` / `gjxqai` / `gjxqrr` / `wqai` / `wqrr` / `fxqzh` —— 规律是 **`<棋种><模式>`**。
- 进入前 `get` 一次：**成功 → 直接进对局页**（继续上局）；**fail → 带 mode 参数进对局页**（新局）。界面上还有「有未完成的棋局，是否继续？」三选弹窗（是 / 否 / 返回）。
- 我们：`chess_save_monopoly` / `chess_save_aeroplane` 等，进入页面后由**页内「继续上局 / 开始新局」面板**询问（大富翁/飞行棋），棋类页是开局面板的「继续上局」。

**可借鉴**：他们的 key 命名把「棋种+模式」编进同一串，`get` 一次就能分流；我们的 key 前缀 + 分页面板逻辑类似，**已基本等价，不必重做**。

---

## 5. 设备间通信与存档迁移（我们完全缺的能力）

### 5.1 分片传输协议 —— `common/interconnectSend.js`

这是一份**写得很扎实**的实现，值得逐点学（以下均为源码里可读到的常量/结构）：

| 机制 | 取值 / 做法 | 出处 |
|---|---|---|
| 单片上限 | `MAX_CHUNK_BYTES: 2500`（**按 UTF-8 字节**切，不是按字符：`charCodeAt` 落在 ≤127 / ≤2047 / ≤65535 / 其它 → 1/2/3/4 字节） | `interconnectSend.js:69,84,171` |
| 单片消息 | `{t:"s", i:消息id, d:[载荷]}` | `:24` |
| 分片消息 | `{t:"m", i:消息id, s:片序号, n:总片数, d:[片内容]}` | `:24` |
| 消息 id | `Date.now().toString(36) + "_" + 自增序号` | `:66` |
| 发送超时 | 3 s（`setTimeout(…3000)`，超时回调 `"TIMEOUT"`） | `:43-49` |
| 接收重组超时 | 4 s 未收齐即丢弃整条消息（`delete 码表[id]`） | `:150-153` |
| 去重 | 按片序号写入 `chunks[s]`，`receivedCount` 达 `n` 才拼装回调；重复片不重复计数 | `:154-165` |
| 解码 | `JSON.parse`，失败则回退把原始字符串交给回调 | `:114-121` |

**可学点**：①「字节精确切分」而不是字符数切分（中文 1 字 3 字节，按字符切会溢出）；②每条消息带 id + 片序号 + 总片数，接收侧聚合并超时清理；③超时双向兜底。

### 5.2 存档迁移 —— `common/saveTransfer.js`

```js
createSaveTransfer({ collectSaveData, applySaveData }) → {
  backupSaveToApp(saveKey, cb)   // → sendData(saveKey, JSON.stringify({ type: "save_data", data }))
  restoreSaveFromApp(payload, replyTo) // → applySaveData(...) 后回 { type: "restore_result", success }
}
```
即：**把本机棋局存档通过手机端中转做备份 / 恢复**（协议名与字段可直接读：`save_data`、`restore_result`）。

**采纳状态**：**待评估（有价值，但依赖 `interconnect` 与手机端 App 配合）**。
我们当前只有本机 `storage` 存档。若将来要做「换表续局 / 手机看棋谱」，这就是现成的协议参考。注意：这需要 `manifest` 增加 `system.interconnect` feature，且需手机端有对应处理。

---

## 6. 离线授权体系（技术含量最高的一块）

证据链：`app.ux` → `common/activation.js` → `common/activationKeys.js` + `common/rsaSha.js` → `pages/more/active/active.ux`。

### 6.1 全局态（`D:\andlua\_decproj\src\app.ux`）

```js
exports.default = { data: { moduleStatus: [0,0,0,0,0,0,0], actError: true, conn: null },
  onCreate() { this.data.conn = interconnect.instance()
    initDeviceCode(code => checkActivationSampled(code, () => { this.data.actError = false }))
    brightness.setKeepScreenOn({ keepScreenOn: true }) } }
```
- **7 个模块位**（`moduleStatus[0..6]`，下标与各棋种一一对应）+ 一个总错误位 `actError`。
- 启动时异步做一次**采样校验**，通过则把 `actError` 置 false。
- 页面侧据此拦截（证据 `gindex.ux` 的 `actErrorBlocked()`）：
  - `actError` 为真 → `prompt.showToast({ message: "激活数据读取失败，请重启应用" })`；
  - `moduleStatus[n] !== 1` → `router.push({ uri: "pages/more/active" })`（去激活页），否则才进对局。

### 6.2 设备码（`activation.js`）

- 读本机码：`storage.get({ key: "d_c" })`，必须匹配 `/^\d{8}$/`（8 位数字），否则视为无码。
- 生成码：先试 `device.getDeviceId()`，把返回字符串逐字符取 `charCodeAt(i) % 10`、最多取 8 位拼成 8 位码；**取不到则本地随机生成**（首字符固定 `"9"`，其后 7 位 `Math.floor(10*Math.random())`），并写回 `storage["d_c"]`。
- 其他导出：`readCodeTable` / `upsertCode` / `writeDecoy`（诱饵写入，典型的反破解手法）。

### 6.3 验签（`rsaSha.js` + `activationKeys.js`）

- `rsaSha.js` 导出 `sha256` 与 `verifyActivation(code, ?, N, E, BarrettMu, BarrettK)` —— 这是**纯 JS 的 RSA 验签 + Barrett 模乘**实现（自带大数模乘加速）。
- `activationKeys.js` 内置 `masterPublicKeyN/E/BarrettMu/BarrettK`，以及**按下标分模块**的 `modulePublicKeysN/E[...]`、`moduleBarrettMus/Ks[...]`。
- `activation.js:137-147` 的调用形态：先用 `masterPublicKey*` 试，再用 `modulePublicKeys*[模块下标]` 试 —— **主授权 + 分模块授权两级**。

**结论**：**完全离线**（无 `fetch` / `request`，全文件没有网络调用），密钥内置，靠 RSA 验签 + 设备码绑定。降级路径是「提示重启 + 引导到激活页」，不崩不白屏。

**采纳状态**：**不采纳**（本轮及可见规划内不需要）。
理由：① 我们是免费自用的小工具，引入授权只会增加复杂度与故障点；② 内置公钥 + 混淆验签会显著增加包体与维护成本；③ 若将来要防拷贝，可参考「设备码 + 离线验签 + 分模块授权 + 全局 moduleStatus 位」这套结构 —— 结构本身设计得很克制，值得记住。

---

## 7. AI 与引擎资产：**学不到算法，但学到了「我们做对了分层」**

- `common/wzqEngine.js` 约 59 KB，编译产物，入口 `exports.createGomokuAI`；`createGomokuAI` 内 69 个局部变量、函数名全部丢失 → **搜索深度、评估表、剪枝/置换表都读不出来**（我不做推测）。
- `pages/games/xqconf/xqai/xqai.ux` 总体 **2,303,565 字符**，分区实测：
  `template` 约 5.9 KB、`style` 约 4.6 KB、`script` 约 **2,293 KB（99.5%）** —— 巨型页面几乎全是内嵌脚本（大概率是内嵌引擎/棋谱数据）。
  同类还有 `wzqai.ux` 84 KB、`gjxqai.ux` 157 KB、`jqai.ux` 70 KB。

**对照我们**：
- 我们把**规则层做成纯函数模块**（`src/rules/*.js`，node 直接可跑）、**渲染层只认「几何 + 棋子列表」**（`core/geometry.js` / `core/board-renderer.js`）、**AI 只做一个通用 negamax**（`core/ai.js`）。
- 结果：**13 个测试文件、240+ 断言可以在 node 里跑**，而参考项目这种「逻辑全压进页面脚本」的形态基本无法单测。
- **结论：架构分层上我们是对的，这一点不要被"人家功能多"带偏。** 参考项目的巨型页面是它的**债务**，不是我们的目标。

---

## 8. 本次最实用的一条：它的 `.vscode/mcp.json` 把「真机/模拟器自动化」接给了 AI

证据：`D:\andlua\_decproj\.vscode\mcp.json`（972 字节）

```json
{ "mcpServers": { "velajs": { "command": "npx", "args": ["-y", "velajs-mcp"],
  "autoApprove": ["list_devices","select_devices","get_debug_status","start_debug_cli","start_debug_ide",
    "stop_debug","take_screenshot","list_emulators","get_snapshot","get_element","get_console_logs",
    "execute_script","get_network_requests","tap","scroll","swipe","long_press","send_key","input_text",
    "get_storage","get_project_info","build_project","get_build_settings","get_output_logs",
    "get_emulator_logs","get_device_log","navigate"] } } }
```

**这正好击中我们这次会话最大的痛点**：我全程没有可驱动的模拟器/真机，所有 UI 改动都只能靠推理 + 事后由你上机验证（本轮「图片太大 / 滚出大片留白」就是因此没能提前发现）。

**可借鉴价值：高。建议做法**：在我们的项目里也放一份 `.vscode/mcp.json`，接同一个 `velajs-mcp`，于是就能 `take_screenshot` 看真实渲染、`get_element` 查控件实际尺寸、`tap/swipe` 复现交互、`get_console_logs` 看报错。

**状态：待验证**（我尚未运行过该 MCP，只读到配置；它需要设备或模拟器可用，且 `npx vela-mcp` 属于三方包）。**这条要不要做、什么时候做，请你定** —— 我不擅自加第三方依赖。

---

## 9. 一页对照表：学到了什么 / 已吸收 / 待评估 / 不采纳

| # | 技术点 | 参考项目做法（证据） | 我们的现状 | 结论 |
|---|---|---|---|---|
| 1 | 页面层叠 | `<stack class="page">` 作根，背景与内容按文档顺序分层（`more.ux:2` 等 11 个页面） | flex column + 绝对定位背景 + `position: relative` 兜底 | **待评估**（改动大，需真机验证） |
| 2 | 图片素材 | 背景位图 + 图标位图（已吸收为「AI 原创素材」） | 12 个原创位图，`<image>` 组件 | **已吸收**（本轮完成） |
| 3 | 不支持的样式规避 | 用 `<stack>`+显式尺寸，而非 `background-image` | 已确认 `background-image` 在手环 9/S3/Redmi Watch 4 不支持并规避 | **已吸收** |
| 4 | 多屏：圆屏 | `@media screen and (shape:circle)`（`active.ux:133`） | 只有 `pill-shaped` / `rect` | **待评估（建议补 circle）** |
| 5 | 多屏：胶囊屏 | `@media screen and (shape:pill-shaped)`（`active.ux:144`） | 已用 `pill-shaped`，且 tab 栏改单列两行 | **已吸收（且更细）** |
| 6 | 设备间分片传输 | `MAX_CHUNK_BYTES 2500`、UTF-8 字节切分、id=`Date.now(36)+序号`、发送 3s / 重组 4s 超时、按片去重 | 无 | **待评估**（做联机/迁移时直接照这套结构重写） |
| 7 | 存档迁移到手机 | `save_data` / `restore_result` 协议（`saveTransfer.js`） | 仅本机 `storage` 存档 | **待评估** |
| 8 | 存档 key 命名 | `<棋种><模式>`，一次 `get` 分流续局（`gindex.ux` 17 处） | `chess_save_<游戏>` + 页内续局面板 | **已基本等价** |
| 9 | 二级模式菜单 | `index → gindex → *conf → 对局页` | 卡片直达 + 页内开局面板 | **不采纳**（我们少两次点击，已定案） |
| 10 | 离线授权 | 8 位设备码 + 内置 RSA 公钥 + Barrett 模乘验签 + 7 模块位 + 诱导写入 | 无 | **不采纳**（免费工具，收益不抵复杂度；结构记档备用） |
| 11 | 引擎/逻辑组织 | 逻辑压进页面脚本（`xqai.ux` 99.5% 是 script，2.29 MB） | 纯函数规则层 + 渲染层解耦 + 13 个 node 测试 | **反向教材：坚持我们的分层** |
| 12 | AI 可测设备 | `.vscode/mcp.json` 接 `velajs-mcp`（截图/tap/元素查询/日志） | 无，只能靠人工上机 | **待评估（高价值，需你点头）** |
| 13 | 工程脚本化 | `package.json` 只有 1 个依赖、无 scripts，全靠 IDE | `build` / `test` / `release:jsc` 脚本化 | **我们更优，保持** |

---

## 10. 附：本轮改造的「方案」（回应「接下来方案都由你写」）

这一节是上一轮应当交付、但当时只在 `TODO.md` 里记了流水账的那份**方案**。

**目标**：在不动规则层的前提下，把「看起来像半成品」的纯色 UI 提升一档，并拿到可复用的素材资产。

**约束（先定死，再动手）**
1. 不引入网络依赖、不引入第三方运行时包；素材必须本地。
2. 主题体系（MD3 三配色 × 深浅）与既有对比度标准不得回退。
3. 所有新照片式素材必须是**原创**（AI 生成 + 本地精修），不得取自参考项目。
4. 平台能力以官方文档为准：不确定的样式一律先查「支持明细」再用。

**决策与理由**

| 决策 | 理由 |
|---|---|
| 用 `<image>` 组件，不用 `background-image` | 官方「支持明细」标注手环 9/9 Pro、Watch S3、Redmi Watch 4 **不支持** `background-image` |
| 素材走「AI 生成 → PIL 裁切去水印 → Lanczos 缩放 → 圆角遮罩」 | 生成图带系统水印与外圈渐变，必须裁到徽标本体才能填满显示框；平滑大图转 JPEG 把 84 KB 压到 12 KB |
| 棋种图标改成位图徽标（替换 CSS 字形/圆环/四点） | 旧方案依赖设备字体（缺字机型显示豆腐块），且自绘图标辨识度低 |
| 整页背景改用「近同色底 + 极淡棋类线稿」，并**显式绑定尺寸** | 纯色页面缺质感；但百分比尺寸不可靠，必须绑设计像素 |
| 素材分两类：**页面外**（背景位图）与**滚动容器内**（一律不放位图） | 实测：`<scroll>` 内的绝对定位位图会被撑满整块舞台（本轮已回退） |

**交付物**：`src/common/img/` 12 个原创位图（棋种徽标 9 + 品牌徽标 1 + 背景深浅 2，约 180 KB）；9 个页面接入；`README.md` / `TODO.md` 同步；调试包 + JSC 正式包 + 无 JSC 后备包。

**未达成/回退项（如实记录）**：棋盘与环体的「纸纹」质感方案**已作废**（滚动容器内位图有害）；圆屏（`shape: circle`）适配未做（见第 3 节）。

---

## 11. 可核实路径清单

| 结论 | 去哪里核 |
|---|---|
| `<stack>` 作页面根 | `D:\andlua\_decproj\src\pages\more\more.ux:2`、`...\games\xqconf\xqconf.ux:2` 等 |
| `@media (shape:circle)` / `(shape:pill-shaped)` | `D:\andlua\_decproj\src\pages\more\active\active.ux:133,144` |
| 分片传输常量 | `D:\andlua\_decproj\src\common\interconnectSend.js:66,69,84,171` |
| 存档迁移协议 | `D:\andlua\_decproj\src\common\saveTransfer.js:10,28` |
| 全局态 moduleStatus / actError | `D:\andlua\_decproj\src\app.ux:16`；拦截逻辑 `...\pages\index\gindex\gindex.ux:257-263` |
| 设备码 `d_c` 与随机生成 | `D:\andlua\_decproj\src\common\activation.js:11,21-41,43-77` |
| RSA 验签与分模块公钥 | `D:\andlua\_decproj\src\common\rsaSha.js:198`、`activationKeys.js`、`activation.js:137-147` |
| 存档 key 命名 | `D:\andlua\_decproj\src\pages\index\gindex\gindex.ux:268-482` |
| 巨页体积构成 | `xqai.ux`：总 2,303,565 字符；template≈5.9 KB / style≈4.6 KB / script≈2,293 KB |
| `strings/` 是字节码 atom 转储 | `D:\andlua\_decproj\strings\index__index.json:1-8` |
| 设备自动化 MCP 配置 | `D:\andlua\_decproj\.vscode\mcp.json` |
