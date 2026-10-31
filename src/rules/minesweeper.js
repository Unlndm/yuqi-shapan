/**
 * rules/minesweeper.js — 扫雷纯规则引擎。
 * 范式与 rules/g2048.js / rules/slide.js 一致：create(rand) 返回实例、状态是纯数据、
 * 随机数全部可注入（数字 / 函数 / 数组，缺省 Math.random），node 可直接测。
 *
 * 状态（纯数据）：{ size, mines, cells, counts, opened, flags, openedCount, started, over, win, exploded, revealAll }
 *   size       —— 棋盘边长（size×size）
 *   mines      —— 该局雷数（首点布雷后为「实际」雷数；请求值因禁区过大而不足时会收紧）
 *   cells      —— 长度 size² 的一维数组，1=雷、0=安全（首次 dig 前全 0）
 *   counts     —— 长度 size² 的邻雷数（由 cells 派生，读状态时总会重算，故无需自己维护）
 *   opened     —— 长度 size² 的布尔数组，true=已翻开
 *   flags      —— 长度 size² 的布尔数组，true=已插旗
 *   openedCount—— 已翻开的「安全格」数（判胜用）
 *   started    —— 是否已首点布雷
 *   over / win —— 判负 / 判胜（互斥）
 *   exploded   —— 踩中的雷下标（-1=无）
 *   revealAll  —— 是否要展示全部雷（判负置 true）
 *
 * 首点必不踩雷：**先点后布雷** —— 首次 dig 才布雷，并把首点及其 8 邻域排除在雷池之外；
 *   故首点及其邻域必为安全格，且邻域邻雷数必为 0（触发连锁展开）。
 * 连锁展开：翻开 0 邻域格时，把它 8 邻域里的未开格压栈继续翻；0 邻域格再连锁，非 0 格翻自身即止。
 *   · 已插旗的格不翻（展开在此「停住」）；越界邻居自然不入栈（棋盘边界停住）。
 *
 * 所有函数对非法入参安全兜底：不抛异常、不改动传入的 state（纯函数）、返回 { state, ... } 或纯值。
 */

var DEFAULT_SIZE = 6
var DEFAULT_MINES = 6
var MIN_SIZE = 2
var MAX_SIZE = 16

// 输入：任意值；输出：是否为有限数。
function isNum(v) {
  return typeof v === 'number' && isFinite(v)
}

// 输入：任意值、兜底值；输出：取整后的数（非有限数一律兜底）。
function toInt(v, def) {
  return isNum(v) ? Math.floor(v) : def
}

// 输入：任意值；输出：[0,1) 内的安全随机比例（脏值一律兜底 0）。
function ratio(v) {
  if (typeof v !== 'number' || isNaN(v) || v <= 0) return 0
  if (v >= 1) return 0.999999
  return v
}

// 输入：rand（函数 / 数字 / 数组 / 缺省）；输出：返回 0~1 的函数（缺省 Math.random）。
// 数字 → 每次返回同一比例（足够可复现）；数组 → 按序循环取用，可驱动整段洗牌。
function makeRand(rand) {
  if (typeof rand === 'function') return function () { return ratio(rand()) }
  if (typeof rand === 'number') return function () { return ratio(rand) }
  if (rand && typeof rand === 'object' && isNum(rand.length) && rand.length > 0) {
    var k = 0
    return function () { var x = rand[k % rand.length]; k++; return ratio(x) }
  }
  return Math.random
}

// 输入：任意值；输出：合法边长（非有限数或越界一律兜底 DEFAULT_SIZE）。
function normSize(v) {
  var n = toInt(v, DEFAULT_SIZE)
  if (n < MIN_SIZE || n > MAX_SIZE) return DEFAULT_SIZE
  return n
}

// 输入：任意值、棋盘总格数；输出：合法雷数（非有限数兜底 DEFAULT_MINES，再收敛到 [0, total]）。
function normMines(v, total) {
  var m = toInt(v, DEFAULT_MINES)
  if (m < 0) m = 0
  if (m > total) m = total
  return m
}

// 输入：棋盘边长、下标；输出：同 8 邻域且未越界的下标数组（行优先顺序）。
// 越界下标、非法入参 → 空数组。
function neighbors(size, i) {
  var out = []
  var n = normSize(size)
  var idx = toInt(i, -1)
  if (idx < 0 || idx >= n * n) return out
  var r = Math.floor(idx / n)
  var c = idx % n
  for (var dr = -1; dr <= 1; dr++) {
    for (var dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      var nr = r + dr
      var nc = c + dc
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue
      out.push(nr * n + nc)
    }
  }
  return out
}

