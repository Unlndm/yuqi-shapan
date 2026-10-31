/**
 * rules/chess.js — 国际象棋（完整规则版）。
 * create() 兼容统一工厂签名；纯函数；board 共 9 行：
 *   0..7 棋盘（j=0 黑方底线，j=7 白方底线）；8 = 对局元数据行：
 *   [0] 半回合计数  [1] 白王动过  [2] 白车a1动过  [3] 白车h1动过
 *   [4] 黑王动过    [5] 黑车a8动过  [6] 黑车h8动过  [7] 过路兵目标(j*8+i, 无=-1)
 * 棋子：白 1兵2马3象4车5后6王；黑 7兵8马9象10车11后12王。
 * 完整规则：王车易位（长短侧，含路径/将军校验）、吃过路兵、兵升变（可选升后/车/象/马）、
 *   将死/困毙、五十回合和棋、子力不足判和、三次重复局面和棋（2026-10-23 补）。
 * 升变：走法可带 promo（1马 2象 3车 4后）；缺省升后。AI / 搜索不分支，一律走缺省升后。
 * 三次重复：本模块只提供 positionKey(board, turn) 生成局面签名；
 *   「同一签名出现 3 次」的计数由对局页在走子栈上完成（规则层保持纯函数、无历史状态）。
 *   签名 = 棋子布局 + 行棋方 + 易位权旗标 + 过路兵目标（含半回合计数以外的一切 FIDE 要素）。
 * 走法 {i,j,fi,fj}：i/j 目标格，fi/fj 起始格；castle 标记易位。
 */

