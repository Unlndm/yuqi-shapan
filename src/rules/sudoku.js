/**
 * rules/sudoku.js — 数独纯规则引擎（9×9）。
 * 范式与其它 rules 模块一致：parse 返回纯数据状态，所有查询函数不改动传入对象；
 * 页面自己维护输入/笔记/撤销历史，规则层只负责合法性、冲突、候选、提示与求解。
 *
 * 状态（纯数据）：
 *   { cells, givens, solution, valid }
 *   cells    —— 长度 81 的一维数组，0 = 空格，1~9 = 数字，索引 = 行×9 + 列；
 *   givens   —— 长度 81 的布尔数组，true = 题面固定格（页面不得改写）；
 *   solution —— parse 传入且与题面一致时的 81 格答案，否则为 null；
 *   valid    —— 题面本身是否无行/列/宫冲突。
 *
 * 解析口径：
 *   · 81 字符串（可用 '.'/'0' 表示空格，允许空白字符）；
 *   · 9×9 二维数组（每行可为字符串或数组，数字 0~9 或字符 '.'/'0'~'9'）。
 *   形态/字符非法返回 null；题面有重复数字时仍返回状态，但 valid=false。
 *
 * 提示口径：优先使用状态里携带的 solution，其次使用调用时传入的 solution，
 *   最后才用内置回溯求解；提示只返回号码与位置，不替页面落子。
 */

var SIZE = 9
var CELLS = 81
var FULL_MASK = 1022 // 位 1~9 全置 1（(1<<1)|…|(1<<9)）

// 输入：任意值；输出：是否为有限数字。
function isNum(v) {
  return typeof v === 'number' && isFinite(v)
}

// 输入：任意值；输出：是否为 0~9 的整数。
function isDigit(v) {
  return isNum(v) && v >= 0 && v <= 9 && Math.floor(v) === v
}

// 输入：单格值；输出：0~9，非法返回 -1。
function normDigit(v) {
  if (isDigit(v)) return v
  if (typeof v === 'string') {
    if (v === '.' || v === '0' || v === ' ') return 0
    if (v.length === 1 && v >= '1' && v <= '9') return parseInt(v, 10)
  }
  return -1
}

// 输入：81 字符串 / 9×9 二维数组 / 81 一维数组；输出：81 格数字数组或 null。
function readCells(input) {
  var out = []
  var i
  var j
  if (typeof input === 'string') {
    var s = input.replace(/\s/g, '')
    if (s.length !== CELLS) return null
    for (i = 0; i < CELLS; i++) {
      var d = normDigit(s.charAt(i))
      if (d < 0) return null
      out.push(d)
    }
    return out
  }
  if (!input || typeof input.length !== 'number') return null
  if (input.length === CELLS) {
    for (i = 0; i < CELLS; i++) {
      var v = normDigit(input[i])
      if (v < 0) return null
      out.push(v)
    }
    return out
  }
  if (input.length === SIZE) {
    for (i = 0; i < SIZE; i++) {
      var row = input[i]
      if (typeof row === 'string') {
        if (row.length !== SIZE) return null
        for (j = 0; j < SIZE; j++) {
          var rd = normDigit(row.charAt(j))
          if (rd < 0) return null
          out.push(rd)
        }
      } else if (row && typeof row.length === 'number') {
        if (row.length !== SIZE) return null
        for (j = 0; j < SIZE; j++) {
          var nd = normDigit(row[j])
          if (nd < 0) return null
          out.push(nd)
        }
      } else {
        return null
      }
    }
    return out
  }
  return null
}

// 输入：状态；输出：81 格干净数组（非法状态返回 null）。
function cellsOf(state) {
  if (!state || !state.cells || typeof state.cells.length !== 'number' || state.cells.length !== CELLS) return null
  var out = []
  for (var i = 0; i < CELLS; i++) {
    var v = state.cells[i]
    out.push(isDigit(v) ? v : 0)
  }
  return out
}

