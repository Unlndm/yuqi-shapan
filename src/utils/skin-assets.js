/**
 * utils/skin-assets.js — 皮肤 id → 素材路径 / 棋子 Token 覆盖（纯映射，无 @system）。
 * 页面（赛季商店预览、对局页接入）统一从这里取路径，避免各页各写一份 if-else。
 * 约定：
 *   · 目录口径与 economy-core.js 的 SKINS 一致（mat 3 / dice 3 / piece 2 / bg 2）；
 *   · 未知 id、非法 mode / face 一律回退默认素材（classic + 当前深浅模式）；
 *   · 新骰面素材只做了 1~6，face '0'（初始面）沿用经典 dice_0.png；
 *   · 不读写 storage、不依赖主题模块，node 可直接测。
 */
var BASE = '/common/img/'

// 棋盘底材：按皮肤 id × 深浅模式取图
var BOARD = {
  mat_classic: { dark: BASE + 'board_dark.png', light: BASE + 'board_light.png' },
  mat_walnut: { dark: BASE + 'board_walnut_dark.png', light: BASE + 'board_walnut_light.png' },
  mat_ink: { dark: BASE + 'board_ink_dark.png', light: BASE + 'board_ink_light.png' }
}

// 整页背景（2026-10-30 起改为纯色底色，不再用整页位图）：
// bg_plain → theme 的 surface；bg_cloud → surfaceContainer。
// 皮肤 id 保留，已购玩家与「皮肤全收」成就（6 套）不受影响。

// 骰面前缀：classic 沿用 dice_<face>.png，其余为新素材
var DICE = {
  dice_classic: BASE + 'dice_',
  dice_ivory: BASE + 'dice_ivory_',
  dice_amber: BASE + 'dice_amber_'
}

// 棋子样式：只覆盖 Token（颜色），不改走子/吃子规则与坐标。
// classic 返回空对象（沿用 theme 当前 Token）；ring 提高棋子描边对比：
// 黑棋白描边、白棋深描边，最后手标记用琥珀色，深浅两模式均能分辨。
var PIECE_STYLES = {
  piece_classic: {},
  piece_ring: {
    stoneBlackBorder: '#FFFFFF',
    stoneWhiteBorder: '#1D1B20',
    lastMark: '#F2C230'
  }
}

// 合法皮肤 id 清单（与 economy-core.js 的 SKINS 同口径）与默认装备。
// 主题模块在首帧/切换时都要一份「干净的已装备」，避免脏存档把 if-else 穿透。
var SKIN_IDS = {
  mat: ['mat_classic', 'mat_walnut', 'mat_ink'],
  dice: ['dice_classic', 'dice_ivory', 'dice_amber'],
  piece: ['piece_classic', 'piece_ring'],
  bg: ['bg_plain', 'bg_cloud']
}
var SKIN_CATS = ['mat', 'dice', 'piece', 'bg']
var DEFAULT_EQUIPPED = {
  mat: 'mat_classic',
  dice: 'dice_classic',
  piece: 'piece_classic',
  bg: 'bg_plain'
}

// 内部：mode 归一（非法值兜底深色）。
function modeOf(mode) {
  return mode === 'light' ? 'light' : 'dark'
}

// 输入：storage 里的 equipped（可为脏值）；输出：四分类齐全、非法/缺失回退默认的新对象。
function normEquipped(raw) {
  var r = raw && typeof raw === 'object' ? raw : {}
  var out = {}
  for (var i = 0; i < SKIN_CATS.length; i++) {
    var cat = SKIN_CATS[i]
    var id = r[cat]
    out[cat] = SKIN_IDS[cat].indexOf(id) >= 0 ? id : DEFAULT_EQUIPPED[cat]
  }
  return out
}

// 内部：脸数归一 '0'..'6'（非法值兜底 '0' = 初始面）。
function faceOf(face) {
  var f = face === undefined || face === null ? '0' : String(face)
  return /^[0-6]$/.test(f) ? f : '0'
}

// 输入：棋盘皮肤 id（mat_*）、mode 'dark'|'light'；输出：棋盘底材图路径。
function boardMat(id, mode) {
  var m = BOARD[id] || BOARD.mat_classic
  return m[modeOf(mode)]
}

// 输入：骰子皮肤 id（dice_*）、face '0'..'6'；输出：骰面图路径。
// face '0' 没有新素材，ivory / amber 也回退经典 dice_0.png。
function diceFace(id, face) {
  var f = faceOf(face)
  var prefix = DICE[id] || DICE.dice_classic
  if (f === '0' && prefix !== DICE.dice_classic) prefix = DICE.dice_classic
  return prefix + f + '.png'
}

// 输入：棋子皮肤 id（piece_*）；输出：Token 覆盖对象（新对象，不改入参/默认 Token）。
function pieceStyle(id) {
  var s = PIECE_STYLES[id] || PIECE_STYLES.piece_classic
  var o = {}
  for (var k in s) o[k] = s[k]
  return o
}

module.exports = {
  boardMat: boardMat,
  diceFace: diceFace,
  pieceStyle: pieceStyle,
  normEquipped: normEquipped,
  DEFAULT_EQUIPPED: DEFAULT_EQUIPPED
}
