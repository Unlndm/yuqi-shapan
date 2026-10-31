# scripts/patch-barfit.py — tab 栏高度自适应（大屏手表收窄，跑道屏保持舒适）
import io
import re


def patch(path, subs):
    with io.open(path, encoding='utf-8') as f:
        t = f.read()
    for old, new in subs:
        assert old in t, (path, old[:60])
        t = t.replace(old, new)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('patched', path)


PAGES = ['index', 'settings', 'stats', 'help', 'about', 'game', 'monopoly', 'aeroplane']

# 1) data：barH/tabH 声明
for pg in PAGES:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    anchor = "fz: config.fontTokens('normal'),"
    if anchor in t and 'barH:' not in t:
        t = t.replace(anchor, anchor + "\n    barH: 60,\n    tabH: 48,", 1)
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        print('data ok', p)

# 2) tabbar/tab 高度内联绑定
for pg in PAGES:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    changed = False
    if '<div class="tabbar" style="background-color' in t:
        t = t.replace('<div class="tabbar" style="background-color',
                      '<div class="tabbar" style="height:{{barH}}px;background-color', 1)
        changed = True
    # 所有 tab 按钮注入高度绑定（正则兼容不同缩进与属性顺序）
    t2 = re.sub(r'(class="tab")(\s+style=")', r'\1\2height:{{tabH}}px;line-height:{{tabH}}px;', t)
    if t2 != t:
        t = t2
        changed = True
    if changed:
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        print('tabbar bind ok', p)

# 3) getLayout 回调：按屏高比例计算栏高（大屏收窄，跑道屏上限 60）
#    栏高 = designH × 11.5%，钳制 [44, 60]；tab 高 = 栏高 - 10。
for pg in PAGES:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    calc = "      that.barH = Math.max(44, Math.min(60, Math.round(l.designH * 0.115)))\n      that.tabH = that.barH - 10"
    if 'that.barH = Math.max' in t:
        continue
    if pg == 'game':
        old = """      that.pageH = l.designH
      that.designK = l.scale"""
        new = """      that.pageH = l.designH
      that.designK = l.scale
""" + calc + """
      that.vpH = Math.max(160, l.designH - 68 - that.barH)"""
        assert old in t, p
        # 移除旧的固定 vpH 公式
        t = t.replace(old, new, 1)
        t = t.replace("      that.vpH = Math.max(160, l.designH - 116)\n", "", 1)
        t = t.replace("""      // 纵向扣除：padding 40 + header 36 + 间距 16 + footer 46 ≈ 138，留 2px 余量
""", "")
    elif pg == 'monopoly':
        old = """      that.pageH = l.designH
      that.boardH = Math.max(180, l.designH - 220)"""
        new = """      that.pageH = l.designH
""" + calc + """
      that.boardH = Math.max(180, l.designH - 170 - that.barH)"""
        assert old in t, p
        t = t.replace(old, new, 1)
    elif pg == 'aeroplane':
        old = """      that.pageH = l.designH
      that.boardH = Math.max(170, l.designH - 235)"""
        new = """      that.pageH = l.designH
""" + calc + """
      that.boardH = Math.max(170, l.designH - 205 - that.barH)"""
        assert old in t, p
        t = t.replace(old, new, 1)
    else:
        old = "      that.pageH = l.designH"
        new = "      that.pageH = l.designH\n" + calc
        assert old in t, p
        t = t.replace(old, new, 1)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('calc ok', p)
