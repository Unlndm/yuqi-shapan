/**
 * tests/smoke.js — 冒烟测试。
 * 做法：把 src/utils 拷入 tests/.tmp，@system.* import 换成 stub（node 不识别
 * 快应用系统模块说明符；Vela 编译器会正确解析，仅测试环境需要替换），
 * 再加载，验证 storage 失败兜底、GAME_TYPES 完整性、haptic 静默、渲染视图模型形状。
 * 运行：node tests/smoke.js
 */

var fs = require('fs')
var path = require('path')
var h = require('./helper.js')

// 把 src/utils 复制到 tests/.tmp 并替换 @system.* 为 stub
var SRC = path.join(__dirname, '..', 'src', 'utils')
var TMP = path.join(__dirname, '.tmp', 'utils')
fs.rmSync(path.join(__dirname, '.tmp'), { recursive: true, force: true })
fs.mkdirSync(TMP, { recursive: true })
fs.readdirSync(SRC).forEach(function (f) {
  var text = fs.readFileSync(path.join(SRC, f), 'utf8')
  // 快应用源码是 ESM import + CommonJS module.exports 混合（Vela 编译器接受），
  // node 不认，这里统一降级为纯 CJS 再替换系统模块为 stub。
  text = text.replace(/import\s+(\w+)\s+from\s+'([^']+)'/g, "var $1 = require('$2')")
  text = text.replace(/'@system\.storage'/g, "'../../stubs/storage.js'")
  text = text.replace(/'@system\.vibrator'/g, "'../../stubs/vibrator.js'")
  fs.writeFileSync(path.join(TMP, f), text)
})

h.suite('smoke/config 默认值兜底')

var config = require('./.tmp/utils/config.js')
var theme = require('../src/utils/theme.js') // 纯数据模块，无需 stub
var haptic = require('./.tmp/utils/haptic.js')
var BoardGeometry = require('../src/core/geometry.js')
var renderer = require('../src/core/board-renderer.js')

