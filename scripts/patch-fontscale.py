# scripts/patch-fontscale.py — 为全部页面接入字体大小档位（一次性迁移脚本）
import io


def patch(path, subs):
    with io.open(path, encoding='utf-8') as f:
        t = f.read()
    for old, new in subs:
        assert old in t, (path, old[:60])
        t = t.replace(old, new)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('patched', path)


patch('src/pages/settings/settings.ux', [
    ("""  data: {
    t: themeMod.dark,
    s: config.DEFAULT_SETTINGS,
    clearArmed: false,""",
     """  data: {
    t: themeMod.dark,
    pageH: 490,             // 多屏适配：设计像素页高
    fz: config.fontTokens('normal'),
    s: config.DEFAULT_SETTINGS,
    clearArmed: false,"""),
    ("""      {
        key: 'palette', stg: 'palette', label: '配色风格（MD3）',
        options: [{ v: 'purple', n: '经典紫' }, { v: 'green', n: '静谧绿' }, { v: 'blue', n: '深海蓝' }]
      }""",
     """      {
        key: 'palette', stg: 'palette', label: '配色风格（MD3）',
        options: [{ v: 'purple', n: '经典紫' }, { v: 'green', n: '静谧绿' }, { v: 'blue', n: '深海蓝' }]
      },
      {
        key: 'fontSize', stg: 'font_size', label: '字体大小',
        options: [{ v: 'normal', n: '标准' }, { v: 'large', n: '大' }, { v: 'xlarge', n: '特大' }]
      }"""),
    ("""      that.rows = syncSel(that.rows, s)
      that.t = themeMod.get(s.palette, s.theme)""",
     """      that.rows = syncSel(that.rows, s)
      that.t = themeMod.get(s.palette, s.theme)
      that.fz = config.fontTokens(s.fontSize)"""),
    ("""    if (row.key === 'theme' || row.key === 'palette') {
      this.t = themeMod.get(this.s.palette, this.s.theme)
    }""",
     """    if (row.key === 'theme' || row.key === 'palette') {
      this.t = themeMod.get(this.s.palette, this.s.theme)
    }
    if (row.key === 'fontSize') {
      this.fz = config.fontTokens(o.v)
    }"""),
    ('<text class="label" style="color:{{t.onSurface}}">震动反馈</text>',
     '<text class="label" style="color:{{t.onSurface}};font-size:{{fz.md}}px">震动反馈</text>'),
    ('<text class="label" style="color:{{t.onSurface}}">{{row.label}}</text>',
     '<text class="label" style="color:{{t.onSurface}};font-size:{{fz.md}}px">{{row.label}}</text>'),
])

patch('src/pages/index/index.ux', [
    ("""  data: {
    t: theme.get('purple', 'dark'),
    games: config.GAME_TYPES
  },""",
     """  data: {
    t: theme.get('purple', 'dark'),
    pageH: 490,             // 多屏适配：设计像素页高
    fz: config.fontTokens('normal'),
    games: config.GAME_TYPES
  },"""),
    ('      that.t = theme.get(s.palette, s.theme)',
     '      that.t = theme.get(s.palette, s.theme)\n      that.fz = config.fontTokens(s.fontSize)'),
    ('<text class="tag" if="{{!$item.enabled}}" style="color:{{t.outline}}">需要更大屏幕</text>',
     '<text class="tag" if="{{!$item.enabled}}" style="color:{{t.outline}};font-size:{{fz.sm}}px">需要更大屏幕</text>'),
])

patch('src/pages/stats/stats.ux', [
    ("""    t: themeMod.get('purple', 'dark'),
    pageH: 490,             // 多屏适配：设计像素页高
    total: 0,""",
     """    t: themeMod.get('purple', 'dark'),
    pageH: 490,             // 多屏适配：设计像素页高
    fz: config.fontTokens('normal'),
    total: 0,"""),
    ("""    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
    })""",
     """    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
      that.fz = config.fontTokens(s.fontSize)
    })"""),
    ('<text class="s-cap" style="color:{{t.onSurfaceVariant}}">总局数</text>',
     '<text class="s-cap" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">总局数</text>'),
    ('<text class="s-cap" style="color:{{t.onSurfaceVariant}}">胜场</text>',
     '<text class="s-cap" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">胜场</text>'),
    ('<text class="s-cap" style="color:{{t.onSurfaceVariant}}">胜率</text>',
     '<text class="s-cap" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">胜率</text>'),
    ('<text class="g-stat" style="color:{{g.none ? t.outline : t.onSurfaceVariant}}">',
     '<text class="g-stat" style="color:{{g.none ? t.outline : t.onSurfaceVariant}};font-size:{{fz.sm}}px">'),
    ('<text class="r-time" style="color:{{t.outline}}">',
     '<text class="r-time" style="color:{{t.outline}};font-size:{{fz.sm}}px">'),
    ('<text class="r-mode" style="color:{{t.onSurfaceVariant}}">',
     '<text class="r-mode" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">'),
])

