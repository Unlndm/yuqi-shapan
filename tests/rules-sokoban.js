/**
 * tests/rules-sokoban.js — 推箱子规则与 20 关数据测试。
 * 关卡数据由离线脚本「反向拉箱生成 + BFS 求最短解」产出，solution 为该关最短步数解；
 * 本测试逐关回放 solution，验证可解、步数/推动数、通关判定与尺寸。
 * 运行：node tests/rules-sokoban.js
 */

var sokoban = require('../src/rules/sokoban.js')
var levels = require('../src/rules/sokoban-levels.js')
var h = require('./helper.js')

var BASIC = [
  '#######',
  '#  .  #',
  '#  $  #',
  '#  @  #',
  '#######'
]

var BLOCKED = [
  '#######',
  '# .   #',
  '#  #  #',
  '#  $  #',
  '#  @  #',
  '#######'
]

var DOUBLE = [
  '########',
  '#      #',
  '#      #',
  '# $$@  #',
  '# ..   #',
  '########'
]

// 测试辅助：回放解法（u/d/l/r 或 up/down/left/right）。
function apply(level, solution) {
  var st = sokoban.parse(level)
  if (!st) return null
  for (var i = 0; i < solution.length; i++) {
    var r = sokoban.move(st, solution.charAt(i))
    if (!r.moved) return null
    st = r.state
  }
  return st
}

// 测试辅助：统计状态里的箱子/目标数量。
function countOf(arr) {
  var n = 0
  for (var i = 0; i < arr.length; i++) if (arr[i]) n++
  return n
}

// ── 解析 ────────────────────────────────────────────────────────────
h.suite('sokoban/解析')
var st = sokoban.parse(BASIC)
h.ok('合法关卡可解析', !!st)
h.eq('尺寸 7×5', [st.width, st.height], [7, 5])
h.eq('人位于第 3 行第 3 列（下标 24）', st.player, 24)
h.eq('1 个箱子 / 1 个目标', [countOf(st.boxes), countOf(st.goals)], [1, 1])
h.eq('箱子在 17、目标在 10', [st.boxes[17], st.goals[10]], [true, true])
h.eq('初始步数/推动数/未通关', [st.moves, st.pushes, st.solved], [0, 0, false])
h.eq('初始状态未被直接判定通关', sokoban.isSolved(st), false)

var fromString = sokoban.parse('#####\n#@$.#\n#####')
h.ok('字符串关卡（按换行拆分）可解析', !!fromString)
h.eq('字符串关卡尺寸 5×3', [fromString.width, fromString.height], [5, 3])
h.eq('字符串关卡人/箱/目标', [fromString.player, fromString.boxes[7], fromString.goals[8]], [6, true, true])

var solvedStart = sokoban.parse([
  '#######',
  '#  *  #',
  '#  @  #',
  '#######'
])
h.eq('箱子已在目标上的开局判定为通关', solvedStart.solved, true)
h.eq('isSolved 对已通关状态返回 true', sokoban.isSolved(solvedStart), true)

h.eq('行长度不一致 → null', sokoban.parse(['###', '##']), null)
h.eq('未知字符 → null', sokoban.parse(['#####', '#X$@#', '#####']), null)
h.eq('没有玩家 → null', sokoban.parse(['#####', '# $.#', '#####']), null)
h.eq('多个玩家 → null', sokoban.parse(['#######', '#@ $@.#', '#######']), null)
h.eq('箱子数与目标数不等 → null', sokoban.parse(['#######', '#@ $..#', '#######']), null)
h.eq('空数组 → null', sokoban.parse([]), null)
h.eq('非字符串行 → null', sokoban.parse([['###'], ['#@#']]), null)
h.eq('null → null', sokoban.parse(null), null)

// ── 推箱 / 走路 / 阻挡 ──────────────────────────────────────────────
h.suite('sokoban/推箱与阻挡')
var pushed = sokoban.move(st, 'up')
h.eq('向上推动箱子：moved / pushed', [pushed.moved, pushed.pushed], [true, true])
h.eq('推后人在 17、箱子在目标 10', [pushed.state.player, pushed.state.boxes[10]], [17, true])
h.eq('推后步数 1 / 推动数 1', [pushed.state.moves, pushed.state.pushes], [1, 1])
h.eq('推后通关', [pushed.state.solved, sokoban.isSolved(pushed.state)], [true, true])
h.eq('推动不改变传入状态（人在 24、箱在 17）', [st.player, st.boxes[17]], [24, true])

var walked = sokoban.move(st, 'left')
h.eq('向左走路：moved=true / pushed=false', [walked.moved, walked.pushed], [true, false])
h.eq('走路后步数 1 / 推动数 0', [walked.state.moves, walked.state.pushes], [1, 0])
h.eq('走路后未通关', walked.state.solved, false)

