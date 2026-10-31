/**
 * rules/gomoku.js — 五子棋规则（自由规则，五连胜，棋盘大小可配置）。
 * create(cols, rows) 返回规则实例；纯函数，不引用全局、不碰 UI、不读 storage。
 * 棋盘：board[j][i]（j 行 i 列），0 空 / 1 黑 / 2 白；坐标 (i,j) i 列 j 行。
 */

function create(cols, rows) {
  var WIN_LEN = 5

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

  // 星位：奇数路给天元；≥9 路再加四星，供渲染层叠加。
  function stars() {
    if (cols % 2 === 0 || rows % 2 === 0) return []
    var ci = (cols - 1) / 2
    var cj = (rows - 1) / 2
    var out = [[ci, cj]]
    if (cols >= 9 && rows >= 9) {
      out.push([2, 2], [cols - 3, 2], [2, rows - 3], [cols - 3, rows - 3])
    }
    return out
  }

  // 输入：board；输出：全部空位 [{i,j}]。
  function moves(board) {
    var out = []
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] === 0) out.push({ i: i, j: j })
      }
    }
    return out
  }

  // 内部：候选点周围 8 邻域内的棋子数，用作搜索排序权重（贴簇点先搜，剪枝更狠）。
  function adjCount(board, c) {
    var n = 0
    for (var dj = -1; dj <= 1; dj++) {
      for (var di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue
        var x = c.i + di
        var y = c.j + dj
        if (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] !== 0) n++
      }
    }
    return n
  }

  // 内部：在空点 (i,j) 落 color 子是否立刻成五（不复制棋盘，按四个方向数连子）。
  // 供候选排序用：让「我方能成五」与「对方能成五」的点排到最前，α-β 剪枝率显著提高。
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

  // 输入：board（可选 turn）；输出：已有棋子切比雪夫距离 1 内的空位。
  // 排序（2026-10-23 起）：① 己方能立刻成五 → ② 对方能立刻成五（必堵）→ ③ 邻子密度。
  // 前两条让搜索首先检查「胜负手」，同一预算下能多搜一层；turn 缺省时退化为纯邻子密度。
  function candidates(board, turn) {
    var seen = {}
    var out = []
    var any = false
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] === 0) continue
        any = true
        for (var dj = -1; dj <= 1; dj++) {
          for (var di = -1; di <= 1; di++) {
            var ni = i + di
            var nj = j + dj
            if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue
            if (board[nj][ni] !== 0) continue
            var key = nj * cols + ni
            if (!seen[key]) {
              seen[key] = true
              out.push({ i: ni, j: nj })
            }
          }
        }
      }
    }
    if (!any) {
      out.push({ i: (cols - 1) / 2, j: (rows - 1) / 2 })
      return out
    }
    var me = turn || 0
    var opp = me ? 3 - me : 0
    out.sort(function (a, b) {
      return threatScore(board, b, me, opp) - threatScore(board, a, me, opp)
    })
    return out
  }

  // 内部：候选点排序分（越大越先搜）。turn 缺省时只按邻子密度。
  function threatScore(board, c, me, opp) {
    var s = adjCount(board, c) * 4
    if (!me) return s
    if (winsAt(board, c.i, c.j, me)) s += 100000
    if (winsAt(board, c.i, c.j, opp)) s += 50000
    return s
  }

  // 输入：board、move {i,j}、turn；输出：落子后的新棋盘（原棋盘不变）。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    b[move.j][move.i] = turn
    return b
  }

  // 内部：从 (i,j) 沿方向数连子数（含自身）。
  function lineLen(board, i, j, di, dj) {
    var v = board[j][i]
    var n = 0
    var x = i
    var y = j
    while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === v) {
      n++
      x += di
      y += dj
    }
    return n
  }

  // 输入：board、lastMove {i,j}；输出：{result:'win',winner} | {result:'draw'} | null。
  function check(board, lastMove) {
    if (!lastMove) return null
    var i = lastMove.i
    var j = lastMove.j
    if (board[j][i] === 0) return null
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    for (var k = 0; k < 4; k++) {
      var d = dirs[k]
      var total = lineLen(board, i, j, d[0], d[1]) + lineLen(board, i, j, -d[0], -d[1]) - 1
      if (total >= WIN_LEN) return { result: 'win', winner: board[j][i] }
    }
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (board[y][x] === 0) return null
      }
    }
    return { result: 'draw' }
  }

  // 输入：board、turn；输出：turn 方全部「落子即成五」的空点。
  // 只扫已有棋子周围 8 邻域（成五点必定贴着某颗子），供搜索层做「必堵/双威胁」
  // 与叶子静态胜利检测；不做整盘 apply+check，代价比候选生成还低。
  function winPoints(board, turn) {
    var seen = {}
    var out = []
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] === 0) continue
        for (var dj = -1; dj <= 1; dj++) {
          for (var di = -1; di <= 1; di++) {
            var ni = i + di
            var nj = j + dj
            if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue
            if (board[nj][ni] !== 0) continue
            var key = nj * cols + ni
            if (seen[key]) continue
            seen[key] = true
            if (winsAt(board, ni, nj, turn)) out.push({ i: ni, j: nj })
          }
        }
      }
    }
    return out
  }

  // 内部：数「断四」——5 格窗口里 4 子 1 空且空位在中间（X_XXX / XX_XX / XXX_X）。
  // 连续四由下面的连子扫描单独计分，这里只补窗口计数容易漏掉的断四（它同样是
  // 一个真实成五点），避免「窗口看起来有优势、实际下一手没威胁」。
  function brokenFours(board, color) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    var n = 0
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        for (var k = 0; k < 4; k++) {
          var d = dirs[k]
          var ei = i + d[0] * (WIN_LEN - 1)
          var ej = j + d[1] * (WIN_LEN - 1)
          if (ei < 0 || ei >= cols || ej < 0 || ej >= rows) continue
          var c1 = 0
          var c2 = 0
          var emptyAt = -1
          for (var t = 0; t < WIN_LEN; t++) {
            var v = board[j + d[1] * t][i + d[0] * t]
            if (v === color) c1++
            else if (v !== 0) c2++
            else emptyAt = t
          }
          if (c1 === 4 && c2 === 0 && emptyAt > 0 && emptyAt < WIN_LEN - 1) n++
        }
      }
    }
    return n
  }

  // 内部：单方威胁分（开放/封闭四、活三/眠三、断四、双威胁、中心）。
  // 只按「连子 + 两端是否为空」分类，不把每个窗口都当同质计数：
  // 开放四（两端都空）= 下一手必胜；封闭四 = 一个成五点必须应；活三 = 需提前防。
  function sideScore(board, color) {
    var dirs = [[1, 0], [0, 1], [1, 1], [1, -1]]
    var s = 0
    var openFours = 0
    var fours = 0
    var openThrees = 0
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] !== color) continue
        for (var k = 0; k < 4; k++) {
          var d = dirs[k]
          var pi = i - d[0]
          var pj = j - d[1]
          if (pi >= 0 && pi < cols && pj >= 0 && pj < rows && board[pj][pi] === color) continue
          var n = 1
          var x = i + d[0]
          var y = j + d[1]
          while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === color) {
            n++
            x += d[0]
            y += d[1]
          }
          var openA = pi >= 0 && pi < cols && pj >= 0 && pj < rows && board[pj][pi] === 0
          var openB = x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] === 0
          if (n >= WIN_LEN) {
            s += 40000
          } else if (n === 4) {
            if (openA && openB) { s += 12000; openFours++ }
            else if (openA || openB) { s += 6000; fours++ }
          } else if (n === 3) {
            if (openA && openB) { s += 1500; openThrees++ }
            else if (openA || openB) s += 300
          } else if (n === 2) {
            if (openA && openB) s += 250
            else if (openA || openB) s += 60
          }
        }
      }
    }
    var broken = brokenFours(board, color)
    s += broken * 7000
    var fourTotal = openFours + fours + broken
    if (openFours >= 2) s += 20000          // 双开放四，对手挡不住
    else if (fourTotal >= 2) s += 12000     // 双四 / 四+断四
    if (openThrees >= 2) s += 3000          // 双活三
    if (fourTotal >= 1 && openThrees >= 1) s += 5000 // 四三组合
    // 中心/邻接：没有威胁时也要往中间下，避免边角乱铺
    var ci = (cols - 1) / 2
    var cj = (rows - 1) / 2
    var maxd = Math.max(ci, cj)
    for (var yy = 0; yy < rows; yy++) {
      for (var xx = 0; xx < cols; xx++) {
        if (board[yy][xx] !== color) continue
        var dd = Math.max(Math.abs(xx - ci), Math.abs(yy - cj))
        s += Math.max(0, maxd - dd) * 2
      }
    }
    return s
  }

  // 输入：board、turn；输出：turn 视角评估（严格反对称：e(1) = -e(2)）。
  function evaluate(board, turn) {
    return sideScore(board, turn) - sideScore(board, 3 - turn)
  }

  return {
    COLS: cols,
    ROWS: rows,
    STARS: stars(),
    MATCH_BY_COLUMN: false,
    // 候选已被威胁优先收缩；normal 4 / hard 7，由 600/1000ms 预算兜底。
    DEPTH: { easy: 1, normal: 4, hard: 7 },
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
