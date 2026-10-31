/**
 * utils/theme.js — MD3 静态配色系统（多配色风格 × 深/浅两模式）。
 * 职责：集中定义全部色彩 Token；页面通过内联 style 绑定色值（Vela 无 CSS 变量）。
 * 结构：PALETTES[风格].dark/light 定义 UI 色；棋子/棋盘线等中性色所有风格共享
 * （STONES），合并后输出完整 Token 表。get(palette, mode) 为唯一入口，
 * 非法值兜底 purple/dark。不使用 box-shadow/gradient。
 *
 * 配对规则（文字可读性，全部 ≥ WCAG AA 4.5:1，实测覆盖五配色 × 深浅）：
 *   底色 primary          → 文字 onPrimary
 *   底色 primaryContainer → 文字 onPrimaryContainer（旧版误用 onPrimary，对比度仅 1.29~1.53）
 *   底色 surface / surfaceContainer / surfaceContainerHigh → onSurface 或 onSurfaceVariant
 *   底色 surfaceVariant   → onSurface 或 onSurfaceVariant
 * outline 只用于描边与图形（浅色模式下当文字用只有 3.4~4.0）。
 *
 * 同步取色：current() 返回「最近一次生效」的配色（remember() 由 config.loadSettings 写入），
 * 页面 data 的 t 初始化必须用它，避免首帧画默认紫/深造成的闪屏。
 * 皮肤：rememberSkins() 记住已装备皮肤（config.loadSettings 写入），
 * get() 的 pageBg / currentBoardBg / diceImage 都按它取底色与素材，非法/缺失回退默认。
 */

var skinAssets = require('./skin-assets.js')

// 棋子与棋盘线：黑白棋子语义跨配色恒定，仅随深/浅模式微调描边。
// 描边/网格线的取值按「图形可辨识」标准核过对比度：
//   浅色 boardLine 3.53、白棋描边 4.78（旧 #79747E 只有 3.53，白棋在浅色棋盘上近乎无轮廓）；
//   深色 boardLine 3.69（旧 #8B8792 只有 2.66，低于 3:1）。
var STONES = {
  dark: {
    stoneBlack: '#141218',
    stoneBlackBorder: '#CAC4D0',
    stoneWhite: '#E6E1E5',
    stoneWhiteBorder: '#CAC4D0',
    boardLine: '#A5A1AC'
  },
  light: {
    stoneBlack: '#1D1B20',
    stoneBlackBorder: '#49454F',
    stoneWhite: '#FFFFFF',
    stoneWhiteBorder: '#655F6B',
    boardLine: '#79747E'
  }
}

