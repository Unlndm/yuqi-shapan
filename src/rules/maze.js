/**
 * rules/maze.js — 迷宫探险纯规则引擎。
 * 范式与 rules/sokoban.js / rules/minesweeper.js 一致：关卡是纯字符数据，状态是纯数据，
 *   move(state, dir) 返回新状态、不改动传入对象；node 可直接测。
 *
 * 关卡字符（每行一个字符串，所有行长度必须一致）：
 *   '#' 墙   ' ' / '.' 地面   'P' 玩家起点   'E' 出口
 *   'K' 钥匙  'G' 宝石   'T' 陷阱   'H' 药水
 *
 * 规则口径：
 *   · 玩家四方向移动（up/down/left/right，也接受 u/d/l/r），不能穿墙、不能越界。
 *   · 钥匙必须全部集齐才能进入出口；未集齐时踩出口被挡下（不消耗步数）。
 *   · 宝石每个 +10 分；陷阱每个**只触发一次**并扣 1 HP；药水回 1 HP（不超过上限）。
 *   · HP 归零 → 失败；进入出口 → 过关，两者互斥。
 *   · 雾只影响页面显示；规则侧只维护 visited（走过的格子），起点默认已访问。
 *   · 不做实时敌人/AI 追击（避免未验证的追击逻辑）。
 *
 * 状态（纯数据）：
 *   { id, name, width, height, rows,
 *     walls, keys, gems, traps, potions, exit, player, visited,
 *     totalKeys, collectedKeys, totalGems, collectedGems, score,
 *     hp, maxHp, moves, over, win, dead }
 *   所有布尔数组长度均为 width×height，索引 = 行×width + 列。
 */

var WALL = '#'
var FLOOR = ' '
var START = 'P'
var EXIT = 'E'
var KEY = 'K'
var GEM = 'G'
var TRAP = 'T'
var POTION = 'H'

var GEM_SCORE = 10
var DEFAULT_HP = 3
var MAX_KEYS = 4   // 洪泛验证的钥匙掩码上限（2^4）

var DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
}

// 输入：方向别名；输出：标准方向名（非法值返回空串）。
function normDir(dir) {
  if (dir === 'up' || dir === 'u' || dir === 'U') return 'up'
  if (dir === 'down' || dir === 'd' || dir === 'D') return 'down'
  if (dir === 'left' || dir === 'l' || dir === 'L') return 'left'
  if (dir === 'right' || dir === 'r' || dir === 'R') return 'right'
  return ''
}

// 输入：任意值；输出：是否为有限数字。
function isNum(v) {
  return typeof v === 'number' && isFinite(v)
}

// 输入：关卡（字符串数组 / 多行字符串 / { map }）；输出：行数组或 null。
function rowsOf(level) {
  var rows = level
  if (level && typeof level === 'object' && !isNum(level.length)) rows = level.map
  if (typeof rows === 'string') rows = rows.split(/\r?\n/)
  if (!rows || !isNum(rows.length) || rows.length === 0) return null
  var out = []
  for (var i = 0; i < rows.length; i++) {
    if (typeof rows[i] !== 'string') return null
    out.push(rows[i])
  }
  return out
}

// 输入：任意值、兜底值；输出：合法正整数。
function posInt(v, def) {
  if (!isNum(v)) return def
  var n = Math.floor(v)
  return n >= 1 ? n : def
}

