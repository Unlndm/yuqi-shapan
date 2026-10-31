/**
 * tests/rules-werewolf.js — 狼人杀纯规则 / AI 引擎测试。
 * 运行：node tests/rules-werewolf.js
 * 随机数全部注入 utils/rng.js 的种子随机器，测试可复现。
 */

var ww = require('../src/rules/werewolf.js')
var rng = require('../src/utils/rng.js')
var h = require('./helper.js')

// ── 测试辅助 ────────────────────────────────────────────────────────

// 输入：局面；输出：各身份人数。
function countRoles(st) {
  var c = { wolf: 0, seer: 0, witch: 0, hunter: 0, villager: 0 }
  for (var i = 0; i < st.players.length; i++) c[st.players[i].role]++
  return c
}

// 输入：模式、角色条件；输出：第一个满足条件的种子局面。
function findSeed(mode, pred) {
  for (var s = 1; s <= 5000; s++) {
    var st = ww.create(mode, rng.create(s))
    if (pred(st)) return { seed: s, state: st }
  }
  return null
}

// 输入：局面、排除者；输出：第一个存活且非该玩家的 id（无则 null）。
function firstAliveNot(st, id) {
  for (var i = 0; i < st.players.length; i++) {
    if (st.players[i].alive && i !== id) return i
  }
  return null
}

// 输入：局面；输出：第一个存活的某身份玩家 id（无则 null）。
function firstAliveRole(st, role, exclude) {
  for (var i = 0; i < st.players.length; i++) {
    if (st.players[i].alive && st.players[i].role === role && i !== exclude) return i
  }
  return null
}

// 一直执行 AI 动作，直到轮到人类或无动作可做。
function driveAI(st, max) {
  var guard = 0
  var lim = max || 40
  while (st.phase !== 'end' && guard++ < lim) {
    if (st.actor < 0) break
    if (st.players[st.actor].isHuman) break
    var a = ww.aiChoose(st)
    if (!a) break
    var r = ww.act(st, a)
    if (!r.ok) throw new Error('AI 动作被拒：' + r.error + ' / step=' + st.step)
    st = r.state
  }
  return st
}

// 人类测试策略（只看公开信息，固定选最小 id，保证复现）。
function humanPolicy(st) {
  if (st.phase === 'night') {
    if (st.step === 'wolf') {
      for (var i = 0; i < st.players.length; i++) {
        if (st.players[i].alive && st.players[i].role !== 'wolf') return { type: 'wolfKill', target: i }
      }
      return { type: 'wolfKill', target: null }
    }
    if (st.step === 'seer') {
      return { type: 'seerCheck', target: firstAliveNot(st, 0) }
    }
    if (st.step === 'witch') {
      if (st.witch.heal > 0 && st.night.killTarget !== null) {
        return { type: 'witch', heal: true, poison: null }
      }
      if (st.witch.poison > 0) {
        return { type: 'witch', heal: false, poison: firstAliveNot(st, 0) }
      }
      return { type: 'witch', heal: false, poison: null }
    }
  }
  if (st.phase === 'day') {
    if (st.step === 'discuss') return { type: 'toVote' }
    if (st.step === 'vote') return { type: 'vote', target: firstAliveNot(st, 0) }
  }
  if (st.step === 'hunter') {
    return { type: 'hunterShoot', target: firstAliveNot(st, 0) }
  }
  return null
}

// 完整跑一局（人类按固定策略），返回终局。
function playAll(st, max) {
  var guard = 0
  var lim = max || 500
  while (st.phase !== 'end' && guard++ < lim) {
    if (st.actor < 0) break
    var a = st.players[st.actor].isHuman ? humanPolicy(st) : ww.aiChoose(st)
    if (!a) break
    var r = ww.act(st, a)
    if (!r.ok) throw new Error('模拟动作被拒：' + r.error + ' / step=' + st.step)
    st = r.state
  }
  return st
}