function create() {
  var COLS = 8
  var ROWS = 8
  var META = 8 // 元数据行下标

  function colorOf(v) {
    return v === 0 ? 0 : v <= 6 ? 1 : 2
  }
  function typeOf(v) {
    return v === 0 ? 0 : v <= 6 ? v - 1 : v - 7 // 0兵 1马 2象 3车 4后 5王
  }
  function inB(i, j) {
    return i >= 0 && i < COLS && j >= 0 && j < ROWS
  }

  // 输出：初始局面（第 8 行为元数据：半回合 0、各旗 0、无过路兵）。
  function init() {
    var back = [4, 2, 3, 5, 6, 3, 2, 4]
    var b = []
    for (var j = 0; j < ROWS + 1; j++) {
      var row = []
      for (var i = 0; i < COLS; i++) {
        var v = 0
        if (j === 0) v = back[i] + 6
        else if (j === 1) v = 7
        else if (j === 6) v = 1
        else if (j === 7) v = back[i]
        row.push(v)
      }
      b.push(row)
    }
    b[META] = [0, 0, 0, 0, 0, 0, 0, -1] // [半回合, 白王, 白车a, 白车h, 黑王, 黑车a, 黑车h, ep]
    return b
  }

  // 内部：克隆整盘（含元数据行）。
  function cloneBoard(board) {
    return board.map(function (row) { return row.slice() })
  }

  // 输入：board、目标格、攻击方；输出：该格是否被攻击方控制。
  function attacked(board, i, j, byTurn) {
    var KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
    var k
    for (k = 0; k < 8; k++) {
      var x = i + KN[k][0]
      var y = j + KN[k][1]
      if (inB(x, y) && board[y][x] !== 0 && colorOf(board[y][x]) === byTurn && typeOf(board[y][x]) === 1) return true
    }
    var KK = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    for (k = 0; k < 8; k++) {
      var x2 = i + KK[k][0]
      var y2 = j + KK[k][1]
      if (inB(x2, y2) && board[y2][x2] !== 0 && colorOf(board[y2][x2]) === byTurn && typeOf(board[y2][x2]) === 5) return true
    }
    // 兵：白兵向上攻击（兵在 (i±1, j+1) 控制 (i,j)）；黑兵相反
    var pd = byTurn === 1 ? 1 : -1
    for (var d = -1; d <= 1; d += 2) {
      var px = i + d
      var py = j + pd
      if (inB(px, py) && board[py][px] !== 0 && colorOf(board[py][px]) === byTurn && typeOf(board[py][px]) === 0) return true
    }
    var DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (d = 0; d < 4; d++) {
      var x3 = i + DIAG[d][0]
      var y3 = j + DIAG[d][1]
      while (inB(x3, y3) && board[y3][x3] === 0) {
        x3 += DIAG[d][0]
        y3 += DIAG[d][1]
      }
      if (inB(x3, y3) && colorOf(board[y3][x3]) === byTurn) {
        var t3 = typeOf(board[y3][x3])
        if (t3 === 2 || t3 === 4) return true
      }
    }
    for (d = 0; d < 4; d++) {
      var x4 = i + ORTH[d][0]
      var y4 = j + ORTH[d][1]
      while (inB(x4, y4) && board[y4][x4] === 0) {
        x4 += ORTH[d][0]
        y4 += ORTH[d][1]
      }
      if (inB(x4, y4) && colorOf(board[y4][x4]) === byTurn) {
        var t4 = typeOf(board[y4][x4])
        if (t4 === 3 || t4 === 4) return true
      }
    }
    return false
  }

  function kingPos(board, turn) {
    var kk = turn === 1 ? 6 : 12
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        if (board[j][i] === kk) return { i: i, j: j }
      }
    }
    return null
  }

  // 输入：board、turn；输出：turn 方王是否被将军。
  function inCheck(board, turn) {
    var k = kingPos(board, turn)
    if (!k) return false
    return attacked(board, k.i, k.j, 3 - turn)
  }

  // 内部：易位走法生成（白 turn=1，黑 turn=2）。
  // 条件：王车未动、之间无子、王不在将军中、经过格与落格不受攻击。
  function castleMoves(board, turn, out) {
    var m8 = board[META]
    var home = turn === 1 ? 7 : 0
    var kFlag = turn === 1 ? 1 : 4
    var raFlag = turn === 1 ? 2 : 5
    var rhFlag = turn === 1 ? 3 : 6
    var kingV = turn === 1 ? 6 : 12
    var rookV = turn === 1 ? 4 : 10
    if (board[home][4] !== kingV || m8[kFlag]) return
    if (inCheck(board, turn)) return
    // 王翼（h 侧）
    if (!m8[rhFlag] && board[home][7] === rookV &&
        board[home][5] === 0 && board[home][6] === 0 &&
        !attacked(board, 5, home, 3 - turn) && !attacked(board, 6, home, 3 - turn)) {
      out.push({ i: 6, j: home, fi: 4, fj: home, castle: 'K' })
    }
    // 后翼（a 侧）：b1 仅需为空（可不受到攻击）
    if (!m8[raFlag] && board[home][0] === rookV &&
        board[home][1] === 0 && board[home][2] === 0 && board[home][3] === 0 &&
        !attacked(board, 3, home, 3 - turn) && !attacked(board, 2, home, 3 - turn)) {
      out.push({ i: 2, j: home, fi: 4, fj: home, castle: 'Q' })
    }
  }

  // 内部：伪合法走法（含易位与吃过路兵）。
  function pseudoMoves(board, turn) {
    var out = []
    var KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
    var KK = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    var DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    var m8 = board[META]
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== turn) continue
        var t = typeOf(v)
        if (t === 0) {
          var dir = turn === 1 ? -1 : 1
          var startJ = turn === 1 ? 6 : 1
          var y = j + dir
          if (inB(i, y) && board[y][i] === 0) {
            out.push({ i: i, j: y, fi: i, fj: j })
            var y2 = j + 2 * dir
            if (j === startJ && inB(i, y2) && board[y2][i] === 0) {
              out.push({ i: i, j: y2, fi: i, fj: j })
            }
          }
          for (var di = -1; di <= 1; di += 2) {
            var x = i + di
            if (!inB(x, y)) continue
            if (colorOf(board[y][x]) === 3 - turn) {
              out.push({ i: x, j: y, fi: i, fj: j })
            } else if (m8[7] >= 0 && x === m8[7] % 8 && y === Math.floor(m8[7] / 8) && board[y][x] === 0) {
              out.push({ i: x, j: y, fi: i, fj: j, ep: true }) // 吃过路兵
            }
          }
        } else if (t === 1) {
          for (var k = 0; k < 8; k++) pushStep(board, out, turn, i, j, i + KN[k][0], j + KN[k][1])
        } else if (t === 5) {
          for (var k2 = 0; k2 < 8; k2++) pushStep(board, out, turn, i, j, i + KK[k2][0], j + KK[k2][1])
        } else {
          var rays = t === 2 ? DIAG : t === 3 ? ORTH : DIAG.concat(ORTH)
          for (var r = 0; r < rays.length; r++) {
            var x5 = i + rays[r][0]
            var y5 = j + rays[r][1]
            while (inB(x5, y5)) {
              var tv = board[y5][x5]
              if (tv === 0) {
                out.push({ i: x5, j: y5, fi: i, fj: j })
              } else {
                if (colorOf(tv) === 3 - turn) out.push({ i: x5, j: y5, fi: i, fj: j })
                break
              }
              x5 += rays[r][0]
              y5 += rays[r][1]
            }
          }
        }
      }
    }
    castleMoves(board, turn, out)
    return out
  }

  function pushStep(board, out, turn, fi, fj, i, j) {
    if (!inB(i, j)) return
    var tv = board[j][i]
    if (tv === 0 || colorOf(tv) === 3 - turn) out.push({ i: i, j: j, fi: fi, fj: fj })
  }

  // 输入：board、move、turn；输出：新棋盘（含元数据行更新）。
  // 处理：吃子/升变/易位移车/过路兵提兵/双步设 ep/半回合计数/动子旗标。
  function apply(board, move, turn) {
    var b = cloneBoard(board)
    var m8 = b[META]
    var v = b[move.fj][move.fi]
    var isPawn = typeOf(v) === 0
    var isCapture = b[move.j][move.i] !== 0
    // 半回合计数：兵动或吃子归零
    m8[0] = isPawn || isCapture || move.ep ? 0 : m8[0] + 1
    // 吃过路兵：被吃兵在 Capturing 兵的原行、过路兵目标列
    if (move.ep) {
      b[move.fj][move.i] = 0
    }
    if (isPawn && (move.j === 0 || move.j === 7)) {
      // 升变：promo 为棋子类型 1马 2象 3车 4后；缺省（含 AI/搜索）升后
      var pt = move.promo >= 1 && move.promo <= 4 ? move.promo : 4
      v = turn === 1 ? pt + 1 : pt + 7
    }
    b[move.fj][move.fi] = 0
    b[move.j][move.i] = v
    // 易位：移车
    if (move.castle === 'K') {
      b[move.j][5] = b[move.j][7]
      b[move.j][7] = 0
    } else if (move.castle === 'Q') {
      b[move.j][3] = b[move.j][0]
      b[move.j][0] = 0
    }
    // 旗标更新：王/车动过
    if (v === 6) m8[1] = 1
    if (v === 12) m8[4] = 1
    if (move.fi === 0 && (move.fj === 7 || move.fj === 0)) m8[turn === 1 ? 2 : 5] = 1
    if (move.fi === 7 && (move.fj === 7 || move.fj === 0)) m8[turn === 1 ? 3 : 6] = 1
    // 被吃的车若在原始位 → 对方失易位权
    if (isCapture && move.i === 0 && move.j === 0) m8[5] = 1
    if (isCapture && move.i === 7 && move.j === 0) m8[6] = 1
    if (isCapture && move.i === 0 && move.j === 7) m8[2] = 1
    if (isCapture && move.i === 7 && move.j === 7) m8[3] = 1
    // 双步设过路兵目标
    if (isPawn && Math.abs(move.j - move.fj) === 2) {
      m8[7] = ((move.j + move.fj) / 2) * 8 + move.i // 过路兵格 = 双步中点行,编码 j*8+i
    } else {
      m8[7] = -1
    }
    return b
  }

  // 输入：board、turn；输出：全部合法走法（含易位与过路兵，过滤送王）。
  function moves(board, turn) {
    var ms = pseudoMoves(board, turn)
    var out = []
    for (var k = 0; k < ms.length; k++) {
      var b2 = apply(board, ms[k], turn)
      if (!inCheck(b2, turn)) out.push(ms[k])
    }
    return out
  }

  // 输入：board、turn；输出：合法走法按「MVV-LVA」降序（利于剪枝）。
  // 2026-10-23：原排序只看「目标格上是什么子」（只看受害者价值），
  // 同一受害者下不区分动子大小（用后吃兵和用兵吃兵同分）。改为经典 MVV-LVA：
  //   score = 受害者价值×10 − 动子价值  → 先「大子吃、小子喂」，剪枝率更高；
  // 另给升变（兵进底行）与易位加分，避免浅搜时把升变排到最后而看不见。
  var VAL = [100, 320, 330, 500, 900, 0]

  // 内部：单着排序分（越大越先搜）。
  function moveScore(board, m) {
    var s = 0
    var victim = board[m.j][m.i]
    if (m.ep) victim = board[m.fj][m.i] // 吃过路兵：被吃兵在原行、目标列
    var mover = board[m.fj][m.fi]
    if (victim !== 0) s += VAL[typeOf(victim)] * 10 - VAL[typeOf(mover)]
    if (typeOf(mover) === 0 && (m.j === 0 || m.j === 7)) s += VAL[4] // 升变（自动升后）
    if (m.castle) s += 50
    return s
  }

  function candidates(board, turn) {
    var ms = moves(board, turn)
    ms.sort(function (a, b) {
      return moveScore(board, b) - moveScore(board, a)
    })
    return ms
  }

  // 内部：子力不足（仅王 / 王+单轻子 vs 王）。
  function insufficient(board) {
    var minors = 0
    var others = 0
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || typeOf(v) === 5) continue
        var t = typeOf(v)
        if (t === 1 || t === 2) minors++
        else others++
      }
    }
    return others === 0 && minors <= 1
  }

  // 输入：board、turn；输出：局面签名串（用于三次重复判和）。
  // 只含 FIDE 判等要素：棋子布局 + 行棋方 + 六个易位权旗标 + 过路兵目标；
  // 不含半回合计数（m8[0]）—— 官方判定也不看它。
  // 由对局页在走子栈上计数；规则层保持无状态。
  function positionKey(board, turn) {
    var out = turn + '|'
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) out += board[j][i] + ','
    }
    var m8 = board[META]
    out += '|' + m8[1] + m8[2] + m8[3] + m8[4] + m8[5] + m8[6] + '|' + m8[7]
    return out
  }

  // 输入：board、lastMove；输出：将死/困毙/五十回合/子力不足 / null。
  function check(board, lastMove) {
    if (!lastMove) return null
    var mover = colorOf(board[lastMove.j][lastMove.i])
    if (mover === 0) return null
    var opp = 3 - mover
    if (board[META][0] >= 100) return { result: 'draw', reason: '五十回合无吃子无兵动' }
    if (insufficient(board)) return { result: 'draw', reason: '子力不足' }
    if (moves(board, opp).length === 0) {
      if (inCheck(board, opp)) return { result: 'win', winner: mover, reason: '将死' }
      return { result: 'draw', reason: '困毙' }
    }
    return null
  }

  // 输入：board、turn；输出：战术着法（静态战术延伸用）。
  // 被将军时返回全部合法应着（不能只搜吃子），否则只保留吃子/吃过路兵/升变。
  // 先按伪合法着法过滤再用 inCheck 校验，避免像 moves() 那样对每个伪着法都做一次
  // apply+inCheck —— 叶子处这一步的开销直接决定 quiescence 能不能跑起来。
  function tacticalMoves(board, turn) {
    var out = []
    var ps = pseudoMoves(board, turn)
    var needAll = inCheck(board, turn)
    for (var k = 0; k < ps.length; k++) {
      var m = ps[k]
      var mover = board[m.fj][m.fi]
      var victim = board[m.j][m.i]
      if (m.ep) victim = board[m.fj][m.i]
      var promo = typeOf(mover) === 0 && (m.j === 0 || m.j === 7)
      if (!needAll && victim === 0 && !m.ep && !promo) continue
      var b2 = apply(board, m, turn)
      if (inCheck(b2, turn)) continue
      out.push(m)
    }
    out.sort(function (a, b) { return moveScore(board, b) - moveScore(board, a) })
    return out
  }

  // ── 评估（2026-10-24 强化） ────────────────────────────────────────
  // 子力 + 兵型（叠兵/孤兵/通路兵）+ 王安全（兵盾/易位/中心暴露）+ 中心与机动
  // + 主教对 + 车开放线。全部按「某方视角」独立算，evaluate 再作差，
  // 因此任意局面都严格满足 e(1) = -e(2)（规则测试依赖这一点）。
  // 只做轻量扫描：不做全量走法生成，避免评估把搜索预算吃光。

  // 内部：车所在纵线的开放程度（无兵 = 开放线；无己方兵 = 半开放线）。
  function rookFileBonus(board, i, j, c) {
    var own = 0
    var foe = 0
    for (var y = 0; y < ROWS; y++) {
      var v = board[y][i]
      if (v === 0 || typeOf(v) !== 0) continue
      if (colorOf(v) === c) own++
      else foe++
    }
    var s = own === 0 ? (foe === 0 ? 12 : 6) : 0
    if ((c === 1 && j === 1) || (c === 2 && j === 6)) s += 10 // 车到七线
    return s
  }

  // 内部：兵型分。叠兵/孤兵扣分，通路兵按推进度加分（越接近升变越值钱）。
  function pawnStructure(board, c, pawns) {
    var s = 0
    var foes = []
    var foePawn = c === 1 ? 7 : 1
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        if (board[j][i] === foePawn) foes.push([i, j])
      }
    }
    for (var k = 0; k < pawns.length; k++) {
      var p = pawns[k]
      var same = 0
      var adj = 0
      for (var q = 0; q < pawns.length; q++) {
        if (q === k) continue
        if (pawns[q][0] === p[0]) same++
        else if (Math.abs(pawns[q][0] - p[0]) === 1) adj++
      }
      if (same > 0) s -= 8
      if (adj === 0) s -= 6
      var passed = true
      for (var f = 0; f < foes.length; f++) {
        if (Math.abs(foes[f][0] - p[0]) > 1) continue
        if (c === 1 ? foes[f][1] < p[1] : foes[f][1] > p[1]) { passed = false; break }
      }
      if (passed) {
        var adv = c === 1 ? 6 - p[1] : p[1] - 1
        s += 8 + Math.max(0, adv) * 4
      }
    }
    return s
  }

  // 内部：轻量机动性——只数马的可跳格与象的可走格（不生成完整走法、不校验将军）。
  function mobility(board, c) {
    var n = 0
    var KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
    var DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== c) continue
        var t = typeOf(v)
        if (t === 1) {
          for (var k = 0; k < 8; k++) {
            var x = i + KN[k][0]
            var y = j + KN[k][1]
            if (inB(x, y) && colorOf(board[y][x]) !== c) n++
          }
        } else if (t === 2) {
          for (var d = 0; d < 4; d++) {
            var x2 = i + DIAG[d][0]
            var y2 = j + DIAG[d][1]
            while (inB(x2, y2)) {
              if (board[y2][x2] !== 0) { if (colorOf(board[y2][x2]) !== c) n++; break }
              n++
              x2 += DIAG[d][0]
              y2 += DIAG[d][1]
            }
          }
        }
      }
    }
    return n
  }

  // 内部：王安全（兵盾 + 易位格 + 中心暴露；残局改为鼓励王居中）。
  function kingScore(board, c, king, pawns, nonPawn) {
    if (!king) return 0
    var kd = Math.abs(king[0] - 3.5) + Math.abs(king[1] - 3.5)
    if (nonPawn <= 1300) return (7 - kd) * 4 // 残局：王也是战斗子
    var home = c === 1 ? 7 : 0
    var s = 0
    if (king[1] === home) {
      var front = c === 1 ? home - 1 : home + 1
      var shield = 0
      for (var p = 0; p < pawns.length; p++) {
        if (pawns[p][1] === front && Math.abs(pawns[p][0] - king[0]) <= 1) shield++
      }
      if (shield >= 2) s += 12
      else if (shield === 0) s -= 15
      if (king[0] === 2 || king[0] === 6) s += 10 // 已易位/贴边
    } else {
      s -= 8
      if (Math.abs(king[0] - 3.5) < 1.5) s -= 18
    }
    return s
  }

  // 内部：单方静态分（子力 + 位置 + 结构 + 机动）。
  function sideScore(board, c) {
    var s = 0
    var bishops = 0
    var nonPawn = 0
    var king = null
    var pawns = []
    var rooks = []
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== c) continue
        var t = typeOf(v)
        var cd = Math.abs(i - 3.5) + Math.abs(j - 3.5)
        if (t === 0) {
          pawns.push([i, j])
          s += 100 + (c === 1 ? 6 - j : j - 1) * 6
          if (i >= 2 && i <= 5) s += 4 // 中心兵
        } else if (t === 1) {
          nonPawn += 320
          s += 320 + (7 - cd) * 4
        } else if (t === 2) {
          nonPawn += 330
          bishops++
          s += 330 + (7 - cd) * 3
        } else if (t === 3) {
          nonPawn += 500
          rooks.push([i, j])
          s += 500
        } else if (t === 4) {
          nonPawn += 900
          s += 900 + (7 - cd) * 2
        } else {
          king = [i, j]
        }
      }
    }
    for (var r = 0; r < rooks.length; r++) s += rookFileBonus(board, rooks[r][0], rooks[r][1], c)
    if (bishops >= 2) s += 25 // 主教对
    s += kingScore(board, c, king, pawns, nonPawn)
    s += pawnStructure(board, c, pawns)
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
    // 分支大（约 30 合法着法/层）：normal 4 / hard 5，由 600/1000ms 预算与迭代加深兜底；
    // 叶子再做静态战术延伸（吃子/升变 4 ply），地平线送子会被 quiescence 纠正。
    DEPTH: { easy: 1, normal: 4, hard: 5 },
    QDEPTH: 4,
    init: init,
    moves: moves,
    candidates: candidates,
    positionKey: positionKey,
    apply: apply,
    check: check,
    evaluate: evaluate,
    tacticalMoves: tacticalMoves,
    captures: null,
    inCheck: inCheck
  }
}

module.exports = { create: create }
