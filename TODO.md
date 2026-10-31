# TODO.md — 驭棋沙盘 未完成项与已知问题

> 本文件只记录「未做 / 已知问题 / 后续规划」，每项附原因与优先级。代码内不写空话。

## 已知问题

- **`<style src="./x.css">` 会被 aiot-toolkit 2.0.5 静默忽略（已修复，留档防回归）**（P0，已解决）
  现象：构建成功但外部 CSS 整包不进 RPK，所有 class 空壳，页面回落默认
  `flex-direction: row`（官方文档默认值，速查手册误标为 column），整个 UI 横竖排列全错。
  修复：三页面统一改为 `<style> @import './x.css'; </style>`，已拆包核对
  flexDirection / absolute 均已进 bundle。若升级工具链可再试回 `<style src>`。
- **scroll 子元素默认横向排列、纵向滚动默认关闭（已修复，留档防回归）**（P0，已解决）
  现象：主界面只显示第一张卡片。原因：`<scroll>` 的子元素布局沿用默认
  `flex-direction: row`（官方示例中 scroll 也显式设了 column），且 `scroll-y`
  默认 false。修复：两处 scroll 显式加 `scroll-y="true"` + CSS `flex-direction: column`。
- **底部按钮位于曲面过渡区边缘**（P1 → 已随全屏棋盘改版消失）
  原因：跑道屏上下各约 15%（约 73 设计像素）为曲面收窄区，但 spec 第 6 节又要求
  对局页底部放三按钮一行。二者冲突时按 spec 页面结构执行，把 padding-bottom 提到
  20px 缓解。**后续改版已取消对局页底部按钮行**（棋盘全屏 + 控件收进侧滑抽屉），
  该冲突不复存在；现存误触来源是「拖动被侧滑返回抢走」，已按下方阶段自检修复。
- **touch 坐标换算依赖 device.getInfo（已解决，留档）**（P2 → 已解决）
  原因：clientX/Y 单位制官方未规定（general_events 只说「距可见区域左边沿」），
  旧实现把 clientX 乘 designK = 192/屏宽dp —— 该换算成立与否取决于
  `device.getInfo().screenWidth` 与触摸事件是否同单位制，真机四机型反馈「落子位置
  与手点位置不符」。
  修复：改用官方 getBoundingClientRect（同为「相对视窗」坐标）实测视口宽度反推
  clientK = 192/实测宽；API 不可用时回退 designK。同时去掉落指即搬棋盘的行为。
  **（10-17 第 4 轮起落子改走 click 事件的 offsetX/offsetY + 实测系数，自定义触摸整条删除，
  详见顶部「原生滚动＝摄像机」阶段自检。）**

## 后续规划

- **双人对战在线/蓝牙联机**（P3）
  本期双人模式为同屏轮流（跑道屏对面传递手环）。若要远程联机需 interconnect
  通道（手机端中转），交互与断线处理复杂度高，暂缓。
- **五子棋禁手规则可选**（P3）
  当前为自由规则（长连也算胜）。黑棋优势大时可加三三/四四/长连禁手开关。
- **扩展矩形屏适配（9 Pro / REDMI Watch 等）**（P1）
  本期只适配跑道屏（spec 3.2）。geometry/renderer 已与页面解耦，主要工作在页面
  CSS 媒体查询与 vpW/vpH 计算，规则层零改动。
- **开放国际象棋 / 围棋 / 中国象棋**（P2）
  置灰卡片已占位。阻塞点：8×8 以上棋盘在 96dp 宽度下需「局部视图 + 迷你地图」，
  象棋还需汉字棋子（内联 SVG <text> 方案已在 spec 允许范围内，未实现）。
- **AI 强度分档细化**（P3）
  当前 hard=3 层 + 500ms 预算 + 600~1600ms 思考延迟。若真机性能富余，可给
  9 路五子棋 hard 升 4 层（迭代加深已保证超时安全）。
- **对局记录展示**（P3）
  records 已落盘（上限 200 条，含模式，战绩大厅已展示），spec 主界面禁止显示次要信息，故暂无
  展示入口，仅支持清空。（v1.3.0 战绩大厅已实现展示，此条完成）。

## 阶段自检（循环修 bug 第 4 轮：三页改为「原生滚动＝摄像机」；主版本保持 1.0.0，迭代以日期区分）

- 玩家定案（第 3 轮后连续三次纠正）：「**你有一个摄像机在拍视频，就移动摄像机**」——
  棋盘/环体是固定的大场景（画布），屏幕是摄像机，拖动＝移动摄像机看场景；
  **摄像机被限制在场景内**：棋盘永不被拖出屏幕、不出现空白；内容小于视口时居中固定、拖不动。
  并明确否决上一版：不要一轮轮调触摸参数。
- 结论：**自定义平移整条链路（含死区、换算、返回手势抑制）全部删除**，改由框架原生
  `<scroll>` 承载。理由：原生滚动天然等于「移动摄像机 + 边界钳制 + 点/拖区分」，
  且与系统侧滑返回的优先级由框架自己协调（旧版手柄式自绘触摸，框架分不清它是手势，
  才需要 BACK_GUARD 之类的补丁）。
- 三页统一改法：
  1. 模板：`<div class="board|vp">` → `<scroll scroll-x scroll-y bounces="false">`；
     内层新增 `.stage`（场景包围盒，尺寸 = max(视口, 棋盘)，内联绑定 `stageW/stageH`），
     棋盘/环体 `.board-wrap` 由绝对定位改为**在 stage 内 flex 居中**的普通元素。
  2. 尺寸：`stageW = max(192, 棋盘宽)`、`stageH = max(页面设计高, 棋盘高)`。整盘小于视口时
     内容不超出视口 → 原生 scroll 拖不动（对应「飞行棋/大富翁固定 UI」）；放大超出后可滚动看局部。
  3. 删除：`onTouchStart/Move/End`、`pt()`、`clampX/clampY`、`clampWrapX/clampWrapY`、
     `measureTouch/scheduleMeasure`（骰子页）、`pan/touch` 状态、`TAP_SLOP/BACK_GUARD/
     TOUCH_HOLD_MAX` 常量、`clientK/clientX0/clientY0/lastPanTs`、`boardX/boardY/wrapX/wrapY`
     绑定，以及骰子页的 **TMP 诊断读数**（拖动问题已无意义）。
  4. `onBackPress` 回归最简：棋类页 playing/thinking/over → 呼出抽屉并 return true；
     骰子页除 resume/matching/over（放行）外一律呼出抽屉。不再有任何拖动抑制。
  5. 骰子页骰子位置由「视口中心」改为「场景（环体）中心」——骰子属于场景，随场景一起滚动；
     缩放后调用 `centerScene()`（`scrollTo` 到场景中心），避免只看到环体一角（旧版不重定位）。
- 棋类页落子（关键）：改用铺满棋盘的透明热区 `.tap-layer` 的 `@click`，取官方
  `MouseEvent.offsetX/offsetY` —— 文档定义「距离**事件触发对象**左边沿的距离」，
  而热区左边沿就是棋盘左边沿，故它**直接就是棋盘内坐标**，且与滚动位置无关
  （相对元素本身），因而**不需要知道滚动量**（`scroll` 事件给的 scrollX/Y 单位制官方未规定，
  刻意避开）。单位仍不假设：`kx = 192/视口实测宽`、`ky = 视口设计高/视口实测高`
  （getBoundingClientRect 实测，沿用既有结论）；取不到 rect 时回退 `designK = 192/屏宽dp`。
  另保留一条兜底：`offsetX` 缺失时用 `clientX/Y − 棋盘实测 rect 原点` 反推（rect 随滚动位移，
  同样不需要滚动量）。旧的 12px 死区、`TAP_MAX_MS` 随之作废（点/拖由框架区分）。
- 落子自动居中改走摄像机：`centerOn` → `$element('vp').scrollTo({left,top,behavior:'smooth'})`，
  负数与越界由 scrollTo 自行钳制；`layoutBoard` 改为对准棋盘中心。
- 审计脚本同步更新（`clampX/clampY` 断言已失效）：`check-features.py` 改为断言
  `scrollX/bounces/stageW/tap-layer/onBoardClick` 在包、且 `clampX/clampY/wrapX/wrapY`
  不在包；`check-all.py` 的 game 断言增补 `scrollX/bounces/stageW/tap-layer/onBoardClick/scrollTo`，
  monopoly/aeroplane 增补 `scrollX/bounces/stageW/centerScene`。
- 交付：`npm test`（13 文件 0 失败）、`npm run build`、5 个审计脚本全绿；
  双包 `release.1.0.0.rpk`（JSC，10 个 .jsc / 0 个 .js）+ `release.1.0.0-nojsc.rpk`
  （10 个 .js，拆包核对 `flexDirection` 全名在、无 `fD:/aI:` 短名）。
- **待实机验证**（本机无模拟器可驱动）：
  1. 拖动是否跟手、边界是否真的钳制（棋盘拖不出屏幕、不出现空白）；
  2. 整盘小于视口时是否居中且拖不动（骰子页默认档位）；
  3. 棋类页点击落子是否准（`offsetX/offsetY` 与实测换算是否对得上）；
  4. 放大后 `centerScene` 是否把环体/航道摆到视野中央；
  5. **横向滚动是否抢走系统「侧滑返回」**（原生 scroll 优先级为框架行为，无文档背书）——
     若抢走，则棋类页把 `scroll-x` 关掉、改用「横向以落子自动居中代替手动横向滚动」，
     或把横向滚动只在放大档位开启。

### 第 4 轮修补：棋盘不居中（实机反馈）

- 反馈：棋盘没居中——「下面留的空位与上面不一样，右边留的空位与左边不一样，滑动的区域也不一样」。
- 根因：我把棋盘在舞台内的居中交给了 `.stage` 的 flex 居中（`align-items/justify-content: center`）。
  但 **`<scroll>` 不保证传播子元素的 flex 居中**（与本文件顶部「scroll 子元素默认横向排列」同源问题）。
  已拆包核对：CSS 确实进包（stage 规则里 `alignItems/justifyContent: "center"` 都在），
  但实机表现为棋盘落在舞台左上角 → 舞台（= max(视口, 棋盘)）比棋盘大时，多出来的那块就露在
  棋盘下方/右侧，于是上下、左右留白都不等，而且摄像机还能滑进那块空白区。
- 修复：放弃 flex 居中，改回**脚本算好偏移 + 绝对定位**（与本次改版前实机验证过的写法一致，
  旧版棋盘用 left/top 定位从未出现不居中问题）：
  - `game.ux`：`boardX/boardY = round((stageW - boardW) / 2, (stageH - boardH) / 2)`，
    `syncStage()` 里算，绑到 `.board-wrap` 的 `left/top`；`padX()/padY()` 直接返回这两个偏移。
  - `monopoly.ux` / `aeroplane.ux`：同样 `ringX/ringY`，在 `buildBoard()` 末尾算并绑定。
  - 三页 CSS：`.stage` 只保留 `position: relative`（去掉 flex 居中声明）；
    `.board/.vp`（scroll 容器）补 `flex-direction: column` 作为保险。
- 顺带修初始摄像机时机：数据改动到渲染是异步的，`beginGame/restoreFrom` 里同步
  `scrollTo` 时 `<scroll>` 还没渲染 → 调用被 `try/catch` 静默丢掉，摄像机停在 0（横向也不居中）。
  改法：`scheduleMeasure()` 的 80ms 延迟里补一次 `layoutBoard()`；`scrollBoard(left, top, instant)`
  增参：初次进入/缩放对准用 `auto`（瞬间，避免进场时看到滑动），落子跟随仍用 `smooth`。
- 复核：`npm test` 13 文件 0 失败、`npm run build` 成功、5 个审计脚本全绿；
  双包重出（JSC 10 个 .jsc / nojsc 10 个 .js，`flexDirection` 全名在、无短名）。
- 待实机复验：①上下留白是否相等、②左右留白是否相等、③是否**还能**滑进棋盘外的空白区（应不能）、
  ④棋类页初始是否横向居中、⑤落子是否准。

### 第 4 轮修补二：仍不居中 → 定位到「舞台内的中间包裹盒不可靠」（实机截图取证）

- 反馈：用户上传真机截图 + 「上面区域留的空小」。
- 取证方法（无模拟器可驱动，故对截图做像素级分析，脚本置于系统临时目录、不进仓库）：
  - 截图 432×514 px；胶囊（`.status-cap` 高 24 设计像素）实测 54 px 高 → **2.25 px / 设计像素**；
  - 棋盘底板色（`boardBg` #44483F）实测 (66,73,57)、页面底色（`surface` #1B1C1A）实测 (24,28,24)
    → 两者可区分，故能单独量出底板范围；
  - **实测底板 = x 0..431（= 192 设计像素，满宽）× y 23..492（= 209 设计像素）**，
    而该局的棋盘真身只有 188×188（黑白棋 8×8、cell 21 = round(26 × uiS 0.8)）→ 底板被撑满了；
  - 网格线（8 列 × 8 行，1 格 = 47.5 px = 21 设计像素 ✓）起点实测落在场景原点 +9/+9 设计像素
    （正是渲染层的 pad），即**包裹盒的 left/top 也没生效**（应为 (2, 10.5)）。
- 根因：`.board-wrap`（舞台内的中间包裹盒）上的 `position:absolute` + 内联 `left/top/width/height`
  在运行时不可靠 —— 实测它被当作普通弹性子项撑满舞台并落在原点。对比之下，同为「绝对定位 +
  显式坐标」的网格线/棋子是准的，所以问题**只出在包裹盒自身**。
- 修复（扁平化）：三页删掉 `.board-wrap`，把底板/格子/棋子/骰子全部改为**舞台的直接子节点**，
  坐标显式带上居中偏移（`boardX/boardY`、`ringX/ringY`）：
  - `game.ux`：新增 `.board-bg`（底板，绝对定位、显式 left/top/width/height）；
    渲染层输出的 lines/stars/stones/pieces/markers 统一经 `shift(list, boardX, boardY)` 加偏移；
    落子热区 `.tap-layer` 改为铺满**整个舞台**，命中前先减 `(boardX, boardY)`（`handleTap`）。
  - `monopoly.ux` / `aeroplane.ux`：格子/棋子/骰子坐标在 `buildBoard()` 内直接 + `(ringX, ringY)`。
- 预期效果：底板 = 188×188 落在 (2, 10.5) → 上/下/左/右留白各 10.5 / 10 / 2 / 2 设计像素
  （对称）；棋盘大于视口时偏移为 0，靠摄像机滚动查看。
- 审计脚本同步更新：`check-features.py` 断言 `board-bg` 在包、`board-wrap` 不在包（三页），
  防止再退回「用包裹盒定位」这条已被证伪的路。
- 复核：`npm test` 13 文件 0 失败、`npm run build` 成功、5 个审计脚本全绿。
- **待实机复验**：①左右留白是否相等、②上下留白是否相等、③是否还能滑进空白区、④落子是否准。

### 第 4 轮修补三：第二张截图取证 → 改用「流式盒 + 外边距」（本机无法驱动模拟器）

- 反馈：用户再传一张截图 + 「下面跟右边留都很大，上面跟左边都没留什么」。
- 像素级复核（同法；PIL 量色带 / 包围盒；脚本只放系统临时目录）：
  - 底板色仍为 `boardBg`(#44483F)；**底板范围仍是 x 0..431 × y 23..492 = 满宽 192 × 209 设计像素**
    → 说明「扁平化」后 `board-bg` 这个绝对定位盒**依旧被撑满**（宽度/高度/left 都没生效）；
  - 网格（8 列 × 8 行、格 47.5 px = 21 设计像素）落在场景的**左上角 +9 设计像素**处
    → 与第 2 张截图相比横向还左移了约 16 设计像素，纵向不变；这张的「上面/左边没留白、
    下面/右边各留 ~30 设计像素」与用户描述完全吻合。
- 结论：该机型运行时对**绝对定位中间盒**的 `left/top/width/height` 不可靠（叶节点如线条/棋子正常，
  盒子不正常）→ 与「扁平化」无关，是盒子本身的问题。
- 修复（改用全站验证过的写法）：三页把棋盘/环体改回**普通流式子项**：
  - 显式 `width/height` + **外边距**定位（`margin-left:{{boardX}}px;margin-top:{{boardY}}px`）；
  - 底板底色直接给这个流式盒自身（不再需要额外底板元素）；
  - 内部线条/棋子仍是绝对定位，坐标即渲染层的棋盘内坐标（撤销上一版叠加的偏移）；
  - 依据（官方 general_style）：`align-items` 默认 `flex-start`（不会拉伸子项）、
    `position` 默认 `relative`（所有 div 天然是包含块）、`width/height/margin` 均为标准语义 ——
    「流式盒 + 外边距」正是本 App 全站（卡片/按钮/chip）一直可用、实机验证过的写法。
- **临时诊断**：三页左上角加了一行小字读数 `S{stageW}x{stageH} B{boardW}x{boardH} O{boardX},{boardY}`
  （`.diag`，确认后删除）。若仍不居中，这张截图能直接告诉我哪个数值在运行时不对。
- 复核：npm test 13/0、npm run build、5 个审计脚本全绿（`check-features.py` 改为断言三页
  `margin-left:`/`margin-top:` 在包、`board-wrap`/`board-bg` 不在包）。双包已重出。
- **待实机复验**：左右/上下留白是否相等；若仍有偏差，请把带读数的那张截图发我。

### 第 4 轮修补四：读数回传 → 模型算对了，剩下的是「摄像机没动」

- 用户回传带读数的截图。读出：**S209x228 B209x209 O0,10** → 场景 = max(视口 192×228, 棋盘 209×209)
  = 209×228 ✓、棋盘 209×209 ✓、居中偏移 (0,10) ✓ —— **脚本算的数值全部正确**。
- 同图像素复核：底板范围 x 0..431 × y 12..492（底边 = 10+209 = 219 设计像素 ✓，与
  `boardY + boardH` 完全吻合）；网格起点 = 渲染层坐标 + (0,10) ✓；网格在底板内的上下留白 9 / 10
  → **「流式盒 + 外边距」这次生效了**：底板正好等于棋盘盒子，上一版「盒子被撑满」的问题消失。
- 剩余问题只出现在**棋盘比屏幕宽**时（209 > 192，横向需居中）：网格实测仍在内容原点
  （即摄像机停在 0），说明 `scrollTo` 没把滚动位置移过去 → 横向左右留白差约 6 设计像素。
- 处理：`scheduleMeasure()` 里把「对准棋盘中心」改成**多次重试**（100 / 400 / 900 ms 各一次）；
  并给 `<scroll>` 挂 `@scroll`，把运行时回报的偏移显示进读数（新增 `V{camX},{camY}`）——
  下一次截图就能直接看出摄像机到底动没动（`scroll` 事件的单位官方未定义，故只看它是否非零）。
- 复核：npm test 13/0、npm run build、5 个审计脚本全绿；双包重出。

## 阶段自检（循环修 bug 第 3 轮：棋类页横向让给系统手势 + 骰子页临时读数；主版本保持 1.0.0，迭代以日期区分）

- 玩家澄清（第 2 轮后）：「飞行棋和大富翁固定，不再可以滑动了」+「剩下棋类游戏不是带动整个
  棋盘滑动，要不然触发不了手势」——即：**骰子页要能滑**、**棋类页别让棋盘吞掉系统手势**。
- 棋类页（game.ux）改动：
  1. **拖动只认纵向平移**，横向不再移动棋盘（横向位置由 `centerOn` 落子自动居中管理）
     —— 旧版纵横都拖棋盘，等于把横向系统手势吞掉，返回手势触发不了。
  2. **取消返回抑制**：既然横向拖动不再占用手势，横向滑动就是明确的返回意图，
     对局中一律呼出控制抽屉（`showMenu`）。这同时保证「手势一定触发 + 退出一定可达」。
  3. 清掉随之失效的 `BACK_GUARD` / `TOUCH_HOLD_MAX` 常量与 `lastPanTs` 状态。
- 骰子页（monopoly / aeroplane）：保留拖动手感修复（第 2 轮：抑制返回但不清标记、死区 12→4、
  `clientK` 合理性校验）；另**临时**在拖动结束时往播报栏打一行读数
  `TMP k… dk… raw… w…`，用于实机核对换算系数 —— 确认拖动/手势正常后立即删除（代码内已标 TEMP）。
- 校验：`npm run build` 通过；13 个测试文件 0 失败；5 个审计脚本全绿。
- 待真机复核：①骰子页拖动是否跟手（并念一下那行 TMP 读数）②棋类页横滑能否出抽屉、
  纵向拖动是否还能上下平移。

## 阶段自检（循环修 bug 第 2 轮：拖动被返回抑制掐断；主版本保持 1.0.0，迭代以日期区分）

- 现象（玩家真机）：**飞行棋 / 大富翁棋盘固定，拖不动**（上一轮修完后出现，属回归）。
- 根因：上一轮为治「退不出去」，在 `onBackPress` 里顺手清掉了 touch/pan 标记。
  而该机型**框架会把棋盘横向拖动也判成侧滑返回**（早先「滑动时容易误触返回抽屉」即同一现象）：
  拖动一起手就收到一次返回事件 → 标记被清 → 后续 `onTouchMove` 被 `if (!this.pan) return` 全部挡掉
  → 棋盘再也不跟手。两轮现象同源：**只治了「不卡死」，却把拖动掐了。**
- 修复（三页统一）：`onBackPress` 只做**时间判定**——手指仍按着（`TOUCH_HOLD_MAX` = 1200ms 内）
  或刚拖完（`BACK_GUARD` = 400ms 内）就吞掉这次返回，**但不清 touch/pan 标记**。
  这样拖动不会被掐断，同时因为判定期到点自动失效，也不会重演上一版「退不出去」的死锁。
- 加固（防同类再犯）：
  1. 骰子页死区 `TAP_SLOP` 12 → **4**：这两页没有「点格落子」，死区只是滤落指抖动，
     取值过大在换算系数偏小时会让人误以为棋盘固定。
  2. `clientK` 加**合理性校验**（0.25~4，越界即丢弃、回退 `designK`）：万一
     `getBoundingClientRect` 与触摸坐标系不同源，宁可回退也不要用错系数把拖动/落点算死。
- 校验：`npm run build` 通过；13 个测试文件 0 失败；5 个审计脚本全绿。
- 待真机复核：拖动是否跟手、速度是否 1:1；松手后侧滑能否正常呼出抽屉（400ms 内需再滑一次）。

## 阶段自检（循环修 bug 第 1 轮：自查可辨识度；主版本保持 1.0.0，迭代以日期区分）

- 起点：用户要求进入「循环修 bug」；本轮我先做代码自查（只看有数据的客观缺陷），不猜手感。
- **① 浅色模式回合指示点看不见（已修）**：轮到白方时指示点填充用 `stoneWhite`
  （浅色 = `#FFFFFF`），压在近白胶囊底 `#ECE6F0` 上对比度仅 **1.22**（三配色一致）；深色模式 9.7 正常。
  黑方那侧代码里早已改用描边色规避，白方漏了。修法：填充仍用棋子色，**另加 1px 描边**
  （`outline`）——任何底色上都可见，且保留黑/白方语义；8px + 1px 描边 = 外径 10px，尺寸不变。
  回合胶囊与终局弹窗的点都改了。
- **② 浅色模式白棋轮廓太弱（已修）**：`stoneWhiteBorder` 浅色 `#79747E` → `#655F6B`，
  对棋盘底对比度 **3.53 → 4.78**（过 WCAG AA 4.5）。白棋填充仍是纯白，靠描边成形（围棋惯例）。
- **③ 深色模式棋盘网格线偏淡（已修）**：`boardLine` 深色 `#8B8792` → `#A5A1AC`，
  对棋盘底 **2.66 → 3.69**（旧值低于图形标准 3:1）。浅色侧 3.53 已达标，不动。
- **未改（设计取舍，非缺陷）**：底部 tab 栏、未选中胶囊、弹窗/抽屉/骰子/返回钮仍用
  tint 色（`surfaceContainer` / `surfaceContainerHigh`）——它们要表达「可点/浮层」，与页面同色会失去层次。
  若用户觉得也脏，再一并扁平化。
- 校验：新色值均经对比度脚本核算；`npm run build` 通过；13 个测试文件 0 失败；5 个审计脚本全绿。

## 阶段自检（局内退不出去 —— 返回抑制死锁；主版本保持 1.0.0，迭代以日期区分）

- 现象（玩家真机）：飞行棋对局中**退不出去**（这是可玩的红线问题）。
- 根因：本轮为修「拖动误触返回抽屉」加的抑制写成了
  `if (this.pan || ...) return true`，而 `this.pan` 只在 `onTouchEnd` 里清空。
  侧滑手势被系统抢走时**不再派发 touchend** → 标记永久非空 → 之后每一次返回事件都被吞掉、
  也不呼出抽屉 → 唯一出口（抽屉 →「退出对局」→ 三选弹窗）彻底不可达，人被锁在局内。
  棋类页的 `this.touch` 是同一套写法、同一处死锁（尚未被玩家触发，一并修）。
- 修复（game / monopoly / aeroplane 三页统一）：抑制条件只看两件事——
  ①**手指仍按着**（touch/pan 存在且 `t0` 在 `TOUCH_HOLD_MAX` = 1200ms 内）；
  ②**刚拖完** `BACK_GUARD` = 400ms 内。
  并且**每次 onBackPress 都先清空 touch/pan 与 lastPanTs**：即使这一次被吞，
  下一次侧滑必定能呼出抽屉 —— 保证退出永远可达。BACK_GUARD 600 → 400，减少「要滑两次」的体感。
- 退出链核对（未改）：抽屉「退出对局」→ `menuExit()` → `showExitConfirm` → 弹窗
  「回到主页 / 狠心离开」→ `leaveHome()` → `router.back()`，回调齐全。
- 校验：`npm run build` 通过；`node tests/run.js` 13 个文件 0 失败；5 个审计脚本全绿。
- 教训：**凡是用「触摸状态标记」当长期阻塞条件的写法，都要防「收不到 touchend」**——
  要么给标记加时间上限，要么在判定时顺手清掉。

## 阶段自检（进配置页闪一下紫色 —— 首帧用了兜底紫/深；主版本保持 1.0.0，迭代以日期区分）

- 现象（玩家真机）：点主界面游戏卡片、进入该游戏的**配置页（开局面板）**时，「闪一下紫色」。
- 根因：9 个页面 `data` 的 `t` 初始化写死 `themeMod.get('purple', 'dark')`（兜底值），
  真实配色要等 `@system.storage` 异步读回后才在 `onInit/onShow` 的 then 里赋值
  → **首帧按紫/深绘制，设置回来后再翻色** = 闪屏。浅色 + 绿/蓝配色的机器上就是明显的紫闪。
- 修复：theme.js 增加模块级「当前配色」缓存与同步取值 `current()`；
  `config.loadSettings()` 读完后调用 `themeMod.remember(palette, theme)`；
  9 个页面（start / index / game / monopoly / aeroplane / settings / stats / help / about）
  的 `t` 初始化统一改为 `theme.current()`。
- 效果：启动页读完设置即建立缓存，此后任何页面（含各游戏配置页）首帧就是正确配色，不再闪。
- 残留（不可避免，已留档）：**冷启动时启动页自身**仍会闪一次 —— 快应用没有同步存储可读，
  首帧拿不到上次的配色；读回后即正确。若将来要消掉，只能让启动页首帧改用中性底（不随配色）。
- 校验：`npm run build` 通过；`node tests/run.js` 13 个文件 0 失败；5 个审计脚本全绿。

## 阶段自检（正式包布局退化成横排 —— --optimize-css-attr 事故；主版本保持 1.0.0，迭代以日期区分）

- 现象（玩家真机，装正式包）：**整体排列变成横排（"横屏"）**；调试包正常。
- 根因：`--optimize-css-attr` 把 CSS 属性名替换为短名（源码见
  `@aiot-toolkit/parser/lib/ux/config/CompressConfig.js` 的 cssAttrMap），且**只压缩非 @media 的常规样式**
  （@media 内保留全名）。机型端运行时若不认这套短名，这些属性就被丢弃 → 全部元素回落默认
  `flex-direction: row` → 布局横排。skill 文档里没有该参数的说明（无官方背书），
  当初加入纯粹是为省体积。
- 实测对比（同一份源码，拆包看 `pages/index/index.js`）：
  - `aiot release --drop-console true`：
    `{flex:1, flexDirection:"column"}`、`{width:"36px", height:"36px", borderRadius:"12px", flexDirection:"row", alignItems:"center", justifyContent:"center", marginRight:"10px"}`
  - 再加 `--optimize-css-attr`：
    `{f:1, fD:"column"}`、`{w:"36px", h:"36px", bR:"12px", fD:"row", aI:"center", jC:"center", mR:"10px"}`
  - 结论：短名确实进包了；`--drop-console` 单独使用不影响 CSS（保留）。
- 处理：`package.json` 的 `release:jsc` 去掉 `--optimize-css-attr`；正式包体积从约 113KB 涨到约 120KB
  （JSC 版），换来样式正确。
- 交付双包（`aiot release` 会清空 dist，故先构建 JSC 版存到临时处，再构建无 JSC 版改名，最后拷回）：
  - `dist/com.application.watch.yiqishapan.release.1.0.0.rpk`（**JSC 字节码 + 签名**，主推）
  - `dist/com.application.watch.yiqishapan.release.1.0.0-nojsc.rpk`（**无 JSC 源码版**，后备：
    已逐字核对包内 `flexDirection` 等全名在，即样式一定进包）
- 复查门槛：若将来想重开 CSS 属性压缩，**必须先确认目标机型运行时支持短名**（实机验证），
  否则会重演整包丢样式。

## 阶段自检（卡片底色去 tint；浅色模式真机反馈；主版本保持 1.0.0，迭代以日期区分）

- 反馈：用户要求「卡片背景杂色去除」，并说明「卡片是绿色的，但它中间有白色」，出现在**浅色模式**。
- 排查与排除：先查了 3 个真机在跑的 Vela 项目（chaiban / chaiban-band / 开源参考）共 1158 个
  `<text>`，**没有任何一个给 text 设背景色**——故 `<text>` 无默认白底，白块不是它造成的；
  `div` 官方默认 `background-color` 无、`border-width` 0、`border-style` solid，也不存在默认皮肤。
- 判定：问题来自 `surfaceContainer / surfaceVariant` 这层 **tint 色阶**。浅色模式下卡片底
  `#F0F4EA`（发绿灰白）与页面 `#F7FBF2`（近白）只差几个色阶 → 观感就是「一块块发绿的底，
  中间夹着白」。色阶差太小，在手表低色深面板上还容易被抖动成杂色。
- 修复：**信息类容器一律与页面同色**（`surfaceContainer` → `surface`）：
  主界面游戏卡片、设置页行卡（srow/sgroup）、战绩页行卡（summary/g-row/r-row）、
  帮助页行卡（h-row）、关于页大卡与信息块（hero/info-block）；
  大富翁/飞行棋的**空地/空白航道**底色也改 `surface`（保留 2px `outline` 描边成棋盘格）。
  语义色不动：占领格与起点/飞行格仍用 `primaryContainer`（它表达归属，不是装饰）。
- 未改（保持层级区分，避免与页面糊成一片）：底部 tab 栏与其按钮、未选中胶囊
  （`surfaceVariant`）、弹窗 / 抽屉 / 骰子 / 返回圆钮（`surfaceContainerHigh`）。
  若这些也嫌脏，说一声一并扁平化。
- 校验：`npm run build` 通过；`node tests/run.js` 13 个文件 0 失败；5 个审计脚本全绿；
  文字对比度脚本仍全绿（同色后 onSurface/onSurfaceVariant 对 surface 均 ≥ 8.8）。

## 阶段自检（文字对比度 / 配色配对修正；主版本保持 1.0.0，迭代以日期区分）

- 起因：用户要求「优化文字颜色可读性」。做法：用 WCAG 相对亮度公式把 theme.js 的
  Token 两两算对比度，覆盖 3 配色 × 深浅 × 全部实际使用的「文字/底色」配对。
  结论：**系统性错误只有一处（onPrimary 配错底色）**，另有一处写死色板、一处用错语义色。
- **① 主按钮/选中态文字几乎不可见（根因）**：`onPrimary` 被用在 `primaryContainer`
  底色上（开始对局 / 继续上局 / 买下 / 再来一局 / 继续游戏 / 选中胶囊 / 占领格 /
  起点与飞行格 / 图标盒）。实测对比度 **1.29~1.53**（浅色模式=白字压淡紫，深色=深紫压深紫）。
  修复：按 MD3 语义新增 `onPrimaryContainer`（深色取 tone 90、浅色取 tone 10），
  6 处配色全部补齐；所有「底色 primaryContainer」的用法改用该 Token，实测 **6.95~13.32**。
  `onPrimary` 保留给「底色 primary」的场合（本应用暂无文字用 primary 底的场景）。
- **② 战绩大厅胜负色写死 dark 色板**：`colorMap` 用 `themeMod.dark.resultWin/Lose/Draw`
  和 `themeMod.dark.onSurface` —— 浅色模式下这些浅粉/浅灰压在浅底上只有 **1.1~1.6**，
  胜负字看不见；且换配色（绿/蓝）也不跟随。修复：改用当前主题 `this.t`，并把
  「读设置」与「读记录」合成 `Promise.all` 后再渲染，消除配色未就位就着色的竞态。
- **③ `outline` 被当文字色**：启动页提示、主界面禁用卡片（名称 / 图标 / 「需要更大屏幕」）、
  战绩页空态与对局时间。浅色模式下 outline 压在 surfaceContainer 只有 **3.96~4.03**，
  低于 AA 4.5。修复：这些文字统一改 `onSurfaceVariant`（实测 7.5~9.7）；
  `outline` 只保留给描边与图形（描边 3:1 属图形标准，够用）。
- 校验：对比度脚本（全部文字配对 ≥ 4.5，3 配色 × 深浅全绿）；`npm run build` 通过；
  `node tests/run.js` 13 个文件 0 失败；check-all / check-backpress / check-backclean /
  check-opensrc / check-features 全绿；按钮底色 0 缺失、页面内 `themeMod.dark.` 硬编码 0 处。
- 顺带发现（未改，非文字）：浅色模式白棋 `#FFFFFF` 压棋盘底 `#E7E0EC` 只有 1.29，
  仅靠 1px 描边（3.53）可见；棋盘网格线深色模式 2.65~2.66。若要一并提升请说。

## 阶段自检（触摸准度 / 误触 / 按钮底色；四机型真机反馈；主版本保持 1.0.0，迭代以日期区分）

- 反馈来源：手环 9、手环 10、小米手环 Pro、红米 Watch 四机型。三条问题：
  ①棋类对局页「棋子落的位置跟手点的位置不一样」；②按钮背景杂色、「继续上局」没样式；
  ③误触概率高，重点是拖动时误触「侧滑返回」抽屉。
- **① 触摸换算改为实测（不再猜单位制）**：官方文档未规定 TouchEvent.clientX/Y 的单位
  （general_events.md 只写「距可见区域左边沿」），而 getBoundingClientRect 同样返回
  「相对视窗」的尺寸/位置（general_methods.md）。故三页各加一个 id（game 的 vp /
  monopoly + aeroplane 的 board），进对局后测一次：
  `clientK = 192 / rect.width`（视口恒为 192 设计像素宽），并用 rect.left/top 作原点。
  调用失败（元素未渲染 / API 不可用）自动回退旧 designK。旧的 designK 路径保留为兜底。
  另：monopoly/aeroplane 的平移原先直接用 clientX 差值（未换算），与 game 页不一致，
  必然有一页错；现三页统一走 clientK。
- **② 去掉「落指即搬棋盘」**：旧版 onTouchMove 无死区，手指一落棋盘就跟着动（阈值 6），
  轻触时棋盘先跳几像素、拖动/落子互相误判。现加 TAP_SLOP = 12 设计像素死区：
  未越过死区 → 棋盘不动、抬起算「点」；越过 → 以越界点为基准起手平移（不跳变）。
  同时把「点」的有效时长收敛为 TAP_MAX_MS = 600。
- **③ 拖动不再被侧滑返回抢走**：onBackPress 增加前置抑制——触摸进行中（game 的
  this.touch / 大富翁与飞行棋的 this.pan）或距上次平移结束不足 BACK_GUARD = 600ms 时，
  直接 return true（吞掉返回事件，不呼出抽屉），避免平移手势被判成侧滑返回。
- **按钮杂色 = 平台默认皮肤**：`<input type="button">` 未设 background-color 时回落
  平台默认皮肤（观感即「杂色」）；「继续上局」在 game.ux 只有 color/border-color，
  故「没有 CSS」。现全项目 0 个缺底色按钮（脚本校验）：
  - 页面内按钮 → `t.surface`；弹窗按钮 → `t.surfaceContainerHigh`；
    抽屉项 → `t.surfaceContainerHigh`；底栏 tab → `t.surfaceContainer`。
  - 已设 primaryContainer 的主按钮不动；CSS 里 `.s-back/.m-btn/.d-item/.tab` 的
    `background-color: transparent` 已被内联底色覆盖（内联优先级更高）。
- 校验：`npm run build` 通过；`node tests/run.js` 13 个文件 0 失败；
  check-all / check-backpress / check-backclean / check-opensrc / check-features 全绿；
  按钮底色完整性用脚本核对（`<input …/>` 块内必须含 background-color，缺 0 个）。
- 待真机复核：四机型落子准度（尤其手环 9 的 2× 档）、拖动是否还会误开抽屉、
  大富翁/飞行棋拖动是否与手指 1:1。

## 阶段自检（tab 栏多屏自适应 + MD3 打磨 + 关于页；主版本保持 1.0.0，迭代以日期区分）

- 测试：node tests/run.js，13 个文件 246 断言全部通过。
- 顶栏按屏幕形状分别布局（用户反馈：跑道屏左上角在曲面裁切区看不见返回钮、
  方屏标题应在右上角）：子页面顶栏改为「返回钮 + 标题」容器（1px 底部分隔线），
  经媒体查询分形态——跑道屏（pill）：整体下移进安全区（padding-left 16，
  圆钮几何验算完整可见），标题居中；方屏（rect）：返回钮绝对定位左上角
  （4,4,38px），标题右对齐。
- 设置页重设计（用户反馈「不丑吗」）：①震动反馈改单行行（标签居左 + 开关居右，
  电子书 item-content 式）；②所有选项从圆圈胶囊改为 **MD3 segmented control**
  （整条 140px 圆角容器 flex:1 等分三/两段，选中段填充 primaryContainer，
  不再出现单字塞圆圈的怪相）；③纵向紧凑化——单行行 56px、分段行 ≈66px，
  全部设置一屏可见；④配色风格选项即 紫/绿/蓝（segmented 等宽放下全名）。
- 返回钮第三轮（玩家反馈仍有页面点不了）：①大富翁/飞行棋补加顶栏
  （back-fab 左上 + 标题右上），与棋类页面统一；②骰子玩法棋盘加
  viewport + wrap 分层（可缩放 + 平移），zoom-fab 移到 viewport 外
  消除触摸事件冲突；③aeroplane style src 漏改修复（样式整包失效致
  页面结构 7 根异常）；④monopoly/aeroplane 脚本拼接损坏修复
  （孤儿属性块/多余大括号/缺失方法逗号）。
- 返回钮点击无反应根治（第二轮反馈）：回到与全部可点控件同构的
  `<input type="button">` 实现（本应用 tab/骰子/弹窗按钮均 input 且已验证可用），
  热区加大至 44×44；goBack 加防重复触发保护；screen.js 吸收 2048N 的
  三档屏型判定（rect / pill-small 手环9 96dp / pill 手环10 106dp+，
  screenWidth 按 dp 读）备用。
- 致命根因修复（玩家反馈：棋类点了没反应/返回钮点了没反应）：
  ①**路由参数未在 data 声明**——quickapp 只把 router params 赋给 data 中
  声明过的属性，game.ux 缺 `type: ''` 声明 → this.type 恒为 undefined →
  getGame 失败立即 replace 回主界面（飞行棋/大富翁因无需参数幸免）。
  已在 game.ux data 声明 `type: ''`。
  ②**方屏顶栏返回钮被标题覆盖**——rect 下返回钮 absolute 而标题 flex:1
  DOM 在后，整条透明标题盖住返回钮吞掉点击。已把返回钮移到 DOM 末尾
  （天然置顶），跑道屏用 row-reverse 保持视觉左位。
  ③back-fab 回归 input type=button（与本应用全部已验证可点控件同构）+ 44 热区
  + goBack 防重复触发。
- 返回按钮清理（玩家反馈「没清理干净/点了没反应」）：stats/help/about 三页
  底栏的旧「返 回」tab 残留已移除（此前删 tabbar 外壳时按钮漏删），
  barH/tabH 死绑定同步清理；四页返回入口唯一 = 左上角 44px 圆钮
  （div+text 实现——input 圆钮点击不可靠），校验脚本 check-backclean.py
  断言返回入口唯一且回调齐全。
- 返回交互改版（参考 ebook 左上角返回钮）：settings/stats/help/about 四页
  左上角 44px 圆形返回钮（absolute 4,4，glyph ＜ 全角字符——CJK 字体必有，
  规避图片与符号缺字）；settings 底栏收为 玩法/关于 两 tab，stats/help/about
  底栏整条移除（返回上移后无重复入口）。
- 开源参考落地（bandcomic / com.bandbbs.ebook / 2048N）：
  ①主界面卡片改双行（名称 + 玩法短句，config 新增 short 字段）；
  ②方屏/矩形手表（shape: rect 媒体查询）主界面自动切**双列网格**、
  全页面标题/底栏/内边距紧凑化——机型适配从 JS 绑定回归 CSS 媒体查询
  （更声明式，勿再回退）；③关于页重设计：hero 大卡（名称/版本居左 +
  徽标居右）+ 信息块（标签次级色 + 值粗体）。
- 样式完整性事故与修复（自检发现）：多轮脚本拼接叠加导致 index/game/monopoly
  三个 CSS 出现孤儿属性块/多余大括号（编译报 Unexpected }），aeroplane 的
  style src 漏改叠加——已全部整文件重写，并建立大括号配平校验（所有页面
  CSS 的 { 与 } 数量必须相等）。
