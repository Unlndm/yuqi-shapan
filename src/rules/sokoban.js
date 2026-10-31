/**
 * rules/sokoban.js — 推箱子纯规则引擎。
 * 范式与 rules/g2048.js / rules/slide.js / rules/minesweeper.js 一致：
 *   parse(level) 返回纯数据状态，move(state, dir) 不改动传入对象、返回新状态，
 *   页面把 clone(state) 存进历史栈即可实现撤销。node 可直接测。
 *
 * 关卡字符（每行一个字符串，所有行长度必须一致）：
 *   '#' 墙   ' ' 地   '.' 目标   '$' 箱   '*' 箱在目标
 *   '@' 人   '+' 人在目标
 *
 * 状态（纯数据）：
 *   { width, height, walls, goals, boxes, player, moves, pushes, solved }
 *   walls / goals / boxes —— 长度 width×height 的布尔数组，索引 = 行×width + 列；
 *   player —— 人所在下标；moves —— 成功移动次数；pushes —— 成功推动次数；
 *   solved —— 由 boxes/goals 派生，每次 move 后重算。
 *
 * 口径：
 *   · 人不能走进墙、不能走出边界；箱子不能推出边界/推进墙；
 *   · 箱子后面还有箱子时不能推（一次只能推一个）；
 *   · 方向接受 'up'/'down'/'left'/'right'，也接受单字母 'u'/'d'/'l'/'r'；
 *   · 步数/推动数由状态维护（页面无需另存），撤销时连同快照一起恢复。
 */

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

// 输入：状态、下标；输出：该格是否越界。
function outOf(st, i) {
  return !(i >= 0 && i < st.width * st.height)
}

// 输入：状态、x、y；输出：下标（越界返回 -1）。
function idxOf(st, x, y) {
  if (x < 0 || x >= st.width || y < 0 || y >= st.height) return -1
  return y * st.width + x
}

// 输入：状态、下标；输出：是否为墙（越界也按墙处理）。
function isWall(st, i) {
  return outOf(st, i) || !!st.walls[i]
}

// 输入：状态；输出：是否所有目标都恰好被箱子覆盖（至少一个箱子）。
function solvedOf(st) {
  if (!st || !st.boxes || !st.goals) return false
  var goals = 0
  var boxes = 0
  for (var i = 0; i < st.boxes.length; i++) {
    if (st.goals[i]) goals++
    if (st.boxes[i]) {
      boxes++
      if (!st.goals[i]) return false
    }
  }
  return boxes > 0 && boxes === goals
}

// 输入：状态；输出：深拷贝（页面历史栈用）。
function clone(state) {
  if (!state || typeof state !== 'object') return null
  var st = {
    width: state.width,
    height: state.height,
    walls: state.walls ? state.walls.slice() : [],
    goals: state.goals ? state.goals.slice() : [],
    boxes: state.boxes ? state.boxes.slice() : [],
    player: state.player,
    moves: isNum(state.moves) ? state.moves : 0,
    pushes: isNum(state.pushes) ? state.pushes : 0,
    solved: !!state.solved
  }
  st.solved = solvedOf(st)
  return st
}

// 输入：关卡字符串数组；输出：状态；格式不合法返回 null。
function parse(level) {
  var rows = level
  if (typeof rows === 'string') rows = rows.split(/\r?\n/)
  if (!rows || typeof rows.length !== 'number' || rows.length === 0) return null
  var height = rows.length
  var width = 0
  var y
  for (y = 0; y < height; y++) {
    if (typeof rows[y] !== 'string') return null
    if (y === 0) width = rows[y].length
    if (rows[y].length !== width) return null
  }
  if (width <= 0) return null

  var total = width * height
  var walls = []
  var goals = []
  var boxes = []
  var player = -1
  var players = 0
  var boxCount = 0
  var goalCount = 0
  for (var i = 0; i < total; i++) {
    walls.push(false)
    goals.push(false)
    boxes.push(false)
  }
  for (y = 0; y < height; y++) {
    for (var x = 0; x < width; x++) {
      var ch = rows[y].charAt(x)
      var at = y * width + x
      if (ch === '#') { walls[at] = true; continue }
      if (ch === ' ') continue
      if (ch === '.') { goals[at] = true; goalCount++; continue }
      if (ch === '$') { boxes[at] = true; boxCount++; continue }
      if (ch === '*') { boxes[at] = true; goals[at] = true; boxCount++; goalCount++; continue }
      if (ch === '@') {
        if (players > 0) return null
        player = at
        players++
        continue
      }
      if (ch === '+') {
        if (players > 0) return null
        player = at
        goals[at] = true
        goalCount++
        players++
        continue
      }
      return null
    }
  }
  if (players !== 1 || boxCount < 1 || boxCount !== goalCount) return null

  var st = {
    width: width,
    height: height,
    walls: walls,
    goals: goals,
    boxes: boxes,
    player: player,
    moves: 0,
    pushes: 0,
    solved: false
  }
  st.solved = solvedOf(st)
  return st
}

// 输入：状态、方向；输出：{ state, moved, pushed }。
// 非法状态/方向/撞墙/推不动时 moved=false，状态为干净副本。
function move(state, dir) {
  var st = clone(state)
  if (!st) return { state: null, moved: false, pushed: false }
  var d = normDir(dir)
  if (!d) return { state: st, moved: false, pushed: false }
  var player = isNum(st.player) ? Math.floor(st.player) : -1
  if (outOf(st, player)) return { state: st, moved: false, pushed: false }

  var delta = DIRS[d]
  var px = player % st.width
  var py = Math.floor(player / st.width)
  var tx = px + delta.dx
  var ty = py + delta.dy
  var target = idxOf(st, tx, ty)
  if (target < 0 || st.walls[target]) return { state: st, moved: false, pushed: false }

  if (st.boxes[target]) {
    var bx = tx + delta.dx
    var by = ty + delta.dy
    var beyond = idxOf(st, bx, by)
    if (beyond < 0 || st.walls[beyond] || st.boxes[beyond]) {
      return { state: st, moved: false, pushed: false }
    }
    st.boxes[target] = false
    st.boxes[beyond] = true
    st.player = target
    st.moves++
    st.pushes++
    st.solved = solvedOf(st)
    return { state: st, moved: true, pushed: true }
  }

  st.player = target
  st.moves++
  st.solved = solvedOf(st)
  return { state: st, moved: true, pushed: false }
}

// 输入：状态；输出：是否已过关（所有箱子在目标上且数量一致）。
function isSolved(state) {
  return solvedOf(state)
}

// 输入：状态；输出：{ moves, pushes }（脏值兜底 0）。
function counts(state) {
  return {
    moves: state && isNum(state.moves) ? state.moves : 0,
    pushes: state && isNum(state.pushes) ? state.pushes : 0
  }
}

module.exports = {
  parse: parse,
  move: move,
  clone: clone,
  isSolved: isSolved,
  counts: counts,
  DIRS: DIRS
}