// MD3 风格基线（紫 = spec 原始基准；绿/蓝为 MD3 同构衍生色板）
var PALETTES = {
  purple: {
    dark: {
      primary: '#D0BCFF', onPrimary: '#381E72', primaryContainer: '#4F378B', onPrimaryContainer: '#EADDFF',
      surface: '#1C1B1F', surfaceContainer: '#221F26', surfaceContainerHigh: '#2B2930',
      surfaceVariant: '#49454F', onSurface: '#E6E1E5',
      onSurfaceVariant: '#CAC4D0', outline: '#938F99', error: '#F2B8B5',
      boardBg: '#49454F', lastMark: '#D0BCFF',
      resultWin: '#D0BCFF', resultLose: '#F2B8B5', resultDraw: '#CAC4D0'
    },
    light: {
      primary: '#6750A4', onPrimary: '#FFFFFF', primaryContainer: '#EADDFF', onPrimaryContainer: '#21005D',
      surface: '#FEF7FF', surfaceContainer: '#F3EDF7', surfaceContainerHigh: '#ECE6F0',
      surfaceVariant: '#E7E0EC', onSurface: '#1D1B20',
      onSurfaceVariant: '#49454F', outline: '#79747E', error: '#B3261E',
      boardBg: '#E7E0EC', lastMark: '#6750A4',
      resultWin: '#4F378B', resultLose: '#B3261E', resultDraw: '#49454F'
    }
  },
  green: {
    dark: {
      primary: '#A8D5A2', onPrimary: '#0E3311', primaryContainer: '#2F4D33', onPrimaryContainer: '#C4E7BC',
      surface: '#1B1C1A', surfaceContainer: '#211F1D', surfaceContainerHigh: '#2B2D29',
      surfaceVariant: '#44483F', onSurface: '#E2E3DD',
      onSurfaceVariant: '#C4C8BE', outline: '#8E9289', error: '#F2B8B5',
      boardBg: '#44483F', lastMark: '#A8D5A2',
      resultWin: '#A8D5A2', resultLose: '#F2B8B5', resultDraw: '#C4C8BE'
    },
    light: {
      primary: '#3B6939', onPrimary: '#FFFFFF', primaryContainer: '#BCD9B5', onPrimaryContainer: '#0A2A0C',
      surface: '#F7FBF2', surfaceContainer: '#F0F4EA', surfaceContainerHigh: '#E5E9DE',
      surfaceVariant: '#E0E4D8', onSurface: '#1B1C1A',
      onSurfaceVariant: '#44483F', outline: '#75796F', error: '#B3261E',
      boardBg: '#E0E4D8', lastMark: '#3B6939',
      resultWin: '#2E4F2C', resultLose: '#B3261E', resultDraw: '#44483F'
    }
  },
  blue: {
    dark: {
      primary: '#AAC7FF', onPrimary: '#0A305F', primaryContainer: '#1B4587', onPrimaryContainer: '#D7E3FF',
      surface: '#1A1C1E', surfaceContainer: '#1F2123', surfaceContainerHigh: '#282A2C',
      surfaceVariant: '#44474E', onSurface: '#E2E2E9',
      onSurfaceVariant: '#C4C6CF', outline: '#8E9099', error: '#F2B8B5',
      boardBg: '#44474E', lastMark: '#AAC7FF',
      resultWin: '#AAC7FF', resultLose: '#F2B8B5', resultDraw: '#C4C6CF'
    },
    light: {
      primary: '#3B64A4', onPrimary: '#FFFFFF', primaryContainer: '#D7E3FF', onPrimaryContainer: '#001B3F',
      surface: '#F8F9FF', surfaceContainer: '#F0F3FA', surfaceContainerHigh: '#E4E7F0',
      surfaceVariant: '#E1E2EC', onSurface: '#1A1C1E',
      onSurfaceVariant: '#44474E', outline: '#74777F', error: '#B3261E',
      boardBg: '#E1E2EC', lastMark: '#3B64A4',
      resultWin: '#2D4A78', resultLose: '#B3261E', resultDraw: '#44474E'
    }
  },
  // 以下两套为赛季商店解锁色板（2026-10-24 新增）：解锁前不可选，解锁后永久保留。
  amber: {
    dark: {
      primary: '#F2C230', onPrimary: '#3A2E00', primaryContainer: '#4D3B00', onPrimaryContainer: '#FFE08A',
      surface: '#1C1B18', surfaceContainer: '#232019', surfaceContainerHigh: '#2D2920',
      surfaceVariant: '#49453A', onSurface: '#E9E2D5',
      onSurfaceVariant: '#CFC7B6', outline: '#948D7C', error: '#F2B8B5',
      boardBg: '#49453A', lastMark: '#F2C230',
      resultWin: '#F2C230', resultLose: '#F2B8B5', resultDraw: '#CFC7B6'
    },
    light: {
      primary: '#7A5900', onPrimary: '#FFFFFF', primaryContainer: '#FFDF9A', onPrimaryContainer: '#261A00',
      surface: '#FFF8EF', surfaceContainer: '#F7EFE0', surfaceContainerHigh: '#EDE4D3',
      surfaceVariant: '#E7DECC', onSurface: '#1F1B12',
      onSurfaceVariant: '#4C4638', outline: '#7B7462', error: '#B3261E',
      boardBg: '#E7DECC', lastMark: '#7A5900',
      resultWin: '#5A4200', resultLose: '#B3261E', resultDraw: '#4C4638'
    }
  },
  rose: {
    dark: {
      primary: '#FFB3C1', onPrimary: '#561D2A', primaryContainer: '#6E2C3A', onPrimaryContainer: '#FFD9E1',
      surface: '#1C1A1B', surfaceContainer: '#231F20', surfaceContainerHigh: '#2D2829',
      surfaceVariant: '#4A4445', onSurface: '#E9E1E2',
      onSurfaceVariant: '#D0C4C6', outline: '#9A8E90', error: '#F2B8B5',
      boardBg: '#4A4445', lastMark: '#FFB3C1',
      resultWin: '#FFB3C1', resultLose: '#F2B8B5', resultDraw: '#D0C4C6'
    },
    light: {
      primary: '#9C4058', onPrimary: '#FFFFFF', primaryContainer: '#FFD9E1', onPrimaryContainer: '#3C0019',
      surface: '#FFF8F8', surfaceContainer: '#F9EEF0', surfaceContainerHigh: '#F0E3E5',
      surfaceVariant: '#E8DADD', onSurface: '#201A1B',
      onSurfaceVariant: '#514347', outline: '#837377', error: '#B3261E',
      boardBg: '#E8DADD', lastMark: '#9C4058',
      resultWin: '#7A2C42', resultLose: '#B3261E', resultDraw: '#514347'
    }
  }
}

