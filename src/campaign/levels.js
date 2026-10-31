/**
 * campaign/levels.js — 闯关模式关卡数据（80 关 / 8 章 × 10 关）。
 * 纯数据：不依赖全局、不读 storage、不碰 UI（node 可直接 require）。
 * 章节：初见 / 攻守 / 残局 / 远征 / 深渊 / 终章 / 试炼 / 封王，每章 10 关。
 * 玩法覆盖：config.js 现有 15 款 + werewolf / snake / maze / spotdiff 共 19 款，
 *   每款至少 4 关（第 7/8 章各补一轮，凑满 80）。
 *
 * 字段：
 *   id         'c1-01'（章-关），全局唯一
 *   chapter    1~6
 *   index      章内序号 1~10
 *   game       玩法 id（与 utils/config.js GAME_TYPES 一致，含 4 款新玩法）
 *   mode       'ai' 人机 | 'solo' 单人
 *   difficulty 'easy' | 'normal' | 'hard'
 *   title/desc 关卡标题与目标文案（文案必须与 metric 一致）
 *   metric     'win'（取胜，星级按 moves 手数）
 *              'moves' / 'time' / 'steps'（越低越好）
 *              'score'（越高越好）
 *   star2      2 星阈值；star3 3 星阈值（1 星 = 通关）
 *   reward     首次 ≥1 星发放的棋币（重复通关不再发）
 */

var CHAPTERS = [
  { id: 1, name: '初见', desc: '认识每种玩法，先赢下一局。' },
  { id: 2, name: '攻守', desc: '对手开始认真，学会守住再反击。' },
  { id: 3, name: '残局', desc: '有限步数里找到唯一解。' },
  { id: 4, name: '远征', desc: '长局拉锯，耐心与手数同样重要。' },
  { id: 5, name: '深渊', desc: '高难度考验，容错率极低。' },
  { id: 6, name: '终章', desc: '最后一战，用最少的步数封王。' },
  { id: 7, name: '试炼', desc: '全玩法高阶试炼，逐项验证你的极限。' },
  { id: 8, name: '封王', desc: '最终二十关，用实力把名字刻进棋盘。' }
]