// ── 身份分配 ────────────────────────────────────────────────────────
h.suite('werewolf/身份分配')
var s9 = ww.create(9, rng.create(11))
var c9 = countRoles(s9)
h.eq('9 人局：3 狼人', c9.wolf, 3)
h.eq('9 人局：1 预言家', c9.seer, 1)
h.eq('9 人局：1 女巫', c9.witch, 1)
h.eq('9 人局：1 猎人', c9.hunter, 1)
h.eq('9 人局：3 村民', c9.villager, 3)
h.eq('9 人局总人数', s9.players.length, 9)
h.eq('9 人局身份合计', c9.wolf + c9.seer + c9.witch + c9.hunter + c9.villager, 9)
h.eq('0 号是人类', s9.players[0].isHuman, true)
h.ok('其余均为 AI', (function () {
  for (var i = 1; i < s9.players.length; i++) if (s9.players[i].isHuman) return false
  return true
})())
h.ok('每个玩家恰好一个合法身份', (function () {
  for (var i = 0; i < s9.players.length; i++) {
    if (ww.ROLES.indexOf(s9.players[i].role) < 0) return false
    if (i !== s9.players[i].id) return false
  }
  return true
})())
h.eq('狼人 id 与身份一致', s9.wolfIds.length, c9.wolf)

var s9b = ww.create(9, rng.create(11))
var rolesA = []
var rolesB = []
for (var ri = 0; ri < 9; ri++) {
  rolesA.push(s9.players[ri].role)
  rolesB.push(s9b.players[ri].role)
}
h.eq('同种子身份分配一致', rolesA, rolesB)

var s6 = ww.create(6, rng.create(12))
var c6 = countRoles(s6)
h.eq('6 人局：2 狼人', c6.wolf, 2)
h.eq('6 人局：1 预言家', c6.seer, 1)
h.eq('6 人局：1 女巫', c6.witch, 1)
h.eq('6 人局：无猎人', c6.hunter, 0)
h.eq('6 人局：2 村民', c6.villager, 2)
h.eq('6 人局总人数', s6.players.length, 6)
h.eq('6 人局身份合计', c6.wolf + c6.seer + c6.witch + c6.hunter + c6.villager, 6)

// ── 夜晚：狼人刀人 ──────────────────────────────────────────────────
h.suite('werewolf/夜晚：狼人刀人')
var fw = findSeed(9, function (st) { return st.players[0].role === 'wolf' })
h.ok('找到人类狼人种子', !!fw)
var wst = fw ? fw.state : null
h.eq('首夜由人类狼人行动', wst.actor, 0)
var viWolf = ww.visibleInfo(wst, 0)
h.eq('人类狼知道 3 名队友', viWolf.wolves.length, 3)
h.ok('队友列表含自己', viWolf.wolves.indexOf(0) >= 0)
var killTarget = firstAliveRole(wst, 'villager', 0)
if (killTarget === null) killTarget = firstAliveNot(wst, 0)
var badMate = ww.act(wst, { type: 'wolfKill', target: wst.wolfIds[1] })
h.eq('不能刀队友', badMate.ok, false)
h.ok('拒绝时返回原局面', badMate.state === wst)
var badStep = ww.act(wst, { type: 'seerCheck', target: killTarget })
h.eq('阶段不符被拒绝', badStep.ok, false)
var beforeBad = JSON.stringify(wst)
ww.act(wst, { type: 'wolfKill', target: wst.wolfIds[1] })
h.ok('非法动作不污染原局面', JSON.stringify(wst) === beforeBad)
var killOk = ww.act(wst, { type: 'wolfKill', target: killTarget })
h.ok('合法刀人', killOk.ok)
h.eq('记录刀口', killOk.state.night.killTarget, killTarget)
h.ok('刀人后进入下一夜间步骤', killOk.state.step === 'seer' ||
  killOk.state.step === 'witch' || killOk.state.step === 'hunter' || killOk.state.phase === 'day')
var villagerId = firstAliveRole(killOk.state, 'villager', 0)
h.ok('村民视角看不到狼人刀口日志', (function () {
  if (villagerId === null) return true
  var vi = ww.visibleInfo(killOk.state, villagerId)
  for (var i = 0; i < vi.log.length; i++) if (vi.log[i].scope === 'wolf') return false
  return true
})())

// ── 夜晚：预言家查验 ────────────────────────────────────────────────
h.suite('werewolf/夜晚：预言家查验')
var fs = findSeed(9, function (st) { return st.players[0].role === 'seer' })
h.ok('找到人类预言家种子', !!fs)
var sst = driveAI(fs.state, 20)
h.eq('轮到人类预言家', [sst.phase, sst.step, sst.actor], ['night', 'seer', 0])
var checkTarget = firstAliveNot(sst, 0)
var checkOk = ww.act(sst, { type: 'seerCheck', target: checkTarget })
h.ok('合法查验', checkOk.ok)
var expectSide = sst.players[checkTarget].role === 'wolf' ? 'wolf' : 'good'
h.eq('查验返回正确阵营', checkOk.state.mind[0].checks[0].result, expectSide)
h.eq('查验记录目标', checkOk.state.mind[0].checks[0].target, checkTarget)
var viSeer = ww.visibleInfo(checkOk.state, 0)
h.eq('预言家视角可见查验', viSeer.checks[0].target, checkTarget)
var bystander = firstAliveRole(checkOk.state, 'villager', 0)
h.ok('旁人看不到查验结果', (function () {
  if (bystander === null) return true
  var vi = ww.visibleInfo(checkOk.state, bystander)
  if (vi.checks.length !== 0) return false
  for (var i = 0; i < vi.log.length; i++) if (vi.log[i].type === 'seerCheck') return false
  return true
})())

