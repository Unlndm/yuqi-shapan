/**
 * tests/rules-sudoku.js — 数独规则与 90 题题库测试。
 * 题库为离线脚本随机生成并逐题校验唯一解；本测试会再用独立回溯计数复核 90 题唯一解，
 * 并验证答案与题面一致、难度分组、冲突/候选/提示/合法性函数。
 * 运行：node tests/rules-sudoku.js
 */

var sudoku = require('../src/rules/sudoku.js')
var puzzles = require('../src/rules/sudoku-puzzles.js')
var h = require('./helper.js')

var E0 = puzzles.EASY[0]
var full = sudoku.parse(E0.puzzle, E0.solution)

// 测试辅助：构造 81 格全零棋盘。
function emptyCells() {
  var out = []
  for (var i = 0; i < 81; i++) out.push(0)
  return out
}

// 测试辅助：把 81 字符串转成数字数组（'.' → 0）。
function cellsOf(str) {
  var out = []
  for (var i = 0; i < 81; i++) {
    var ch = str.charAt(i)
    out.push(ch === '.' ? 0 : parseInt(ch, 10))
  }
  return out
}

// 测试辅助：独立回溯计数（最多 limit 个解）。
// 与规则层实现分开写，避免「用被测实现证明被测数据」。
function countSolutions(cells, limit) {
  var FULL = 1022
  var board = cells.slice()
  var rows = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  var cols = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  var boxes = [0, 0, 0, 0, 0, 0, 0, 0, 0]
  var i
  for (i = 0; i < 81; i++) {
    var d = board[i]
    if (!d) continue
    var r = Math.floor(i / 9)
    var c = i % 9
    var b = Math.floor(r / 3) * 3 + Math.floor(c / 3)
    var bit = 1 << d
    if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0
    rows[r] |= bit
    cols[c] |= bit
    boxes[b] |= bit
  }
  var found = 0
  function bits(mask) {
    var n = 0
    while (mask) { mask &= mask - 1; n++ }
    return n
  }
  function search() {
    if (found >= limit) return
    var best = -1
    var bestMask = 0
    var bestCount = 10
    for (var k = 0; k < 81; k++) {
      if (board[k]) continue
      var rr = Math.floor(k / 9)
      var cc = k % 9
      var bb = Math.floor(rr / 3) * 3 + Math.floor(cc / 3)
      var avail = FULL & ~(rows[rr] | cols[cc] | boxes[bb])
      var n = bits(avail)
      if (!n) return
      if (n < bestCount) {
        bestCount = n
        best = k
        bestMask = avail
        if (n === 1) break
      }
    }
    if (best < 0) { found++; return }
    var br = Math.floor(best / 9)
    var bc = best % 9
    var bbox = Math.floor(br / 3) * 3 + Math.floor(bc / 3)
    for (var digit = 1; digit <= 9; digit++) {
      var bit = 1 << digit
      if (!(bestMask & bit)) continue
      board[best] = digit
      rows[br] |= bit
      cols[bc] |= bit
      boxes[bbox] |= bit
      search()
      board[best] = 0
      rows[br] &= ~bit
      cols[bc] &= ~bit
      boxes[bbox] &= ~bit
      if (found >= limit) return
    }
  }
  search()
  return found
}

// ── 题面解析 ────────────────────────────────────────────────────────
h.suite('sudoku/题面解析')
h.ok('81 字符串可解析', !!full)
h.eq('cells/givens 长度 81', [full.cells.length, full.givens.length], [81, 81])
h.eq('简单题保留 40 个题面数字', full.givens.filter(Boolean).length, 40)
h.eq('题面无冲突 valid=true', full.valid, true)
h.eq('解析携带答案', full.solution.join(''), E0.solution)
h.eq('题面首格与题面一致', full.cells[0], parseInt(E0.puzzle.charAt(0), 10))

var rows = E0.puzzle.match(/.{9}/g)
var from2d = sudoku.parse(rows, E0.solution)
h.eq('9×9 字符串行可解析且 cells 一致', from2d.cells, full.cells)
var fromFlat = sudoku.parse(E0.puzzle.split(''), E0.solution)
h.eq('81 一维字符数组可解析', fromFlat.cells, full.cells)
var fromNumbers = sudoku.parse(cellsOf(E0.puzzle), E0.solution)
h.eq('81 一维数字数组可解析', fromNumbers.cells, full.cells)

