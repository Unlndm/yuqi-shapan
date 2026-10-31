/**
 * rules/slide.js — 数字华容道（N×N 滑块拼图）纯规则引擎。
 * 范式与 rules/g2048.js / rules/monopoly.js 一致：create(size, rand) 返回实例、状态是纯数据、
 * 随机数全部可注入，node 可直接测；所有函数对非法入参安全兜底（不抛异常、不返回 undefined 字段）。
 *
 * 状态：{ size, tiles, blank, moves, solved }
 *   tiles —— 长度 size² 的一维数组，0 = 空位，其余为 1..size²-1，索引 = 行×size + 列；
 *   blank —— 空位下标（冗余字段，避免每步重扫）；
 *   moves —— 已走步数（每次成功挪动 +1）。
 *
 * 移动口径：只能点「与空位同行或同列、且紧邻」的那一块 —— 拼图里唯一合法的走法。
 *   点空位本身、点不相邻的块都视为无效（moved=false），不消耗步数。
 *
 * 洗牌口径：**从已完成局面出发随机走合法步**，不是随机排列 ——
 *   随机排列需先用逆序数奇偶判可解性，且有一半概率死局；随手走合法步则**必然可解**。
 *   走 SHUFFLE_STEPS 步、每步不走上一步的反向（避免原地来回）；若恰好走回完成态则再补走一步。
 *
 * 通关口径：tiles = [1, 2, …, size²-1, 0]（空位落在右下角）。
 */

var DEFAULT_SIZE = 3
var SHUFFLE_STEPS = 240

// 输入：任意值；输出：允许的边长（仅 3 / 4，其余兜底 3）。
function normalizeSize(v) {
  return v === 4 ? 4 : DEFAULT_SIZE
}

// 输入：size、下标 i；输出：与 i 同行/同列且紧邻的下标数组（越界的不收录）。
function neighbors(size, i) {
  var out = []
  var r = Math.floor(i / size)
  var c = i % size
  if (r > 0) out.push(i - size)
  if (r < size - 1) out.push(i + size)
  if (c > 0) out.push(i - 1)
  if (c < size - 1) out.push(i + 1)
  return out
}

// 输入：rand（0~1 数字 / 返回 0~1 的函数 / 缺省）、候选个数 len；输出：0..len-1 的下标。
// 注入数字可让洗牌与测试完全可复现；脏值一律兜底 0。
function pickOne(rand, len) {
  var x = typeof rand === 'function' ? rand() : rand
  if (typeof x !== 'number' || isNaN(x) || x < 0) x = 0
  if (x >= 1) x = 0.999999
  var at = Math.floor(x * len)
  if (at > len - 1) at = len - 1
  return at
}

// 输入：任意值；输出：长度 size² 的合法棋盘（脏值兜底为「已完成」排列）。
function readTiles(state, size) {
  var cells = size * size
  var src = state && state.tiles
  var out = []
  var ok = true
  for (var i = 0; i < cells; i++) {
    var v = src && typeof src[i] === 'number' && isFinite(src[i]) ? Math.floor(src[i]) : NaN
    if (!(v >= 0 && v < cells)) { ok = false; break }
    out.push(v)
  }
  if (ok && uniqueOk(out, cells)) return out
  return finishedTiles(size)
}

// 内部：校验「0..cells-1 各出现一次」。
function uniqueOk(tiles, cells) {
  var seen = []
  for (var i = 0; i < cells; i++) seen.push(false)
  for (var j = 0; j < cells; j++) {
    if (tiles[j] < 0 || tiles[j] >= cells || seen[tiles[j]]) return false
    seen[tiles[j]] = true
  }
  return true
}

// 输入：size；输出：已完成局面（1..cells-1 顺序排列 + 末尾空位）。
function finishedTiles(size) {
  var cells = size * size
  var out = []
  for (var i = 0; i < cells - 1; i++) out.push(i + 1)
  out.push(0)
  return out
}

// 输入：tiles、size；输出：是否已完成。
function isFinished(tiles, size) {
  var cells = size * size
  for (var i = 0; i < cells - 1; i++) if (tiles[i] !== i + 1) return false
  return tiles[cells - 1] === 0
}

