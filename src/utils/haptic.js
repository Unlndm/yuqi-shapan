/**
 * utils/haptic.js — 震动统一封装。页面禁止直接调用 @system.vibrator。
 * 职责：合并「设置强度」与「场景触发等级」，映射到 vibrate({mode})；无马达设备静默失败。
 * 强度映射（spec 第八节）：
 *   设置等级: weak=0 normal=1 strong=2；触发等级同刻度。
 *   生效等级 = max(设置, 触发)；生效 >= 2 → long，否则 short。
 * 触发点：落子 normal / 吃子·提子·胜负 strong / 非法走法 weak / 普通按钮不震。
 */

import vibrator from '@system.vibrator'

var RANK = { weak: 0, normal: 1, strong: 2 }

// 模块级运行时配置，由页面在加载设置后 applySettings 注入
var _enabled = true
var _level = 'normal'

// 输入：settings（loadSettings 的结果，含 vibrate / vibrateLevel）；输出：无。
function applySettings(settings) {
  if (!settings) return
  _enabled = settings.vibrate !== false
  _level = RANK[settings.vibrateLevel] !== undefined ? settings.vibrateLevel : 'normal'
}

// 输入：trigger 'weak' | 'normal' | 'strong'（缺省按设置等级）；输出：无（内部静默兜底）。
function fire(trigger) {
  if (!_enabled) return
  var t = RANK[trigger] !== undefined ? trigger : 'normal'
  var rank = Math.max(RANK[t], RANK[_level])
  var mode = rank >= 2 ? 'long' : 'short'
  try {
    vibrator.vibrate({ mode: mode })
  } catch (e) {
    // 兜底：部分设备仅支持 start；再失败则完全静默
    try {
      vibrator.start({ duration: 80 })
    } catch (e2) {}
  }
}

// 语义化触发点（页面只调用这些，不关心等级映射）
module.exports = {
  applySettings: applySettings,
  fire: fire,
  place: function () { fire('normal') },   // 落子成功
  capture: function () { fire('strong') }, // 吃子 / 提子
  invalid: function () { fire('weak') },   // 非法走法被拒
  result: function () { fire('strong') },  // 胜负判定出结果
  // 胜利彩蛋：短-短-强三连脉冲，区别于普通结果震动
  celebrate: function () {
    fire('normal')
    setTimeout(function () { fire('normal') }, 180)
    setTimeout(function () { fire('strong') }, 360)
  }
}
