# scripts/patch-cards.py — 开源参考落地：双行卡片 + 方屏双列网格 + 关于页重设计 + 参数回归 CSS
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


# ── index.ux：卡片双行（名称+简介短句）、移除 JS 机型参数（改 CSS 媒体查询）──
patch('src/pages/index/index.ux', [
    ("""        <div class="icon-box" style="background-color:{{$item.enabled ? t.primaryContainer : t.surfaceContainerHigh}}">
          <text class="icon" if="{{$item.iconType === 'glyph'}}"
                style="color:{{$item.enabled ? t.onPrimary : t.outline}}">{{$item.icon}}</text>
          <div class="icon-ring" if="{{$item.iconType === 'ring'}}"
               style="border-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
          <div class="icon-dots" if="{{$item.iconType === 'dots'}}">
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
          </div>
        </div>
        <text class="name" style="color:{{$item.enabled ? t.onSurface : t.outline}}">{{$item.name}}</text>
        <text class="tag" if="{{!$item.enabled}}" style="color:{{t.outline}};font-size:{{fz.sm}}px">需要更大屏幕</text>""",
     """        <div class="icon-box" style="background-color:{{$item.enabled ? t.primaryContainer : t.surfaceContainerHigh}}">
          <text class="icon" if="{{$item.iconType === 'glyph'}}"
                style="color:{{$item.enabled ? t.onPrimary : t.outline}}">{{$item.icon}}</text>
          <div class="icon-ring" if="{{$item.iconType === 'ring'}}"
               style="border-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
          <div class="icon-dots" if="{{$item.iconType === 'dots'}}">
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
            <div class="icon-dot" style="background-color:{{$item.enabled ? t.onPrimary : t.outline}}"></div>
          </div>
        </div>
        <div class="card-text">
          <text class="name" style="color:{{$item.enabled ? t.onSurface : t.outline}}">{{$item.name}}</text>
          <text class="card-sub" if="{{$item.enabled}}" style="color:{{t.onSurfaceVariant}};font-size:{{fz.sm}}px">{{$item.short}}</text>
          <text class="tag" if="{{!$item.enabled}}" style="color:{{t.outline}};font-size:{{fz.sm}}px">需要更大屏幕</text>
        </div>"""),
    # 移除 JS 机型参数（media query 接管）
    ("""    screen.getLayout().then(function (l) {
      that.compact = !!l.compact
    })
""", ""),
    ("""    fz: config.fontTokens('normal'),
    games: config.GAME_TYPES""",
     """    fz: config.fontTokens('normal'),
    games: config.GAME_TYPES"""),
])

# index.css：双行卡片样式 + 方屏 rect 媒体查询（双列网格 + 紧凑参数）
patch('src/pages/index/index.css', [
    ('.card {\n  width: 168px;\n  height: 58px;\n  margin-bottom: 10px;\n  border-radius: 12px;',
     '.card {\n  width: 168px;\n  height: 66px;\n  margin-bottom: 10px;\n  border-radius: 12px;'),
    (""".title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}""",
     """.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}

.card-text {
  flex: 1;
  flex-direction: column;
}

.card-sub {
  line-height: 16px;
  margin-top: 1px;
}

/* 方屏/矩形手表（红米 Watch 等）：双列网格 + 紧凑参数 */
@media screen and (shape: rect) {
  .page {
    padding-top: 14px;
  }
  .title {
    font-size: 18px;
    line-height: 24px;
    height: 24px;
  }
  .cards {
    width: 176px;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
  }
  .card {
    width: 85px;
    height: 85px;
    margin-bottom: 8px;
    flex-direction: column;
    justify-content: center;
    padding-left: 0px;
    padding-right: 0px;
  }
  .icon-box {
    margin-right: 0px;
    margin-bottom: 4px;
  }
  .card-text {
    flex-direction: column;
    align-items: center;
  }
  .name {
    font-size: 14px;
  }
  .card-sub {
    font-size: 10px;
  }
  .tag {
    display: none;
  }
  .tabbar {
    height: 44px;
  }
  .tab {
    height: 38px;
    line-height: 38px;
    font-size: 13px;
  }
}"""),
])

# settings/stats/help/about/game：方屏紧凑 media 块（padding/标题/底栏）
MEDIA_SMALL = """
/* 方屏/矩形手表：紧凑参数 */
@media screen and (shape: rect) {
  .page {
    padding-top: 14px;
  }
  .title {
    font-size: 18px;
    line-height: 24px;
    height: 24px;
  }
  .title-line {
    margin-top: 4px;
  }
  .tabbar {
    height: 44px;
  }
  .tab {
    height: 38px;
    line-height: 38px;
    font-size: 13px;
  }
}"""
for pg in ['settings', 'stats', 'help', 'about', 'game']:
    p = 'src/pages/%s/%s.css' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    if 'shape: rect' in t:
        print('skip', p)
        continue
    t = t.rstrip() + '\n' + MEDIA_SMALL + '\n'
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('media ok', p)

# 骰子玩法：boardH 参数回归常量（barH JS 绑定移除）
patch('src/pages/monopoly/monopoly.ux', [
    ("""      that.barH = Math.max(44, Math.min(60, Math.round(l.designH * 0.115)))
      that.tabH = that.barH - 10
      that.boardH = Math.max(180, l.designH - 170 - that.barH)""",
     """      that.boardH = Math.max(180, l.designH - 220)"""),
])
patch('src/pages/aeroplane/aeroplane.ux', [
    ("""      that.barH = Math.max(44, Math.min(60, Math.round(l.designH * 0.115)))
      that.tabH = that.barH - 10
      that.boardH = Math.max(170, l.designH - 205 - that.barH)""",
     """      that.boardH = Math.max(170, l.designH - 235)"""),
])
# tabbar/tab 高度内联绑定移除（media query 接管）
for pg in ['index', 'settings', 'stats', 'help', 'about', 'game', 'monopoly', 'aeroplane']:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    t2 = t.replace('style="height:{{barH}}px;background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}"',
                   'style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}"')
    t2 = re.sub(r'style="height:\{\{tabH\}\}px;line-height:\{\{tabH\}\}px;', 'style="', t2) if False else t2
    t2 = t2.replace('style="height:{{tabH}}px;line-height:{{tabH}}px;', 'style="')
    if t2 != t:
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t2)
        print('unbind ok', p)

