/**
 * tests/metrics.js — 度量 Token 的一致性护栏。
 * 这一层的意义是「不让各页再各写一份」：所以这里断言的是**设计不变量**，不是某个具体数值 ——
 * 例如「触摸目标不小于 34 设计像素」「圆角只有一套且顺序合理」「字号档单调递减」。
 * 任何页面或 CSS 偏离这套口径，应当在改本表后重新核对，而不是在页面里偷偷改一个值。
 * 运行：node tests/metrics.js
 */

var M = require('../src/utils/metrics.js')
var h = require('./helper.js')

h.suite('metrics/圆角只有一套且顺序合理')

var R = M.RADIUS
h.eq('圆角共 5 档（input/card/chip/modal/round）', Object.keys(R).length, 5)
h.ok('全部落在 8~24 设计像素（手环上不出现「半圆角」小卡片）',
  R.input >= 8 && R.round <= 24)
h.ok('层级顺序单调：input < card < chip < modal < round',
  R.input < R.card && R.card < R.chip && R.chip < R.modal && R.modal < R.round)
h.eq('chip 圆角与控件口径一致（CTRL.chipR）', R.chip, M.CTRL.chipR)
h.eq('卡片圆角与 CARD 口径一致', R.card, M.CARD.radius)

h.suite('metrics/触摸目标不小于 34 设计像素')

var B = M.BTN
h.ok('弹窗按钮高 ≥34 且高 ≤48', B.dialogH >= 34 && B.dialogH <= 48)
h.ok('抽屉行高 ≥34', B.drawerH >= 34)
h.ok('底部 tab 高 ≥34', B.tabH >= 34)
h.ok('圆形返回键边长 ≥34', B.navH >= 34)
h.ok('弹窗按钮宽 ≥120（够放 4 个汉字）且 ≤168（两侧各留 ≥12）', B.dialogW >= 120 && B.dialogW <= 168)
h.ok('抽屉行宽 ≤168', B.drawerW <= 168)
h.ok('相邻按钮间距 4~10', B.dialogMt >= 4 && B.dialogMt <= 10 && B.drawerMb >= 4 && B.drawerMb <= 10)

h.suite('metrics/弹窗卡片（分机型两档）')

// 弹窗是「卡片」而不是「横条」：按钮宽 = 弹窗内容宽（左右各 10 内边距，恰好整行）；
// 两档都必须满足触摸目标 ≥34，且方屏档要压扁（矮画布 228 上三按钮不能铺满整屏）。
var MD = M.MODAL
h.ok('胶囊屏档：按钮宽 = 弹窗内容宽', MD.wPill - MD.padH * 2 === B.dialogW)
h.ok('方屏档：按钮宽 = 弹窗内容宽', MD.wRect - MD.padH * 2 === B.dialogWRect)
h.ok('两档按钮高都 ≥34（触摸目标口径）', B.dialogH >= 34 && B.dialogHRect >= 34)
h.ok('方屏档更扁（高更小）', B.dialogHRect < B.dialogH)
h.ok('两档按钮间距都在 4~10', B.dialogMt >= 4 && B.dialogMt <= 10 && B.dialogMtRect >= 4 && B.dialogMtRect <= 10)
h.ok('弹窗最宽 ≤168（最窄机型两侧各留 ≥12）', Math.max(MD.wPill, MD.wRect) <= 168)
h.ok('方屏档不比胶囊屏档窄（短屏靠宽度换高度）', MD.wRect > MD.wPill)
h.ok('弹窗圆角 = 主按钮圆角（20）', R.modal === 20 && R.modal === B.dialogH / 2)
h.ok('方屏档按钮圆角 = 半高（17）', Math.round(B.dialogHRect / 2) === 17)

