/**
 * tests/rules-g2048.js — 2048（4×4）规则测试。
 * 随机数全部注入：位置比例放第几个空位、数值比例 <0.9 出 2 / 否则出 4；
 * 传 [1,1] 时「落在最后一个空位 + 出 4」——把生成块钉在最右下角，便于断言合并行不受污染。
 * 运行：node tests/rules-g2048.js
 */

var g2048 = require('../src/rules/g2048.js')
var h = require('./helper.js')

var g = g2048.create()

// 测试辅助：把长度不足 16 的数组补零成合法棋盘。
function full(arr) {
  var b = []
  for (var i = 0; i < 16; i++) b.push(arr[i] === undefined ? 0 : arr[i])
  return b
}

// 测试辅助：构造一个纯数据状态（引擎只读 board/score/best/won）。
function st(board) {
  return { board: board, score: 0, best: 0, over: false, won: false, moved: false }
}

// ── 初始状态 ────────────────────────────────────────────────────────
h.suite('g2048/初始状态')
var g0 = g2048.create([0, 0])
var s0 = g0.newGame()
h.eq('SIZE=4', g0.SIZE, 4)
h.eq('棋盘 16 格', s0.board.length, 16)
h.eq('开局恰好 2 块（注入固定随机数）', s0.board.filter(function (v) { return v > 0 }).length, 2)
h.eq('开局块落在 0/1 号格且值为 2', [s0.board[0], s0.board[1]], [2, 2])
h.ok('开局块的值只能是 2 或 4', s0.board.every(function (v) { return v === 0 || v === 2 || v === 4 }))
h.eq('初始分数 0 / 未结束 / 未达成 / 未移动', [s0.score, s0.over, s0.won, s0.moved], [0, false, false, false])

var s0r = g2048.create().newGame()
h.eq('默认随机开局也是 2 块', s0r.board.filter(function (v) { return v > 0 }).length, 2)

// ── 四方向移动 ──────────────────────────────────────────────────────
h.suite('g2048/四方向移动')
var lr = g.move(st(full([2, 2, 2, 2])), 'left', [1, 1])
h.eq('左移 [2,2,2,2] → [4,4,0,0]', lr.state.board.slice(0, 4), [4, 4, 0, 0])
h.eq('左移 moved=true', lr.moved, true)
h.eq('左移后其余格全空（4~14）', lr.state.board.slice(4, 15).every(function (v) { return v === 0 }), true)
h.eq('左移生成块钉在最后空位 15 且为 4', [lr.spawned, lr.state.board[15]], [4, 4])

var rr = g.move(st(full([2, 2, 2, 2])), 'right', [1, 1])
h.eq('右移 [2,2,2,2] → [0,0,4,4]', rr.state.board.slice(0, 4), [0, 0, 4, 4])
h.eq('右移得分 8', rr.gained, 8)

// 第 0 列放满 2（索引 0/4/8/12），用于上下移动
var col0 = full([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0])
var ur = g.move(st(col0.slice()), 'up', [1, 1])
h.eq('上移第 0 列 → 0/4 为 4,4', [ur.state.board[0], ur.state.board[4], ur.state.board[8], ur.state.board[12]], [4, 4, 0, 0])
h.eq('上移得分 8', ur.gained, 8)

var dr = g.move(st(col0.slice()), 'down', [1, 1])
h.eq('下移第 0 列 → 8/12 为 4,4', [dr.state.board[8], dr.state.board[12]], [4, 4])
h.eq('下移第 0 列顶端清空', [dr.state.board[0], dr.state.board[4]], [0, 0])

// 左移作用于每一行：第 0 行合并、第 1 行仅滑动
var mr = g.move(st(full([2, 2, 2, 2, 2, 2, 0, 0])), 'left', [1, 1])
h.eq('多行同时左移：第 0 行合并', [mr.state.board[0], mr.state.board[1]], [4, 4])
h.eq('多行同时左移：第 1 行滑动', [mr.state.board[4], mr.state.board[5]], [4, 0])

// 位移但不合并：计分应保持 0、merged 为空
var sr0 = g.move(st(full([0, 0, 2, 0])), 'left', [1, 1])
h.eq('纯滑动 moved=true 但得分 0', [sr0.moved, sr0.gained], [true, 0])
h.eq('纯滑动无合并项', sr0.merged, [])
h.eq('纯滑动把 2 推到最左', sr0.state.board[0], 2)

