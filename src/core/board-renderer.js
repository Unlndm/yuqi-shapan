/**
 * core/board-renderer.js — 渲染层视图模型构建。
 * 职责：把「棋盘几何 + 棋子列表」翻译成模板可直接 for 循环的数组，
 *       不认任何棋种规则；页面不手工拼任何坐标。
 * 网格线方案：每条线一个绝对定位 2px div（横线/竖线各若干），比逐格拼 border
 * 少一半以上节点数（n+m 对 n*m），对跑道屏渲染更友好，视觉完全等价。
 * 国际象棋棋子：圆盘 + 汉字（兵马象车后王）——手表字体缺字（♞ 类符号是豆腐块），
 * 且 <image> 渲染 base64 SVG 在模拟器上有黑屏风险，汉字圆盘零依赖零风险。
 */

// 棋子码 → 汉字（1-6 白方，7-12 黑方）
var PIECE_GLYPHS = ['兵', '马', '象', '车', '后', '王']

// 输入：geo（BoardGeometry）；输出：线段数组 [{x,y,w,h}]，2px 网格线宽。
// cross 模式画全部 cols+1 / rows+1 条边界线；cell 模式画内部分隔线 + 外框
// （外框用线段而非容器 border，避免 border 参与盒模型尺寸计算）。
function buildGridLines(geo) {
  var lines = []
  var x0 = geo.pad
  var y0 = geo.pad
  var gw = (geo.cols - 1) * geo.cell
  var gh = (geo.rows - 1) * geo.cell
  var i
  if (geo.mode === 'cross') {
    for (i = 0; i < geo.cols; i++) {
      lines.push({ x: x0 + i * geo.cell - 1, y: y0, w: 2, h: gh })
    }
    for (i = 0; i < geo.rows; i++) {
      lines.push({ x: x0, y: y0 + i * geo.cell - 1, w: gw, h: 2 })
    }
  } else {
    var fullW = gw + geo.cell + 2 // 横线长度（含外框延伸）
    var fullH = gh + geo.cell + 2 // 竖线长度
    for (i = 1; i < geo.cols; i++) {
      lines.push({ x: x0 + i * geo.cell - 1, y: y0 - 1, w: 2, h: fullH })
    }
    // 外框四条
    lines.push({ x: x0 - 1, y: y0 - 1, w: 2, h: fullH })
    lines.push({ x: x0 + geo.cols * geo.cell - 1, y: y0 - 1, w: 2, h: fullH })
    for (i = 1; i < geo.rows; i++) {
      lines.push({ x: x0 - 1, y: y0 + i * geo.cell - 1, w: fullW, h: 2 })
    }
    lines.push({ x: x0 - 1, y: y0 - 1, w: fullW, h: 2 })
    lines.push({ x: x0 - 1, y: y0 + geo.rows * geo.cell - 1, w: fullW, h: 2 })
  }
  return lines
}

// 输入：geo、stars [[i,j]]（星位格坐标）；输出：小圆点数组 [{x,y,d}]（左上角定位）。
function buildStars(geo, stars) {
  var out = []
  if (!stars) return out
  var d = 4 // 星位直径 4 设计像素
  for (var k = 0; k < stars.length; k++) {
    var c = geo.pos(stars[k][0], stars[k][1])
    out.push({ x: c.x - 2, y: c.y - 2, d: d })
  }
  return out
}

// 输入：board 二维数组（0空/1黑/2白）、geo、lastMove {i,j}、theme Token 表；
// 输出：棋子数组 [{x,y,d,bg,border,last,mo}]，x/y 为左上角设计像素。
// 棋子为绝对定位元素叠加在网格层之上（spec 9.1），不作为格子子元素。
function buildStones(board, geo, lastMove, t) {
  var out = []
  var mo = Math.floor((geo.stoneD - 6) / 2) // 最后一手标记点相对棋子左上角的偏移
  for (var j = 0; j < geo.rows; j++) {
    for (var i = 0; i < geo.cols; i++) {
      var v = board[j][i]
      if (v !== 1 && v !== 2) continue
      var c = geo.pos(i, j)
      var r = geo.stoneD / 2
      out.push({
        x: Math.round(c.x - r),
        y: Math.round(c.y - r),
        d: geo.stoneD,
        mo: mo,
        bg: v === 1 ? t.stoneBlack : t.stoneWhite,
        border: v === 1 ? t.stoneBlackBorder : t.stoneWhiteBorder,
        last: !!(lastMove && !lastMove.pass && lastMove.i === i && lastMove.j === j)
      })
    }
  }
  return out
}

// 输入：board（棋子码 1-6 白 / 7-12 黑）、geo、lastMove {i,j,fi,fj}、theme；
// 输出：国际象棋棋子（圆盘+汉字）数组 [{x,y,d,bg,border,fg,glyph,last}]。
function buildPieceDiscs(board, geo, lastMove, t) {
  var out = []
  var d = geo.cell - 6
  var fs = Math.floor(d * 0.55)
  for (var j = 0; j < geo.rows; j++) {
    for (var i = 0; i < geo.cols; i++) {
      var v = board[j][i]
      if (!v) continue
      var isWhite = v <= 6
      var c = geo.pos(i, j)
      var r = d / 2
      var last = !!(lastMove && !lastMove.pass && lastMove.i === i && lastMove.j === j)
      out.push({
        x: Math.round(c.x - r),
        y: Math.round(c.y - r),
        d: d,
        bg: isWhite ? '#F2EFE9' : '#26232B',
        border: last ? t.lastMark : (isWhite ? '#5A5560' : '#D9D5DC'),
        fg: isWhite ? '#3A3740' : '#E8E4DC',
        glyph: PIECE_GLYPHS[v <= 6 ? v - 1 : v - 7],
        fs: fs,
        last: last
      })
    }
  }
  return out
}

// 输入：geo、lastMove（含 fi/fj 起始格的走法，如国际象棋）；
// 输出：最后一手起止格的描边标记 [{x,y,s}]，透明底 + lastMark 色边框。
function buildMarkers(geo, lastMove) {
  var out = []
  if (!lastMove || lastMove.fi === undefined || lastMove.pass) return out
  var s = geo.cell - 4
  var cells = [[lastMove.fi, lastMove.fj], [lastMove.i, lastMove.j]]
  for (var k = 0; k < cells.length; k++) {
    var c = geo.pos(cells[k][0], cells[k][1])
    out.push({
      x: Math.round(c.x - s / 2),
      y: Math.round(c.y - s / 2),
      s: s
    })
  }
  return out
}

module.exports = {
  buildGridLines: buildGridLines,
  buildStars: buildStars,
  buildStones: buildStones,
  buildPieceDiscs: buildPieceDiscs,
  buildMarkers: buildMarkers
}