h.suite('metrics/小控件不低于触摸目标')
// chip / 分段控件 / 开关此前是 32 / 32 / 26 —— 都低于 34，是「点不准」的主因。
// 这里断言的是下限：任何一档都不许再回到 34 以下，圆角必须是半高（胶囊观感）。
var C = M.CTRL
h.ok('chip 高 ≥34', C.chipH >= 34)
h.ok('分段控件高 ≥34', C.segH >= 34)
h.ok('开关高 ≥34', C.switchH >= 34)
h.eq('chip 圆角 = 半高', C.chipR, C.chipH / 2)
h.eq('分段圆角 = 半高', C.segR, C.segH / 2)
h.ok('开关宽 > 高（横向滑槽）', C.switchW > C.switchH)
h.ok('开关滑钮比滑槽矮 6~10（留滑块边距）', C.switchH - C.knob >= 6 && C.switchH - C.knob <= 10)
h.ok('开关滑槽宽 ≥ 2×滑钮（滑动行程够）', C.switchW >= C.knob * 2)

h.suite('metrics/字号档单调且可读')

var T = M.TYPE
h.ok('标题 > 段标题 > 按钮 > 辅助', T.title > T.section && T.section > T.button && T.button > T.label)
h.ok('按钮字号 ≤16（手表上再大就挤）', T.button <= 16)
h.ok('辅助字号 ≥9（再小读不出）', T.label >= 9)
h.ok('段标题不超过标题', T.section <= T.title - 4)

h.suite('metrics/间距克制')

var S = M.SPACE
h.ok('页边距 4~12', S.page >= 4 && S.page <= 12)
h.ok('段落间距 ≥ 行距 且 ≤14', S.gap >= S.rowGap && S.gap <= 14)
h.ok('行距 ≥4', S.rowGap >= 4)

h.suite('metrics/返回键几何（nav）')

var tall = M.nav(1, false)
var watch5 = M.nav(0.8, false)
var small = M.nav(1, true)
h.eq('大屏方表 uiS=1 时 44×44 / 字 20', [tall.size, tall.font], [44, 20])
h.ok('大屏方表 uiS=0.8 时收敛但不下 38', watch5.size >= 38 && watch5.size < tall.size)
h.eq('矮画布 34×34 / 字 16', [small.size, small.font], [34, 16])
h.ok('任何档位边长 ≥34（触摸目标口径）', tall.size >= 34 && watch5.size >= 34 && small.size >= 34)
h.ok('边长为偶数（半径取整不留半像素）', tall.size % 2 === 0 && watch5.size % 2 === 0 && small.size % 2 === 0)
h.eq('半径 = 边长/2（严格圆钮）', M.navRadius(tall.size), 22)
h.eq('非法尺寸兜底用默认边长', M.navRadius(0), Math.round(44 / 2))

h.suite('metrics/字号角色（三档屏型）')
// 2026-10-30 UI 重构：页面字号不再各页各写，按 pill / rect / wide 三档 × 六个角色。
// 断言的是「角色顺序」与「最小值」，具体数值允许随设计调整，但不能出现
// 正文比标题大、方屏 micro 小于 9（读不出）这类回归。
var TS = M.TYPE_SCALE
var profiles = ['pill', 'rect', 'wide']
profiles.forEach(function (p) {
  var t = TS[p]
  h.ok(p + '：display > title > heading > body > caption ≥ micro',
    t.display > t.title && t.title > t.heading && t.heading > t.body &&
    t.body > t.caption && t.caption >= t.micro)
  h.ok(p + '：最小字号 ≥9（手环可读下限）', t.micro >= 9)
})
h.ok('宽胶囊整体不小于胶囊屏（屏更大、字可更大）',
  TS.wide.display >= TS.pill.display && TS.wide.title >= TS.pill.title)
h.ok('方屏整体不大于胶囊屏（矮画布要收敛）',
  TS.rect.display <= TS.pill.display && TS.rect.title <= TS.pill.title)

h.suite('metrics/卡片口径')
var C = M.CARD
h.ok('卡片内边距 12~16', C.padX >= 12 && C.padX <= 16 && C.padY >= 10 && C.padY <= 16)
h.ok('卡片间距 6~10', C.gap >= 6 && C.gap <= 10)
h.eq('卡片圆角 = RADIUS.card', C.radius, R.card)

process.exit(h.summary())