// ── 同值不连续合并两次 ──────────────────────────────────────────────
h.suite('g2048/同值不二次合并')
var d1 = g.move(st(full([4, 4, 4, 4])), 'left', [1, 1])
h.eq('[4,4,4,4] 左移 → [8,8,0,0]', d1.state.board.slice(0, 4), [8, 8, 0, 0])
h.eq('[4,4,4,4] 左移得分 16', d1.gained, 16)
h.eq('[4,4,4,4] 左移 merged=[8,8]', d1.merged, [8, 8])

var d2 = g.move(st(full([2, 2, 2, 2])), 'left', [1, 1])
h.eq('[2,2,2,2] 合并后最大块是 4（不是 8）', g.maxTile(d2.state), 4)
h.eq('[2,2,2,2] merged=[4,4]', d2.merged, [4, 4])

var d3 = g.move(st(full([2, 2, 4, 0])), 'left', [1, 1])
h.eq('[2,2,4] 左移 → [4,4,0,0]（不贪心连并）', d3.state.board.slice(0, 4), [4, 4, 0, 0])
h.eq('[2,2,4] 得分 4', d3.gained, 4)

var d4 = g.move(st(full([2, 2, 2, 0])), 'left', [1, 1])
h.eq('[2,2,2] 左移 → [4,2,0,0]', d4.state.board.slice(0, 4), [4, 2, 0, 0])

var d5 = g.move(st(full([0, 2, 2, 2])), 'left', [1, 1])
h.eq('[0,2,2,2] 左移 → [4,2,0,0]', d5.state.board.slice(0, 4), [4, 2, 0, 0])

var d6 = g.move(st(full([2, 2, 0, 2])), 'left', [1, 1])
h.eq('[2,2,0,2] 左移 → [4,2,0,0]', d6.state.board.slice(0, 4), [4, 2, 0, 0])

var d7 = g.move(st(full([8, 8, 8, 8])), 'left', [1, 1])
h.eq('[8,8,8,8] 左移 → [16,16,0,0]', d7.state.board.slice(0, 4), [16, 16, 0, 0])

// ── 未变化不生成 ────────────────────────────────────────────────────
h.suite('g2048/未变化不生成')
var n1 = g.move(st(full([2, 4, 8, 16])), 'left', [1, 1])
h.eq('已压实无同值 → moved=false', n1.moved, false)
h.eq('未变化 → spawned=null', n1.spawned, null)
h.eq('未变化 → 得分 0 / merged 空', [n1.gained, n1.merged], [0, []])
h.eq('未变化 → 棋盘原样', n1.state.board.slice(0, 4), [2, 4, 8, 16])

var n2 = g.move(st(full([2, 0, 0, 0])), 'left', [1, 1])
h.eq('单个已在最左 → moved=false', [n2.moved, n2.spawned], [false, null])

var n3 = g.move(st(full([0, 0, 0, 2])), 'right', [1, 1])
h.eq('单个已在最右 → moved=false', n3.moved, false)

var noMoveBoard = full([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])
var n4 = g.move(st(noMoveBoard.slice()), 'left', [1, 1])
h.eq('满盘无可动 → moved=false 且不生成', [n4.moved, n4.spawned], [false, null])
h.eq('满盘无可动 → state.over=true', n4.state.over, true)

// ── 生成块的值 ──────────────────────────────────────────────────────
h.suite('g2048/生成块的值')
var v1 = g.move(st(full([2, 2, 2, 2])), 'left', [0, 0])
h.eq('数值比例 <0.9 生成 2', [v1.spawned, v1.state.board[2]], [2, 2])
h.eq('数值比例 0 落在第一个空位', v1.state.board[2], 2)

var v2 = g.move(st(full([2, 2, 2, 2])), 'left', [1, 1])
h.eq('数值比例 ≥0.9 生成 4', v2.spawned, 4)

h.ok('任意比例下生成块只可能是 2 或 4', (function () {
  for (var k = 0; k <= 9; k++) {
    for (var m = 0; m <= 9; m++) {
      var r = g.move(st(full([2, 2, 2, 2])), 'left', [k / 10, m / 10])
      if (r.spawned !== 2 && r.spawned !== 4) return false
    }
  }
  return true
})())

h.ok('每次变化只新增恰好 1 块（4 块 → 合并成 2 块 → +1 块 = 3 块）', (function () {
  var before = st(full([2, 2, 2, 2]))
  var cnt0 = before.board.filter(function (v) { return v > 0 }).length
  var r = g.move(before, 'left', [0, 0])
  var after = r.state.board.filter(function (v) { return v > 0 }).length
  return cnt0 === 4 && after === 3
})())

var v3 = g.move(st(full([2, 4, 8, 16])), 'left', [0, 0])
h.eq('未变化时 spawned 仍为 null', v3.spawned, null)

