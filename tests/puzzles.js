/**
 * tests/puzzles.js — 残局题库测试（象棋 / 五子棋 / 围棋各 10 题，共 30 题）。
 * 覆盖：题库结构、id 唯一、初始局面合法、解序列逐手合法、
 *   按解序列走完达成目标（将死 / 五连 / 提子）、步数不超上限、提示按 ply 可取。
 * 运行：node tests/puzzles.js
 */

var idx = require('../src/puzzles/index.js')
var chessF = require('../src/rules/chess.js')
var gomokuF = require('../src/rules/gomoku.js')
var goF = require('../src/rules/go.js')
var h = require('./helper.js')

var ALL = []
for (var g = 0; g < idx.PUZZLE_GAMES.length; g++) {
  var list = idx.getPuzzles(idx.PUZZLE_GAMES[g].id)
  for (var k = 0; k < list.length; k++) ALL.push(list[k])
}

// 输入：题目；输出：解序列中「解题方」的手数。
function ownMoves(p) {
  var n = 0
  for (var k = 0; k < p.solution.length; k++) {
    if (p.solution[k].turn === p.turn) n++
  }
  return n
}

// 输入：题目；输出：解序列是否从解题方起、逐手交替、movs 字段齐全。
function pliesOk(p) {
  if (!p.solution.length) return false
  for (var k = 0; k < p.solution.length; k++) {
    var want = k % 2 === 0 ? p.turn : 3 - p.turn
    if (p.solution[k].turn !== want) return false
    var m = p.solution[k].move
    if (!m || typeof m.i !== 'number' || typeof m.j !== 'number') return false
  }
  return p.solution[p.solution.length - 1].turn === p.turn
}

// 输入：走法列表与题库走法；输出：规则层对应走法或 null。
function findMove(ms, mv) {
  for (var k = 0; k < ms.length; k++) {
    if (ms[k].i === mv.i && ms[k].j === mv.j) {
      if (typeof mv.fi === 'number' && (ms[k].fi !== mv.fi || ms[k].fj !== mv.fj)) continue
      return ms[k]
    }
  }
  return null
}

// ─────────────────────── 题库结构 ───────────────────────
h.suite('puzzles/题库结构')
h.eq('棋种 3 个', idx.PUZZLE_GAMES.length, 3)
h.eq('总题数 30', ALL.length, 30)
h.eq('象棋 10 题', idx.getPuzzles('chess').length, 10)
h.eq('五子棋 10 题', idx.getPuzzles('gomoku').length, 10)
h.eq('围棋 10 题', idx.getPuzzles('go').length, 10)
h.eq('未知棋种返回空数组', idx.getPuzzles('xiangqi').length, 0)
h.eq('未知题目返回 null', idx.getPuzzle('nope-01'), null)
h.eq('按 id 取题与题库对象一致', idx.getPuzzle('go-10'), idx.getPuzzles('go')[9])

var ids = {}
var idOk = true
var fieldOk = true
var goalMap = { chess: 'mate', gomoku: 'win', go: 'capture' }
for (var a = 0; a < ALL.length; a++) {
  var p = ALL[a]
  if (typeof p.id !== 'string' || !p.id || ids[p.id]) idOk = false
  ids[p.id] = true
  if (p.game !== idx.PUZZLE_GAMES[0].id && p.game !== idx.PUZZLE_GAMES[1].id && p.game !== idx.PUZZLE_GAMES[2].id) fieldOk = false
  if (!p.name || typeof p.name !== 'string') fieldOk = false
  if (p.difficulty !== 'easy' && p.difficulty !== 'normal' && p.difficulty !== 'hard') fieldOk = false
  if (p.goal !== goalMap[p.game]) fieldOk = false
  if (typeof p.moveLimit !== 'number' || p.moveLimit < 1 || p.moveLimit !== Math.floor(p.moveLimit)) fieldOk = false
  if (p.turn !== 1 && p.turn !== 2) fieldOk = false
  if (!p.solution.length) fieldOk = false
}
h.ok('id 全唯一', idOk)
h.ok('字段（game/name/difficulty/goal/moveLimit/turn/solution）齐全且取值合法', fieldOk)

h.suite('puzzles/提示结构')
var hintOk = true
var limitOk = true
for (var b2 = 0; b2 < ALL.length; b2++) {
  var q = ALL[b2]
  if (!pliesOk(q)) hintOk = false
  if (q.solution.length !== ownMoves(q) * 2 - 1) hintOk = false // 无空手，最后一手为解题方
  if (ownMoves(q) > q.moveLimit) limitOk = false
}
h.ok('解序列从解题方起逐手交替、可按 ply 直接取作提示', hintOk)
h.ok('每題解题方手数不超过 moveLimit', limitOk)