// 输入：palette 'purple'|'green'|'blue'|'amber'|'rose'，mode 'dark'|'light'；
// 输出：完整 Token 表（UI 色 + 共享棋子色），非法值兜底紫/深。
function get(palette, mode) {
  var p = PALETTES[palette] || PALETTES.purple
  var m = mode === 'light' ? 'light' : 'dark'
  var t = {}
  var k
  for (k in p[m]) t[k] = p[m][k]
  for (k in STONES[m]) t[k] = STONES[m][k]
  // 棋子皮肤只覆盖 Token（描边/最后手标记），不涉及走子规则与坐标
  var ps = skinAssets.pieceStyle(curSkins.piece)
  for (k in ps) t[k] = ps[k]
  // 整页底色（2026-10-30 起不再用整页位图：每页 192×490 解码约 368KB，
  // 页面栈 3~5 页时是手环内存最大项，玩家确认「改纯色几乎没区别」）。
  // 两档背景皮肤 = 两档底色：素色底用 surface，层次底用 surfaceContainer。
  t.pageBg = t[curSkins.bg === 'bg_cloud' ? 'surfaceContainer' : 'surface']
  // 卡片底色（2026-10-30 UI 重构）：内容卡片从「与页面同色」改为高一阶表面，
  // 让「页面 → 卡片 → 弹窗」重新有三级层次。层次底皮肤下卡片再抬一阶，
  // 否则卡片与页面同色、层级又消失。
  t.cardBg = t[curSkins.bg === 'bg_cloud' ? 'surfaceContainerHigh' : 'surfaceContainer']
  // 发丝线：卡片 / 顶栏的 1px 描边。outline 是「图形级」对比（深 3.7 / 浅 4.0），
  // 直接当 1px 边框太重；这里用 onSurface 的低透明度，深色 12% / 浅色 10%。
  t.hairline = m === 'light' ? 'rgba(29, 27, 32, 0.10)' : 'rgba(230, 225, 229, 0.12)'
  return t
}

// 当前生效配色（模块级缓存）：设置是异步读来的，若页面首帧直接用「紫/深」默认值，
// 会先画出错误配色、等设置回来再翻色 —— 实机表现为「进页面闪一下紫色」。
// 让 config.loadSettings 记住最近一次读到的配色，后续页面首帧就能直接用对。
var curPalette = 'purple'
var curMode = 'dark'
// 已装备皮肤（模块级缓存）：default 与皮肤商店默认装备一致。
// config.loadSettings 读到 skin_state 后立即 rememberSkins，页面首帧即可用对素材。
var curSkins = skinAssets.normEquipped(null)

// 输入：palette、mode（可为脏值）；输出：无。记住本次生效的配色（同步）。
function remember(palette, mode) {
  curPalette = PALETTES[palette] ? palette : 'purple'
  curMode = mode === 'light' ? 'light' : 'dark'
}

// 输入：equipped（{mat,dice,piece,bg}，可为脏值）；输出：无。记住本次装备的皮肤（同步）。
function rememberSkins(equipped) {
  curSkins = skinAssets.normEquipped(equipped)
}