// ── 得分与累计 ──────────────────────────────────────────────────────
h.suite('g2048/得分与累计')
var sc1 = g.move(st(full([2, 2, 2, 2])), 'left', [1, 1])
h.eq('首次合并得分 8', sc1.state.score, 8)
var sc2 = g.move(sc1.state, 'left', [1, 1])
h.eq('第二次合并（4+4）得分 +8', sc2.gained, 8)
h.eq('累计分数 16', sc2.state.score, 16)
h.eq('best 随分数抬升', sc2.state.best, 16)
h.ok('gained 等于 merged 之和', (function () {
  var r = g.move(st(full([4, 4, 8, 8])), 'left', [1, 1])
  var sum = 0
  for (var i = 0; i < r.merged.length; i++) sum += r.merged[i]
  return sum === r.gained && r.gained === 24
})())

// best 不回退：分数小于历史 best 时保留
var bestKeep = st(full([2, 2, 2, 2]))
bestKeep.best = 999
var sc3 = g.move(bestKeep, 'left', [1, 1])
h.eq('best 取历史最大值（不回退）', sc3.state.best, 999)

// ── maxTile ─────────────────────────────────────────────────────────
h.suite('g2048/maxTile')
h.eq('取棋盘最大值', g.maxTile(st(full([2, 4, 16, 8]))), 16)
h.eq('512 大于 256', g.maxTile(st(full([2, 512, 256, 4]))), 512)
h.eq('空盘最大值 0', g.maxTile(st(full([]))), 0)
h.eq('非法入参兜底 0', g.maxTile(null), 0)

// ── isOver / canMove ────────────────────────────────────────────────
h.suite('g2048/isOver')
h.eq('满盘交错无同值 → isOver=true', g.isOver(st(noMoveBoard.slice())), true)
h.eq('满盘交错无同值 → canMove=false', g.canMove(st(noMoveBoard.slice())), false)
h.eq('满盘但相邻有同值 → canMove=true', g.canMove(st(full([2, 2, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]))), true)
h.eq('存在空位 → canMove=true', g.canMove(st(full([2, 4, 8, 16]))), true)
h.eq('开局盘 a canMove=true', g.canMove(st(full([2, 2, 2, 2]))), true)
h.eq('空盘 canMove=true / isOver=false', [g.canMove(st(full([]))), g.isOver(st(full([])))], [true, false])
h.eq('非法入参 isOver 兜底 false', g.isOver(undefined), false)

// ── 达成 2048 ───────────────────────────────────────────────────────
h.suite('g2048/达成 2048')
var w1 = g.move(st(full([1024, 1024])), 'left', [1, 1])
h.eq('1024+1024 合并得分 2048', w1.gained, 2048)
h.eq('合成后最大块 2048', g.maxTile(w1.state), 2048)
h.eq('move 返回 won=true', w1.won, true)
h.eq('state.won=true', w1.state.won, true)
var w2 = g.move(w1.state, 'left', [1, 1])
h.eq('继续移动后 won 保持 true', [w2.won, w2.state.won], [true, true])
var w3 = g.move(st(full([512, 512])), 'left', [1, 1])
h.eq('未合成 2048 时 won=false', [w3.won, w3.state.won], [false, false])

// ── 随机注入与安全兜底 ──────────────────────────────────────────────
h.suite('g2048/注入与兜底')
var same1 = g.move(st(full([2, 2, 2, 2])), 'left', [0.7, 0.3])
var same2 = g.move(st(full([2, 2, 2, 2])), 'left', [0.7, 0.3])
h.eq('同样的 rand 得到相同棋盘', same1.state.board, same2.state.board)
h.eq('同样的 rand 得到相同生成块', same1.spawned, same2.spawned)

var bad = g.move(null, 'left')
h.eq('null 状态安全兜底：moved=false', bad.moved, false)
h.eq('null 状态 spawned=null / merged=[]', [bad.spawned, bad.merged], [null, []])
h.eq('null 状态棋盘 16 格全 0', bad.state.board.filter(function (v) { return v > 0 }).length, 0)

var badDir = g.move(st(full([2, 2, 2, 2])), 'diagonal', [1, 1])
h.eq('非法方向 moved=false', badDir.moved, false)
h.eq('非法方向不生成、不分', [badDir.spawned, badDir.gained], [null, 0])

var live = g.move(st(full([2, 2, 2, 2])), 'left')
h.eq('缺省 rand 也能正常出块（棋盘 16 格）', live.state.board.length, 16)
h.ok('缺省 rand 生成块仍是 2 或 4', live.spawned === 2 || live.spawned === 4)

