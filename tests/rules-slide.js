/**
 * tests/rules-slide.js — 数字华容道（3×3 滑块拼图）规则测试。
 * 随机数全部注入：洗牌走 240 步，每步用注入的比例选「与空位相邻且非上一步反向」的候选格。
 * 可解性口径（3×3 为奇数宽度）：**忽略空位后的逆序数为偶数 ⇔ 可解**（滑块拼图经典结论，
 *   奇数宽度时与空位所在行无关）——洗牌是「从完成态走合法步」得来的，故必然满足该条件。
 * 运行：node tests/rules-slide.js
 */

var slide = require('../src/rules/slide.js')
var h = require('./helper.js')

var g = slide.create(3)

// 测试辅助：构造纯数据状态（引擎只读 size / tiles / moves）。
function st(tiles, moves) {
  var z = -1
  for (var i = 0; i < tiles.length; i++) if (tiles[i] === 0) z = i
  return { size: 3, tiles: tiles, blank: z, moves: moves || 0, solved: false }
}

// 测试辅助：忽略空位后的逆序数（偶数 = 3×3 可解）。
function inversions(tiles) {
  var seq = []
  for (var i = 0; i < tiles.length; i++) if (tiles[i] !== 0) seq.push(tiles[i])
  var n = 0
  for (var a = 0; a < seq.length; a++) {
    for (var b = a + 1; b < seq.length; b++) if (seq[a] > seq[b]) n++
  }
  return n
}

// 测试辅助：tiles 是否恰好含 0..cells-1 各一次。
function permutationOk(tiles, cells) {
  var seen = []
  for (var i = 0; i < cells; i++) seen.push(false)
  for (var j = 0; j < tiles.length; j++) {
    if (tiles[j] < 0 || tiles[j] >= cells || seen[tiles[j]]) return false
    seen[tiles[j]] = true
  }
  return tiles.length === cells
}

// ── 初始状态 / 洗牌 ─────────────────────────────────────────────────
h.suite('slide/初始状态与洗牌')
h.eq('SIZE=3', g.SIZE, 3)
h.eq('CELLS=9', g.CELLS, 9)
var s0 = g.newGame(0.3)
h.eq('棋盘 9 格', s0.tiles.length, 9)
h.ok('0~8 各出现一次', permutationOk(s0.tiles, 9))
h.eq('空位下标与 blank 字段一致', s0.blank, s0.tiles.indexOf(0))
h.eq('初始步数 0', s0.moves, 0)
h.ok('洗牌后不是完成态', !g.isSolved(s0))
h.eq('洗牌局面逆序数为偶数（3×3 可解）', inversions(s0.tiles) % 2, 0)

// 连续 40 次不同注入：始终满足「合法排列 + 可解 + 未完成」
var allOk = true
var finishedHit = 0
for (var k = 0; k < 40; k++) {
  var sk = g.newGame(k / 40)
  if (!permutationOk(sk.tiles, 9)) allOk = false
  if (inversions(sk.tiles) % 2 !== 0) allOk = false
  if (sk.blank !== sk.tiles.indexOf(0)) allOk = false
  if (g.isSolved(sk)) finishedHit++
}
h.ok('40 次洗牌全部是合法且可解的未完成局面', allOk)
h.eq('40 次洗牌没有一次直接完成', finishedHit, 0)

// ── 移动合法性 ──────────────────────────────────────────────────────
h.suite('slide/移动合法性')
// 完成态 [1..8,0]：空位在 8，只有 5（上）与 7（左）可挪
var fin = st([1, 2, 3, 4, 5, 6, 7, 8, 0])
h.eq('完成态可挪格 = 上(5) / 左(7)', g.movable(fin), [5, 7])
h.eq('canTap: 5 可挪', g.canTap(fin, 5), true)
h.eq('canTap: 0 不可挪（不相邻）', g.canTap(fin, 0), false)
h.eq('canTap: 8 不可挪（是空位本身）', g.canTap(fin, 8), false)

var t5 = g.tap(fin, 5)
h.eq('挪上格：moved=true 且带出该块的值 6', [t5.moved, t5.tile], [true, 6])
h.eq('挪后 5 号变空位、8 号变成 6', [t5.state.tiles[5], t5.state.tiles[8]], [0, 6])
h.eq('挪后 blank=5、步数 1', [t5.state.blank, t5.state.moves], [5, 1])
h.eq('挪后未完成', t5.state.solved, false)

var tBad = g.tap(fin, 0)
h.eq('点不相邻的块 → moved=false', tBad.moved, false)
h.eq('点不相邻的块 → 盘面不变', tBad.state.tiles, fin.tiles)
h.eq('点不相邻的块 → 步数不变', tBad.state.moves, 0)