// 输入：tiles、size；输出：空位下标（找不到时兜底末尾）。
function blankOf(tiles, size) {
  var cells = size * size
  for (var i = 0; i < cells; i++) if (tiles[i] === 0) return i
  return cells - 1
}

function create(size, rand) {
  // 允许 create(randFn) 这种「只给随机源」的调用（与其它规则模块的注入习惯一致）
  if (typeof size === 'function' && rand === undefined) { rand = size; size = undefined }
  var n = normalizeSize(size)
  var cells = n * n
  var defRand = typeof rand === 'function' ? rand : Math.random

  // 输入：可选的本次 rand（缺省用 create 时注入的，再缺省 Math.random）；输出：洗好的新局状态。
  function newGame(r) {
    var use = r !== undefined ? r : defRand
    var t = finishedTiles(n)
    var blank = cells - 1
    var prev = -1
    for (var s = 0; s < SHUFFLE_STEPS; s++) {
      var nb = neighbors(n, blank)
      var opts = []
      for (var i = 0; i < nb.length; i++) if (nb[i] !== prev) opts.push(nb[i])
      var at = opts[pickOne(use, opts.length)]
      t[blank] = t[at]
      t[at] = 0
      prev = blank
      blank = at
    }
    // 极小概率恰好走回完成态：补走一步（有 prev 约束，至少还有一个候选）
    for (var guard = 0; guard < 4 && isFinished(t, n); guard++) {
      var nb2 = neighbors(n, blank)
      var opts2 = []
      for (var j = 0; j < nb2.length; j++) if (nb2[j] !== prev) opts2.push(nb2[j])
      var at2 = opts2[pickOne(use, opts2.length)]
      t[blank] = t[at2]
      t[at2] = 0
      blank = at2
    }
    return { size: n, tiles: t, blank: blank, moves: 0, solved: false }
  }

  // 输入：state、下标 idx；输出：{ state, moved, tile }。
  // 只有「与空位紧邻的那一块」能挪；空位本身、不相邻的块 → moved=false（状态原样返回，步数不加）。
  function tap(state, idx) {
    var t = readTiles(state, n)
    var blank = blankOf(t, n)
    var moves = state && typeof state.moves === 'number' && isFinite(state.moves) ? state.moves : 0
    var i = typeof idx === 'number' && isFinite(idx) ? Math.floor(idx) : -1
    var still = { size: n, tiles: t, blank: blank, moves: moves, solved: isFinished(t, n) }
    if (i < 0 || i >= cells || t[i] === 0) return { state: still, moved: false, tile: 0 }
    var nb = neighbors(n, blank)
    var adjacent = false
    for (var k = 0; k < nb.length; k++) if (nb[k] === i) { adjacent = true; break }
    if (!adjacent) return { state: still, moved: false, tile: t[i] }
    var val = t[i]
    var next = t.slice()
    next[blank] = val
    next[i] = 0
    var done = isFinished(next, n)
    return {
      state: { size: n, tiles: next, blank: i, moves: moves + 1, solved: done },
      moved: true,
      tile: val
    }
  }

  // 输入：state；输出：当前可挪动的下标数组（升序）。
  function movable(state) {
    var t = readTiles(state, n)
    var blank = blankOf(t, n)
    var nb = neighbors(n, blank)
    var out = []
    for (var i = 0; i < nb.length; i++) if (t[nb[i]] !== 0) out.push(nb[i])
    out.sort(function (a, b) { return a - b })
    return out
  }

  // 输入：state、idx；输出：该格当前是否可挪。
  function canTap(state, idx) {
    return movable(state).indexOf(idx) >= 0
  }

  function isSolved(state) { return isFinished(readTiles(state, n), n) }
  function movesOf(state) {
    return state && typeof state.moves === 'number' && isFinite(state.moves) ? state.moves : 0
  }

  return {
    SIZE: n,
    CELLS: cells,
    newGame: newGame,
    tap: tap,
    movable: movable,
    canTap: canTap,
    isSolved: isSolved,
    movesOf: movesOf
  }
}

module.exports = {
  create: create,
  // 导出给测试与调参用
  DEFAULT_SIZE: DEFAULT_SIZE,
  SHUFFLE_STEPS: SHUFFLE_STEPS,
  neighbors: neighbors,
  isFinished: isFinished
}
