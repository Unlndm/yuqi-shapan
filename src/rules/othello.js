/**
 * rules/othello.js — 黑白棋规则（棋盘大小可配置，偶数路，黑先行）。
 * create(cols, rows) 返回规则实例；纯函数。
 * 轮空（一方无合法走法但对方有）由对局页 doMove 流程处理；
 * 双方都无走法 → check 判终局按子数定胜负。
 */

function create(cols, rows) {
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

  // 输出：初始棋盘，中央四子交错（左上/右下黑，右上/左下白）。
  function init() {
    var b = []
    for (var j = 0; j < rows; j++) {
      var row = []
      for (var i = 0; i < cols; i++) row.push(0)
      b.push(row)
    }
    var c = cols >> 1
    var r = rows >> 1
    b[r - 1][c - 1] = 1
    b[r][c] = 1
    b[r - 1][c] = 2
    b[r][c - 1] = 2
    return b
  }

  // 内部：某方向会被翻转的对方棋子列表；不合法返回 null。
  function flipLine(board, i, j, di, dj, turn) {
    var opp = 3 - turn
    var flanked = []
    var x = i + di
    var y = j + dj
    while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === opp) {
      flanked.push([x, y])
      x += di
      y += dj
    }
    if (flanked.length === 0) return null
    if (x < 0 || x >= cols || y < 0 || y >= rows || board[y][x] !== turn) return null
    return flanked
  }

  // 输入：board、move、turn（不落子，只统计）；输出：可翻转数（0=不合法）。
  function captures(board, move, turn) {
    var n = 0
    for (var k = 0; k < 8; k++) {
      var f = flipLine(board, move.i, move.j, DIRS[k][0], DIRS[k][1], turn)
      if (f) n += f.length
    }
    return n
  }

  // 输入：board、turn；输出：全部合法走法。
  function moves(board, turn) {
    var out = []
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] !== 0) continue
        if (captures(board, { i: i, j: j }, turn) > 0) out.push({ i: i, j: j })
      }
    }
    return out
  }

  // 内部：静态位置权重，用于候选排序（角最优先，X 位最靠后）。
  function posWeight(i, j) {
    var corner = (i === 0 || i === cols - 1) && (j === 0 || j === rows - 1)
    if (corner) return 3
    var xSquare = (i === 1 || i === cols - 2) && (j === 1 || j === rows - 2)
    if (xSquare) return 0
    var edge = i === 0 || i === cols - 1 || j === 0 || j === rows - 1
    return edge ? 2 : 1
  }

  // 输入：board、turn；输出：合法走法按位置权重降序（利于 α-β 剪枝）。
  function candidates(board, turn) {
    var ms = moves(board, turn)
    ms.sort(function (a, b) {
      return posWeight(b.i, b.j) - posWeight(a.i, a.j)
    })
    return ms
  }

  // 输入：board、move、turn；输出：落子+翻转后的新棋盘。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    b[move.j][move.i] = turn
    for (var k = 0; k < 8; k++) {
      var f = flipLine(b, move.i, move.j, DIRS[k][0], DIRS[k][1], turn)
      if (!f) continue
      for (var n = 0; n < f.length; n++) {
        b[f[n][1]][f[n][0]] = turn
      }
    }
    return b
  }

  // 输入：board、lastMove（不依赖）；输出：终局判定或 null。
  function check(board, lastMove) {
    var c1 = 0
    var c2 = 0
    var empties = 0
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var v = board[j][i]
        if (v === 1) c1++
        else if (v === 2) c2++
        else empties++
      }
    }
    // 终局原因（2026-10-23）：结果胶囊/结束弹窗要说明「为什么结束」，
    // 否则玩家只看到棋子数，不知道是盘满、一方被吃光，还是双方都无子可走。
    var why = empties === 0 ? '盘满' : (c1 === 0 || c2 === 0 ? '一方无子' : '')
    var terminal = empties === 0 || c1 === 0 || c2 === 0
    if (!terminal) {
      var m1 = moves(board, 1).length
      var m2 = moves(board, 2).length
      terminal = m1 === 0 && m2 === 0
      if (terminal) why = '双方无子可走'
    }
    if (!terminal) return null
    var detail = ' · 黑' + c1 + ' : 白' + c2
    if (c1 === c2) return { result: 'draw', black: c1, white: c2, reason: why + detail }
    return { result: 'win', winner: c1 > c2 ? 1 : 2, black: c1, white: c2, reason: why + detail }
  }

  // 内部：单方静态分（只计己方项，evaluate 再作差）。
  // 子数（残局权重放大）+ 角/边稳定子 + X/C 位惩罚 + 机动性（行动力是黑白棋核心）。
  function sideScore(board, color, discs, mobility, empties) {
    var s = discs * (empties <= 10 ? 8 : (empties <= 20 ? 3 : 1))
    s += mobility * 4
    var corners = [[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]]
    for (var k = 0; k < 4; k++) {
      var ci = corners[k][0]
      var cj = corners[k][1]
      var cv = board[cj][ci]
      var empty = cv === 0
      if (cv === color) {
        s += 80 // 角
        // 从角沿两条边统计连续己方子（稳定子雏形）
        var dx = ci === 0 ? 1 : -1
        var dy = cj === 0 ? 1 : -1
        for (var x = ci + dx; x >= 0 && x < cols; x += dx) {
          if (board[cj][x] !== color) break
          s += 6
        }
        for (var y = cj + dy; y >= 0 && y < rows; y += dy) {
          if (board[y][ci] !== color) break
          s += 6
        }
      }
      var xi = ci === 0 ? 1 : cols - 2
      var yj = cj === 0 ? 1 : rows - 2
      var xv = board[yj][xi]
      if (empty && xv === color) s -= 30 // X 位（角未定时是坏棋）
      var cxi = ci === 0 ? 1 : cols - 2
      var cyj = cj
      var c2 = board[cyj][cxi]
      if (empty && c2 === color) s -= 12 // C 位
      var c3x = ci
      var c3y = cj === 0 ? 1 : rows - 2
      if (empty && board[c3y][c3x] === color) s -= 12
    }
    return s
  }

  // 输入：board、turn；输出：turn 视角评估（含残局奇偶节奏奖励）。
  function evaluate(board, turn) {
    var c1 = 0
    var c2 = 0
    var empties = 0
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var v = board[j][i]
        if (v === 1) c1++
        else if (v === 2) c2++
        else empties++
      }
    }
    var m1 = moves(board, 1).length
    var m2 = moves(board, 2).length
    var s = sideScore(board, 1, c1, m1, empties) - sideScore(board, 2, c2, m2, empties)
    // 奇偶：残局里「剩奇数格」的一方拿到最后一手，通常更有利
    if (empties > 0 && empties <= 12) s += empties % 2 === 1 ? 8 : -8
    return s
  }

  return {
    COLS: cols,
    ROWS: rows,
    STARS: [],
    MATCH_BY_COLUMN: false,
    // 6/8 路分支适中：normal 4 / hard 7，预算与迭代加深兜底
    DEPTH: { easy: 1, normal: 4, hard: 7 },
    init: init,
    moves: moves,
    candidates: candidates,
    apply: apply,
    check: check,
    evaluate: evaluate,
    captures: captures
  }
}

module.exports = { create: create }
