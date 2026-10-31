/**
 * rules/jungle.js — 7×9 斗兽棋（Jungle / Dou Shou Qi）。
 * create() 兼容统一工厂签名；纯函数；board 共 10 行：
 *   0..8 棋盘（j=0 黑方底线，j=8 白方底线）；9 = 对局元数据行：[0] 无吃子半回合计数。
 * 棋子：白 1鼠 2猫 3狗 4狼 5豹 6虎 7狮 8象；黑 9..16（码值 - 8 = 等级）。
 * 等级：鼠1 < 猫2 < 狗3 < 狼4 < 豹5 < 虎6 < 狮7 < 象8。
 * 棋盘固定地形：
 *   河流：(j=3..5) 且 (i=1..2 或 i=4..5) 共 12 格，仅鼠可入。
 *   陷阱：黑方 (2,0)(4,0)(3,1)；白方 (2,8)(4,8)(3,7)。
 *   兽穴：黑方 (3,0)；白方 (3,8)。禁入己方兽穴，进对方兽穴立即获胜。
 * 规则取舍：
 *   ① 同等级可互吃（等级 >= 即可吃）；鼠吃象、象不能吃鼠。
 *   ② 站到对方陷阱内的兽「防御等级视为 0」，任意对方兽可吃；其攻击等级不变。
 *   ③ 水陆隔离：水中鼠与岸上兽不能互吃；水中鼠之间按等级互吃。
 *   ④ 虎/狮沿直线跳过整段连续河流，落点须为岸；路径任一水格有鼠（任意一方）则该跳被阻。
 *   ⑤ 吃子不强制（与英式跳棋不同），moves 返回全部合法着法。
 *   ⑥ 和棋：无吃子半回合计数 >= 100（即双方各 50 着 / 50 回合）判和。
 * 走法 {i,j,fi,fj}；虎狮跳河额外带 jump:true。
 * captures 导出为 null：本棋种不需要页面侧提子计数。
 */