- 描边全面撤除（MD3 深色主题用色阶表达层级，不用描边）：除游戏语义边框
  （棋盘格 owner 色 / 棋子 / 标记 / 棋子点）外，全部表面 1px 描边移除。
  坑：项目根目录放参考源码会被 aiot 编译（UxLoader 报错），参考材料放仓库外；
  飞行棋/启动/关于三页 style src 漏改致样式整包失效（同 index 早期问题，
  start/about 横排即此根因），已全部改 @import 并拆包核对（新页脚手架
  务必直接用 @import）。
- 开源技术深挖第二批：①marquee 跑马灯组件（bandcomic 式）——大富翁/飞行棋
  事件播报长文本自动滚动，单行不再截断；②@system.app.getInfo()（ebook 式）——
  关于页名称/版本从 manifest 动态读取，改版本号无需改代码（manifest 需声明
  system.app feature）；③scroll bounces 回弹（index/settings/about）；
  ④release 脚本加 --drop-console true（生产去日志）。
- tab 栏高度自适应（红米 Watch/Pro 反馈：大屏上 60px 固定栏高等比放大占屏 ~26%）：
  栏高 = designH × 11.5%，钳制 [44, 60]；tab 文字高 = 栏高 - 10。全部经
  barH/tabH 数据绑定注入（8 个页面），大富翁/飞行棋棋盘高度同步扣减动态栏高。
- 多屏适配根治（玩家三截图反馈：方屏 tab 栏整个消失 / 跑道屏 tab 文字被底部
  曲面切半 / 卡片从栏下穿过）：根因是根容器高度依赖 pageH 运行时估算——
  单位制歧义（物理 px vs dp）会让 designH 估算差一倍，flex 布局随之崩塌。
  根治：①根容器高度改 CSS height:100%（跟随框架页面真实高度，任何设备
  精确贴合），移除全部 pageH 根绑定；②tab 栏保留在 flex 末尾自然贴底，
  高度 52→60 且文字上提 12px（跑道屏底部曲面安全区）；③对局视口改 flex:1
  自适应（vpH 估算仅剩平移钳位用途）；④骰子玩法 actions 弹性填充 +
  boardH 扣除 60px 底栏。⑤关于页上线（作者 弦起悲歌赴寒江 / 官方群
  914824845，入口收拢至设置页底栏）。
- MD3 深度打磨：表面三阶（surface / surfaceContainer / surfaceContainerHigh，
  三配色 × 深浅全量）、列表语言（36px 染色图标容器、12px 卡片圆角、标题分隔线）、
  弹窗 16px 圆角 + 高阶表面、骰子 FAB 圆盘化。
- 修复：settings/index 的 pageH 未在 data 声明导致绑定失效（已随根因清除）；
  aeroplane 对手索引 3-player → 1-player。
- 体验/性能专项（玩家反馈第四轮）：①方屏双列卡片内容垂直居中
  （card-text flex:none，原 flex:1 把文字顶到卡片上部）；②重开防误触——
  对局中点重开弹「重开对局？」确认（已自动保存可继续上局），终局态直接回面板；
  ③悔棋防连点——300ms 内重复 tap 只退一手；④大富翁购买按钮延迟 400ms 激活
  （掷骰的连点不会误落到买地/放弃）；⑤release 增加 --optimize-css-attr
  （CSS 属性优化，正式包 104KB）。**⑤ 已于 10-17 撤销：该参数会把 CSS 属性名压成
  短名，机型端运行时不认即整包丢样式（详见顶部「卡片…/正式包布局退化」阶段自检）。**
- 打包管线：签名证书 sign/（10 年期自签，CN=YuQiShaPan）；正式包经 `npm run release:jsc`
  产出（JSC 字节码 + 正式签名）。**该脚本已改回直连命令**
  `aiot release --enable-jsc --drop-console true`（**不再带 --optimize-css-attr**），
  原先的中转脚本 scripts/release-jsc.py 已删除。原因：中转方案是为绕开
  「JSC 工具不支持中文路径」——旧目录 `D:\andlua\驭棋沙盘` 下跑
  `aiot build --enable-jsc` 实测报 `Generate jsc bytecode error / Command failed`；
  目录改名为纯 ASCII（`D:\andlua\yiqi`）后，同一组参数直连实测成功（2599ms，
  产物拆包 10 个 `.jsc`、0 个 `.js`），故中转不再需要。
  注：工具链 2.0.5 自身会把项目迁到 `<父目录>\.temp_<目录名>` 构建（如
  `D:\andlua\.temp_yiqi`），构建结束拷回本项目 —— 这是工具链默认行为，与路径是否为中文无关。
  若将目录名改回中文，需恢复中转方案（纯 ASCII 目录建包再拷回）。
- 对局容错（误触侧滑退出）：①onBackPress() 拦截——对局进行中（playing/thinking
  或骰子玩法非 matching/over）侧滑/返回弹「退出对局？」确认（继续对局/退出），
  终局与开局面板正常放行；②可恢复兜底——每手落子后写入对局快照（chess_save_<棋种>：
  棋盘/回合/最后一手/执子/模式/难度），确认退出后仍可从开局面板「继续上局」
  一键恢复（悔棋栈不持久化）；终局/新开局自动清快照。
- 棋盘范围限制：makeGeo 增加纵向钳制——cell ≤ (vpH-2×pad-10)/rows，
  棋盘纵向永不超出屏幕（13 路围棋 1.5x 缩放自动降格适配），横向照常平移。
- 机型参数：screen.getLayout 输出 compact（designH<400 的方/圆屏），
  主界面卡片高度自适应（compact 46 / 常规 58）。
- 防横向"横屏排列"：全部页面根容器 overflow:hidden。
- 平台红线：零 <image>、零 shadow/gradient/transform、显式 flex-direction、
  scroll 显式 scroll-y、外部 CSS @import。
- 性能：chess/go hard 500ms 预算封顶；monopoly/aeroplane O(1) 结算；
  FMP 零图片零网络。

## 阶段自检（对局交互改版：全屏棋盘 + 三选离开弹窗 + 正中骰子可点 + 骰子玩法存档）

- 对局中撤除返回按钮（game / monopoly / aeroplane 三页顶栏返回钮移除）：**侧滑返回直接
  呼出控制抽屉**（不再直接弹离开确认）；抽屉里的「退出对局」再弹「离开对局？」三选——
  继续游戏（留在对局）/ 回到主页（落快照，回主页后开局面板/续局面板可「继续上局」）/
  狠心离开（清快照弃档）。
- 棋盘全屏 + 自由平移：三页根容器去掉上下内边距，棋盘视口 flex:1 铺满整页（旧布局
  顶栏+状态行+底栏共占约 108 设计像素）；**取消一切边界钳制**，棋盘可任意方向拖出屏幕
  （game 页 clampX/clampY 直通；大富翁/飞行棋 wrapX/wrapY 双向自由平移）。
  棋类页回合指示改「顶部居中胶囊浮层」；悔棋/停手/重开/退出/缩放收进控制抽屉。
- 控制抽屉由「侧滑返回」呼出。原方案的右下角「…」浮动钮已按用户要求撤除。
- 大富翁 / 飞行棋正中骰子改为可点按钮（点击即掷；旧为只显示「骰 N」的圆盘 + 底部
  「掷骰子」按钮）；HUD 与事件播报改顶部浮层；购买 / 选机决策改居中弹窗；
  抽屉含放大 / 缩小 / 重开新局 / 退出对局。
- 屏型差异化（用户澄清后落实）：**仅跑道屏（胶囊屏，shape=pill-shaped）控件居中单列**
  —— 开局面板选项改居中单列、骰子玩法顶部信息改居中单列堆叠、**底部 tab 栏改单列两行**
  （主界面 战绩/设置、设置页 玩法/关于；栏高 104 = 两行 46 + 间距，设置页由 barH 按屏型
  计算后绑定）；**方屏（小米手环 Pro / REDMI Watch）保持原设计**，不做居中单列、tab 栏
  仍单行。相关规则写在 pill-shaped 媒体查询里，不再动基础样式。
- 大屏方表收敛：screen.js 新增 uiScale —— rect 且屏宽 dp ≥ 190（REDMI Watch 5 = 216dp）
  时为 0.8，小米手环 Pro（168dp）与跑道屏（96/106dp）保持 1；只收敛**内联绑定**的字号、
  棋盘/航道格尺寸与顶部浮层高度（CSS 媒体查询覆盖不到内联样式，故走 JS）。
- 修复画布高被高估（大屏「UI 过大」的根因）：screen.getLayout 原用 Math.max(300, …) 兜底，
  REDMI Watch 5 实际画布约 192×228 被抬到 300 → 全屏棋盘/弹窗按 300 布局而上下溢出；
  **仅大屏方表（rect 且屏宽 dp ≥ 190）改为按真实画布高输出**（下限 120），
  跑道屏与小米手环 Pro 沿用旧兜底值，版面与之前完全一致。
- 骰子玩法新增对局存档 chess_save_monopoly / chess_save_aeroplane：仅在玩家回合稳定点
  （state=roll）落快照，瞬时态不写（避免存到 AI 回合中段而破坏轮次）；
  进入页面若读到存档，先出「继续上局 / 开始新局」续局面板。
- 修复（本次排查发现，均属大富翁页既有缺陷，已随重写一并解决）：
  ① 规则层 CELLS 为 16 格，而页面只渲染 12 格、棋子却按 0~15 索引 posList
     → 棋子走过第 11 格后索引越界抛错；现按 16 格重排（上 5 / 右 3 / 下 5 / 左 3）。
  ② CSS 把格写死 54×38，而脚本按 cw≈34 / ch≈30 计算间距 → 相邻格严重重叠；
     现格宽高由脚本内联绑定，并加 box-sizing: border-box + overflow: hidden。
  ③ restart() 调用了不存在的 doRestart() → 终局态点「重开」必崩；现已抽出 doRestart()。
  ④ game 页纵向钳制按 TODO 既有承诺补上（makeGeo 增加 cell ≤ (vpH-2×PAD-10)/rows）。
- 审计脚本同步：check-all.py / check-backpress.py 的退出弹窗关键字由「退出对局？」
  改为「离开对局？」，并补「继续游戏 / 回到主页 / 狠心离开 / showMenu / saveSnapshot /
  continueGame」。check-all.py 不再断言大富翁页面的「掷骰子」（该串来自 config 玩法简介，
  非页面按钮）。
- 校验：npm run build 通过；node tests/run.js 13 个文件 0 失败；check-all /
  check-backpress / check-backclean / check-opensrc / check-features 全绿。

## 阶段自检（图片化改造：全部视觉素材改为原创 AI 位图；清理临时诊断读数）

- **清理临时诊断读数**：三页（game / monopoly / aeroplane）的 `.diag` 小字、`camX`/`camY`
  数据字段、以及 game 页承载它的 `@scroll="onSceneScroll"` 监听与 `onSceneScroll` 方法全部删除
  （前一轮为定位留白问题临时加的），页面回归纯净界面。
- **素材来源与原创性**：全部视觉素材由 AI 生成（`GenerateImage`）+ 本地 PIL 处理得到，
  不取自任何现有项目。共 13 个文件放入 `src/common/img/`（合计约 186 KB）：
  - 棋种徽标 9 个 `ic_*.png`（96×96，含禁用棋种的中国象棋灰度版）；
  - 品牌徽标 `brand.png`（192×192）+ 清单图标 `icon.png`/`logo.png`（192×192，同源）；
  - 整页背景纹样 `bg_dark.jpg` / `bg_light.jpg`（384×980，贴合 192×490 画布 2x）；
  - 棋盘纸纹 `tex_grain.jpg`（256×256）。
- **素材处理流程**（脚本在项目外 `D:\andlua\_yqart_work`）：原图 1920×1920 → 按人工读图测得的
  徽标边界裁切（去掉外圈渐变与圆角，让徽标填满显示框）→ 右下角水印用「横向取邻近像元补色」
  抹除（对平滑渐变无痕）→ Lanczos 缩到目标尺寸 → 圆角 alpha 遮罩。背景大图因是平滑渐变，
  转 JPEG（q86）后体积从 84 KB 降到 12 KB。
- **⚠️ 平台约束（本次踩坑，务必遵守）**：
  ① `background-image` 在**小米手环 9 / 9 Pro、Xiaomi Watch S3、Redmi Watch 4、小米 S1 Pro**
     官方标注「不支持」→ 本工程一律改用 `<image>` 组件铺底，不用 CSS 背景图。
  ② `object-fit` 是 **样式**（官方「样式」表，默认值就是 `cover`），**不是属性**；
     写成 `object-fit="cover"` 会被 aiot-toolkit 报 `unsupport attribute [img.object-fit]`，
     故本工程全部删除该属性，靠默认 cover。
- **铺底写法（关键）**：整页背景纹样用 `position:absolute; left:0; top:0; width:192px; height:100%`
  （`designWidth=192` → 页面恒定 192 设计像素宽，写死 192 比 100% 更稳）；为保证纹样真正
  铺满 0~100%，各页把 `.page` 的 `padding-top` 取消，改由首个内容块（`.topbar` / `.title-row`）
  的 `margin-top` 承担顶部留白（绝对定位元素以**内边距盒**为基准，页面上有 padding 时
  纹样会从 padding 下沿开始）。
- **层叠安全（防「背景盖住内容」）**：背景层是绝对定位元素，而页面的流式内容默认是静态元素 ——
  若运行时按 CSS 层叠规则绘制，绝对定位元素会画在静态元素之上，背景就会盖住文字。
  故各页把流式内容块也改成定位元素（**只写 `position: relative`，不写 `z-index`**：
  z-index 同为 auto 时层叠次序就回到文档顺序，背景在前即在最底层）。这样无论运行时按
  「文档顺序」还是按「CSS 层叠规则」绘制，结果都一致；不设 z-index 也不会影响页面里
  既有的绝对定位浮层（回合胶囊 / HUD / 抽屉 / 弹窗都排在文档更后面）。
  涉及：index（.title-row/.cards/.tabbar）、start（.logo-img/.name/.sub/.hint）、
  about/help/stats（.topbar/.body）、settings（再加 .tabbar）、
  game（.setup/.vp）、monopoly/aeroplane（.resume/.matching/.board）。
- **主界面改版**：棋种卡片左侧的 CSS 自绘图标（字形/圆环/四点）整体替换为位图徽标
  （`.card-icon` 40×40，方屏 34×34；禁用棋种 `icon-dim` 压到 0.45 不透明度）；
  标题旁新增品牌徽标（`.title-logo` 24×24）。config.js 的 `iconType`/`icon` 字段改为
  `icon`（图片路径），不再依赖设备字体字形（旧方案在缺字机型会显示豆腐块）。
- **对局页质感（方案已作废，见下方修复一节）**：曾给棋盘（game）与环体/航道
  （monopoly / aeroplane）各铺一层中性灰纸纹 `<image>`。**实测该写法有害**：
  位图位于 `<scroll>` 内，运行时被撑满整块舞台 —— 已全部移除，棋盘/环体改回纯底色。
- **配色安全**：`bg_dark` 实测基底 (30,31,35)，与三套配色的深色 surface
  （#1C1B1F / #1B1C1A / #1A1C1E）色差 ≤ 5；`bg_light` 已按均值归一到中性白
  (252,250,251)，不会让紫色/绿色/蓝色任一配色偏色。
- **多屏适配补充**：启动页新增 rect 媒体查询（徽标、标题与提示收紧），
  避免方屏（画布高约 203）下提示语被 `overflow:hidden` 裁掉；主界面图标随屏型取不同尺寸。
  （具体像素见下方「修复：玩家反馈」一节——徽标最终定为 36/30px、启动页徽标 76/60px。）
- **校验**：npm run build 无 `unsupport` 警告；node tests/run.js 13 个文件 0 失败；
  check-all（已扩充图片特性断言与「临时诊断读数已移除」回归护栏）/ check-backpress /
  check-backclean / check-opensrc / check-features 全绿。

## 阶段自检（修复：玩家反馈「图片太大 / 能滑到下面一大片留白」）

- **现象**：玩家反馈两处——「图片太大」、有的页面「滑动时能滑到下面一大堆留白」。
- **根因（两条，均属上一轮图片化的引入缺陷）**：
  ① **`<scroll>` 里放了 `<image>` 位图**：棋盘纸纹（`.board-tex`）与环体/航道纸纹
     （`.ring-tex`）都是「绝对定位 `<image>`」且位于 **`<scroll>` 内部**（`.stage` 里）。
     本项目记忆里已实测过：`<scroll>` 内的绝对定位元素会被**撑满整块舞台**并落在原点 ——
     于是纸纹被拉伸到整个视口，观感就是「图片太大」，且环内空区被整片纹理铺满、
     格与格之间看起来就是「一大片留白」。
     **结论：滚动容器内一律不放位图**；棋盘/环体的质感应改用底色或流式元素表达。
     已在 check-all.py 加回归护栏（三页包内不得出现 `board-tex`/`ring-tex`/`tex_grain`）。
  ② **整页背景用百分比高度**：`.bgtex` 原为 `width:192px; height:100%`。绝对定位元素的
     百分比高度在运行时可能落到**图片自身高度**（原图 384×980 → 490 设计像素），
     方屏画布高只有约 203 时就会大幅溢出。
     **结论：整页位图尺寸必须显式绑定为设计像素** `width:192px; height:{{pageH}}px`
     （pageH 来自 screen.getLayout，天然随屏型自适应），不用 `height:100%`。
- **同时把图标占位收回原设计尺度**：徽标由 40px（方屏 34）收回 **36px（方屏 30）**，
  与改版前 `.icon-box` 的 36 像素占位一致；启动页品牌徽标 84→**76**px（方屏 60）。
  徽标是整块饱和色位图，占位与旧版一致才不会在窄屏上显「过大」。
- **兜底加固**：`.card` 增加 `overflow: hidden` —— 卡片尺寸固定且自裁剪，任何情况下
  内部元素都撑不高卡片、也就撑不长卡片列表的可滚内容。
- **保留项**：棋种徽标位图（主界面）、品牌徽标（启动页/关于页/标题）、整页背景纹样
  （9 个页面，尺寸已改为显式绑定）。删除素材：`tex_grain.jpg`（纸纹，已无引用）。
- **校验**：npm run build 无警告；13 个测试文件 0 失败；5 个审计脚本全绿；
  拆包核对：`.bgtex` 编译结果为 `position:absolute;left:0;top:0`（无百分比尺寸），
  模板内联为 `width:192px;height:<pageH>px`；`.card-icon` 为 36/30px；
  三页包内不含任何滚动容器内位图。

## 阶段自检（棋盘底材：原创 AI 素材；参考项目的设备自动化 MCP）

- **用户决策**：参考项目「方寸棋阁」的技术学习（见 `STUDY.md`）**只采纳设备自动化 MCP**，
  其余条目（`<stack>` 重构 / 圆屏 `circle` 适配 / interconnect 分片传输 / 存档迁移 / 离线授权）
  一律不采纳，仅归档记录。
- **棋盘底材（game.ux）**：新增 2 张原创 AI 生成的材质图 `board_dark.jpg` / `board_light.jpg`
  （512×512，q76，共约 58 KB），随深/浅模式切换。
  - 均值已**归一到两套 `boardBg`**（深 `#49454F` / 浅 `#E7E0EC`，实测误差 ≤1），
    因此网格线与棋子的对比度与「纯底色时代」**完全一致**，视觉只多了一层极淡肌理。
  - 实现方式（关键）：作为棋盘盒 `.board` 的 **流式首个子项**，尺寸由模板内联绑定
    `width:{{boardW}}px; height:{{boardH}}px`；**刻意不用绝对定位** —— 本项目实测过
    「`<scroll>` 内的绝对定位位图会被撑满整块舞台」（就是上一轮「图片太大 / 滑出留白」的根因）。
    流式盒 + 显式尺寸才是验证过的可靠写法；棋盘盒自身宽高固定，该子项撑不大它。
  - 网格线 / 星位 / 棋子是它**后面**的绝对定位兄弟，天然叠在底材之上（文档顺序）。
  - 兜底：`.board` 仍保留 `background-color:{{t.boardBg}}`，即使位图加载失败，
    棋盘外观与改动前一致（优雅降级）；CSS 另加 `.board-mat { flex-shrink: 0 }` 防挤压。
  - **只做了棋类对局页（game.ux）**：大富翁 / 飞行棋的环体与航道未改（用户说的是「棋盘」；
    环体/航道当时正是出问题的地方，不重复触碰）。如需同样处理，按同一「流式盒 + 显式尺寸」写法即可。
- **设备自动化 MCP**：`D:\andlua\_decproj\.vscode\mcp.json` 里的 `velajs-mcp` 配置
  （`take_screenshot` / `get_element` / `tap` / `swipe` / `execute_script` / `get_console_logs` /
  `build_project` 等）已确认对我们的价值：**可替代「无模拟器只能靠推理改 UI」的现状**。
  - ⚠️ **`.vscode/mcp.json` 对模型是只读的**（写入报 `Access denied … restricted to user edits`，
    属于 MCP 权限配置的保护策略）→ 配置内容原文放在 `STUDY.md` 第 8 节，需**用户自行复制**到
    `.vscode/mcp.json`。**尚未验证该 MCP 能否连通**（依赖 `npx vela-mcp` 三方包 + 设备/模拟器在位）。
- **校验**：npm run build 无警告；13 个测试文件 0 失败；5 个审计脚本全绿。
  （⚠️ 本节记录的「底材＝流式子元素 + 显式尺寸」写法**已被下一节判定为错**：位图当子元素会把
  棋盘盒撑大；现改为 `.board` 的 `background-image`，详见下一节。）

## 阶段自检（修复：棋盘底材把棋盘盒撑大 →「右边一大块空白」）

- **现象（玩家真机截图）**：五子棋对局页「第一张右面留那么大的空，而左边没有」——
  棋盘左侧几乎贴边、右侧却空出一大条。
- **取证方式（像素级）**：对两张真机截图做扫描（`PIL` 取色带 + 包围盒），得到硬数据：
  截图 432×514；**底材区域横跨 x 0~431（整屏宽）、y 9~507**；而**网格竖线只在 x = 32,79,…,362**、
  横线 y = 60,108,…,438。按 `deviceTypeList` 与设计画布反推：该机是 **216dp 宽的方屏表**
  （`uiScale` 0.8 → 9 路五子棋 `cell = 26×0.8 = 20.8 → 钳到 21`；设计 px→物理 px 系数 2.25，
  网格间距实测 47.1px ≈ 21×2.25 ✓）。于是：
  **底材宽度 ≥ 192 设计像素（整屏），而棋盒应只有约 188 设计像素、网格只占其中一段** ——
  底材明显比棋盘盒大，多出的部分就落在右侧与下方。
- **根因**：**材质位图不能当子元素**。`<image>` 按**原图物理像素**渲染（我给的源是 512×512 →
  512 物理像素 ≈ 227 设计像素），远超棋盘盒的 188，**棋盘盒被撑大**（盒的原点仍在 boardX/boardY，
  所以左侧贴边、右侧溢出）。前一轮把它做成「绝对定位子元素」时同样出问题，本轮改成「流式子元素」
  **仍然出问题** —— 说明问题不在定位方式，而在「位图参与布局时按原图尺寸而不是绑定尺寸」。
- **修法**：**改为 `.board` 的 `background-image`**：
  `style="…;background-image:url('{{boardMatSrc}}')"`（URL 随深/浅模式内联绑定）+
  CSS `.board { background-size: 100% 100%; background-repeat: no-repeat; }`。
  背景图**不产生子元素、不参与布局** —— 任何设备上都不可能改变棋盘盒尺寸；
  即便机型不支持 `background-image`，也只是不显示材质、保留 `background-color` 纯底色（优雅降级）。
  同时删除 `<image class="board-mat">` 子元素与 `.board-mat` 规则。
- **保留项**：`board_dark.jpg` / `board_light.jpg`（512×512，均值仍归一到两套 `boardBg`，
  误差 ≤1 → 网格线与棋子对比度与纯底色时代完全一致）。
- **校验**：npm run build 无警告（工具链接受内联 `background-image:url(...)`）；
  13 个测试文件 0 失败；5 个审计脚本全绿（check-all 断言已由 `board-mat` 改为
  `background-image:url(` + 两张素材路径）；拆包核对：`.board` 编译样式为
  `backgroundSize:"100% 100%"` + `backgroundRepeat:"no-repeat"`，内联串含
  `background-image:url('` + 变量，**包内已无 `board-mat` 子元素**。
- **⚠️ 待玩家复核**：该机型（216dp 方屏）是否在 `background-image` 支持名单内（REDMI Watch 5/6、
  Xiaomi Watch S4/S5、小米手环 10 支持；手环 9/9 Pro、Watch S3、Redmi Watch 4 不支持）。
  若看不到材质，说明机型不支持，届时改用「小尺寸源图 + 显式尺寸」的备选方案。

## 阶段自检（修复：棋盘「没居中」的真因 —— cross 模式的盒尺寸多出一整格）

- **现象（玩家第三轮反馈，并直接点出方向）**：「**右边跟下面的区都比上面跟左边的大** ——
  说明你画的那个**没有居中**」。