h.eq('长度不足 → null', sudoku.parse('123'), null)
h.eq('非法字符 → null', sudoku.parse(E0.puzzle.slice(0, 80) + 'X'), null)
h.eq('二维行长度不足 → null', sudoku.parse(rows.slice(0, 8)), null)
h.eq('null → null', sudoku.parse(null), null)

var conflictRow = emptyCells()
conflictRow[0] = 5
conflictRow[1] = 5
var rowState = sudoku.parse(conflictRow)
h.eq('有重复数字的题面仍解析但 valid=false', [!!rowState, rowState.valid], [true, false])

var wrongSolution = E0.solution.charAt(0) === '1' ? '2' + E0.solution.slice(1) : '1' + E0.solution.slice(1)
var mismatch = sudoku.parse(E0.puzzle, wrongSolution)
h.ok('答案与题面不一致时不携带答案', mismatch.solution === null)

// ── 行/列/宫冲突 ────────────────────────────────────────────────────
h.suite('sudoku/冲突检查')
h.eq('合法题面无冲突下标', sudoku.conflicts(full), [])

var colCells = emptyCells()
colCells[0] = 7
colCells[9] = 7
var colConf = sudoku.conflicts(sudoku.parse(colCells))
h.ok('同列重复 7 → 0/9 都标冲突', colConf.indexOf(0) >= 0 && colConf.indexOf(9) >= 0)

var boxCells = emptyCells()
boxCells[0] = 4
boxCells[10] = 4
var boxConf = sudoku.conflicts(sudoku.parse(boxCells))
h.ok('同宫重复 4 → 0/10 都标冲突', boxConf.indexOf(0) >= 0 && boxConf.indexOf(10) >= 0)

h.eq('同行重复 → 0/1 都标冲突', sudoku.conflicts(rowState), [0, 1])
h.eq('conflictAt 命中冲突格', sudoku.conflictAt(rowState, 0), true)
h.eq('conflictAt 未冲突格返回 false', sudoku.conflictAt(rowState, 2), false)
h.eq('conflictAt 越界返回 false', sudoku.conflictAt(rowState, 99), false)

// ── 候选数与输入合法性 ──────────────────────────────────────────────
h.suite('sudoku/候选与合法输入')
var candCells = emptyCells()
for (var d = 1; d <= 8; d++) candCells[d - 1] = d
var candState = sudoku.parse(candCells)
h.eq('同行已用 1~8 → 第 9 格候选只有 9', sudoku.candidates(candState, 8), [9])
h.eq('已填格候选为空', sudoku.candidates(candState, 0), [])
h.eq('越界候选为空', sudoku.candidates(candState, 81), [])

var firstEmpty = -1
for (var fe = 0; fe < 81; fe++) if (full.cells[fe] === 0) { firstEmpty = fe; break }
var rightValue = parseInt(E0.solution.charAt(firstEmpty), 10)
h.ok('正确数字在候选内', sudoku.candidates(full, firstEmpty).indexOf(rightValue) >= 0)
h.eq('正确数字输入合法', sudoku.isLegal(full, firstEmpty, rightValue), true)
h.eq('题面固定格不可输入', sudoku.isLegal(full, 0, rightValue), false)
h.eq('已填空格不可重复输入', sudoku.isLegal(full, firstEmpty, 0), false)
h.eq('数字 10 非法', sudoku.isLegal(full, firstEmpty, 10), false)
h.eq('越界下标非法', sudoku.isLegal(full, 99, rightValue), false)

var wrongValue = 0
for (var wv = 1; wv <= 9; wv++) {
  if (sudoku.candidates(full, firstEmpty).indexOf(wv) < 0) { wrongValue = wv; break }
}
h.eq('与行/列/宫冲突的数字输入非法', sudoku.isLegal(full, firstEmpty, wrongValue), false)

// ── 完成判定 ────────────────────────────────────────────────────────
h.suite('sudoku/完成判定')
h.eq('题面未完成', sudoku.isComplete(full), false)
var complete = sudoku.parse(E0.solution)
h.eq('完整答案判定完成', sudoku.isComplete(complete), true)
var badComplete = emptyCells()
for (var bc = 0; bc < 81; bc++) badComplete[bc] = parseInt(E0.solution.charAt(bc), 10)
badComplete[1] = badComplete[0]
h.eq('填满但有冲突不算完成', sudoku.isComplete(sudoku.parse(badComplete)), false)