// 输入：状态；输出：该格是否为题面固定格。
function isGiven(state, idx) {
  return !!(state && state.givens && state.givens[idx])
}

// 输入：单元格下标；输出：同宫格的下标数组（含自身）。
function boxCells(idx) {
  var out = []
  var r0 = Math.floor(Math.floor(idx / SIZE) / 3) * 3
  var c0 = Math.floor((idx % SIZE) / 3) * 3
  for (var r = r0; r < r0 + 3; r++) {
    for (var c = c0; c < c0 + 3; c++) out.push(r * SIZE + c)
  }
  return out
}

// 输入：cells、一组下标；输出：该组内重复数字涉及的下标（就地写入 mark）。
// 同组内某数字出现 ≥2 次时，把这些格全部标为冲突。
function markUnit(cells, idxs, mark) {
  for (var d = 1; d <= 9; d++) {
    var hits = []
    for (var k = 0; k < idxs.length; k++) {
      if (cells[idxs[k]] === d) hits.push(idxs[k])
    }
    if (hits.length > 1) {
      for (var h = 0; h < hits.length; h++) mark[hits[h]] = true
    }
  }
}

// 输入：状态；输出：存在行/列/宫冲突的下标数组（升序）。
function conflicts(state) {
  var cells = cellsOf(state)
  if (!cells) return []
  var mark = []
  var i
  for (i = 0; i < CELLS; i++) mark.push(false)
  for (var r = 0; r < SIZE; r++) {
    var row = []
    for (var c = 0; c < SIZE; c++) row.push(r * SIZE + c)
    markUnit(cells, row, mark)
  }
  for (var c2 = 0; c2 < SIZE; c2++) {
    var col = []
    for (var r2 = 0; r2 < SIZE; r2++) col.push(r2 * SIZE + c2)
    markUnit(cells, col, mark)
  }
  for (var b = 0; b < SIZE; b++) {
    markUnit(cells, boxCells(b), mark)
  }
  var out = []
  for (i = 0; i < CELLS; i++) if (mark[i]) out.push(i)
  return out
}

// 输入：状态、下标；输出：该格是否与同行/同列/同宫冲突。
function conflictAt(state, idx) {
  if (!isNum(idx) || idx < 0 || idx >= CELLS || Math.floor(idx) !== idx) return false
  return conflicts(state).indexOf(idx) >= 0
}

// 输入：状态、下标；输出：该空格的候选数字（升序）；非空格/非法返回 []。
function candidates(state, idx) {
  var cells = cellsOf(state)
  if (!cells) return []
  if (!isNum(idx) || idx < 0 || idx >= CELLS || Math.floor(idx) !== idx) return []
  if (cells[idx] !== 0) return []
  var used = []
  var d
  for (d = 0; d <= 9; d++) used.push(false)
  var r = Math.floor(idx / SIZE)
  var c = idx % SIZE
  for (var i = 0; i < SIZE; i++) {
    var rowDigit = cells[r * SIZE + i]
    if (rowDigit > 0) used[rowDigit] = true
    var colDigit = cells[i * SIZE + c]
    if (colDigit > 0) used[colDigit] = true
    var bd = cells[boxCells(idx)[i]]
    if (bd > 0) used[bd] = true
  }
  var out = []
  for (d = 1; d <= 9; d++) if (!used[d]) out.push(d)
  return out
}

// 输入：状态、下标、待填数字；输出：本次输入是否合法。
// 口径：空格、非题面固定格、数字 1~9、且不与同行/同列/同宫冲突。
function isLegal(state, idx, value) {
  var cells = cellsOf(state)
  if (!cells) return false
  if (!isNum(idx) || idx < 0 || idx >= CELLS || Math.floor(idx) !== idx) return false
  if (cells[idx] !== 0) return false
  if (isGiven(state, idx)) return false
  if (!isNum(value) || value < 1 || value > 9 || Math.floor(value) !== value) return false
  return candidates(state, idx).indexOf(value) >= 0
}