- **前两轮误判更正**：我此前归因于「材质位图把棋盘盒撑大」，那是**错的**。
- **决定性证据**：第三张截图中材质**并未渲染**（棋盘呈纯底色 `#44483F` = 绿·深配色的 `boardBg`），
  但**偏置依旧**（左右内缩 ≈ pad，右/下多出约 1 格）→ 证明偏置与材质无关，是纯几何问题。
- **真因（代码层可坐实，`src/core/geometry.js`）**：
  `this.boardW = cols*cell + pad*2` 是 **cell 模式**的公式（棋盘由格子构成，跨度 = cols*cell）；
  而 **cross 模式**（五子棋 / 围棋，棋子落在交点）横竖只有 `cols-1 / rows-1` 个间隔，
  真正的网格跨度是 `(cols-1)*cell`。于是**盒比网格多出一整格**；
  线条与棋子又都锚定在左上角 `pad` 处 → **多出的那一格全部落在右侧与下侧**。
- **数值与真机截图吻合**：9 路、`cell 21`、`pad 10` → 盒 209、网格跨度 168 →
  四边内缩「左/上 10、右/下 31」，**差值正好 1 格 = 21 设计像素 = 47 物理像素**
  （截图实测：网格右边缘到屏幕边约 69~70px ≈ `pad + cell`；左边缘约 22~32px ≈ `pad`）。
- **修法**：盒尺寸按拓扑取跨度 —— cross 用 `(cols-1)*cell`、cell 用 `cols*cell`，再 `+pad*2`。
  两种模式的盒从此都与网格**严格对齐、四边内缩相等**。
- **回归护栏**：`tests/geometry.js` 新增「四边内缩相等（棋盘居中）= {left:10,top:10,right:10,bottom:10}」，
  并把旧期望 `7*30+2*10 = 230` 改为 `6*30+2*10 = 200`（旧期望本身固化了这个 bug）。
- **附带发现（棋盘材质）**：第三张截图棋盘是纯底色 → `.board` 的 `background-image`
  **在真机没有生效**（URL 形式或机型能力所致）。本轮未动它：不生效时自动退回纯底色，
  不会产生布局问题；但**「棋盘带 AI 材质」这一项目前在真机上尚未实现** ——
  待设备自动化 MCP 能截图实测后，再定位正确的 URL 形式（候选：静态 CSS 规则里的相对路径
  `url('../../common/img/board_dark.jpg')`）。
- **校验**：13 个测试文件 0 失败（geometry 断言由 13 条增至 14 条）；build 无警告；
  5 个审计脚本全绿；已出 JSC 正式包 + 无 JSC 后备包 + 调试包。

## 阶段自检（棋盘图：显示方式定论 + 飞行棋/大富翁各自的棋盘图）

- **玩家反馈**：几何修复确认成功（「四边等宽」）；随后要求 ① 修「棋盘图片显示问题」，
  ② 再为**飞行棋、大富翁**生成棋盘图，并强调「**不是背景图啊**」。
- **① 显示方式定论（三次试错后的结论）**：
  - 试过三种写法都不对：绝对定位子元素（撑大盒）、流式子元素（撑大盒）、
    `.board` 的 `background-image`（**真机根本不渲染** —— 截图取证：棋盘呈纯底色 `#44483F`）。
  - **最终写法：`<image>` 元件的绝对定位叶节点 + 容器 `overflow: hidden` 兜底**。
    依据：`<image src="{{动态路径}}">` 在本工程真机**确实渲染**（主界面徽标、整页纹样都正常）；
    绝对定位叶节点（与 `.grid-line`/`.star`/`.stone` 同类）在本机型坐标准确；
    `overflow:hidden` 让「位图按原图物理像素渲染而大于容器」这一副作用变成**无害**
    （只会被裁在盒内 = 恰好铺满棋盘），从此**既不会撑大盒子、也不会不显示**。
  - `.board`（棋类）与 `.ring`（大富翁/飞行棋）都按此写法改造。
- **② 新增 4 张棋盘图**（原创 AI 生成，各随深/浅模式切换）：
  | 文件 | 用途 | 内容 |
  |---|---|---|
  | `ring_monopoly_dark.jpg` | 大富翁·深色 | 近黑底 + 极淡街景线稿（房子/酒店/硬币/街道） |
  | `ring_monopoly_light.jpg` | 大富翁·浅色 | 浅灰紫底 + 同款极淡线稿 |
  | `ring_aeroplane_dark.jpg` | 飞行棋·深色 | 深蓝灰底 + 极淡航线/纸飞机/云/旗 |
  | `ring_aeroplane_light.jpg` | 飞行棋·浅色 | 浅灰底 + 同款极淡线稿 |
  底色刻意比页面 `surface` 略亮（深）/略暗（浅），让「棋盘」作为一整块板看得出来，
  同时格子里的文字与色块仍然清楚。四张共约 30 KB（384×980，JPEG q80）。
- **关于「不是背景图」的理解**：我按「**棋盘上要有画**（像棋类棋盘底材那样），
  而不是整页背景铺一张图」来执行；格子本身仍由代码绘制 —— 因为每格的位置/尺寸随
  `zoom(0.8/1/1.25/1.5)` 与 `uiS` 现算、且带动态文字（地名/价格/等级），
  **烘焙好的整块棋盘画无法与可点格对齐**。若玩家想要的是别的形态（例如每格一张小图），
  需要另行确认。
- **校验**：build 无警告；13 个测试文件 0 失败；5 个审计全绿（check-all 已增补
  `ring-mat` + 四张棋盘图路径断言）；素材合计 18 个文件约 264 KB；已出双包。

## 阶段自检（对局棋子位图化：棋子 / 骰子 / 房产标记换成图片）

- **玩家指令**：「按读法 B 执行，把飞行棋和大富翁的棋子、骰子、房产标记换成图片」。
  读法 B = 把**「被玩的对象」**位图化（不是给棋盘铺底衬）。上一节的 4 张「棋盘图」因此
  **被玩家明确否决并全部撤除**（原话「不是要光那种背景图。我是要能玩的图」）。
- **撤除项**（不留残迹）：两页模板的 `<image class="ring-mat">`、data 的 `ringSrc`、
  `themeMod.currentRing()`、CSS `.ring-mat`、theme.js 的 `RING_IMAGES/ringImage/currentRing`
  及其导出、4 个素材文件、check-all 里对应的 4 条路径断言；并在 check-all 新增
  **回归护栏**（两页包内不得再出现 `ring-mat`/`ring_monopoly`/`ring_aeroplane`）。
  `.ring{position:relative;overflow:hidden}` 保留（作为越界内容的裁剪兜底）。
- **新增 14 张素材**（`src/common/img/`，合计约 127 KB；素材总量 28 个文件约 362 KB）：
  | 文件 | 用途 | 来源 |
  |---|---|---|
  | `dice_0` ~ `dice_6.png`（128×128，7 张） | 两页共用的骰子：1~6 点 + 初始面「骰」 | **程序化绘制**（见下） |
  | `plane_p0/p1.png`（96×96，2 张） | 飞行棋飞机：蓝=本机玩家 / 红=AI | AI 生成 + PIL 圆形遮罩 |
  | `pawn_p0/p1.png`（96×96，2 张） | 大富翁棋子：蓝=本机玩家 / 红=AI | AI 生成 + PIL 圆形遮罩 |
  | `estate_1/2/3.png`（长边 128，3 张） | 房产标记：单房 / 双房 / 酒店 | AI 生成 + PIL 抠底（去奶白牌底） |
- **骰子为什么不用 AI 生成**：骰子的**点数必须精确可辨**（可玩性硬要求），而 AI 生成
  多格骰面极易把点数画错（4/6 点两列布局尤甚），且 `GenerateImage` 工具自身的使用说明
  就写明「简单几何图形/基础图案不要用本工具」。故骰子改用 **PIL 确定性绘制**：
  象牙白渐变骰面 + 圆角 + 深灰描边 + 按标准布局的精确点数；初始面用系统粗体渲染
  「骰」字（与旧版文字骰子语义一致）。仍是原创素材，不取自任何现有项目。
  飞机/棋子/房产标记是「有造型的插画」，仍走 AI 生成（保持与既有徽标素材同一风格）。
- **素材处理链**（脚本在项目外 `D:\andlua\_yqart_work`，用完即弃）：
  ① 三张「一图多样」原图（飞机/棋子各 2 枚、房产标记 3 级；2880×1440 / 3840×1280）——
  同图生成可保证不同配色/等级的**造型完全一致**；
  ② PIL 定位：以「列/行覆盖率 ≥ 阈值」求包围盒（`Image.resize((w,1)/,(1,h), BOX)` 求均值），
  刻意避开边角上那点**浅色水印残点**（简单 `getbbox` 会被水印带偏，导致遮罩圆心/半径全错）；
  ③ 徽章类按包围盒圆心 + 半径做**圆形 alpha 遮罩**（半径留 2px 余量消白边光晕）；
  ④ 房产标记先内缩 10% 甩掉牌子自带的深色外框，再按「与奶白底色的最大通道差」抠成透明
  （14 以下全透、34 以上全留，中间线性过渡），最后**三张统一切到同一 2.13:1 画布**
  （128×60，长边贴合、另一维留透明）—— 页面上的盒宽就是 `2.13×盒高`，**素材比例与盒比例一致**，
  于是即便运行时不认 `object-fit`（回落默认 `cover` 或 `fill`）也不会出现裁切/变形。
- **接入写法（关键，均为已验证形态）**：
  - 棋子：`<div class="token">` 圆点 → `<image class="token">`，**绝对定位叶节点**
    （与 `.cell` 同级同区，本机型坐标准确），`left/top/width/height/border-radius` 全由脚本现算绑定；
    尺寸沿用旧圆点的占位（`0.36×格宽`，≈原 12px），位置由「固定 +5px / +20px」改为**两枚在格宽内居中并排**。
  - 骰子：`<input type="button" value="{{diceText}}">` → `<image src="{{diceImg}}">` + **其上再叠一层
    尺寸同坐标的透明 `<div class="dice-hit" @click="onRoll">`**。理由：`<image>` 的 `click` 虽在
    通用事件表里支持，但本项目**真机未验证过**；而「透明 div 热区」是 game 页 `.tap-layer` 已在用的
    验证形态。`diceText` 字段随之删除，改存 `diceImg`（`themeMod.diceImage(面)`）。
  - 房产标记：地格内新增 `<image class="cell-estate" if="{{$item.hasEstate}}">`（**流式子项**，
    与地名文字一起居中排布），未购地格仍显示价格文字（`<text if="{{!$item.hasEstate}}">`）；
    **开关用布尔字段 `hasEstate`，不用「路径是否为空串」判断** —— 布尔在 `if` 里的语义没有歧义；
    CSS `object-fit: contain`（盒宽被格宽钳制时的兜底）+ `flex-shrink: 0`
    （Vela 下 flex 子项默认 `flex-shrink:1`，不写会被压扁）。
- **几何复算（无模拟器，用脚本按两页 buildBoard 公式逐档核对）**：
  - **棋子尺寸必须沿用旧占位**：初版取 `0.40×格宽`，在**小米手环 Pro（方屏，格间距仅 17px）**下
    棋子底边与下一行格顶由「2px 余量」变成「正好贴上」——回调为 `0.36×格宽`（≈旧 12px）后余量复原。
  - **房产标记盒高度 = 格内容盒 − 地名行**：`esH = clamp(ch-17, 7, 0.46×ch)`。旧版「地名 13 +
    价格 12 = 25」在格内容盒 26 里刚好占满，房产标记若取 0.5×ch 会溢出 2px 被 `overflow:hidden` 裁切；
    改后**五种屏型/档位下的内容溢出全部归零**。
  - 骰子盒 `0.18×边长` 圆角；两枚棋子并排宽 `≤ 格宽`、方屏 2×2 网格 `≤ 格宽−2` 均在全部档位成立。
- **校验**：`npm run build` 无 `unsupport` 警告；13 个测试文件 0 失败；5 个审计脚本全绿
  （check-all 已扩到断言 `cell-estate`/`dice-hit`/`/common/img/dice_` + 两页各棋子素材路径）；
  拆包核对：JSC 包 10 个 `.jsc` / 0 个 `.js`，无 JSC 包 10 个可读 `.js`，28 个素材三包齐备；
  `.cell-estate` 编译为 `flexShrink:0; objectFit:"contain"`，`.dice-hit` 编译出
  `events.click → _vm_.onRoll`，两页包内无任何 `ring-*` 残留。
- **产物**：`dist/` 三份 —— JSC 正式包（573 KB）、无 JSC 后备包（548 KB）、调试包（586 KB）。
  已交付请玩家真机确认：棋子/骰子/房产标记是否显示、大小是否合适、有无遮挡地名文字。
- **无模拟器下的补充自检**：写了一次性脚本 `mock.py`（项目外）按两页 buildBoard 的公式 + **真实素材**
  把三档屏型的棋盘合成出来肉眼验收（五张预览图），确认：棋子/骰子/房产标记均落在格内、
  地名与标记不重叠、方屏 2×2 飞机徽章不溢出格。脚本与素材原图留在 `D:\andlua\_yqart_work`（项目外，不入包）。

## 阶段自检（两棋「完整标准版」：规则重写 + 双人热座 + 系统 Toast + 盘面留白）

- **玩家 6 条需求与本轮确认的答案**：① 完整标准版（含盖房盖旅馆 / 抵押 / 拍卖 / 破产清算）；
  ② 人机匹配 + 双人（**同机轮流＝热座**）；③ 金额移到**环内骰子正上方**、棋盘**四周留空**；
  ④ 文字提示改用**系统消息**；⑤ 投骰子前**弹窗确认**；⑥ 命运/机会**结果弹窗**。
  追问确认：消息＝**不需要确定/取消的走系统 Toast，需要决定的走页内弹窗**；
  盘面＝**保持标准格数**（大富翁 40 / 飞行棋 52），默认整盘缩到一屏、靠放大看细节；
  地产＝**官方数字 + 中国地名**（「中国之旅」查不到可核实的官方价格表 —— 它只是多个厂商在售中式
  大富翁的通名，各版棋盘与价格都不同，故按玩家选择：数字取官方标准盘，名称换成中国地名）。
- **⚠️ 平台事实（务必记住）**：Vela 快应用**没有「系统通知组件」**。官方「系统能力」清单只有
  网络/振动/亮度/录音/定位/传感器/事件/电量/音量/解压缩/蓝牙；**最接近的是「弹窗 prompt」**
  （`@system.prompt` 的 `showToast`，官方文档 features/other/prompt.html），它 1.5~10 秒自动消失、
  不保留历史。已按此落地：`manifest.json` 的 features 增加 `{"name":"system.prompt"}` +
  新增 `src/utils/toast.js`（`try/catch` 兜底，设备不支持则静默失败）。**该能力尚无本项目真机背书**，
  列为真机确认第 1 项。
- **规则层重写**（数据与引擎分离，随机数全部经参数注入、node 可直测）：
  - `src/rules/monopoly-board.js`：**标准 40 格**数据表 —— 8 个地产色组（22 块地）、4 条铁路、2 家公用事业、
    起点/监狱/免费停车/入狱/机会×3/命运×3/所得税/奢侈税。**数字全部来自官方标准盘**（已逐项核对：
    22 块地的地价、六档租金、建房费、抵押值；铁路 200 / 租金 25·50·100·200 / 抵押 100；
    公用事业 150 / 抵押 75；开局 1500），出处写在文件头注释。名称按**同一价格与分组梯度 1:1 换成中国地名**
    （拉萨·银川·兰州…北京·上海），每格另给 1 字简称（40 格在 192px 宽下每格仅约 15px，默认档只排简称）。
  - `src/rules/monopoly-cards.js`：机会 16 张 + 命运 16 张（官方语义中文化，卡面文案即 Toast 播报用语）。
  - `src/rules/monopoly.js`：**单一动作入口** `applyAction(state, action, rand)` —— 掷骰 / 买地 / 放弃(拍卖) /
    出价 / 放弃竞拍 / 偿债 / 宣布破产 / 盖房 / 拆房 / 抵押 / 赎回 / 结束回合全走这一个入口，
    **UI 与 AI 共用**（双人热座与 AI 只差「谁来选动作」）。契约：`state.turn` 是行动者，
    `state.pending` 是「现在必须做什么」（roll|buy|auction|debt|endTurn|over）。
    标准规则要点均已实现并有测试：双骰再掷、**三连双入狱**、经过起点 +200、**成套未建房基础租金加倍**、
    **成套才可建房 + 均匀建造**、抵押须先卖同组建筑、**赎回多付 10% 利息**、**放弃购买即拍卖**、
    债务期只能卖房/抵押筹钱、**破产清算把资产移交债权人**、超 30 轮比总资产。
  - `src/rules/aeroplane-board.js` + `src/rules/aeroplane.js`：**标准 52 格外圈 + 每方 6 格冲刺道、每方 4 架飞机**；
    `d=-1 机库 / 0..51 外圈 / 52..57 冲刺道 / 58 到家`；掷 6 起飞并连投、撞机回库并连投、
    航线格前跳 4 格、超终点回弹（精确点数到家）、四机全到家判胜。
    **偏离点（已记录）**：航线格坐标是「每色区相对偏移 6」的**对称化设计**（公开资料只证实 52 格与
    「弹性格前跳 4 格」，未给逐格坐标）；每方入口格落在自家色区末格；盘面保留 4 个起飞点，
    双人对局只用蓝（环 0）与红（环 13）。
  - **测试**：`tests/rules-monopoly.js`（109 断言）与 `tests/rules-aeroplane.js`（105 断言）全部重写，
    `tests/rules-upgrade-streak.js` 里旧 `mp.advance/buy/level` 用例改写为「房屋等级→租金」与「AI 盖房决策」
    断言。全套 13 个测试文件 **409 断言 0 失败**。
- **页面改造**（两页均新增开局面板与双人热座；沿用棋类页 `game.ux` 的既有骨架）：
  - `state`：`idle(开局设置) → matching(人机匹配) → playing → over`；面板含「人机 / 双人」chip、
    模式提示、继续上局、开始对局、玩法介绍、返回。双人**无匹配演出直接开局**，掷骰确认弹窗兼作交接确认。
  - 记分：`config.recordResult(gameId, res, this.mode)`（双人传 `pvp`，`aggregateRecords` 早已支持）；
    存档加版本号 `v=2` 与 `mode`，**旧档结构不同一律丢弃**（回开局面板）。
  - **几何（回家刻度 10px 留白）**：`PAD=10, EDGE=4`；`cw=((192−2PAD−2EDGE)/每边格数)×z×uiS`；
    `ringW=2EDGE+cw×每边`；`stageW=max(192, ringW+2PAD)`、`ringY` 同理；**默认档整盘可见（拖不动），
    放大档（≥1.25×）盘面超出视口即可拖到任意位置**（要「留白 + 可拖」同时成立，只能这样取舍）。
  - **金额入环**：顶部 HUD 只留「第 N/M 轮 · 轮到谁」；环内正中自上而下＝金额板（两行：蓝方/红方，
    当前行动方用主题强调色）→ 骰子 → 操作按钮（大富翁）或冲刺道面板（飞行棋）。
  - **弹窗**：用一个 `dlg` 字段驱动，同一时刻只弹一个（结构性避免重叠）：`roll`(掷骰确认) / `buy` /
    `auction` / `debt` / `act`(资产管理，与债务共用行列表) / `card`(机会·命运卡面) / `choose`(飞行棋多机可动) /
    `exit` / `over`。
  - **动画**：逐格前进只改**显示位置** `dispPos`/`disp`，绝不改引擎 `pos`（否则引擎会重复前进）；
    结算后再把显示位置对齐引擎（抽卡可能额外移动）。
- **几何复算（无模拟器，按两页 buildBoard 公式逐档核对 4 屏型 × 4 缩放档 = 16 组）**：
  修掉 3 类真问题 —— ① **矮屏侧边格顶出下排**（REDMI Watch 5 的 228 画布下大富翁溢出 38px、
  飞行棋溢出 76px）：格高加「高度上限」约束 `ch ≤ (ringH−2EDGE−2SIDE)/(SIDE+2)`；
  ② **间距 round 取整把最后一格顶出去**（手环 Pro 溢出 2px）：间距改 `floor`；
  ③ **格内文字装不下**：字号受格高约束，且「装得下才排价格行」（矮屏只显示简称）。
  改后 **16 组全部合格**（侧边溢出 ≤0、文字溢出 ≤0）。环内金额板/骰子/按钮的纵向位置也一并核过，均在环内。
- **校验**：`npm run build` 无 `unsupport` 警告；13 个测试文件 0 失败；5 个审计脚本全绿
  （check-all 的断言已按新特性改写：删 `marquee`/`点中间骰子`/`buyLocked`/`升级`，新增
  `cell-band`/`money-plate`/`home-cell`/`pvp`/`toast`/`加盖`/`拍卖`/`抵押`/`破产`/`reRoll` 等；
  并新增**回归护栏**：两页不得回加跑马灯 `marquee`，不得回加 `ring-mat` 底衬）。
- **产物**：`dist/` 三份（JSC 正式包 / 无 JSC 后备包 / 调试包），备份在本项目外
  `D:\andlua\_yqart_work\out`。
- **真机确认清单（请玩家逐条看）**：
  ① **系统 Toast 能否弹出**（`system.prompt` 的官方背书只到文档级，本项目此前未用过）——
     若完全不弹，需要改成「只用页内提示行」的备选方案；
  ② 40 / 52 格盘面在默认档是否可读（每格仅 15/12px，能看清颜色分组与单字简称）；
  ③ 四周 10px 留白与放大后可拖动的手感；
  ④ 掷骰确认弹窗、机会/命运卡面弹窗、买地/拍卖/债务/资产管理弹窗的流程是否顺手；
  ⑤ 双人热座交接是否清楚（谁的操作、钱是谁的）；
  ⑥ 金额板是否在骰子正上方且不挡格子。

## 阶段自检（修复：真机反馈「骰子显示感叹号」「点开始对局没反应」）

- **症状与根因（都已在包内验证，不是推测）**：
  ① **骰子显示破图感叹号** —— `src/utils/theme.js` 的 `diceImage()` 返回路径后缀写成 **`.jpg`**
     （`PIECES.dice + f + '.jpg'`），而素材实际是 **`dice_0.png`~`dice_6.png`**（PNG，骰面有圆角透明）。
     路径指向不存在的文件 → 真机显示加载失败的占位。**顺带说明：上一轮那版骰子位图其实也没渲染出来**
     （同一个后缀错误），本轮一并修掉。
  ② **点「开始对局」没反应** —— `monopoly.ux` 模板绑的是 `@click="startMatching"`，脚本里定义的却是
     `startMatch()`。框架找不到方法名**静默失败**（无报错、无反应）。飞行棋页绑定名是对的，故只有大富翁页有这个问题。
- **修复**：`theme.js` 的骰面后缀改 `.png`（并在注释里写明「写成 .jpg 真机会破图」）；
  `monopoly.ux` 模板改回 `@click="startMatch"`。
- **新增 3 条审计护栏**（`scripts/check-features.py`，防同类问题再犯）：
  - **护栏 A**：逐页核对「模板里 `@click` 绑定的方法都有定义」—— 覆盖 monopoly / aeroplane / game，
    把编译产物里的 `_vm_.xxx(` / `e.xxx(` 引用与脚本方法定义对账。
  - **护栏 B**：核对包内**每个 `/common/img/…` 完整路径**都能在 rpk 里找到（只匹配带扩展名的完整路径，
    拼接前缀如 `/common/img/dice_` 不算）。
  - **护栏 C**：核对**拼接出来的素材路径**也能对上 —— ① 七张骰面 `dice_0.png`~`dice_6.png` 都在包里；
    ② 编译后的 `diceImage()` 结尾后缀必须是 `.png`（护栏 B 只看得到前缀，抓不到后缀写错）。
- **校验**：`npm run build` 无 `unsupport`；13 个测试文件 0 失败；5 个审计脚本全绿（含新增 3 条护栏）；
  三个包逐一核对：**骰面素材齐备、骰子后缀为 .png、无 `startMatching` 残留**
  （正式包把绑定编译为 `e.startMatch(t)`，调试包为 `_vm_.startMatch(evt)`，两处均已确认）。
- **产物**：`dist/` 三份已重出（JSC 正式 / 无 JSC 后备 / 调试），备份在本项目外 `D:\andlua\_yqart_work\out`。
  注：本轮 AIoT IDE 多次在后台自动构建并清空 `dist/`，故每次出包都同步刷了 `_yqart_work\out` 的备份。

## 阶段自检（按玩家真机反馈改尺寸口径：格子放大 + 状态行移入环内）

- **玩家反馈（附真机截图）**：「你让这个格大点呀，可以超出屏幕；上面那些蓝色文字也放在格的里面，
  差不多就是金钱上面；你这个格小的一点游戏体验都没有。」截图确认了两件事：① 40 格被硬塞进一屏，
  每格仅约 15px；② 顶部那行蓝字（第 N/M 轮 · 轮到谁）**被屏幕顶部裁掉了**。
- **改动 ①：尺寸口径从「迁就视口」改成「格子定盘面」**（两页同改）：
  - 格子基准 **24 设计像素**（大富翁）/ **20**（飞行棋）在 z=1，`ch = cw×1.5`；
  - 环宽 `= 2EDGE + cw×每边`；**环高由格子反推**：`2EDGE + ch×(侧边格数+2) + 间距×(侧边格数+1)`，
    间距 `= ch×0.5` —— 格子变大→盘面自然变大，**不再受视口高度约束**；
  - 于是盘面**故意大于视口**（手环 9 默认档：大富翁环 272×584 vs 视口 192×490），
    靠既有的原生 `scroll` 当摄像机拖动看局部（这正是玩家要的「可以超出屏幕」）。
  - 缩放档改为 **0.7（看全局）/ 1（默认）/ 1.3 / 1.7（看细节）**，默认档 = 1。
  - 格内文字：字号随格宽（默认档 10px，原来只有 7px）；**完整地名按「字数×字号 ≤ 格宽−4」判断**，
    装不下才退回 1 字简称 —— 手环 9 默认档已能显示完整地名（拉萨/银川/兰州…），
    大屏方表（uiS=0.8）与 0.7 档位仍用简称。
  - **进入对局自动把摄像机对准盘面中心**（`centerScene()`，延时 80ms 调，避免元素尚未渲染导致
    `scrollTo` 静默失败）—— 状态行/金额板/骰子都在正中，开局就能看见。
- **改动 ②：顶部那行蓝字搬进环内**：删掉页面顶部的 `.hud` 浮层（它是被裁掉的元凶），
  改成环内的 `.ring-status` 文本行，位置在**金额板正上方**（`statusY = stackTop`、
  `moneyY = statusY + statusH + 6`），随棋盘一起滚动；环内竖排次序为
  **状态行 → 金额板 → 骰子 → 操作按钮**（大富翁）/ **状态行 → 金额板 → 冲刺道两行 → 骰子**（飞行棋）。
- **几何复算（4 屏型 × 4 缩放档 = 16 组，项目外脚本）**：侧边格溢出、格内文字溢出、环内竖排
  （状态行+金额板+骰子+按钮）溢出**全部 ≤ 0**；16 组盘面全部「超出屏幕」或与视口等宽。
  唯一被标「简称」的档位是 0.7 与方表默认档 —— 那是**设计内的回退**，不是缺陷。
- **前两轮的修复也在本轮复核过**：三包里 `diceImage()` 后缀均为 `.png`、无 `startMatching` 残留
  （正式包编译为 `e.startMatch(t)`，调试包 `_vm_.startMatch(evt)`），环内状态行 `ring-status` 在包内可查。
- **校验**：`npm run build` 无 `unsupport`；13 个测试文件 0 失败；5 个审计脚本全绿
  （check-all 的两页断言已补 `ring-status`）。

## 阶段自检（按玩家真机反馈 + 参考设计：图片全 PNG、格数精简、盘面铺满屏幕）

- **玩家三条要求与参考图**：① 图片全部改 PNG；② 两棋「格数太多、要无损减小」；
  ③ 「占满整个屏幕，不超出屏幕，但给外面加点范围，可以滑动看 4 个角显示不全的」。
  玩家给的参考图（手表端大富翁，第三方作品）要点：**20 格**（每边 6 格含角）→ 每格约屏宽 1/6、
  名字与价格清楚；地产格＝浅底 + 顶部色带 + 地名 + 价格；特殊格＝整块色底 + 白字（机会/命运/监狱/起点）；
  盘面**铺满屏幕**、四角被屏幕圆角切掉、靠滑动看；正中自上而下＝**玩家资金两行 → 骰子 → 操作按钮**。
- **改动 ①：素材全部转 PNG**（`theme.js` 路径同步改）：`bg_dark/bg_light`（384×980）与
  `board_dark/board_light`（缩到 256×256）由 JPEG 转 **256 色量化 PNG**；
  素材从 28 个文件 362 KB 变成 32 个文件 576 KB（体量换格式，可按需再调量化档位）。
  旧 `.jpg` 已删除，check-all 的素材路径断言同步改成 `.png`。
- **改动 ②：格数精简（机制零损失）**：
  - 大富翁 **40 → 24 格**（每边 7 格含角）：12 块地产（**6 色组 × 2**）+ 4 铁路 + 2 公用事业
    + 起点 / 监狱 / 入狱 / 所得税 / 机会 / 命运。**保留**：成套租金加倍、成套才可建房、均匀建造、
    抵押与 10% 利息赎回、放弃购买即拍卖、债务筹钱、破产清算、双骰/三连双入狱、铁路按条数收租、
    公用事业按骰子倍数收租。**去掉**：免费停车（本身无事发生）、奢侈税、各 2 张机会/命运、10 块地产。
    价格与租金仍逐项取自官方标准盘对应价位（60~400）。
  - 飞行棋 **52 → 28 格**（每边 8 格含角）：四色区各 7 格、四角为起飞点、航线格取各区中位（环 3/10/17/24）、
    冲刺道仍 6 格 → `FINISH = 34`；`MAX_ROUNDS` 60 → 40。**机制全保留**（4 机、掷 6 起飞、撞机回库、
    航线前跳 4、精确点数到家），只是航程变短、节奏更快。
  - 卡片上的「前往 X」坐标已按新盘面重算（上海 22 / 济南 16 / 武汉 6 / 陇海铁路 4）。
  - 测试同步重写：`tests/rules-monopoly.js` 108 断言、`tests/rules-aeroplane.js` 51 断言，全套 13 文件 0 失败。
- **改动 ③：几何口径换成「环体贴满屏幕 + 四周可拖余量」**（两页同改）：
  - `PAD = 2`（环体距屏幕仅 2px，即「占满屏幕」）、`SLACK = 26`（场景比环体四周各多 26px）；
  - **环高贴视口**（`ringH = pageH − 2PAD`，再乘缩放档），格高受高度上限约束、格宽由格高反推
    （保持 1:1.5 比例）；**环宽由格数反推** —— 于是默认档 大富翁环 190×486 / 飞行棋 184×486，
    正好落在 192×490 的视口内（格 26×39 / 22×33，是原来 15×23 的 2.9 倍面积），
    而**场景比视口大 50×48**，靠拖动就能把被屏幕圆角切掉的四个角拖进可视区（正是玩家要的效果）；
  - 放大档（1.3 / 1.7×）盘面才超出视口 → 可拖到任意位置；0.7 档是「看全局」档。
  - 进入对局仍自动 `centerScene()`：把镜头对准盘面中心（状态行/金额板/骰子都在正中）。
  - 环内竖排各块的尺寸改为**按「环内可用高度」缩放并设下限** —— 矮屏/缩小档下环体很扁，
    固定尺寸的竖排会顶穿上下两排格子（实测 REDMI Watch 5 的 228 画布会溢 55px）；
    侧边格间距同时改成 `max(0, floor(...))`，避免把最后一格顶出下排。
  - **几何复算 4 屏型 × 4 缩放档 = 16 组全部合格**（侧边溢出 / 文字溢出 / 环内竖排溢出全部 ≤ 0）。
- **改动 ④：格样式对齐参考设计**：地产格＝浅底（#F2EFE9）+ 顶部色带（占格高 1/4，原来只有 3px 看不出分组）
  + 深色地名 + 灰色价格；特殊格＝整块色底 + 白字（起点琥珀、监狱灰紫、入狱深灰、机会/命运粉红、
  铁路钢色、公用事业蓝灰、所得税浅紫）；房/旅馆仍用格底小色块（绿房 / 红旅馆）。
- **校验**：`npm run build` 无 `unsupport`；13 个测试文件 0 失败；5 个审计脚本全绿；
  三包重出（JSC 正式 / 无 JSC 后备 / 调试），备份在本项目外 `D:\andlua\_yqart_work\out`。
- **仍未做的（等玩家拍板）**：参考图是 20 格（12 块地、无铁路/公用事业/税），本轮为「保机制」取 24 格；
  若玩家要严格照参考图的 20 格，需再砍掉 4 条铁路或 2 家公用事业。

## 阶段自检（第四轮：图片全 PNG、正方形格 + 格间留缝 + 贴屏幕、大富翁改单骰）

- **玩家四条反馈**：① 图片全部用 PNG；② 每一格之间应该有间距；③ 格子没贴着屏幕、太靠里面了；
  ④ 格子不是长方形、要正方形；⑤ 一个骰子轮流投。
- **改动 ①（PNG）**：4 张 JPEG 全部转 PNG（`bg_dark/bg_light` 384×980、`board_dark/board_light` 缩到 256×256，
  统一 256 色量化控制体积）。旧 `.jpg` 删除，`theme.js` 与 check-all 断言同步改 `.png`。
  三包核对：**28 张素材全 PNG、包内 `.jpg` 出现 0 次**。
