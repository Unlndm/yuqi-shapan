/**
 * tests/rules-maze.js — 迷宫探险规则测试。
 * 关卡全部为内置 20 关 + 少量手写小关卡（验证钥匙门 / 宝石 / 陷阱 / 药水 / 重置）。
 * 运行：node tests/rules-maze.js
 */

var maze = require('../src/rules/maze.js')
var levels = require('../src/rules/maze-levels.js')
var h = require('./helper.js')

// 测试辅助：手写小关卡（等宽字符，见 rules/maze.js 顶部字符表）。
function lv(map, hp) {
  return maze.parse({ name: 'test', map: map, hp: hp })
}

// ── 关卡数据 ────────────────────────────────────────────────────────
h.suite('maze/关卡数据')
h.eq('共 25 关', levels.LEVELS.length, 25)
h.ok('关卡号 1~25 连续', (function () {
  for (var i = 0; i < levels.LEVELS.length; i++) if (levels.LEVELS[i].id !== i + 1) return false
  return true
})())
h.eq('get(1) 取到第 1 关', levels.get(1).id, 1)
h.eq('get(25) 取到第 25 关', levels.get(25).id, 25)
h.eq('get(26) 返回 null', levels.get(26), null)
h.eq('尺寸递增：9 / 11 / 13 / 15',
  [levels.LEVELS[0].size, levels.LEVELS[5].size, levels.LEVELS[10].size, levels.LEVELS[15].size],
  [9, 11, 13, 15])
h.ok('每关都是正方形且行等宽', levels.LEVELS.every(function (l) {
  if (l.size !== l.map.length) return false
  return l.map.every(function (row) { return row.length === l.size })
}))

// ── 20 关全部可解（洪泛验证） ───────────────────────────────────────
h.suite('maze/20 关可解')
var allOk = true
var allTrapFree = true
var allReach = true
for (var li = 0; li < levels.LEVELS.length; li++) {
  var rep = maze.analyze(levels.LEVELS[li])
  if (!rep.ok) { allOk = false; console.log('  level ' + (li + 1) + ' errors: ' + rep.errors.join(' / ')) }
  if (!rep.trapFreePath) allTrapFree = false
  var st = maze.parse(levels.LEVELS[li])
  var walls = 0
  for (var wi = 0; wi < st.walls.length; wi++) if (st.walls[wi]) walls++
  if (rep.reachable !== st.width * st.height - walls) allReach = false
}
h.ok('20 关全部通过洪泛校验', allOk)
h.ok('20 关都存在「不踩陷阱集齐钥匙到出口」的通路', allTrapFree)
h.ok('20 关的非墙格全部可达', allReach)
h.eq('第 1 关钥匙 1 把', maze.analyze(levels.LEVELS[0]).keyCount, 1)
h.eq('第 20 关钥匙 3 把', maze.analyze(levels.LEVELS[19]).keyCount, 3)

// ── 解析与初始状态 ──────────────────────────────────────────────────
h.suite('maze/初始状态')
var s0 = maze.parse(levels.get(1))
h.eq('起点为 P', maze.symbolAt(s0, s0.player), 'P')
h.eq('出口已记录', maze.symbolAt(s0, s0.exit), 'E')
h.eq('初始 HP = 3', [s0.hp, s0.maxHp], [3, 3])
h.eq('初始分数 / 步数', [s0.score, s0.moves], [0, 0])
h.eq('初始未集钥匙 / 未终局', [s0.collectedKeys, s0.over, s0.win], [0, false, false])
h.eq('起点默认已访问', s0.visited[s0.player], true)
h.eq('未走过的格子不在 visited', s0.visited.filter(Boolean).length, 1)
h.eq('visited 长度 = width×height', s0.visited.length, s0.width * s0.height)

// 负例：格式非法一律 null
h.eq('缺少玩家 → null', maze.parse(['#####', '# K #', '# E #', '#####']), null)
h.eq('缺少出口 → null', maze.parse(['#####', '# P #', '# K #', '#####']), null)
h.eq('缺少钥匙 → null', maze.parse(['#####', '# P #', '# E #', '#####']), null)
h.eq('重复玩家 → null', maze.parse(['#####', '#PP #', '#KE #', '#####']), null)
h.eq('行不等宽 → null', maze.parse(['#####', '#P #', '#KE #', '####']), null)
h.eq('未知字符 → null', maze.parse(['#####', '#PZ #', '#KE #', '#####']), null)
h.eq('空关卡 → null', maze.parse([]), null)

