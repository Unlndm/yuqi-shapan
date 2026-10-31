/**
 * utils/metrics.js — 全局「度量 Token」：尺寸 / 圆角 / 间距 / 字号档。
 *
 * 分工：theme.js 管**颜色**（三配色 × 深/浅，文字与底色已逐对核过 WCAG AA）；
 * 本模块管**度量**。这一层此前从来没有统一过，于是出现了一批一致性漂移 ——
 * 本轮审计实测：两套返回入口（44×44 圆形「＜」vs 46×26/42×22/44×26 三种矩形「返回」chip）、
 * 弹窗按钮 136×40 与 142×40 两种、同名 `.m-btn` 与 `.m2-btn` 两份类、圆角 5~24px 共 11 档、
 * 字号 9~22px 散落各处。本表把这些收成一套，页面按它取值。
 *
 * ⚠️ Vela 不支持 CSS 变量，也没有 CSS-in-JS：**页面能内联绑定的走本表，纯 CSS 里写死的同类值靠
 * 审计脚本盯住**（scripts/check-all.py 会核对六页 `.m-btn` 的 width/height 完全一致、
 * 以及四个 tab 页的 `.back-fab` 与三个单人页的 `.nav-fab` 尺寸一致）。改本表时请同步改 CSS 并在注释里标注。
 *
 * 触摸目标口径：手环上最小可点尺寸取 34 设计像素（约屏宽的 1/6）；次要控件 ≥34，
 * 主要按钮 40~44，圆形返回键 44（矮画布 34）。
 */

// 圆角：只管「界面外壳」这一层（卡片 / 弹窗 / 输入与 chip / 圆形控件）。
// 棋盘与棋子（格子、滑块、石子、飞机、房产、扫雷格）的圆角属于「盘面美术」，不在此表、保持各自原样。
// 弹窗 16 → 20（2026-10-23）：弹窗整体收窄后，16 的圆角显得像「切了角的条」，
// 20 才是卡片观感（与「抽屉行 / 按钮」的半高圆角口径一致）。
// 2026-10-30 UI 重构：卡片 12 → 14。12 在 168 宽的小卡上偏「方块」，
// 14 更接近手环的圆润观感；弹窗 20 与之拉开层级，仍保持 input < card < chip < modal < round。
var RADIUS = { card: 14, modal: 20, input: 8, chip: 17, round: 22 }

// 按钮族（CSS 里同类值必须与本表一致）
// 弹窗按钮分两档（2026-10-23）：
//   pill 档（胶囊屏，默认）：130×40 —— 弹窗宽 150、左右内边距 10，恰好整行；
//   rect 档（方屏 / 大屏方表）：140×34 —— 这些机型画布高只有 228~300，
//   三按钮弹窗必须压扁，否则高度会铺满整屏（用户反馈「长方体占满屏幕」）。
var BTN = {
  dialogW: 130,      // 弹窗内整行按钮 · 胶囊屏档（默认）
  dialogH: 40,
  dialogMt: 6,       // 相邻按钮的垂直间距
  dialogWRect: 140,  // 弹窗内整行按钮 · 方屏档
  dialogHRect: 34,
  dialogMtRect: 4,
  drawerW: 168,   // 抽屉行（悔棋 / 停手 / 重开 / 退出 / 缩放）
  drawerH: 44,
  drawerMb: 6,
  tabH: 48,       // 底部 tab
  navH: 44        // 圆形返回键边长（矮画布 34）
}

// 弹窗卡片（只有宽度与竖向内边距分档；左右内边距两档同为 10，保证「按钮 = 内容宽」）
var MODAL = {
  wPill: 150,
  wRect: 160,
  padH: 10,
  padV: 16,
  padVRect: 10
}

// 小控件（2026-10-23 统一到触摸目标下限）：chip、分段控件、开关。
// 此前 chip 32 / 分段 32 / 开关 26，都低于 34 —— 在手表上「点不准」的主因之一。
var CTRL = {
  chipH: 34,
  chipR: 17,
  segH: 34,
  segR: 17,
  switchW: 52,
  switchH: 34,
  knob: 26
}

// 间距（8pt 栅格：页边 8 / 段间 10 / 行间 6 / 段标题上下 10）
var SPACE = { page: 8, gap: 10, rowGap: 6, section: 10 }

// 字号（chrome 层，不随用户字号档缩放的三档）
// 正文 md / 辅助 sm 两档仍复用 config.fontTokens（normal 14/11、large 16/13、xlarge 18/15）。
var TYPE = { title: 22, section: 17, button: 14, label: 11 }

// 2026-10-30 UI 重构：把「页面字号」收成三档屏型 × 六个角色。
// 这是设计口径（CSS 里由媒体查询落实，内联字号由各页脚本落实），
// 不是运行时 API —— 页面不要自己再发明 13.5 / 17.5 这种中间档。
//   display 数字大字（总览 / 棋币）  title 页面标题  heading 卡片标题
//   body 正文  caption 辅助说明  micro 徽标 / 极小标注
var TYPE_SCALE = {
  pill: { display: 26, title: 22, heading: 15, body: 13, caption: 11, micro: 9 },
  rect: { display: 22, title: 16, heading: 13, body: 12, caption: 10, micro: 9 },
  wide: { display: 30, title: 26, heading: 19, body: 15, caption: 13, micro: 11 }
}

// 内容卡片（2026-10-30）：全应用同一套圆角 / 内边距 / 卡片间距。
// 圆角与 RADIUS.card 必须一致（tests/metrics.js 会拦）。
var CARD = { radius: 14, padX: 14, padY: 12, gap: 8 }

// 输入：uiS（大屏方表的 UI 收敛系数，见 utils/screen.js）、compact（矮画布）；
// 输出：圆形返回键的 { size, font } —— 顶栏只有一个返回入口，全应用同一规格。
function nav(uiS, compact) {
  var s = uiS || 1
  if (compact) return { size: 34, font: 16 }
  var size = Math.max(38, Math.round(BTN.navH * s))
  return { size: size, font: Math.max(16, Math.round(size * 0.45)) }
}

// 输入：无；输出：圆形返回键的半径（就是边长的一半，圆钮）。
function navRadius(size) {
  return Math.round((size || BTN.navH) / 2)
}

module.exports = {
  RADIUS: RADIUS,
  BTN: BTN,
  MODAL: MODAL,
  CTRL: CTRL,
  SPACE: SPACE,
  TYPE: TYPE,
  TYPE_SCALE: TYPE_SCALE,
  CARD: CARD,
  nav: nav,
  navRadius: navRadius
}
