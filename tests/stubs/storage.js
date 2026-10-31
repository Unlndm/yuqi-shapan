/**
 * tests/stubs/storage.js — @system.storage 的测试替身（永远失败，验证兜底路径）。
 */
module.exports = {
  get: function (o) { if (o.fail) o.fail({}, -1) },
  set: function (o) { if (o.fail) o.fail({}, -1) },
  delete: function (o) { if (o.fail) o.fail({}, -1) }
}