// 输入：状态；输出：是否全部填满且无冲突。
function isComplete(state) {
  var cells = cellsOf(state)
  if (!cells) return false
  for (var i = 0; i < CELLS; i++) if (cells[i] === 0) return false
  return conflicts(state).length === 0
}

// 输入：9 位可用数字的位掩码；输出：可用数字个数。
function bitCount(mask) {
  var n = 0
  while (mask) {
    mask &= mask - 1
    n++
  }
  return n
}

// 输入：cells；输出：解出的 81 格数组，无解返回 null。
// 回溯 + MRV（每次选候选最少的空格），纯内部使用。
function solveCells(cells) {
  var board = cells.slice()
  var rowMask = []
  var colMask = []
  var boxMask = []
  var i
  for (i = 0; i < SIZE; i++) {
    rowMask.push(0)
    colMask.push(0)
    boxMask.push(0)
  }
  for (i = 0; i < CELLS; i++) {
    var d = board[i]
    if (d < 1) continue
    var r = Math.floor(i / SIZE)
    var c = i % SIZE
    var b = Math.floor(r / 3) * 3 + Math.floor(c / 3)
    var bit = 1 << d
    if ((rowMask[r] & bit) || (colMask[c] & bit) || (boxMask[b] & bit)) return null
    rowMask[r] |= bit
    colMask[c] |= bit
    boxMask[b] |= bit
  }

  function search() {
    var best = -1
    var bestMask = 0
    var bestCount = 10
    for (var k = 0; k < CELLS; k++) {
      if (board[k] !== 0) continue
      var rr = Math.floor(k / SIZE)
      var cc = k % SIZE
      var bb = Math.floor(rr / 3) * 3 + Math.floor(cc / 3)
      var avail = FULL_MASK & ~(rowMask[rr] | colMask[cc] | boxMask[bb])
      var count = bitCount(avail)
      if (count === 0) return false
      if (count < bestCount) {
        bestCount = count
        best = k
        bestMask = avail
        if (count === 1) break
      }
    }
    if (best < 0) return true
    var br = Math.floor(best / SIZE)
    var bc = best % SIZE
    var bbox = Math.floor(br / 3) * 3 + Math.floor(bc / 3)
    for (var digit = 1; digit <= 9; digit++) {
      var b = 1 << digit
      if (!(bestMask & b)) continue
      board[best] = digit
      rowMask[br] |= b
      colMask[bc] |= b
      boxMask[bbox] |= b
      if (search()) return true
      board[best] = 0
      rowMask[br] &= ~b
      colMask[bc] &= ~b
      boxMask[bbox] &= ~b
    }
    return false
  }

  return search() ? board : null
}

// 输入：状态；输出：完整解数组或 null。
function solve(state) {
  var cells = cellsOf(state)
  if (!cells) return null
  if (conflicts(state).length > 0) return null
  return solveCells(cells)
}