// ── 夜晚：女巫救 / 毒 ───────────────────────────────────────────────
h.suite('werewolf/夜晚：女巫用药')
var fwc = findSeed(9, function (st) { return st.players[0].role === 'witch' })
h.ok('找到人类女巫种子', !!fwc)
var wcst = driveAI(fwc.state, 20)
h.eq('轮到人类女巫', [wcst.phase, wcst.step, wcst.actor], ['night', 'witch', 0])
var knife = wcst.night.killTarget
h.ok('女巫能看到刀口', knife !== null)
var healOk = ww.act(wcst, { type: 'witch', heal: true, poison: null })
h.ok('合法救人', healOk.ok)
h.ok('被救者存活', healOk.state.players[knife].alive)
h.eq('解药剩 0', healOk.state.witch.heal, 0)

var fwc2 = findSeed(9, function (st) { return st.players[0].role === 'witch' })
var wcst2 = driveAI(fwc2.state, 20)
var knife2 = wcst2.night.killTarget
var poisonTarget = null
for (var pi = 0; pi < wcst2.players.length; pi++) {
  if (wcst2.players[pi].alive && pi !== 0 && pi !== knife2) {
    poisonTarget = pi
    break
  }
}
var bothBad = ww.act(wcst2, { type: 'witch', heal: true, poison: poisonTarget })
h.eq('同夜不能同时用药', bothBad.ok, false)
h.eq('拒绝后解药未消耗', bothBad.state.witch.heal, 1)
var poisonOk = ww.act(wcst2, { type: 'witch', heal: false, poison: poisonTarget })
h.ok('合法毒人', poisonOk.ok)
h.eq('毒药剩 0', poisonOk.state.witch.poison, 0)
h.eq('被毒者出局', poisonOk.state.players[poisonTarget].alive, false)

// ── 猎人被动开枪 ────────────────────────────────────────────────────
h.suite('werewolf/猎人开枪')
var fh = findSeed(9, function (st) { return st.players[0].role === 'hunter' })
h.ok('找到人类猎人的种子', !!fh)
var hst = driveAI(fh.state, 40)
// 分支 A：狼人首夜刀了猎人 → 直接进入开枪
// 分支 B：猎人活到白天 → 让全体 AI 怀疑猎人，投出猎人
if (hst.step !== 'hunter') {
  h.eq('白天讨论轮到人类猎人', [hst.phase, hst.step, hst.actor], ['day', 'discuss', 0])
  h.ok('猎人此时存活', hst.players[0].alive)
  for (var hi = 1; hi < hst.players.length; hi++) {
    if (hst.players[hi].alive) hst.mind[hi].sus[0] = 999
  }
  var toVote = ww.act(hst, { type: 'toVote' })
  h.ok('开始投票', toVote.ok)
  hst = toVote.state
  var vguard = 0
  while (hst.phase !== 'end' && hst.step === 'vote' && vguard++ < 20) {
    var va = hst.players[hst.actor].isHuman
      ? { type: 'vote', target: firstAliveNot(hst, 0) }
      : ww.aiChoose(hst)
    var vr = ww.act(hst, va)
    h.ok('猎人局投票合法', vr.ok)
    if (!vr.ok) break
    hst = vr.state
  }
}
h.eq('进入猎人开枪阶段', hst.step, 'hunter')
h.eq('开枪者是人类猎人', hst.actor, 0)
var shot = firstAliveNot(hst, 0)
var shootOk = ww.act(hst, { type: 'hunterShoot', target: shot })
h.ok('合法开枪', shootOk.ok)
h.eq('被带走者出局', shootOk.state.players[shot].alive, false)
h.ok('猎人开枪写入公开日志', (function () {
  var vi = ww.visibleInfo(shootOk.state, 0)
  for (var i = 0; i < vi.log.length; i++) if (vi.log[i].type === 'hunterShoot') return true
  return false
})())

