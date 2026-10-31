# scripts/patch-noline.py — 去白线条（MD3 纯色调分层）+ 返回钮改 div 点击
import io

REMOVED = []


def remove_lines(path, contains_list):
    with io.open(path, encoding='utf-8') as f:
        lines = f.readlines()
    out = []
    n = 0
    for ln in lines:
        if any(c in ln for c in contains_list):
            n += 1
            continue
        out.append(ln)
    if n:
        with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.writelines(out)
        REMOVED.append((path, n))
        print('removed', n, 'border lines from', path)


def patch(path, subs):
    with io.open(path, encoding='utf-8') as f:
        t = f.read()
    for old, new in subs:
        assert old in t, (path, old[:60])
        t = t.replace(old, new)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('patched', path)


# ── 1) 去边框白线条：卡片/列表/分段/弹窗/底栏/顶栏分隔线全部改纯色调分层 ──
# 注意保留：游戏语义边框（棋子/格子/标记/棋子 token）
remove_lines('src/pages/index/index.css', ['border-width', 'border-top-width'])
remove_lines('src/pages/settings/settings.css', ['border-width', 'border-bottom-width'])
remove_lines('src/pages/stats/stats.css', ['border-width', 'border-top-width'])
remove_lines('src/pages/help/help.css', ['border-width'])
remove_lines('src/pages/about/about.css', ['border-width'])
remove_lines('src/pages/game/game.css', [
    'border-top-width', 'border-bottom-width',  # 顶栏分隔线/底栏分隔线
])
# game 的 .zbtn/.s-start/.s-back/.m-btn 按钮描边：只删按钮块的（棋子/格子保留）
with io.open('src/pages/game/game.css', encoding='utf-8') as f:
    t = f.read()
for cls in ['.zbtn', '.s-start', '.s-back', '.m-btn', '.fbtn']:
    i = t.find(cls + ' {')
    while i >= 0:
        j = t.find('}', i)
        seg = t[i:j]
        if 'border-width' in seg:
            t = t[:i] + seg.replace('  border-width: 1px;\n', '') + t[j:]
        i = t.find(cls + ' {', i + 1)
with io.open('src/pages/game/game.css', 'w', encoding='utf-8', newline='\n') as f:
    f.write(t)
print('game button borders removed')

remove_lines('src/pages/monopoly/monopoly.css', [
    '.act-main', '.act-half', '.m-btn', '.tabbar', '.btn-danger',
])
# monopoly .cell 边框是归属着色（游戏语义），保留
remove_lines('src/pages/aeroplane/aeroplane.css', [
    '.act-main', '.act-choice', '.m-btn', '.tabbar', '.btn-danger',
])
# aeroplane .cell 边框是起飞点/航线着色（游戏语义），保留

# ── 2) index 标题分隔线元素移除（也是一条线） ──
patch('src/pages/index/index.ux', [
    ('    <div class="title-line" style="background-color:{{t.outline}}"></div>\n', ''),
])
remove_lines('src/pages/index/index.css', ['.title-line'])

# ── 3) 返回钮 input → div（div@click 是全应用已验证可点的形态） ──
for pg in ['settings', 'stats', 'help', 'about']:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    old = """<input type="button" value="＜" class="back-fab"
             style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
             @click="goBack" />"""
    if old not in t:
        old = """<input type="button" value="＜" class="back-fab"
           style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
           @click="goBack" />"""
    assert old in t, p
    new = """<div class="back-fab" @click="goBack">
        <text class="back-glyph" style="color:{{t.onSurface}}">＜</text>
      </div>"""
    t = t.replace(old, new)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('back-fab div ok', p)

# back-fab 样式：去边框 + 居中 glyph
for pg in ['settings', 'stats', 'help', 'about']:
    p = 'src/pages/%s/%s.css' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    i = t.find('.back-fab {')
    j = t.find('}', i)
    block = """.back-fab {
  width: 38px;
  height: 38px;
  border-radius: 19px;
  background-color: transparent;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.back-glyph {
  font-size: 18px;
  font-weight: bold;
  line-height: 20px;
}"""
    t = t[:i] + block + t[j:]
    # rect 媒体查询里的 back-fab 尺寸块同步（去掉 border-width 行）
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('back-fab css ok', p)