- **改动 ②③④（几何再一次改口径）**：
  - **格宽由屏幕宽度反推、且不再乘 `uiS`**（乘了 uiS 会让大屏方表上的盘面缩进去 —— 正是玩家说的「太靠里面」）。
    默认档：大富翁格 23×23、环 187×486（距屏幕边 5px）；飞行棋格 19×19、环 181×486。
  - **格子正方形**（`ch = cw`），**格间留 `GAP = 3` 的缝**；侧边 5（大富翁）/ 6（飞行棋）格摊满整屏高，
    缝单独算（`vGap = floor((D − SIDE×ch) / (SIDE+1))`，≥ GAP），故侧边缝必然大于横向缝（几何必然）。
  - 格内改为「色带 4px + 地名 + 价格」三行（行高贴字高 `fs+1`），正方形小格里刚好排得下。
  - **几何复算 4 屏型 × 4 缩放档 = 16 组全部合格**（侧边溢出 / 格内文字溢出 / 环内竖排溢出全 ≤ 0）。
- **改动 ⑤（单骰）**：大富翁由双骰改为**一颗骰子轮流投**（与飞行棋一致，也对齐参考设计）。
  规则层随之调整：**取消「双骰再掷」与「三连双入狱」**，监狱改为**掷出 6 出狱**、连续三次没掷出 6 则缴 $50 后行动。
  `rollDice()` 返回单值 1~6；页面只渲染一颗骰子（`diceImgB`/`diceX2` 已删）。
  测试同步重写（大富翁 106 断言，含新增「单骰规则」小节）；13 个测试文件 0 失败；5 个审计脚本全绿。
- **校验**：build 无 `unsupport`；三包重出（JSC 724 KB / 无 JSC 698 KB / 调试 741 KB），
  备份在项目外 `D:\andlua\_yqart_work\out`。

## 阶段自检（第五轮：骰子投掷动画 + 按 UICraft 规范补动效层）

- **玩家要求**：给骰子加动画；并指定用 web-app-development 插件的 UICraft 技能优化 UI 设计。
- **先做平台核实（沿用本工程「写代码前查官方文档」的硬规矩）**：用 Context7 查 Vela 官方
  animation-style 文档 → 确认支持 `transform` / `@keyframes` / `transition`，且 `@keyframes` 内
  可用 background-color、opacity、width/height、transform（0% 与 100% 必须都写）。
  构建后再验证：编译器把 `@keyframes` 转成 **Vela 原生关键帧 JSON**
  （`"keyframes":"[{\"time\":0,\"opacity\":0,\"transform\":{\"scaleX\":0.94,\"scaleY\":0.94}}…]"`），
  三包均含 → 动画确实生效（不是被静默丢弃）。
- **骰子投掷动画**（两页同改）：
  - 点「投骰子」确认后：**抖 7 拍**（85ms/拍，每拍随机骰面 + `diceX/diceY` ±2px、`diceW` ±1~3px 微抖）
    → **定格**（真实点数 + 尺寸过冲 14%、110ms 回正）→ 才开始逐格前进 → 再由引擎结算。
  - 抖动只用「已绑定的坐标/尺寸」（本工程真机验证过的写法），**不引入未验证的动态 class 绑定**；
    buildBoard 里存 `diceX0/diceY0/diceW0` 作基准，动画结束由 buildBoard 复位。
  - 飞行棋原来只有 120ms 的「滚动」等待，现统一为同一套投掷动画。
  - 顺带修掉旧问题：逐格前进期间本来还会乱换骰面（会把已定格的点数冲掉），现已移除。
- **UICraft 动效层（弹窗/抽屉/面板 + 两处反馈）**：
  - 入场：`.modal` 淡入+微放大（240ms）、`.modal-title` 弹跳（320ms）、`.drawer` 上滑（260ms）、
    `.resume/.matching/.setup` 上滑淡入（300ms）；**一律挂静态 class**（元素挂载即播放）。
  - 反馈：**落点格闪一下**（240ms，描边换成主题 primary）；**棋子/飞机隔步一跳**（该枚尺寸 +2px，
    由 `hop/hopPlayer(/hopPlane)` 逐拍切换，落定归零）。
  - 规范取舍：只动 `transform`/`opacity`（GPU 友好）、时长 240~320ms、不用 bounce/elastic 默认曲线；
    不新增阴影/渐变（保护 MD3 对比度审计）；**几何一律未动**（保住上一轮真机验证过的布局）。
  - ⚠️ UICraft 要求提供 `prefers-reduced-motion` 降级路径，但 **Vela 没有该媒体查询**；
    本工程也尚无「动画开关」设置项 —— 已在交付里向玩家说明，等其决定是否加。
- **校验**：build 无 `unsupport`；13 个测试文件 0 失败；5 个审计脚本全绿；
  三包重出（JSC 726 KB / 无 JSC 699 KB / 调试 742 KB）并核对动画层与骰子动画字段均在包内。

## 阶段自检（第六轮：按开源项目调研做性能优化 + 新增 2048）

- **玩家要求**：看了 7 个 GitHub 上的 Vela 快应用仓库（the-walker / Open-Modular-Boardgame-Companion /
  Sanoba-Witch-MiBand-9Pro / poem / 2048N / bandcomic / Number-Sliding-Puzzle），要
  ① 找性能优化的例子并优化本项目；② 找好玩的游戏加进来。并说「这些并不是全部的，还可以去 GitHub 上找其他 Vela 快应用」。
- **调研**（并行子代理，带 Vela API 白名单）：
  - **性能手法（与本工程相关的）**：列表**不用 for 循环渲染**（该平台循环模板 + 动态索引会漏刷且重建开销大）；
    只更新「真的变了」的字段；样式静态化（能写进 CSS 的不要每拍内联）；存档/落盘做防抖与写合并；
    定时器集中清理 + 节流；canvas 命令式重绘优于大量节点；AI 逐帧搜索按时间分片（每 tick ≤ 10~12ms）；
    图片降精度 / 图集化。
  - **游戏候选排序**：2048 → 数字华容道（滑块）→ 扫雷 → 记忆翻牌 → 推箱子 → 贪吃蛇 → 俄罗斯方块。
- **本轮落地 ①：性能**
  - **渲染不再全量重建**：大富翁 / 飞行棋的逐格前进动画原先每 90ms 重建整盘（24 格 × 12 字段）→
    拆成 `layoutBoard()`（几何 + 静态格，只在开局/重开/落定时跑）与 `syncTokens()`（每拍只重建 2 枚棋子，
    读缓存的 `geoCw/geoCh/cellPos`）；落点闪示仍走 `layoutBoard()`。
  - **背景纹样降采样**：384×980 → 192×490（解码内存 1.5MB → 0.38MB），体积 63KB → 27KB / 55KB → 26KB，
    统一 256 色量化 PNG。
  - **定时器自持**：2048 页把延时统一进 `timers` 数组，`onHide/onDestroy` 清空，不留裸 `setTimeout`。
- **本轮落地 ②：新游戏 2048（单人拼图）**
  - 新增 `src/rules/g2048.js`（纯函数引擎，随机数可注入）、`tests/rules-g2048.js`（79 断言）、
    `src/pages/g2048/g2048.ux`、`src/pages/g2048/g2048.css`。
  - 渲染口径：**16 个格子写死为 `k0…k15` 各自绑定**（不用 for）；逐格比对「值没变就不写」；
    只给本步真的变大/合并的格做尺寸微脉冲（130ms）；达成 2048 弹「继续玩」、无路可推弹「再来一局 / 返回」。
  - 输入口径：**四个方向键按钮**（`input type="button"`）——不自绘 swipe（自绘触摸会吞系统侧滑返回）。
  - 接线：`manifest.json` 注册 `pages/g2048`（**这一步不做则 `aiot build` 根本不编译该页**）、
    `config.js` 的 `GAME_TYPES` 增一条（id/name/icon/intro/short/sizes/page）、`tests/run.js` 纳入新测试、
    `smoke.js` 计数与白名单同步（棋种 10 个 / 可用 9 个 / 独立玩法的免注册表名单加入 g2048）。
  - 图标：AI 生成后经 PIL 定位徽标外框 → 缩到 96×96 → 按实测半径 24 挖透明圆角 → 256 色量化
    （与既有 10 个图标同规格：满铺画布、四角透明、约 10KB）。
- **顺带修掉的陈旧文案**：`config.js` 里大富翁 `intro` 仍写着「掷双骰前进，双骰可再掷、三连双入狱」——
  上一轮已改单骰，帮助页显示的是旧规则，已改为「单骰轮流投掷（监狱掷出 6 才能出狱，连续三次未掷出则缴罚金后行动）」。
- **2048 多屏复算**（本工程无模拟器，用 layout 公式对 4 屏型 + 2 个压力值复算）：
  手环9（490）格 41 / 手环10（355）格 38 / 大屏方表（228，uiScale .8）格 30 / 方屏（274）格 41；
  压力值 200 格 23、180 格 18，**控制区下沿与右沿全部不溢出**（180 时四位数字偏挤，属极端值）。
  过程发现：矮画布下十字方向键要占竖向约 100px，会把棋盘挤到格宽 11px（数字被 `overflow:hidden` 裁掉）→
  改为「方向键一行 + 整条新局」只占约 50px，格宽回到 23~41px。
- **校验**：`npm run build` 无 `unsupport`（g2048 页已真正编译进包，且该页 0 条 lint 警告）；
  `npm test` **14 个测试文件 0 失败**（新增 g2048 79 断言）；5 个审计脚本全绿
  （check-all / check-features 已加入 g2048 的页面特性、模板绑定方法、素材路径三处护栏）。
- **待玩家拍板**：① 第二个游戏加哪个（候选见上，AI 建议数字华容道）；② 是否要加「界面动画」开关
  （Vela 无 `prefers-reduced-motion`）；③ 2048 手感（方向键大小/位置、像素脉冲幅度）。

## 阶段自检（第七轮：第二个新玩法「数字华容道」）

- **玩家拍板**：在候选清单（2048 / 数字华容道 / 扫雷 / 记忆翻牌 / 推箱子 / 贪吃蛇 / 俄罗斯方块）里选了**数字华容道**。
- **新增文件**：`src/rules/slide.js`（纯函数引擎）、`tests/rules-slide.js`（55 断言）、
  `src/pages/slide/slide.ux`、`src/pages/slide/slide.css`、`src/common/img/ic_slide.png`。
- **规则口径**：
  - 状态 `{ size, tiles, blank, moves, solved }`；`tiles` 一维数组、0 = 空位、索引 = 行×3 + 列。
  - **移动**：只能点「与空位同行或同列且紧邻」的块；点空位、点不相邻的块都返回 `moved=false`（不动盘面、不计步数）。
  - **洗牌（关键）**：**从已完成局面出发随机走 240 步合法移动**，不是随机排列 ——
    随机排列要先按逆序数奇偶判可解性、且有一半概率死局；走合法步**必然可解**。
    每步不走上一步的反向（避免原地来回），若恰好走回完成态则补走一步。
    测试里对 40 次洗牌全部核对「合法排列 + 逆序数为偶（3×3 可解）+ 未完成」。
  - 支持 3×3 / 4×4（页面只用 3×3，格子大才好点；4×4 已测结构正确）。
- **页面口径**（沿用 g2048 页与两棋盘页已验证的写法，不引入任何未验证写法）：
  - **9 个块写死为 `k0…k8`** 各自绑定字段，不用 for 循环；逐格比对「值没变就不写」；挪动后只给落进空位的那一块做 130ms 尺寸微脉冲。
  - **点击热区是 `<div>`**（本工程真机验证过的写法），数字用其中的 `<text>` 渲染 —— 不把 click 直接压在 `<text>` 上。
  - 不自绘 swipe/drag（会吞系统侧滑返回）；**可挪的块描边用主题 `primary` 标出**，省得玩家猜哪块能动。
  - 9 个格各自一个零参方法（`tap0…tap8` → `onTap(i)`）：模板不传参，只绑本平台验证过的零参方法。
  - 顶部：返回 / 步数 / 最少步数；底部一条与棋盘等宽的「洗牌重开」；通关弹「拼好了」+ 再来一局 / 返回。
  - 配色全部走主题（棋盘底 `boardBg`、空位 `surfaceContainer`、块面 `surfaceContainerHigh`、文字 `onSurface`、描边 `outline`/`primary`），
    深浅两模式与三套配色都保持 MD3 配对的对比度。
- **接线**（六处，缺一不可）：manifest 注册 `pages/slide`、`config.js` 加棋种条目、`tests/run.js` 纳入新测试、
  `smoke.js` 计数与免注册表白名单（棋种 11 / 可用 10 / 独立玩法含 slide）、`check-all.py` 加页面特性断言与主界面文案断言、
  `check-features.py` 的「模板方法齐全 + 素材路径存在」两个护栏纳入 slide。
- **图标**：AI 生成（3×3 色块 + 右下凹槽空位）后经 PIL 定位徽标外框 → 96×96 → 按实测半径 24 挖透明圆角 → 256 色量化（12.5 KB）。
- **多屏复算**（4 屏型 + 2 个压力值）：格宽 56 / 56 / 56 / 50 / 40 / 34 px，字号 26~16px，
  重开按钮下沿 377 / 310 / 254 / 222 / 193 / 174（画布高 490 / 355 / 274 / 228 / 200 / 180），**无溢出**。
- **校验**：`npm run build` 无 `unsupport`；`npm test` **15 个测试文件 0 失败**（新增 55 断言）；5 个审计脚本全绿；
  `pages/slide/slide.js` 与 `common/img/ic_slide.png` 已确认进包。
- **踩到的坑（已修）**：`slide.ux` 的两条异步初始化路径（读布局 / 读设置）都会写格子数据，
  若「读设置」先返回而布局还没算，`writeTile` 会拿空几何写坐标 → 加 `gx` 就绪判断，
  布局完成后再统一 `applyTheme()` 写一次。
- **待玩家拍板**：① 2048 与华容道的手感（方向键/块的尺寸、脉冲幅度）；② 是否要加「界面动画」开关
  （Vela 无 `prefers-reduced-motion`）；③ 是否继续加第三个玩法（下一候选：扫雷）。

## 阶段自检（第八轮：修复「部分胶囊屏玩家进对局后返回不了」）

- **玩家报障**：有的玩家在胶囊屏（跑道屏）进入对局后**返回不了**。
- **定位（静态分析 + 官方文档）**：
  - 官方 lifecycle 文档：`onBackPress` 由**用户行为触发**（侧滑返回 / 返回键），返回 `true` 表示自行处理，否则走系统默认返回。
    → 也就是说，**设备若根本不派发返回事件，页面里就没有任何东西会被触发**。
  - 三个对局页（`game` / `monopoly` / `aeroplane`）对局中**原本没有任何可见的退出入口**：
    出口 100% 依赖 `onBackPress` 呼出抽屉，抽屉里才有「退出对局」（早期决策「对局中不设返回按钮」，为了棋盘让位）。
  - 对照：`g2048` / `slide` 两页顶栏有常显「返回」按钮，因此不受影响 —— 与「只有部分胶囊屏玩家出不来」的现象一致。
- **修复口径（不动棋盘、不动已真机验证的几何）**：三个对局页各加一个**常显「菜单」按钮**，
  点击走与侧滑返回**完全相同**的路径（`openMenu()` → 控制抽屉 → 退出对局 → 三选离开弹窗）：
  - `game.ux`：放进顶部浮层 `.status-pill` 里（回合胶囊左侧，同为 20px 高）—— 该行本来就是浮层，不占棋盘；
    胶囊屏上棋盘是纵向居中的（`boardY = max(centered, PILL_CLEAR=17)`，实测居中值远大于 17），按钮不会压到棋盘。
  - `monopoly.ux` / `aeroplane.ux`：放在**环内骰子左侧的空档**里（环内正中竖排的骰子那一行两侧有富余宽度）。
    ⚠️ 尺寸必须按「骰子行两侧的横向空档」收敛（`menuBtnW = clamp(slackSide − 7, 20, 34)`）：
    缩小档（0.7）环内只剩 ≈30px 空档，写死尺寸会压到左侧格子列（与上一轮「格宽不乘 uiS」同一类几何教训）。
  - **只在非方屏显示**：`@media screen and (shape: rect) { .menu-fab { display: none } }`
    （方屏有返回键/手势，且棋类页顶部让位只有 17px，塞不下第二个浮层件）。默认显示、只对 rect 隐藏 ——
    这样「圆形 / 其它非 rect 屏」也一并兜住，并且只用到本工程已验证的 `display:none` 写法。
- **几何复算**（无模拟器时的取证口径）：2 页 × 5 屏型（490 / 355 / 274 / 228 / 300）× 4 缩放档（0.7 / 1 / 1.3 / 1.7）= **40 组全部合格**：
  按钮完全落在环内空档（不压格子、不出骰子行、不压金额板与操作按钮），缩小档下按钮 22~23px、字号 10 仍能放下「菜单」两字。
- **校验**：`npm run build` 无 `unsupport`；`npm test` 15 个测试文件 0 失败；5 个审计脚本全绿
  （`check-all.py` 新增三页的 `menu-fab` / `openMenu` 断言）；编译产物核对：三页都含 `.menu-fab` 基础规则、
  `screen and (shape:rect)` 下的 `display:"none"`、以及模板里的 `value:"菜单"`。
- **如实记录的未验证项**：报障机型不在手上，**未做真机复现**；根因按「设备不派发返回事件」推断
  （也可能是胶囊屏上 `<scroll scroll-x>` 吞掉了边缘侧滑）。但无论哪一种，**常显按钮都不依赖手势**，
  因此都能给出出口 —— 这也是本轮选择「加可见入口」而不是「改手势判定」的原因（自绘手势会重新引入被否的写法）。
- **待真机确认**：胶囊屏能看到「菜单」按钮 → 点开抽屉 → 「退出对局」→「回到主页」闭环可走；方屏上该按钮不出现。

## 阶段自检（第九轮：胶囊屏「安全区」——顶部元素被屏幕半圆切掉）

- **玩家反馈（附真机截图）**：上一轮加的「菜单」按钮「太靠上了，都超出屏幕了，增加保护区」。
- **像素取证（对玩家截图的定量分析）**：截图是 212×520 物理像素的胶囊屏（设计画布 ≈ 212/1.104 = **192×471**）。
  按行扫描「近黑（机身/边框）」与「页面/元素色」的分界，得到屏幕可见区的左边界随高度的变化：
  y=0 → x≈83、y=3.6 → 69、y=7.2 → 58、y=14.5 → 43.5、y=21.8 → 32.6、y=27 → 29、y=50 → 14.5、y=63 → 7。
  拟合出 **`xmin(y) = R − √(R² − (R − y)²)`，R ≈ 93.5**（即短边是半圆，半径 ≈ 屏宽/2 = 96）——
  这就是「跑道屏/胶囊屏」的固有形状：**越靠屏幕左右两端，可见高度越低**。
  故按 `top:4px` 摆的顶部浮层（宽 138、居中 → 左沿 x=27）整行都落在圆弧外 → 被切掉（与截图一致）。
- **修复口径（按元素最左沿反解安全值，分屏型应用）**：
  - **棋类对局页**：顶部浮层（菜单按钮 + 回合胶囊）在胶囊屏 `top: 4px → 30px`（`xmin(y)=27` 反解得 y≥29.3）；
    棋盘让位量随之 17 → **44**（新增 `PILL_CLEAR_CAPSULE`，`pillScreen` 决定用哪一个）。方屏保持 `top:4px`（矩形屏不适用半圆口径）。
  - **2048 / 数字华容道**：顶栏最左件是「返回」（左沿 x=8），`top: 2/4px → 58px`（反解得 y≥57.6）。
  - **顺带对齐矮画布阈值**：2048 的 `compact` 从 `pageH<340` 改成 `pageH<400`（与 `utils/screen.js` 的 `compact` 口径一致）——
    抬顶栏后 340~400 这一段若仍用十字键（竖向 ≈130px），棋盘会被挤到格宽 25px；复算改为矮排法后回到 41px。
- **复算（离线脚本，含玩家机型 471）**：① 安全区反解：浮层 27→需 29.3（取 30 ✓）、顶栏 8→需 57.6（取 58 ✓）；
  ② 竖向：胶囊 471/490/355 的 2048 格宽均为 41、华容道 56；胶囊 300 为 34 / 55；控制区下沿全部不溢出；
  ③ 棋类页棋盘让位：浮层底边 50 + 3 ≤ 棋盘 44 + 盘内首行 9 = 53 ✓（整盘居中时棋盘顶 ≈109，远在浮层下）。
- **另一项取证（本次不改）**：大富翁 / 飞行棋的**底部抽屉**在胶囊屏两端也会丢圆角（其内容位于屏幕竖直中部以下、
  宽度 168 → 两端进弧），但**标签居中、可点**，功能不受影响；本轮按最小改动不做抬升，已记录在 README 供日后决定。
- **校验**：`npm run build` 无 `unsupport`；`npm test` 15 个测试文件 0 失败；5 个审计脚本全绿
  （`check-all.py` 新增 `PILL_CLEAR_CAPSULE`/`pillScreen`/`isPill` 断言）；编译产物核对：
  game 页含 `PILL_CLEAR_CAPSULE`、`pillScreen`、`shape:pill-shaped` 条件下的 `top:"30px"`；
  g2048 / slide 页均含 `this.isPill ? 58 : …`；三包重出（JSC 718 KB / 无 JSC 685 KB / 调试 738 KB）。
- **待真机确认**：胶囊屏上进棋类对局，顶部「菜单 + 回合胶囊」整行完整可见（不再被切）；2048 / 华容道顶栏
  「返回 / 步数 / 最少」整行可见；方屏上一切照旧（浮层仍在顶部 4px、菜单按钮不显示）。

## 阶段自检（第十轮：胶囊屏「整宽单列」补漏 + 2048 / 华容道加档位）

- **玩家反馈**：「别忘胶囊屏需要搞成单列。双列的话按钮太小了，用户点不到。」
- **定位（先查清是哪一处，避免瞎改）**：全项目扫 `flex-wrap` 与媒体查询，结果：
  - 主界面（index）的**双列卡片只在 `(shape: rect)` 下生效**，胶囊屏本来就是单列 —— 不是这里；
  - 棋类对局页（game）的设置面板在 pill 媒体查询里早已是「整宽单列」；
  - **大富翁的 pill 媒体查询只改了 `.hud`，飞行棋此前完全没有 pill 媒体查询** → 两页的
    `.chips`（人机对战 / 双人对战）在胶囊屏上仍是 `flex-direction: row; flex-wrap: wrap`，
    两枚并排 ≈ 各 68px 宽 → 与棋类页（整宽 168px）对比就是「点不到」。
- **修复**：`monopoly.css` / `aeroplane.css` 在 pill 媒体查询里补 `.chips{width:168px;flex-direction:column;align-items:center}` +
  `.chip{width:168px;padding:0;margin-left:0;margin-right:0}`（与 game.css 同口径）；
  `aeroplane.css` 是**新增** pill 媒体查询。审计加 `shape:pill-shaped` 断言，兜住「pill 媒体查询被误删」。
- **玩家拍板的扩展范围**：只做「尺寸档位 + 各档独立纪录」（撤销 / 计时 / 战绩纳入等本轮不做）。
- **2048 加 3×3 简单档**：
  - 引擎 `rules/g2048.js` **参数化**：`create(size, rand)` 支持 3 / 4（第一参不是数字 → 当作随机源，故
    `create()` / `create([0,0])` 等旧调用完全不变）；`SIZE / CELLS / WIN_TILE` 随档位；
    **达成线按档位**：4×4 = 2048、3×3 = 256（3×3 满盘只有 9 格，理论到不了 2048）。
  - 测试新增「3×3 档位」小节（+23 断言，总 102）：3 行合并口径、达成线 256、满盘终局、脏入参兜底、
    默认与兜底档位（`create(5)` / `create(2.5)` / `create()` → 4×4）。
  - 页面：16 个固定格节点保留，**3×3 档时 k9~k15 用 `if="{{size === 4}}"` 整块不渲染**
    （0 尺寸 div 仍会画出 1px 描边，不能靠「缩到 0」隐藏）；格子几何、脉冲、循环边界全部按 `n×n` 走。
  - 档位入口：与「新局」并排的一枚按钮（上面显示当前档，如 `4×4`），两枚各 ≈47~52px 宽；
    正在进行的这局（有分）先弹「切到 3×3？当前这局会重开」确认，空局直接切；选择存 `g2048_size`。
  - **各档独立最高分**：4×4 沿用旧键 `g2048_best`（不迁移）、3×3 用 `g2048_best_3`；达成弹窗标题改成
    「达成 {{winTile}}」（跟着档位走）。
- **数字华容道加 4×4**：
  - 引擎本就支持 3 / 4，页面原先写死 9 格：新增 `k9~k15` 七个块（同样 `if="{{size === 4}}"` 控制）+
    `tap9~tap15` 七个零参方法；几何、`syncTiles` 边界按 `n×n` 走。
  - 档位入口：底部一行拆成「洗牌重开 + 档位」两枚（各 ≈86px 宽，都比原先整宽按钮更好点）；
    已挪过步数先弹确认；选择存 `slide_size`；**各档独立最少步数**：3×3 用 `slide_best`（不迁移）、
    4×4 用 `slide_best_4`。
- **几何复算**（无模拟器口径）：2 页 × 6 屏型（胶囊 471/490/355/300、方屏 274、大屏方表 228）× 2 档 = **12 组全部合格**：
  下沿不溢出、横向不出界、格宽 30~56px（大屏方表 4×4 最小 30）、「新局/洗牌重开」与「档位」按钮宽度 ≥34px。
- **踩到的坑（已修）**：g2048 的 `layout()` 里 `var btn` 在上一轮「顶部安全区」改动中被误删
  （构建只报 `'btn' is not defined` 的橙色告警、**仍然 build success**，但几何会算出 NaN）——
  本轮重建时补回；这也说明「构建成功」不等于代码正确，必须看告警。
- **校验**：`npm run build` 无 `unsupport`（该页 0 条告警）；`npm test` 15 个文件 0 失败（g2048 102 断言）；
  5 个审计全绿（check-all 新增档位/尺寸按钮/pill 媒体查询断言；`达成 2048` 断言随文案改成 `达成 `）。

## 阶段自检（第十一轮：新增第 11 个玩法「扫雷」——参考开源项目重写）

- **玩家要求**：加扫雷，给了参考开源项目 `https://github.com/tianry-mitan/minesweeper-vela`。
- **参考仓库（用 GitHub 插件读源码）**：那是**单文件实现**（`src/pages/index/index.ux`，约 23KB；`detail/detail.ux` 仅 352 字节，
  无有效内容；README 就是 Vela 模板自带的那份，无文档）。子代理读后**采纳**：首点后布雷（首点安全）、栈式连锁展开、
  「模式切换 + 长按标记」双路径、四角/边缘邻雷计数口径；**否决**：466px 单文件巨型模板（本工程页/规则分层）、
  `$idx` 取格号的写法、⚑●♥✓ 之类生僻符号（手表字体可能缺字）、限时/生命/盲扫等超需模式、裸 `setInterval` 计时。
- **新增文件**：`src/rules/minesweeper.js`（纯函数引擎，96 断言）、`tests/rules-minesweeper.js`、
  `src/pages/minesweeper/minesweeper.ux`、`src/pages/minesweeper/minesweeper.css`、`src/common/img/ic_minesweeper.png`。
- **规则口径**：首点必安全（`newGame` 先接受首点 → 布雷时排除首点及其 8 邻域）；翻开 0 邻域格时把 8 邻域未开格压栈
  （0 邻域续连锁、非 0 只开自身、旗子/越界停住）；踩雷判负、开满非雷格判胜；随机数可注入；所有入参兜底。
- **⚠️ 我对子代理产出的两处「降险改写」（本工程纪律：只用真机验证过的写法）**：
  1. 子代理原本用 `@click="tap($item.i)"`（把 `$item` 当**事件参数**传给方法）——本工程从未验证过这种写法（历史上框架找不到方法会**静默失败**）。
     我改成**「棋盘热区 + 几何反推」**：棋盘上盖一层透明 `.tap-layer`（`id="board"`）接 `@click`，
     用事件自带 `offsetX/offsetY`（官方定义「距触发对象左边沿的距离」，与滚动无关）乘 `getBoundingClientRect`
     实测的换算系数得到棋盘内坐标 → 格号；**格本身不绑任何事件**（与 game.ux 同一套口径，本工程真机验证过）。
     点缝里 / 点棋盘外 / 取不到系数一律判无效（只给一次弱震动），**绝不猜格号**。
  2. 子代理还用了 `@longpress`（官方 general events 列表里有，但本工程无真机先例）。我**去掉长按**，
     操作只留底部「点开 / 插旗」模式键一条路径 —— 未验证的输入路径宁可不要，也不留「可能误标一格」的风险。
- **接线（六处）**：manifest 注册 `pages/minesweeper`、`config.js` 加棋种条目（图标 `ic_minesweeper.png`）、
  `tests/run.js` 纳入、`smoke.js` 计数改「棋种 12 / 可用 11」并入独立玩法白名单、
  `check-all.py` 加页面与主界面断言（含 `tap-layer`/`onBoardTap`/`hitCell`）、`check-features.py` 两个护栏纳入该页。
- **图标**：AI 生成（靛蓝徽标 + 金边 + 4×3 格盘 + 翻开的空槽 + 黑色水雷与小红旗）→ 经 PIL 定位徽标外框 → 缩到 96×96
  → 半径 24 挖透明圆角 → 256 色量化（11.7 KB，与既有 12 个图标同规格）。
- **档位与纪录**：默认 6×6/6 雷；第二档**由 8×8/10 雷降为 7×7/10 雷** —— 因为「8×8 + 3px 缝 + 格宽 ≥22」
  在 192 设计宽下**数学上不可行**（8×22 + 7×3 = 197 > 176）；7×7 恰好 172 ≤ 176（格宽 = 下限 22）。
  用时纪录按档各存一份（`minesweeper_best_<size>`）。
- **几何复算**（2 档 × 6 屏型 = 12 组全合格）：胶囊 471/490/355 格宽 26（6×6）/ 22（7×7）、两行底栏；
  胶囊 300、方屏 274、大屏方表 228 自动退到「单行三键」底栏；格宽 19~26px、下沿均不溢出、档位键宽 36~84px。
- **校验**：`npm run build` 无 `unsupport`（该页 0 告警）；`npm test` **16 个文件 0 失败**（扫雷 96 断言，总 600 断言）；
  5 个审计全绿；拆包核对：`pages/minesweeper/minesweeper.js`、`ic_minesweeper.png` 均进包，
  且编译产物里 **不再含** `$item` 事件参数 / `longpress` / 旧的 `tap(` / `longFlag` 写法。
- **待真机确认（本轮新增风险，如实记录）**：① 扫雷页 `$element('board').getBoundingClientRect` 是否取到有效尺寸
  （取不到会退回 `designK`，落点精度下降但不致命）；② `for` 循环格「只绑几何、不绑事件」在本页的渲染是否正常；
  ③ 1 秒计时 tick 在息屏/回前台后的恢复（息屏会 keepScreenOn=false 并停表，回前台续算）。

## 阶段自检（第十二轮：UI 整体优化 —— 度量 Token 与十页一致性重构）

- **玩家要求**：用 `trae-remote-official:web-app-development` 插件把 UI **整体优化一遍**。
  按 UICraft 工作流先做**可度量的现状审计**（不是凭感觉），再按「Assess → 修结构 → 表达 → 验证」推进。
- **审计实测到的漂移（本轮要修的就是这些）**：
  ① **返回入口两套**：`＜` 44×44 圆钮（settings/stats/help/about）vs 矩形「返回」chip（g2048/slide/minesweeper，
     三页内联尺寸还各不相同：46×26 / 42×22 / 44×26，字号 11~12）；
  ② 弹窗主按钮：`game` 136×40（上边距 8），其余五页 142×40（上边距 6）；扫雷另起类名 `.m2-btn`；
  ③ 圆角横跨 11 档（5/8/9/10/13/14/16/17/20/22/24）；④ 字号 9~22 散落，正文多数页不跟随用户字号档；
  ⑤ **动效只覆盖一部分**：三个对局页里 **game 页其实一条动效都没有**（说明文档写过头了，本轮补上）。
  颜色反而早已统一（theme.js 三配色 × 深浅、对比度逐对核过）→ 所以优化重点落在「度量与结构一致性」。
- **本轮落地**：
  1. 新增 `src/utils/metrics.js`（`RADIUS` / `BTN` / `SPACE` / `TYPE` / `nav()`），把度量收成一套；
     配 `tests/metrics.js`（25 断言）断言**设计不变量**：触摸目标 ≥34、圆角顺序单调、字号档单调、返回键几何。
  2. **顶栏一个规格**：圆形「＜」返回键，边长 = 顶栏高（44 / 矮画布 34）、半径 = 半边长；
     三个单人页同时改成「圆形返回键 + 右侧两行状态（主数值 md / 记录 sm）」并把状态文字接上用户字号档。
  3. **弹窗按钮一个规格**：六页 142×40 / 圆角 20 / 上边距 6；`.m2-btn` 并入 `.m-btn`。
  4. **底部控件圆角统一为 12**（g2048/slide/minesweeper 三页，原为 8/14/14 各写各的）。
  5. **十个内容页都有入场动效**：六页新加 `ui-page-in`、三页新加 `ui-hud-in`、game 页补齐 `ui-modal-in /
     ui-panel-in / ui-drawer-in`（该页此前完全没有动效层）。
  6. `scripts/check-all.py` 新增两道跨页护栏：六页 `.m-btn` 必须 142×40、十个内容页必须带入场动效
     （后者当场抓出 game 页缺动效 ✓ 护栏生效）。
