/**
 * puzzles/index.js — 残局题库统一入口。
 * 职责：按棋种汇总象棋 / 五子棋 / 围棋各 10 题（共 30 题），
 *   供残局列表页、对局页（题库 id / 目标 / 步数上限 / 提示）按需取题。
 * PUZZLE_GAMES：棋种注册表（id 与 rules/index.js 的棋种 id 一致）。
 * 纯函数：不引用全局、不读 storage、不碰 UI。
 *
 * 运存：题库模块**按棋种懒加载** —— 旧版页页 require 就把三个题库（30 个完整盘面 +
 * 题解）全部读进内存；对局页只在残局模式取一道题，普通对局完全用不到。
 */

// id → 题库加载器（只在第一次取该棋种题目时执行模块体）
var LOADERS = {
  chess: function () { return require('./chess.js') },
  gomoku: function () { return require('./gomoku.js') },
  go: function () { return require('./go.js') }
}

// 棋种注册表：顺序即列表页展示顺序；各题库题数固定 10（避免为了拿长度而加载题库）。
var PUZZLE_GAMES = [
  { id: 'chess', name: '国际象棋', count: 10 },
  { id: 'gomoku', name: '五子棋', count: 10 },
  { id: 'go', name: '围棋', count: 10 }
]

// 输入：棋种 id；输出：该棋种题库数组（未知棋种返回空数组）。
function getPuzzles(gameId) {
  var load = LOADERS[gameId]
  return load ? load() : []
}

// 输入：题目 id（如 'chess-01'）；输出：题目对象，未找到返回 null。
// id 形如「棋种-序号」，故只加载该棋种题库，不触碰另外两套。
function getPuzzle(id) {
  if (typeof id !== 'string') return null
  var dash = id.indexOf('-')
  if (dash <= 0) return null
  var load = LOADERS[id.slice(0, dash)]
  if (!load) return null
  var list = load()
  for (var k = 0; k < list.length; k++) {
    if (list[k].id === id) return list[k]
  }
  return null
}

module.exports = {
  getPuzzles: getPuzzles,
  getPuzzle: getPuzzle,
  PUZZLE_GAMES: PUZZLE_GAMES
}