// 输入：关卡、可选参数；输出：全新状态；格式非法返回 null。
// 校验：行等宽、恰有 1 个 P / 1 个 E、至少 1 把钥匙、字符都在白名单内。
function parse(level, opts) {
  var rows = rowsOf(level)
  if (!rows) return null
  var height = rows.length
  var width = rows[0].length
  if (width <= 0) return null
  var total = width * height
  var walls = []
  var keys = []
  var gems = []
  var traps = []
  var potions = []
  var visited = []
  var player = -1
  var exit = -1
  var keyCount = 0
  var gemCount = 0
  for (var i = 0; i < total; i++) {
    walls.push(false)
    keys.push(false)
    gems.push(false)
    traps.push(false)
    potions.push(false)
    visited.push(false)
  }
  var y
  for (y = 0; y < height; y++) {
    if (rows[y].length !== width) return null
    for (var x = 0; x < width; x++) {
      var ch = rows[y].charAt(x)
      var at = y * width + x
      if (ch === WALL) { walls[at] = true; continue }
      if (ch === ' ' || ch === '.') continue
      if (ch === START) {
        if (player >= 0) return null
        player = at
        continue
      }
      if (ch === EXIT) {
        if (exit >= 0) return null
        exit = at
        continue
      }
      if (ch === KEY) { keys[at] = true; keyCount++; continue }
      if (ch === GEM) { gems[at] = true; gemCount++; continue }
      if (ch === TRAP) { traps[at] = true; continue }
      if (ch === POTION) { potions[at] = true; continue }
      return null
    }
  }
  if (player < 0 || exit < 0 || keyCount < 1) return null
  visited[player] = true
  var levelHp = level && isNum(level.hp) ? level.hp : (opts && isNum(opts.hp) ? opts.hp : DEFAULT_HP)
  var maxHp = posInt(levelHp, DEFAULT_HP)
  return {
    id: level && isNum(level.id) ? Math.floor(level.id) : (opts && isNum(opts.id) ? Math.floor(opts.id) : 0),
    name: level && typeof level.name === 'string' ? level.name : (opts && typeof opts.name === 'string' ? opts.name : ''),
    width: width,
    height: height,
    rows: rows.slice(),
    walls: walls,
    keys: keys,
    gems: gems,
    traps: traps,
    potions: potions,
    exit: exit,
    player: player,
    visited: visited,
    totalKeys: keyCount,
    collectedKeys: 0,
    totalGems: gemCount,
    collectedGems: 0,
    score: 0,
    hp: maxHp,
    maxHp: maxHp,
    moves: 0,
    over: false,
    win: false,
    dead: false
  }
}

// 输入：状态；输出：深拷贝（页面历史栈 / 纯函数返回用）。
function clone(state) {
  if (!state || typeof state !== 'object') return null
  var st = {
    id: isNum(state.id) ? state.id : 0,
    name: typeof state.name === 'string' ? state.name : '',
    width: posInt(state.width, 0),
    height: posInt(state.height, 0),
    rows: state.rows ? state.rows.slice() : [],
    walls: state.walls ? state.walls.slice() : [],
    keys: state.keys ? state.keys.slice() : [],
    gems: state.gems ? state.gems.slice() : [],
    traps: state.traps ? state.traps.slice() : [],
    potions: state.potions ? state.potions.slice() : [],
    exit: isNum(state.exit) ? Math.floor(state.exit) : -1,
    player: isNum(state.player) ? Math.floor(state.player) : -1,
    visited: state.visited ? state.visited.slice() : [],
    totalKeys: isNum(state.totalKeys) ? Math.floor(state.totalKeys) : 0,
    collectedKeys: isNum(state.collectedKeys) ? Math.floor(state.collectedKeys) : 0,
    totalGems: isNum(state.totalGems) ? Math.floor(state.totalGems) : 0,
    collectedGems: isNum(state.collectedGems) ? Math.floor(state.collectedGems) : 0,
    score: isNum(state.score) ? state.score : 0,
    hp: isNum(state.hp) ? Math.floor(state.hp) : 0,
    maxHp: posInt(state.maxHp, DEFAULT_HP),
    moves: isNum(state.moves) ? Math.floor(state.moves) : 0,
    over: !!state.over,
    win: !!state.win,
    dead: !!state.dead
  }
  return st
}

