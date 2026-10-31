/**
 * rules/tictactoe.js — 井字棋规则（固定 3×3，三连线；不支持改棋盘大小）。
 * create() 兼容统一工厂签名，忽略传入尺寸；纯函数。
 */

function create() {
  var COLS = 3
  var ROWS = 3
  var WIN_LEN = 3
  // 中心 3 分、角 2 分、边 1 分的站位权重
  var POS_W = [[2, 1, 2], [1, 3, 1], [2, 1, 2]]

  // 输出：全空 3×3 棋盘。
  function init() {
    var b = []
    for (var j = 0; j < ROWS; j++) {
      var row = []
      for (var i = 0; i < COLS; i++) row.push(0)
      b.push(row)
    }
    return b
  }

  // 输入：board；输出：全部空位。
  function moves(board) {
    var out = []
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        if (board[j][i] === 0) out.push({ i: i, j: j })
      }
    }
    return out
  }

  // 输入：board；输出：候选 = 全部合法走法按站位权重降序（中心/角先搜，剪枝更快）。
  function candidates(board) {
    var ms = moves(board)
    ms.sort(function (a, b) {
      return POS_W[b.j][b.i] - POS_W[a.j][a.i]
    })
    return ms
  }

  // 输入：board、move、turn；输出：新棋盘。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    b[move.j][move.i] = turn
    return b
  }

  // 输入：board、lastMove；输出：胜负/和棋/null。
  function check(board, lastMove) {
    if (!lastMove) return null
    var i = lastMove.i
    var j = lastMove.j
    var v = board[j][i]
    if (v === 0) return null
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    for (var k = 0; k < 4; k++) {
      var n = 1
      var x = i + dirs[k][0]
      var y = j + dirs[k][1]
      while (x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y][x] === v) { n++; x += dirs[k][0]; y += dirs[k][1] }
      x = i - dirs[k][0]
      y = j - dirs[k][1]
      while (x >= 0 && x < COLS && y >= 0 && y < ROWS && board[y][x] === v) { n++; x -= dirs[k][0]; y -= dirs[k][1] }
      if (n >= WIN_LEN) return { result: 'win', winner: v }
    }
    var full = true
    for (var yy = 0; yy < ROWS && full; yy++) {
      for (var xx = 0; xx < COLS; xx++) {
        if (board[yy][xx] === 0) { full = false; break }
      }
    }
    return full ? { result: 'draw' } : null
  }

  // 输入：board、turn；输出：turn 视角评估。
  function evaluate(board, turn) {
    var s = 0
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0) continue
        var w = POS_W[j][i]
        s += v === turn ? w : -w
      }
    }
    return s
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    STARS: [],
    MATCH_BY_COLUMN: false,
    // 分支极少（9!），三档难度都全解，hard 级达到完美博弈
    DEPTH: { easy: 9, normal: 9, hard: 9 },
    init: init,
    moves: moves,
    candidates: candidates,
    apply: apply,
    check: check,
    evaluate: evaluate,
    captures: null
  }
}

module.exports = { create: create }
