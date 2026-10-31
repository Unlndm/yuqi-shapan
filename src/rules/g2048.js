/**
 * rules/g2048.js — 2048 纯规则引擎（支持 3×3 / 4×4 两档，默认 4×4）。
 * 范式与 rules/monopoly.js / rules/slide.js 一致：create(size, rand) 返回实例、状态是纯数据、
 * 随机数全部可注入，node 可直接测。
 * 归并口径（标准 2048）：行/列先向移动方向压实，再让相邻同值两块合并成一块，
 *   每块每步最多参与一次合并 —— 所以 [2,2,2,2] 左移是 [4,4,0,0] 而不是 [8,0,0,0]。
 * 生成口径：**只在棋盘确实变化（moved）时**才在空位随机落一块（90% 为 2、10% 为 4）；
 *   没变化就不生成、不加分，否则会出现「原地蹭分」。
 * 随机注入：move(state, dir, rand) 的 rand 可为 0~1 数字，或 [位置比例, 数值比例] 数组；
 *   位置比例决定落在第几个空位（按行优先扫描），数值比例 < 0.9 出 2、否则出 4。缺省用 Math.random。
 * 档位口径（本轮新增）：3 = 3×3、4 = 4×4（默认），其它值兜底 4；
 *   **达成线随档位变**：4×4 → 2048；3×3 满盘只有 9 格、理论到不了 2048，取 256 作「达成」线。
 * 兼容：create() / create([0,0]) / create(randFn) 一律按 4×4 解释（第一参不是数字就当作随机源）。
 * 所有函数对非法入参安全兜底（不抛异常、不返回 undefined 字段）。
 */

var DEFAULT_SIZE = 4
var WIN_4 = 2048
var WIN_3 = 256

// 输入：任意值；输出：允许的边长（仅 3 / 4，其余兜底 4）。
function normalizeSize(v) {
  return v === 3 ? 3 : DEFAULT_SIZE
}

// 输入：rand（数字 / 数组 / 缺省）；输出：[0,1) 内的安全随机比例（脏值一律兜底 0）。
function ratio(v) {
  if (typeof v !== 'number' || isNaN(v) || v <= 0) return 0
  if (v >= 1) return 0.999999
  return v
}

// 输入：rand（数字 / 数组 / 缺省）；输出：[位置比例, 数值比例] 二元组。
function pair(rand) {
  if (rand === undefined || rand === null) return [Math.random(), Math.random()]
  if (typeof rand === 'number') return [ratio(rand), ratio(rand)]
  if (typeof rand === 'object' && rand.length) {
    return [ratio(rand[0]), rand.length >= 2 ? ratio(rand[1]) : ratio(rand[0])]
  }
  return [Math.random(), Math.random()]
}

// 输入：state（脏值兜底）、格数；输出：长度 cells 的纯数字棋盘（0 表示空）。
function readBoard(state, cells) {
  var src = state && state.board
  var out = []
  for (var i = 0; i < cells; i++) {
    var v = src && typeof src[i] === 'number' && isFinite(src[i]) && src[i] > 0 ? Math.floor(src[i]) : 0
    out.push(v)
  }
  return out
}

// 输入：棋盘、rand、格数；输出：{idx, val} 或 null（无空位）。就地（board）落一块。
function spawn(board, rand, cells) {
  var empties = []
  for (var i = 0; i < cells; i++) if (board[i] === 0) empties.push(i)
  if (!empties.length) return null
  var p = pair(rand)
  var at = empties[Math.min(empties.length - 1, Math.floor(p[0] * empties.length))]
  var val = p[1] < 0.9 ? 2 : 4
  board[at] = val
  return { idx: at, val: val }
}

// 输入：一条按「落点在前」排好的 n 值行、边长 n；输出：{out, gained, merged}。
// merged 记录每次合并**产生的新值**（如 n=4 的 [2,2,2,2] → merged=[4,4]、gained=8）。
function slide(line, n) {
  var packed = []
  for (var i = 0; i < n; i++) if (line[i] > 0) packed.push(line[i])
  var out = []
  var merged = []
  var gained = 0
  var k = 0
  while (k < packed.length) {
    if (k + 1 < packed.length && packed[k] === packed[k + 1]) {
      var m = packed[k] * 2
      out.push(m)
      merged.push(m)
      gained += m
      k += 2
    } else {
      out.push(packed[k])
      k++
    }
  }
  while (out.length < n) out.push(0)
  return { out: out, gained: gained, merged: merged }
}