// 输入：状态、方向；输出：{ state, moved, blocked, invalid, event, events, win, over }。
// 撞墙/越界/钥匙未集齐踩出口 → moved=false、状态为副本；终局后调用 → invalid=true。
function move(state, dir) {
  var st = clone(state)
  if (!st) return { state: null, moved: false, blocked: false, invalid: true, event: '', events: [], win: false, over: false }
  if (st.over || st.win) {
    return { state: st, moved: false, blocked: false, invalid: true, event: '', events: [], win: st.win, over: st.over }
  }
  var d = normDir(dir)
  if (!d) return { state: st, moved: false, blocked: false, invalid: true, event: '', events: [], win: false, over: false }
  var total = st.width * st.height
  if (st.player < 0 || st.player >= total) {
    return { state: st, moved: false, blocked: false, invalid: true, event: '', events: [], win: false, over: false }
  }
  var delta = DIRS[d]
  var px = st.player % st.width
  var py = Math.floor(st.player / st.width)
  var tx = px + delta.dx
  var ty = py + delta.dy
  if (tx < 0 || tx >= st.width || ty < 0 || ty >= st.height) {
    return { state: st, moved: false, blocked: true, invalid: false, event: 'edge', events: [], win: false, over: false }
  }
  var target = ty * st.width + tx
  if (st.walls[target]) {
    return { state: st, moved: false, blocked: true, invalid: false, event: 'wall', events: [], win: false, over: false }
  }
  // 出口：钥匙未集齐 → 挡在门外，不消耗步数。
  if (target === st.exit && st.collectedKeys < st.totalKeys) {
    return { state: st, moved: false, blocked: true, invalid: false, event: 'locked', events: [], win: false, over: false }
  }

  var events = []
  st.player = target
  st.visited[target] = true
  st.moves++

  if (st.traps[target]) {
    st.traps[target] = false          // 陷阱只触发一次
    st.hp--
    events.push('trap')
    if (st.hp <= 0) {
      st.hp = 0
      st.over = true
      st.dead = true
      st.win = false
    }
  }
  if (!st.over && st.potions[target]) {
    st.potions[target] = false
    st.hp = Math.min(st.maxHp, st.hp + 1)
    events.push('potion')
  }
  if (!st.over && st.keys[target]) {
    st.keys[target] = false
    st.collectedKeys++
    events.push('key')
    if (st.collectedKeys >= st.totalKeys) events.push('keysAll')
  }
  if (!st.over && st.gems[target]) {
    st.gems[target] = false
    st.collectedGems++
    st.score += GEM_SCORE
    events.push('gem')
  }
  if (!st.over && target === st.exit) {
    st.win = true
    st.over = true
    events.push('exit')
  }
  return {
    state: st, moved: true, blocked: false, invalid: false,
    event: events.length ? events[0] : 'floor',
    events: events, win: st.win, over: st.over
  }
}

// 输入：状态；输出：重置后的全新状态（同一关卡、HP/分数/visited 全部复位）。
function reset(state) {
  var st = clone(state)
  if (!st || !st.rows || !st.rows.length) return null
  return parse({ id: st.id, name: st.name, map: st.rows, hp: st.maxHp })
}

// 输入：state；输出：null（进行中）或 { result, reason }。
function check(state) {
  if (!state || !state.over) return null
  if (state.win) return { result: 'win', reason: '到达出口' }
  if (state.dead) return { result: 'lose', reason: '生命耗尽' }
  return null
}

// 输入：状态、下标；输出：该格在当前状态下的符号（供页面/测试查看，不参与规则）。
function symbolAt(state, idx) {
  if (!state || !isNum(idx)) return ''
  var i = Math.floor(idx)
  if (i < 0 || i >= state.width * state.height) return ''
  if (state.walls[i]) return WALL
  if (i === state.player) return START
  if (i === state.exit) return EXIT
  if (state.keys[i]) return KEY
  if (state.gems[i]) return GEM
  if (state.traps[i]) return TRAP
  if (state.potions[i]) return POTION
  return FLOOR
}

