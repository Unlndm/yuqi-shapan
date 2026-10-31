/**
 * rules/draughts.js — 8×8 国际跳棋（English draughts / 英式跳棋）。
 * create() 兼容统一工厂签名；纯函数；board 共 9 行：
 *   0..7 棋盘；8 = 对局元数据行：[0] 无吃子半回合计数。
 * 棋子：白 1兵 2王；黑 3兵 4王（仅深色格 (i+j)%2===1 可落子）。
 * 行棋方向：白兵向上（j-1），黑兵向下（j+1）；白兵底线 j=0 升王，黑兵 j=7 升王。
 * 规则取舍（英式，非 10×10 国际跳棋）：
 *   ① 兵只向前走/吃；王可四方向各走一步、各吃一步（不飞格）。
 *   ② 强制吃子：任一方存在吃子着法时只能走吃子；连吃必须走完整条链。
 *   ③ 不要求选最长链（英式规则，选最长链是国际跳棋规则）。
 *   ④ 兵在连吃途中到达底线立即升王并结束该次连吃（英式规则）。
 *   ⑤ 被吃子在本着生成时即从虚拟盘移除（王不飞格，与「留盘阻挡」的差异可忽略；
 *      同时天然避免同一子被重复吃）。
 *   ⑥ 和棋：无吃子半回合计数 >= 100（即双方各 50 着 / 50 回合）判和。
 * 走法 {i,j,fi,fj}；连吃走法额外携带 captures:[{i,j},...]（完整吃子链，apply 依此提子）。
 * captures 导出为 null：本棋种的吃子信息在走法对象上，页面无需再调 rules.captures。
 */