config.loadSettings().then(function (s) {
  h.eq('storage 失败回退默认震动开', s.vibrate, true)
  h.eq('默认主题深色', s.theme, 'dark')
  h.ok('v1.3.0 起设置不含难度/先手', s.difficulty === undefined && s.firstPlayer === undefined)
  h.eq('默认对手强度 auto（按战绩匹配）', s.aiLevel, 'auto')

  h.suite('smoke/GAME_TYPES')
  h.eq('棋种 19 个', config.GAME_TYPES.length, 19)
  var enabled = config.GAME_TYPES.filter(function (g) { return g.enabled })
  h.eq('可用棋种 19 个', enabled.length, 19)
  h.eq('无占位棋种（无 xiangqi）', config.GAME_TYPES.filter(function (g) { return g.id === 'xiangqi' }).length, 0)
  var okRules = true
  var reg = require('../src/rules/index.js')
  // 独立玩法（不走 rules/index 棋盘注册表）：各自有 rules/*.js 或页面内规则
  var SOLO_PAGES = ['monopoly', 'aeroplane', 'g2048', 'slide', 'minesweeper', 'sokoban', 'sudoku',
    'werewolf', 'snake', 'maze', 'spotdiff']
  config.GAME_TYPES.forEach(function (g) {
    // 大富翁 / 飞行棋 / 2048 / 数字华容道 / 扫雷 / 推箱子 / 数独 的玩法独立于棋盘规则层
    // 注意：取规则实例必须带棋盘尺寸（围棋的合法性快路径在 create 时按格数建表）
    var sz0 = g.sizes && g.sizes[0]
    if (g.enabled && SOLO_PAGES.indexOf(g.id) < 0 &&
        !reg.get(g.id, sz0.cols, sz0.rows)) okRules = false
    if (!g.enabled) okRules = false
  })
  h.ok('可用棋种均有规则模块（七个独立玩法各有模块），无置灰占位', okRules)

  // 首页分组（2026-10-30 UI 重构）：每个玩法必须属于「棋类 / 派对 / 拼图 / 推理」之一；
  // 少一个会落到「更多玩法」兜底组，等于首页分类信息缺失。
  var CATS = ['board', 'party', 'puzzle', 'solo']
  var catSeen = {}
  var catOk = true
  config.GAME_TYPES.forEach(function (g) {
    if (CATS.indexOf(g.cat) < 0) catOk = false
    catSeen[g.cat] = true
  })
  h.ok('每个玩法都有合法首页分组 cat', catOk)
  h.eq('首页四个分组齐全', CATS.filter(function (c) { return catSeen[c] }).length, 4)

  // 内容质量（2026-10-31）：19 款玩法都要有「操作 / 技巧」文案，帮助页按组渲染。
  h.eq('19 款玩法均有操作指引 how', config.GAME_TYPES.filter(function (g) { return !!g.how }).length, 19)
  h.eq('19 款玩法均有技巧 tip', config.GAME_TYPES.filter(function (g) { return !!g.tip }).length, 19)

  h.suite('smoke/haptic 无马达静默')
  var threw = false
  try {
    haptic.applySettings({ vibrate: true, vibrateLevel: 'strong' })
    haptic.place()
    haptic.capture()
    haptic.invalid()
    haptic.result()
  } catch (e) {
    threw = true
  }
  h.ok('全链路调用不抛异常', !threw)

  h.suite('smoke/渲染视图模型')
  var SOLO_PAGES2 = ['monopoly', 'aeroplane', 'g2048', 'slide', 'minesweeper', 'sokoban', 'sudoku',
    'werewolf', 'snake', 'maze', 'spotdiff']
  config.GAME_TYPES.filter(function (g) {
    return g.enabled && SOLO_PAGES2.indexOf(g.id) < 0
  }).forEach(function (g) {
    var size = g.sizes[0]
    var geo = new BoardGeometry({ cols: size.cols, rows: size.rows, cell: size.cell, mode: g.mode, pad: 10 })
    var lines = renderer.buildGridLines(geo)
    var lineOk = lines.every(function (l) {
      return l.w > 0 && l.h > 0 && l.x >= -1 && l.y >= -1 &&
        l.x + l.w <= geo.boardW + 1 && l.y + l.h <= geo.boardH + 1
    })
    h.ok(g.name + ' 网格线均在棋盘容器内', lineOk)
    var rules = reg.get(g.id, size.cols, size.rows)
    var board = rules.init()
    var stones = renderer.buildStones(board, geo, null, theme.dark)
    var initCount = 0
    board.forEach(function (row) {
      row.forEach(function (v) { if (v === 1 || v === 2) initCount++ })
    })
    h.eq(g.name + ' 初始棋子数与渲染一致', stones.length, initCount)
  })

  h.suite('smoke/棋盘尺寸配置一致性')
  var okCfg = true
  var enabledCount = 0
  config.GAME_TYPES.forEach(function (g) {
    if (!g.enabled) return
    enabledCount++
    if (g.id === 'monopoly') return
    if (!g.sizes || !g.sizes.length) { okCfg = false; return }
    // 飞行棋 / 2048 / 数字华容道 / 扫雷 / 推箱子 / 数独 为独立玩法：只校验 sizes 合法性，不查棋盘规则注册表
    if (g.id === 'aeroplane' || g.id === 'g2048' || g.id === 'slide' ||
        g.id === 'minesweeper' || g.id === 'sokoban' || g.id === 'sudoku' ||
        g.id === 'werewolf' || g.id === 'snake' || g.id === 'maze' || g.id === 'spotdiff') return
      g.sizes.forEach(function (s) {
      if (!(s.cell >= 21 && s.cell <= 60 && s.cell === Math.floor(s.cell))) okCfg = false
      if (!(s.cols > 0 && s.rows > 0 && s.label)) okCfg = false
      var r = reg.get(g.id, s.cols, s.rows)
      // 象棋 / 跳棋 / 斗兽棋 的规则层多一行元数据（半回合计数），棋盘行数 = sizes.rows + 1
      var boardRows = (g.id === 'chess' || g.id === 'draughts' || g.id === 'jungle') ? s.rows + 1 : s.rows
      if (!r || r.init().length !== boardRows) okCfg = false
    })
  })
  h.eq('可用棋种 19 个', enabledCount, 19)
  h.ok('所有 sizes 的 cell 合法且能创建规则实例', okCfg)

  h.suite('smoke/战绩匹配机制（matchCore）')
  h.eq('无战绩 → normal', config.matchCore([], 0.5), 'normal')
  h.eq('全胜 → hard', config.matchCore(['win', 'win', 'win', 'win', 'win'], 0.5), 'hard')
  h.eq('全负 → easy', config.matchCore(['lose', 'lose', 'lose', 'lose', 'lose'], 0.5), 'easy')
  h.eq('胜负参半 → normal', config.matchCore(['win', 'lose', 'win', 'lose', 'draw'], 0.5), 'normal')
  h.eq('4胜1和(0.9) → hard', config.matchCore(['win', 'win', 'win', 'win', 'draw'], 0.5), 'hard')
  h.eq('2胜3负(0.4) → normal', config.matchCore(['win', 'win', 'lose', 'lose', 'lose'], 0.5), 'normal')
  h.eq('1胜4负(0.2) → easy', config.matchCore(['win', 'lose', 'lose', 'lose', 'lose'], 0.5), 'easy')
  h.eq('hard 遇 0.1 随机上浮封顶仍 hard', config.matchCore(['win', 'win', 'win'], 0.1), 'hard')
  h.eq('easy 遇 0.95 随机已到底仍 easy', config.matchCore(['lose', 'lose', 'lose'], 0.95), 'easy')
  h.eq('normal 遇 0.1 随机上浮至 hard', config.matchCore(['win', 'lose'], 0.1), 'hard')
  h.eq('normal 遇 0.9 随机下浮至 easy', config.matchCore(['win', 'lose'], 0.9), 'easy')

  h.suite('smoke/对手强度偏好（2026-10-31）')
  // 设置页「对手强度」：auto 才按战绩；手动挡直接锁死，不受随机浮动影响。
  h.eq('auto 仍按战绩（全胜 → hard）',
    config.chooseDifficulty('auto', ['win', 'win', 'win', 'win', 'win'], 0.5), 'hard')
  h.eq('手动 easy 覆盖全胜战绩',
    config.chooseDifficulty('easy', ['win', 'win', 'win', 'win', 'win'], 0.5), 'easy')
  h.eq('手动 hard 覆盖全负战绩',
    config.chooseDifficulty('hard', ['lose', 'lose', 'lose', 'lose', 'lose'], 0.5), 'hard')
  h.eq('手动 normal 不随机浮动',
    config.chooseDifficulty('normal', [], 0.1), 'normal')
  h.eq('非法偏好回落 auto',
    config.chooseDifficulty('x', [], 0.5), 'normal')

  h.suite('smoke/战绩聚合（aggregateRecords，玩家视角）')
  var recs = [
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 1 },
    { game: 'gomoku', mode: 'ai', result: 'lose', ts: 2 },
    { game: 'gomoku', mode: 'pvp', result: 'win', ts: 3 },
    { game: 'tictactoe', mode: 'ai', result: 'draw', ts: 4 },
    { game: 'gomoku', mode: 'pvp', result: 'draw', ts: 5 },
    { game: 'othello', mode: 'pvp', result: 'black', ts: 6 } // 旧版记录
  ]
  var agg = config.aggregateRecords(recs)
  h.eq('总场次 6', agg.total, 6)
  h.eq('玩家胜场 2（人机1+双人1）', agg.winCount, 2)
  h.eq('玩家负场 1', agg.loseCount, 1)
  h.eq('玩家和局 2', agg.drawCount, 2)
  h.eq('人机 3 局', agg.aiCount, 3)
  h.eq('双人 3 局', agg.pvpCount, 3)
  h.eq('五子棋共 4 局', agg.perGame.gomoku.count, 4)
  h.eq('五子棋双人胜 1', agg.perGame.gomoku.pvpWin, 1)
  h.eq('五子棋和 1', agg.perGame.gomoku.pvpDraw, 1)
  h.eq('井字棋和 1', agg.perGame.tictactoe.aiDraw, 1)
  h.eq('旧版黑白记录只计局数不计胜负', agg.winCount, 2)
  h.eq('空记录不崩', config.aggregateRecords(null).total, 0)

  h.suite('smoke/战绩聚合（单人 solo 单独计数）')
  var soloRecs = [
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 1 },
    { game: 'sokoban', mode: 'solo', result: 'win', ts: 2 },
    { game: 'sokoban', mode: 'solo', result: 'win', ts: 3 },
    { game: 'sudoku', mode: 'solo', result: 'win', ts: 4 }
  ]
  var ags = config.aggregateRecords(soloRecs)
  h.eq('总局数含单人通关', ags.total, 4)
  h.eq('solo 不计入人机局数', ags.aiCount, 1)
  h.eq('solo 不计入双人局数', ags.pvpCount, 0)
  h.eq('solo 不计入玩家胜场', ags.winCount, 1)
  h.eq('单人通关 3 局', ags.soloCount, 3)
  h.eq('单人通关胜 3 局', ags.soloWin, 3)
  h.eq('胜率分母仍为人机+双人', ags.aiCount + ags.pvpCount, 1)
  h.eq('推箱子单人 2 局', ags.perGame.sokoban.soloCount, 2)
  h.eq('推箱子不进人机胜场', ags.perGame.sokoban.aiWin, 0)
  h.eq('数独单人通关 1 局', ags.perGame.sudoku.soloWin, 1)
  h.eq('单人通关不延长对战连胜', config.aggregateRecords([
    { game: 'gomoku', mode: 'ai', result: 'lose', ts: 1 },
    { game: 'sokoban', mode: 'solo', result: 'win', ts: 2 }
  ]).streakCur, 0)
  h.eq('旧记录无 mode 仍按人机计', config.aggregateRecords([{ game: 'gomoku', result: 'win' }]).aiCount, 1)
  h.eq('solo 记录不算负场', ags.loseCount, 0)

  h.suite('smoke/连胜统计（streakOf）')
  var recs2 = [
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 1 },
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 2 },
    { game: 'go', mode: 'ai', result: 'lose', ts: 3 },
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 4 },
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 5 },
    { game: 'gomoku', mode: 'ai', result: 'win', ts: 6 }
  ]
  var st = config.streakOf(recs2)
  h.eq('当前连胜 3（尾部全胜）', st.cur, 3)
  h.eq('最长连胜 3', st.best, 3)
  h.eq('尾部中断后当前连胜 0', config.streakOf(recs2.slice(0, 3)).cur, 0)
  h.eq('空记录连胜 0', config.streakOf([]).best, 0)
  var agg2 = config.aggregateRecords(recs2)
  h.eq('聚合含当前连胜', agg2.streakCur, 3)
  h.eq('聚合含最长连胜', agg2.streakBest, 3)
  h.eq('fontTokens 标准', config.fontTokens('normal').md, 14)
  h.eq('fontTokens 特大', config.fontTokens('xlarge').sm, 15)
  h.eq('fontTokens 非法兜底', config.fontTokens('bad').md, 14)

  fs.rmSync(path.join(__dirname, '.tmp'), { recursive: true, force: true })
  process.exitCode = h.summary()
})