var blockedByWall = sokoban.parse(BLOCKED)
var blockPush = sokoban.move(blockedByWall, 'up')
h.eq('箱子背后是墙 → 推不动', [blockPush.moved, blockPush.pushed], [false, false])
h.eq('推不动时箱子/人/计数不变', [blockPush.state.boxes[24], blockPush.state.player, blockPush.state.moves], [true, 31, 0])
h.eq('人向下撞外墙 → 不动', sokoban.move(blockedByWall, 'down').moved, false)

var doubleSt = sokoban.parse(DOUBLE)
var twoBoxes = sokoban.move(doubleSt, 'left')
h.eq('两个箱子相邻时不能一次推两个', [twoBoxes.moved, twoBoxes.pushed], [false, false])
h.eq('双箱阻挡后箱子位置不变', [doubleSt.boxes[26], doubleSt.boxes[27]], [true, true])
h.eq('方向别名 u/d/l/r 与单词等价', [
  sokoban.move(st, 'u').moved,
  sokoban.move(st, 'up').moved
], [true, true])
h.eq('非法方向 → moved=false', sokoban.move(st, 'diagonal').moved, false)
h.eq('null 状态 → 安全返回 null 且不崩', sokoban.move(null, 'up').state, null)

// ── 快照 / 撤销 ─────────────────────────────────────────────────────
h.suite('sokoban/快照与撤销')
var snapshot = sokoban.clone(pushed.state)
h.eq('快照保留通关状态与计数', [snapshot.solved, snapshot.moves, snapshot.pushes], [true, 1, 1])
h.ok('快照与状态不是同一对象', snapshot !== pushed.state)
h.ok('快照数组是深拷贝', snapshot.boxes !== pushed.state.boxes)
var afterDown = sokoban.move(pushed.state, 'down')
h.eq('从通关态继续走一步：步数 2', [afterDown.state.moves, afterDown.state.player], [2, 24])
var restored = sokoban.clone(snapshot)
h.eq('恢复快照：人回到 17、步数回到 1', [restored.player, restored.moves], [17, 1])
h.eq('恢复快照：仍然通关', restored.solved, true)
restored.boxes[10] = false
h.eq('恢复后改数组不影响原快照', snapshot.boxes[10], true)
h.eq('counts 读取步数/推动数', sokoban.counts(pushed.state), { moves: 1, pushes: 1 })
h.eq('counts 对 null 兜底 0', sokoban.counts(null), { moves: 0, pushes: 0 })

// ── 20 关数据 ───────────────────────────────────────────────────────
h.suite('sokoban/20 关数据')
h.eq('关卡总数 20', levels.COUNT, 20)
h.eq('LEVELS 长度 20', levels.LEVELS.length, 20)
var idOk = true
var sizeOk = true
var startsUnsolved = true
var allSolved = true
var metaOk = true
var parseOk = true
var countOk = true
var uniqueOk = true
var seen = {}
for (var i = 0; i < levels.LEVELS.length; i++) {
  var lv = levels.LEVELS[i]
  if (lv.id !== i + 1) idOk = false
  var key = lv.map.join('\n')
  if (seen[key]) uniqueOk = false
  seen[key] = true
  var start = sokoban.parse(lv.map)
  if (!start) { parseOk = false; continue }
  if (start.width > 10 || start.height > 10) sizeOk = false
  if (start.solved) startsUnsolved = false
  if (start.moves !== 0 || start.pushes !== 0) countOk = false
  var end = apply(lv.map, lv.solution)
  if (!end || !end.solved) { allSolved = false; continue }
  if (end.moves !== lv.moves || end.pushes !== lv.pushes) metaOk = false
  if (lv.solution.length === 0) metaOk = false
}
h.ok('关卡 id 为 1~20 连续', idOk)
h.ok('全部关卡解析成功', parseOk)
h.ok('全部关卡尺寸 ≤ 10×10', sizeOk)
h.ok('全部关卡初始未通关', startsUnsolved)
h.ok('全部关卡初始步数/推动数为 0', countOk)
h.ok('20 关 solution 全部可回放并通关', allSolved)
h.ok('20 关 moves/pushes 与 solution 回放一致', metaOk)
h.ok('20 关地图互不重复', uniqueOk)
h.ok('每关至少 1 个箱子且箱子数=目标数', (function () {
  for (var j = 0; j < levels.LEVELS.length; j++) {
    var s = sokoban.parse(levels.LEVELS[j].map)
    if (!s) return false
    if (countOf(s.boxes) < 1 || countOf(s.boxes) !== countOf(s.goals)) return false
  }
  return true
})())
h.eq('第 1 关最短解 6 步 / 4 推', [levels.LEVELS[0].moves, levels.LEVELS[0].pushes], [6, 4])
h.eq('第 20 关最短解 25 步 / 9 推', [levels.LEVELS[19].moves, levels.LEVELS[19].pushes], [25, 9])

process.exit(h.summary())