// ── 提示 ────────────────────────────────────────────────────────────
h.suite('sudoku/提示')
var firstHint = sudoku.hint(full)
h.eq('提示默认取第一个空格', firstHint.index, firstEmpty)
h.eq('提示数字与答案一致', firstHint.value, rightValue)
var secondEmpty = -1
for (var se = firstEmpty + 1; se < 81; se++) if (full.cells[se] === 0) { secondEmpty = se; break }
var selectedHint = sudoku.hint(full, secondEmpty)
h.eq('提示优先使用选中空格', selectedHint.index, secondEmpty)
h.eq('选中空格提示也与答案一致', selectedHint.value, parseInt(E0.solution.charAt(secondEmpty), 10))
var filledHint = sudoku.hint(full, 0)
h.eq('选中已填格时回退到第一个空格', filledHint.index, firstEmpty)
h.eq('完整盘提示返回 null', sudoku.hint(complete), null)
var noAnswer = sudoku.parse(E0.puzzle)
h.eq('未携带答案时也能求解提示', sudoku.hint(noAnswer, secondEmpty).value, parseInt(E0.solution.charAt(secondEmpty), 10))
h.eq('提示不改动棋盘', noAnswer.cells, full.cells)

// ── 求解与唯一解计数 ────────────────────────────────────────────────
h.suite('sudoku/求解与计数')
h.eq('solve 结果等于标准答案', sudoku.solve(full).join(''), E0.solution)
h.eq('countSolutions 限 2 时返回 1', sudoku.countSolutions(full, 2), 1)
h.eq('完整盘唯一解计数为 1', sudoku.countSolutions(complete, 2), 1)
h.eq('空盘解数 > 1（限 2 返回 2）', sudoku.countSolutions(sudoku.parse(emptyCells()), 2), 2)
h.eq('有冲突的题面无解', sudoku.solve(rowState), null)
h.eq('有冲突的题面解数为 0', sudoku.countSolutions(rowState, 2), 0)

// ── 90 题题库 ───────────────────────────────────────────────────────
h.suite('sudoku/90 题题库')
h.eq('三档各 30 题', [puzzles.EASY.length, puzzles.NORMAL.length, puzzles.HARD.length], [30, 30, 30])
h.eq('ALL 共 90 题', puzzles.ALL.length, 90)
h.eq('按难度分组计数', puzzles.COUNT_BY_DIFFICULTY, { easy: 30, normal: 30, hard: 30 })

var allShapeOk = true
var allParseOk = true
var allConsistent = true
var allUnique = true
var allIdsOk = true
var allDifficultyOk = true
var allCluesOk = true
var seenPuzzle = {}
var seenId = {}
for (var gi = 0; gi < puzzles.ALL.length; gi++) {
  var p = puzzles.ALL[gi]
  if (p.puzzle.length !== 81 || p.solution.length !== 81) allShapeOk = false
  if (p.puzzle.replace(/[1-9.]/g, '').length !== 0) allShapeOk = false
  if (p.solution.replace(/[1-9]/g, '').length !== 0) allShapeOk = false
  if (seenPuzzle[p.puzzle]) allShapeOk = false
  seenPuzzle[p.puzzle] = true
  if (seenId[p.id]) allIdsOk = false
  seenId[p.id] = true
  if (p.difficulty !== (gi < 30 ? 'easy' : (gi < 60 ? 'normal' : 'hard'))) allDifficultyOk = false
  var clueCount = p.puzzle.replace(/\./g, '').length
  if (clueCount !== p.clues) allCluesOk = false
  if (p.difficulty === 'easy' && (p.clues < 38 || p.clues > 45)) allCluesOk = false
  if (p.difficulty === 'normal' && (p.clues < 30 || p.clues > 35)) allCluesOk = false
  if (p.difficulty === 'hard' && (p.clues < 24 || p.clues > 29)) allCluesOk = false

  var st = sudoku.parse(p.puzzle, p.solution)
  if (!st || !st.valid || !st.solution) { allParseOk = false; continue }
  for (var ci = 0; ci < 81; ci++) {
    var ch = p.puzzle.charAt(ci)
    if (ch !== '.' && ch !== p.solution.charAt(ci)) allConsistent = false
  }
  if (countSolutions(cellsOf(p.puzzle), 2) !== 1) allUnique = false
}
h.ok('90 题题面/答案均为 81 字符合法', allShapeOk)
h.ok('90 题 id 互不重复', allIdsOk)
h.ok('90 题难度分组标记正确', allDifficultyOk)
h.ok('90 题 clues 与题面/难度区间一致', allCluesOk)
h.ok('90 题均可解析、题面无冲突且携带答案', allParseOk)
h.ok('90 题已给数字与答案逐格一致', allConsistent)
h.ok('90 题独立回溯复核均为唯一解', allUnique)

process.exit(h.summary())
