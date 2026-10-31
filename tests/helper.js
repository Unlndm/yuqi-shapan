/**
 * tests/helper.js — 极简断言工具（node 直接跑，无外部依赖）。
 */

var passed = 0
var failed = 0
var current = ''

function suite(name) {
  current = name
}

// 输入：描述、布尔表达式；输出：无（失败打印并累计）。
function ok(desc, cond) {
  if (cond) {
    passed++
  } else {
    failed++
    console.error('[FAIL] ' + current + ' :: ' + desc)
  }
}

// 输入：描述、实际值、期望值；输出：无（deep 一维/二维数组比较）。
function eq(desc, actual, expected) {
  var a = JSON.stringify(actual)
  var b = JSON.stringify(expected)
  ok(desc + ' (got ' + a + ')', a === b)
}

function summary() {
  console.log(current + ' :: pass=' + passed + ' fail=' + failed)
  return failed
}

module.exports = { suite: suite, ok: ok, eq: eq, summary: summary }