// ── 白天投票与放逐 ──────────────────────────────────────────────────
h.suite('werewolf/白天投票与放逐')
var fv = findSeed(9, function (st) { return st.players[0].role === 'villager' })
h.ok('找到人类村民种子', !!fv)
var dst = driveAI(fv.state, 40)
h.ok('人类村民活到白天', dst.players[0].alive)
h.eq('进入讨论阶段', [dst.phase, dst.step, dst.actor], ['day', 'discuss', 0])
var exileTarget = null
for (var ei = 1; ei < dst.players.length; ei++) {
  var ep = dst.players[ei]
  if (ep.alive && ep.role !== 'wolf' && ep.role !== 'hunter') {
    exileTarget = ei
    break
  }
}
h.ok('找到可放逐靶子', exileTarget !== null)
for (var si = 1; si < dst.players.length; si++) {
  if (dst.players[si].alive && si !== exileTarget) dst.mind[si].sus[exileTarget] = 999
}
var openVote = ww.act(dst, { type: 'toVote' })
h.ok('进入投票阶段', openVote.ok && openVote.state.step === 'vote')
dst = openVote.state
var eguard = 0
while (dst.phase !== 'end' && dst.step === 'vote' && eguard++ < 20) {
  var ea = dst.players[dst.actor].isHuman
    ? { type: 'vote', target: exileTarget }
    : ww.aiChoose(dst)
  var er = ww.act(dst, ea)
  h.ok('放逐投票动作合法', er.ok)
  if (!er.ok) break
  dst = er.state
}
h.eq('被放逐者出局', dst.players[exileTarget].alive, false)
h.ok('放逐写入公开日志', (function () {
  for (var i = 0; i < dst.log.length; i++) {
    if (dst.log[i].type === 'exile' && dst.log[i].target === exileTarget) return true
  }
  return false
})())

// ── 胜负判定 ────────────────────────────────────────────────────────
h.suite('werewolf/胜负条件')
var w6 = ww.create(6, rng.create(21))
h.eq('6 人局开局未分胜负', ww.checkWin(w6), null)
var killedGood = 0
for (var wi = 0; wi < w6.players.length && killedGood < 2; wi++) {
  if (w6.players[wi].alive && w6.players[wi].role !== 'wolf') {
    w6.players[wi].alive = false
    killedGood++
  }
}
var cw = ww.checkWin(w6)
h.eq('6 人局 2 狼 ≥ 2 好 → 狼胜', cw && cw.winner, 'wolf')
h.ok('狼胜原因可读', cw && cw.reason.indexOf('不少于') >= 0)

var w9 = ww.create(9, rng.create(22))
for (var gj = 0; gj < w9.players.length; gj++) {
  if (w9.players[gj].role === 'wolf') w9.players[gj].alive = false
}
var cg = ww.checkWin(w9)
h.eq('狼人全灭 → 好人胜', cg && cg.winner, 'good')
h.eq('好人胜原因', cg && cg.reason, '狼人全灭')

var mid9 = ww.create(9, rng.create(23))
h.eq('9 人局 3 狼 < 6 好 → 继续', ww.checkWin(mid9), null)

// ── AI 约束：不刀队友 / 不投自己 / 动作合法 ─────────────────────────
h.suite('werewolf/AI 约束')
var killSamples = 0
var voteSamples = 0
var witchSamples = 0
for (var seed = 1; seed <= 24; seed++) {
  var ast = ww.create(9, rng.create(seed))
  var guard = 0
  while (ast.phase !== 'end' && guard++ < 400) {
    var actor = ast.actor
    if (actor < 0) break
    var isAI = !ast.players[actor].isHuman
    var action = isAI ? ww.aiChoose(ast) : humanPolicy(ast)
    if (!action) break
    if (isAI && ast.step === 'wolf') {
      h.ok('AI 狼必有刀人目标', action.target !== null)
      h.ok('AI 狼不刀队友', ast.wolfIds.indexOf(action.target) < 0)
      h.ok('AI 狼只刀存活者', ast.players[action.target].alive)
      killSamples++
    }
    if (isAI && ast.step === 'vote') {
      h.ok('AI 投票目标存在', action.target !== null)
      h.ok('AI 不投自己', action.target !== actor)
      h.ok('AI 只投存活者', ast.players[action.target].alive)
      if (ast.players[actor].role === 'wolf') {
        h.ok('AI 狼不投队友', ast.wolfIds.indexOf(action.target) < 0)
      }
      voteSamples++
    }
    if (isAI && ast.step === 'witch') witchSamples++
    var ar = ww.act(ast, action)
    h.ok('AI 动作合法（种子 ' + seed + ' / ' + action.type + '）', ar.ok)
    if (!ar.ok) break
    ast = ar.state
  }
}
h.ok('覆盖 AI 刀人样本', killSamples > 0)
h.ok('覆盖 AI 投票样本', voteSamples > 0)
h.ok('覆盖 AI 女巫样本', witchSamples > 0)