function create() {
  var COLS = 8
  var ROWS = 8
  var META = 8 // 元数据行下标

  var WHITE_MAN = 1
  var WHITE_KING = 2
  var BLACK_MAN = 3
  var BLACK_KING = 4

  var DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

  // 输入：棋子码；输出：1 白 / 2 黑 / 0 空。
  function colorOf(v) {
    return v === 0 ? 0 : v <= 2 ? 1 : 2
  }

  // 输入：棋子码；输出：0 兵 / 1 王。
  function typeOf(v) {
    return v === 0 ? 0 : v <= 2 ? v - 1 : v - 3
  }

  function inB(i, j) {
    return i >= 0 && i < COLS && j >= 0 && j < ROWS
  }

  // 输入：行棋方；输出：升王底线行（白 0 / 黑 7）。
  function promoRow(turn) {
    return turn === 1 ? 0 : 7
  }

  // 输入：行棋方；输出：兵的前进方向（白 -1 / 黑 +1）。
  function forward(turn) {
    return turn === 1 ? -1 : 1
  }

  // 内部：克隆整盘（含元数据行）。
  function cloneBoard(board) {
    return board.map(function (row) { return row.slice() })
  }

  // 输出：初始局面（12 子/方，深色格；第 8 行为元数据）。
  function init() {
    var b = []
    for (var j = 0; j < ROWS + 1; j++) {
      var row = []
      for (var i = 0; i < COLS; i++) {
        var v = 0
        if ((i + j) % 2 === 1) {
          if (j <= 2) v = BLACK_MAN
          else if (j >= 5) v = WHITE_MAN
        }
        row.push(v)
      }
      b.push(row)
    }
    b[META] = [0]
    return b
  }

  // 输入：board、turn；输出：不吃子的走法 [{i,j,fi,fj}]。
  function quietMoves(board, turn) {
    var out = []
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== turn) continue
        var dirs
        if (typeOf(v) === 1) {
          dirs = DIAG
        } else {
          var dj = forward(turn)
          dirs = [[1, dj], [-1, dj]]
        }
        for (var k = 0; k < dirs.length; k++) {
          var ti = i + dirs[k][0]
          var tj = j + dirs[k][1]
          if (inB(ti, tj) && board[tj][ti] === 0) out.push({ i: ti, j: tj, fi: i, fj: j })
        }
      }
    }
    return out
  }

  // 内部：从 (fi,fj) 出发递归生成完整吃子链；oi/oj 为本着原始起点（走法的 fi/fj）。
  // 只输出「吃到不能继续为止」的最大链，半截链不合法。
  function captureChain(board, fi, fj, oi, oj, turn, chain, out) {
    var v = board[fj][fi]
    var isKing = typeOf(v) === 1
    var dirs
    if (isKing) {
      dirs = DIAG
    } else {
      var dj = forward(turn)
      dirs = [[1, dj], [-1, dj]]
    }
    for (var k = 0; k < dirs.length; k++) {
      var mi = fi + dirs[k][0]
      var mj = fj + dirs[k][1]
      var li = fi + 2 * dirs[k][0]
      var lj = fj + 2 * dirs[k][1]
      if (!inB(li, lj)) continue
      var victim = board[mj][mi]
      if (victim === 0 || colorOf(victim) === turn) continue
      if (board[lj][li] !== 0) continue
      var b2 = cloneBoard(board)
      b2[mj][mi] = 0
      b2[fj][fi] = 0
      b2[lj][li] = v
      var chain2 = chain.concat([{ i: mi, j: mj }])
      // 兵进底线：立即升王并结束连吃
      if (!isKing && lj === promoRow(turn)) {
        out.push({ i: li, j: lj, fi: oi, fj: oj, captures: chain2 })
        continue
      }
      var sub = []
      captureChain(b2, li, lj, oi, oj, turn, chain2, sub)
      if (sub.length) {
        for (var s = 0; s < sub.length; s++) out.push(sub[s])
      } else {
        out.push({ i: li, j: lj, fi: oi, fj: oj, captures: chain2 })
      }
    }
  }

  // 输入：board、turn；输出：全部吃子着法（含完整 captures 链）。
  function captureMoves(board, turn) {
    var out = []
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== turn) continue
        captureChain(board, i, j, i, j, turn, [], out)
      }
    }
    return out
  }

  // 输入：board、turn；输出：合法走法（有吃子则只返回吃子）。
  function moves(board, turn) {
    var caps = captureMoves(board, turn)
    if (caps.length) return caps
    return quietMoves(board, turn)
  }

  // 内部：单着排序分（吃子数 → 升王 → 前进 → 王居中）。
  function moveScore(board, m) {
    var s = 0
    if (m.captures) s += m.captures.length * 1000
    var v = board[m.fj][m.fi]
    var c = colorOf(v)
    if (typeOf(v) === 0) {
      var dir = c === 1 ? -1 : 1
      s += (m.j - m.fj) * dir * 10
      if (m.j === promoRow(c)) s += 300
    } else {
      s += Math.round((3.5 - Math.abs(m.i - 3.5) - Math.abs(m.j - 3.5)) * 4)
    }
    return s
  }

  // 输入：board、turn；输出：合法走法按「吃子优先」降序（利于 α-β 剪枝）。
  function candidates(board, turn) {
    var ms = moves(board, turn)
    ms.sort(function (a, b) {
      return moveScore(board, b) - moveScore(board, a)
    })
    return ms
  }

  // 输入：board、move、turn；输出：新棋盘（提子/升王/元数据计数更新）。
  function apply(board, move, turn) {
    var b = cloneBoard(board)
    var v = b[move.fj][move.fi]
    var captured = 0
    if (move.captures && move.captures.length) {
      for (var k = 0; k < move.captures.length; k++) {
        var c = move.captures[k]
        if (b[c.j][c.i] !== 0 && colorOf(b[c.j][c.i]) === 3 - turn) {
          b[c.j][c.i] = 0
          captured++
        }
      }
    } else if (b[move.j][move.i] !== 0) {
      // 兜底：无 captures 链的单吃着法
      b[move.j][move.i] = 0
      captured = 1
    }
    b[move.fj][move.fi] = 0
    if (typeOf(v) === 0 && move.j === promoRow(turn)) {
      v = turn === 1 ? WHITE_KING : BLACK_KING
    }
    b[move.j][move.i] = v
    var m8 = b[META]
    m8[0] = captured > 0 ? 0 : m8[0] + 1
    return b
  }

  // 内部：数一方棋子数。
  function countPieces(board, turn) {
    var n = 0
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        if (board[j][i] !== 0 && colorOf(board[j][i]) === turn) n++
      }
    }
    return n
  }

  // 输入：board、lastMove；输出：胜负/和棋或 null。
  // 判负：无子、无合法走法；判和：100 个半回合（50 回合）无吃子。
  function check(board, lastMove) {
    if (!lastMove) return null
    var mover = colorOf(board[lastMove.j][lastMove.i])
    if (mover === 0) return null
    var opp = 3 - mover
    if (countPieces(board, opp) === 0) return { result: 'win', winner: mover, reason: '吃光对方棋子' }
    if (board[META][0] >= 100) return { result: 'draw', reason: '50 回合无吃子' }
    if (moves(board, opp).length === 0) return { result: 'win', winner: mover, reason: '对方无合法走法' }
    return null
  }

  // 内部：简单机动性（可走的空格对角邻数，不含吃子）。
  function mobility(board, turn) {
    var n = 0
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== turn) continue
        var dirs
        if (typeOf(v) === 1) {
          dirs = DIAG
        } else {
          var dj = forward(turn)
          dirs = [[1, dj], [-1, dj]]
        }
        for (var k = 0; k < dirs.length; k++) {
          var ti = i + dirs[k][0]
          var tj = j + dirs[k][1]
          if (inB(ti, tj) && board[tj][ti] === 0) n++
        }
      }
    }
    return n
  }

  // 内部：单方静态分（只计己方项，evaluate 再作差）。
  // 子力 + 王（居中加分）+ 推进（越接近升王行越值钱）+ 后排防守 + 机动性。
  function sideScore(board, c) {
    var s = 0
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== c) continue
        if (typeOf(v) === 1) {
          var kd = Math.abs(i - 3.5) + Math.abs(j - 3.5)
          s += 170 + Math.round((7 - kd) * 3) // 王居中更有机动
        } else {
          s += 100 + (c === 1 ? 7 - j : j) * 7 // 推进
          var home = c === 1 ? 7 : 0
          if (j === home) s += 8              // 后排防守（防止对方冲王）
          else if (Math.abs(j - home) === 1) s += 3
        }
      }
    }
    s += mobility(board, c) * 2
    return s
  }

  // 输入：board、turn；输出：turn 视角评估（严格反对称）。
  function evaluate(board, turn) {
    return sideScore(board, turn) - sideScore(board, 3 - turn)
  }

  return {
    COLS: COLS,
    ROWS: ROWS,
    STARS: [],
    MATCH_BY_COLUMN: false,
    MOVE_HAS_FROM: true,
    // 英式跳棋分支偏小（强制吃子进一步收窄）：normal 4 / hard 7
    DEPTH: { easy: 1, normal: 4, hard: 7 },
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
