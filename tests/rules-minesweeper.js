/**
 * tests/rules-minesweeper.js — 扫雷规则测试。
 * 随机数全部注入：布雷用 Fisher–Yates + 注入的 0~1 源；
 *   传「恒定函数」得到确定布局、传「序列函数」可复现多样化布局。
 * 手工构造的局面：state 只需 { size, mines, cells, opened, flags, started }，
 *   counts / openedCount / win 由引擎读状态时按数据重算，无需自己维护。
 * 运行：node tests/rules-minesweeper.js
 */

var minesweeper = require('../src/rules/minesweeper.js')
var h = require('./helper.js')

var g = minesweeper.create()

// 测试辅助：构造一个已布雷的纯数据状态（只读字段，counts 交给引擎重算）。
function mk(size, mineIdx, openedIdx) {
  var total = size * size
  var cells = []
  var opened = []
  var flags = []
  for (var i = 0; i < total; i++) {
    cells.push(mineIdx.indexOf(i) >= 0 ? 1 : 0)
    opened.push(!!(openedIdx && openedIdx.indexOf(i) >= 0))
    flags.push(false)
  }
  return {
    size: size, mines: mineIdx.length, cells: cells,
    opened: opened, flags: flags,
    started: true, over: false, win: false, exploded: -1, revealAll: false
  }
}

// 测试辅助：把 0/1 的 cells 数组转成「雷下标」数组。
function mineList(cells) {
  var out = []
  for (var i = 0; i < cells.length; i++) if (cells[i] === 1) out.push(i)
  return out
}

// 测试辅助：计数一组下标里，opened 为 true 的格数。
function openedIn(cells, opened, idxs) {
  var n = 0
  for (var k = 0; k < idxs.length; k++) if (opened[idxs[k]]) n++
  return n
}

// 测试辅助：某点及其 8 邻域是否存在雷。
function safeAround(cells, size, idx) {
  if (cells[idx] === 1) return false
  var nb = minesweeper.neighbors(size, idx)
  for (var k = 0; k < nb.length; k++) if (cells[nb[k]] === 1) return false
  return true
}