// ── 移动 / 墙 / 越界 ────────────────────────────────────────────────
h.suite('maze/移动与碰撞')
var room = lv([
  '#####',
  '#P  #',
  '# K #',
  '#E  #',
  '#####'
])
var up = maze.move(room, 'up')
h.eq('上方是墙 → 挡下', [up.moved, up.blocked, up.event], [false, true, 'wall'])
var left = maze.move(room, 'l')
h.eq('左侧是墙 → 挡下', [left.moved, left.blocked], [false, true])
var right = maze.move(room, 'right')
h.eq('向右移动成功', [right.moved, right.event], [true, 'floor'])
h.eq('移动后玩家新位置 / 步数', [right.state.player, right.state.moves], [7, 1])
h.eq('走过格记为 visited', right.state.visited[7], true)
var badDir = maze.move(room, 'jump')
h.eq('非法方向 → invalid', badDir.invalid, true)

// 边界：起点在左上角（无外墙贴边），向上/向左都会越界
var corner = lv([
  'P   E',
  '  K  ',
  '     '
])
h.eq('左上角向上越界 → edge', maze.move(corner, 'up').event, 'edge')
h.eq('左上角向左越界 → edge', maze.move(corner, 'left').event, 'edge')

// ── 钥匙门 ──────────────────────────────────────────────────────────
h.suite('maze/钥匙门')
var door = lv([
  '#######',
  '#P E  #',
  '#  K  #',
  '#######'
])
var d1 = maze.move(door, 'right')
var d2 = maze.move(d1.state, 'right')
h.eq('未集钥匙踩出口 → 被挡', [d2.moved, d2.blocked, d2.event], [false, true, 'locked'])
h.eq('被挡不消耗步数 / 不移动', [d2.state.moves, d2.state.player], [1, 9])
h.eq('被挡后未过关', d2.state.win, false)

var k1 = maze.move(maze.move(d2.state, 'down').state, 'right')
h.eq('吃到钥匙 → collectedKeys=1', [k1.event, k1.state.collectedKeys], ['key', 1])
h.eq('钥匙格被清空', k1.state.keys[k1.state.player], false)
h.ok('集齐钥匙有 keysAll 事件', k1.events.indexOf('keysAll') >= 0)
var k2 = maze.move(k1.state, 'up')
h.eq('集齐钥匙后可进出口 → 过关', [k2.win, k2.state.win, k2.state.over], [true, true, true])
h.eq('过关后 check 报胜', maze.check(k2.state).result, 'win')
h.eq('过关后继续移动 → invalid', maze.move(k2.state, 'down').invalid, true)

// 重复踩钥匙格不会重复计数
var once = maze.move(k1.state, 'left')
h.eq('离开钥匙格后 collectedKeys 仍为 1', once.state.collectedKeys, 1)

// 多钥匙关卡：只集 1 把仍不能出口
var twoKeys = lv([
  '#######',
  '#P E  #',
  '# K   #',
  '#  K  #',
  '#######'
])
var tk1 = maze.move(twoKeys, 'right')
var tk2 = maze.move(tk1.state, 'down')
h.eq('两钥匙关卡：先拿到第 1 把', [tk2.event, tk2.state.collectedKeys, tk2.state.totalKeys], ['key', 1, 2])
var tk3 = maze.move(maze.move(tk2.state, 'right').state, 'up')
h.eq('两钥匙关卡：只集 1 把时出口仍锁住', [tk3.blocked, tk3.event, tk3.state.win], [true, 'locked', false])

// ── 宝石计分 ────────────────────────────────────────────────────────
h.suite('maze/宝石')
var gemRoom = lv([
  '######',
  '#P G #',
  '#  KE#',
  '######'
])
var gm = maze.move(gemRoom, 'right')
var gm2 = maze.move(gm.state, 'right')
h.eq('吃到宝石 → 分数 +10', [gm2.event, gm2.state.score, gm2.state.collectedGems], ['gem', 10, 1])
h.eq('宝石格被清空', gm2.state.gems[gm2.state.player], false)
h.eq('再踩宝石格不重复计分', maze.move(maze.move(gm2.state, 'left').state, 'right').state.score, 10)

// ── 陷阱 / HP / 失败 ────────────────────────────────────────────────
h.suite('maze/陷阱')
var trapRoom = lv([
  '#######',
  '#P T K#',
  '#   E #',
  '#######'
])
var t1 = maze.move(maze.move(trapRoom, 'right').state, 'right')
h.eq('踩陷阱 → HP 3→2', [t1.event, t1.state.hp], ['trap', 2])
h.eq('陷阱只触发一次（标记清除）', t1.state.traps[t1.state.player], false)
var t2 = maze.move(maze.move(t1.state, 'left').state, 'right')
h.eq('再次经过已触发陷阱 → 不再扣血', [t2.state.hp, t2.event], [2, 'floor'])

