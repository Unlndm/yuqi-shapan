# scripts/patch-aero.py — 飞行棋页：顶栏/缩放/平移/棋盘缩放重构
import io

p = 'src/pages/aeroplane/aeroplane.ux'
with io.open(p, encoding='utf-8') as f:
    t = f.read()

# 1) 顶栏
old = """    <!-- 对局 -->
    <block if="{{state !== 'matching'}}">
      <div class="hud">"""
new = """    <!-- 对局 -->
    <block if="{{state !== 'matching'}}">
      <!-- 顶栏：返回钮居左，棋名居右 -->
      <div class="topbar" style="background-color:{{t.surface}}">
        <input type="button" value="＜" class="back-fab"
               style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}}"
               @click="onBackFab" />
        <text class="topbar-title" style="color:{{t.onSurface}}">飞行棋</text>
      </div>

      <!-- 顶部状态栏 -->"""
assert old in t, 'topbar anchor'
t = t.replace(old, new)

# 2) board 加 viewport+wrap+zoom-fab+pan
old2 = """      <!-- 航道棋盘 -->
      <div class="board" style="height:{{boardH}}px">
        <div class="cell" for="{{(ci, c) in cells}}"
             style="left:{{c.x}}px;top:{{c.y}}px;background-color:{{c.bg}};border-color:{{c.border}}">
          <text class="cell-glyph" if="{{c.glyph}}" style="color:{{c.fg}};font-size:{{fz.sm}}px">{{c.glyph}}</text>
        </div>
        <div class="token" for="{{(ti, tk) in tokens}}"
             style="left:{{tk.x}}px;top:{{tk.y}}px;background-color:{{tk.color}};border-color:{{t.surface}}"></div>
        <div class="dice-disc" style="left:70px;top:{{diceY}}px;background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}">
          <text class="dice-text" style="color:{{t.onSurface}}">{{diceText}}</text>
        </div>
        <text class="hangar" style="top:{{diceY + 56}}px;color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">机库 我{{hangar0}} AI{{hangar1}}</text>
      </div>"""
new2 = """      <!-- 航道棋盘：viewport + 可缩放/平移的 wrap -->
      <div class="board" style="height:{{boardH}}px"
           @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
        <div class="board-wrap" style="left:{{wrapX}}px;top:{{wrapY}}px;width:{{ringW}}px;height:{{ringH}}px">
          <div class="cell" for="{{(ci, c) in cells}}"
               style="left:{{c.x}}px;top:{{c.y}}px;background-color:{{c.bg}};border-color:{{c.border}}">
            <text class="cell-glyph" if="{{c.glyph}}" style="color:{{c.fg}};font-size:{{fz.sm}}px">{{c.glyph}}</text>
          </div>
          <div class="token" for="{{(ti, tk) in tokens}}"
               style="left:{{tk.x}}px;top:{{tk.y}}px;background-color:{{tk.color}};border-color:{{t.surface}}"></div>
        </div>
        <div class="dice-disc" style="left:70px;top:{{diceY}}px;background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}">
          <text class="dice-text" style="color:{{t.onSurface}}">{{diceText}}</text>
        </div>
        <div class="zoom-fab">
          <input type="button" value="＋" class="zbtn" disabled="{{zoomIdx >= 3}}"
                 style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}}"
                 @click="zoomIn" />
          <input type="button" value="－" class="zbtn" disabled="{{zoomIdx <= 0}}"
                 style="color:{{t.onSurfaceVariant}};background-color:{{t.surfaceContainerHigh}}"
                 @click="zoomOut" />
        </div>
      </div>"""
assert old2 in t, 'board anchor'
t = t.replace(old2, new2)

# 3) data
old3 = "    boardH: 300,\n    diceY: 120,"
new3 = ("    boardH: 300,\n    diceY: 120,\n"
        "    zoomIdx: 1,\n    zoomSteps: [0.8, 1, 1.25, 1.5],\n"
        "    wrapX: 0,\n    wrapY: 0,\n    ringW: 192,\n    ringH: 300,")
assert old3 in t, 'data'
t = t.replace(old3, new3)

# 4) handlers
old4 = """  onShow() {
    screen.keepScreenOn(true)
  },"""
