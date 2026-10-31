/**
 * puzzles/chess.js — 国际象棋残局题库（白先二步杀，共 10 题）。
 * 数据约定：
 *   board：规则层同款 9 行数组（j=0 黑方底线、j=7 白方底线；第 8 行为对局元数据行）；
 *   turn：解题方（固定 1 白）；goal：固定 'mate'；
 *   moveLimit：解题方手数上限（固定 2，即「二步杀」）；
 *   solution：完整 ply 序列，含防守方应手，最后一手形成将死；
 *   solution[k] = { turn, move }，move 为规则层同款 { i, j, fi, fj }，可按 ply 直接取作提示。
 * difficulty：按局面子力规模粗分（≤6 子 easy / 7 子 normal / ≥8 子 hard）。
 * 生成与校验：项目外脚本用 rules/chess.js 随机紧凑局面 + 强制杀搜索，
 *   要求首着将军、黑方「唯一合法应手」且该应手后白方一步将死（真强制杀、线路唯一），
 *   再逐手回放确认将死。
 * 纯数据模块：不引用全局、不读 storage、不碰 UI。
 */

var CHESS_PUZZLES = [
  {
    id: 'chess-01',
    game: 'chess',
    name: '白先二步杀·一',
    difficulty: 'hard',
    board: [
      [0, 0, 0, 0, 0, 12, 0, 0],
      [0, 0, 0, 0, 7, 0, 0, 0],
      [0, 0, 5, 0, 7, 7, 0, 0],
      [0, 0, 0, 0, 0, 0, 4, 0],
      [0, 0, 0, 2, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 6, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 0, j: 0, fi: 2, fj: 2 } },
      { turn: 2, move: { i: 5, j: 1, fi: 5, fj: 0 } },
      { turn: 1, move: { i: 6, j: 0, fi: 0, fj: 0 } }
    ]
  },
  {
    id: 'chess-02',
    game: 'chess',
    name: '白先二步杀·二',
    difficulty: 'normal',
    board: [
      [0, 0, 0, 0, 12, 0, 0, 0],
      [0, 0, 0, 0, 0, 9, 0, 0],
      [0, 0, 0, 0, 7, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 5, 0, 0, 0, 0, 0, 0],
      [0, 6, 0, 4, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 2, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 1, j: 0, fi: 1, fj: 4 } },
      { turn: 2, move: { i: 4, j: 1, fi: 4, fj: 0 } },
      { turn: 1, move: { i: 3, j: 0, fi: 1, fj: 0 } }
    ]
  },
  {
    id: 'chess-03',
    game: 'chess',
    name: '白先二步杀·三',
    difficulty: 'hard',
    board: [
      [0, 0, 12, 0, 0, 0, 0, 0],
      [0, 0, 7, 7, 0, 2, 0, 0],
      [0, 0, 0, 8, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 4, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 6, 0],
      [5, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 7, j: 0, fi: 0, fj: 7 } },
      { turn: 2, move: { i: 4, j: 0, fi: 3, fj: 2 } },
      { turn: 1, move: { i: 4, j: 0, fi: 7, fj: 0 } }
    ]
  },
  {
    id: 'chess-04',
    game: 'chess',
    name: '白先二步杀·四',
    difficulty: 'hard',
    board: [
      [0, 0, 12, 0, 2, 0, 0, 0],
      [0, 0, 7, 0, 0, 0, 0, 0],
      [0, 9, 0, 7, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 0, 0, 0, 4, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 6, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 0, j: 0, fi: 0, fj: 5 } },
      { turn: 2, move: { i: 3, j: 1, fi: 2, fj: 0 } },
      { turn: 1, move: { i: 5, j: 2, fi: 4, fj: 0 } }
    ]
  },
  {
    id: 'chess-05',
    game: 'chess',
    name: '白先二步杀·五',
    difficulty: 'normal',
    board: [
      [12, 0, 0, 0, 0, 0, 0, 0],
      [7, 9, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [6, 0, 0, 0, 0, 5, 0, 0],
      [0, 0, 2, 0, 0, 0, 0, 0],
      [0, 4, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 5, j: 0, fi: 5, fj: 5 } },
      { turn: 2, move: { i: 2, j: 0, fi: 1, fj: 1 } },
      { turn: 1, move: { i: 2, j: 0, fi: 5, fj: 0 } }
    ]
  },
  {
    id: 'chess-06',
    game: 'chess',
    name: '白先二步杀·六',
    difficulty: 'hard',
    board: [
      [0, 0, 0, 0, 2, 0, 0, 12],
      [0, 0, 0, 0, 0, 0, 8, 9],
      [0, 0, 0, 0, 0, 0, 7, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 0, 0, 0, 0, 0, 6, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 4, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 5, j: 0, fi: 0, fj: 5 } },
      { turn: 2, move: { i: 6, j: 0, fi: 7, fj: 1 } },
      { turn: 1, move: { i: 6, j: 1, fi: 5, fj: 0 } }
    ]
  },
  {
    id: 'chess-07',
    game: 'chess',
    name: '白先二步杀·七',
    difficulty: 'normal',
    board: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 12],
      [0, 0, 0, 0, 5, 0, 0, 7],
      [0, 0, 0, 0, 0, 0, 7, 0],
      [0, 0, 0, 0, 0, 0, 0, 4],
      [0, 0, 0, 0, 0, 0, 0, 2],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 6],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 5, j: 1, fi: 4, fj: 2 } },
      { turn: 2, move: { i: 7, j: 0, fi: 7, fj: 1 } },
      { turn: 1, move: { i: 7, j: 2, fi: 7, fj: 4 } }
    ]
  },
  {
    id: 'chess-08',
    game: 'chess',
    name: '白先二步杀·八',
    difficulty: 'normal',
    board: [
      [0, 0, 0, 0, 0, 0, 12, 0],
      [0, 0, 0, 4, 0, 8, 9, 7],
      [0, 0, 0, 0, 5, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [6, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 5, j: 1, fi: 4, fj: 2 } },
      { turn: 2, move: { i: 7, j: 0, fi: 6, fj: 0 } },
      { turn: 1, move: { i: 6, j: 1, fi: 5, fj: 1 } }
    ]
  },
  {
    id: 'chess-09',
    game: 'chess',
    name: '白先二步杀·九',
    difficulty: 'normal',
    board: [
      [0, 12, 0, 0, 0, 0, 0, 0],
      [0, 7, 0, 0, 0, 0, 0, 0],
      [7, 0, 5, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [6, 4, 0, 0, 0, 0, 2, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 1, j: 1, fi: 1, fj: 6 } },
      { turn: 2, move: { i: 0, j: 0, fi: 1, fj: 0 } },
      { turn: 1, move: { i: 0, j: 2, fi: 2, fj: 2 } }
    ]
  },
  {
    id: 'chess-10',
    game: 'chess',
    name: '白先二步杀·十',
    difficulty: 'normal',
    board: [
      [12, 0, 0, 0, 0, 0, 0, 0],
      [0, 7, 0, 0, 0, 0, 0, 0],
      [0, 7, 0, 0, 0, 0, 4, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 5, 2],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 6, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, -1]
    ],
    turn: 1,
    goal: 'mate',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 6, j: 0, fi: 6, fj: 2 } },
      { turn: 2, move: { i: 0, j: 1, fi: 0, fj: 0 } },
      { turn: 1, move: { i: 0, j: 4, fi: 6, fj: 4 } }
    ]
  }
]

module.exports = CHESS_PUZZLES
