/**
 * rules/index.js — 棋种规则注册表。
 * 职责：对局页凭棋种 id + 棋盘尺寸取规则实例；新增棋种只改这里。
 *
 * 运存：模块改为**按棋种懒加载** —— 旧版把 8 套规则（国际象棋 / 围棋等）全部
 * require 进来，即使玩五子棋也要把 8 份规则代码初始化一遍；手表运存有限，
 * 现只在真正取某一棋种的规则实例时才加载对应模块（Webpack 运行时 require）。
 */

// id → 模块加载器（只在第一次用到该棋种时执行模块体）
var LOADERS = {
  gomoku: function () { return require('./gomoku.js') },
  tictactoe: function () { return require('./tictactoe.js') },
  othello: function () { return require('./othello.js') },
  connect4: function () { return require('./connect4.js') },
  go: function () { return require('./go.js') },
  chess: function () { return require('./chess.js') },
  draughts: function () { return require('./draughts.js') },
  jungle: function () { return require('./jungle.js') }
}

// 输入：棋种 id、棋盘列数/行数（固定尺寸棋种忽略）；输出：规则实例或 null。
function get(id, cols, rows) {
  var load = LOADERS[id]
  if (!load) return null
  return load().create(cols, rows)
}

module.exports = { get: get }
