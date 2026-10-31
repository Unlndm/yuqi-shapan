/**
 * rules/go.js — 围棋规则（9 路为主，支持 7/9/13 路方阵；中国规则数子法）。
 * create(cols, rows) 返回规则实例；纯函数（仅 simple-ko 劫点为实例态，由页面回写）。
 * 棋盘 board[j][i]：0 空 / 1 黑 / 2 白。
 * 规则范围：提无气子、禁自杀、简单劫（禁立即回提）、双停一手终局数子（白贴 6.5）。
 * 停一手：PASS_OK=true，{pass:true} 作为合法"走法"参与搜索与对局流程。
 */

function create(cols, rows) {
  var KOMI = 6.5
  // simple-ko 劫点放共享 state（页面经 setKo 回写；若挂在返回对象属性上，
  // 闭包内的 moves/captures 读不到外部赋值）
  var state = { ko: null }

  // 四邻方向 / 棋盘格数（多处复用，避免每次新建数组）
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  var CELLS = cols * rows

  // ── 合法性快路径（性能） ───────────────────────────────────────────
  // 原实现：每个空点先 captures() 复制整盘 + 洪泛，再 isSuicide() 又复制整盘 + 洪泛
  // → 19 路实测 moves() 3.0ms/次；搜索每层要调 candidates()（内部再调 moves()），
  //   于是「深度 2」根本跑不完，500ms 预算全烧光还只能交出深度 1 的着法。
  // 现改为：**不复制棋盘**，把待落点当「虚拟子」参与洪泛（neighbors 里跳过它），
  // 一趟扫描同时算「提子数」与「己方是否有气」。两张时间戳表代替每次新建对象。
  var vStamp = new Array(CELLS)   // 该格是否已被本次洪泛访问（值 = 时间戳）
  var lStamp = new Array(CELLS)   // 该空点是否已被本次洪泛计过气（同名气不重复计）
  for (var z = 0; z < CELLS; z++) { vStamp[z] = 0; lStamp[z] = 0 }
  var stamp = 0

  // 输入：board、起点 (si,sj)、该块颜色、虚拟落点 (vi,vj)（视为已下该色、不计气不展开）；
  // 输出：{ libs: 气数（去重）, stones: 块大小 }。
  function libsWithVirtual(board, si, sj, color, vi, vj) {
    stamp++
    var libs = 0
    var stones = 0
    var stack = [sj * cols + si]
    vStamp[sj * cols + si] = stamp
    while (stack.length) {
      var idx = stack.pop()
      stones++
      var x = idx % cols
      var y = (idx - x) / cols
      for (var d = 0; d < 4; d++) {
        var nx = x + DIRS[d][0]
        var ny = y + DIRS[d][1]
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
        if (nx === vi && ny === vj) continue          // 虚拟子：不算气、也不由此展开
        var k = ny * cols + nx
        var v = board[ny][nx]
        if (v === 0) {
          if (lStamp[k] !== stamp) { lStamp[k] = stamp; libs++ }
        } else if (v === color && vStamp[k] !== stamp) {
          vStamp[k] = stamp
          stack.push(k)
        }
      }
    }
    return { libs: libs, stones: stones }
  }

  // 输入：board、(i,j)、turn；输出：该点是否合法（空点、非劫点、非自杀）。
  // 口径与原实现一致：提子 > 0 即合法；否则己方落子后必须有气。
  function legalAt(board, i, j, turn) {
    if (i < 0 || i >= cols || j < 0 || j >= rows) return false
    if (board[j][i] !== 0) return false
    if (state.ko && state.ko.i === i && state.ko.j === j) return false
    var opp = 3 - turn
    var captured = 0
    var hasLiberty = false
    for (var d = 0; d < 4; d++) {
      var x = i + DIRS[d][0]
      var y = j + DIRS[d][1]
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue
      var v = board[y][x]
      if (v === 0) { hasLiberty = true; continue }
      var g = libsWithVirtual(board, x, y, v, i, j)
      if (v === opp) { if (g.libs === 0) captured += g.stones }
      else if (g.libs > 0) hasLiberty = true
    }
    return captured > 0 || hasLiberty
  }

  // 星位：奇数路天元；≥9 路加四星/十字星。
  function stars() {
    if (cols % 2 === 0 || rows % 2 === 0) return []
    var ci = (cols - 1) / 2
    var cj = (rows - 1) / 2
    if (cols < 9) return [[ci, cj]]
    if (cols === 9) return [[ci, cj], [2, 2], [6, 2], [2, 6], [6, 6]]
    var e = cols - 3
    var m = ci
    return [[m, m], [2, 2], [e, 2], [2, e], [e, e], [m, 2], [m, e], [2, m], [e, m]]
  }

  function init() {
    var b = []
    for (var j = 0; j < rows; j++) {
      var row = []
      for (var i = 0; i < cols; i++) row.push(0)
      b.push(row)
    }
    return b
  }

  // 内部：同色连通块及其气数。输出 {stones:[[i,j]], libs:[[i,j]]}。
  function group(board, i, j) {
    var v = board[j][i]
    var stones = []
    var libs = {}
    var seen = {}
    var stack = [[i, j]]
    seen[j * cols + i] = true
    while (stack.length) {
      var cur = stack.pop()
      stones.push(cur)
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      for (var d = 0; d < 4; d++) {
        var x = cur[0] + dirs[d][0]
        var y = cur[1] + dirs[d][1]
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue
        var nv = board[y][x]
        if (nv === 0) libs[y * cols + x] = [x, y]
        else if (nv === v && !seen[y * cols + x]) {
          seen[y * cols + x] = true
          stack.push([x, y])
        }
      }
    }
    var libList = []
    for (var k in libs) libList.push(libs[k])
    return { stones: stones, libs: libList }
  }

  // 输入：board、move、turn（不落子模拟）；输出：提子数（非法点 0）。
  function captures(board, move, turn) {
    if (board[move.j][move.i] !== 0) return 0
    if (state.ko && state.ko.i === move.i && state.ko.j === move.j) return 0
    var b = board.map(function (row) { return row.slice() })
    b[move.j][move.i] = turn
    var opp = 3 - turn
    var n = 0
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (var d = 0; d < 4; d++) {
      var x = move.i + dirs[d][0]
      var y = move.j + dirs[d][1]
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue
      if (b[y][x] !== opp) continue
      var g = group(b, x, y)
      if (g.libs.length === 0) {
        for (var s = 0; s < g.stones.length; s++) {
          b[g.stones[s][1]][g.stones[s][0]] = 0
          n++
        }
      }
    }
    // 自杀禁着：落子后己方块无气且未提子
    var own = group(b, move.i, move.j)
    if (n === 0 && own.libs.length === 0) return 0
    return n
  }

  // 输入：board、turn；输出：全部合法落点（排除劫点与自杀）。
  // 逐点走 legalAt 快路径（不复制棋盘），口径与原来的 captures/isSuicide 组合一致。
  function moves(board, turn) {
    var out = []
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (legalAt(board, i, j, turn)) out.push({ i: i, j: j })
      }
    }
    return out
  }

  // 内部：无提子时落点是否自杀（保留给旧调用/调试；搜索路径已改用 legalAt）。
  function isSuicide(board, i, j, turn) {
    var b = board.map(function (row) { return row.slice() })
    b[j][i] = turn
    return group(b, i, j).libs.length === 0
  }

  // 候选：紧贴棋子（切比雪夫 ≤2）的合法点，按邻子密度降序；空盘给天元。
  // 性能（2026-10-23）：
  //  ① 先收集「贴子空点」再逐点 legalAt —— 原实现调 moves() 扫全盘（19 路 361 点 × 两次整盘复制）；
  //  ② 候选数封顶（CAND_CAP）：19 路中盘实测有 203 个合法候选，搜索每层都铺开的话
  //     深度 2 要 200+ 次候选生成；封顶后分支可控、α-β 才有意义。
  //     排序已按「邻子密度」降序，掐尾只丢离战场最远的点 —— 与参考项目「只看最近若干子的附近」同效，
  //     但排序更稳（不留「最近一手附近的差着」）。规则合法性不受影响（moves() 仍是全量）。
  var CAND_CAP = 60
  function candidates(board, turn) {
    var seen = {}
    var pts = []
    var any = false
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        if (board[j][i] === 0) continue
        any = true
        for (var dj = -2; dj <= 2; dj++) {
          for (var di = -2; di <= 2; di++) {
            var ni = i + di
            var nj = j + dj
            if (ni < 0 || ni >= cols || nj < 0 || nj >= rows) continue
            if (board[nj][ni] !== 0) continue
            var key = nj * cols + ni
            if (!seen[key]) {
              seen[key] = true
              pts.push({ i: ni, j: nj })
            }
          }
        }
      }
    }
    if (!any) {
      return [{ i: (cols - 1) / 2, j: (rows - 1) / 2 }]
    }
    var out = []
    for (var f = 0; f < pts.length; f++) {
      if (legalAt(board, pts[f].i, pts[f].j, turn)) {
        pts[f].s = adjCount(board, pts[f])
        out.push(pts[f])
      }
    }
    out.sort(function (a, b) { return b.s - a.s })
    if (out.length > CAND_CAP) out = out.slice(0, CAND_CAP)
    // 兜底：候选全被自杀/劫点滤掉时，退回全量合法点（保证搜索永远有着法）
    if (!out.length) out = moves(board, turn)
    return out
  }

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

  // 输入：board、move（含 {pass:true}）、turn；输出：新棋盘（停一手返回原盘拷贝）。
  function apply(board, move, turn) {
    var b = board.map(function (row) { return row.slice() })
    if (move.pass) return b
    b[move.j][move.i] = turn
    var opp = 3 - turn
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (var d = 0; d < 4; d++) {
      var x = move.i + dirs[d][0]
      var y = move.j + dirs[d][1]
      if (x < 0 || x >= cols || y < 0 || y >= rows) continue
      if (b[y][x] !== opp) continue
      var g = group(b, x, y)
      if (g.libs.length === 0) {
        for (var s = 0; s < g.stones.length; s++) {
          b[g.stones[s][1]][g.stones[s][0]] = 0
        }
      }
    }
    return b
  }

  // 输入：提子后的新盘、最后一手、提子数；输出：简单劫点或 null（页面回写到实例）。
  function koAfter(board, move, turn, captured) {
    if (captured !== 1) return null
    var g = group(board, move.i, move.j)
    if (g.stones.length === 1 && g.libs.length === 1) {
      return { i: g.libs[0][0], j: g.libs[0][1] }
    }
    return null
  }

  // 围棋不由 check 直接判胜负；终局（双停一手/双方无合法点）由页面调用 score。
  function check(board, lastMove) {
    return null
  }

  // 输入：终局棋盘；输出：中国规则数子结果（白贴 6.5）。
  // 领地 = 仅与单色相邻的空域；双方皆邻的空域（单官/争议）不计。
  function score(board) {
    var black = 0
    var white = 0
    var seen = {}
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var v = board[j][i]
        if (v === 1) black++
        else if (v === 2) white++
      }
    }
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (board[y][x] !== 0 || seen[y * cols + x]) continue
        // 洪泛收集空域及其边界颜色
        var region = []
        var stack = [[x, y]]
        seen[y * cols + x] = true
        var touchBlack = false
        var touchWhite = false
        while (stack.length) {
          var cur = stack.pop()
          region.push(cur)
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          for (var d = 0; d < 4; d++) {
            var nx = cur[0] + dirs[d][0]
            var ny = cur[1] + dirs[d][1]
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
            var nv = board[ny][nx]
            if (nv === 1) touchBlack = true
            else if (nv === 2) touchWhite = true
            else if (!seen[ny * cols + nx]) {
              seen[ny * cols + nx] = true
              stack.push([nx, ny])
            }
          }
        }
        if (touchBlack && !touchWhite) black += region.length
        else if (touchWhite && !touchBlack) white += region.length
      }
    }
    var wTotal = white + KOMI
    if (black === wTotal) {
      return { result: 'draw', black: black, white: wTotal, reason: '数子持平 黑' + black + ' 白' + wTotal }
    }
    return {
      result: 'win',
      winner: black > wTotal ? 1 : 2,
      black: black,
      white: wTotal,
      reason: '数子 黑' + black + ' : 白' + wTotal + '（含贴目）'
    }
  }

  // 输入：board、turn；输出：turn 视角评估（子+围空差，忽略贴目，供搜索用）。
  function evaluate(board, turn) {
    var me = turn
    var opp = 3 - turn
    var mine = 0
    var theirs = 0
    var seen = {}
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var v = board[j][i]
        if (v === me) mine++
        else if (v === opp) theirs++
      }
    }
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        if (board[y][x] !== 0 || seen[y * cols + x]) continue
        var region = []
        var stack = [[x, y]]
        seen[y * cols + x] = true
        var tb = false
        var tw = false
        while (stack.length) {
          var cur = stack.pop()
          region.push(cur)
          var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          for (var d = 0; d < 4; d++) {
            var nx = cur[0] + dirs[d][0]
            var ny = cur[1] + dirs[d][1]
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
            var nv = board[ny][nx]
            if (nv === 1) tb = true
            else if (nv === 2) tw = true
            else if (!seen[ny * cols + nx]) {
              seen[ny * cols + nx] = true
              stack.push([nx, ny])
            }
          }
        }
        if (tb && !tw) mine += region.length
        else if (tw && !tb) theirs += region.length
      }
    }
    return mine - theirs
  }

  return {
    COLS: cols,
    ROWS: rows,
    STARS: stars(),
    MATCH_BY_COLUMN: false,
    PASS_OK: true,
    KOMI: KOMI,
    // check() 恒为 null（围棋没有「一手致胜」），故 AI 不需要在每个叶子做
    // 「立即取胜」静态延伸 —— 那是每叶一次候选集生成（19 路实测 2.6ms/次）的纯浪费。
    NO_STATIC_WIN: true,
    // 候选封顶 60、无静态延伸：hard 上限 6 层，预算 500ms 兜底
    DEPTH: { easy: 1, normal: 3, hard: 6 },
    // 输入：劫点 {i,j} 或 null；输出：无。页面每手后经 koAfter 计算并回写。
    setKo: function (p) { state.ko = p },
    init: init,
    moves: moves,
    candidates: candidates,
    apply: apply,
    check: check,
    evaluate: evaluate,
    captures: captures,
    koAfter: koAfter,
    score: score
  }
}

module.exports = { create: create }
