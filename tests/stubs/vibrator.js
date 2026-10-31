/**
 * tests/stubs/vibrator.js — @system.vibrator 的测试替身（抛异常，验证静默兜底）。
 */
module.exports = {
  vibrate: function () { throw new Error('no motor') },
  start: function () { throw new Error('no motor') }
}
