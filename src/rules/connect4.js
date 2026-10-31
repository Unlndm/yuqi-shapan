/**
 * rules/connect4.js — 四子棋规则（列数×行数可配置，重力落子，四连线）。
 * create(cols, rows) 返回规则实例；纯函数。
 * MATCH_BY_COLUMN=true：命中判定按列匹配（点该列任意位置都落在沉底格）。
 */

function create(cols, rows) {
  var WIN_LEN = 4

  // 输出：全空棋盘。
  function init() {
    var b = []
    for (var j = 0; j < rows; j++) {
      var row = []
      for (var i = 0; i < cols; i++) row.push(0)
      b.push(row)
    }
    return b
  }

  // 输入：board；输出：每列沉底落点 [{i,j}]（列满则不给出）。
  function moves(board) {
    var out = []
    for (var i = 0; i < cols; i++) {
      if (board[0][i] !== 0) continue
      for (var j = rows - 1; j >= 0; j--) {
        if (board[j][i] === 0) {
          out.push({ i: i, j: j })
          break
        }
      }
    }
    return out
  }

  // 内部：在 (i,j) 落 color 子是否立刻四连（不复制棋盘，四方向数连子）。
  function winsAt(board, i, j, color) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    for (var k = 0; k < 4; k++) {
      var d = dirs[k]
      var n = 1
      var x = i + d[0]
      var y = j + d[1]
      while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === color) { n++; x += d[0]; y += d[1] }
      x = i - d[0]
      y = j - d[1]
      while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === color) { n++; x -= d[0]; y -= d[1] }
      if (n >= WIN_LEN) return true
    }
    return false
  }

  // 输入：board（可选 turn）；输出：合法走法。
  // 排序（2026-10-23 起）：① 己方能立刻四连 → ② 对方能立刻四连（必堵）→ ③ 离中列近。
  // turn 缺省（旧调用）时退化为纯中列优先。
  function candidates(board, turn) {
    var ms = moves(board)
    var mid = (cols - 1) / 2
    var me = turn || 0
    var opp = me ? 3 - me : 0
    ms.sort(function (a, b) {
      if (me) {
        var sa = 0
        var sb = 0
        if (winsAt(board, a.i, a.j, me)) sa += 100000
        if (winsAt(board, a.i, a.j, opp)) sa += 50000
        if (winsAt(board, b.i, b.j, me)) sb += 100000
        if (winsAt(board, b.i, b.j, opp)) sb += 50000
        if (sa !== sb) return sb - sa
      }
      return Math.abs(a.i - mid) - Math.abs(b.i - mid)
    })
    return ms
  }

  // 输入：board、move（沉底落点 {i,j}）、turn；输出：新棋盘。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    b[move.j][move.i] = turn
    return b
  }

  // 输入：board、lastMove；输出：四连胜 / 满盘和棋 / null。
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
      while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === v) { n++; x += dirs[k][0]; y += dirs[k][1] }
      x = i - dirs[k][0]
      y = j - dirs[k][1]
      while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === v) { n++; x -= dirs[k][0]; y -= dirs[k][1] }
      if (n >= WIN_LEN) return { result: 'win', winner: v }
    }
    var full = true
    for (var yy = 0; yy < rows && full; yy++) {
      for (var xx = 0; xx < cols; xx++) {
        if (board[yy][xx] === 0) { full = false; break }
      }
    }
    return full ? { result: 'draw' } : null
  }

  // 内部：4 格窗口查表打分（1/2 子窗口只作形状分，3 子窗口另由成五点判断）。
  var SCORE = [0, 1, 10, 90, 0]

  // 输入：board、turn；输出：turn 方所有「落子即四连」的沉底格（用于必堵/双威胁）。
  // 只有 7 列，直接对每列沉底格做一次 winsAt，代价极低。
  function winPoints(board, turn) {
    var out = []
    var ms = moves(board)
    for (var k = 0; k < ms.length; k++) {
      if (winsAt(board, ms[k].i, ms[k].j, turn)) out.push(ms[k])
    }
    return out
  }

  // 内部：某格现在是否可落子（该列下方的格子必须全满）。
  function playableAt(board, i, j) {
    if (board[j][i] !== 0) return false
    for (var y = j + 1; y < rows; y++) if (board[y][i] === 0) return false
    return true
  }

  // 内部：单方静态分。
  // 形状分（窗口 1/2/3 子）+ 中心控制 + 立即威胁（成五点数量、双威胁、奇偶行）。
  // 成五点用 winPoints 精确计数（去重），避免窗口重复计数误判「双威胁」。
  function sideScore(board, color) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    var s = 0
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        for (var k = 0; k < 4; k++) {
          var ei = i + dirs[k][0] * (WIN_LEN - 1)
          var ej = j + dirs[k][1] * (WIN_LEN - 1)
          if (ei < 0 || ei >= cols || ej < 0 || ej >= rows) continue
          var c1 = 0
          var c2 = 0
          for (var n = 0; n < WIN_LEN; n++) {
            var v = board[j + dirs[k][1] * n][i + dirs[k][0] * n]
            if (v === color) c1++
            else if (v !== 0) c2++
          }
          if (c1 > 0 && c2 > 0) continue
          if (c1 > 0) {
            s += SCORE[c1]
            if (c1 === 3) {
              // 三子窗口的空位若可落，就是一个真实成四点；奇偶行另给轻奖励
              for (var t = 0; t < WIN_LEN; t++) {
                var xi = i + dirs[k][0] * t
                var yj = j + dirs[k][1] * t
                if (board[yj][xi] !== 0 || !playableAt(board, xi, yj)) continue
                s += 120
                var fromBottom = rows - 1 - yj
                var goodParity = color === 1 ? (fromBottom % 2 === 1) : (fromBottom % 2 === 0)
                if (goodParity) s += 40
                break
              }
            }
          }
        }
      }
    }
    // 中心控制：越靠中列，每子权重越高
    var mid = (cols - 1) / 2
    for (var y2 = 0; y2 < rows; y2++) {
      for (var x2 = 0; x2 < cols; x2++) {
        if (board[y2][x2] !== color) continue
        s += (mid - Math.abs(x2 - mid) + 1) * 2
      }
    }
    // 立即威胁：双威胁直接加大量分（对手只能堵一路）
    var wp = winPoints(board, color)
    s += wp.length * 260
    if (wp.length >= 2) s += 15000
    for (var w = 0; w < wp.length; w++) {
      var fb = rows - 1 - wp[w].j
      if (color === 1 ? (fb % 2 === 1) : (fb % 2 === 0)) s += 60
    }
    return s
  }

  // 输入：board、turn；输出：turn 视角评估（严格反对称）。
  function evaluate(board, turn) {
    return sideScore(board, turn) - sideScore(board, 3 - turn)
  }

  return {
    COLS: cols,
    ROWS: rows,
    STARS: [],
    MATCH_BY_COLUMN: true,
    // 分支只有 7 列：normal 5 / hard 8，预算与迭代加深兜底
    DEPTH: { easy: 1, normal: 5, hard: 8 },
    init: init,
    moves: moves,
    candidates: candidates,
    apply: apply,
    check: check,
    evaluate: evaluate,
    winPoints: winPoints,
    captures: null
  }
}

module.exports = { create: create }
