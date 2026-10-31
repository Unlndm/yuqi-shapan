/**
 * utils/toast.js — 系统级 Toast 播报。
 * 能力来源：Vela 官方「弹窗 prompt」能力 `prompt.showToast({message, duration})`
 *   （https://iot.mi.com/vela/quickapp/zh/features/other/prompt.html）。
 *   manifest.json 的 features 需声明 { "name": "system.prompt" }。
 * 用途约定（本轮玩家决策）：**不需要确定/取消的消息**走系统 Toast；
 *   需要玩家做决定或要看结果的一律走页内弹窗，不用 Toast。
 * 兜底：设备/版本不支持该能力时静默失败（不弹也不报错），对局逻辑不受影响。
 */

var prompt = null
try {
  prompt = require('@system.prompt')
} catch (e) {
  prompt = null
}

// 输入：text（播报文案）、duration（毫秒，默认 2000）；输出：无。
function toast(text, duration) {
  if (!text) return
  try {
    if (prompt && prompt.showToast) {
      prompt.showToast({ message: String(text), duration: duration || 2000 })
    }
  } catch (e) {}
}

// 输入：事件数组 [{text}]；输出：无。逐条播报（最多 2 条，避免同一动作连弹刷屏）。
function toastEvents(events, max) {
  if (!events || !events.length) return
  var n = Math.min(events.length, max || 2)
  var start = events.length - n
  for (var i = start; i < events.length; i++) {
    if (events[i] && events[i].text) toast(events[i].text, 1800)
  }
}

module.exports = { toast: toast, toastEvents: toastEvents }