new4 = """  onShow() {
    screen.keepScreenOn(true)
  },

  zoomIn() {
    if (this.zoomIdx >= this.zoomSteps.length - 1) return
    this.zoomIdx++
    this.buildBoard()
  },

  zoomOut() {
    if (this.zoomIdx <= 0) return
    this.zoomIdx--
    this.buildBoard()
  },

  onTouchStart(e) {
    var t = (e.touches && e.touches.length && e.touches[0]) || {}
    this.pan = { sx: t.clientX || 0, sy: t.clientY || 0, ox: this.wrapX, oy: this.wrapY }
  },

  onTouchMove(e) {
    if (!this.pan) return
    var t = (e.touches && e.touches.length && e.touches[0]) || {}
    this.wrapX = Math.min(0, Math.max(this.ringW - 192, Math.round(this.pan.ox + ((t.clientX || 0) - this.pan.sx))))
    this.wrapY = Math.min(0, Math.max(this.ringH - this.boardH, Math.round(this.pan.oy + ((t.clientY || 0) - this.pan.sy))))
  },

  onTouchEnd() {
    this.pan = null
  },

  onBackFab() {
    this.showExitConfirm = true
  },"""
assert old4 in t, 'handlers'
t = t.replace(old4, new4)

# 5) buildBoard 缩放重构
i5 = t.find('  buildBoard() {')
j5 = t.find('\n  countDone(', i5)
assert i5 >= 0 and j5 > i5, 'buildBoard range'
new5 = """  buildBoard() {
    var t = this.t
    var z = this.zoomSteps[this.zoomIdx]
    var cs = Math.round(30 * z)
    var ringW = Math.round(192 * z)
    var ringH = Math.round(this.boardH * z)
    var ringX = Math.round((192 - ringW) / 2)
    var ringY = Math.round((this.boardH - ringH) / 2)
    var topY = ringY + 4
    var botY = ringY + ringH - cs - 4
    var sideH = ringH - cs * 2 - 8
    var xs = []
    for (var k = 0; k < 6; k++) {
      xs.push(ringX + 2 + Math.round((ringW - cs - 4) * k / 5))
    }
    var midXs = []
    for (k = 1; k < 4; k++) {
      midXs.push([ringX + 2, ringX + Math.round((ringW - cs - 4) * k / 4)])
    }
    var posList = []
    for (k = 0; k < 6; k++) posList.push([xs[k], topY])
    for (k = 6; k < 10; k++) {
      var f = (k - 6) / 4
      posList.push([rightX, Math.round(topY + cs + sideH * f)])
    }
    for (k = 10; k < 16; k++) posList.push([xs[15 - k], botY])
    for (k = 16; k < 20; k++) {
      var f2 = (20 - k) / 4
      posList.push([leftX, Math.round(topY + cs + sideH * f2)])
    }
    var cells = []
    for (k = 0; k < 20; k++) {
      var isStart0 = k === this.ap.START[0]
      var isStart1 = k === this.ap.START[1]
      var isFly = this.ap.FLY[k] !== undefined
      var bg = t.surfaceVariant
      var border = t.outline
      var fg = t.onSurfaceVariant
      var glyph = ''
      if (isStart0) { bg = t.primaryContainer; border = t.primary; fg = t.onPrimary }
      else if (isStart1) { border = t.error }
      if (isFly) { bg = t.primaryContainer; border = t.primaryContainer; fg = t.onPrimary; glyph = '飞' }
      cells.push({ x: posList[k][0], y: posList[k][1], bg: bg, border: border, fg: fg, glyph: glyph })
    }
    this.cells = cells

    var toks = []
    for (var p = 0; p < 2; p++) {
      for (var j = 0; j < 2; j++) {
        var ring = this.disp[p][j]
        if (ring < 0 || ring >= 20) continue
        var bp = posList[ring]
        toks.push({
          x: bp[0] + 8 + p * 10 + j * 4,
          y: bp[1] + 8 + (j % 2) * 4,
          color: p === 0 ? t.primary : t.error
        })
      }
    }
    this.tokens = toks

    this.done0 = this.countDone(0)
    this.done1 = this.countDone(1)
    this.hangar0 = this.countHangar(0)
    this.hangar1 = this.countHangar(1)
    this.round = this.astate.round
    this.maxRounds = this.ap.MAX_ROUNDS
  }

  countDone(player) {"""
t = t[:i5] + new5 + t[j5 + len('  countDone(player) {'):]

with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
    f.write(t)
print('aeroplane.ux ok')