var LEVELS = [
  // ── 第 1 章 初见（easy） ──────────────────────────────────────────
  { id: 'c1-01', chapter: 1, index: 1, game: 'tictactoe', mode: 'ai', difficulty: 'easy', title: '三连入门', desc: '先连成三子取胜；9 手内 2 星、7 手内 3 星。', metric: 'win', star2: 9, star3: 7, reward: 20 },
  { id: 'c1-02', chapter: 1, index: 2, game: 'gomoku', mode: 'ai', difficulty: 'easy', title: '五子初探', desc: '先连成五子取胜；30 手内 2 星、22 手内 3 星。', metric: 'win', star2: 30, star3: 22, reward: 20 },
  { id: 'c1-03', chapter: 1, index: 3, game: 'connect4', mode: 'ai', difficulty: 'easy', title: '四子下坠', desc: '先连成四子取胜；30 手内 2 星、22 手内 3 星。', metric: 'win', star2: 30, star3: 22, reward: 20 },
  { id: 'c1-04', chapter: 1, index: 4, game: 'slide', mode: 'solo', difficulty: 'easy', title: '挪格初体验', desc: '把 1~8 归位；80 步内 2 星、50 步内 3 星。', metric: 'steps', star2: 80, star3: 50, reward: 20 },
  { id: 'c1-05', chapter: 1, index: 5, game: 'g2048', mode: 'solo', difficulty: 'easy', title: '合数起步', desc: '结束一局即通关；256 分 2 星、512 分 3 星。', metric: 'score', star2: 256, star3: 512, reward: 20 },
  { id: 'c1-06', chapter: 1, index: 6, game: 'spotdiff', mode: 'solo', difficulty: 'easy', title: '眼力初测', desc: '找出全部不同处；120 秒内 2 星、80 秒内 3 星。', metric: 'time', star2: 120, star3: 80, reward: 20 },
  { id: 'c1-07', chapter: 1, index: 7, game: 'maze', mode: 'solo', difficulty: 'easy', title: '迷宫小径', desc: '走到出口；60 步内 2 星、40 步内 3 星。', metric: 'steps', star2: 60, star3: 40, reward: 20 },
  { id: 'c1-08', chapter: 1, index: 8, game: 'snake', mode: 'ai', difficulty: 'easy', title: '灵蛇初游', desc: '比 AI 先到终点；40 轮内 2 星、32 轮内 3 星。', metric: 'moves', star2: 40, star3: 32, reward: 20 },
  { id: 'c1-09', chapter: 1, index: 9, game: 'minesweeper', mode: 'solo', difficulty: 'easy', title: '排雷入门', desc: '翻开全部安全格；150 秒内 2 星、100 秒内 3 星。', metric: 'time', star2: 150, star3: 100, reward: 20 },
  { id: 'c1-10', chapter: 1, index: 10, game: 'sudoku', mode: 'solo', difficulty: 'easy', title: '数独九宫', desc: '填满且无冲突；900 秒内 2 星、600 秒内 3 星。', metric: 'time', star2: 900, star3: 600, reward: 20 },

  // ── 第 2 章 攻守（normal） ────────────────────────────────────────
  { id: 'c2-01', chapter: 2, index: 1, game: 'othello', mode: 'ai', difficulty: 'normal', title: '夹翻初战', desc: '终局子多者胜；40 手内 2 星、30 手内 3 星。', metric: 'win', star2: 40, star3: 30, reward: 30 },
  { id: 'c2-02', chapter: 2, index: 2, game: 'draughts', mode: 'ai', difficulty: 'normal', title: '强制吃子', desc: '吃光或困死对手；50 手内 2 星、38 手内 3 星。', metric: 'win', star2: 50, star3: 38, reward: 30 },
  { id: 'c2-03', chapter: 2, index: 3, game: 'jungle', mode: 'ai', difficulty: 'normal', title: '兽穴争夺', desc: '攻入对方兽穴取胜；45 手内 2 星、34 手内 3 星。', metric: 'win', star2: 45, star3: 34, reward: 30 },
  { id: 'c2-04', chapter: 2, index: 4, game: 'chess', mode: 'ai', difficulty: 'normal', title: '将死之始', desc: '将死对方王取胜；60 手内 2 星、45 手内 3 星。', metric: 'win', star2: 60, star3: 45, reward: 30 },
  { id: 'c2-05', chapter: 2, index: 5, game: 'go', mode: 'ai', difficulty: 'normal', title: '围地初盘', desc: '终局子空多者胜；70 手内 2 星、50 手内 3 星。', metric: 'win', star2: 70, star3: 50, reward: 30 },
  { id: 'c2-06', chapter: 2, index: 6, game: 'tictactoe', mode: 'ai', difficulty: 'normal', title: '三连博弈', desc: '先连成三子取胜；9 手内 2 星、5 手内 3 星。', metric: 'win', star2: 9, star3: 5, reward: 30 },
  { id: 'c2-07', chapter: 2, index: 7, game: 'gomoku', mode: 'ai', difficulty: 'normal', title: '五子攻防', desc: '先连成五子取胜；26 手内 2 星、18 手内 3 星。', metric: 'win', star2: 26, star3: 18, reward: 30 },
  { id: 'c2-08', chapter: 2, index: 8, game: 'othello', mode: 'ai', difficulty: 'normal', title: '边角之争', desc: '终局子多者胜；36 手内 2 星、26 手内 3 星。', metric: 'win', star2: 36, star3: 26, reward: 30 },
  { id: 'c2-09', chapter: 2, index: 9, game: 'connect4', mode: 'ai', difficulty: 'normal', title: '四子对抗', desc: '先连成四子取胜；26 手内 2 星、18 手内 3 星。', metric: 'win', star2: 26, star3: 18, reward: 30 },
  { id: 'c2-10', chapter: 2, index: 10, game: 'spotdiff', mode: 'solo', difficulty: 'normal', title: '双图寻异', desc: '找出全部不同处；90 秒内 2 星、60 秒内 3 星。', metric: 'time', star2: 90, star3: 60, reward: 30 },

  // ── 第 3 章 残局（normal / hard） ─────────────────────────────────
  { id: 'c3-01', chapter: 3, index: 1, game: 'chess', mode: 'ai', difficulty: 'normal', title: '残局一击', desc: '将死对方王取胜；40 手内 2 星、28 手内 3 星。', metric: 'win', star2: 40, star3: 28, reward: 30 },
  { id: 'c3-02', chapter: 3, index: 2, game: 'go', mode: 'ai', difficulty: 'normal', title: '收官之争', desc: '终局子空多者胜；60 手内 2 星、44 手内 3 星。', metric: 'win', star2: 60, star3: 44, reward: 30 },
  { id: 'c3-03', chapter: 3, index: 3, game: 'draughts', mode: 'ai', difficulty: 'hard', title: '连吃成链', desc: '吃光或困死对手；40 手内 2 星、28 手内 3 星。', metric: 'win', star2: 40, star3: 28, reward: 40 },
  { id: 'c3-04', chapter: 3, index: 4, game: 'jungle', mode: 'ai', difficulty: 'hard', title: '陷阱伏击', desc: '攻入对方兽穴取胜；36 手内 2 星、26 手内 3 星。', metric: 'win', star2: 36, star3: 26, reward: 40 },
  { id: 'c3-05', chapter: 3, index: 5, game: 'minesweeper', mode: 'solo', difficulty: 'normal', title: '雷区突围', desc: '翻开全部安全格；120 秒内 2 星、80 秒内 3 星。', metric: 'time', star2: 120, star3: 80, reward: 30 },
  { id: 'c3-06', chapter: 3, index: 6, game: 'sudoku', mode: 'solo', difficulty: 'normal', title: '数理推演', desc: '填满且无冲突；720 秒内 2 星、480 秒内 3 星。', metric: 'time', star2: 720, star3: 480, reward: 30 },
  { id: 'c3-07', chapter: 3, index: 7, game: 'slide', mode: 'solo', difficulty: 'normal', title: '归位提速', desc: '把 1~8 归位；60 步内 2 星、40 步内 3 星。', metric: 'steps', star2: 60, star3: 40, reward: 30 },
  { id: 'c3-08', chapter: 3, index: 8, game: 'sokoban', mode: 'solo', difficulty: 'normal', title: '箱入库位', desc: '把所有箱子推进目标点；120 步内 2 星、80 步内 3 星。', metric: 'steps', star2: 120, star3: 80, reward: 30 },
  { id: 'c3-09', chapter: 3, index: 9, game: 'maze', mode: 'solo', difficulty: 'hard', title: '深巷迷途', desc: '走到出口；100 步内 2 星、60 步内 3 星。', metric: 'steps', star2: 100, star3: 60, reward: 40 },
  { id: 'c3-10', chapter: 3, index: 10, game: 'werewolf', mode: 'ai', difficulty: 'normal', title: '月下疑云', desc: '放逐全部狼人取胜；18 手内 2 星、12 手内 3 星。', metric: 'win', star2: 18, star3: 12, reward: 30 },

  // ── 第 4 章 远征（normal / hard） ─────────────────────────────────
  { id: 'c4-01', chapter: 4, index: 1, game: 'aeroplane', mode: 'ai', difficulty: 'normal', title: '起飞远征', desc: '四机全部到家取胜；90 手内 2 星、65 手内 3 星。', metric: 'win', star2: 90, star3: 65, reward: 30 },
  { id: 'c4-02', chapter: 4, index: 2, game: 'monopoly', mode: 'ai', difficulty: 'normal', title: '买地远征', desc: '让对手破产取胜；100 手内 2 星、70 手内 3 星。', metric: 'win', star2: 100, star3: 70, reward: 30 },
  { id: 'c4-03', chapter: 4, index: 3, game: 'sokoban', mode: 'solo', difficulty: 'hard', title: '连环推箱', desc: '把所有箱子推进目标点；150 步内 2 星、110 步内 3 星。', metric: 'steps', star2: 150, star3: 110, reward: 40 },
  { id: 'c4-04', chapter: 4, index: 4, game: 'snake', mode: 'ai', difficulty: 'hard', title: '长蛇盘踞', desc: '比 AI 先到终点；36 轮内 2 星、28 轮内 3 星。', metric: 'moves', star2: 36, star3: 28, reward: 40 },
  { id: 'c4-05', chapter: 4, index: 5, game: 'werewolf', mode: 'ai', difficulty: 'hard', title: '暗夜裁决', desc: '放逐全部狼人取胜；15 手内 2 星、10 手内 3 星。', metric: 'win', star2: 15, star3: 10, reward: 40 },
  { id: 'c4-06', chapter: 4, index: 6, game: 'chess', mode: 'ai', difficulty: 'hard', title: '王城攻防', desc: '将死对方王取胜；50 手内 2 星、36 手内 3 星。', metric: 'win', star2: 50, star3: 36, reward: 40 },
  { id: 'c4-07', chapter: 4, index: 7, game: 'go', mode: 'ai', difficulty: 'hard', title: '大龙生死', desc: '终局子空多者胜；55 手内 2 星、40 手内 3 星。', metric: 'win', star2: 55, star3: 40, reward: 40 },
  { id: 'c4-08', chapter: 4, index: 8, game: 'othello', mode: 'ai', difficulty: 'hard', title: '翻盘之战', desc: '终局子多者胜；32 手内 2 星、22 手内 3 星。', metric: 'win', star2: 32, star3: 22, reward: 40 },
  { id: 'c4-09', chapter: 4, index: 9, game: 'g2048', mode: 'solo', difficulty: 'normal', title: '千位之门', desc: '结束一局即通关；512 分 2 星、1024 分 3 星。', metric: 'score', star2: 512, star3: 1024, reward: 30 },
  { id: 'c4-10', chapter: 4, index: 10, game: 'draughts', mode: 'ai', difficulty: 'hard', title: '王者之路', desc: '吃光或困死对手；36 手内 2 星、26 手内 3 星。', metric: 'win', star2: 36, star3: 26, reward: 40 },

  // ── 第 5 章 深渊（hard） ─────────────────────────────────────────
  { id: 'c5-01', chapter: 5, index: 1, game: 'gomoku', mode: 'ai', difficulty: 'hard', title: '深渊五连', desc: '先连成五子取胜；22 手内 2 星、15 手内 3 星。', metric: 'win', star2: 22, star3: 15, reward: 40 },
  { id: 'c5-02', chapter: 5, index: 2, game: 'connect4', mode: 'ai', difficulty: 'hard', title: '深渊四子', desc: '先连成四子取胜；22 手内 2 星、15 手内 3 星。', metric: 'win', star2: 22, star3: 15, reward: 40 },
  { id: 'c5-03', chapter: 5, index: 3, game: 'tictactoe', mode: 'ai', difficulty: 'hard', title: '完美三连', desc: '先连成三子取胜；7 手内 2 星、5 手内 3 星。', metric: 'win', star2: 7, star3: 5, reward: 40 },
  { id: 'c5-04', chapter: 5, index: 4, game: 'monopoly', mode: 'ai', difficulty: 'hard', title: '地产深渊', desc: '让对手破产取胜；80 手内 2 星、55 手内 3 星。', metric: 'win', star2: 80, star3: 55, reward: 40 },
  { id: 'c5-05', chapter: 5, index: 5, game: 'aeroplane', mode: 'ai', difficulty: 'normal', title: '冲刺归航', desc: '四机全部到家取胜；75 手内 2 星、55 手内 3 星。', metric: 'win', star2: 75, star3: 55, reward: 40 },
  { id: 'c5-06', chapter: 5, index: 6, game: 'g2048', mode: 'solo', difficulty: 'hard', title: '深渊合数', desc: '结束一局即通关；1024 分 2 星、2048 分 3 星。', metric: 'score', star2: 1024, star3: 2048, reward: 40 },
  { id: 'c5-07', chapter: 5, index: 7, game: 'slide', mode: 'solo', difficulty: 'hard', title: '极限归位', desc: '把 1~8 归位；45 步内 2 星、30 步内 3 星。', metric: 'steps', star2: 45, star3: 30, reward: 40 },
  { id: 'c5-08', chapter: 5, index: 8, game: 'minesweeper', mode: 'solo', difficulty: 'hard', title: '深渊雷场', desc: '翻开全部安全格；100 秒内 2 星、70 秒内 3 星。', metric: 'time', star2: 100, star3: 70, reward: 40 },
  { id: 'c5-09', chapter: 5, index: 9, game: 'sudoku', mode: 'solo', difficulty: 'hard', title: '地狱数独', desc: '填满且无冲突；600 秒内 2 星、420 秒内 3 星。', metric: 'time', star2: 600, star3: 420, reward: 40 },
  { id: 'c5-10', chapter: 5, index: 10, game: 'spotdiff', mode: 'solo', difficulty: 'hard', title: '深渊一瞥', desc: '找出全部不同处；60 秒内 2 星、40 秒内 3 星。', metric: 'time', star2: 60, star3: 40, reward: 40 },

  // ── 第 6 章 终章（hard） ─────────────────────────────────────────
  { id: 'c6-01', chapter: 6, index: 1, game: 'chess', mode: 'ai', difficulty: 'hard', title: '终章王棋', desc: '将死对方王取胜；40 手内 2 星、28 手内 3 星。', metric: 'win', star2: 40, star3: 28, reward: 40 },
  { id: 'c6-02', chapter: 6, index: 2, game: 'go', mode: 'ai', difficulty: 'hard', title: '终章围空', desc: '终局子空多者胜；50 手内 2 星、36 手内 3 星。', metric: 'win', star2: 50, star3: 36, reward: 40 },
  { id: 'c6-03', chapter: 6, index: 3, game: 'draughts', mode: 'ai', difficulty: 'hard', title: '终章王跳', desc: '吃光或困死对手；32 手内 2 星、22 手内 3 星。', metric: 'win', star2: 32, star3: 22, reward: 40 },
  { id: 'c6-04', chapter: 6, index: 4, game: 'jungle', mode: 'ai', difficulty: 'hard', title: '终章兽王', desc: '攻入对方兽穴取胜；30 手内 2 星、22 手内 3 星。', metric: 'win', star2: 30, star3: 22, reward: 40 },
  { id: 'c6-05', chapter: 6, index: 5, game: 'werewolf', mode: 'ai', difficulty: 'hard', title: '终章月影', desc: '放逐全部狼人取胜；12 手内 2 星、8 手内 3 星。', metric: 'win', star2: 12, star3: 8, reward: 40 },
  { id: 'c6-06', chapter: 6, index: 6, game: 'snake', mode: 'ai', difficulty: 'hard', title: '终章长蛇', desc: '比 AI 先到终点；34 轮内 2 星、26 轮内 3 星。', metric: 'moves', star2: 34, star3: 26, reward: 40 },
  { id: 'c6-07', chapter: 6, index: 7, game: 'maze', mode: 'solo', difficulty: 'hard', title: '终章迷城', desc: '走到出口；80 步内 2 星、50 步内 3 星。', metric: 'steps', star2: 80, star3: 50, reward: 40 },
  { id: 'c6-08', chapter: 6, index: 8, game: 'sokoban', mode: 'solo', difficulty: 'hard', title: '终章箱阵', desc: '把所有箱子推进目标点；140 步内 2 星、100 步内 3 星。', metric: 'steps', star2: 140, star3: 100, reward: 40 },
  { id: 'c6-09', chapter: 6, index: 9, game: 'aeroplane', mode: 'ai', difficulty: 'hard', title: '终章飞行', desc: '四机全部到家取胜；70 手内 2 星、50 手内 3 星。', metric: 'win', star2: 70, star3: 50, reward: 40 },
  { id: 'c6-10', chapter: 6, index: 10, game: 'monopoly', mode: 'ai', difficulty: 'hard', title: '终章大亨', desc: '让对手破产取胜；70 手内 2 星、50 手内 3 星。', metric: 'win', star2: 70, star3: 50, reward: 40 },

  // ── 第 7 章 试炼（hard，每款玩法再加一关） ──────────────────────
  { id: 'c7-01', chapter: 7, index: 1, game: 'chess', mode: 'ai', difficulty: 'hard', title: '试炼王棋', desc: '将死对方王取胜；45 手内 2 星、32 手内 3 星。', metric: 'win', star2: 45, star3: 32, reward: 60 },
  { id: 'c7-02', chapter: 7, index: 2, game: 'go', mode: 'ai', difficulty: 'hard', title: '试炼围空', desc: '终局子空多者胜；55 手内 2 星、40 手内 3 星。', metric: 'win', star2: 55, star3: 40, reward: 60 },
  { id: 'c7-03', chapter: 7, index: 3, game: 'draughts', mode: 'ai', difficulty: 'hard', title: '试炼王跳', desc: '吃光或困死对手；34 手内 2 星、24 手内 3 星。', metric: 'win', star2: 34, star3: 24, reward: 60 },
  { id: 'c7-04', chapter: 7, index: 4, game: 'jungle', mode: 'ai', difficulty: 'hard', title: '试炼兽穴', desc: '攻入对方兽穴取胜；32 手内 2 星、22 手内 3 星。', metric: 'win', star2: 32, star3: 22, reward: 60 },
  { id: 'c7-05', chapter: 7, index: 5, game: 'othello', mode: 'ai', difficulty: 'hard', title: '试炼翻盘', desc: '终局子多者胜；30 手内 2 星、20 手内 3 星。', metric: 'win', star2: 30, star3: 20, reward: 60 },
  { id: 'c7-06', chapter: 7, index: 6, game: 'connect4', mode: 'ai', difficulty: 'hard', title: '试炼四连', desc: '先连成四子取胜；24 手内 2 星、16 手内 3 星。', metric: 'win', star2: 24, star3: 16, reward: 60 },
  { id: 'c7-07', chapter: 7, index: 7, game: 'gomoku', mode: 'ai', difficulty: 'hard', title: '试炼五连', desc: '先连成五子取胜；24 手内 2 星、16 手内 3 星。', metric: 'win', star2: 24, star3: 16, reward: 60 },
  { id: 'c7-08', chapter: 7, index: 8, game: 'tictactoe', mode: 'ai', difficulty: 'hard', title: '试炼三连', desc: '先连成三子取胜；9 手内 2 星、5 手内 3 星。', metric: 'win', star2: 9, star3: 5, reward: 60 },
  { id: 'c7-09', chapter: 7, index: 9, game: 'aeroplane', mode: 'ai', difficulty: 'hard', title: '试炼飞行', desc: '四机全部到家取胜；80 手内 2 星、55 手内 3 星。', metric: 'win', star2: 80, star3: 55, reward: 60 },
  { id: 'c7-10', chapter: 7, index: 10, game: 'monopoly', mode: 'ai', difficulty: 'hard', title: '试炼大亨', desc: '让对手破产取胜；90 手内 2 星、60 手内 3 星。', metric: 'win', star2: 90, star3: 60, reward: 60 },

  // ── 第 8 章 封王（hard，单人/推理玩法收尾） ─────────────────────
  { id: 'c8-01', chapter: 8, index: 1, game: 'g2048', mode: 'solo', difficulty: 'hard', title: '封王合数', desc: '结束一局即通关；1024 分 2 星、2048 分 3 星。', metric: 'score', star2: 1024, star3: 2048, reward: 60 },
  { id: 'c8-02', chapter: 8, index: 2, game: 'slide', mode: 'solo', difficulty: 'hard', title: '封王归位', desc: '把 1~8 归位；50 步内 2 星、32 步内 3 星。', metric: 'steps', star2: 50, star3: 32, reward: 60 },
  { id: 'c8-03', chapter: 8, index: 3, game: 'minesweeper', mode: 'solo', difficulty: 'hard', title: '封王雷场', desc: '翻开全部安全格；120 秒内 2 星、80 秒内 3 星。', metric: 'time', star2: 120, star3: 80, reward: 60 },
  { id: 'c8-04', chapter: 8, index: 4, game: 'sokoban', mode: 'solo', difficulty: 'hard', title: '封王箱阵', desc: '把所有箱子推进目标点；150 步内 2 星、110 步内 3 星。', metric: 'steps', star2: 150, star3: 110, reward: 60 },
  { id: 'c8-05', chapter: 8, index: 5, game: 'sudoku', mode: 'solo', difficulty: 'hard', title: '封王数独', desc: '填满且无冲突；600 秒内 2 星、420 秒内 3 星。', metric: 'time', star2: 600, star3: 420, reward: 60 },
  { id: 'c8-06', chapter: 8, index: 6, game: 'werewolf', mode: 'ai', difficulty: 'hard', title: '封王月影', desc: '放逐全部狼人取胜；14 手内 2 星、9 手内 3 星。', metric: 'win', star2: 14, star3: 9, reward: 60 },
  { id: 'c8-07', chapter: 8, index: 7, game: 'snake', mode: 'ai', difficulty: 'hard', title: '封王长蛇', desc: '比 AI 先到终点；34 轮内 2 星、26 轮内 3 星。', metric: 'moves', star2: 34, star3: 26, reward: 60 },
  { id: 'c8-08', chapter: 8, index: 8, game: 'maze', mode: 'solo', difficulty: 'hard', title: '封王迷城', desc: '走到出口；110 步内 2 星、70 步内 3 星。', metric: 'steps', star2: 110, star3: 70, reward: 60 },
  { id: 'c8-09', chapter: 8, index: 9, game: 'spotdiff', mode: 'solo', difficulty: 'hard', title: '封王一瞥', desc: '找出全部不同处；75 秒内 2 星、50 秒内 3 星。', metric: 'time', star2: 75, star3: 50, reward: 60 },
  { id: 'c8-10', chapter: 8, index: 10, game: 'gomoku', mode: 'ai', difficulty: 'hard', title: '封王五连', desc: '先连成五子取胜；20 手内 2 星、12 手内 3 星。', metric: 'win', star2: 20, star3: 12, reward: 100 }
]

module.exports = { CHAPTERS: CHAPTERS, LEVELS: LEVELS }
