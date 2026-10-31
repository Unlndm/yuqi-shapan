/**
 * puzzles/gomoku.js — 五子棋残局题库（黑先必胜，共 10 题）。
 * 数据约定：
 *   board：7×7 / 9×9 数组，board[j][i]，0 空 / 1 黑 / 2 白；
 *   turn：解题方（固定 1 黑）；goal：固定 'win'（五连胜）；
 *   moveLimit：黑方手数上限（2~5）；
 *   solution：完整 ply 序列，黑白交替，含防守方应手，最后一手形成五连；
 *   solution[k] = { turn, move }，move 为 { i, j }，可按 ply 直接取作提示。
 * 生成与校验：项目外脚本按 VCF（连续成四）搜索强制胜 ——
 *   黑方每一手都必须制造四，白方除挡之外任何应手都会被黑立即成五；
 *   优先收「白方挡点唯一」的线路；若黑走活四（白可在两端任选一挡），
 *   solution 记录其中一条挡法，另一挡点同样无法避免成五；
 *   最终由 rules/gomoku.js 逐手回放，check() 判黑胜。
 * 纯数据模块：不引用全局、不读 storage、不碰 UI。
 */

var GOMOKU_PUZZLES = [
  {
    id: 'gomoku-01',
    game: 'gomoku',
    name: '黑先斜向五连·一',
    difficulty: 'easy',
    board: [
      [0, 0, 0, 2, 2, 0, 0],
      [0, 0, 0, 2, 2, 0, 0],
      [0, 0, 1, 2, 1, 2, 0],
      [0, 0, 1, 1, 2, 1, 0],
      [0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 1, j: 1 } },
      { turn: 2, move: { i: 0, j: 0 } },
      { turn: 1, move: { i: 5, j: 5 } }
    ]
  },
  {
    id: 'gomoku-02',
    game: 'gomoku',
    name: '黑先横向五连·二',
    difficulty: 'easy',
    board: [
      [0, 0, 2, 0, 0, 0, 0, 0, 0],
      [0, 0, 2, 2, 0, 0, 0, 0, 0],
      [0, 0, 2, 2, 0, 0, 0, 0, 0],
      [0, 1, 1, 2, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 1, j: 4 } },
      { turn: 2, move: { i: 0, j: 4 } },
      { turn: 1, move: { i: 5, j: 4 } }
    ]
  },
  {
    id: 'gomoku-03',
    game: 'gomoku',
    name: '黑先竖向五连·三',
    difficulty: 'easy',
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 2, 1, 1, 0, 0, 0],
      [2, 2, 2, 1, 0, 0, 0],
      [0, 2, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 3, j: 1 } },
      { turn: 2, move: { i: 3, j: 0 } },
      { turn: 1, move: { i: 3, j: 5 } }
    ]
  },
  {
    id: 'gomoku-04',
    game: 'gomoku',
    name: '黑先斜向五连·四',
    difficulty: 'easy',
    board: [
      [0, 0, 2, 2, 2, 0, 0],
      [0, 0, 1, 2, 1, 2, 0],
      [0, 0, 1, 1, 2, 0, 0],
      [0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 5, j: 4 } },
      { turn: 2, move: { i: 1, j: 0 } },
      { turn: 1, move: { i: 6, j: 5 } }
    ]
  },
  {
    id: 'gomoku-05',
    game: 'gomoku',
    name: '黑先斜向五连·五',
    difficulty: 'normal',
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0],
      [2, 2, 2, 1, 1, 0, 0],
      [2, 2, 2, 1, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 3,
    solution: [
      { turn: 1, move: { i: 3, j: 0 } },
      { turn: 2, move: { i: 3, j: 4 } },
      { turn: 1, move: { i: 5, j: 1 } },
      { turn: 2, move: { i: 6, j: 0 } },
      { turn: 1, move: { i: 1, j: 5 } }
    ]
  },
  {
    id: 'gomoku-06',
    game: 'gomoku',
    name: '黑先横向五连·六',
    difficulty: 'easy',
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 1, 1, 2, 1, 0, 0],
      [2, 2, 2, 1, 0, 0, 0],
      [2, 2, 2, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 4, j: 1 } },
      { turn: 2, move: { i: 0, j: 1 } },
      { turn: 1, move: { i: 5, j: 1 } }
    ]
  },
  {
    id: 'gomoku-07',
    game: 'gomoku',
    name: '黑先横向五连·七',
    difficulty: 'easy',
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [2, 2, 1, 0, 0, 0, 0],
      [2, 2, 2, 1, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 4, j: 3 } },
      { turn: 2, move: { i: 0, j: 3 } },
      { turn: 1, move: { i: 5, j: 3 } }
    ]
  },
  {
    id: 'gomoku-08',
    game: 'gomoku',
    name: '黑先竖向五连·八',
    difficulty: 'easy',
    board: [
      [0, 0, 1, 0, 0, 0, 0],
      [2, 2, 1, 1, 0, 0, 0],
      [2, 2, 2, 1, 0, 0, 0],
      [0, 2, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 3, j: 4 } },
      { turn: 2, move: { i: 3, j: 0 } },
      { turn: 1, move: { i: 3, j: 5 } }
    ]
  },
  {
    id: 'gomoku-09',
    game: 'gomoku',
    name: '黑先横向五连·九',
    difficulty: 'hard',
    board: [
      [0, 0, 0, 0, 2, 2, 2],
      [0, 0, 1, 1, 2, 2, 2],
      [0, 0, 1, 1, 2, 2, 0],
      [0, 0, 0, 1, 1, 1, 0],
      [0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 5,
    solution: [
      { turn: 1, move: { i: 3, j: 0 } },
      { turn: 2, move: { i: 3, j: 4 } },
      { turn: 1, move: { i: 1, j: 0 } },
      { turn: 2, move: { i: 5, j: 4 } },
      { turn: 1, move: { i: 0, j: 0 } },
      { turn: 2, move: { i: 1, j: 1 } },
      { turn: 1, move: { i: 2, j: 3 } },
      { turn: 2, move: { i: 1, j: 3 } },
      { turn: 1, move: { i: 6, j: 3 } }
    ]
  },
  {
    id: 'gomoku-10',
    game: 'gomoku',
    name: '黑先斜向五连·十',
    difficulty: 'easy',
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0],
      [0, 2, 2, 2, 1, 0, 0],
      [0, 2, 2, 2, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0]
    ],
    turn: 1,
    goal: 'win',
    moveLimit: 2,
    solution: [
      { turn: 1, move: { i: 1, j: 1 } },
      { turn: 2, move: { i: 0, j: 0 } },
      { turn: 1, move: { i: 5, j: 5 } }
    ]
  }
]

module.exports = GOMOKU_PUZZLES
