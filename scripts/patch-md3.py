# scripts/patch-md3.py — MD3 深度打磨：表面层级/列表语言/弹窗规格（一次性迁移）
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


patch('src/pages/index/index.ux', [
    ("""        <text class="icon" if="{{$item.iconType === 'glyph'}}"
              style="color:{{$item.enabled ? t.primary : t.outline}}">{{$item.icon}}</text>
        <div class="icon-ring" if="{{$item.iconType === 'ring'}}"
             style="border-color:{{$item.enabled ? t.primary : t.outline}}"></div>
        <div class="icon-dots" if="{{$item.iconType === 'dots'}}">
          <div class="icon-dot" style="background-color:{{$item.enabled ? t.primary : t.outline}}"></div>
          <div class="icon-dot" style="background-color:{{$item.enabled ? t.primary : t.outline}}"></div>
          <div class="icon-dot" style="background-color:{{$item.enabled ? t.primary : t.outline}}"></div>
          <div class="icon-dot" style="background-color:{{$item.enabled ? t.primary : t.outline}}"></div>
        </div>""",
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
        </div>"""),
    ('<text class="title" style="color:{{t.onSurface}}">驭棋沙盘</text>',
     '<text class="title" style="color:{{t.onSurface}}">驭棋沙盘</text>\n    <div class="title-line" style="background-color:{{t.outline}}"></div>'),
    ('style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}"\n           @click="openGame($item)">',
     'style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}"\n           @click="openGame($item)">'),
])

patch('src/pages/index/index.css', [
    ('.card {\n  width: 168px;\n  height: 58px;\n  margin-bottom: 10px;\n  border-radius: 10px;',
     '.card {\n  width: 168px;\n  height: 58px;\n  margin-bottom: 10px;\n  border-radius: 12px;'),
    (""".icon {
  width: 30px;
  font-size: 17px;
  font-weight: bold;
}""",
     """.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}

.icon-box {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.icon {
  font-size: 17px;
  font-weight: bold;
  line-height: 20px;
}"""),
    (""".icon-ring {
  width: 16px;
  height: 16px;
  border-radius: 8px;
  border-width: 4px;
  margin-left: 6px;
  margin-right: 6px;
}""",
     """.icon-ring {
  width: 16px;
  height: 16px;
  border-radius: 8px;
  border-width: 4px;
}"""),
    (""".icon-dots {
  width: 20px;
  height: 20px;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  margin-left: 4px;
  margin-right: 4px;
}""",
     """.icon-dots {
  width: 20px;
  height: 20px;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}"""),
])

patch('src/pages/settings/settings.ux', [
    ('<text class="title" style="color:{{t.onSurface}}">设置</text>',
     '<text class="title" style="color:{{t.onSurface}}">设置</text>\n    <div class="title-line" style="background-color:{{t.outline}}"></div>'),
    ('<div class="row" style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">\n        <text class="label" style="color:{{t.onSurface}};font-size:{{fz.md}}px">震动反馈</text>',
     '<div class="row" style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">\n        <text class="label" style="color:{{t.onSurface}};font-size:{{fz.md}}px">震动反馈</text>'),
    ('<div class="row" for="{{(ri, row) in rows}}"\n           style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
     '<div class="row" for="{{(ri, row) in rows}}"\n           style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">'),
])
patch('src/pages/settings/settings.css', [
    ('.row {\n  width: 168px;\n  margin-bottom: 10px;\n  border-radius: 10px;',
     '.row {\n  width: 168px;\n  margin-bottom: 10px;\n  border-radius: 12px;'),
    (""".title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}""",
     """.title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}

.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}"""),
])

patch('src/pages/stats/stats.ux', [
    ('<text class="title" style="color:{{t.onSurface}}">战绩大厅</text>',
     '<text class="title" style="color:{{t.onSurface}}">战绩大厅</text>\n    <div class="title-line" style="background-color:{{t.outline}}"></div>'),
    ('<div class="summary" style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
     '<div class="summary" style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">'),
    ('<div class="g-row" for="{{(gi, g) in gameRows}}"\n           style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
     '<div class="g-row" for="{{(gi, g) in gameRows}}"\n           style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">'),
    ('<div class="r-row" for="{{(ri, r) in recent}}"\n           style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
     '<div class="r-row" for="{{(ri, r) in recent}}"\n           style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">'),
])
patch('src/pages/stats/stats.css', [
    ('.summary {\n  width: 168px;\n  height: 64px;\n  border-radius: 8px;',
     '.summary {\n  width: 168px;\n  height: 64px;\n  border-radius: 12px;'),
    ('.g-row {\n  width: 168px;\n  height: 52px;\n  border-radius: 8px;',
     '.g-row {\n  width: 168px;\n  height: 52px;\n  border-radius: 12px;'),
    ('.r-row {\n  width: 168px;\n  height: 36px;\n  border-radius: 8px;',
     '.r-row {\n  width: 168px;\n  height: 36px;\n  border-radius: 12px;'),
    (""".title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}""",
     """.title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}

.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}"""),
])

patch('src/pages/help/help.ux', [
    ('<text class="title" style="color:{{t.onSurface}}">玩法介绍</text>',
     '<text class="title" style="color:{{t.onSurface}}">玩法介绍</text>\n    <div class="title-line" style="background-color:{{t.outline}}"></div>'),
    ('<div class="h-row" for="{{(hi, h) in rows}}"\n           style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
     '<div class="h-row" for="{{(hi, h) in rows}}"\n           style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">'),
    ('<div class="h-row" style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">\n        <text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">拖拽平移棋盘',
     '<div class="h-row" style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">\n        <text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">拖拽平移棋盘'),
    ('<div class="h-row" style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">\n        <text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">人机对手强度',
     '<div class="h-row" style="background-color:{{t.surfaceContainer}};border-color:{{t.outline}}">\n        <text class="h-text" style="color:{{t.onSurface}};font-size:{{fz.md}}px">人机对手强度'),
])
patch('src/pages/help/help.css', [
    ('.h-row {\n  width: 168px;\n  border-radius: 10px;',
     '.h-row {\n  width: 168px;\n  border-radius: 12px;'),
    (""".title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}""",
     """.title {
  font-size: 22px;
  font-weight: bold;
  line-height: 30px;
  height: 30px;
}

.title-line {
  width: 168px;
  height: 1px;
  margin-top: 6px;
}"""),
])

# 弹窗规格：高阶表面 + 16px 圆角
for pg in ['game', 'monopoly', 'aeroplane']:
    patch('src/pages/%s/%s.ux' % (pg, pg), [
        ('<div class="modal" style="background-color:{{t.surfaceVariant}};border-color:{{t.outline}}">',
         '<div class="modal" style="background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}">'),
    ])
for pg in ['game', 'monopoly', 'aeroplane']:
    p = 'src/pages/%s/%s.css' % (pg, pg)
    with io.open(p, encoding='utf-8') as f:
        t = f.read()
    if '.modal {\n  width: 160px;\n  border-radius: 12px;' in t:
        t = t.replace('.modal {\n  width: 160px;\n  border-radius: 12px;',
                      '.modal {\n  width: 160px;\n  border-radius: 16px;')
    else:
        assert '.modal {\n  width: 156px;\n  border-radius: 12px;' in t, p
        t = t.replace('.modal {\n  width: 156px;\n  border-radius: 12px;',
                      '.modal {\n  width: 156px;\n  border-radius: 16px;')
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print('patched', p)