// ── 同种子复现 ──────────────────────────────────────────────────────
h.suite('werewolf/同种子复现')
var run1 = playAll(ww.create(9, rng.create(20261024)), 500)
var run2 = playAll(ww.create(9, rng.create(20261024)), 500)
h.eq('同种子同策略：日志完全一致', JSON.stringify(run1.log), JSON.stringify(run2.log))
h.eq('同种子同策略：终局阶段一致', run1.phase, run2.phase)
h.eq('同种子同策略：胜负一致', run1.winner && run1.winner.winner, run2.winner && run2.winner.winner)
h.eq('完整模拟能走到终局', run1.phase, 'end')

var run6 = playAll(ww.create(6, rng.create(20261024)), 500)
h.eq('6 人局也能走到终局', run6.phase, 'end')
h.ok('终局有胜者', run6.winner !== null)

// ── 非法动作 / 人类视角 ────────────────────────────────────────────
h.suite('werewolf/非法动作')
var ist = ww.create(9, rng.create(31))
var ibefore = JSON.stringify(ist)
var wrongStep = ww.act(ist, { type: 'seerCheck', target: 1 })
h.eq('错误阶段动作被拒绝', wrongStep.ok, false)
h.ok('拒绝时返回原局面引用', wrongStep.state === ist)
h.ok('拒绝时原局面未被修改', JSON.stringify(ist) === ibefore)
h.eq('未知动作被拒绝', ww.act(ist, { type: 'nope' }).ok, false)
h.eq('非对象动作被拒绝', ww.act(ist, null).ok, false)

var fvv = findSeed(9, function (st) { return st.players[0].role === 'villager' })
var vst = driveAI(fvv.state, 40)
var vOpen = ww.act(vst, { type: 'toVote' })
vst = vOpen.state
h.eq('人类先手投票', vst.actor, 0)
var selfVote = ww.act(vst, { type: 'vote', target: 0 })
h.eq('不能投自己', selfVote.ok, false)
h.ok('投自己后票箱为空', Object.keys(selfVote.state.votes).length === 0)

var fww = findSeed(9, function (st) { return st.players[0].role === 'witch' })
var wwst = driveAI(fww.state, 20)
var bothUse = ww.act(wwst, { type: 'witch', heal: true, poison: firstAliveNot(wwst, 0) })
h.eq('女巫双药同夜被拒绝', bothUse.ok, false)
h.ok('双药拒绝后药水未动', bothUse.state.witch.heal === 1 && bothUse.state.witch.poison === 1)

h.suite('werewolf/人类视角')
var fvill = findSeed(9, function (st) { return st.players[0].role === 'villager' })
var vinfo = ww.visibleInfo(fvill.state, 0)
h.ok('存活村民看不到他人身份', (function () {
  for (var i = 0; i < vinfo.players.length; i++) {
    if (i === 0) continue
    if (vinfo.players[i].role !== null) return false
  }
  return true
})())
h.eq('存活村民看不到狼队', vinfo.wolves.length, 0)
h.ok('存活村民看不到狼人私聊日志', (function () {
  for (var i = 0; i < vinfo.log.length; i++) if (vinfo.log[i].scope === 'wolf') return false
  return true
})())
h.eq('log() 与 visibleInfo 日志一致', ww.log(fvill.state, 0).length, vinfo.log.length)

var fwolf = findSeed(9, function (st) { return st.players[0].role === 'wolf' })
var winfo = ww.visibleInfo(fwolf.state, 0)
h.eq('人类狼知道全部狼队', winfo.wolves.length, 3)
h.ok('人类狼可见队友身份', (function () {
  for (var i = 0; i < winfo.players.length; i++) {
    var id = winfo.players[i].id
    if (winfo.wolves.indexOf(id) >= 0 && winfo.players[i].role !== 'wolf') return false
  }
  return true
})())

var deadState = ww.create(9, rng.create(51))
deadState.players[0].alive = false
var dinfo = ww.visibleInfo(deadState, 0)
h.ok('出局后可见全部身份', (function () {
  for (var i = 0; i < dinfo.players.length; i++) if (!dinfo.players[i].role) return false
  return true
})())

process.exitCode = h.summary()