var near = maze.clone(trapRoom)
near.hp = 1
var dead = maze.move(maze.move(near, 'right').state, 'right')
h.eq('HP=1 踩陷阱 → 0 并失败', [dead.state.hp, dead.state.over, dead.state.dead], [0, true, true])
h.eq('失败后 check 报负', maze.check(dead.state).result, 'lose')
h.eq('失败后移动 → invalid', maze.move(dead.state, 'left').invalid, true)
h.eq('失败后不能过关', dead.state.win, false)

// ── 药水回复 ────────────────────────────────────────────────────────
h.suite('maze/药水')
var pot = lv([
  '#######',
  '#P H K#',
  '#   E #',
  '#######'
])
var p1 = maze.move(maze.move(pot, 'right').state, 'right')
h.eq('满血喝药水 → 仍为 3，药水消耗', [p1.event, p1.state.hp, p1.state.potions[p1.state.player]], ['potion', 3, false])
var hurt = maze.clone(pot)
hurt.hp = 2
var p2 = maze.move(maze.move(hurt, 'right').state, 'right')
h.eq('受伤后喝药水 → 2→3', [p2.event, p2.state.hp], ['potion', 3])

// ── 重置 ────────────────────────────────────────────────────────────
h.suite('maze/重置')
var r0 = maze.parse(levels.get(1))
var r1 = maze.move(r0, 'right').state
var r2 = maze.move(r1, 'down').state
var rr = maze.reset(r2)
h.eq('重置回起点', rr.player, r0.player)
h.eq('重置后 HP / 分数 / 步数复位', [rr.hp, rr.score, rr.moves], [3, 0, 0])
h.eq('重置后只保留起点 visited', rr.visited.filter(Boolean).length, 1)
h.eq('重置后钥匙恢复', rr.keys.filter(Boolean).length, r0.keys.filter(Boolean).length)
h.eq('重置后终局标志清除', [rr.over, rr.win, rr.dead], [false, false, false])
h.ok('重置不改动传入 state', r2.moves > 0 && r2.hp === 3)
var inst = maze.create(levels.get(2))
h.eq('实例 start() 可直接开局', inst.start().id, 2)
h.eq('实例 reset(state) 可复位', inst.reset(r2).id, 1)

// ── 洪泛验证的负例 ──────────────────────────────────────────────────
h.suite('maze/不可解检测')
var unReach = maze.analyze({
  map: [
    '#######',
    '#P E  #',
    '#######',
    '#  K  #',
    '#######'
  ]
})
h.eq('钥匙被墙隔离 → 校验失败', unReach.ok, false)
h.ok('报出钥匙不可达', unReach.errors.some(function (e) { return e.indexOf('钥匙不可达') >= 0 }))
var forcedTrap = maze.analyze({
  map: [
    '########',
    '#P TKE #',
    '########'
  ]
})
h.eq('到钥匙必须踩陷阱 → 校验失败', forcedTrap.ok, false)
h.ok('报出无「不踩陷阱」通路', forcedTrap.errors.some(function (e) { return e.indexOf('不踩陷阱') >= 0 }))
h.eq('忽略陷阱时钥匙本身可达', forcedTrap.reachable > 0, true)

// ── 纯函数 ──────────────────────────────────────────────────────────
h.suite('maze/纯函数')
var keep = maze.parse(levels.get(1))
var beforePlayer = keep.player
var beforeVisited = keep.visited.slice()
var beforeTraps = keep.traps.slice()
var beforeKeys = keep.keys.slice()
var beforeMoves = keep.moves
maze.move(keep, 'right')
maze.move(keep, 'down')
h.eq('move 不改动传入 player / moves', [keep.player, keep.moves], [beforePlayer, beforeMoves])
h.eq('move 不改动传入 visited', keep.visited, beforeVisited)
h.eq('move 不改动传入陷阱/钥匙数组', [keep.traps, keep.keys], [beforeTraps, beforeKeys])

// ── API ─────────────────────────────────────────────────────────────
h.suite('maze/API')
h.ok('模块导出 parse/move/reset/clone/check/analyze/symbolAt',
  ['parse', 'move', 'reset', 'clone', 'check', 'analyze', 'symbolAt'].every(function (k) { return typeof maze[k] === 'function' }))
h.eq('GEM_SCORE = 10', maze.GEM_SCORE, 10)
h.eq('DEFAULT_HP = 3', maze.DEFAULT_HP, 3)

process.exit(h.summary())