- **顺带修掉一个真 bug**：`aeroplane.ux` 的落点格高亮写成 `border: r === this.flashCell …`，而 `r` 从未声明
  （构建只给橙色告警、仍然 build success，运行时该表达式抛 ReferenceError；正因为告警不是错误，之前几轮一直被忽略）。
  改成 `k === this.flashCell` 后，**飞行棋的落点闪示才是真的生效**。
- **几何复算**（统一顶栏把顶栏从 26/34 抬到 34/44，必须重算）：3 页 × 6 屏型 × 档位 = **28 组，27 组达标**；
  唯一例外是「大屏方表 228 画布 + 7×7 扫雷」格宽由 19 变 18（同屏能取到的最大值就是 18，属统一顶栏的已知代价，已记入 README）。
- **离线 mock 核对**：按胶囊屏 192×471 + 跑道形遮罩渲染三页新顶栏，确认圆形键与两行状态都落在可见区内、互不遮挡
  （图见 `D:\andlua\_yqart_work\mock-ui2.png`）。
- **校验**：`npm run build` 无 `unsupport`、**告警清零**（含上面那个 `r`）；`npm test` **17 个文件 0 失败（625 断言）**；
  5 个审计脚本全绿（含新增两道护栏）。
- **待真机确认**：① 三个单人页新顶栏（圆形返回键 + 两行状态）在胶囊屏与方屏上的观感；
  ② 统一后的弹窗按钮 142×40 在方屏上是否仍舒适（原 game 页 136 更小、现在统一变大）；
  ③ 十个页面的入场动效是否「太快/太慢」（时长 240~300ms，可按你的观感调）。

## 阶段自检（第十三轮：竞拍去掉消息气泡 —— 应玩家反馈）

- **玩家反馈**：「竞拍不要搞消息气泡，浪费时间。」（原实现里拍卖的每一步都走系统 Toast 播报）
- **先读代码列出原流程**：拍卖相关事件由引擎产出 → 页面 `applyAction` 里统一 `toastMod.toastEvents(res.events, 2)`
  → 于是「放弃购买进拍卖 / 谁出价多少 / 流拍」全变成一闪一闪的气泡；AI 出价间隔 600ms、
  气泡时长 1800ms，玩家一边等气泡一边还要点弹窗，确实拖。
- **改法（不是简单删播报，而是换承载物）**：
  1. 引擎侧把拍卖相关事件统一标 `kind: 'auction'`（原来只有「出价」是 auction，「放弃购买进拍卖」与「流拍」是 info）；
  2. 页面把 `kind === 'auction'` 的事件从 Toast 队列里滤掉 —— **拍卖全程零气泡**；
  3. 实时叫价改由**环内状态行**承担：竞拍中显示「拍卖中 $最高价」，颜色跟随当前领先者（蓝 / 红 / 尚未出价）；
     成交结果由**盘面归属色 + 资金板**体现 —— 信息一条没少；
  4. AI 出价 / 放弃的间隔 600ms → **240ms**，竞拍不再拖时间。
- **事件契约写进测试**：`tests/rules-monopoly.js` 新增 4 条断言（放弃购买 / 出价 / 成交 / 流拍事件都带 kind auction），
  以后谁改事件文案或 kind，测试立刻报。（顺带发现原测试里「双方都不出价」的第二个 passBid 其实是空操作 ——
  蓝方一放弃、场上只剩红方就当场收尾了；已加注释说明。）
- **护栏**：`check-all.py` 的 monopoly 断言加入页面侧可见文案「拍卖中 $」。
- **校验**：build 无 unsupport；`npm test` 17 文件 0 失败（大富翁 110 断言）；5 审计全绿；三包重出。
- **待真机确认**：① 拍卖时状态行「拍卖中 $N」是否读得清、颜色能否一眼看出谁领先；
  ② AI 出价 240ms 是否偏快（可在 `monopoly.ux` 的 `drive()` 里调）；
  ③ 成交 / 流拍目前**没有任何音效或气泡** —— 若你觉得「拍得」该给一次反馈，我可以补一条（很快，一行）。

## 阶段自检（第十四轮：按参考项目《方寸棋阁》优化性能）

- **输入**：`D:\andlua\方寸棋阁（围棋，国际象棋，斗兽棋，飞行棋，五子棋，象棋，军棋_decompiled`（反编译产物）。
  立场：**只借鉴手法、不照抄代码**（其授权状态不明，且代码为反编译转译物）。
- **先测再改**（全部用真实规则 + 真实 AI 在 node 里跑，脚本为项目外临时件 `D:\andlua\_yqart_work\perf-*.js`）：
  - 围棋 13/19 路：`moves()` **3.00ms/次**、`candidates()` **2.65ms/次**、中盘候选 **203** 个 →
    深度 2 根本跑不完，500ms 预算全烧光还只交出「角落着法」。
  - 主线程阻塞：19 路 hard 同步搜索期间，主线程连续冻结 **517ms**（触摸/动画全停）。
- **采纳（参考项目的手法 → 本工程自写实现）**：
  1. **虚拟落子洪泛**（对应其「不复制棋盘判合法」思路）：`go.js` 新增 `libsWithVirtual()` + `legalAt()`，
     把待落点当虚拟子参与洪泛，一趟同时得到「提子数」与「己方有无气」；两张时间戳表替代每次 new 对象。
     实测 `moves()` **3.00 → 0.40ms**、`candidates()` **2.65 → 0.60ms**。
  2. **候选收缩**（对应其 `getRelevantEmptyPositions()`）：改为先收集「切比雪夫 ≤2 的贴子空点」，
     按邻子密度降序后封顶 **60**（原 203）。规则合法性不受影响：`moves()` 仍是全量。
  3. **killer moves**：同一层触发过 β 截断的着法，在兄弟节点先搜（按层最多 2 枚）。
     A/B 实测国际象棋 hard 节点数 **27992 → 26656（-5%）**，无倒退。
  4. **迭代加深的前置排序**：每层开始把上一层最优着法挪到候选首位。配合 ①②，围棋 normal 由
     「301ms 且落在角落」变为「**~140~240ms 且是贴身合理点**」。
  5. **时间片异步搜索**（关键差异：参考项目的 `thinkAsync` 只是把同步搜索塞进 `setTimeout(…,0)`，
     **仍然整段冻结**，不解决根本问题）：本工程新增 `chooseMoveAsync()`，按根候选切片，
     每片 ≤12ms 就 `setTimeout(step,0)` 让出主线程，预算与棋力不变。
     实测 19 路 hard 主线程最长阻塞 **517ms → ≤93ms**（多数片 <30ms）。
- **否决（改造面大 / 本工程无法验证，如实记录）**：
  1. `Int32Array(4096)` **置换表**：需规则层支持增量哈希（Zobrist 或行表），本项目规则全是纯函数、
     无盘面哈希，硬接会引入「哈希碰撞 → 错误着法」的风险，且移动端内存收益不明 → 不做。
  2. **预计算胜线表**（其 `cellWinOff / cellWinIds`）：只对定式小盘（五子棋/井字棋）有效；
     本工程五子棋已是纯函数评估、候选已收缩，收益有限 → 不做。
  3. **落子音效 / 长按插旗** 之类涉及未验证 API 的部分：一律不引入（沿用「只用已验证写法」红线）。
- **顺带清掉 5 条构建橙色告警**（都是历史遗留的未使用变量：`aeroplane.ux` 的 `ch`/`s`、
  `monopoly.ux` 的 `cellBg`/两处 `that`）。现 `npm run build` **零告警、无 `unsupport`**。
- **修一处测试自身的错**：`tests/smoke.js` 取规则实例时漏传棋盘尺寸（`reg.get(g.id)`），
  围棋在 `create()` 里按格数建表后即抛 `RangeError` → 改为传 `sizes[0].cols/rows`。
- **新增测试**（`tests/ai.js` 3 条）：异步搜索「回调恰好一次 / 返回合法着法 / 取消后不回调」。
- **校验**：`npm run build` 零告警；`npm test` **17 文件 0 失败（632 断言）**；5 个审计脚本全绿；
  三包重出（debug 777012 B / jsc 754398 B / njsc 716999 B）。
- **待真机确认**：① 围棋 13/19 路「思考中」期间拖动棋盘/点菜单是否真的跟手（异步搜索的收益）；
  ② 候选封顶 60 后 AI 是否会漏掉「远处要点」（若你觉得棋力变弱，把 `go.js` 的 `CAND_CAP` 调大即可）；
  ③ hard 档仍是 500ms 预算（现在会用来搜更深），若嫌慢可下调 `BUDGET_MS.hard`。

## 阶段自检（第十五轮：弹窗分机型 / 围棋抽屉按钮 / 落点容差 / AI 排序）

- **玩家反馈（三条）**：① 弹窗是个长方体、长度占满整个屏幕，要求按设备分别优化；② 围棋里「返回抽屉」难以触发；
  ③ 触摸落点要优化、减少误落。另要求继续做 AI 算法优化。
- **① 弹窗（先复现再改）**：离线用 PIL 按真实字号渲染「离开对局？」弹窗 —— **旧规格在 192×228（大屏方表，最矮画布）
  上实测高 224**，几乎顶满屏幕（`D:\andlua\_yqart_work\mock-dialog.png` 左图）。改为**两档**：
  - 胶囊屏（默认）：弹窗 150 宽 / 圆角 20 / 竖向内边距 16；按钮 130×40、间距 6；
  - 方屏与方表 `@media (shape: rect)`：弹窗 160 宽 / 竖向内边距 10；按钮 140×34、间距 4；
  - 同一弹窗在 228 画布上 **224 → 198**（留出上下留白），胶囊屏 232/471（约半屏，mock 右图）。
  - 「按钮宽 = 弹窗内容宽」（150−20=130 / 160−20=140），按钮永远整行；**行列表**（资产管理 / 债务 / 选路）
    宽度同步 130/140，并把「名称 + 副文本」由横排改成**两行竖排**（横排在 114px 内容宽下放不下，实测文本约 160px）。
  - 口径进 `utils/metrics.js` 的 `MODAL` / `BTN`（两档）；`tests/metrics.js` 增 9 条断言（按钮宽 = 内容宽、两档都 ≥34、
    方屏更扁、圆角 = 半高），`check-all.py` 改为核对「编译产物默认档 130×40 + 源码 rect 档 140×34」。
- **② 围棋抽屉按钮**：原「菜单」按钮 **44×20**（约 3.7mm，低于项目 34 的触摸目标下限），且紧贴胶囊屏圆弧边界 ——
  现改为 **44×34 / 圆角 17**；顶部浮层行高 34 → 胶囊屏 `top: 30 → 32`（按 `xmin(y)=26` 反解得 y≥30.3），
  棋盘让位 `PILL_CLEAR_CAPSULE 44 → 60`。顺带减少「想点菜单点成棋盘」的误触。
- **③ 落点容差**：`geometry.hit()` 的 cross 模式容差由 `cell/2 + 5`（比两交点中点还大，等于全盘任意点都吸附）收紧到
  **0.45×cell**（cell 21 → 9、30 → 14）；`cell` 模式（黑白棋整格为目标）保持 `cell/2 + 1`。
  `tests/geometry.js` 增 2 条断言：偏 12px 仍吸附、正中空当（离最近交点 15px）判无效。
- **④ AI 排序**：
  - 五子棋：候选先排「己方立刻成五」再排「对方立刻成五（必堵）」，其余按邻子密度；`turn` 缺省时退化为纯密度（旧行为）。
  - 四子棋：同样两级威胁排序，其后仍按离中列距离。
  - 国际象棋：吃子排序改为 **MVV-LVA**（受害者价值×10 − 动子价值），并给升变、易位加分。
  - **实测**（项目外 `D:\andlua\_yqart_work\ab-order.js`，同一局面 hard）：五子棋 15 路节点 **478182 → 45313（−90%）**、
    耗时 **501ms → 232ms**，着法不变；四子棋节点 **5964 → 5603（−6%）**；国际象棋 500ms 预算内着法不变（无倒退）。
- **顺带修一个真 bug（让位量放大后暴露）**：`layoutBoard()` 只按 `(boardH-vpH)/2` 定位摄像机，没算上棋盘在舞台里的上偏移 `padY` ——
  整盘比屏幕高时会把上偏移整个「滚掉」，棋盘首行压在顶部胶囊下、底部却多出等量空白。让位量 44 → 60 后偏差更明显，
  已改为 `padY() + (boardH-vpH)/2`（`centerOn` 早就是这么算的，现在两处口径一致）。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（643 断言）**；5 个审计脚本全绿；
  三包重出（debug 778065 B / jsc 755283 B / njsc 717708 B）。
- **待真机确认**：
  1. 弹窗在胶囊屏与方屏上的观感（150/160 宽是否够窄、圆角 20 是否够「卡片」；228 画布上 198 是否还有压迫感）；
  2. 围棋「菜单」按钮加高后是否好按，以及顶部让位 60 是否让棋盘显得偏下；
  3. 落点容差 0.45×cell 是否会让「稍微点歪就无效」——若嫌苛刻，改 `src/core/geometry.js` 的系数即可（0.5 最松）；
  4. 五子棋 / 四子棋 / 象棋 AI 的着法是否更「有威胁感」（排序只改搜索顺序，理论不改变评估口径）。

## 阶段自检（第十六轮：UI 排版 / 控件大小的分机型适配）

- **本轮做法**：先量再改 —— 用脚本把 12 页 CSS 里**所有高度 < 34 的类**列出来，再按四个机型档
  （胶囊 192×490 / 192×355、方屏 192×300、大屏方表 192×228）逐页算竖向预算，只改「实测超预算 / 低于触摸下限」的地方。
- **① 小控件低于触摸下限（真机上「点不准」的直接原因）**：
  - `chip` 32 → **34**（圆角 17、字号 14，与另外两页对齐）；
  - 设置页分段控件 `.seg/.seg-item` 32 → **34**（圆角 17）；
  - 设置页开关 `.toggle` 46×26 → **52×34**（滑钮 20 → 26，开态 `margin-left` 24 → 22，行程 = 52−8−26 = 18）。
  - 口径收进 `utils/metrics.js` 的 `CTRL`（chipH/chipR/segH/segR/switchW/switchH/knob），
    `tests/metrics.js` 加 8 条断言（四项 ≥34、圆角 = 半高、滑钮比滑槽矮 6~10、滑槽宽 ≥2×滑钮）。
- **② 矮画布上的两处「真裁切」**：
  - **开局面板**：内容实测约 **322px**（标题 42 + 两组标签/选项 136 + 三个按钮 156）——
    方屏 300 差 22、大屏方表 228 差 94，底部「玩法介绍 / 返回」直接被 `overflow:hidden` 裁掉（点不到退出）。
    三个对局页（game / monopoly / aeroplane）的面板改放进 `<scroll class="panel-vp" scroll-y="true">`；
    胶囊屏（471）内容本来放得下，不会出现滚动。`.setup` 加 `margin-bottom:20` 保证滚到底不被贴边。
  - **控制抽屉**：单列 4~7 项约 200~350px —— 方屏 300 勉强、228 差 120。加 `.d-grid` 容器：
    胶囊屏仍单列（7 项 ×50 = 350 ≤ 471）；**方屏改双列网格**（`.d-item` 86×36、圆角 18、2×86+边距 = 180 ≤ 192），
    4~7 项占 2~4 行 = 80~160，全部可见且每格 ≥34。
  - 顺带把方屏的 `.matching` 上边距 62 → 20（原值 + 内容 194 = 247 > 228，同样会裁）。
- **③ 护栏**：`scripts/check-all.py` 新增
  - 护栏 F：三个对局页必须含 `panel-vp` / `d-grid`，且 CSS 里有 `flex-wrap: wrap`（防被回退成单列）；
  - 护栏 G：game / monopoly / aeroplane 的 `.chip` 与 settings 的 `.seg` 高度 < 34 直接报错。
- **离线复核**：`D:\andlua\_yqart_work\mock-short-screen.png`（左＝228 开局面板滚动首屏、中＝228 抽屉双列、右＝471 抽屉单列）。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（651 断言）**；
  5 个必跑审计全绿（`check-all / features / backpress / backclean / opensrc`）；`check-bundle.py` 引用的是旧版本包名 `debug.1.3.1.rpk`，早已过期，本轮未纳入必跑。
  三包重出（debug 778948 B / jsc 755784 B / njsc 718198 B）。
- **待真机确认**：
  1. 方屏（手环 Pro / REDMI Watch）上开局面板**滚得动**、滚到底能看到「返回」；
  2. 方屏抽屉双列网格的观感（86×36 是否偏小、文字是否都放得下）——胶囊屏仍是单列，不受影响；
  3. 设置页新开关（52×34）与分段控件（34 高）是否更好按，滑钮左右位置是否对齐两端；
  4. chip 加高后胶囊屏开局面板的整体高度（多 4px/行）是否仍在一屏内（实测 471 上仍有 100+ 余量）。

## 阶段自检（第十七轮：主页滑动 / 切换卡顿）

- **玩家报障**：「主页的滑动与切换非常的卡。」
- **排查条件**：无模拟器、无真机、无帧率工具 → 不能做 profile；只能按「平台行为 + 本工程既往实测」逐条削减开销。
  先把主页所有可能的重绘来源列出来，再一条条处理（每条都在代码注释里写明原因）：
  1. **滚动容器挂了入场动画**（`.cards { animation: ui-page-in }`）—— 给滚动容器加 transform/opacity 动画会让运行时
     把整块列表当独立合成层；已移除，动效保留在不参与滚动的 `.title-row`（页面仍有入场动效，audit E 仍绿）。
  2. **24 层裁剪**：`.card { overflow:hidden }` ×12 + `.card-icon { border-radius }` ×12。裁剪层在滚动时逐帧重裁；
     卡片尺寸固定、内部无绝对定位子项，不需要 overflow；图标 PNG 本身已挖透明圆角（半径 16/64 = 25%），
     CSS 圆角纯重复 → 两者都删。
  3. **12 张 96×96 图标**：解码内存 12 × 36KB = 432KB → **64×64（192KB，−56%）**；显示尺寸只有 36（胶囊）/ 30（方屏），
     肉眼无差。素材仍是 PNG（玩家硬性要求）。
  4. **每次返回主页都整页重渲染**：`onShow` 里对 `t/bgSrc/fz` 无条件赋值 → 12 张卡片 + 背景图 + tabbar 全部重绑。
     改为先比 `palette/theme/fontSize` 的 key，没变直接 return；另给 `config.loadSettings()` 加同步快照
     `cachedSettings()`，主页 `onInit` 首帧就用它定字号/配色（原来 data 里 `fz` 固定 normal，异步读回再赋值 = 必有一次重渲染）。
  5. **首帧按 490 渲染、再改成真实画布高**：新增 `screen.cachedLayout()`，第二次及以后进主页在 `onInit` 就拿到真实 `designH`。
  6. **`$item` 当事件参数**（本工程未验证写法）：改 `for="{{(gi, g) in games}}"` + `@click="openGameIdx(gi)"`；
     同时 `bounces` 关掉（列表到底不再回弹重绘）。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（651 断言）**；5 个必跑审计全绿；
  三包重出（debug 714090 B / jsc 690824 B / njsc 652964 B —— 图标降采样后包体比上一轮小约 64KB）。
- **待真机确认（重要）**：
  1. 主页滑动是否变顺；若**仍然卡**，下一步按收益排序：① 去掉主页整页背景位图（换成纯 `surface` 底，纹理只留其它页）；
     ② 卡片列表改 `<list>`（本工程未验证，需先在真机上做最小样例）；③ 减少首屏卡片数（分组/分页）。
  2. 点底部 tab 进设置/战绩、再返回主页是否更快（应少一次整页重绑）。
  3. 图标 64×64 放大到 36/30 是否有肉眼可辨的糊（若糊，改回 72×72 折中）。

## 阶段自检（第十八轮：深浅模式「一闪一闪」）

- **玩家报障**：「黑白夜模式一闪一闪的很难受。」
- **定位到三条根因**（读代码 + 平台行为，非猜测）：
  1. **存储是异步的**：页面 `data` 的 `t/bgSrc` 来自 `theme.current()`，冷启动时它还是默认紫/深 ——
     等 `loadSettings` 回来再赋值，浅色用户就会「先见深色一帧 → 闪成浅色」。
  2. **页页无条件重设**：`onShow/onInit` 里 `that.t = …; that.bgSrc = …` 每次都赋一遍。
     `t` 重复赋值只是重绑颜色，但 **`<image src>` 重新赋值（哪怕同一路径）会让运行时先卸载旧图再解码**
     —— 中间那一帧是空白，观感就是「闪」。所以「返回主页 / 进设置 / 进对局」每跳一次都可能闪一次。
  3. **设置页换主题只换了一半**：`pick()` 里先 `themeMod.get()`（新配色）再 `themeMod.currentBg()`，
     而 `currentBg()` 依赖 `remember()` 记录的深浅模式 —— 设置页里从没 remember 过，
     于是**文字换成了浅色主题、背景图还指着深色那张**，下一次 `loadSettings` 才补上（又是一次跳变）。
- **修法（三处统一）**：
  - `config.applyTheme(that, s)`：按「palette/theme/fontSize」签名判重 —— **没变就一个绑定都不碰**；
    变了则 `t/bgSrc/fz` 三个值一次赋完（避免「背景先换、文字后换」的中间帧）。
  - `config.seedTheme(that)`：9 个带 `onInit` 的页面（index / game / monopoly / aeroplane / g2048 / slide / minesweeper / settings / about）在 `onInit` 最前面调用，
    用 `loadSettings` 的同步快照把首帧直接定成用户主题 —— 冷启动后除第一页外**首帧就对，不再闪**。
  - `config.rememberSettings(s)`：设置页改完先 remember（`currentBg()` 才指向新深浅），再 `applyTheme`；
    同时刷新快照，保证下一个页面 `seedTheme` 拿到的是新主题。
  - **启动页改固定深色品牌屏**：`start.ux` 不再绑定 `t/bgSrc`（底色 `#1C1B1F` + `bg_dark.png`，文字固定 `#E6E1E5/#CAC4D0`）。
    这是唯一无法在首帧拿到主题的页面（存储异步），固定深色可从根上消掉冷启动的深浅跳变。
    ⚠️ 代价：浅色用户会先看到深色品牌页（行业常规），若你更希望「启动页也跟随主题」，
    可以改回绑定，但冷启动会保留一次深浅切换。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（651 断言）**；
  5 个必跑审计全绿；三包重出（debug 716181 B / jsc 693023 B / njsc 654425 B）。
- **待真机确认**：
  1. 冷启动：启动页固定深色是否可接受（替代方案见上）；
  2. 在设置里连点「深色 / 浅色」：背景图与文字应**同一帧**一起换、不再出现「文字先变、背景晚一拍」；
  3. 主页↔设置↔对局来回跳：每次进页不应再看到整屏闪一下；若仍有，说明该页还有别的 `bgSrc` 赋值点，告诉我哪一页即可。

## 阶段自检（第十九轮：规则 / 玩法 / 质量打磨 —— 第一批）

- **范围确认**：玩家选择「规则正确性与边界 + 对局手感与反馈 + 单人玩法与节奏 + 说明文案与帮助页」四项全做，
  且允许「补全缺失规则」与「调整平衡与数值」。本轮先交付**可验证、低风险**的第一批，其余列入下批清单。
- **① 规则补全：国际象棋三次重复局面判和**
  - `rules/chess.js` 新增 `positionKey(board, turn)`：签名 = 棋子布局 + 行棋方 + 六个易位权旗标 + 过路兵目标，
    **不含半回合计数**（FIDE 判定也不看它）。规则层仍是无状态纯函数。
  - `game.ux` 新增 `repeatCount()`：在当前局面与走子栈（≤30 手）里数同一签名，≥3 即 `endGame({result:'draw', reason:'三次重复局面'})`；
    悔棋后栈缩短，计数自动回落。
  - `config.js` 的国际象棋介绍、`chess.js` 文件头同步（旧文「不实现三次重复」已删除）。
  - `tests/rules-chess.js` 增 5 条断言（同行棋方同签名 / 换方不同 / 棋盘变不同 / 半回合计数不进签名 / 易位旗标进签名）。
- **② 手感：黑白棋轮空提示**
  - 原状：单方无子可走时 `turn` 停在同一人身上，回合胶囊文字不变 → 玩家会以为卡住。
  - 现：`showPassNote('黑方/白方无子可走 · 轮空')` 覆盖胶囊文字 1.6s（`passNote` 绑定），
    并在悔棋 / 重开 / 继续上局 / 终局 / 页面销毁时清理（避免残留或定时器泄漏）。
- **③ 说明文案与实现对齐（审计查出的 3 处硬伤）**
  - `help.ux` 原写「大富翁 40 格 / 飞行棋 52 格」→ 实为 **24 格 / 28 格外圈**；
  - 原写「对局中侧滑返回会先弹出确认」→ 实为**呼出控制抽屉**（退出确认在抽屉里的「退出对局」之后）；
  - 原写「双人 1 号执蓝、2 号执红」→ 棋类实际是**每局随机黑白**（蓝/红只适用于大富翁、飞行棋）。
  - 顺带补上：单骰与监狱规则、拍卖不弹气泡（环内状态行）、`check-all.py` 的帮助页断言同步更新。
  - `rules/monopoly.js` 文件头原写「标准 40 格 / 双骰再掷 / 三连双入狱」→ 改为 24 格 + 单骰 + 监狱罚则（与实现一致）。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（656 断言）**；5 个必跑审计全绿；
  三包重出（debug 717102 B / jsc 693731 B / njsc 655158 B）。
- **下一批清单（按收益排序，待做）**：
  1. 围棋：数子结果面板（黑/白/贴目明细）+ 「双方无合法点自动终局」的明确提示；
  2. 象棋：兵升变可选（后/车/象/马）——目前自动升后；
  3. 黑白棋：终局前「双方都无子可走」的自动收尾提示；
  4. 大富翁：竞拍成交/流拍的短震动反馈；飞行棋：撞机时的震动与状态行提示；
  5. 2048 / 华容道 / 扫雷：局内「再来一局」快捷入口与最佳纪录提示的位置统一；
  6. 帮助页加「规则简化说明」小节（如围棋简单劫、无让子）。

## 阶段自检（第二十轮：规则 / 玩法 / 质量打磨 —— 第二批）

- **① 国际象棋：兵升变可选（后 / 车 / 象 / 马）**
  - `rules/chess.js`：`apply()` 读取 `move.promo`（1马 2象 3车 4后），缺省仍升后；
    **AI / 搜索不分支** —— 引擎生成的走法不带 `promo`，所以搜索行为、节点数与改动前一致。
  - `game.ux`：人类点击目标格后先拦截 `isPromotion()`（自家兵 + 目标行 0/7），弹「兵升变为？」四选一；
    `pickPromo()` 把 `promo` 写进待落走法再走正常 `doMove()`，取消则不落子、不消耗回合。
    弹窗在开始对局 / 继续上局 / 重开 / 悔棋 / 终局 / 侧滑返回时统一清理（`cancelPromo()`）。
  - 弹窗尺寸：标题 + **一行四个 30×34 按钮**（30×4 + 3×3 = 129 ≤ 内宽 130），
    方屏 228 高也能完整放下；高度 34 满足触摸目标下限；按钮显式设背景色（项目硬约束）。
  - `tests/rules-chess.js` 增 4 条断言：缺省升后 / 指定升马 / 指定升车 / 黑兵缺省升后与指定升象。
  - `config.js` 国际象棋介绍、帮助页、README 同步为「可选升变」。
- **② 大富翁：竞拍落槌震动**
  - `monopoly.ux` 的 `applyAction()`：行动前记住 `hadAuction`，结算后若拍卖结束且事件含「拍得」→
    `haptic.capture()`（强震），含「流拍」→ `haptic.place()`（短震）。竞拍仍无任何消息气泡。
  - 飞行棋的撞机反馈**复核后无需新增**：`execMove()` 已有 `mv.capture > 0 → haptic.capture()`
    与「击落对手 N 架飞机」日志播报（本来就在上一版实现了）。
- **③ 帮助页：新增「规则简化说明」小节**
  - 围棋简单劫 / 无让子 / 白贴 6.5 目；黑白棋 6×6 与 8×8 两档；大富翁 24 格精简（标准 40 格）、
    单骰、掷 6 出狱、三次未出掷罚 $50；飞行棋 28 格外圈、单骰、撞机连投；
    国际象棋与官方规则一致（易位 / 吃过路兵 / 可选升变 / 三次重复判和）。
  - `scripts/check-all.py` 的帮助页断言补上「规则简化说明」。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（660 断言）**；
  5 个必跑审计全绿；三包重出（debug 718210 B / jsc 694606 B / njsc 655962 B）。
- **待真机确认**：
  1. 国际象棋兵到底线：四选一弹窗在跑道屏 / 方屏都能完整显示，四个选项都能点中（≥34 触摸下限）；
  2. 升变选「马 / 车 / 象」后，盘面与回合推进正常，AI 应手不报错；
  3. 大富翁竞拍成交 / 流拍各一次，确认震动强度区分明显且不影响节奏。
- **下批清单（未做）**：
  1. 围棋：数子结果面板（黑/白/贴目明细）+「双方无合法点自动终局」提示；
  2. 黑白棋：终局前「双方都无子可走」的自动收尾提示；
  3. 2048 / 华容道 / 扫雷：局内「再来一局」快捷入口与最佳纪录提示的位置统一。

## 阶段自检（第二十一轮：玩法体验 —— 落点提示 / 停手反馈 / 终局原因）

- **① 黑白棋合法落点提示**
  - 现象：点任意格都可能「没反应」+ 弱震，新手只能逐一试错才知道哪格能夹。
  - 现：`game.ux` 新增 `syncHints()`（仅黑白棋、仅人类行棋、仅 playing 态），
    把 `rules.moves()` 的合法点映射成小圆点（直径 = 棋子直径 × 0.22，最小 4px），
    在棋子渲染后以绝对定位叶节点绘制（沿用已验证的 `geo.pos` 坐标写法）。
    AI 思考 / 终局 / 重开时清空；提示只做视觉辅助，非法点仍走原有拒绝 + 弱震逻辑。
  - 黑白棋介绍文案（`config.js`）同步说明「合法落点会以小圆点提示」。
- **② 终局原因与比分（黑白棋）**
  - `rules/othello.js` 的 `check()` 原只返回 `{result, winner}`，结束弹窗只能显示通用文案。
  - 现返回 `{result, winner, black, white, reason}`，reason 区分 **盘满 / 一方无子 / 双方无子可走**，
    并附 `黑X : 白Y` 比分；`game.ux` 的结束弹窗直接展示（`ck.reason` 优先级最高）。
  - `tests/rules-othello.js` 三条终局断言同步为新的完整契约（盘满判和 / 盘满判胜 / 一方无子判胜）。
- **③ 围棋「停一手」反馈**
  - 停一手后棋盘不会多出棋子，原本只有回合胶囊换成对手，容易被当成「点了没反应」。
  - 现 `doMove()` 在正常轮转分支对 `move.pass` 调 `showPassNote('黑方/白方停一手')`，
    沿用 1.6s 临时文案机制（与黑白棋轮空提示同一条路径，悔棋/重开/终局会自动清）。
- **④ 复核后无需改动的项**
  - 2048 / 数字华容道 / 扫雷三页**本来就有**局内「再来一局」与分档最佳纪录（HUD + 结果弹窗），
    第 20 轮清单里的该项已失效，特此留档，避免重复开工。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（660 断言）**；
  5 个必跑审计全绿；三包重出（debug 718956 B / jsc 695281 B / njsc 656584 B）。
- **待真机确认**：
  1. 黑白棋 6×6 / 8×8：落点小圆点在深/浅两套主题下都清晰（颜色取 `t.primary`、透明度 0.55）；
  2. AI 回合与思考中不应残留小圆点，落子后提示应立刻移到新合法点；
  3. 围棋点「停手」后，胶囊是否显示「黑方/白方停一手」1.6s；
  4. 黑白棋终局弹窗的长文案（如「双方无子可走 · 黑34 : 白30 · 黑白棋 · 人机对战」）
     在方屏上是否仍完整显示（若被裁，下一轮改为弹窗内滚动或缩短模式后缀）。

## 阶段自检（第二十二轮：跑道屏盘面分格 —— 消除左右大缝）

- **玩家反馈**：胶囊屏上大富翁 / 飞行棋「两边每个块空隙隔得较大，上下是比较挤」。
- **实测根因（按旧几何公式）**：
  - 大富翁：格 23px、横向缝 3px；左右只有 5 个非角格要摊满 486px → **竖缝 52px**；
  - 飞行棋：格 19px、横向缝 3px；左右 6 格摊满 → **竖缝 46px**。
  - 原因是「正方形格 + 固定上下 7/8 格 + 盘面贴满屏幕」三者叠加：宽由 7/8 格锁死，
    高却要填满竖长屏，多出来的高度只能全部塞进左右缝。
- **玩家决策**（三选一，2026-10-23）：选「重排格数，保持正方形」——
  允许改变上下/左右的格数分布，保留正方形、保留贴满屏幕。
- **改法：`baseRing()` 按屏幕纵横比选格数分布**（两页同构）
  - 约束：`2a + 2b − 4 = N`（a = 上下每边格数含两角，b = 左右每边格数）。
  - 枚举 a，令格宽取 `min(按宽装满, 按高装满)`，算出横/竖缝，取「**最大缝最小**」的方案；
    结果按 `pageH` 缓存，缩放档只等比放大格与缝，不再重排格数。
  - 实测选中分布（每边格数 / 格宽 / 横缝 / 竖缝）：
    - 跑道屏 490：大富翁 **4/10 · 42px · 4 / 6.4px**；飞行棋 **4/12 · 37px · 10.7 / 3.1px**；
    - 方屏 300：大富翁 5/9 · 29px · 8.8 / 3.4px；飞行棋 6/10 · 26px · 4.8 / 3.1px；
    - 方屏 228：大富翁 6/8 · 24px · 7.2 / 3.4px；飞行棋 7/9 · 21px · 5.5 / 3.4px。
  - 旧公式里 `ringH` 直接取屏高，新公式按实际行数算 `ringH`，默认档仍 ≈ 贴满屏幕（PAD=2）。