patch('src/pages/help/help.ux', [
    ("""    t: themeMod.get('purple', 'dark'),
    pageH: 490,             // 多屏适配：设计像素页高
    rows: []""",
     """    t: themeMod.get('purple', 'dark'),
    pageH: 490,             // 多屏适配：设计像素页高
    fz: config.fontTokens('normal'),
    rows: []"""),
    ("""    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
    })""",
     """    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
      that.fz = config.fontTokens(s.fontSize)
    })"""),
    ('<text class="h-text" style="color:{{t.onSurfaceVariant}}">{{h.intro}}</text>',
     '<text class="h-text" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">{{h.intro}}</text>'),
    ('<text class="h-text" style="color:{{t.onSurface}}">拖拽平移棋盘',
     '<text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">拖拽平移棋盘'),
    ('<text class="h-text" style="color:{{t.onSurface}}">人机对手强度',
     '<text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">人机对手强度'),
    ('<text class="sec" style="color:{{t.onSurfaceVariant}}">通用操作</text>',
     '<text class="sec" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">通用操作</text>'),
    ('<text class="sec" style="color:{{t.onSurfaceVariant}}">匹配与执子</text>',
     '<text class="sec" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">匹配与执子</text>'),
])

patch('src/pages/game/game.ux', [
    ("    pageH: 490,              // 多屏适配：设计像素页高（screen.getLayout）",
     "    pageH: 490,              // 多屏适配：设计像素页高（screen.getLayout）\n    fz: config.fontTokens('normal'),"),
    ("""      that.t = themeMod.get(vals[0].palette, vals[0].theme)""",
     """      that.t = themeMod.get(vals[0].palette, vals[0].theme)
      that.fz = config.fontTokens(vals[0].fontSize)"""),
    ('<text class="turn-text" style="color:{{turnLabelColor}}">',
     '<text class="turn-text" style="color:{{turnLabelColor}};font-size:{{fz.md}}px">'),
    ('<text class="s-label" style="color:{{t.onSurfaceVariant}}">对战模式</text>',
     '<text class="s-label" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">对战模式</text>'),
    ('<text class="s-label" style="color:{{t.onSurfaceVariant}}">棋盘大小</text>',
     '<text class="s-label" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">棋盘大小</text>'),
    ('<text class="s-label" style="color:{{t.onSurfaceVariant}}">黑白执子每局随机</text>',
     '<text class="s-label" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">黑白执子每局随机</text>'),
])

patch('src/pages/monopoly/monopoly.ux', [
    ("    pageH: 490,\n    boardH: 300,",
     "    pageH: 490,\n    fz: config.fontTokens('normal'),\n    boardH: 300,"),
    ("""    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
      haptic.applySettings(s)
    })""",
     """    config.loadSettings().then(function (s) {
      that.t = themeMod.get(s.palette, s.theme)
      that.fz = config.fontTokens(s.fontSize)
      haptic.applySettings(s)
    })"""),
    ('<text class="ticker" style="color:{{tickerColor}}">',
     '<text class="ticker" style="color:{{tickerColor}};font-size:{{fz.md}}px">'),
    ('<text class="cell-name" style="color:{{c.fg}}">',
     '<text class="cell-name" style="color:{{c.fg}};font-size:{{fz.sm + 1}}px">'),
    ('<text class="cell-price" style="color:{{c.fg}}">',
     '<text class="cell-price" style="color:{{c.fg}};font-size:{{fz.sm - 1}}px">'),
    ('<text class="hud-money" style="color:{{t.primary}}">',
     '<text class="hud-money" style="color:{{t.primary}};font-size:{{fz.md}}px">'),
    ('<text class="hud-money" style="color:{{t.error}}">',
     '<text class="hud-money" style="color:{{t.error}};font-size:{{fz.md}}px">'),
    ('<text class="hud-round" style="color:{{t.onSurfaceVariant}}">',
     '<text class="hud-round" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">'),
    ('<text class="buy-hint" style="color:{{t.onSurfaceVariant}}">',
     '<text class="buy-hint" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">'),
    ("<text class=\"wait-hint\" if=\"{{phase === 'ai'}}\" style=\"color:{{t.onSurfaceVariant}}\">",
     "<text class=\"wait-hint\" if=\"{{phase === 'ai'}}\" style=\"color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px\">"),
    ('<text class="modal-sub" style="color:{{t.onSurfaceVariant}}">',
     '<text class="modal-sub" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">'),
    ('<text class="m-status" style="color:{{t.onSurfaceVariant}}">',
     '<text class="m-status" style="color:{{t.onSurfaceVariant}};font-size:{{fz.md}}px">'),
    ('<text class="m-diff" if="{{matchDone}}"',
     '<text class="m-diff" if="{{matchDone}}" style="font-size:{{fz.md}}px"'),
])