// ─────────────────────── 国际象棋 ───────────────────────
h.suite('puzzles/chess')
var CH = chessF.create()
for (var c = 0; c < idx.getPuzzles('chess').length; c++) {
  var cp = idx.getPuzzles('chess')[c]
  h.eq(cp.id + ' 棋盘 9 行', cp.board.length, 9)
  h.eq(cp.id + ' 棋盘 8 列', cp.board[0].length, 8)
  h.eq(cp.id + ' 元数据行 8 项', cp.board[8].length, 8)
  var wk = 0
  var bk = 0
  var pawnBad = false
  var wki = -1
  var wkj = -1
  var bki = -1
  var bkj = -1
  for (var j = 0; j < 8; j++) {
    for (var i = 0; i < 8; i++) {
      var v = cp.board[j][i]
      if (v === 6) { wk++; wki = i; wkj = j }
      if (v === 12) { bk++; bki = i; bkj = j }
      if ((v === 1 || v === 7) && (j === 0 || j === 7)) pawnBad = true
    }
  }
  h.eq(cp.id + ' 白王 1 个', wk, 1)
  h.eq(cp.id + ' 黑王 1 个', bk, 1)
  h.ok(cp.id + ' 底线无未升变兵', !pawnBad)
  h.ok(cp.id + ' 双王不相邻', Math.abs(wki - bki) > 1 || Math.abs(wkj - bkj) > 1)
  h.ok(cp.id + ' 轮白行棋时黑方未被将军（局面合法）', !CH.inCheck(cp.board, 2))

  var cb = cp.board.map(function (row) { return row.slice() })
  var clast = null
  var legal = true
  for (var k2 = 0; k2 < cp.solution.length; k2++) {
    var ply = cp.solution[k2]
    var ms = CH.moves(cb, ply.turn)
    var found = findMove(ms, ply.move)
    if (!found) { legal = false; h.ok(cp.id + ' 第 ' + (k2 + 1) + ' 手在合法走法中', false); break }
    cb = CH.apply(cb, ply.move, ply.turn)
    clast = ply.move
  }
  h.ok(cp.id + ' 解序列每手合法', legal)
  if (legal) {
    var res = CH.check(cb, clast)
    h.ok(cp.id + ' 走完达成将死', !!res && res.result === 'win' && res.winner === cp.turn && res.reason === '将死')
  }
}

// ─────────────────────── 五子棋 ───────────────────────
h.suite('puzzles/gomoku')

// 输入：棋盘、颜色；输出：是否已有五连。
function hasFive(board, color) {
  var rowsN = board.length
  var colsN = board[0].length
  var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (var j = 0; j < rowsN; j++) {
    for (var i = 0; i < colsN; i++) {
      if (board[j][i] !== color) continue
      for (var d = 0; d < 4; d++) {
        var n = 1
        var x = i + dirs[d][0]
        var y = j + dirs[d][1]
        while (x >= 0 && x < colsN && y >= 0 && y < rowsN && board[y][x] === color) { n++; x += dirs[d][0]; y += dirs[d][1] }
        if (n >= 5) return true
      }
    }
  }
  return false
}

for (var m = 0; m < idx.getPuzzles('gomoku').length; m++) {
  var gp = idx.getPuzzles('gomoku')[m]
  var gcols = gp.board[0].length
  var grows = gp.board.length
  h.ok(gp.id + ' 棋盘为 7/9 方阵', gcols === grows && (gcols === 7 || gcols === 9))
  var nb = 0
  var nw = 0
  for (var gj = 0; gj < grows; gj++) {
    for (var gi = 0; gi < gcols; gi++) {
      if (gp.board[gj][gi] === 1) nb++
      else if (gp.board[gj][gi] === 2) nw++
    }
  }
  h.eq(gp.id + ' 黑先（黑白手数相等）', nb, nw)
  h.ok(gp.id + ' 初始双方均无五连', !hasFive(gp.board, 1) && !hasFive(gp.board, 2))
  h.eq(gp.id + ' 解题方为黑', gp.turn, 1)

  var GE = gomokuF.create(gcols, grows)
  var gb = gp.board.map(function (row) { return row.slice() })
  var glast = null
  var glegal = true
  for (var gk = 0; gk < gp.solution.length; gk++) {
    var gply = gp.solution[gk]
    var gms = GE.moves(gb)
    var gfound = findMove(gms, gply.move)
    if (!gfound) { glegal = false; h.ok(gp.id + ' 第 ' + (gk + 1) + ' 手在合法走法中', false); break }
    gb = GE.apply(gb, gply.move, gply.turn)
    glast = gply.move
  }
  h.ok(gp.id + ' 解序列每手合法', glegal)
  if (glegal) {
    var gres = GE.check(gb, glast)
    h.ok(gp.id + ' 走完达成五连', !!gres && gres.result === 'win' && gres.winner === gp.turn)
  }
}