- **环内 UI 随净宽收敛（新盘面两列更宽，不能再用整环宽做控件）**
  - 大富翁：状态行 / 金额板 / 骰子 / 操作按钮 / 菜单全部收进 `innerW`（跑道屏约 96px）；
    菜单从「骰子左侧 20×22」改为 **整条净宽 ×34**（满足 34px 触摸下限），放在操作按钮下方；
    状态行文案缩短为「1/30 · 蓝方·你」、拍卖改为「拍卖 $N」；金额板名字改为「蓝方·我 / 红方·AI」。
  - 飞行棋：冲刺道 6 格宽度原先按环宽算（会压到侧边格），现按 `innerW` 收缩；
    菜单同样改为净宽 ×34 放在骰子下方；状态行/金额板文案同上缩短。
- **顺带修复（飞行棋）**
  - `posOf()` 仍写着旧 52 格盘的 `d≤51 / d≤57` 分界，而规则层 TRACK=28、FINISH=34：
    冲刺道里的飞机被算到环外 → **徽章直接消失**。现改为 `TRACK / FINISH` 常量分段。
  - 冲刺道小格只有环格一半宽，徽章按小格宽度缩小，避免压到相邻格。
  - 到家的飞机不再画在冲刺道右侧（新净宽下会压住侧边格），到家数量由金额板「N/4」显示。
- **已知取舍（需真机确认）**：飞行棋 28 格按 4/12 重排后，四方起飞点 0/7/14/21
  不再全部落在四个角（只有 0 与 14 是角），起飞格会出现在右侧中段。这是「保持正方形 + 贴满屏」
  的几何必然；若更在意四角起飞，需要回到 8/6 或允许非正方形格，二者都与本轮决策冲突。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **17 文件 0 失败（660 断言）**；
  5 个必跑审计全绿；三包重出（debug 719721 B / jsc 695933 B / njsc 657141 B）。
- **待真机确认**：
  1. 跑道屏大富翁 / 飞行棋：左右缝是否明显变小、上下是否不再挤，格子仍为正方形；
  2. 环内状态行（「1/30 · 蓝方·你」）与金额板在 96px 净宽里是否完整、不压侧边格；
  3. 胶囊屏「菜单」按钮（整条 96×34）是否可点、是否挡住任何格子；
  4. 飞行棋冲刺道徽章是否正常显示（旧版会消失）、到家后数量是否在金额板更新；
  5. 缩放档 0.7 / 1.3 / 1.7 下盘面是否只是等比放大，格数分布不跳变。

## 阶段自检（第二十三轮：赛季制度 / 赛季任务 / 棋币制度）

- **玩家决策（2026-10-24，逐项确认）**：
  1. 货币用途：**主题解锁 + 局内道具都做**（本期同时落地）；
  2. 赛季切换：**发版手动改赛季号**（`SEASON_ID` 每次发版 +1，换季重置任务，不按日期）；
  3. 入口：**主页顶部金币条** → 赛季页；
  4. 道具：**大富翁免狱卡 + 飞行棋重掷券**；
  5. 任务结构（玩家「看情况」→ 由本工程定）：**5 条一次性赛季任务**。
- **数据模型（`utils/economy-core.js` 纯函数 + `utils/economy.js` storage 封装）**
  - 存储 key：`coins`（棋币，跨季保留）、`items`（`jailCard` / `reroll` 库存，跨季保留）、
    `season`（本季 `{games,wins,aiGames,streak,bestStreak,seen,claimed}`）、
    `palettes`（已解锁配色，前三套默认 + 琥珀 / 绯红）。
  - `SEASON_ID = 1`、`SEASON_NAME = 初执棋子`；`load()` 发现存盘赛季 id 不符即写入空进度。
  - 所有纯函数返回新对象，不修改入参；脏值 / 旧季自动归一。
- **棋币来源**
  - 对局结算（`config.recordResult` 内调用 `economy.recordMatch`，新增玩法不漏接线）：
    人机 胜 20 / 和 10 / 负 5；双人 胜 15 / 和 8 / 负 4。
  - 结束弹窗显示本局棋币（棋类 / 大富翁 / 飞行棋）；棋种页文案缩短为「原因 · 人机/双人 · 棋币 +N」。
  - 5 条赛季任务（完成需手动领取，奖励合计 360 币）：
    完成 6 局（60）/ 赢得 4 局（100）/ 3 连胜（80）/ 体验 4 种玩法（60）/ 人机 5 局（60）。
  - 说明：2048 / 华容道 / 扫雷**暂不发币**（它们本就不写战绩记录，避免同时改动战绩统计口径）。
- **棋币出口**
  1. **配色解锁**（设置页）：配色行改为 5 个 chip（3+2），未解锁 chip 显示价格；
     点未解锁 → 购买确认弹窗（余额不足提示）；解锁后自动切到该配色。
     琥珀 200 / 绯红 300。新增两套 MD3 色板，五套 × 深浅共 10 组 Token 全部实测 ≥ AA 4.5:1。
     修复 `config.loadSettings()` 的 palette 白名单（原只允许 purple/green/blue，会把新配色打回紫色）。
  2. **赛季商店**（新页 `pages/season`）：免狱卡 80 币、重掷券 60 币；
     显示持有数量、余额、购买确认弹窗；页面含 5 条任务进度与领取按钮。
- **局内道具**
  - **大富翁 · 免狱卡**：`rules/monopoly.js` 新增 `shopJailCard` 动作（只清监禁、不自动掷骰，
    与运气卡 `useJailCard` 语义区分）；页面在「资产管理」面板插入「免狱卡出狱（库存 N）」行，
    使用前先扣库存落盘，再清监禁。`tests/rules-monopoly.js` 增 4 条断言。
  - **飞行棋 · 重掷券**：人类掷骰后、起飞/前进前弹「点数为 N · 继续前进 / 重掷」；
    每次投掷最多用 1 张；AI 不弹窗。库存扣减是异步的，期间 `busy=true` 挡住骰子热区防连点。
  - **顺带修复（飞行棋双人）**：`resolveRoll()` 原先把 `player===1` 一律当 AI（双人模式红方
    被 AI 代走），现只在 `mode==='ai'` 时走 AI；选择弹窗 `doChoose()` 也改为按 `pendingPlayer` 执行。
- **主页**：标题下新增「第 N 赛季 · 棋币 N」整条按钮（34px 高，胶囊屏安全区内），点击进赛季页。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **18 文件 0 失败（705 断言）**；
  5 个必跑审计全绿（已把 season / settings 的弹窗规格、入场动效、返回入口、素材路径纳入护栏）；
  三包重出（debug 775830 B / jsc 745048 B / njsc 697068 B）。
- **待真机确认**：
  1. 主页金币条与赛季页在跑道屏 / 方屏都能完整显示，金币数字不换行；
  2. 设置页 5 个配色 chip 的「名称 + 价格」是否放得下（琥珀/绯红未解锁时）；
  3. 打一局人机：结算弹窗的「棋币 +N」是否显示，返回主页金币是否增加；
  4. 赛季任务进度是否随对局更新，领取按钮是否可用；
  5. 买免狱卡后在大富翁入狱回合，资产管理里能否看到并成功使用（库存 -1）；
  6. 买重掷券后飞行棋每次掷骰是否弹重掷询问，重掷后库存 -1 且不会连续弹第二次；
  7. 双人飞行棋红方是否恢复为真人选择行动（不再被 AI 代走）。

## 阶段自检（第二十四轮：UI 打磨 / 体验打磨）

- **赛季页可读性**
  - 任务行加 **88px 进度条**（轨道用 surfaceVariant、实心用 primary；完成后转 resultWin），
    实心宽度按 `cur/need` 算成 px（不用百分比，避开平台百分比宽度的差异）。
  - 任务区标题改为「赛季任务 · 已领 X/5」；已领取任务名降为 onSurfaceVariant，状态一眼可辨。
  - 商店行改为「免狱卡（0）」紧凑写法；道具说明缩短为「大富翁：免罚出狱 / 飞行棋：重掷一次」，
    避免在 168px 行宽里换行挤掉按钮。
  - 任务名去空格并缩短（完成6局对局 / 赢得4局 / 达成3连胜 / 体验4种玩法 / 人机对战5局），
    字号 14 → 13，保证在「文字区约 92px」内不换行。
- **主页**
  - 金币条右侧加「＞」入口指示；金币条保持 34px 高、胶囊屏安全区内。
- **设置页**
  - 配色 chip 从 space-between 的 3+2 改为左对齐网格（42×40，间距 4），5 个 chip 不再左右乱跳。
- **动效**
  - 设置页 / 赛季页的购买确认弹窗补 `ui-modal-in`（scale 0.94 → 1，240ms），与其他页统一。
- **对局体验**
  - 大富翁：监狱中且库存 >0 时，资产按钮文案由「资产管理」改为「资产 / 免狱」，
    让玩家能发现免狱卡可用；用完恢复原名。
  - 对局结算若刚好完成某条赛季任务，系统 Toast 提示「赛季任务已可领取」
    （由 `config.recordResult` 的经济结算回调触发，不占结束弹窗版式）。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **18 文件 0 失败（705 断言）**；
  5 个必跑审计全绿；三包重出（debug 778544 B / jsc 747938 B / njsc 698878 B）。
- **待真机确认**：
  1. 赛季页进度条在深/浅主题下都清晰，已领任务名是否明显变灰；
  2. 任务名 / 商店说明是否都不换行、不压右侧按钮；
  3. 设置页 5 个配色 chip 是否排成整齐的 3+2；
  4. 大富翁入狱且有免狱卡时，按钮「资产 / 免狱」是否放得下、点击后行内是否可领取；
  5. 完成赛季任务的那一局，结束瞬间是否弹出「赛季任务已可领取」提示。

## 阶段自检（第二十五轮：AI 强化 / 升级 / 优化）

- **搜索层（`core/ai.js`，所有棋类共用）**
  1. **根级 α 剪枝**：原实现根节点对每个候选都用全窗口（为避免 fail-soft 混入并列最优）；
     现 normal/hard 改为「用当前最优分做 α 窗口」，只有严格更优的着法才记录 ——
     `beta_child = -best`，返回 >best 才是精确值；easy 保持全窗口 + 并列随机（弱化难度）。
     副作用：normal/hard 不再在并列最优中随机（结果更稳定）。
  2. **历史启发**：β 截断时按 `depth²` 给该着法记分（国际象棋的键含起子格）；
     排序 = killer（同层前 2）→ 有历史分的着法（降序）→ 其余保持候选集原序。
  3. **深度上限按分支数抬高**（预算与迭代加深仍封顶）：
     全局 easy/normal/hard = 1/3/5；象棋 1/3/4；黑白棋 / 五子棋 / 围棋 1/3/6；
     四子棋 1/4/7；井字棋保持 9 层全解。
- **实测（hard，`apply` 调用数 ≈ 搜索节点）**
  - 五子棋 9×9 中盘：**500ms / 346,361 节点**（预算用满，深度由迭代加深决定）；
  - 象棋开局：**500ms / 37,832**；黑白棋 8×8：**105ms / 9,841**；
  - 四子棋 7×6：**106ms / 84,201**；围棋 9×9 空盘：**347ms / 58,185**。
  - 说明：黑白棋 / 四子棋在各自深度上限内跑完，因此远低于预算；五子棋 / 象棋会用满 500ms。
- **骰子玩法 AI**
  - **飞行棋**：`score()` 加入危险项 —— 落点进入对手 1~6 格射程时 -18 分（只罚一次），
    避免 AI 主动把飞机送到对手面前；hard 仍优先撞机/到家。
  - **大富翁**：新增 `ownsSibling()`；hard 在「成套最后一块」时买地只需留 20（非成套留 50），
    竞拍上限 1.6× 地价（非成套仍 1.2×）；normal 同步放宽（留 100 / 竞拍 1.0×）。
- **测试**
  - `tests/ai.js`：新增「国际象棋 Qxf7# 一步杀」；hard 耗时断言改为 <650ms（500ms 预算 + 开销）。
  - `tests/rules-aeroplane.js`：新增「hard 避开对手 1~6 格射程」用例（安全机 d=7）。
  - `tests/rules-monopoly.js`：新增 4 条「成套买地 / 竞拍上限」断言。
  - 全量：**18 文件 0 失败（711 断言）**。
- **校验**：`npm run build` **零告警、无 unsupport**；5 个必跑审计全绿；
  三包重出（debug 779161 B / jsc 748382 B / njsc 699232 B）。
- **待真机确认**：
  1. 人机 hard 是否明显更难（五子棋 / 象棋中盘应能多算一层，且不再“送子”）；
  2. 黑白棋 / 四子棋 hard 是否仍能快速落子（实测 105~106ms，界面不应卡）；
  3. 飞行棋 AI 是否不再频繁把飞机停在对手身后 1~6 格；
  4. 大富翁 hard 是否更积极抢成套最后一块（竞拍更凶），但不会因此轻易破产；
  5. 长考时「思考中」与时间片让出是否仍流畅（12ms 切片不变）。

## 阶段自检（第二十六轮：全量扩展 —— 15 款玩法 / 每日挑战 / 终身成就 / 皮肤 / 残局）

- **四条主线**
  1. **每日挑战**：全部 **15 款玩法**按本地日期轮换，日期种子同时驱动该玩法的骰子 / 卡牌 / AI 并列决策 / 单人棋盘·关卡·题号；同一天重进时玩法、局面与 AI 决策完全一致，跨日自动切换。当天首次完成发 **40 棋币**并累计连续挑战天数；失败可无限重试，未完成不发奖、同日不重复发币。主页赛季条第二行显示今日挑战状态。
  2. **终身成就**：共 **42 项**，分对局 8 / 棋种 8 / 赛季 8 / 收集 8 / 每日 5 / 残局 5；达标自动解锁并自动发币、每项只发一次；进度与解锁状态终身保留，换季不重置。
  3. **皮肤与收集**：棋盘底材 3 + 骰子皮肤 3 + 棋子样式 2 + 整页背景纹样 2 = **10 套**；棋币购买、装备、持久化，重复购买不扣费，素材缺失回退默认。素材侧新增 **18 张 PNG + 4 个新玩法图标**（`src/common/img/` 现 53 张、约 681 KB）。
  4. **残局题库**：象棋 / 五子棋 / 围棋各 10 题，共 **30 题**；每题含目标、步数上限与解序列，防守方按题解最优应手；支持提示（只显示下一手）、重试、最佳步数记录，首次完成奖励 **60 棋币**。
- **四款新玩法**
  1. **国际跳棋**：8×8（英式）每方 12 兵；强制吃子、连吃链、升王、王双向走/吃；无子或无合法着判负，50 回合无吃子判和。
  2. **推箱子**：20 关，四方向移动 / 推箱 / 撤销（步数与推动数同步回退）/ 重置 / 下一关；关卡进度与每关最佳步数持久化。
  3. **数独**：9×9、90 题（简单 / 普通 / 困难各 30，唯一解）；选格 1-9、笔记、提示、撤销、计时、错误计数、自动存档与通关判定。
  4. **斗兽棋**：7×9、八兽等级吃子（鼠吃象 / 象不能吃鼠）、陷阱、河流、虎狮跳河（水中鼠阻挡）、兽穴；无子判负，50 回合无吃子判和。
- **赛季与统计**：`SEASON_ID=1`、`SEASON_NAME='初执棋子'`；赛季任务 / 商店 / 每日 / 成就 / 皮肤 / 残局统一走棋币，换季只重置赛季任务。战绩覆盖 15 款；推箱子 / 数独以 `mode=solo` 记录，进入「单人通关」，不计入胜率分母。
- **数量**：玩法 15 款；`manifest.json` 注册 **19 个页面**（新增 `draughts` / `jungle` / `sokoban` / `sudoku` / `achievements` / `puzzles`）；成就 42 项；皮肤 10 套；残局 30 题；每日挑战 15 款轮换。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **24 个测试文件 / 1393 断言 / 0 失败**；5 个必跑审计全绿。
- **三包体积**：debug **1388310 B** / jsc **1304970 B** / njsc **1204316 B**。
- **2026-10-24 修正**：赛季号回退为 **第 1 赛季「初执棋子」**（此前误改为 2；对已写入 id=2 的存档做迁移，不重置任务进度）；斗兽棋图标重绘为虎头+兽穴+河流，并把四个新玩法图标统一为与既有图标一致的 **64×64**；赛季页换装后立即刷新背景/棋子 Token。
- **已知取舍 / 风险**
  1. 国际跳棋为 **8×8 英式**：王不飞格、不强制选最长吃子链（这两条属国际跳棋规则）；
  2. 斗兽棋采用常见标准摆法；
  3. 数独难度按题面已给数字数量分档，不等同于人工难度评级；
  4. 推箱子 20 关为程序生成并经 BFS 验证可解，最短步数仅作参考；
  5. 象棋残局无 easy 档（题库实际只含 normal / hard）；
  6. 以上全部未做真机验证。
- **待真机确认**
  1. 主页 15 张玩法卡在胶囊屏 / 方屏 / 大屏方表的分栏、滚动与点击命中是否正确；
  2. 赛季条第二行「今日挑战」状态在深 / 浅主题下是否清晰，未完成 / 已完成 / 已领取三态是否准确；
  3. 每日挑战同日重进是否保持同一玩法与局面，跨日后是否切换，40 棋币是否只发一次；
  4. 成就页 42 项长列表的滚动、分类与已解锁 / 未解锁视觉区分是否正常；
  5. 皮肤购买与换装后，棋盘底材 / 骰面 / 棋子样式 / 背景是否即时生效并在重启后保持；
  6. 残局 30 题的列表入口、提示、重试、超步判负与 60 棋币首通奖励是否正常；
  7. 国际跳棋 / 斗兽棋的棋盘触控、滚动、悔棋与 AI 思考是否流畅（含 34px 触摸下限）；
  8. 推箱子方向键、撤销 / 重置，数独 9×9 选格、输入、笔记与矮屏滚动是否可用；
  9. 推箱子 / 数独通关后战绩是否显示「单人通关」且不进入胜率分母。




## 阶段自检（第二十七轮：4 款新玩法 + 闯关模式 + AI 全部重做）

- **新增 4 款玩法**
  1. **狼人杀**：9 人（3 狼 / 预言家 / 女巫 / 猎人 / 3 村民）与 6 人（2 狼 / 预言家 / 女巫 / 2 村民）双模式；夜晚刀人 / 查验 / 用药，白天 AI 发言与投票，猎人出局可开枪；支持身份揭示、观战与终局揭晓。每日挑战按日期种子固定身份分配，闯关按关卡 id 固定身份分配。
  2. **蛇棋**：100 格蛇形跑道、固定梯子与蛇；必须恰好进终点、超出原地不动、掷 6 不连掷；人机 / 双人同机轮流；骰子动画与逐格跳跃。
  3. **迷宫探险**：20 关（9×9 ~ 15×15）；钥匙 / 宝石 / 陷阱 / 药水 / 出口，初始 3 点血；迷雾视野、进度存档、每日按种子选关。
  4. **找不同**：40 关 × 5 处差异（80 张 176×176 PNG）；上下叠放、矮屏自动切换单图；计时 / 提示 / 错点扣时 / 星级；每日按种子选关。
- **闯关模式**：`src/campaign/` 提供 60 关数据（6 章 × 10 关，覆盖 19 款玩法）、星级 / 解锁 / 首通奖励纯函数、存档与统一结算 `report.js`。主页与赛季页均有入口；首通发 20~40 棋币并解锁下一关；星级只增不减；5 项闯关终身成就（`campaignLevels` / `campaignStars` 按历史最大值记账，重复通关不虚增）。
- **各玩法结算钩子**：棋盘类（game / draughts / jungle / aeroplane / monopoly / werewolf / snake）按手数或轮数评星；单人关卡类（g2048 / slide / minesweeper / sokoban / sudoku / maze / spotdiff）按得分 / 步数 / 用时评星；闯关模式不覆盖普通存档、进度与奖励。
- **AI 全部重做**：预算 100 / 600 / 1000ms；深度：象棋 1/4/5、五子棋 1/4/7、四子棋 1/5/8、黑白棋 1/4/7、跳棋 1/4/7、斗兽棋 1/3/6、围棋 1/3/6；新增根节点战术预检（一步胜 / 必堵 / 双威胁 / 防一步杀）、静态战术延伸（象棋 quiescence 4 层）与各棋种评估重写；保留根级 α 剪枝、历史启发、killer moves、迭代加深与 12ms 时间片。
- **每日挑战扩到 19 款**：新增狼人杀（种子身份）、蛇棋（种子骰子）、迷宫（种子选关）、找不同（种子选关）；`DAILY_GAMES` 兜底同步为 19。
- **配置 / 页面**：`GAME_TYPES` 扩到 19 款并新增 4 个 64×64 图标；`manifest.json` 注册 24 页；主页新增「闯关模式」入口条，赛季页新增闯关入口。
- **成就**：42 → **48 项**（新增 5 项闯关 + 1 项「十九般武艺」），分类新增「闯关」。
- **数量**：玩法 19 款；页面 24 个；闯关 60 关 / 180 星；成就 48 项；皮肤 10 套；残局 30 题；每日 19 款轮换。
- **校验**：`npm run build` 零告警、无 unsupport；`npm test` **30 个测试文件 / 3763 断言 / 0 失败**；5 个必跑审计全绿。
- **已知取舍 / 风险**
  1. 狼人杀 AI 为规则化发言与投票（非大模型推理），好人阵营胜率可能偏高；
  2. 蛇棋为纯运气玩法，闯关星级取决于轮数，重复挑战结果波动较大；
  3. 找不同素材为程序化绘制的 176×176 图，40 关各有 5 处差异，均经规则测试校验；
  4. 以上全部未做真机验证。
- **待真机确认**
  1. 主页 19 张玩法卡与「闯关模式」入口条在胶囊屏 / 方屏 / 大屏方表的布局、滚动与点击；
  2. 闯关 60 关列表的星级圆点、锁定态、首通发币与解锁下一关；
  3. 狼人杀 9/6 人局的夜晚 / 白天切换、身份揭示、投票与猎人开枪；
  4. 蛇棋 100 格棋盘的格子可读性、梯蛇跳转动画与骰子热区；
  5. 迷宫方向键、迷雾、血量与陷阱反馈；找不同上下两图的点击命中与提示；
  6. 每日挑战抽到 4 款新玩法时能否正常开局、完成与发币。

## 阶段自检（第二十八轮：UI 打磨 / 升级 / 纠错 —— 胶囊屏上下端安全区）

- **需求**：玩家要求「打磨 UI、升级 UI、纠错 UI」（指定 web-app-development / trae-design 口径）。
  trae-design 的 `.design` 画布不适用于 Vela `.ux` 工程，故按 UICraft 的 **audit → 纠错 → polish** 顺序做静态审计 + 几何复算。
- **审计依据（不是估算）**：胶囊屏短边是半圆，`R ≈ 93.5~96` 设计像素（第九轮对玩家 212×520 真机截图逐行取色的实测结论）。
  屏幕在高度 y 处的可见左右边界 `xmin(y) = R − √(R² − (R−y)²)`；倒过来，宽 W 的元素要**完整**落在屏内，
  距上/下端点至少要让出 `safe(W) = R − √(R² − (W/2)²)`：**W=176 → 57.6、168 → 49.5、148 → 34.8、144 → 32.5、140 → 30.3**。
  真机可见边界比理论圆略紧 1~3px（截图带机身黑边），故所有让位值在此基础上再留约 4px。
- **纠错 ①：内容页顶栏（8 页）** —— 返回钮是 44×44 圆钮、左沿 x=16 → 圆心 (38, margin+22)。
  `margin-top: 24` 时圆心到顶部圆弧中心 (96,96) 的距离 **76.6 > R−r = 74**（圆钮被切掉约 2.6px，弦长约 21px）；
  抬到 **32** 后为 71.6，整枚圆钮落回屏内。改动落在 about / achievements / campaign / help / puzzles / season / settings / stats 的
  `@media screen and (shape: pill-shaped) { .topbar { margin-top: 32px } }`，方屏（矩形屏）不受影响。
- **纠错 ②：新页面底部操作行** —— 原先都按「方屏思路」只留 4~6px 底边距，胶囊屏上整行两端会被底边半圆切掉：
  - **狼人杀**底栏（176 宽）：`padB` 6 → **62**（收口后正文仍为 296px 滚动区，490 画布）；
  - **蛇棋**状态行 + 底部操作行（176 宽）：`topSafe / bottomSafe` 56 → **62**；
  - **迷宫**功能键行（最靠下的一行）：行宽 176 → **148 居中**（4×34 + 3×4，按钮仍 ≥34 触摸下限），底边距 32 → **40**，
    标签「上一关 / 下一关」→「上关 / 下关」（34 宽按钮内 3 个汉字会顶到描边）；方向键行位置不变（在其上方，本就安全）；
  - **找不同**底部两行：行宽 176 → **144 居中**（3 枚各 45、字号 12），底边距 6 → **38**；关卡列表滚动视口底部让 62，
    末行关卡可滚到圆弧之外。代价：A/B 图由 147 → **131**（490 画布）/ 121（471 画布），仍在可辨范围内。
- **纠错 ③：闯关列表** —— 长列表末尾补 40px 兜底空白（`isPill` 条件绑定，方屏不补），末行关卡可以滚到圆弧之外完整显示。
- **打磨 ④：狼人杀开局** —— 模式 chip 字号 11 → **14**（主选项不再比说明文字还小）；底栏文案「开始游戏」→「开始对局」，与蛇棋统一。
- **其他设备（玩家提醒「别忘了还有其他设备的」）** —— 所有让位都走 `isPill ? … : 原值`，方屏 / 大屏方表零改动；
  找不同字号也改回 `isPill ? 12 : (compact ? 13 : …)`，避免方屏 compact 被误降到 12。7 个屏型档位离线复算（脚本在项目外）：

  | 屏型（设计画布） | 找不同 图/按钮/字号 | 迷宫 盘视口/键 | 狼人杀 正文/底栏距 | 蛇棋 盘视口/板 |
  |---|---|---|---|---|
  | 胶囊 192×490 | 131 / 45×34 / 12 | 196 / 34×4 | 296 / 62 | 294 / 176 |
  | 胶囊 192×471 | 121 / 45×34 / 12 | 177 / 34×4 | 277 / 62 | 275 / 176 |
  | 胶囊 192×355 | 147 / 45×34 / 12 | 129 / 34×4 | 181 / 62 | 159 / 159 |
  | 胶囊 192×300 | 92 / 45×34 / 12 | 74 / 34×4 | 126 / 62 | 104 / 104 |
  | 方屏 192×228 | 110 / 56×34 / 13 | 94 / 41×4 | 142 / 4 | 156 / 156 |
  | 方屏 192×300 | 176 / 56×34 / 13 | 166 / 41×4 | 214 / 4 | 228 / 176 |
  | 大屏方表 192×427 | 146 / 56×34 / 12 | 228 / 35×4 | 323 / 6 | 361 / 176 |

  断言：胶囊屏各行 `safe(W) ≤ 让位值`、找不同图 ≥64、底部按钮宽 ≥34、迷宫功能键行左右均在 0~192 内且下沿正好等于 `pageH−bottomPad`、
  蛇棋 `hudH+视口+操作行+底部安全区 = pageH`（不溢出）；方屏不套用圆弧口径。
- **校验**：`npm run build` **零告警、无 unsupport**；`npm test` **30 个测试文件 / 3763 断言 / 0 失败**；5 个必跑审计全绿；
  编译产物核对：`build/pages/maze/maze.js` 含 `isPill ? 40 / isPill ? 34`、`spotdiff.js` 含 `isPill ? 144 / 38 / 62`、
  `werewolf.js` 含 `isPill ? 62`、`snake.js` 含 `isPill ? 62`；8 页编译后的 CSS 均含 `screen and (shape:pill-shaped)` + `marginTop: 32px`。
- **三包体积**：debug **2165592 B** / jsc **2039477 B** / njsc **1893358 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v28-*.rpk`）。
- **待真机确认**
  1. 胶囊屏上 8 个内容页的圆形返回钮是否完整（不再被顶部圆角削掉一小段）；
  2. 狼人杀底栏「开始对局 / 进入投票 / 弃票」整条不再被底部圆角切成尖角；
  3. 蛇棋顶部状态行与底部「骰子 / 掷骰 / 菜单」两端是否完整；
  4. 迷宫「上关 / 重置 / 帮助 / 下关」四枚按键的圆角与文字是否完整、方向键是否仍好用；
  5. 找不同两行按钮是否完整可点，A/B 图缩到 131 后差异点是否仍看得清；
  6. 闯关列表滚到底时，第 60 关卡片能否完整露出。

## 阶段自检（第二十九轮：逐设备深度排版 —— 方屏统一宽度 + 狼人杀方屏密度）

- **背景**：玩家要求「对每个设备都进行深度 UI 适配、优化、打磨和排版」。第二十八轮只保证胶囊屏不裁切，方屏 / 大屏方表全部走原值，等于没做排版适配。
- **逐页审查（4 类屏型 × 24 页；静态检查 + 离线复算）**
  1. 除 start 与 4 个固定版面单人页（g2048 / slide / minesweeper，前几轮已有 compact 分支）外，其余页面都是「顶栏 + 原生 scroll 正文（+ 底栏 / tabbar）」，rect 228 上**不存在溢出或点不到的控件**，因此不需要在 `config.js` 里给任何玩法加屏幕限制。
  2. **修掉的排版不齐（方屏）**：战绩（`.summary` / `.g-row` / `.r-row`）、关于（`.hero` / `.info-block` / `.thx`）、玩法介绍（`.h-row`）在 `shape: rect` 下仍是胶囊屏的 **168**，而正文宽 176 → 左右各空 4px、右边缘差 8px；统一到 **176**（内边距不变）。
  3. **狼人杀方屏密度**：192×228 上正文只有 142px。`sec-label` 外边距 7/4 → 4/3、阶段卡 / 角色卡内边距 6/7 → 5/6、玩家 / 目标 / 发言行间距各 −1px，可见高度约 +16px；427 大屏方表同样命中（只是留白变紧，不影响可读性）。
- **各设备可用性（最受限的 rect 192×228）**：找不同图 **110**（≥64 下限）、迷宫盘视口 **94**（格宽固定 17 + 原生 scroll）、狼人杀正文 **142**、蛇棋棋盘 **156**、闯关列表 **91**、战绩 / 成就 / 赛季 / 设置 / 关于 / 玩法正文 110~164 —— 全部可操作。
- **明确不做（避免无依据改动）**
  1. 大屏方表（427，`uiScale 0.8`）只收敛内联绑定值，CSS 固定值（卡片 85 / 66、标题 18 等）不随之缩放；要让 CSS 也收敛需要按屏宽 dp 的媒体查询，本工程**未验证**该语法，故不动。
  2. 不为 rect 228 单独再做一套字号档：现有 compact 分支 + 滚动已可读，缩字号会连带伤到 427。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本新增 5 类 CSS 断言（战绩 / 关于 / 玩法介绍的 rect 176、狼人杀 rect 密度、8 页 pill 顶栏 32）全部通过；编译产物已核对 `.summary/.g-row/.r-row` 的 `width:"176px"` 与 `condition:"screen and (shape:rect)"` 同块。
- **三包体积**：debug **2165737 B** / jsc **2039571 B** / njsc **1893452 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v29-*.rpk`）。
- **待真机确认**
  1. 方屏 228 上战绩 / 关于 / 玩法介绍的卡片是否与正文右边缘齐平（不再差 8px）；
  2. 狼人杀方屏一屏能否同时看到「阶段卡 + 角色卡 + 第一行目标」；
  3. 427 大屏方表上这些 176 卡片是否仍居中、留白是否协调。

## 阶段自检（第三十轮：老页面逐设备补齐 —— 开局面板宽度 / 数独与推箱子底栏）

- **背景**：玩家追问「还有之前呢？之前的呢？不光现在新增的」—— 前两轮只覆盖新增页与 8 个内容页，项目原有的对局页 / 单人页还没逐设备过一遍。
- **扫描方式**：脚本提取全部 24 页的 `@media (shape: rect)` 块与「宽度 168 / 176」规则做交叉比对（无 rect 块的页面为零，说明历史轮次都写过，但内容深浅不一）。
- **补齐的问题**
  1. **6 个对局页的开局面板 / 匹配加载页 / 整宽按钮**（game / draughts / jungle / monopoly / aeroplane / 蛇棋）在方屏下仍是胶囊屏的 **168** → 统一 **176**（两侧各留 8）；大富翁 / 飞行棋 / 跳棋 / 斗兽棋的选项 chip 同步加宽（仍单列），抽屉保持 86×36 双列。
  2. **数独（真缺陷）**：功能键行 5 枚共 **174 宽**、距屏底只有 **6px**。胶囊屏底边半圆在距底 23px 处可见宽仅 **125px**（键位 9~183），最左 / 最右两枚的**文字落在屏外**。现 `bottomPad 6 → 56`（174 宽整行需 55.4）。棋盘为固定格宽 9×18=172，视口 490→206、471→187、355→85，前两者整盘仍完整可见。
  3. **推箱子**：控制区原贴底 6px。高画布控制区本就 **110 宽**（让位 30.3 足够）→ `bottomPad 34`；矮画布把控制区从 176 收到 **148 居中**（方向键 4×34 + 3×4、功能键 3×46、进度键 2×72，均 ≥34）→ `bottomPad 40`。10×10 棋盘格宽仍为 **17**（宽度限制），490 画布视口 184 整盘可见，471 视口 165 仅需滚动约 5px。
  4. 找不同关卡列表总数行 168 → 176（方屏）。
