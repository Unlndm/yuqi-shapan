# -*- coding: utf-8 -*-
import io

def patch(path, subs):
    with io.open(path, encoding='utf-8') as f:
        t = f.read()
    for old, new in subs:
        assert old in t, (path, old[:60])
        t = t.replace(old, new)
    with io.open(path, 'w', encoding='utf-8', newline=chr(10)) as f:
        f.write(t)
    print('patched', path)

# ── 4) stats / help / about：底栏单 tab 返回 ──
for pg in ['stats', 'help', 'about']:
    patch('src/pages/%s/%s.ux' % (pg, pg), [
        ("""    <div class="footer">
      <input type="button" value="返 回" class="btn-back"
             style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
             @click="goBack" />
    </div>""",
         """    <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
      <input type="button" value="返 回" class="tab"
             style="color:{{t.onSurface}}"
             @click="goBack" />
    </div>"""),
        ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
         '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
    ])
    patch('src/pages/%s/%s.css' % (pg, pg), [
        (""".btn-back {
  width: 168px;
  height: 46px;
  border-radius: 23px;
  border-width: 1px;
  font-size: 14px;
  background-color: transparent;
}

.footer {
  width: 168px;
  margin-top: 4px;
  flex-direction: row;
  justify-content: center;
}""",
         """.tab {
  flex: 1;
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}

.tabbar {
  width: 192px;
  height: 52px;
  border-top-width: 1px;
  flex-direction: row;
}"""),
        (""".page {
  width: 192px;
  height: 490px;
  flex-direction: column;
  align-items: center;
  padding-top: 24px;
  padding-bottom: 24px;
}""",
         """.page {
  width: 192px;
  height: 490px;
  flex-direction: column;
  align-items: center;
  padding-top: 24px;
  padding-bottom: 0px;
}"""),
    ])

# ── 5) monopoly / aeroplane：退出 tab 化 + 高度重算 ──
patch('src/pages/monopoly/monopoly.ux', [
    ("""        <input type="button" value="退出" class="act-exit"
               style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
               @click="exit" />
      </div>""",
     """      </div>

      <!-- 底部导航条 -->
      <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
        <input type="button" value="退出对局" class="tab"
               style="color:{{t.onSurfaceVariant}}"
               @click="exit" />
      </div>"""),
    ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
     '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
    ('      that.boardH = Math.max(200, l.designH - 190)',
     '      that.boardH = Math.max(180, l.designH - 210)'),
])
patch('src/pages/monopoly/monopoly.css', [
    (""".act-exit {
  width: 168px;
  height: 38px;
  margin-top: 6px;
  border-radius: 19px;
  border-width: 1px;
  font-size: 13px;
  background-color: transparent;
}""",
     """.tab {
  flex: 1;
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}

.tabbar {
  width: 192px;
  height: 52px;
  border-top-width: 1px;
  flex-direction: row;
}"""),
    (""".page {
  width: 192px;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  padding-bottom: 12px;
}""",
     """.page {
  width: 192px;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  padding-bottom: 0px;
}"""),
])
patch('src/pages/aeroplane/aeroplane.ux', [
    ("""        <input type="button" value="退出" class="act-exit"
               style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
               @click="exit" />
      </div>""",
     """      </div>

      <!-- 底部导航条 -->
      <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
        <input type="button" value="退出对局" class="tab"
               style="color:{{t.onSurfaceVariant}}"
               @click="exit" />
      </div>"""),
    ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
     '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
    ('      that.boardH = Math.max(200, l.designH - 190)',
     '      that.boardH = Math.max(170, l.designH - 235)'),
])
patch('src/pages/aeroplane/aeroplane.css', [
    (""".act-exit {
  width: 168px;
  height: 38px;
  margin-top: 4px;
  border-radius: 19px;
  border-width: 1px;
  font-size: 13px;
  background-color: transparent;
}""",
     """.tab {
  flex: 1;
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}

.tabbar {
  width: 192px;
  height: 52px;
  border-top-width: 1px;
  flex-direction: row;
}"""),
    (""".page {
  width: 192px;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  padding-bottom: 12px;
}""",
     """.page {
  width: 192px;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  padding-bottom: 0px;
}"""),
])