// ─────────────────────── 围棋 ───────────────────────
h.suite('puzzles/go')

// 输入：棋盘、(i,j)；输出：同色连通块 {stones:[[i,j]], libs:[[i,j]]}。
function goGroupAt(board, i, j) {
  var colsN = board[0].length
  var rowsN = board.length
  var v = board[j][i]
  var seen = {}
  var stones = []
  var libs = {}
  var stack = [[i, j]]
  seen[j * colsN + i] = true
  while (stack.length) {
    var cur = stack.pop()
    stones.push(cur)
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (var d = 0; d < 4; d++) {
      var x = cur[0] + dirs[d][0]
      var y = cur[1] + dirs[d][1]
      if (x < 0 || x >= colsN || y < 0 || y >= rowsN) continue
      var nv = board[y][x]
      if (nv === 0) libs[y * colsN + x] = [x, y]
      else if (nv === v && !seen[y * colsN + x]) {
        seen[y * colsN + x] = true
        stack.push([x, y])
      }
    }
  }
  var ll = []
  for (var kk in libs) ll.push(libs[kk])
  return { stones: stones, libs: ll }
}

// 输入：坐标列表；输出：排序后的唯一键串。
function coordKey(coords) {
  var out = []
  for (var k = 0; k < coords.length; k++) out.push(coords[k][1] * 16 + coords[k][0])
  out.sort(function (x, y) { return x - y })
  return out.join(',')
}

for (var t = 0; t < idx.getPuzzles('go').length; t++) {
  var op = idx.getPuzzles('go')[t]
  var ocols = op.board[0].length
  var orows = op.board.length
  h.ok(op.id + ' 棋盘为 7/9 方阵', ocols === orows && (ocols === 7 || ocols === 9))
  h.ok(op.id + ' target 非空', op.target.length > 0)
  var allWhite = true
  for (var tk = 0; tk < op.target.length; tk++) {
    if (op.board[op.target[tk][1]][op.target[tk][0]] !== 2) allWhite = false
  }
  h.ok(op.id + ' target 全是白子', allWhite)
  var grp = goGroupAt(op.board, op.target[0][0], op.target[0][1])
  h.eq(op.id + ' target 恰为完整白棋块', coordKey(grp.stones), coordKey(op.target))
  h.ok(op.id + ' 目标块有气', grp.libs.length > 0)

  var GOE = goF.create(ocols, orows)
  // 初始局面合法：每个块都有气
  var visited = {}
  var dead = false
  for (var oj = 0; oj < orows; oj++) {
    for (var oi = 0; oi < ocols; oi++) {
      if (op.board[oj][oi] === 0 || visited[oj * ocols + oi]) continue
      var og = goGroupAt(op.board, oi, oj)
      for (var os = 0; os < og.stones.length; os++) visited[og.stones[os][1] * ocols + og.stones[os][0]] = true
      if (og.libs.length === 0) dead = true
    }
  }
  h.ok(op.id + ' 初始无无气块（局面合法）', !dead)
  h.ok(op.id + ' 双方均有合法着手', GOE.moves(op.board, 1).length > 0 && GOE.moves(op.board, 2).length > 0)

  var ob = op.board.map(function (row) { return row.slice() })
  var olegal = true
  for (var ok2 = 0; ok2 < op.solution.length; ok2++) {
    var oply = op.solution[ok2]
    var oms = GOE.moves(ob, oply.turn)
    var ofound = findMove(oms, oply.move)
    if (!ofound) { olegal = false; h.ok(op.id + ' 第 ' + (ok2 + 1) + ' 手在合法走法中', false); break }
    ob = GOE.apply(ob, oply.move, oply.turn)
  }
  h.ok(op.id + ' 解序列每手合法', olegal)
  if (olegal) {
    var empty = true
    for (var t2 = 0; t2 < op.target.length; t2++) {
      if (ob[op.target[t2][1]][op.target[t2][0]] !== 0) empty = false
    }
    h.ok(op.id + ' 走完提掉目标白块', empty)
    h.eq(op.id + ' 末手为黑（提子手）', op.solution[op.solution.length - 1].turn, 1)
  }
}

process.exitCode = h.summary()
