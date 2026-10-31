/**
 * tests/run.js — 全量测试入口。
 * 运行：node tests/run.js
 * 每个用例独立进程跑（exitCode 独立统计），最后汇总。
 */

var cases = [
  './geometry.js',
  './rules-gomoku.js',
  './rules-tictactoe.js',
  './rules-othello.js',
  './rules-connect4.js',
  './rules-go.js',
  './rules-chess.js',
  './rules-sizes.js',
  './ai.js',
  './rules-monopoly.js',
  './rules-upgrade-streak.js',
  './rules-aeroplane.js',
  './rules-g2048.js',
  './rules-slide.js',
  './rules-minesweeper.js',
  './rules-draughts.js',
  './rules-jungle.js',
  './rules-sokoban.js',
  './rules-sudoku.js',
  './rules-werewolf.js',
  './rules-snake.js',
  './rules-maze.js',
  './spotdiff.js',
  './campaign.js',
  './ai-strength.js',
  './metrics.js',
  './economy.js',
  './daily.js',
  './puzzles.js',
  './smoke.js'
]

var child = require('child_process')
var path = require('path')
var fail = 0

cases.forEach(function (c) {
  var r = child.spawnSync(process.execPath, [path.join(__dirname, c)], { encoding: 'utf8' })
  process.stdout.write(r.stdout || '')
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.status !== 0) fail++
})

console.log('==== ' + cases.length + ' 个测试文件，失败 ' + fail + ' ====')
process.exit(fail)