// ── 3×3 档位（本轮新增：简单档） ─────────────────────────────────────
h.suite('g2048/3×3 档位')
var g3 = g2048.create(3)
h.eq('SIZE=3 / CELLS=9 / 达成线 256', [g3.SIZE, g3.CELLS, g3.WIN_TILE], [3, 9, 256])
h.eq('4×4 达成线仍是 2048', [g.SIZE, g.CELLS, g.WIN_TILE], [4, 16, 2048])

// 测试辅助：把长度不足 9 的数组补零成合法 3×3 棋盘
function f3(arr) {
  var b = []
  for (var i = 0; i < 9; i++) b.push(arr[i] === undefined ? 0 : arr[i])
  return b
}
var s3 = g3.newGame([0, 0])
h.eq('3×3 开局 9 格、恰好 2 块', [s3.board.length, s3.board.filter(function (v) { return v > 0 }).length], [9, 2])
h.eq('3×3 开局块落在 0/1 号格且值为 2', [s3.board[0], s3.board[1]], [2, 2])

// 行内合并：3×3 每行只有 3 格，[2,2,2] 左移是 [4,2,0]（压紧后相邻同值才合并）
var r3 = g3.move(st(f3([2, 2, 2, 2, 0, 0, 0, 0, 0])), 'left', [1, 1])
h.eq('3×3 左移：首行 [2,2,2] → [4,2,0]', r3.state.board.slice(0, 3), [4, 2, 0])
h.eq('3×3 第二行 [2,0,0] → [2,0,0]', r3.state.board[3], 2)
h.eq('3×3 得分 4', r3.gained, 4)
h.eq('3×3 空位生成块钉在最后一格 8 且为 4', [r3.spawned, r3.state.board[8]], [4, 4])

var c3 = g3.move(st(f3([2, 0, 0, 2, 0, 0, 2, 0, 0])), 'up', [1, 1])
h.eq('3×3 上移首列 [2,2,2] → [4,2,0]', [c3.state.board[0], c3.state.board[3], c3.state.board[6]], [4, 2, 0])
h.eq('3×3 上移得分 4', c3.gained, 4)

// 达成线按档位：3×3 是 256，4×4 是 2048
var w3a = g3.move(st(f3([64, 64])), 'left', [1, 1])
h.eq('3×3 合成 128（未到 256）→ won=false', [g3.maxTile(w3a.state), w3a.won], [128, false])
var w3b = g3.move(st(f3([128, 128])), 'left', [1, 1])
h.eq('3×3 合成 256 → won=true', [g3.maxTile(w3b.state), w3b.won, w3b.state.won], [256, true, true])
h.eq('3×3 合成 256 得分', w3b.gained, 256)

// 3×3 终局：满盘且四邻无同值
h.eq('3×3 满盘无同值 → isOver=true', g3.isOver(st(f3([2, 4, 2, 4, 2, 4, 2, 4, 2]))), true)
h.eq('3×3 满盘但有同值 → canMove=true', g3.canMove(st(f3([2, 2, 4, 4, 8, 8, 16, 32, 64]))), true)
h.eq('3×3 有空位 → canMove=true', g3.canMove(st(f3([2, 4, 8]))), true)

// 3×3 纯函数：不改动传入 state
var keep3 = st(f3([2, 2, 0, 0, 0, 0, 0, 0, 0]))
g3.move(keep3, 'left', [1, 1])
h.eq('3×3 move 不改动传入 state', keep3.board, f3([2, 2, 0, 0, 0, 0, 0, 0, 0]))

// 3×3 非法入参兜底
var bad3 = g3.move(null, 'left')
h.eq('3×3 null 状态：moved=false 且 9 格全 0', [bad3.moved, bad3.state.board.length,
  bad3.state.board.filter(function (v) { return v > 0 }).length], [false, 9, 0])
h.eq('3×3 合法方向集合外（diagonal）→ moved=false', g3.move(st(f3([2, 2, 2])), 'diagonal', [1, 1]).moved, false)

// 档位兜底：非 3 的数字一律按 4×4
h.eq('create(5) 兜底 4×4', [g2048.create(5).SIZE, g2048.create(5).CELLS], [4, 16])
h.eq('create(2.5) 兜底 4×4', g2048.create(2.5).SIZE, 4)
h.eq('create() 默认 4×4', g2048.create().SIZE, 4)
h.eq('create([0,0]) 仍按 4×4 且随机源生效', (function () {
  var gg = g2048.create([0, 0])
  var ss = gg.newGame()
  return [gg.SIZE, ss.board[0], ss.board[1]]
})(), [4, 2, 2])

process.exit(h.summary())
