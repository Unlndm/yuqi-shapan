# scripts/patch-tabbar.py — 底部导航统一为固定 tab 栏（一次性迁移）
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


# ── 1) 对局页：缩放按钮移到棋盘之后（置顶显示）+ 底栏化 ──
patch('src/pages/game/game.ux', [
    # 缩放 FAB 移到 board-wrap 之后（DOM 靠后 = 显示在上层，不被棋盘遮挡）
    ("""        <div class="zoom-fab">
          <input type="button" value="＋" class="zbtn" disabled="{{zoomIdx >= 3}}"
                 style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
                 @click="zoomIn" />
          <input type="button" value="－" class="zbtn" disabled="{{zoomIdx <= 0}}"
                 style="color:{{t.onSurfaceVariant}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
                 @click="zoomOut" />
        </div>
        <div class="board-wrap\"""",
     """        <div class="board-wrap\""""),
    ("""          </block>
        </div>
      </div>""",
     """          </block>
        </div>
        <div class="zoom-fab">
          <input type="button" value="＋" class="zbtn" disabled="{{zoomIdx >= 3}}"
                 style="color:{{t.onSurface}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
                 @click="zoomIn" />
          <input type="button" value="－" class="zbtn" disabled="{{zoomIdx <= 0}}"
                 style="color:{{t.onSurfaceVariant}};background-color:{{t.surfaceContainerHigh}};border-color:{{t.outline}}"
                 @click="zoomOut" />
        </div>
      </div>"""),
    # 底栏化：固定 52px 导航条，按钮等分
    ("""      <!-- 底部：悔棋 /（围棋）停一手 / 重开 / 退出 -->
      <div class="footer">
        <input type="button" value="悔棋" class="fbtn"
               disabled="{{!canUndo}}"
               style="width:{{hasPass ? 41 : 54}}px;color:{{t.onSurface}};border-color:{{t.outline}}"
               @click="undo" />
        <input type="button" value="停手" class="fbtn" if="{{hasPass}}"
               style="width:40px;color:{{t.onSurface}};border-color:{{t.outline}}"
               @click="passTurn" />
        <input type="button" value="重开" class="fbtn"
               style="width:{{hasPass ? 41 : 54}}px;color:{{t.onPrimary}};background-color:{{t.primaryContainer}};border-color:{{t.primaryContainer}}"
               @click="restart" />
        <input type="button" value="退出" class="fbtn"
               style="width:{{hasPass ? 41 : 54}}px;color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
               @click="exit" />
      </div>""",
     """      <!-- 底部导航条（固定）：悔棋 /（围棋）停手 / 重开 / 退出 -->
      <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
        <input type="button" value="悔棋" class="tab" disabled="{{!canUndo}}"
               style="color:{{t.onSurface}}"
               @click="undo" />
        <input type="button" value="停手" class="tab" if="{{hasPass}}"
               style="color:{{t.onSurface}}"
               @click="passTurn" />
        <input type="button" value="重开" class="tab"
               style="color:{{t.primary}}"
               @click="restart" />
        <input type="button" value="退出" class="tab"
               style="color:{{t.onSurfaceVariant}}"
               @click="exit" />
      </div>"""),
    # 视口高度：底栏 52 + padding-bottom 0
    ("      that.vpH = Math.max(160, l.designH - 140)",
     "      that.vpH = Math.max(160, l.designH - 116)"),
    # 根容器底部不留白，底栏贴边
    ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
     '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
])
patch('src/pages/game/game.css', [
    ("""/* 缩放按钮：浮动于棋盘视口右上角 */
.zoom-fab {
  position: absolute;
  right: 4px;
  top: 4px;
  flex-direction: column;
  align-items: center;
}""",
     """/* 缩放按钮：浮动于棋盘视口右上角（DOM 在棋盘之后，确保置顶） */
.zoom-fab {
  position: absolute;
  right: 4px;
  top: 4px;
  flex-direction: column;
  align-items: center;
}"""),
    (""".fbtn {
  width: 52px;
  height: 48px;
  border-radius: 16px;
  border-width: 1px;
  font-size: 14px;
  background-color: transparent;
}""",
     """.tab {
  flex: 1;
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}"""),
    (""".footer {
  width: 168px;
  margin-top: 8px;
  flex-direction: row;
  justify-content: space-between;
}""",
     """.tabbar {
  width: 192px;
  height: 52px;
  border-top-width: 1px;
  flex-direction: row;
}"""),
    # 根容器底 padding 收 0（由模板内联覆盖，CSS 同步）
    (""".page {
  width: 192px;
  height: 490px;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
  padding-bottom: 20px;
}""",
     """.page {
  width: 192px;
  height: 490px;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
  padding-bottom: 0px;
}"""),
])