var tBlank = g.tap(fin, 8)
h.eq('点空位本身 → moved=false', tBlank.moved, false)
h.eq('点空位本身 → 步数不变', tBlank.state.moves, 0)

// 越界 / 脏入参不抛异常
h.eq('下标 -1 → moved=false', g.tap(fin, -1).moved, false)
h.eq('下标 9（越界）→ moved=false', g.tap(fin, 9).moved, false)
h.eq('下标非数字 → moved=false', g.tap(fin, 'x').moved, false)
h.eq('state 为 undefined → 兜底为完成态且不崩', g.tap(undefined, 0).moved, false)
h.eq('state 为 undefined → isSolved 兜底 true', g.isSolved(undefined), true)
h.eq('movesOf(undefined) = 0', g.movesOf(undefined), 0)
h.eq('movesOf(脏值) = 0', g.movesOf({ moves: 'abc' }), 0)

// 纯函数：不改动传入的 state
var before = [1, 2, 3, 4, 5, 6, 7, 8, 0]
var keep = st(before.slice())
g.tap(keep, 5)
h.eq('tap 不改动传入 state', keep.tiles, before)

// ── 连续挪动 + 通关 ─────────────────────────────────────────────────
h.suite('slide/连续挪动与通关')
// [1,2,3,4,5,6,7,0,8]：空位在 7，挪 8 号（右）即完成
var near = st([1, 2, 3, 4, 5, 6, 7, 0, 8])
h.eq('临门一脚：可挪格含 8', g.canTap(near, 8), true)
var win = g.tap(near, 8)
h.eq('完成后 tiles = [1..8,0]', win.state.tiles, [1, 2, 3, 4, 5, 6, 7, 8, 0])
h.eq('完成后 solved=true', win.state.solved, true)
h.eq('完成后 isSolved()=true', g.isSolved(win.state), true)
h.eq('完成后步数 1', win.state.moves, 1)

// 连挪两步：完成态 → 上 → 左（每次都必须重新取空位，验证 blank 跟着走）
var a1 = g.tap(fin, 5)
var a2 = g.tap(a1.state, 2)
h.eq('第二步空位已到 5 号', a1.state.blank, 5)
h.eq('第二步从 5 号空位挪 2 号（上，相邻）有效', a2.moved, true)
h.eq('两步后步数 2', a2.state.moves, 2)

// ── 洗好的局面「至少可挪一格」（不会出现无解死局） ─────────────────
h.suite('slide/可动性')
var anyMovable = true
for (var m = 0; m < 40; m++) {
  if (g.movable(g.newGame(m / 40)).length < 2) anyMovable = false
}
h.ok('任意洗好的局面都至少有 2 个可挪格（除完成态外恒 ≥2）', anyMovable)
h.eq('完成态可挪格恰好 2 个', g.movable(fin).length, 2)

// ── 4×4（引擎支持，页面暂只用 3×3） ────────────────────────────────
h.suite('slide/4×4')
var g4 = slide.create(4)
h.eq('SIZE=4 / CELLS=16', [g4.SIZE, g4.CELLS], [4, 16])
var s4 = g4.newGame(0.6)
h.eq('4×4 棋盘 16 格', s4.tiles.length, 16)
h.ok('4×4 洗牌后 0~15 各出现一次', permutationOk(s4.tiles, 16))
h.ok('4×4 洗牌后不是完成态', !g4.isSolved(s4))
h.eq('4×4 初始可挪格 2 个（空位在角上时）', g4.movable(s4).length >= 2, true)

// 非法 size 兜底
h.eq('size=5 兜底为 3', slide.create(5).SIZE, 3)
h.eq('size 缺省为 3', slide.create().SIZE, 3)
h.eq('只传随机函数：size 兜底 3', slide.create(function () { return 0.5 }).SIZE, 3)

// ── 导出的小工具 ────────────────────────────────────────────────────
h.suite('slide/工具函数')
h.eq('neighbors(3, 4) = 上下左右', slide.neighbors(3, 4), [1, 7, 3, 5])
h.eq('neighbors(3, 0) = 右 / 下', slide.neighbors(3, 0), [3, 1])
h.eq('neighbors(4, 5) = 上 / 下 / 左 / 右', slide.neighbors(4, 5), [1, 9, 4, 6])
h.eq('isFinished([1..8,0]) = true', slide.isFinished([1, 2, 3, 4, 5, 6, 7, 8, 0], 3), true)
h.eq('isFinished([1..7,0,8]) = false', slide.isFinished([1, 2, 3, 4, 5, 6, 7, 0, 8], 3), false)
h.eq('洗牌步数常量 240', slide.SHUFFLE_STEPS, 240)

process.exitCode = h.summary()