function create() {
  var COLS = 7
  var ROWS = 9
  var META = 9 // 元数据行下标

  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]

  // 输入：棋子码；输出：1 白 / 2 黑 / 0 空。
  function colorOf(v) {
    return v === 0 ? 0 : v <= 8 ? 1 : 2
  }

  // 输入：棋子码；输出：等级 0..8（0 = 空）。
  function rankOf(v) {
    return v === 0 ? 0 : v <= 8 ? v : v - 8
  }

  function inB(i, j) {
    return i >= 0 && i < COLS && j >= 0 && j < ROWS
  }

  // 输入：格坐标；输出：是否河流。
  function inWater(i, j) {
    return j >= 3 && j <= 5 && ((i >= 1 && i <= 2) || (i >= 4 && i <= 5))
  }

  // 输入：格坐标；输出：陷阱归属（0 无 / 1 白方 / 2 黑方）。
  function trapOwner(i, j) {
    if (j === 0 && (i === 2 || i === 4)) return 2
    if (j === 1 && i === 3) return 2
    if (j === 8 && (i === 2 || i === 4)) return 1
    if (j === 7 && i === 3) return 1
    return 0
  }

  // 输入：格坐标；输出：兽穴归属（0 无 / 1 白方 / 2 黑方）。
  function denOwner(i, j) {
    if (i !== 3) return 0
    if (j === 0) return 2
    if (j === 8) return 1
    return 0
  }

  // 输出：初始局面（八兽各就其位；第 9 行为元数据）。
  function init() {
    var b = []
    for (var j = 0; j < ROWS + 1; j++) {
      var row = []
      for (var i = 0; i < COLS; i++) row.push(0)
      b.push(row)
    }
    // 黑方（上方）
    b[0][0] = 8 + 7 // 狮
    b[0][6] = 8 + 6 // 虎
    b[1][1] = 8 + 3 // 狗
    b[1][2] = 8 + 2 // 猫
    b[1][3] = 8 + 1 // 鼠
    b[1][4] = 8 + 4 // 狼
    b[1][5] = 8 + 5 // 豹
    b[2][0] = 8 + 8 // 象
    // 白方（下方，与黑方 180° 对称）
    b[6][6] = 8       // 象
    b[7][5] = 3       // 狗
    b[7][4] = 2       // 猫
    b[7][3] = 1       // 鼠
    b[7][2] = 4       // 狼
    b[7][1] = 5       // 豹
    b[8][0] = 6       // 虎
    b[8][6] = 7       // 狮
    b[META] = [0]
    return b
  }

  // 输入：board、攻方起点/终点、攻方；输出：该吃子是否合法。
  function canCapture(board, fi, fj, ti, tj, turn) {
    var atkV = board[fj][fi]
    var defV = board[tj][ti]
    if (defV === 0 || colorOf(defV) === turn) return false
    // 水陆互不侵犯（只有鼠能入水）
    if (inWater(fi, fj) !== inWater(ti, tj)) return false
    // 对方兽站在我方陷阱内 → 防御等级 0，任意兽可吃
    if (trapOwner(ti, tj) === turn) return true
    var ar = rankOf(atkV)
    var dr = rankOf(defV)
    if (ar === 1 && dr === 8) return true  // 鼠吃象
    if (ar === 8 && dr === 1) return false // 象不能吃鼠
    return ar >= dr
  }

  // 输入：board、turn；输出：全部合法走法。
  function moves(board, turn) {
    var out = []
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) !== turn) continue
        var rank = rankOf(v)
        // 常规一步
        for (var k = 0; k < ORTH.length; k++) {
          var ti = i + ORTH[k][0]
          var tj = j + ORTH[k][1]
          if (!inB(ti, tj)) continue
          if (denOwner(ti, tj) === turn) continue // 禁入己方兽穴
          if (inWater(ti, tj) && rank !== 1) continue // 仅鼠可入水
          var tv = board[tj][ti]
          if (tv === 0) {
            out.push({ i: ti, j: tj, fi: i, fj: j })
          } else if (canCapture(board, i, j, ti, tj, turn)) {
            out.push({ i: ti, j: tj, fi: i, fj: j })
          }
        }
        // 虎 / 狮跳河
        if (rank === 6 || rank === 7) {
          for (k = 0; k < ORTH.length; k++) {
            var di = ORTH[k][0]
            var dj = ORTH[k][1]
            var x = i + di
            var y = j + dj
            var water = 0
            var blocked = false
            while (inB(x, y) && inWater(x, y)) {
              water++
              if (rankOf(board[y][x]) === 1) blocked = true // 路径有水中鼠 → 不可跳
              x += di
              y += dj
            }
            if (water === 0 || blocked || !inB(x, y)) continue
            if (denOwner(x, y) === turn) continue
            var lv = board[y][x]
            if (lv === 0) {
              out.push({ i: x, j: y, fi: i, fj: j, jump: true })
            } else if (canCapture(board, i, j, x, y, turn)) {
              out.push({ i: x, j: y, fi: i, fj: j, jump: true })
            }
          }
        }
      }
    }
    return out
  }

  // 内部：单着排序分（进对方兽穴 → 吃子等级 → 向对方兽穴推进 → 靠中路）。
  function moveScore(board, m, turn) {
    var s = 0
    if (m.i === 3 && m.j === (turn === 1 ? 0 : 8)) s += 100000
    var victim = board[m.j][m.i]
    if (victim !== 0) s += 100 + rankOf(victim) * 10
    var dir = turn === 1 ? -1 : 1
    s += (m.j - m.fj) * dir * 6
    s += (3 - Math.abs(m.i - 3)) * 2
    return s
  }

  // 输入：board、turn；输出：合法走法按进攻性降序。
  function candidates(board, turn) {
    var ms = moves(board, turn)
    ms.sort(function (a, b) {
      return moveScore(board, b, turn) - moveScore(board, a, turn)
    })
    return ms
  }

  // 输入：board、move、turn；输出：新棋盘（元数据计数更新）。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    var v = b[move.fj][move.fi]
    var captured = b[move.j][move.i] !== 0
    b[move.fj][move.fi] = 0
    b[move.j][move.i] = v
    var m9 = b[META]
    m9[0] = captured ? 0 : m9[0] + 1
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
  // 优先级：进对方兽穴 > 吃光对方 > 50 回合无吃子 > 对方无合法走法。
  function check(board, lastMove) {
    if (!lastMove) return null
    var mover = colorOf(board[lastMove.j][lastMove.i])
    if (mover === 0) return null
    var opp = 3 - mover
    var oppDenJ = mover === 1 ? 0 : 8
    if (lastMove.i === 3 && lastMove.j === oppDenJ) {
      return { result: 'win', winner: mover, reason: '进入对方兽穴' }
    }
    if (countPieces(board, opp) === 0) return { result: 'win', winner: mover, reason: '吃光对方棋子' }
    if (board[META][0] >= 100) return { result: 'draw', reason: '50 回合无吃子' }
    if (moves(board, opp).length === 0) return { result: 'win', winner: mover, reason: '对方无合法走法' }
    return null
  }

  // 内部：基础子力值（按等级）。
  var RANK_VAL = [0, 30, 45, 60, 80, 100, 130, 170, 220]

  // 内部：单方静态分（只计己方视角，evaluate 再作差）。
  // 子力 + 接近对方兽穴（近 1/2 格大幅加权）+ 己方兽穴被威胁 + 陷阱安全
  // + 鼠象特例（象在有敌鼠时贬值、水中鼠加分）+ 后排/水路安全。
  function sideScore(board, c) {
    var enemyRats = 0
    var denThreat = 0
    var ownDenJ = c === 1 ? 8 : 0
    var oppDenJ = c === 1 ? 0 : 8
    // 第一遍：数敌鼠、看敌方是否贴着我方兽穴（下一手就能进）
    for (var j = 0; j < ROWS; j++) {
      for (var i = 0; i < COLS; i++) {
        var v = board[j][i]
        if (v === 0 || colorOf(v) === c) continue
        if (rankOf(v) === 1) enemyRats++
        if (Math.abs(i - 3) + Math.abs(j - ownDenJ) === 1) denThreat++
      }
    }
    var s = -denThreat * 20
    // 第二遍：己方子力与位置
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var t = board[y][x]
        if (t === 0 || colorOf(t) !== c) continue
        var rank = rankOf(t)
        var val = RANK_VAL[rank]
        var d = Math.abs(x - 3) + Math.abs(y - oppDenJ)
        if (d === 1) val += 35          // 一步进对方兽穴
        else if (d === 2) val += 12
        else val += Math.max(0, 12 - d) * 2
        if (trapOwner(x, y) === 3 - c) val -= 50 // 站在对方陷阱里，随时被任意敌子吃
        if (rank === 1 && inWater(x, y)) val += 15 // 水中鼠相对安全
        if (rank === 8 && enemyRats > 0) val -= 20 // 鼠克象：有敌鼠时象贬值
        s += val
      }
    }
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
    DEPTH: { easy: 1, normal: 3, hard: 6 },
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