// 测试辅助：可复现的随机源（线性同余，与实例注入的每次都独立）。
function seeded(seed) {
  var s = seed >>> 0
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

// ── 初始状态 ────────────────────────────────────────────────────────
h.suite('minesweeper/初始状态')
h.eq('DEFAULT_SIZE=6 / DEFAULT_MINES=6', [minesweeper.DEFAULT_SIZE, minesweeper.DEFAULT_MINES], [6, 6])
var s0 = g.newGame(6, 6).state
h.eq('size=6', s0.size, 6)
h.eq('mines=6', s0.mines, 6)
h.eq('cells 长度 36', s0.cells.length, 36)
h.eq('opened/ flags 长度 36', [s0.opened.length, s0.flags.length], [36, 36])
h.eq('未布雷前无雷', s0.cells.filter(function (v) { return v === 1 }).length, 0)
h.eq('未布雷前 started=false', s0.started, false)
h.eq('未布雷前全未开 / openedCount=0', [s0.opened.filter(Boolean).length, s0.openedCount], [0, 0])
h.eq('初始 over / win / exploded', [s0.over, s0.win, s0.exploded], [false, false, -1])

var sNull = g.newGame().state
h.eq('缺参 newGame 兜底 size=6 / mines=6', [sNull.size, sNull.mines], [6, 6])
h.eq('非法 size 兜底 6', minesweeper.create().newGame(0, 3).state.size, 6)
h.eq('越界 size 兜底 6', minesweeper.create().newGame(99, 3).state.size, 6)

// ── 首点必不踩雷（多组 size / 首点位置） ────────────────────────────
h.suite('minesweeper/首点安全')
var firstCases = [
  [4, 6, [0, 5, 15, 10]],
  [6, 6, [0, 5, 35, 14]],
  [7, 10, [0, 6, 48, 24]]
]
var allSafe = true
var allMineCount = true
var allStarted = true
var allFirstOpened = true
for (var ci = 0; ci < firstCases.length; ci++) {
  var sz = firstCases[ci][0]
  var mn = firstCases[ci][1]
  var spots = firstCases[ci][2]
  for (var pi = 0; pi < spots.length; pi++) {
    var spot = spots[pi]
    var r = g.newGame(sz, mn, spot, seeded(sz * 100 + spot)).state
    if (!safeAround(r.cells, sz, spot)) allSafe = false
    if (mineList(r.cells).length !== mn) allMineCount = false
    if (!r.started) allStarted = false
    if (!r.opened[spot]) allFirstOpened = false
  }
}
h.ok('12 组（4/6/7 边长 × 4 首点）首点及其 8 邻域全无雷', allSafe)
h.ok('12 组布雷后雷数恰为请求值', allMineCount)
h.ok('12 组布雷后 started 均为 true', allStarted)
h.ok('12 组首点均被翻开', allFirstOpened)

// 单点复核：6×6 首点 0 → 雷池禁区 = {0,1,6,7}，故 0/1/6/7 必安全
var f0 = g.newGame(6, 6, 0, seeded(7)).state
h.eq('首点 0 本身安全', f0.cells[0], 0)
h.eq('首点 0 的邻居（1/6/7）全安全', [f0.cells[1], f0.cells[6], f0.cells[7]], [0, 0, 0])
h.eq('首点 0 邻雷数 0（会连锁展开）', f0.counts[0], 0)
h.ok('首点邻域 1/6/7 邻雷数也为 0', [f0.counts[1], f0.counts[6], f0.counts[7]].every(function (v) { return v === 0 }))

// ── 雷数正确且不重复 ────────────────────────────────────────────────
h.suite('minesweeper/雷数')
var m66 = g.newGame(6, 6, 10, seeded(3)).state
h.eq('6×6/6 实际雷数 = 6', mineList(m66.cells).length, 6)
h.eq('6×6/6 state.mines 收紧为 6', m66.mines, 6)
var m77 = g.newGame(7, 10, 24, seeded(9)).state
h.eq('7×7/10 实际雷数 = 10', mineList(m77.cells).length, 10)
h.eq('7×7/10 state.mines 收紧为 10', m77.mines, 10)
h.eq('雷位互不重复（去重后数量不变）', mineList(m66.cells).length, mineList(m66.cells).filter(function (v, i, a) { return a.indexOf(v) === i }).length)
h.eq('cells 只含 0/1', m66.cells.every(function (v) { return v === 0 || v === 1 }), true)

// ── 连锁展开：0 邻域全开 / 边界（墙）停住 ───────────────────────────
h.suite('minesweeper/连锁展开')
// 单雷在右下角(24)：dig(0) 应把整盘除雷外全开 → 判胜
var chain = mk(5, [24])
var cd = g.dig(chain, 0, seeded(1))
var leftOpen = []
for (var q = 0; q < 25; q++) if (cd.state.opened[q]) leftOpen.push(q)
h.eq('单雷局面 dig(0)：翻开的格数 = 24（除雷外全开）', leftOpen.length, 24)
h.eq('单雷局面：雷格 24 未被翻开', cd.state.opened[24], false)
h.eq('单雷局面：连锁展开后判胜', [cd.state.win, cd.state.over], [true, false])
h.eq('单雷局面：openedCount = 24 = 安全格数', cd.state.openedCount, 24)
h.eq('dig 返回 opened 数组含首点 0', cd.opened.indexOf(0) >= 0, true)

// 竖墙（第 2 列 4 颗雷：2/7/12/17）：dig(0) 只开左两列、右区停住
var wall = mk(5, [2, 7, 12, 17])
var wd = g.dig(wall, 0, seeded(2))
var leftIdxs = [0, 1, 5, 6, 10, 11, 15, 16, 20, 21]
var rightIdxs = [3, 4, 8, 9, 13, 14, 18, 19, 23, 24]
h.eq('墙局面：左两列全开（10 格）', openedIn(wd.state.cells, wd.state.opened, leftIdxs), 10)
h.eq('墙局面：右两列全部未开（边界停住）', openedIn(wd.state.cells, wd.state.opened, rightIdxs), 0)
h.eq('墙局面：墙上的雷未翻开', openedIn(wd.state.cells, wd.state.opened, [2, 7, 12, 17]), 0)
h.eq('墙局面：openedCount = 10 且未判胜', [wd.state.openedCount, wd.state.win], [10, false])
h.eq('墙局面：0 邻域起始格必开（0/5/10/15/20）', openedIn(wd.state.cells, wd.state.opened, [0, 5, 10, 15, 20]), 5)
h.eq('墙局面：非 0 格只开自身（1/6/11/16/21 均开）', openedIn(wd.state.cells, wd.state.opened, [1, 6, 11, 16, 21]), 5)

// ── 四角与边缘邻居计数 ──────────────────────────────────────────────
h.suite('minesweeper/邻居与计数')
h.eq('neighbors(6,0) 角格 = 右/下/右下', minesweeper.neighbors(6, 0), [1, 6, 7])
h.eq('neighbors(6,5) 边缘 = 左/下/左下/右下', minesweeper.neighbors(6, 5), [4, 10, 11])
h.eq('neighbors(6,35) 角格 = 左/上/左上', minesweeper.neighbors(6, 35), [29, 34, 28].sort(function (a, b) { return a - b }))
h.eq('neighbors(6,14) 中格 = 8 个', minesweeper.neighbors(6, 14), [7, 8, 9, 13, 15, 19, 20, 21])
h.eq('neighbors 越界 → 空数组', minesweeper.neighbors(6, -1), [])
h.eq('neighbors 越界 → 空数组', minesweeper.neighbors(6, 36), [])

// 4×4：雷在角 0 与角 15，复核四角/边缘的邻雷数
var corners = mk(4, [0, 15])
var cn = minesweeper.countsOf(corners.cells, 4)
h.eq('角 0 是雷 → 计数记 0', cn[0], 0)
h.eq('邻角格 1 计数 = 1', cn[1], 1)
h.eq('边缘格 4 计数 = 1', cn[4], 1)
h.eq('中心格 5 计数 = 1', cn[5], 1)
h.eq('对角落的角格 3 计数 = 0', cn[3], 0)
h.eq('角 12 计数 = 0', cn[12], 0)
h.eq('雷 15 的邻近格 11 计数 = 1', cn[11], 1)
h.eq('雷 15 的邻近格 14 计数 = 1', cn[14], 1)

// ── 插旗 / 取消旗 / 已开格不可插旗 ──────────────────────────────────
h.suite('minesweeper/插旗')
var fl = mk(4, [0], [1])
var f1 = g.flag(fl, 5)
h.eq('未开格可插旗 → flagged=true', [f1.changed, f1.flagged, f1.state.flags[5]], [true, true, true])
var f2 = g.flag(f1.state, 5)
h.eq('再插一次 → 取消旗', [f2.flagged, f2.state.flags[5]], [false, false])
var f3 = g.flag(fl, 1)
h.eq('已开格不可插旗 → invalid', [f3.changed, f3.invalid], [false, true])
var f4 = g.flag(fl, -1)
h.eq('越界下标插旗 → invalid', [f4.changed, f4.invalid], [false, true])
var f5 = g.flag(fl, 16)
h.eq('越界下标(16)插旗 → invalid', f5.invalid, true)
// 安全格全开 = 已判胜的局面，此时插旗应被拒（3×3 单雷：开满 8 个安全格即胜）
var flWin = mk(3, [4], [0, 1, 2, 3, 5, 6, 7, 8])
var f6 = g.flag(flWin, 4)
h.eq('终局后插旗 → invalid', f6.invalid, true)
h.eq('插旗不改动传入 state 的 flags', (function () {
  var keep = mk(4, [0])
  g.flag(keep, 5)
  return keep.flags[5]
})(), false)

// ── 踩雷判负 ────────────────────────────────────────────────────────
h.suite('minesweeper/踩雷判负')
var lose = mk(4, [5, 10])
var ld = g.dig(lose, 5, seeded(1))
h.eq('踩雷 → exploded=true', ld.exploded, true)
h.eq('踩雷 → over=true / win=false', [ld.state.over, ld.state.win], [true, false])
h.eq('踩雷 → exploded 记为该下标', ld.state.exploded, 5)
h.eq('踩雷 → revealAll=true（展示全部雷）', ld.state.revealAll, true)
h.eq('踩雷后 dig 再次无效', g.dig(ld.state, 0).invalid, true)
h.eq('踩雷后 flag 无效', g.flag(ld.state, 0).invalid, true)

// ── 全开判胜（与雷数一致） ──────────────────────────────────────────
h.suite('minesweeper/判胜')
var winBoard = mk(3, [4], [0, 1, 2, 3, 5, 6, 7, 8])
h.eq('安全格已全开 → 读状态即 win=true', g.reveal(winBoard).state.win, true)
h.eq('安全格已全开 → 读状态 over=false', g.reveal(winBoard).state.over, false)
var nearWin = mk(3, [0], [1, 3, 4])
var nw = g.dig(nearWin, 2, seeded(1))
h.eq('补开最后安全格 → win=true', nw.state.win, true)
h.eq('判胜后 dig 无效', g.dig(nw.state, 8).invalid, true)
var notYet = mk(3, [0], [1])
h.eq('还有安全格未开 → win=false', notYet.win, false)
h.eq('判胜与雷数一致（3×3/1 雷 → 需开 8 格）', nearWin.size * nearWin.size - nearWin.mines, 8)

// ── reclaimAll / reveal ─────────────────────────────────────────────
h.suite('minesweeper/reveal')
var rv = g.reveal(mk(4, [3]))
h.eq('reveal → revealAll=true', rv.state.revealAll, true)
h.eq('reveal 不改胜负', [rv.state.over, rv.state.win], [false, false])

// ── 脏入参兜底（不抛异常） ──────────────────────────────────────────
h.suite('minesweeper/脏入参兜底')
h.eq('dig(null, 0) 兜底为全新空局首点 → 合法（changed=true，不抛异常）', g.dig(null, 0).changed, true)
h.eq('dig(null, 0) 兜底后是合法 6×6 空局', [g.dig(null, 0).state.size, g.dig(null, 0).state.cells.length], [6, 36])
h.eq('dig(null, -1) → invalid', g.dig(null, -1).invalid, true)
h.eq('dig(null, 99) → invalid', g.dig(null, 99).invalid, true)
h.eq('dig 下标 -1 → invalid', g.dig(mk(4, [0]), -1).invalid, true)
h.eq('dig 下标超界 → invalid', g.dig(mk(4, [0]), 99).invalid, true)
h.eq('dig 下标非数字 → invalid', g.dig(mk(4, [0]), 'x').invalid, true)
h.eq('dig 已开格 → invalid', g.dig(mk(4, [0], [2]), 2).invalid, true)
h.eq('dig 已插旗格 → invalid', (function () {
  var s = mk(4, [0])
  s.flags[3] = true
  return g.dig(s, 3).invalid
})(), true)
h.eq('flag(null, 0) 兜底为全新空局 → 允许插旗（不抛异常）', [g.flag(null, 0).changed, g.flag(null, 0).invalid], [true, false])
h.eq('flag(null, 99) → invalid', g.flag(null, 99).invalid, true)
h.eq('flag 下标非数字 → invalid', g.flag(mk(4, [0]), 'abc').invalid, true)
h.eq('reveal(null) → 兜底且不崩', g.reveal(null).state.revealAll, true)
h.eq('neighbors 非数字边长兜底 6', minesweeper.neighbors('x', 0), [1, 6, 7])

// ── 纯函数：不改动传入的 state ──────────────────────────────────────
h.suite('minesweeper/纯函数')
var keep = mk(5, [24], [0])
var keepCells = keep.cells.slice()
var keepOpened = keep.opened.slice()
var keepFlags = keep.flags.slice()
g.dig(keep, 5, seeded(1))
g.flag(keep, 6)
h.eq('dig/flag 后原 cells 不变', keep.cells, keepCells)
h.eq('dig/flag 后原 opened 不变', keep.opened, keepOpened)
h.eq('dig/flag 后原 flags 不变', keep.flags, keepFlags)
h.eq('dig/flag 后原 state 仍未 started 变化前状态', keep.opened[5], false)

// ── 注入固定随机可复现 ──────────────────────────────────────────────
h.suite('minesweeper/可复现')
var ra = g.newGame(6, 6, 10, seeded(12345)).state
var rb = g.newGame(6, 6, 10, seeded(12345)).state
h.eq('同种子布雷完全一致', ra.cells, rb.cells)
h.eq('同种子 counts 完全一致', ra.counts, rb.counts)
var rc = g.newGame(6, 6, 10, seeded(999)).state
h.ok('不同种子布局不同（至少一处雷位差异）', (function () {
  for (var i = 0; i < rc.cells.length; i++) if (rc.cells[i] !== ra.cells[i]) return true
  return false
})())
var fixed = g.newGame(6, 6, 0, function () { return 0.5 }).state
var fixed2 = g.newGame(6, 6, 0, function () { return 0.5 }).state
h.eq('恒定随机源布雷可复现', fixed.cells, fixed2.cells)

// ── 实例 API 齐全 ───────────────────────────────────────────────────
h.suite('minesweeper/API')
h.ok('实例含 newGame/dig/flag/reveal/neighbors/countsOf', ['newGame', 'dig', 'flag', 'reveal', 'neighbors', 'countsOf'].every(function (k) { return typeof g[k] === 'function' }))
h.ok('模块导出 create / neighbors / countsOf', [minesweeper.create, minesweeper.neighbors, minesweeper.countsOf].every(function (v) { return typeof v === 'function' }))

process.exit(h.summary())