// 输入：cells（0/1 数组）；输出：雷总数。
function countMines(cells) {
  var c = 0
  for (var i = 0; i < cells.length; i++) if (cells[i] === 1) c++
  return c
}

// 输入：cells、边长；输出：长度 size² 的邻雷数（雷格记 0）。
function countsOf(cells, size) {
  var n = normSize(size)
  var total = n * n
  var out = []
  for (var i = 0; i < total; i++) {
    if (cells && cells[i] === 1) { out.push(0); continue }
    var nb = neighbors(n, i)
    var c = 0
    for (var k = 0; k < nb.length; k++) if (cells && cells[nb[k]] === 1) c++
    out.push(c)
  }
  return out
}

// 输入：cells、opened；输出：已翻开的「安全格」数（雷格不计）。
function countOpenedSafe(cells, opened) {
  var c = 0
  for (var i = 0; i < cells.length; i++) if (opened[i] && cells[i] !== 1) c++
  return c
}

// 输入：空局参数；输出：全新状态（未布雷、全未开）。
function emptyState(n, m) {
  var total = n * n
  var cells = []
  var counts = []
  var opened = []
  var flags = []
  for (var i = 0; i < total; i++) {
    cells.push(0)
    counts.push(0)
    opened.push(false)
    flags.push(false)
  }
  return {
    size: n, mines: m, cells: cells, counts: counts,
    opened: opened, flags: flags, openedCount: 0,
    started: false, over: false, win: false, exploded: -1, revealAll: false
  }
}

// 输入：任意 state（脏值兜底）；输出：干净的状态副本（数组全部重建，counts/openedCount/win 由数据重算）。
// 关键约定：**不读也不改传入对象**，只读字段、输出新对象 —— 保证各函数是纯函数。
function normalize(state) {
  var n = normSize(state && state.size)
  var total = n * n
  var cellsIn = state && state.cells
  var openedIn = state && state.opened
  var flagsIn = state && state.flags
  var cells = []
  var opened = []
  var flags = []
  for (var i = 0; i < total; i++) {
    cells.push(cellsIn && (cellsIn[i] === 1 || cellsIn[i] === true) ? 1 : 0)
    opened.push(!!(openedIn && openedIn[i]))
    flags.push(!!(flagsIn && flagsIn[i]))
  }
  var actualMines = countMines(cells)
  var mines = state && isNum(state.mines) ? Math.floor(state.mines) : actualMines
  if (mines < 0) mines = 0
  var over = !!(state && state.over)
  var openedCount = countOpenedSafe(cells, opened)
  var safeTotal = total - actualMines
  var win = !over && safeTotal > 0 && openedCount >= safeTotal
  return {
    size: n, mines: mines, cells: cells, counts: countsOf(cells, n),
    opened: opened, flags: flags, openedCount: openedCount,
    started: !!(state && state.started),
    over: over, win: win,
    exploded: state && isNum(state.exploded) ? Math.floor(state.exploded) : -1,
    revealAll: !!(state && state.revealAll)
  }
}

// 输入：边长、雷数、首点下标（-1=无）、rand 函数；输出：长度 size² 的雷位（0/1）。
// 首点及其 8 邻域被排除在雷池之外（保证首点必不踩雷）；候选池洗牌后取前 mines 个。
function placeMines(size, mines, first, rand) {
  var n = normSize(size)
  var total = n * n
  var cells = []
  for (var i = 0; i < total; i++) cells.push(0)
  var forbid = {}
  if (first >= 0 && first < total) {
    forbid[first] = true
    var nb = neighbors(n, first)
    for (var b = 0; b < nb.length; b++) forbid[nb[b]] = true
  }
  var pool = []
  for (var p = 0; p < total; p++) if (!forbid[p]) pool.push(p)
  // Fisher–Yates 洗牌：用注入的 rand 驱动，可完全复现
  for (var k = pool.length - 1; k > 0; k--) {
    var j = Math.floor(rand() * (k + 1))
    if (j < 0) j = 0
    if (j > k) j = k
    var t = pool[k]
    pool[k] = pool[j]
    pool[j] = t
  }
  var place = Math.min(mines, pool.length)
  for (var q = 0; q < place; q++) cells[pool[q]] = 1
  return cells
}