# ── 2) 主界面：底栏 tab 化 ──
patch('src/pages/index/index.ux', [
    ("""    <div class="footer">
      <input type="button" value="战绩" class="btn-half"
             style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
             @click="openStats" />
      <input type="button" value="设 置" class="btn-half"
             style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
             @click="openSettings" />
    </div>""",
     """    <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
      <input type="button" value="战 绩" class="tab"
             style="color:{{t.onSurface}}"
             @click="openStats" />
      <input type="button" value="设 置" class="tab"
             style="color:{{t.onSurface}}"
             @click="openSettings" />
    </div>"""),
    # 根容器底部收 0
    ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
     '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
])
patch('src/pages/index/index.css', [
    (""".btn-half {
  width: 82px;
  height: 48px;
  border-radius: 24px;
  border-width: 1px;
  font-size: 14px;
  background-color: transparent;
}""",
     """.tab {
  flex: 1;
  height: 52px;
  line-height: 52px;
  text-align: center;
  font-size: 14px;
  background-color: transparent;
}"""),
    (""".footer {
  width: 168px;
  margin-top: 4px;
  flex-direction: row;
  justify-content: space-between;
}""",
     """.tabbar {
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
    ('.cards {\n  flex: 1;\n  margin-top: 12px;\n  width: 168px;\n  flex-direction: column;\n}',
     '.cards {\n  flex: 1;\n  margin-top: 12px;\n  width: 168px;\n  padding-bottom: 10px;\n  flex-direction: column;\n}'),
])

# ── 3) settings：底栏三 tab（玩法 / 关于 / 返回），正文里的按钮移除 ──
patch('src/pages/settings/settings.ux', [
    ("""
      <!-- 玩法介绍 / 关于（入口收拢至设置页） -->
      <input type="button" class="btn-link" value="玩法介绍"
             style="color:{{t.onSurface}};border-color:{{t.outline}}"
             @click="openHelp" />
      <input type="button" class="btn-link" value="关于"
             style="color:{{t.onSurface}};border-color:{{t.outline}}"
             @click="openAbout" />
""",
     """
"""),
    ("""    <div class="footer">
      <input type="button" value="返 回" class="btn-back"
             style="color:{{t.onSurfaceVariant}};border-color:{{t.outline}}"
             @click="goBack" />
    </div>""",
     """    <div class="tabbar" style="background-color:{{t.surfaceContainer}};border-top-color:{{t.outline}}">
      <input type="button" value="玩法" class="tab"
             style="color:{{t.onSurface}}"
             @click="openHelp" />
      <input type="button" value="关于" class="tab"
             style="color:{{t.onSurface}}"
             @click="openAbout" />
      <input type="button" value="返 回" class="tab"
             style="color:{{t.onSurface}}"
             @click="goBack" />
    </div>"""),
    ('  <div class="page" style="height:{{pageH}}px;background-color:{{t.surface}}">',
     '  <div class="page" style="height:{{pageH}}px;padding-bottom:0px;background-color:{{t.surface}}">'),
])
patch('src/pages/settings/settings.css', [
    (""".btn-link {
  width: 168px;
  height: 46px;
  margin-top: 8px;
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
    (""".btn-back {
  width: 168px;
  height: 46px;
  border-radius: 23px;
  border-width: 1px;
  font-size: 14px;
  background-color: transparent;
}

""",
     ""),
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
