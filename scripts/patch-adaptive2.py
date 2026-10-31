# scripts/patch-adaptive2.py — 自适应迁移收尾
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


# 根容器：移除 pageH 高度绑定（改用 CSS 100%）
for pg in ['index', 'settings', 'stats', 'game', 'monopoly', 'aeroplane']:
    p = 'src/pages/%s/%s.ux' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    if 'style="height:{{pageH}}px;' in t:
        t = t.replace('style="height:{{pageH}}px;', 'style="', 1)
        with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(t)
        print('patched', p)
    else:
        print('skip', p)

# monopoly：actions 弹性 + boardH 扣底栏
patch('src/pages/monopoly/monopoly.css', [
    ('.actions {\n  width: 176px;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}',
     '.actions {\n  width: 176px;\n  flex: 1;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}'),
])
patch('src/pages/monopoly/monopoly.ux', [
    ('      that.boardH = Math.max(200, l.designH - 190)',
     '      that.boardH = Math.max(180, l.designH - 220)'),
])

# aeroplane：actions 弹性 + boardH 扣底栏
patch('src/pages/aeroplane/aeroplane.css', [
    ('.actions {\n  width: 176px;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}',
     '.actions {\n  width: 176px;\n  flex: 1;\n  flex-direction: column;\n  align-items: center;\n  margin-top: 4px;\n}'),
])
patch('src/pages/aeroplane/aeroplane.ux', [
    ('      that.boardH = Math.max(200, l.designH - 190)',
     '      that.boardH = Math.max(170, l.designH - 245)'),
])