// 输入：方向、第 n 条线（n = 行/列号，按行优先）、边长 size；输出：该线 size 格的索引（落点在前）。
function lineCells(dir, n, size) {
  var idx = []
  var i
  if (dir === 'left') { for (i = 0; i < size; i++) idx.push(n * size + i) }
  else if (dir === 'right') { for (i = size - 1; i >= 0; i--) idx.push(n * size + i) }
  else if (dir === 'up') { for (i = 0; i < size; i++) idx.push(i * size + n) }
  else { for (i = size - 1; i >= 0; i--) idx.push(i * size + n) }
  return idx
}

// 输入：棋盘、格数；输出：最大值（空盘为 0）。
function maxOf(board, cells) {
  var m = 0
  for (var i = 0; i < cells; i++) if (board[i] > m) m = board[i]
  return m
}

// 输入：棋盘、边长；输出：是否还能动（存在空位 或 上下左右任一相邻同值）。
function movable(board, size) {
  var cells = size * size
  for (var i = 0; i < cells; i++) if (board[i] === 0) return true
  for (var r = 0; r < size; r++) {
    for (var c = 0; c < size - 1; c++) {
      if (board[r * size + c] === board[r * size + c + 1]) return true
    }
  }
  for (var c2 = 0; c2 < size; c2++) {
    for (var r2 = 0; r2 < size - 1; r2++) {
      if (board[r2 * size + c2] === board[(r2 + 1) * size + c2]) return true
    }
  }
  return false
}

function create(size, rand) {
  // 允许 create() / create([0,0]) / create(randFn)：第一参不是数字就当作随机源
  if (typeof size !== 'number' && rand === undefined) { rand = size; size = undefined }
  var n = normalizeSize(size)
  var cells = n * n
  var winTile = n === 3 ? WIN_3 : WIN_4
  var defRand = rand

  // 输入：可选的本次 rand（缺省用 create 时注入的 rand，再缺省用 Math.random）；
  // 输出：带 2 块初始块的新局状态。
  function newGame(r) {
    var b = []
    for (var i = 0; i < cells; i++) b.push(0)
    var use = r !== undefined ? r : defRand
    spawn(b, use, cells)
    spawn(b, use, cells)
    return { board: b, score: 0, best: 0, over: false, won: false, moved: false }
  }

  // 输入：state、dir（'up'|'down'|'left'|'right'）、rand；
  // 输出：{ state, moved, gained, spawned, merged, won }。
  function move(state, dir, r) {
    var board = readBoard(state, cells)
    var score = state && typeof state.score === 'number' && isFinite(state.score) ? state.score : 0
    var best = state && typeof state.best === 'number' && isFinite(state.best) ? state.best : 0
    var wonBefore = !!(state && state.won)
    var use = r !== undefined ? r : defRand
    // 未变化时的返回：棋盘/分数原样，over 按当前盘面算，不生成也不加分。
    var still = {
      board: board.slice(), score: score, best: best,
      over: !movable(board, n), won: wonBefore, moved: false
    }
    if (dir !== 'up' && dir !== 'down' && dir !== 'left' && dir !== 'right') {
      return { state: still, moved: false, gained: 0, spawned: null, merged: [], won: wonBefore }
    }
    var next = board.slice()
    var gained = 0
    var merged = []
    for (var k = 0; k < n; k++) {
      var idx = lineCells(dir, k, n)
      var line = []
      for (var j = 0; j < n; j++) line.push(board[idx[j]])
      var res = slide(line, n)
      gained += res.gained
      for (var q = 0; q < res.merged.length; q++) merged.push(res.merged[q])
      for (var w = 0; w < n; w++) next[idx[w]] = res.out[w]
    }
    var moved = false
    for (var i = 0; i < cells; i++) if (next[i] !== board[i]) { moved = true; break }
    if (!moved) {
      return { state: still, moved: false, gained: 0, spawned: null, merged: [], won: wonBefore }
    }
    var sp = spawn(next, use, cells)
    var newScore = score + gained
    var won = wonBefore || maxOf(next, cells) >= winTile
    var outState = {
      board: next, score: newScore, best: Math.max(best, newScore),
      over: !movable(next, n), won: won, moved: true
    }
    return {
      state: outState, moved: true, gained: gained,
      spawned: sp ? sp.val : null, merged: merged, won: won
    }
  }

  function canMove(state) { return movable(readBoard(state, cells), n) }
  function isOver(state) { return !movable(readBoard(state, cells), n) }
  function maxTile(state) { return maxOf(readBoard(state, cells), cells) }

  return {
    SIZE: n,
    CELLS: cells,
    WIN_TILE: winTile,
    newGame: newGame,
    move: move,
    canMove: canMove,
    isOver: isOver,
    maxTile: maxTile
  }
}

module.exports = {
  create: create,
  DEFAULT_SIZE: DEFAULT_SIZE,
  WIN_3: WIN_3,
  WIN_4: WIN_4
}