// 输入：关卡、可选参数；输出：{ ok, errors, ... }。用洪泛验证可解性。
//   · 忽略陷阱（陷阱不挡路）时，钥匙/宝石/出口都必须从起点可达；
//   · 必须存在一条**完全不踩陷阱**的路线：起点 → 集齐所有钥匙 → 出口。
//     用「位置 × 钥匙掩码」的 BFS 精确验证，钥匙数上限 MAX_KEYS。
function analyze(level, opts) {
  var st = parse(level, opts)
  if (!st) return { ok: false, errors: ['关卡格式非法'], reachable: 0 }
  var errors = []
  var total = st.width * st.height
  var reach = []
  for (var i = 0; i < total; i++) reach.push(false)
  var queue = [st.player]
  reach[st.player] = true
  while (queue.length) {
    var cur = queue.shift()
    var cx = cur % st.width
    var cy = Math.floor(cur / st.width)
    for (var name in DIRS) {
      var nx = cx + DIRS[name].dx
      var ny = cy + DIRS[name].dy
      if (nx < 0 || nx >= st.width || ny < 0 || ny >= st.height) continue
      var ni = ny * st.width + nx
      if (st.walls[ni] || reach[ni]) continue
      reach[ni] = true
      queue.push(ni)
    }
  }
  var reachable = 0
  for (var r = 0; r < total; r++) if (reach[r]) reachable++
  for (var k = 0; k < total; k++) if (st.keys[k] && !reach[k]) errors.push('钥匙不可达：' + k)
  for (var gm = 0; gm < total; gm++) if (st.gems[gm] && !reach[gm]) errors.push('宝石不可达：' + gm)
  if (!reach[st.exit]) errors.push('出口不可达')

  var trapFreePath = false
  if (st.totalKeys > MAX_KEYS) {
    errors.push('钥匙超过 ' + MAX_KEYS + ' 把，无法用掩码验证')
  } else {
    var full = (1 << st.totalKeys) - 1
    var keyIdx = []
    for (var kk = 0; kk < total; kk++) if (st.keys[kk]) keyIdx.push(kk)
    var keyBit = function (idx) {
      for (var q = 0; q < keyIdx.length; q++) if (keyIdx[q] === idx) return 1 << q
      return 0
    }
    var masks = full + 1
    var seen = []
    for (var s = 0; s < total * masks; s++) seen.push(false)
    var startMask = keyBit(st.player)
    var q2 = [{ pos: st.player, mask: startMask }]
    seen[st.player * masks + startMask] = true
    while (q2.length) {
      var item = q2.shift()
      if (item.pos === st.exit && item.mask === full) { trapFreePath = true; break }
      var ix = item.pos % st.width
      var iy = Math.floor(item.pos / st.width)
      for (var dn in DIRS) {
        var ax = ix + DIRS[dn].dx
        var ay = iy + DIRS[dn].dy
        if (ax < 0 || ax >= st.width || ay < 0 || ay >= st.height) continue
        var ai = ay * st.width + ax
        if (st.walls[ai] || st.traps[ai]) continue   // 无陷阱路线：陷阱格视为不可走
        var am = item.mask | keyBit(ai)
        var sid = ai * masks + am
        if (seen[sid]) continue
        seen[sid] = true
        q2.push({ pos: ai, mask: am })
      }
    }
    if (!trapFreePath) errors.push('不存在「不踩陷阱集齐钥匙到出口」的通路')
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    reachable: reachable,
    total: total,
    keyCount: st.totalKeys,
    gemCount: st.totalGems,
    trapFreePath: trapFreePath
  }
}

// 输入：可选关卡（实例化时固定）；输出：实例，便于页面按关卡反复重置/移动。
function create(level, opts) {
  function start() {
    return parse(level, opts)
  }
  function instReset(state) {
    return reset(state)
  }
  return {
    DIRS: DIRS,
    GEM_SCORE: GEM_SCORE,
    DEFAULT_HP: DEFAULT_HP,
    start: start,
    parse: parse,
    move: move,
    reset: instReset,
    clone: clone,
    check: check,
    analyze: analyze,
    symbolAt: symbolAt
  }
}

module.exports = {
  create: create,
  parse: parse,
  move: move,
  reset: reset,
  clone: clone,
  check: check,
  analyze: analyze,
  validate: analyze,
  symbolAt: symbolAt,
  DIRS: DIRS,
  GEM_SCORE: GEM_SCORE,
  DEFAULT_HP: DEFAULT_HP,
  WALL: WALL,
  FLOOR: FLOOR,
  START: START,
  EXIT: EXIT,
  KEY: KEY,
  GEM: GEM,
  TRAP: TRAP,
  POTION: POTION
}
