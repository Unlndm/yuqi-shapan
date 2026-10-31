# scripts/patch-adaptive.py — tab 栏屏幕适配：根容器 100% 高 + 曲面安全区
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


# ── 所有页面：根高度改 100%（屏幕真实高度），移除 pageH 内联绑定 ──
pages = ['index', 'settings', 'stats', 'help', 'about', 'game', 'monopoly', 'aeroplane', 'start']
for pg in pages:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    old = 'style="height:{{pageH}}px;background-color:{{t.surface}}"'
    if old in t:
        t = t.replace(old, 'style="background-color:{{t.surface}}"', 1)
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        print('patched', p)
    else:
        print('skip (no height binding)', p)

# CSS：.page height 490 → 100%
for pg in pages:
    p = 'src/pages/%s/%s.css' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    changed = False
    if 'height: 490px;' in t:
        t = t.replace('height: 490px;', 'height: 100%;', 1)
        changed = True
    if pg in ('monopoly', 'aeroplane') and 'height: 100%;' not in t.split('.page {')[1].split('}')[0]:
        t = t.replace('.page {\n  width: 192px;', '.page {\n  width: 192px;\n  height: 100%;', 1)
        changed = True
    if changed:
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        print('patched', p)

# ── tab 栏曲面安全区：高 60，文字上提（跑道屏底部 ~12px 曲线区留空）──
TABBAR = """.tabbar {
  width: 192px;
  height: 60px;
  border-top-width: 1px;
  flex-direction: row;
}"""
TAB = """.tab {
  flex: 1;
  height: 48px;
  line-height: 48px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}"""
for pg in ['index', 'settings', 'stats', 'help', 'about', 'game', 'monopoly', 'aeroplane']:
    p = 'src/pages/%s/%s.css' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    subs = []
    if '.tabbar {' in t:
        subs.append(("""  height: 52px;
  border-top-width: 1px;""", """  height: 60px;
  border-top-width: 1px;"""))
    if '.tab {' in t:
        subs.append(("""  flex: 1;
  height: 52px;
  line-height: 52px;""", """  flex: 1;
  height: 48px;
  line-height: 48px;"""))
    if subs:
        patch(p, subs)

# ── 内容与底栏之间留出呼吸空间 ──
patch('src/pages/index/index.css', [
    ('.cards {\n  flex: 1;\n  margin-top: 12px;\n  width: 168px;\n  padding-bottom: 10px;',
     '.cards {\n  flex: 1;\n  margin-top: 12px;\n  margin-bottom: 6px;\n  width: 168px;\n  padding-bottom: 10px;'),
])
patch('src/pages/settings/settings.css', [
    ('.body {\n  flex: 1;\n  margin-top: 8px;\n  width: 168px;',
     '.body {\n  flex: 1;\n  margin-top: 8px;\n  margin-bottom: 6px;\n  width: 168px;'),
])

# ── 骰子玩法：actions 弹性填充使底栏贴底；boardH 已扣 60 底栏 ──
patch('src/pages/monopoly/monopoly.css', [
    ('.actions {\n  width: 176px;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}',
     '.actions {\n  width: 176px;\n  flex: 1;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}'),
    ('      that.boardH = Math.max(180, l.designH - 210)',
     '      that.boardH = Math.max(180, l.designH - 220)'),
])
patch('src/pages/aeroplane/aeroplane.css', [
    ('.actions {\n  width: 176px;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}',
     '.actions {\n  width: 176px;\n  flex: 1;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}'),
    ('      that.boardH = Math.max(170, l.designH - 235)',
     '      that.boardH = Math.max(170, l.designH - 245)'),
])

# ── 对局页：视口 flex 自适应（布局不再依赖 vpH 估算），vpH 仅用于平移钳位 ──
patch('src/pages/game/game.css', [
    ('.vp {\n  width: 168px;\n  margin-top: 8px;\n  overflow: hidden;\n  position: relative;\n  border-radius: 8px;\n}',
     '.vp {\n  width: 168px;\n  flex: 1;\n  margin-top: 8px;\n  margin-bottom: 4px;\n  overflow: hidden;\n  position: relative;\n  border-radius: 8px;\n}'),
])
patch('src/pages/game/game.ux', [
    ('<div class="vp" style="width:{{vpW}}px;height:{{vpH}}px"',
     '<div class="vp" style="width:{{vpW}}px"'),
    # zoom FAB 顶部改为随视口（仍右上角），高度自适应后 top 4 即可
    # 页头分隔线保持
])