// 输入：状态、最多计数的解数；输出：解的数量（达到上限即停）。
// 主要给题库唯一解校验/测试使用。
function countSolutions(state, limit) {
  var cells = cellsOf(state)
  if (!cells) return 0
  if (conflicts(state).length > 0) return 0
  var max = isNum(limit) && limit > 0 ? Math.floor(limit) : 2
  var board = cells.slice()
  var rowMask = []
  var colMask = []
  var boxMask = []
  var i
  for (i = 0; i < SIZE; i++) {
    rowMask.push(0)
    colMask.push(0)
    boxMask.push(0)
  }
  for (i = 0; i < CELLS; i++) {
    var d = board[i]
    if (d < 1) continue
    var r = Math.floor(i / SIZE)
    var c = i % SIZE
    var b = Math.floor(r / 3) * 3 + Math.floor(c / 3)
    rowMask[r] |= 1 << d
    colMask[c] |= 1 << d
    boxMask[b] |= 1 << d
  }
  var found = 0
  function search() {
    if (found >= max) return
    var best = -1
    var bestMask = 0
    var bestCount = 10
    for (var k = 0; k < CELLS; k++) {
      if (board[k] !== 0) continue
      var rr = Math.floor(k / SIZE)
      var cc = k % SIZE
      var bb = Math.floor(rr / 3) * 3 + Math.floor(cc / 3)
      var avail = FULL_MASK & ~(rowMask[rr] | colMask[cc] | boxMask[bb])
      var count = bitCount(avail)
      if (count === 0) return
      if (count < bestCount) {
        bestCount = count
        best = k
        bestMask = avail
        if (count === 1) break
      }
    }
    if (best < 0) {
      found++
      return
    }
    var br = Math.floor(best / SIZE)
    var bc = best % SIZE
    var bbox = Math.floor(br / 3) * 3 + Math.floor(bc / 3)
    for (var digit = 1; digit <= 9; digit++) {
      var bit = 1 << digit
      if (!(bestMask & bit)) continue
      board[best] = digit
      rowMask[br] |= bit
      colMask[bc] |= bit
      boxMask[bbox] |= bit
      search()
      board[best] = 0
      rowMask[br] &= ~bit
      colMask[bc] &= ~bit
      boxMask[bbox] &= ~bit
      if (found >= max) return
    }
  }
  search()
  return found
}

// 输入：状态、可选目标格、可选答案；输出：{ index, value } 或 null。
// 目标格为空则用它，否则取第一个空格；不替页面落子。
function hint(state, idx, solution) {
  var cells = cellsOf(state)
  if (!cells) return null
  if (isComplete(state)) return null
  var target = -1
  if (isNum(idx) && idx >= 0 && idx < CELLS && Math.floor(idx) === idx && cells[idx] === 0) {
    target = idx
  } else {
    for (var i = 0; i < CELLS; i++) {
      if (cells[i] === 0) { target = i; break }
    }
  }
  if (target < 0) return null

  var sol = null
  if (solution !== undefined && solution !== null) sol = readCells(solution)
  if (!sol && state && state.solution && state.solution.length === CELLS) sol = state.solution
  if (!sol) sol = solve(state)
  if (!sol || !(sol[target] >= 1 && sol[target] <= 9)) return null
  return { index: target, value: sol[target] }
}

// 输入：题面、可选答案；输出：状态或 null（形态/字符非法）。
function parse(input, solution) {
  var cells = readCells(input)
  if (!cells) return null
  var givens = []
  for (var i = 0; i < CELLS; i++) givens.push(cells[i] !== 0)
  var sol = null
  if (solution !== undefined && solution !== null) {
    var raw = readCells(solution)
    if (raw) {
      var full = true
      for (var k = 0; k < CELLS; k++) if (raw[k] === 0) full = false
      if (full) sol = raw
    }
  }
  // 答案必须与题面已给数字一致，否则视为未携带答案
  if (sol) {
    for (var g = 0; g < CELLS; g++) {
      if (cells[g] !== 0 && cells[g] !== sol[g]) { sol = null; break }
    }
  }
  var state = {
    cells: cells,
    givens: givens,
    solution: sol,
    valid: conflictsOf(cells)
  }
  return state
}

// 输入：cells 数组；输出：题面是否合法（无行/列/宫冲突）。
function conflictsOf(cells) {
  return conflicts({ cells: cells }).length === 0
}

module.exports = {
  parse: parse,
  conflicts: conflicts,
  conflictAt: conflictAt,
  candidates: candidates,
  isLegal: isLegal,
  isComplete: isComplete,
  hint: hint,
  solve: solve,
  countSolutions: countSolutions,
  SIZE: SIZE,
  CELLS: CELLS
}