// 输入：干净状态、起点下标；输出：本次新翻开的升序下标数组（就地翻 st.opened）。
function expand(st, startIdx) {
  var total = st.size * st.size
  var newly = []
  var stack = [startIdx]
  while (stack.length) {
    var i = stack.pop()
    if (i < 0 || i >= total) continue
    if (st.opened[i]) continue
    if (st.flags[i]) continue      // 旗子挡开：展开在旗子处停住
    if (st.cells[i] === 1) continue // 雷不翻
    st.opened[i] = true
    newly.push(i)
    if (st.counts[i] === 0) {
      var nb = neighbors(st.size, i)
      for (var k = 0; k < nb.length; k++) {
        if (!st.opened[nb[k]] && !st.flags[nb[k]]) stack.push(nb[k])
      }
    }
  }
  newly.sort(function (a, b) { return a - b })
  return newly
}

function create(rand) {
  var defRand = makeRand(rand)

  // 输入：本次 rand（缺省用实例注入的）；输出：0~1 函数。
  function randOf(r) {
    return r === undefined ? defRand : makeRand(r)
  }

  // 输入：size、mines、可选 firstIdx（给了就等价于在该点做首点）、可选 rand；
  // 输出：{ state }（给了 firstIdx 时附 { opened, exploded, invalid }）。
  function newGame(size, mines, firstIdx, r) {
    var n = normSize(size)
    var total = n * n
    var m = normMines(mines, total)
    var st = emptyState(n, m)
    var f = toInt(firstIdx, -1)
    if (f >= 0 && f < total) {
      var res = dig(st, f, r)
      return { state: res.state, opened: res.opened, exploded: res.exploded, invalid: res.invalid }
    }
    return { state: st }
  }

  // 输入：state、下标 idx、可选 rand；输出：{ state, changed, opened, exploded, invalid }。
  // 未布雷 → 先首点布雷；踩雷 → over=true；翻开 0 邻域 → 连锁展开；全开 → win=true。
  function dig(state, idx, r) {
    var st = normalize(state)
    var total = st.size * st.size
    var i = toInt(idx, -1)
    if (st.over || st.win) return { state: st, changed: false, opened: [], exploded: false, invalid: true }
    if (i < 0 || i >= total) return { state: st, changed: false, opened: [], exploded: false, invalid: true }
    if (st.opened[i] || st.flags[i]) return { state: st, changed: false, opened: [], exploded: false, invalid: true }
    if (!st.started) {
      st.cells = placeMines(st.size, st.mines, i, randOf(r))
      st.counts = countsOf(st.cells, st.size)
      st.mines = countMines(st.cells)
      st.started = true
    }
    if (st.cells[i] === 1) {
      st.over = true
      st.win = false
      st.revealAll = true
      st.exploded = i
      return { state: st, changed: true, opened: [], exploded: true, invalid: false }
    }
    var newly = expand(st, i)
    st.openedCount = countOpenedSafe(st.cells, st.opened)
    var safeTotal = total - countMines(st.cells)
    st.win = safeTotal > 0 && st.openedCount >= safeTotal
    return { state: st, changed: true, opened: newly, exploded: false, invalid: false }
  }

  // 输入：state、下标 idx；输出：{ state, changed, invalid, flagged }。
  // 已开格 / 越界 / 已终局 → invalid（不动盘面）；否则翻转旗标。
  function flag(state, idx) {
    var st = normalize(state)
    var total = st.size * st.size
    var i = toInt(idx, -1)
    if (st.over || st.win) return { state: st, changed: false, invalid: true, flagged: false }
    if (i < 0 || i >= total) return { state: st, changed: false, invalid: true, flagged: false }
    if (st.opened[i]) return { state: st, changed: false, invalid: true, flagged: false }
    st.flags[i] = !st.flags[i]
    return { state: st, changed: true, invalid: false, flagged: st.flags[i] }
  }

  // 输入：state；输出：{ state }（revealAll=true —— 展示全部雷，不改胜负）。
  function reveal(state) {
    var st = normalize(state)
    st.revealAll = true
    return { state: st }
  }

  return {
    SIZE_DEFAULT: DEFAULT_SIZE,
    MIN_SIZE: MIN_SIZE,
    MAX_SIZE: MAX_SIZE,
    newGame: newGame,
    dig: dig,
    flag: flag,
    reveal: reveal,
    neighbors: neighbors,
    countsOf: countsOf
  }
}

module.exports = {
  create: create,
  // 导出给测试与调参用
  DEFAULT_SIZE: DEFAULT_SIZE,
  DEFAULT_MINES: DEFAULT_MINES,
  MIN_SIZE: MIN_SIZE,
  MAX_SIZE: MAX_SIZE,
  neighbors: neighbors,
  countsOf: countsOf
}