- **未动的旧页面（有依据）**
  1. 2048 / 数字华容道 / 扫雷：底部控件行由 `slack` 居中分配，胶囊屏实测下沿余量 40~78px（490/471/355），无需再抬；仅 300 这种极矮画布会贴边，但现实中无对应机型。
  2. 大富翁 / 飞行棋 / 棋类对局页的**底部抽屉**：两端仍会丢圆角，但标签居中、可点（第九轮已记录为取舍）；抬升 56px 会让 228/300 画布上的抽屉顶部被裁，得不偿失。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本扩展到 7 档 × 6 页（新增数独 / 推箱子）并新增 8 条 CSS 断言，全部通过。
- **三包体积**：debug **2165972 B** / jsc **2039774 B** / njsc **1893613 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v30-*.rpk`）。
- **待真机确认**
  1. 胶囊屏进数独：底部「笔记 / 提示 / 撤销 / 重来 / 检查」五枚是否全部可读可点；
  2. 胶囊屏进推箱子：方向键与「撤销 / 重置 / 下一关」是否完整，整盘是否仍基本一屏放下；
  3. 方屏 228 上 6 个对局页的开局面板是否贴齐左右（各留 8px），选项 chip 是否仍单列可点。

## 阶段自检（第三十一轮：双轨口径回正 —— 胶囊屏专属设计 / 其他设备共用一套）

- **玩家提醒**：胶囊屏是一套单独设计，其他设备共用一套；要求对比新写页面与老页面。核对后确认新增页确实跑偏了。
- **对比结论**
  | 维度 | 老页面（战绩 / 残局 / 闯关 / 设置 / 赛季…） | 新增页原状态 |
  |---|---|---|
  | 默认 CSS（无媒体查询） | **胶囊屏专属**：内容卡 / 列表 **168** 宽 | 狼人杀卡片 / 底栏 **176**、找不同列表 **176** |
  | `@media (shape: rect)` | **其余所有设备共用一套 176**（不分 228 / 300 / 427） | 只改了弹窗 160，列表宽度没切 |
  | 底栏让位 | 由宽度反解 | 狼人杀按 176 算成 **62** |
  | 按钮文案 | 按钮够宽就用三字「上一关」 | 迷宫为了胶囊屏 34 宽按钮改成两字，**连方屏一起改了** |
- **回正**
  1. **狼人杀**：默认档 `.body / .pane / 阶段卡 / 角色卡 / 目标行 / 发言卡 / 玩家行 / 日志 / 底栏` 统一 **168**，`@media (shape: rect)` 统一 **176**；底栏让位 62 → **54**（168 宽整行需 49.5 + 4px 余量）。胶囊屏正文反而多出 8px：490 画布 296 → **304**，471 → **285**。
  2. **找不同关卡列表**：默认 `.list-head / .list-body / .lv-row` **168**（行内 `.lv-main/.lv-sub` 152），`@media (shape: rect)` **176**（行内 158）；`list-sum` 方屏 176。
  3. **迷宫功能键标签**：按屏型分开 —— 胶囊屏 34 宽按钮「上关 / 下关」，方屏与其他设备仍「上一关 / 下一关」（41 / 35 宽按钮放得下）。新增 `pLabel / nLabel`，在 `layout()` 里按 `isPill` 赋值。
  4. **其余口径核对一致**：HUD 176、棋盘 / 图片 176、弹窗 150 / 160、按钮 130×40 / 140×34。
- **护栏**：离线脚本新增 4 条双轨断言 —— 狼人杀默认档 `.pane/.bar-btn` 必须 168 且 rect 块必须 176；找不同列表默认 168 且 rect 176。以后再想把方屏值写进默认档会被直接拦下。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本 7 档 × 6 页 + 双轨断言全部通过。
- **三包体积**：debug **2166217 B** / jsc **2039954 B** / njsc **1893753 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v31-*.rpk`）。
- **待真机确认**
  1. 胶囊屏狼人杀：卡片与底栏比原来窄 8px 后观感是否更贴近其他内容页；
  2. 方屏狼人杀仍为 176 宽（卡片贴齐左右各 8px）；
  3. 方屏迷宫功能键文字已恢复「上一关 / 下一关」且不溢出。

## 阶段自检（第三十二轮：显示优先 —— 方屏推箱子按钮重排）

- **玩家反馈（附方屏真机截图）**：「你确定能玩吗？从今往后你要记住，显示是最主要的，按钮的话，想办法。」
- **截图取证（192×228 方屏，按 2× 像素折算设计尺寸）**：棋盘视口只有约 **54~62px**（10×8 关卡仅露出 3 行）；底部三行按钮（方向 34 + 撤销/重置/帮助 34 + 上一关/下一关 34 + 缝）占 **112px**；顶栏 42px。
- **长期原则（已写入 README 与项目记忆）**：**显示区优先**；按钮不得把显示区挤到看不见；空间不足时把次要动作收进抽屉/菜单，只留高频操作一行。
- **推箱子改法**
  1. 矮画布（`pageH < 400`，含方屏 228/300 与胶囊 355/300）底部只留**一行** 5 枚：`撤销 + 左/上/下/右`（34×5 + 2px 缝 = **178**，高 34）；
  2. `重置 / 帮助 / 上一关 / 下一关` 收进顶栏「菜单」抽屉（方屏双列 86×36、胶囊单列 168×44）；
  3. 顶栏多一枚 34×34 菜单键 → 文字收为「N/20 关」，最佳步数保留在高画布档；
  4. 胶囊屏底部让位按 178 宽反解 = **60.0** → 取 **62**；方屏（矩形屏）保持 6；
  5. 新增「人」跟随滚动（与 maze 同口径）：棋盘比视口高时把人物滚到视口中心，进关 / 每次移动 / 撤销后各触发一次；
  6. 高画布（471/490/427）不动：三行按钮 + 最佳步数照旧。
- **复算（7 档）**：推箱子视口 —— 胶囊 490 **184**、471 **165**、355 **155**、300 **100**；方屏 228 **140**、300 **212**；大屏方表 427 **210**。10×8 关卡（172×138）在 ≥350 的六个档位全部**整盘可见**；10×9（172×155）在 490/471/355/300方屏/427 上整盘可见，228 方屏差 15px（人物跟随滚动兜底）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本新增「推箱子 10×8 必须整盘可见」与「单行 + 菜单抽屉」断言，全部通过。
- **三包体积**：debug **2167494 B** / jsc **2041114 B** / njsc **1894596 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v32-*.rpk`）。
- **同类待办（同一原则，下一批）**
  1. **数独**：方屏 228 视口仅 **64px**（9×9 只露 3 行），键盘两行 70 + 功能键 34 是主因。键盘无法常驻又要显示整盘 → 需要「选中格后浮层出 1-9、落数后收起」的交互改造（不能简单挪进抽屉）。
  2. **迷宫**：方屏 228 视口 **94px**（格 17px，靠人物跟随滚动已可用），可把 上关/重置/帮助/下关 也收进抽屉，视口可到 ~132。
- **待真机确认**
  1. 方屏 228 推箱子：10×8 关卡是否整盘可见、格内文字可读；
  2. 底栏「撤销 + 四方向」5 枚是否好按（撤销在最左、间距 2px）；
  3. 顶栏「菜单」是否好点，抽屉里 4 项是否完整；
  4. 胶囊 471/490 上底栏只剩一行后，棋盘上方是否出现过多留白（可再决定是否回收）。

## 阶段自检（第三十三轮：显示优先 —— 数独 / 迷宫 / 找不同 同步收口）

- **玩家追问**：「除了这个不还有别的页面也这种问题吗？修了。」按同一原则扫完剩余页面。
- **三页改法**
  1. **数独（最严重，64px）**：键盘从常驻两行改为**浮层**（选中格 → 浮出 1-9 → 落数/擦除即收起，不占布局高度），功能键（玩法介绍/笔记/撤销/提示/缩放/难度）收进顶栏「?」抽屉（方屏双列 86×36）；胶囊屏浮层 174 宽 → 底部让位 **60**；盘视口 64 → **180**，整盘 9×9（172）完整可见。
  2. **迷宫（94px）**：上关/重置/帮助/下关 进顶栏「菜单」抽屉，底部只留一行方向键；让位：矮画布 176 宽 → 62、高画布功能键 148 宽 → 40；盘视口 94 → **130**（胶囊 355：129 → **145**）；顶栏两行改短（`1/20 关 · HP3` / `步0 钥0/1`），宝石计数保留在高画布档。
  3. **找不同（110px）**：矮画布第二行（上一关/下一关/关选）进抽屉，第一行 4 枚（提示/重试/看B/菜单，34 + 2px 缝 = 142）保留，字号 10；单图 110 → **148**（胶囊 355：147 → **176**）。
- **复算（7 档，改后）**
  | 页面 | 胶囊 490 | 471 | 355 | 300 | 方屏 228 | 方屏 300 | 大屏方表 427 |
  |---|---|---|---|---|---|---|---|
  | 数独盘视口 | 206 | 187 | **197（整盘）** | 142 | **180（整盘）** | 252 | 254 |
  | 迷宫盘视口 | 196 | 177 | **145** | 90 | **130** | 202 | 228 |
  | 找不同图 | 131 | 121 | **176** | 130 | **148** | 176 | 146 |
  （490/471/355 的数独与 490/471 的迷宫、490+471 的找不同仍走原非矮画布档，数值不变。）
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本新增「数独整盘 9×9 必须可见」「迷宫/找不同 抽屉 + 单行」断言，全部通过。
- **三包体积**：debug **2170026 B** / jsc **2043056 B** / njsc **1896055 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v33-*.rpk`）。
- **待真机确认**
  1. 方屏 228 数独：整盘 9×9 是否完整；点格后键盘浮层是否好按、落数后是否收起；「?」抽屉 6 项是否完整；
  2. 方屏 228 迷宫：底部只剩方向键后盘面是否明显变大；顶栏两行短文案是否不挤；「菜单」抽屉 4 项；
  3. 方屏 228 找不同：单图是否明显变大；四枚按钮是否好按；抽屉里关卡切换是否顺手。

## 阶段自检（第三十四轮：缩放补齐 —— 迷宫 / 推箱子，仅胶囊屏）

- **玩家提醒**：「之前的游戏都有缩放功能，新加的难道没有吗？仅胶囊瓶哈。」
- **核对**：缩放已有 —— 棋类对局页 / 大富翁 / 飞行棋（抽屉「放大棋盘」）、蛇棋（脚栏菜单）、数独（功能键「放大 / 缩小」）。缺失 —— **迷宫、推箱子**。找不同为 176 原生位图（放大会插值、无新细节）、狼人杀无棋盘，不做。
- **补法（仅胶囊屏 `isPill`）**
  1. **迷宫**：`zoom` 状态 + `ZOOM_CELL=28`；放大档 9×9 = 242、15×15 = 434（视口 176 → 原生 scroll）；1~2 格宽从 11~19 → 28；入口为顶栏「菜单」抽屉第一项（放大棋盘 / 还原整盘），切换后 `layout + rebuild + syncHud` 并把人物滚到中心。
  2. **推箱子**：同口径，`ZOOM_CELL=30`；10×8 = 300 × 240（亮格 0 缝），视口 176 → scroll；人物跟随在每步 / 撤销 / 进关后照旧。
  3. **顶栏**：菜单按钮由「仅矮画布」放宽到「仅胶囊屏」（高画布胶囊也有缩放入口）；顶栏文字因此改短（`1/20 · HP3`、`N/20 关`），方屏保留完整文案与最佳步数。
  4. 方屏 `shape: rect` 不渲染菜单按钮、不显示缩放项（`zoom` 只在 `isPill` 时生效）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本 7 档复算通过（缩放档为内容超出视口 → 原生 scroll + 人物跟随，属既定交互）。
- **三包体积**：debug **2170356 B** / jsc **2043379 B** / njsc **1896305 B**（备份在项目外 `D:\andlua\_yqart_work\out\yiqi-v34-*.rpk`）。
- **待真机确认**
  1. 胶囊屏迷宫：「菜单 → 放大棋盘」后棋盘是否明显放大、拖看是否跟手、人物跟随是否把人带回视野；
  2. 胶囊屏推箱子：放大后 10×8 棋盘拖看是否顺手、箱子/目标是否仍分得清；
  3. 方屏上迷宫/推箱子不应出现「菜单」按钮与缩放项。

## 阶段自检（第三十五轮：正式包加 png8 编译参数）

- **玩家要求**：「正式包编译参数加上 png8。」
- **官方依据**：`npx aiot release --help` 明确列出 `--enable-image-png8`（"translate image to png8"），无需猜测参数名。
- **改动**：`package.json` → `release: aiot release --enable-jsc --enable-image-png8`；`release:jsc: aiot release --enable-jsc --drop-console true --enable-image-png8`。手动出的无 JSC 正式包同样加 `--enable-image-png8`；调试包（`npm run build`）保持不加，便于审计原图。
- **实测（解包逐张读 PNG 头）**：三包内 **140/140** 张 PNG 的 color type 全部为 **3（调色板）**、位深 8-bit；PNG 负载合计 **955,279 B**。样例：`ic_chess.png` 7,190 → **4,170 B**；`bg_dark.png` 27,039 → **24,987 B**；`ic_werewolf.png` → **2,924 B**。
- **包体变化**：JSC **2,043,379 → 1,730,768 B（−312,611 / −15.3%）**；无 JSC **1,896,305 → 1,583,687 B（−312,618 / −16.5%）**；带 console 的正式包 **2,170,356 → 1,584,975 B（−27.0%）**。
- **画质影响（PIL 逐像素）**：`ic_chess` 最大单通道差 **103**、`brand` **51**，透明像素数未变（调色板仍带 alpha）；图标显示尺寸仅 30~36px，量化误差集中在边缘，评估为可接受。若真机观感不可接受，删掉参数即可回退（无代码依赖）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿（审计仍读未压缩的调试包，素材路径与页面特性不受影响）。
- **产物**：`dist/` 三份 —— JSC **1,730,768 B**、无 JSC **1,583,687 B**、调试包（dev build，未 png8）**2,170,352 B**；`D:\andlua\_yqart_work\out\yiqi-v35-*.rpk` 另存带 console 的正式包 **1,584,975 B**。
- **待真机确认**
  1. 图标 / 品牌图 / 找不同 A/B 图 / 棋盘底材在 png8 下是否出现明显色带或边缘锯齿；
  2. 深浅两套主题的背景纹样是否仍平滑（本来已是 256 色量化）。

## 阶段自检（第三十六轮：找不同双击放大灯箱 + 新页面多级缩放）

- **玩家要求**：① 找不同「双击图片 → 弹窗式放大」；② 新加页面缩放只有一级，老页面（五子棋）有多级。
- **多级缩放（仅胶囊屏）**
  1. **迷宫 / 推箱子**：布尔 `zoom` 改为 `zoomIdx + zoomSteps`（`[1, 1.3, 1.7, 2.2]`），抽屉两项「放大棋盘 / 缩小棋盘」、到顶/到底 `disabled`；`cell = round(基准格宽 × 系数)`，放大后棋盘超出视口 → 原生 scroll + 人物跟随。
  2. **蛇棋**：`ZOOM=2` 单档改为 `ZOOM_STEPS [1, 1.4, 1.8, 2.4]` + `zoomIdx`；`boardPx = base × 系数`，抽屉同样是放大/缩小两项；`zoomed` 由 `zoomIdx > 0` 派生（stage 尺寸逻辑不变）。
  3. 方屏 `shape: rect` 不渲染菜单按钮 → 拿不到缩放入口；`zoomIdx` 在 `isPill` 之外恒按 1 倍计算（迷宫/推箱子）或 0 档（蛇棋）。
- **找不同双击放大灯箱**
  1. 判定：同一处 **320ms** 内第二次点击（位置差 ≤ 0.10 归一化 ≈ 17.6 设计像素）→ 打开灯箱；单击**延迟 300ms 落账**（`pendingTap`），双击时取消这笔标记，不会误记差异、不会误加错误数；不同位置连点则先补落上一笔再计时。
  2. 灯箱：整屏遮罩（`rgba 0,0,0,0.82`）+ 24px 顶距 + 176 宽标题行（标题「放大查看 · A/B」+ 52×34「关闭」）+ 176 宽滚动窗（高 `pageH-76`）；图按 **2×（352）** 渲染，可拖看局部；点遮罩或「关闭」退出，系统返回键也先关灯箱。
  3. 二进制兼容：A/B 叠放档放大点中的那张，矮画布放大当前单图（标题显示 A/B）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本新增 4 条断言（三页多级缩放、双击灯箱），全部通过。
- **三包体积**：JSC **1732052 B** / 无 JSC **1584634 B** / 调试包（dev build，未 png8）**2171670 B**；`D:\andlua\_yqart_work\out\yiqi-v36-*.rpk` 另存带 console 的正式包。
- **待真机确认**
  1. 找不同：单击标记是否仍跟手（有 300ms 延迟）、双击是否稳定打开灯箱、灯箱里拖动是否顺畅；
  2. 胶囊屏迷宫/推箱子/蛇棋：放大/缩小逐级切换是否正常、到顶/到底是否禁用、棋盘拖看与人物跟随是否顺畅；
  3. 方屏上不应出现任何缩放入口。

## 阶段自检（第三十七轮：图片瘦身）

- **玩家要求**：「缩小图片体积。」
- **盘点（脚本读尺寸/模式/字节）**：`src/common/img` 共 138 张 PNG、**1,132,231 B**；大件是 6 张棋盘底材（各 26~55 KB）、2 张整页背景（各 26 KB）、19 张骰面（128×128）、96×96 棋子/飞机、64×64 棋种图标、192×192 品牌徽标、80 张找不同 A/B 图（各 4~6 KB）。
- **改法**
  1. **删无引用素材**：`tex_grain.png`（82,086 B）——全仓 grep 无引用（早期棋盘纸纹已被否决）；`manifest_icon.png`（81,452 B）——manifest 的 `icon` 指向 `common/icon.png`。
  2. **按显示尺寸降采样**：骰面 128→**96**（显示上限 43 = 38×1.14 过冲）、棋子/飞机徽章 96→**64**（显示 22~36）、棋种图标 64→**48**（显示 36/30）、品牌徽标 192→**96**（关于页 48、标题行 24）、房产标记 128×60→**64×30**（当前无页面引用，仅保留占位）。
  3. **调色板重编码**：A/B 图 256→**64 色**（平面配色）；骰面/棋子/徽标 **128 色**；图标 **96 色**；棋盘底材 6 张与背景 4 张 256→**128 色**。
- **结果**：素材 **1,132,231 → 335,771 B（−796,460 / −70.3%，张数不变 138）**；棋盘底材 249,662→46,927 B、背景 61,052→13,252 B、A/B 图 381,370→约 230 KB、骰面 19 张约 −105 KB。
- **画质实测（PIL 逐像素最大单通道差）**：图标 ≤25、骰面 ≤23、A/B 图 ≤24、棋盘底材 ≤25、背景 ≤12、品牌图 ≤36（含 alpha）；均为调色板量化误差，按实际显示尺寸（36~176）评估可接受。原图已完整备份到项目外 `D:\andlua\_yqart_work\imgbak`。
- **包体**：三包 PNG 负载 **955,279 → 493,789 B（−48.3%）**；JSC **1,732,052 → 1,257,220 B（−474,832 / −27.4%）**、无 JSC **1,584,634 → 1,109,800 B（−31.0%）**、调试包 **2,171,670 → 1,360,177 B（−37.4%）**。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿（含「素材路径全部存在」—— 证明删掉的两张确实无引用）；离线脚本 7 档复算通过。
- **待真机确认**
  1. 棋种图标 64→48、品牌徽标 192→96 后是否仍锐利（尤其透明圆角边缘）；
  2. 骰面、棋子/飞机、找不同 A/B 图量化后是否出现色带或边缘锯齿；
  3. 深浅两套主题的棋盘底材与整页背景在 128 色下是否仍平滑。

## 阶段自检（第三十八轮：赛季 / 闯关进 Tab 栏）

- **玩家要求**：把赛季和闯关放进 Tab 栏；主页的「第几赛季 + 金额」卡片不变；胶囊屏延续单列往下排。
- **改动**
  1. `pages/index` 底部 tab 由「战绩 / 设置」扩为 **赛季 / 闯关 / 战绩 / 设置**（`openSeason / openCampaign / openStats / openSettings`）。
  2. 胶囊屏（`shape: pill-shaped`）保持单列：`.tabbar` 高 **168**（4 × 40 + 8 底部让位）、`.tab` 整宽 192 × 40，字号 13；方屏一行四枚（各 48 × 38，tabbar 44）。
  3. 主页列表里的「闯关模式」入口条移除；`campaignText` 数据、`campaignStore / campaignCore` 依赖与 `onShow` 的闯关存档读取一并删除（少一次异步读取）。「第 N 赛季 · 棋币 N / 今日挑战」卡片原样保留。
  4. `scripts/check-all.py` 主页断言：`campaign-bar` → `赛 季` / `闯 关`（仍在包里）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本 7 档复算通过。
- **三包体积**：JSC **1252681 B** / 无 JSC **1106044 B** / 调试包（dev build，未 png8）**1354945 B**。
- **待真机确认**
  1. 胶囊屏底部 4 行 tab 是否好点、每行 40 高是否够；
  2. 胶囊屏主页剩余滚动区是否够用（168 高的 tab 栏占掉约 1/3 屏）；
  3. 方屏一行 4 枚 tab（各 48 宽）文字是否不挤。

## 阶段自检（第三十九轮：方屏主页字号收紧）

- **玩家反馈（附 192×228 方屏截图）**：「字太大了。太丑了。优化一下。」
- **截图取证**：标题 18px、赛季卡 46 高（名/币 13px、今日 11px）、玩法卡名 14px、底部 4 个 tab 13px —— 在 192×228 画布上整体偏大，字重与留白比例失衡。
- **改动（仅 `shape: rect`，胶囊屏不动）**
  1. 标题：18 → **16**（行高 24→20，高 20）；品牌徽标 20→**18**；标题行顶距 14→**12**。
  2. 赛季卡：高 46 → **40**，圆角 23 → **20**，左右内边距 14 → **12**；赛季名 / 棋币 13 → **12**（行高 18），今日挑战 11 → **10**（行高 13、高 13）。
  3. 玩法卡：卡名 14 → **12**（行高 16）；副标题 11 → **9**（内联字号无法被媒体查询覆盖，新增 `isRect / subFs` 由脚本按屏型收敛，胶囊屏仍跟随用户字号档）；图标 30 → **26**、图标下间距 5→4。
  4. 底部 tab：13 → **11**，行高 38 → **36**（tab 栏 44 不变）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿；离线脚本 7 档复算通过。
- **三包体积**：JSC **1252825 B** / 无 JSC **1106176 B** / 调试包（dev build，未 png8）**1355102 B**。
- **待真机确认**
  1. 方屏主页标题、赛季卡、玩法卡名/副标题是否比例协调（不小到读不清）；
  2. 副标题 9px 在方屏上是否仍可读；
  3. 胶囊屏主页字号未被波及（应保持原样）。

## 阶段自检（第四十轮：确认实机为红米 Watch 5，校正屏型画像）

- **玩家说明**：「我这个是红米 Watch 5。」
- **校正后的画像**：红米 Watch 5 = **216dp 宽 / 432×514 px**，`shape: rect`；`utils/screen.js` → `scale = 192/216 = 0.889`、`designH = round(257 × 0.889) = 228`、`uiScale = 0.8`、`compact = true`。**即与「方屏 192×228」同一套几何**（上一轮按截图做的字号收紧正是针对它）。
- **修正的文档错误**：此前文档/复算表里的「大屏方表 216dp → 192×427」是**假想压力档**，实机不存在（其 427 来自误按 480dp 高度估算）；已从离线脚本的档位列表与 README 中剔除，改为 **「红米 Watch 5（216dp）→ 192×228 · UI×0.8」**。
- **复算（红米 Watch 5，`uiScale 0.8`）**：找不同单图 **148**、迷宫盘视口 **130**、狼人杀正文 **142**、蛇棋盘视口 **162**、数独 **180（整盘 9×9）**、推箱子 **140**（10×8 整盘 / 10×9 差 15px 由人物跟随兜底）—— 7 档全部通过，无新增溢出。
- **代码改动**：无（上一轮字号收紧已按 228 画布完成；本轮只是校正屏型画像与文档）。三包沿用第三十九轮产物。
- **待真机确认**：红米 Watch 5 上主页、以及各内容页/对局页的字号与留白是否顺眼；若某页仍偏大，按同一口径（CSS 字号收一档、inline 用 `isRect` 收敛）逐页再调。

## 阶段自检（第四十一轮：Tab 栏文字过长）

- **玩家反馈**：「就 Tab 栏，它这个文字太长了，你知道了吧？」
- **原因**：四个 tab 文案写成「赛 季 / 闯 关 / 战 绩 / 设 置」（中间有装饰空格），方屏一行四枚、每枚仅 48 宽，11px 下「赛 季」约占 30/48，四枚并排显得拥挤；按钮默认内边距还会再吃左右空间。
- **改动**
  1. 文案去空格：**「赛季 / 闯关 / 战绩 / 设置」**（2 字 ≈ 20px）。
  2. 方屏 `.tab` 字号 **11 → 10**（每枚 48 宽，文字占 ~20）。
  3. `.tab` 显式 `padding-left / padding-right: 0`，避免平台默认内边距挤压文案。
  4. 胶囊屏 `.tab` 12（原 13）：单列整宽 192，2 字占 ~24。
- **校验**：`npm run build` 零告警（首次构建出现一次 toolkit `afterCompile` 瞬时错误，原样重跑即成功，属临时目录竞争）；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿（主页断言同步为「赛季 / 闯关」）；离线脚本 7 档通过。
- **三包体积**：JSC **1252816 B** / 无 JSC **1106184 B** / 调试包 **1355121 B**。
- **待真机确认**：方屏四个 tab 文案是否不再拥挤、10px 是否仍清晰；胶囊屏四行是否轻快。

## 阶段自检（第四十二轮：包体太大）

- **玩家反馈**：「玩家反馈体积太大了。」
- **解包统计（无 JSC 正式包 1,106,172 B）**：PNG **493,789 B（44.6%）**、JS 源码 **2,191,407 B（压缩后约 610 KB）**、`manifest.json` 2,425 B、`app.js` 2,343 B、`i18n` 66 B。
- **图片侧已到下限**：全部调色板化（A/B 图 64 色、底材/背景 128 色、骰面/棋子 128 色、图标 96 色）且按显示尺寸降采样；实测再降到 64/48 色每张只省 65~144 B，缩小像素会牺牲清晰度 → 不再动。
- **JS 侧的结构性原因**：SDK 把 **24 个页面各自打成独立包**（`aiot release --help` 无公共 chunk 选项），每页内联 `theme / config / economy`。`config.loadSettings` 必须读皮肤、`config.recordResult` 必须调 `economy.recordMatch`，拆开会动到 19 个对局页的结算链路，风险 > 收益。
- **本轮改动**：① 默认正式包去掉 `--enable-jsc`（**1,252,820 → 1,106,172 B，−11.7%**），`release:jsc` 保留为速度优先包；② 清理 `dist/` 里历轮遗留的 40 余个旧包与解包素材（移到项目外 `_yqart_work/out/distjunk`）——此前 `dist` 里同时躺着 4.2 MB 的一次性构建残留、1.36 MB 调试包与 1.1~1.25 MB 正式包，容易误装大的。
- **实测无效项**：`--optimize-css-attr` 只省 966 B（未采用）。
- **若要更小，只有三条路（需玩家定夺）**：① 删减页面/玩法（单页包 ≈ 50~165 KB 原始、压缩后 15~45 KB，删 3~4 页约 −100 KB）；② 接受更低画质（A/B 图降到 128 见方，约 −40 KB）；③ 维持 1.1 MB（19 玩法、24 页面）。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿。
- **三包体积**：无 JSC **1106172 B（主包）** / JSC **1252820 B** / 调试包（dev build）**1355120 B**。

## 阶段自检（第四十三轮：菜单上移 + 胶囊屏单列）

- **玩家要求**：「胶囊瓶的单列排记得遵守一下；游戏页面那个菜单应该放在上面，不要跟那个放在一排。」
- **改前实况**：① 棋类对局 / 跳棋 / 斗兽棋的胶囊屏顶部把「菜单 44」和「回合胶囊 ~90」横排在同一行（`.status-pill` 为 row）；② 蛇棋把「菜单」塞在底部操作行里（骰子 + 掷骰 + 菜单）；③ 抽屉本身已是胶囊屏整宽单列 168×44。
- **本轮改动**
  1. 三页胶囊屏 `.status-pill` → `flex-direction: column`，`top: 32 → 6`，`.menu-fab` 去 `margin-right`、加 `margin-bottom: 4`：菜单在上、回合胶囊在下，整列 6→64。安全区复算：y=6 可见宽 63~129（44 宽居中完整），y=64 底边不与棋盘让位 60 冲突（仍为 4px 压边，与改前一致）。
  2. 蛇棋：菜单模板移到 `.hud`，坐标 `left 152 / top 58`（胶囊），`34×34`、字号 11；底部操作行去掉菜单，`rollRight` 改 `192−pad`，掷骰宽 ≈128；胶囊屏 `.hud-text` 宽 172→140 避免压住按钮。
  3. 抽屉口径未变：胶囊屏单列 168×44，方屏双列 86×36。
- **未改动**：大富翁 / 飞行棋的菜单在环内竖列（不在同一排）；找不同的「菜单」仍在底部第一行（方屏是 上一关/下一关 的唯一入口，移走会断路径）——若也要求上移，需把 提示/重试/看B 重排，等玩家确认。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3763 断言 / 0 失败；5 个审计全绿。
- **三包体积**：无 JSC **1106213 B** / JSC **1252857 B** / 调试包 **1355160 B**。
- **待真机确认**：胶囊屏棋类对局里「菜单」是否完整可见、回合胶囊是否仍在下方；蛇棋顶部菜单是否好点、底部掷骰是否变大；胶囊屏抽屉仍是单列。


## 阶段自检（第四十四轮：手环10 宽胶囊 + 闯关单章渲染 + 懒加载）

- **玩家要求**：「我把项目发给别人，让别人优化了一下，你看看优化了什么？」→「好的，根据这些改动，把我们其他的也进行优化。」并在确认「胶囊屏是否按第三方改成一排并排」时回答「**是的，胶囊屏按照第三方优化的来**」。
- **第三方改动核对（52 文件，删除 195 / 新增 1536 行）**
  1. **手环10 宽胶囊识别**：utils/screen.js 新增 widePill = shape!=='rect' && sw>=100、\ontBump = widePill ? 3 : 0\；utils/config.js 的 \ontTokens(size, bump)\ 支持增量、新增 \pplyFontBump(that, layout)\，\pplyTheme\ 里 \z\ 也带 bump。
  2. **24 个页面接入**：\.ux\ 在 \cachedLayout\ 与异步 \getLayout\ 两处调用 \pplyFontBump\（index/season/campaign 用等价的内联 \
efreshFonts\；start 无内联字号，只有 CSS 块）；各页 \.css\ 追加 \@media screen and (shape: pill-shaped) and (min-width: 100)\ 宽胶囊块（字号 +3~4px、行高同步；选项 chip / 抽屉 / 主页 4 tab / 设置 2 tab 改并排，每枚仍 ≥34px；主页 tab 48×48 并整行上抬 38px 避开底部半圆）。
  3. **闯关单章渲染**：\campaign/core\ 新增 \PER_CHAPTER=10\、\chapterAt(state, ci)\、\summary(state)\；\campaign.ux\ 只渲染当前章，顶部「＜ / ＞」切章、默认跳到进度所在章，行对象 14→8 字段、配色在模板现算，\openLevel(li)\ 直接用当前章行（id/game/mode/difficulty 均随行携带，无需全局序号换算）。
  4. **运存懒加载**：\
ules/index.js\ / \puzzles/index.js\ 由「全部 require」改为按棋种 loader（题库题数经实测均为 10，固化为常量，不再为取长度载入）；\campaign/report.js\ 改为 \isCampaign\ 分支内 require（game/snake/aeroplane/monopoly/g2048/slide/minesweeper/draughts/jungle/sokoban/sudoku/werewolf/maze/spotdiff 共 14 页）。
- **官方依据（已查证，非猜测）**：媒体查询文档明确 \width / min-width / max-width\ **查询不带单位、单位为 dp**，且手环10 水平 dp = **106**、手环9 = 96、REDMI Watch 5 = 216 —— 故 \min-width: 100\ 只命中手环10；「小米手环 10 | 支持（媒体查询）」「手环9 支持 2+ 特性（shape 可用、width 3+ 不可用 → 宽胶囊块不生效）」。
- **本轮补的护栏**
  1. \	ests/campaign.js\ 新增「单章视图」套件 21 条：章号/行数/全局序号/锁状态/星数、越界与负数返回 null，以及 **\chapterAt\ 与 \chapterRows\ 逐章逐字段一致性**（防两套逻辑漂移）。
  2. 切章后 \scrollToTop\ 的延时 30ms → **80ms**（本项目既有结论：state → 渲染是异步的，过早 \$element().scrollTo\ 会静默失败）。
- **校验**：\
pm run build\ 零告警；\
pm test\ **30 文件 / 3784 断言 / 0 失败**；5 个必跑审计（check-all / backpress / backclean / opensrc / features）全绿。
- **三包体积**：无 JSC **1114475 B（主包）** / JSC **1263586 B** / 调试包 **1369342 B**（相比第四十三轮 +1.5%，为宽胶囊样式与单章渲染代码）。
- **待真机确认**：① 手环10 上主页 4 tab 整行是否完整（48×48、上抬 38px）、抽屉并排每格 82×38 是否好点；② 宽胶囊字号 +3 后，战绩/赛季/闯关等行内文字是否溢出；③ 手环9 与方屏应完全不受影响（\min-width\ 不命中）。