// 输入：无；输出：当前已装备皮肤（新对象，避免调用方改坏缓存）。
function currentSkins() {
  return {
    mat: curSkins.mat,
    dice: curSkins.dice,
    piece: curSkins.piece,
    bg: curSkins.bg
  }
}

// 输入：无；输出：皮肤签名串（用于 applyTheme 判重：皮肤变了也要重绑一次）。
function skinKey() {
  return curSkins.mat + '/' + curSkins.dice + '/' + curSkins.piece + '/' + curSkins.bg
}

// 输入：无；输出：当前配色 Token 表（同步，供页面 data 初始化）。
function current() {
  return get(curPalette, curMode)
}

// 兼容导出（预览脚本/旧调用用）
var dark = get('purple', 'dark')
var light = get('purple', 'light')

// ── 棋盘底材（原创 AI 生成，随深/浅模式切换） ────────────────────────
// 材质图均值已归一到两套 boardBg（深 #49454F / 浅 #E7E0EC，实测误差 ≤1），
// 所以棋盘上的网格线与棋子的对比度与「纯底色」时代完全一致。
// 换肤：mat_classic / mat_walnut / mat_ink 由 skin-assets 统一映射（同上）。

// 输入：mode；输出：棋盘底材图路径（按装备的 mat 皮肤取，非法值兜底深色/默认皮肤）。
function boardBgImage(mode) {
  return skinAssets.boardMat(curSkins.mat, mode)
}

// 输入：无；输出：当前生效模式的棋盘底材路径（同步，供页面 data 初始化）。
function currentBoardBg() {
  return boardBgImage(curMode)
}

// ── 对局「被玩的对象」位图（原创 AI 生成） ───────────────────────────
// 大富翁的棋子/房产标记、飞行棋的飞机、两页共用的骰子面。
// 全部为不随配色变化的固定语义色（蓝＝本机玩家、红＝AI；房产＝琥珀色），
// 带同色系深描边，因此在深/浅两模式与任意格子底色上都可辨识。
var PIECES = {
  plane: { 0: '/common/img/plane_p0.png', 1: '/common/img/plane_p1.png' },
  pawn: { 0: '/common/img/pawn_p0.png', 1: '/common/img/pawn_p1.png' },
  // 房产标记：等级 0/1/2 → 单房 / 双房 / 酒店
  estate: ['/common/img/estate_1.png', '/common/img/estate_2.png', '/common/img/estate_3.png']
}

// 输入：骰子面 '0'..'6'（'0' = 初始面）；输出：骰子面图路径。
// 按装备的 dice 皮肤取（经典/象牙/琥珀），非法装备或 face 回退默认；
// '0' 无新素材时 skin-assets 内部回退经典 dice_0.png。
// ⚠️ 素材是 PNG（骰面有圆角透明），路径后缀必须是 .png —— 写成 .jpg 时真机会显示破图感叹号。
function diceImage(face) {
  return skinAssets.diceFace(curSkins.dice, face)
}

// 输入：玩家号 0/1；输出：飞机棋子图路径（非法值兜底玩家 0）。
function planeImage(player) {
  return player === 1 ? PIECES.plane[1] : PIECES.plane[0]
}

// 输入：玩家号 0/1；输出：大富翁棋子图路径（非法值兜底玩家 0）。
function pawnImage(player) {
  return player === 1 ? PIECES.pawn[1] : PIECES.pawn[0]
}

// 输入：房产等级 0/1/2；输出：房产标记图路径（非法值兜底单房）。
function estateImage(level) {
  var i = Math.max(0, Math.min(2, Math.floor(level || 0)))
  return PIECES.estate[i]
}

module.exports = {
  get: get,
  current: current,
  remember: remember,
  rememberSkins: rememberSkins,
  currentSkins: currentSkins,
  skinKey: skinKey,
  boardBgImage: boardBgImage,
  currentBoardBg: currentBoardBg,
  diceImage: diceImage,
  planeImage: planeImage,
  pawnImage: pawnImage,
  estateImage: estateImage,
  dark: dark,
  light: light,
  PALETTES: PALETTES,
  // 兼容旧签名 theme('dark'|'light')
  theme: function (name) { return name === 'light' ? light : dark }
}
