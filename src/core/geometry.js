/**
 * core/geometry.js — 棋盘几何计算（渲染层与命中判定共用，不认任何棋种规则）。
 * 两种拓扑统一处理：
 *   mode = 'cross'：棋子落在网格线交点（五子棋式），pos(i,j) = pad + i*cell
 *   mode = 'cell' ：棋子落在格子中心（黑白棋式），pos(i,j) = pad + i*cell + cell/2
 * 坐标约定（spec 9.6）：(i, j)，i 为列（x 向），j 为行（y 向），j=0 在顶部。
 * 所有输出为设计像素（designWidth=192 基准），为整数或 .5 的安全值；
 * cell 为偶数时全部为整数，避免 dpr=2/3 下半像素模糊。
 */

var PAD_DEFAULT = 10 // 棋盘四周留白，防止边缘棋子被视口裁掉一半

function assert(cond, msg) {
  if (!cond) {
    throw new Error('[geometry] ' + msg)
  }
}

// 构造参数：{ cols, rows, cell, mode('cross'|'cell'), pad }
class BoardGeometry {
  constructor(opts) {
    var cols = opts.cols
    var rows = opts.rows
    var cell = opts.cell
    var mode = opts.mode === 'cross' ? 'cross' : 'cell'
    var pad = opts.pad === undefined ? PAD_DEFAULT : opts.pad

    assert(Number.isInteger(cols) && cols > 0, 'cols 必须为正整数')
    assert(Number.isInteger(rows) && rows > 0, 'rows 必须为正整数')
    assert(Number.isInteger(cell) && cell >= 21 && cell <= 60, 'cell 必须为 21~60 的整数（跑道屏可点热区）')
    assert(Number.isInteger(pad) && pad >= 0, 'pad 必须为非负整数')
    // spec 9.1：棋盘容器宽高必须能被 cols/rows 整除（去掉 pad 后恰为 cell 整数倍）
    assert((cols * cell) % 1 === 0 && (rows * cell) % 1 === 0, '容器宽高非整数')

    this.cols = cols
    this.rows = rows
    this.cell = cell
    this.mode = mode
    this.pad = pad
    // 网格跨度：cross 模式棋盘由「交点」定义，横竖各只有 cols-1 / rows-1 个间隔；
    // cell 模式才是 cols / rows 个格子，跨度 = cols*cell。
    // ⚠️ 旧实现两种模式共用 cols*cell，使 cross 模式的盒比网格实际跨度**多出一整格**；
    // 而线条与棋子都锚定在左上角的 pad 处，多出的那一格全部落在**右侧与下侧** ——
    // 真机截图实测（9 路、cell 21、pad 10）：左/上内缩 10、右/下内缩 31，正好差 1 格（21），
    // 表现就是「右边跟下面的区都比上面跟左边的大 —— 画的东西没居中」。
    var gw = (cols - 1) * cell
    var gh = (rows - 1) * cell
    // 整体尺寸 = 网格跨度 + 两侧留白（两种模式都因此与网格严格对齐、四边内缩相等）
    this.boardW = (mode === 'cross' ? gw : cols * cell) + pad * 2
    this.boardH = (mode === 'cross' ? gh : rows * cell) + pad * 2
    // 棋子直径：cell 模式留 6px 间隙，cross 模式留 8px（交点更密）
    this.stoneD = cell - (mode === 'cell' ? 6 : 8)
  }

  // 输入：格坐标 (i,j)；输出：棋子中心设计像素 {x, y}（相对棋盘容器左上角）。
  pos(i, j) {
    var half = this.mode === 'cell' ? Math.floor(this.cell / 2) : 0
    return {
      x: this.pad + i * this.cell + half,
      y: this.pad + j * this.cell + half
    }
  }

  // 输入：棋盘容器内的像素坐标 (px,py)；输出：命中的 {i,j} 或 null。
  // 命中规则（spec 3.6）：就近吸附最近交叉点/格子中心；cross 模式容差 0.45×cell
  // （2026-10-23 由 cell/2+5 收紧，见下方注释），cell 模式为 cell/2+1。
  // 边缘钳制：棋盘边界外 5px 之外不吸附，防止在留白区误落子。
  hit(px, py) {
    var lx = px - this.pad
    var ly = py - this.pad
    if (px < this.pad - 5 || py < this.pad - 5) return null
    if (px > this.boardW - this.pad + 5 || py > this.boardH - this.pad + 5) return null
    var i
    var j
    if (this.mode === 'cross') {
      i = Math.round(lx / this.cell)
      j = Math.round(ly / this.cell)
    } else {
      i = Math.floor(lx / this.cell)
      j = Math.floor(ly / this.cell)
    }
    if (i < 0 || i >= this.cols || j < 0 || j >= this.rows) return null
    // 距离校验：离吸附点太远的点击（如角落空隙）不误判。
    // 2026-10-23（容差收紧）：cross 模式原容差 = cell/2 + 5，比「两点中点」还大 ——
    // 等于棋盘内任意一点都会吸附到某个交点，手指落在两子之间时必然落错一格。
    // 现收紧到 0.45×cell（cell 21 → 9、30 → 14）：正常瞄准误差照样吸附，
    // 但「正中空当」判为无效（页面给一次无效震动），不再落错位置。
    // cell 模式（黑白棋：整格就是目标）无需在邻格间取舍，保留 cell/2 + 1。
    var tol = this.mode === 'cross'
      ? Math.max(6, Math.round(this.cell * 0.45))
      : Math.floor(this.cell / 2) + 1
    var c = this.pos(i, j)
    if (Math.abs(c.x - px) > tol || Math.abs(c.y - py) > tol) return null
    return { i: i, j: j }
  }

  // 输入：无；输出：整体尺寸 {w, h}。
  size() {
    return { w: this.boardW, h: this.boardH }
  }
}

module.exports = BoardGeometry