## 阶段自检（第四十五轮：方屏顶栏收窄）

- **玩家反馈**：「将方形屏的标题栏和返回键区域调整一下太长了，返回键太大了，超出了那个区域。」
- **实测根因**（8 个内容页共用同一套 rect 顶栏）：\margin-top 14\ + \height 44\ 的顶栏里，返回钮是 \44×44\ 且 \position:absolute; top:3\ → 底边落在 47，比栏高多出 3px（视觉上就是「超出那个区域」）；同时整块头部（14+44=58）在 228 高的方屏上占 25%，确实过长。
- **改动**（关于 / 成就 / 闯关 / 帮助 / 残局 / 赛季 / 设置 / 战绩，共 8 页，仅 \shape: rect\）
  1. \.topbar\：height **44 → 36**、margin-top **14 → 10**、padding-right 12 → 10。
  2. \.back-fab\：top **3 → 1**、size **44×44 → 34×34**、圆角 22 → 17、字号 20 → 18（**仍满足 34px 触摸下限**；season 原本没写尺寸，一并补齐）。
  3. \.title\：字号 **18 → 16**、行高 24 → 22、右内边距 10 → 8。
  4. 头部总高 **58 → 46**（省 12px 全部留给正文，符合「显示优先」）；返回钮底边 35 < 栏高 36，不再外溢。
- **未改动**：胶囊屏默认（56 / margin-top 32 / 44×44）与手环10 宽胶囊块；2048 / 华容道 / 扫雷 / 迷宫 / 推箱子 / 找不同 / 数独的顶栏返回钮本来就走 \metrics.nav\（矮画布 34×34），无需改。
- **构建异常记录**：首次与第二次 \
pm run release\ 出现 toolkit 临时目录竞争（\D:\\andlua\\.temp_yiqi\\src\\manifest.json\ 缺失 / \
imraf\ EPERM），两次都发生在连续构建之间；清理后隔 3 秒重跑即成功（与历史记录一致，属 toolkit 临时目录竞争，不是代码问题）。
- **校验**：\
pm run build\ 零告警；\
pm test\ **30 文件 / 3784 断言 / 0 失败**；5 个审计全绿；包内静态样式已确认是 \height:36px\ / \34×34\。
- **三包体积**：无 JSC **1114540 B（主包）** / JSC **1263651 B** / 调试包 **1369399 B**。
- **待真机确认**：方屏（红米 Watch 5 192×228）上 8 个内容页顶栏是否明显变矮、返回钮是否完整落在栏内、标题 16px 是否仍清晰。



## 阶段自检（第四十六轮：运存 / 卡顿整治 —— 共享模块单例 + 规则裁剪）

- **玩家反馈**：「寻找相关资料，优化 游戏性能 内存 玩家游玩时太卡，而且容易重启。」
- **资料检索（官方）**
  1. 《内存优化》<https://iot.mi.com/vela/quickapp/zh/guide/best-practice/memory.html>：不要给 viewModel 放非 UI 数据；**原地更新**优先；清定时器；用 static；**把通用模块挂到 global 上**（QQ 音乐案例：最大内存 4.84MB → 1.87MB）；低分辨率图片；减少页面数量。
  2. 《常用业务优化》<https://iot.mi.com/vela/quickapp/zh/guide/best-practice/business.html>：list 超过 10 行应分页；图片与组件同尺寸；少 order-radius + 少动态样式 + 少嵌套。
  3. 《页面路由》<https://doc.quickapp.cn/features/system/router.html>：**页面栈层数没有限制**，push 后上一页保留（隐藏页不销毁）。
  4. 《性能面板》<https://doc.quickapp.cn/tutorial/framework/analyzer-panel.html>：图片原始像素不宜 > 使用像素 ×2；首屏视口外元素不宜超过总数一半。
- **实测根因（静态取证，项目外脚本）**
  1. 每个页面被 SDK 单独打成一包：utils/config.js → storage/theme/economy → economy-core/skin-assets/rng 在**每个页面包里复制一份**。about 单页 406KB（dev）里只有 32KB 是本页代码。
  2. draughts / jungle 误用 
ules/index.js，把 8 套规则（chess 42KB + go 30KB + gomoku 20KB + …）全打进单页。
  3. 页面 JS（minified）合计 2188.5KB；最大 game 163.7KB、monopoly 132.8KB、draughts 135.9KB。
  4. 页面栈无上限 → 背景纹样 192×490（解码 368KB/页）在 3~5 页栈里占 1.1~1.8MB（本轮未动，列为待定项）。
- **本轮改动**
  1. **app.ux 单例**：config / theme / screen / storage / haptic / toast / rng / metrics / economy / core.ai / core.geometry / core.board-renderer / campaign.report 统一挂 \global.YQ\；24 个页面、**160 处 require** 改为 \global.YQ.xxx\。
  2. \draughts / jungle\ 改用各自的规则模块（\draughtsRule.create()\ / \jungleRule.create()\），不再拉整套注册表。
  3. \scripts/check-all.py\ 新增**护栏 H**：页面里出现共享模块的 \
equire\ 直接失败；并校验 \pp.ux\ 的 13 个 YQ 键齐全。
  4. 审计脚本适配新架构：\check-all.py\ / \check-opensrc.py\ / \check-features.py\ 对「共享模块里的文案/素材路径/diceFace」改为「页面包或 app.js」命中（防止误报）。
  5. **离线接线验证**（项目外脚本）：同一 fake global 依次执行 app.js 与 24 个页面 bundle（跑 \entry\ 内的页面脚本），**24/24 通过**，确认所有 \global.YQ.x\ 都能解析。
- **量化结果**
  - 页面 JS（minified）：**2188.5KB → 855.2KB（−60.9%）**；app.js **72.7KB**（共享一份）；单页 game **163.7 → 94.3KB**、monopoly **132.8 → 73.0KB**；开发包页面代码 **18.4MB → 3.94MB**。
  - 包体：无 JSC **1,114,540 → 708,534 B（−36.4%）** / JSC **1,263,651 → 780,641 B（−38.2%）** / 调试包 **1,369,399 → 794,856 B（−42.0%）**。
- **校验**：\
pm run build\ 零告警；\
pm test\ **30 文件 / 3784 断言 / 0 失败**；5 个审计全绿（含新增护栏 H）。
- **本轮明确没做（避免未验证写法）**：① 迷宫 / 数独的「原地改 for 列表子项」——项目旧结论是「循环模板 + 动态索引会漏刷」，只在官方文档与既有经验冲突时选择保守；② 背景纹样降分辨率、长列表分页——属视觉/交互取舍，等真机验证本轮包后再定。
- **待真机确认**：① 玩几局（棋类 / 骰子 / 迷宫 / 数独）是否仍卡、是否仍重启；② 页面切换与首屏是否变快；③ 若仍重启，下一步做「背景纹样降一档 + 长列表分页」。



## 阶段自检（第四十七轮：整页背景改纯色）

- **玩家判断**：「感觉背景好像没什么用，改成纯色背景其实也没什么区别，对吧？」→ 确认采用「全部纯色 + 背景皮肤改两档底色」。
- **实测（PIL 逐像素）**：bg_cloud_dark/light 亮度范围仅 27~37 / 239~250（约 10/255，几乎纯色）；bg_dark 14~64、bg_light 201~250（有可见纸纹，但在内容页留白才明显）。每页 192×490 解码约 **368KB**，页面栈 3~5 页即 1.1~1.8MB。
- **改动**
  1. 24 页删除整页 `<image class="bgtex">` 与 `bgSrc` 数据字段，`.page` 改绑 `{{t.pageBg}}`；`.bgtex` CSS 规则一并移除。
  2. `theme.get()` 新增 `pageBg`：按背景皮肤取 `surface`（素色底）/ `surfaceContainer`（层次底）；`config.applyTheme` 不再写 `bgSrc`；`theme.bgImage/currentBg`、`skin-assets.pageBg/PAGE_BG` 删除。
  3. 背景皮肤不删档：`bg_plain` → 「素色底」、`bg_cloud` → 「层次底」（价格与成就阈值不变）；赛季页分类名「背景」→「底色」。
  4. 启动页保持固定品牌深色 `#1C1B1F`；删除 4 张背景 PNG（备份 `_yqart_work/out/removed_bg`）。
  5. 审计同步：`check-all.py` 的 `bgtex / bg_dark.png` 断言改为 `pageBg`（启动页断言改为 `#1c1b1f`）。
- **事故与修复（记录）**：清理过期注释时用 `/*...*/` 正则扫全文件，game.ux 的文档注释里写了「规则来自 rules/*（工厂按尺寸创建）」—— 这个 `/*` 被当成注释起点，正则一路吃到脚本区第一个 `*/`，**误删了整个 `<template>` / `<style>` 段**（构建后 game 页脚本取不到 data）；已从第三方副本恢复 game.ux 并重放本轮改动（global 引用 / 去背景 / pageBg），24 页离线 harness 全过，审计恢复全绿。**教训：带注释剥离的正则不能扫含「/*」字样的文档注释，必须逐文件白名单。**
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3784 断言 / 0 失败；5 审计全绿；离线 harness 24/24。
- **三包体积**：无 JSC **692,679 B**（−15,855）/ JSC **764,358 B** / 调试包 **780,672 B**；素材 138→134 张、335,771→322,519 B。
- **待真机确认**：① 各页纯色底是否顺眼（尤其浅色模式的「层次底」= surfaceContainer）；② 连续切换多页后是否明显更少重启；③ 若仍重启，下一项是长列表分页（成就 48 行 / 找不同 40 行）。


## 阶段自检（第四十八轮：方屏卡片排列切换）

- **玩家要求**：「加一个卡片排列方式切换只针对方形屏。」
- **口径**（主页棋种卡；胶囊屏/宽胶囊不参与）：`shape: rect` 标题行右侧加 44×34 切换按钮（触摸下限 34），两档：
  1. **双列网格（默认）**：85×85 卡、图标 26 上置、文字居中，一屏约 4 张（与旧方屏排版完全一致）；
  2. **单列大卡**：176×56 卡、图标 30 + 名称 14/18 + 副标题 9 横排，一屏约 3 张。
- **实现**
  1. 模板：标题行加 `title-spacer`（仅 rect）+ `title-toggle`（仅 rect，值显示「列表 / 网格」= 点按后切到的排列）；`.cards` 与 `.card` / `.card-icon` / `.name` / `.card-text` 的关键布局改用**内联绑定**（`cardsDir/cardsWrap/cardsJust/cardsAlign`、`cardW/cardH/cardMB/cardDir/cardJust/cardAlign/cardPad`、`iconS/iconMR/iconMB`、`nameFs/nameLh`、`cardTextAlign`）。
  2. 脚本：`applyCardMode()` 按「屏型 + cardMode」算值；胶囊屏分支与既有 CSS 完全一致（宽胶囊名字 21/25、子标题走 `subFs`），避免内联覆盖坏；`toggleCardMode()` 仅在 rect 生效并落盘 `home_cards`；`onInit` 读偏好（非法值回 grid）。
  3. 品牌行：基础 `.title-row` 宽度 168 + `justify-content: center`（胶囊屏保持居中）；rect 下 176 + `flex-start`（左品牌、右按钮）；rect 顶距 12→8 抵消按钮带来的 14px 增高。
- **为什么不用动态 class**：本工程未验证动态 class 绑定；内联绑定是既有大量使用、已验证的路径。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3784 断言 / 0 失败；5 审计全绿（check-all 的 index 断言新增 `toggleCardMode / home_cards / cardMode / title-toggle / applyCardMode`）；离线 harness 24/24。
- **三包体积**：无 JSC **693,427 B** / JSC **765,276 B** / 调试包 **781,649 B**。
- **待真机确认**：① 方屏默认双列是否与之前一致；② 切到单列后 176×56 卡的文字是否拥挤（名称 14、副标题 9）；③ 按钮 44×34 是否好点；④ 重启应用后排列偏好是否保持。

## 阶段自检（第四十九轮：UI 设计与排版重构）

- **任务**：「将 UI 设计与排版优化重构」——不是修单个页面，而是把颜色 / 度量 / 字号 / 卡片这四层重新收口，并重排首页与内容页头部。
- **诊断（重构前）**
  1. **表面层级失效**：`pageBg` 与卡片都用 `surface`，内容页的 hero / 信息块 / 任务行 / 成就卡 / 设置行全部「看不见边界」，只剩间距在分块；弹窗用 `surfaceContainerHigh`，却和卡片没有中间层。
  2. **度量漂移**：卡片圆角 12 / 16 混用，卡片标题 13 / 15 混用，总览数字 18，段标题 12 与正文 11 只差 1px；同一类「总览卡」在 stats / achievements / puzzles / campaign 四页有 8 种写法。
  3. **首页信息密度低**：19 张 168×66 的卡平铺，无分组；胶囊屏底部 4 行 tab 占 168px（画布 1/3），可视列表只有约 250px。
  4. **内容页头部**：返回钮 + 居中标题，标题与正文之间没有任何分隔；顶栏下沿的 `border-bottom-color` 绑了颜色却没有 `border-width`，等于没画。
- **设计口径（本轮定案）**
  1. **三级表面**：页面 `surface` → 卡片 `cardBg`（`surfaceContainer`）→ 弹窗 / 抽屉 `surfaceContainerHigh`；「层次底」皮肤下页面已经是 `surfaceContainer`，卡片自动再抬一阶。发丝线 `hairline` 只用于「结构性分隔」（顶栏下沿、首页分组线、tab 坞描边），**不给固定宽卡片加 1px 边框** —— 168 / 85 窄列里边框会把盒宽顶出 1~2px，破坏对齐。
  2. **字号六角色**：display / title / heading / body / caption / micro，三档屏型（pill / rect / wide）各有取值；卡片标题统一 14；总览数字按数据长度分档（成就 / 残局 22、战绩 18、闯关 14），段标题 11 加粗 + 1px 字距。
  3. **卡片一套几何**：圆角 14、内边距 14、卡片间距 8；`common/ui.css` 作为唯一来源，页面 CSS 只保留本页特有的高度 / 列数 / 文字位置。
- **实现**
  1. `theme.js`：`get()` 新增 `cardBg`（按背景皮肤取 `surfaceContainer` / `surfaceContainerHigh`）与 `hairline`（深 `rgba(230,225,229,0.12)` / 浅 `rgba(29,27,32,0.10)`）。`pageBg` 逻辑不变。
  2. `metrics.js`：新增 `TYPE_SCALE`（三档 × 六角色）、`CARD`（r14 / pad14 / gap8）、`SPACE.section=10`；`RADIUS.card 12 → 14`、`RADIUS.chip 13 → 17`（与真实 chip 圆角一致）。`tests/metrics.js` 相应改为断言「角色顺序 + 最小字号 + CARD 与 RADIUS 对齐」，不再锁死一个中间档。
  3. 新增 `src/common/ui.css`：卡片圆角、卡片标题、三档屏型收敛；8 个内容页在本页 CSS **之后** `@import`，迁移期无需一次删干净旧规则。
  4. 内容页：`.topbar` 加 `border-bottom-width:1px` + `hairline`；标题由居中改为左对齐（胶囊屏 `padding-left 10`、方屏 `padding-left 42`，避开绝对定位的 34 返回钮）；正文顶距 10→8；段标题 11 加粗 + 字距。宽胶囊标题 26→24（4 字标题左对齐后可用宽 100，26 会溢出）。
  5. 首页：`config.GAME_TYPES` 每条加 `cat`；`index.ux` 的 `buildGroups()` 生成「棋类对弈 8 / 桌面派对 4 / 益智拼图 4 / 探索推理 3」；组头「名称 + 发丝线 + 数量」；卡片 66→58、图标 36→32、右缘箭头；赛季卡升 `primaryContainer` 品牌主卡（`onPrimaryContainer` 文字 + 状态点 + 今日挑战）；胶囊屏 tab 由 4×40 单列 168 高改为 **176×48 悬浮坞 + 54 底部让位**（第 50 轮按玩家反馈回正为 **2×2 96×48 + 8 让位**）；方屏仍 4 枚一行 + 85 网格 / 176 单列切换；**方屏双列网格合并为无组头的 all 组**（首屏完整露出第一排 85 卡），单列仍四组；宽胶囊坞 52 高 + 44 让位、卡名 18、图标 30。
- **取舍 / 已知代价**
  1. ~~悬浮 tab 坞底部让位 54（宽胶囊 44）——这是胶囊屏下沿半圆的硬约束；换来列表可视高 490 画布 250 → 305。~~ 第 50 轮改为 2×2 96×48 + 8 让位，可视高仍 305，触摸面积翻倍。
  2. 首页分组多出 4 个组头（约 128px 总高），分组后总滚动长度略增；但首屏能直接看出「有哪些类别」，且每屏仍比旧版多出约半张卡。
  3. 内容页标题左对齐后，4 字标题（玩法介绍 / 战绩大厅）在宽胶囊上必须收到 24px；这是按实测字宽（4×24=96 + 左侧 6 < 可用 100）反解的，不是随手改小。
  4. 卡片不加边框：深色下 `surfaceContainer` 与 `surface` 的对比只有约 6 个色阶，浅色约 8；真机若觉得「卡片糊在一起」，下一步优先加**卡片内高光 / 1px 内缩分隔**，而不是直接加外边框（避免盒宽漂移）。
- **校验**：`npm run build` 零告警、无 unsupport；`npm test` **30 文件 / 3798 断言 / 0 失败**（metrics +12、smoke +2）；5 个审计全绿；`check-all.py` 的 index 断言新增 `group-head / group-body / card-chev / season-dot / title-sub / buildGroups / cardBg / hairline`；离线 harness 24/24。
- **三包体积**：无 JSC **696,324 B** / JSC **769,434 B** / 调试包 **786,199 B**（较上轮 +2,897 / +4,158 / +4,550 B，主要是 `common/ui.css` 复制进 8 个内容页包 + 首页分组数据）。
- **待真机确认**：① 深色 / 浅色下 `cardBg` 的卡片是否能「看出来」；② 胶囊屏 2×2 tab（96×48）在 96dp / 106dp 上的实际触摸与底沿位置；③ 首页四组滚动是否顺手（尤其「棋类对弈」8 张在后半段）；④ 内容页左对齐标题与返回钮的间距；⑤ 宽胶囊 5 字卡名（数字华容道 / 迷宫探险）是否仍单行。

## 阶段自检（第五十轮：胶囊屏底栏纵向回正 + 方屏悬浮坞 + 对手强度）

- **玩家反馈（两轮）**：第一轮「胶囊屏那么小，dock 它能点到吗」→ 改成 2×2；第二轮「横着 dock 还是可能误触/点不到」，并要求「胶囊屏那个 dock 设计挺好看，用在方屏上」。定案：**窄胶囊一律纵向整宽**，悬浮坞只给方屏，宽胶囊用 2×2。
- **改动**
  1. ~~**窄胶囊底栏 = 4 行整宽**：主页 4 枚各 192×40（+ 8，168 高），主页可视高 241。~~ 第 53 轮按玩家要求改为 **176×80 悬浮 2×2（86×40/枚，距底 60、绝对定位覆盖列表）**，列表末尾加 160px dock-pad。
  2. **方屏 = 悬浮坞**：176×34、圆角 17、底部让位 4；主页 4 × 44、设置 2 × 86；这是把玩家喜欢的胶囊屏坞外观搬到了方屏（方屏无半圆安全区，坞可完整浮起）。
  3. **宽胶囊 = 2×2**：每枚 96×48（+ 8，共 104 高），可视高 271；106dp 屏宽足够，且比四行整宽省 80px。
  4. **对手强度可选**：设置页「自动 / 简单 / 普通 / 困难」，默认 auto 按最近 5 局人机战绩匹配；手动挡锁死；`config.chooseDifficulty` 纯函数；闯关 / 每日 / 残局固定难度不受影响。
- **取舍**：窄胶囊可视高从 305 回到 241，这是为「不误触」付的代价；但每枚从 44 宽变成 192 宽，点击落点几乎没有横向歧义。方屏反而得到更好看的悬浮坞，且 44×44 在 168dp 方屏上约 38×38dp。
- **校验**：`npm run build` 零告警、无 unsupport；`npm test` **30 文件 / 3804 断言 / 0 失败**（smoke +6：默认 aiLevel 1 + chooseDifficulty 5）；5 个审计全绿；`check-all.py` 新增底栏三档几何护栏（窄胶囊 `height:168/width:192/column`、宽胶囊 `104/96/wrap`、方屏 `176/44/radius22`）与 settings 文案断言。三包 **njsc 696,685 B / jsc 769,868 B / debug 786,664 B**（较第 49 轮 +361 / +434 / +465 B）。
- **待真机确认**：① 窄胶囊四行 192×40 是否明显好点；② 底行文字在胶囊下沿是否完整；③ 方屏 176×44 坞的圆弧与 4 × 44 文字是否拥挤；④ 设置页「对手强度」四段字距；⑤ 手动 easy / hard 后匹配标签与 AI 是否一致；⑥ 宽胶囊 2×2 是否符合预期。

## 阶段自检（第五十一轮：页面内分类 dock）

- **玩家纠正**：dock 不是全局导航，必须和当前页内容相关、给本页内容分类；上一版「赛季/闯关/战绩/设置」四页同一套是错的。
- **改动**
  1. **赛季**：dock = 每日 / 任务 / 商店 / 皮肤；正文按 `tab` 只渲染对应板块，切换后 `scrollTo(0)`。
  2. **战绩**：dock = 总览 / 棋种 / 最近。
  3. **闯关**：dock = 全部 / 可挑战 / 已通关；`applyFilter()` 只筛当前章 10 行，`openLevel` 仍按下标取行。
  4. **残局**：dock = 象棋 / 五子棋 / 围棋；`viewGroups` 只保留当前题库分组，缺组时兜底第一组。
  5. 几何统一走 `common/dock.css`（胶囊 176×80 悬浮 2×2 / 方屏 176×34 坞），当前分类高亮。
- **校验**：`check-all.py` 护栏 J 改为逐页核对分类关键字；`npm test` 30 文件 / 3825 断言 / 0 失败；build 零告警；三包 **njsc 701,428 B / jsc 776,007 B / debug 793,094 B**（较第 50 轮 +4,743 / +6,139 / +6,430 B）。
- **待真机确认**：① 四页分类切换是否即时且滚动回顶；② 闯关筛选后 `openLevel` 是否对得上行；③ 残局缺组兜底是否正常；④ 分类 dock 高度在窄胶囊上是否仍可接受。

### 本轮同批的可玩内容（B / A / D）

- **B 新棋盘尺寸**：五子棋 11×11（cell 22）/ 13×13（21）、黑白棋 10×10（22）、四子棋 9×8（24）、围棋 19×19（21）；`rules-sizes` 新增 4 条尺寸断言。
- **A 闯关扩充**：第 7 章「试炼」/ 第 8 章「封王」各 10 关，总量 **60→80 关、180→240 星**；每款玩法至少 4 关；campaign 测试的章节数/总数/末关/进度文案同步到 8/80/240。
- **D 单局认输**：`game.ux` 抽屉新增「认输」+ 二次确认；`confirmResign()` 走 `endGame({winner: 3-humanColor, reason:'认输'})`，判负并记录；残局/闯关/每日隐藏。
- **C 暂缓**：五子棋禁手、大富翁短局、飞行棋快局、12 人狼人杀都需要改规则层与存档，本轮不硬塞。


## 阶段自检（第五十二轮：赛季页去重）

- **玩家反馈**：从主页「第 1 赛季」卡进赛季页，页内又是同一张 hero 卡 + 同一段「人机 / 双人对局结束自动获得棋币…」说明，正文被推到下面，看不到主要内容。
- **改动**
  1. 删除赛季页 `.hero`（赛季名 + 棋币大卡）与 `.hint` 长说明；主页赛季卡已经承担了「入口 + 赛季名 + 棋币 + 规则」。
  2. 棋币改为顶栏右侧紧凑 `N 棋币`（12px；宽胶囊 14px），不再占正文高度。
  3. 正文第一个元素就是当前分类（默认「每日挑战」），不再先看到重复卡和说明。
  4. `seasonLabel` 数据字段与相关 CSS（hero/hero-season/hero-coins/hint 及三档媒体值）删除；`check-all.py` 的 season 断言改为 `top-coins`。
- **校验**：`npm run build` 零告警；`npm test` 30 文件 / 3825 断言 / 0 失败；check-all 全绿；三包 **njsc 701,428 B / jsc 776,007 B / debug 793,094 B**。
- **待真机确认**：顶栏「返回 + 赛季 + N 棋币」在 96dp / 106dp 与方屏上是否仍单行；4~5 位棋币时是否挤压标题。


## 阶段自检（第五十三轮：dock 全部悬浮化）

- **玩家要求**：「把 dock 栏改成悬浮的」——不再贴底 / 不再整宽单列。
- **改动**
  1. **统一 `common/dock.css`**：胶囊屏 **176×80、2×2、每枚 86×40**，圆角 22、**position:absolute 距底 60 覆盖在滚动列表上**；方屏 **176×34**、4 枚各 44×34（3 项页 132×34、2 项页两枚 86）。
  2. 主页 / 赛季 / 战绩 / 闯关 / 残局全部用同一悬浮 dock；3 项页（战绩/闯关/残局）末行居中成品字，不硬拉满。
  3. 设置页 2 项：`dock dock-2`，176×48，两枚 86×40；删掉原 `tabbar/barH/tabH`。
  4. 触摸格从 44×48 变为 **86×40**（面积 2 倍），且与屏幕边缘脱开；滚动列表末尾加 `dock-pad`（胶囊 160 / 方屏 64），最后一项能滚到 dock 上方，不再被覆盖丢失。
  5. `check-all.py` 护栏 I 改为核对 `dock.css` 的 176/96/44/22/88 与 index/settings 接入；删除 `.dock-2 .dock-item` 这类 Vela 不支持的 descendant selector（构建会报 `Selector type unsupport`）。
- **校验**：`npm run build` 零告警（无 unsupport）；`npm test` 30 文件 / 3825 断言 / 0 失败；check-all 全绿。三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**（较第 52 轮 +2,282 / +2,911 / +3,325 B）。
- **待真机确认**：① 悬浮 2×2 在 96dp 上是否比整宽四行更顺手；② 距底 60 的悬浮位置在胶囊下沿是否完整、自然；③ 3 项品字末行是否居中；④ 设置 2 项半高 dock 是否协调。


## 阶段自检（第五十四轮：开局面板 chip 恢复 + dock 完整显示）

- **玩家截图**：飞行棋 / 五子棋开局面板只剩「对战模式」下的两条 1px 细线；模式与棋盘大小选项不见了，dock 也只显示一列两项。
- **chip 根因与修法**：`<text class="chip">` 的 `height:34` 在当前 Vela 上被压成 1px；改为 6 个对局页统一的 `<div class="chip"><text class="chip-t">…</text></div>`（与狼人杀已验证写法一致），补 `min-height:34 / flex:none / box-sizing:border-box / border-style:solid`，窄胶囊 `.chips { flex-wrap: nowrap }`，并给 `.chips-mode / .chips-size` 显式高度 80 / 160（宽胶囊 84 / 168）；同时在 onInit 里同步 `syncSetupUI()`，避免首帧 modes/sizes 为空。模式、棋盘大小、选中态与 34px 触摸高度恢复。
- **dock 根因与修法**：面板 176 宽 + 1px 边框，实际内容宽 174；每枚 88 宽两枚 176 放不下，退化成单列，后两项被挤出。改为每枚 **86 宽**（2×86=172）+ 去 input 默认边框/内边距，稳定 2×2；dock 绝对定位、距底 60，滚动列表末尾 `dock-pad` 160/64 防覆盖。
- **校验**：`npm run build` 零告警、无 unsupport；`npm test` 30 文件 / 3825 断言 / 0 失败；5 审计全绿。三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**。
- **待真机确认**：① 6 个对局页的 chip 是否恢复为 34px 胶囊；② dock 是否 2×2 完整显示 4 项；③ 方屏 chip 是否仍一行放得下；④ dock 覆盖列表时最后一项能否滚上来。


## 阶段自检（第五十五轮：AI 人类大脑模型）

- **玩家要求**：「优化 AI 模拟人类大脑组成」。
- **模型**：`core/ai.js` 新增 `createMind` / `humanPick` / `observePlayer`，把 AI 拆成感知、直觉、推理、情绪、记忆、人格、疲劳七层；只在 `chooseMoveAsync` 根节点选点生效，同步 `chooseMove` 保持纯搜索。
- **参数**：easy/normal/hard 注意力 0.56/0.78/0.94，基础失误 0.16/0.07/0.025；人格「沉稳 / 好战 / 灵动」改变攻击性、注意力与思考节奏；疲劳随手数上升；领先保守、落后激进；已证必胜不犯错。
- **接入**：对局页每局 `beginGame` 创建 `aiMind` 并挂到规则实例；`scheduleAI` 用 `mind.pace` 调节思考延迟；玩家落子调用 `observePlayer` 写入轻量记忆；跳棋 / 斗兽棋通过规则实例上的懒创建自动复用。
- **校验**：`npm test` 30 文件 / **3825 断言** / 0 失败；`npm run build` 零告警；5 审计全绿。三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**。
- **待真机确认**：① easy 是否仍明显弱于 normal/hard；② hard 偶尔次优是否被感知为「像人」而不是「变傻」；③ 人格节奏差 140~180ms 是否自然；④ 长局疲劳是否造成不可接受的送子。


## 阶段自检（第五十六轮：方屏开局页重构）

- **玩家要求**：「除了胶囊屏，开始页面重构一下」。
- **改动**：6 个对局页的 `shape: rect` 开局页从居中单列改为紧凑双行：标题/标签左对齐；模式 2×84×34 一行；棋盘大小 4×40×34 一行；开始 176×44；玩法介绍/返回 84×34 并排。胶囊屏仍走原 168 单列，不改。
- **模板**：`s-secondary` 包裹「玩法介绍 / 返回」，`s-half` 控制方屏半宽；`chip-mode` / `chip-size` 区分两档宽度。
- **校验**：`npm test` 30 文件 / 3825 断言 / 0 失败；`npm run build` 零告警；5 审计全绿。三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**。
- **待真机确认**：① 40 宽的 13×13 是否仍清楚；② 模式/尺寸两行在 228 高方屏上是否需滚动才能看到开始；③ 玩法介绍/返回并排是否好点；④ 胶囊屏是否完全未受影响。


## 阶段自检（第五十七轮：方屏开始页 / 手势 / 质量与内容）

- **开始页**：仅 6 个对局页的 idle 态，方屏左上返回 + 右侧标题；底部旧「返回」删除，玩法介绍独占一行。**对局中不渲染顶栏，游戏界面仍是全屏棋盘 + 抽屉**。
- **手势**：2048 / 数字华容道增加 touchstart/touchend 滑动（阈值 24），`onBackPress` 返回 true 吞掉侧滑返回，退出只走左上角；顶部返回键仍可用。
- **内容**：迷宫 20→25（16~20 镜像，validate 全通过）；找不同 40→45（36~40 旋转 180°，差异坐标同步，PNG256 优化）；tests 更新到 25/45。
- **质量**：大富翁/飞行棋格/金额板/状态行圆角 + 棋子/骰子动效；蛇棋 HUD 表面卡片 + 棋子过渡/骰子动效；找不同 HUD 5 枚进度点；2048 去掉十字键、棋盘加大。
- **校验**：`npm test` 30 文件 / **3825 断言** / 0 失败；build 零告警；5 审计全绿；三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**。
- **待真机**：① 开始页顶栏只在 idle 出现、对局中不出现；② 滑动手势与 24px 阈值；③ 方屏开始页 40 宽尺寸格；④ 迷宫 25 / 找不同 45 的解锁与进度。


## 阶段自检（第五十八轮：迷宫虚拟摇杆 / 大富翁信息卡）

- **迷宫**：高画布四向键替换为 84 直径虚拟摇杆；touchstart/move/end → 归一化向量 → 主方向，死区 0.30，按住 180ms 连走；手柄超出 42 半径钳在圈上；矮画布仍保留四向键。
- **大富翁**：点任意格弹出「地价 / 当前租金 / 归属」信息卡，不改变买地/拍卖/回合流程。
- **蛇棋**：HUD 底部加双方 84×3 进度条，不占布局高度。
- **校验**：`npm test` 30 文件 / **3825 断言** / 0 失败；build 零告警；5 审计全绿；三包 **njsc 737,858 B / jsc 814,603 B / debug 827,339 B**。
- **待真机**：① 摇杆触摸坐标换算（client/scale）是否与底座对齐；② 摇杆与右侧功能键是否互不遮挡；③ 连走 180ms 是否跟手；④ 大富翁格子点击与拖拽滚动是否冲突。


## 阶段自检（第五十九轮：正式版 / 飞行棋落点预览）

- **正式版**：GitHub Release `v1.0.1`，三包 njsc / jsc / debug 全部上传。
- **飞行棋**：选择行动时 `previewCells` 保存每个候选的预计落点，棋盘格边框用 primary 高亮；确认/执行时清除，避免残留。
- **迷宫**：高画布虚拟摇杆（死区 0.30 / 180ms / 钳圈）。
- **大富翁**：格子信息卡；**蛇棋**双方进度条；**2048** 去十字键。
- **校验**：npm test 30 文件 / 3825 断言 / 0 失败；build 零告警；5 审计全绿；三包 **njsc 737,988 B / jsc 814,748 B / debug 827,504 B**。
