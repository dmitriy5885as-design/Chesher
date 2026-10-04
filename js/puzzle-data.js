/**
 * ЧЕШЕР — Банк задач дня (Daily Puzzle 2.0)
 * Детерминированный контент без Math.random: выбор по календарной дате.
 *
 * Формат записи:
 *   id          — стабильный ключ (для истории/миграций)
 *   types[]     — типы из таксономии (ротация по дням недели)
 *   difficulty  — easy | medium | hard | expert | legendary (влияет на XP/награду/бейдж)
 *   line[]      — ходы ПОСЛЕДОВАТЕЛЬНО от стартовой позиции (альтернанс цветов), ИЛИ
 *   fen         — прямая стартовая позиция (когда линия от начальной позиции не нужна)
 *   side        — чей ход (для fen; для line определяется автоматически)
 *   solution[]  — правильные ходы ПОДРЯД: ход игрока, ответ соперника, ход игрока...
 *   expect      — 'mate' | 'stalemate' | 'move' (что проверять после последнего хода)
 *   why         — «ПОЧЕМУ ЭТО РАБОТАЕТ» (короткое объяснение)
 *   fact        — «ИСТОРИЧЕСКИЙ ФАКТ» (только достоверное; иначе нейтральное описание)
 *   players/place/year — историческая привязка (только для проверенных фактов)
 *
 * ВАЖНО: каждая запись валидируется движком (scripts/validate-puzzles.js и
 * Puzzles.validateAll() в браузере) — линии/фены и solution обязаны быть легальными.
 */
"use strict";

const PUZZLE_DIFF = {
  easy:     { label: 'Лёгкая',   coins: 5 },
  medium:   { label: 'Средняя',  coins: 6 },
  hard:     { label: 'Сложная',  coins: 8 },
  expert:   { label: 'Эксперт',  coins: 10 },
  legendary:{ label: 'Легенда',  coins: 10 }
};

const PUZZLE_TYPES = {
  'famous-game':        'Знаменитая партия',
  'famous-combination': 'Знаменитая комбинация',
  'famous-sacrifice':   'Знаменитая жертва',
  'mate':               'Мат',
  'tactical-shot':      'Тактический удар',
  'best-move':          'Лучший ход',
  'only-move':          'Единственный ход',
  'endgame':            'Эндшпиль',
  'opening-trap':       'Дебютная ловушка',
  'queen-sacrifice':    'Жертва ферзя',
  'defensive-move':     'Защитный ход',
  'historical-mistake': 'Историческая ошибка',
  'brilliant-move':     'Блестящий ход',
  'comeback':           'Возвращение в игру',
  'promotion':          'Превращение',
  'stalemate-trick':    'Пат-ловушка'
};

/* --- Ротация типов по дням недели (0 = Вс) --- */
const PUZZLE_WEEKDAY_TYPES = {
  1: ['tactical-shot'],       // понедельник
  2: ['famous-game'],         // вторник
  3: ['mate'],                // среда
  4: ['endgame'],             // четверг
  5: ['opening-trap'],        // пятница
  6: ['famous-combination'],  // суббота
  0: ['promotion', 'stalemate-trick', 'brilliant-move', 'defensive-move'] // воскресенье: спецнабор
};

/* --- Ручная карта особых дней (MM-DD) — бьёт ротацию --- */
const PUZZLE_SPECIAL_DAYS = {
  '01-01': { type: 'promotion',        name: 'Новый год' },
  '02-14': { type: 'famous-combination', name: '14 февраля' },
  '03-08': { type: 'brilliant-move',   name: '8 Марта' },
  '04-01': { type: 'stalemate-trick',  name: '1 апреля' },
  '10-31': { type: 'mate',             name: 'Хэллоуин' },
  '12-25': { type: 'famous-game',      name: '25 декабря' },
  '12-31': { type: 'promotion',        name: 'Новый год' }
};

const PUZZLE_BANK = [
  /* ============ МАТЫ ============ */
  {
    id: 'fool',
    types: ['mate'],
    difficulty: 'easy',
    title: 'МАТ ДУРАКА',
    hint: 'Ферзь идёт на h4',
    line: ['f2f3', 'e7e5', 'g2g4'],
    solution: ['d8h4'],
    expect: 'mate',
    why: 'Пешки f3 и g4 вскрыли диагональ e1-h4: ферзь ставит мат, а королю некуда идти.',
    fact: 'Самая короткая возможная партия в шахматах — два хода и мат.'
  },
  {
    id: 'scholar',
    types: ['mate', 'opening-trap'],
    difficulty: 'easy',
    title: 'МАТ «СХОЛАРА»',
    hint: 'Ферзь бьёт f7',
    line: ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'],
    solution: ['h5f7'],
    expect: 'mate',
    why: 'Ферзь и слон одновременно бьют f7 — самую слабую точку начала партии; конь f6 её не защищает.',
    fact: 'Классическая ошибка новичков: защита f7 — первое правило дебюта.'
  },
  {
    id: 'backrank',
    types: ['mate', 'tactical-shot'],
    difficulty: 'easy',
    title: 'МАТ ПО ПОСЛЕДНЕЙ ЛИНИИ',
    hint: 'Ладья идёт на восьмую горизонталь',
    fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
    solution: ['e1e8'],
    expect: 'mate',
    why: 'Свои же пешки заперли короля: ладья с последней линии ставит мат — закрыться нечем.',
    fact: 'Такой мат называют «бэк-ранком» (back rank) — один из самых частых паттернов.'
  },
  {
    id: 'qk_mate_a',
    types: ['mate', 'endgame'],
    difficulty: 'easy',
    title: 'МАТ ФЕРЗЕМ И КОРОЛЁМ',
    hint: 'Ферзь на последнюю линию',
    fen: '6k1/8/6K1/8/8/8/8/Q7 w - - 0 1',
    solution: ['a1a8'],
    expect: 'mate',
    why: 'Король на g6 отрезает поля f7, g7 и h7; ферзь с восьмой линии закрывает оставшиеся выходы.',
    fact: 'Это базовый мат «ферзь + король против короля» — его должен знать каждый.'
  },
  {
    id: 'qk_mate_b',
    types: ['mate', 'endgame'],
    difficulty: 'medium',
    title: 'МАТ В УГЛУ',
    hint: 'Ферзь на h8-ю горизонталь',
    fen: '7k/8/6K1/8/8/8/8/Q7 w - - 0 1',
    solution: ['a1a8'],
    expect: 'mate',
    why: 'Король на g6 держит g7 и h7, а ферзь отсекает поле g8 на последней линии.',
    fact: 'Король в углу — самая уязвимая позиция в шахматном эндшпиле.'
  },
  {
    id: 'kr_mate',
    types: ['mate', 'endgame'],
    difficulty: 'easy',
    title: 'МАТ ЛАДЬЁЙ',
    hint: 'Ладья на последнюю линию',
    fen: '7k/8/6K1/8/8/8/8/R7 w - - 0 1',
    solution: ['a1a8'],
    expect: 'mate',
    why: 'Король отбрасывает чёрного короля от седьмой линии, ладья ставит мат на восьмой.',
    fact: 'Мат ладьёй с королём — второй базовый мат эндшпиля.'
  },
  {
    id: 'promo_mate',
    types: ['mate', 'promotion'],
    difficulty: 'medium',
    title: 'ПЕШКА СТАНОВИТСЯ ФЕРЗЁМ',
    hint: 'Преврати пешку в ферзя с матом',
    fen: '7k/4P1pp/8/8/8/8/8/6K1 w - - 0 1',
    solution: ['e7e8q'],
    expect: 'mate',
    why: 'Превращение даёт одновременно шах: чёрный король заперт собственными пешками g7 и h7.',
    fact: 'Превращение — единственный способ «усилить» фигуру по правилам шахмат.'
  },
  {
    id: 'smothered',
    types: ['mate', 'queen-sacrifice', 'famous-sacrifice', 'famous-combination', 'brilliant-move'],
    difficulty: 'legendary',
    title: 'СМАЗАННЫЙ МАТ',
    hint: 'Конь, потом жертва ферзя на g8',
    fen: '5r1k/6pp/8/4N3/8/8/Q7/6K1 w - - 0 1',
    solution: ['e5f7', 'h8g8', 'f7h6', 'g8h8', 'a2g8', 'f8g8', 'h6f7'],
    expect: 'mate',
    why: 'Конь выгоняет короля обратно, ферзь жертвуется на g8 — чёрная ладья сама закрывает королю выход.',
    fact: '«Смазанный» (smothered) мат: король задыхается среди собственных фигур — один из самых красивых паттернов.'
  },

  /* ============ ТАКТИКА ============ */
  {
    id: 'fork_knight',
    types: ['tactical-shot', 'best-move'],
    difficulty: 'medium',
    title: 'ВИЛКА КОНЕМ',
    hint: 'Конь атакует короля и ферзя',
    fen: '6k1/3q3p/8/8/4N3/8/8/6K1 w - - 0 1',
    solution: ['e4f6'],
    expect: 'move',
    why: 'Конь на f6 бьёт чёрного короля на g8 и ферзя на d7 одновременно: король обязан уйти, и ферзь потерян.',
    fact: 'Вилка — атака одной фигурой двух и более целей; конь — её главный мастер.'
  },
  {
    id: 'comeback_fork',
    types: ['comeback', 'tactical-shot', 'best-move'],
    difficulty: 'hard',
    title: 'ОБРАТНЫЙ ХОД',
    hint: 'Белые без ферзя — ищите вилку',
    fen: 'r4rk1/pppq1p1p/8/8/4N3/8/5PPP/R5K1 w - - 0 1',
    solution: ['e4f6'],
    expect: 'move',
    why: 'Белые без ферзя, но вилка на f6 неизбежна: под шахом король уходит, и конь забирает ферзь на d7.',
    fact: 'Возвращение в игру (comeback) — нахождение ресурса в казалось бы проигранной позиции.'
  },
  {
    id: 'pin_take',
    types: ['tactical-shot', 'best-move'],
    difficulty: 'easy',
    title: 'СВЯЗКА',
    hint: 'Слон забирает связанного коня',
    fen: '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1',
    solution: ['b5c6'],
    expect: 'move',
    why: 'Конь на c6 связан слоном с королём на e8: он не может уйти, и слон просто его забирает.',
    fact: 'Связка — фигура не может двинуться, не открыв шах своему королю.'
  },

  /* ============ ЕДИНСТВЕННЫЕ ХОДЫ / ЗАЩИТА ============ */
  {
    id: 'only_black',
    types: ['only-move', 'defensive-move'],
    difficulty: 'easy',
    title: 'ЕДИНСТВЕННЫЙ ХОД',
    hint: 'Король заперт — есть только один ответ',
    fen: '5r1k/5N1p/8/8/8/8/8/6RK b - - 0 1',
    solution: ['f8f7'],
    expect: 'move',
    only: true,
    why: 'Конь на f7 атакует короля; король окружён своими фигурами — отбить коня может только ладья.',
    fact: 'Иногда «единственный ход» — не слабость, а точка максимального напряжения позиции.'
  },
  {
    id: 'only_white',
    types: ['only-move', 'defensive-move'],
    difficulty: 'easy',
    title: 'УХОД ОТ ШАХА',
    hint: 'Королю некуда идти, кроме h2',
    fen: '4k3/8/8/8/8/8/6P1/r6K w - - 0 1',
    solution: ['h1h2'],
    expect: 'move',
    only: true,
    why: 'Ладья шахует по первой линии, а пешка g2 закрывает королю всё, кроме поля h2.',
    fact: 'Единственный легальный ход — самый ценный подсказка: позиция диктует решение.'
  },

  /* ============ ПАТ ============ */
  {
    id: 'stalemate_swindle',
    types: ['stalemate-trick'],
    difficulty: 'expert',
    title: 'ПАТ ПРИ ПРОИГРЫШЕ',
    hint: 'Один ход ферзем — и белым нечего делать',
    fen: '8/8/8/8/8/3q2k1/6P1/7K b - - 0 1',
    solution: ['d3e3'],
    expect: 'stalemate',
    why: 'Ферзь на e3 не шахует, но отнимает у белых все ходы: король заперт, пешка стоит. Пат — это ничья.',
    fact: 'Пат при меньшем материале — классическое спасение: проигравший берёт ничью «бесплатно».'
  },

  /* ============ ИСТОРИЧЕСКИЕ ПАРТИИ ============ */
  {
    id: 'opera',
    types: ['famous-game', 'historical-mistake', 'brilliant-move', 'best-move'],
    difficulty: 'hard',
    title: 'ПАРТИЯ В ОПЕРЕ',
    hint: 'Что сыграл Морфи после 9...b5?',
    line: ['e2e4', 'e7e5', 'g1f3', 'd7d6', 'd2d4', 'c8g4', 'd4e5', 'g4f3', 'd1f3', 'd6e5',
           'f1c4', 'g8f6', 'f3b3', 'e8e7', 'b1c3', 'c7c6', 'c1g5', 'b7b5'],
    solution: ['c3b5'],
    expect: 'move',
    players: 'Пол Морфи — Герцог Карл Брауншвейгский и граф Изуар',
    place: 'Новый Орлеан',
    year: 1858,
    why: 'Конь идёт на b5, отдаваясь: после взятия слон белых бьёт b5 с шахом по вскрытой диагонали — и атака Морфи обрушивается на короля.',
    fact: 'Партия сыграна во время оперного спектакля в Новом Орлеане — отсюда её знаменитое название.'
  },
  {
    id: 'legal',
    types: ['famous-game', 'opening-trap', 'queen-sacrifice', 'famous-sacrifice', 'famous-combination', 'brilliant-move'],
    difficulty: 'hard',
    title: 'МАТ ЛЕГАЛЯ',
    hint: 'Белые могут отдать ферзя...',
    line: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'd7d6', 'b1c3', 'c8g4', 'h2h3', 'g4h5'],
    solution: ['f3e5', 'h5d1', 'c4f7', 'e8e7', 'c3d5'],
    expect: 'mate',
    players: 'Сире де Легаль — Сент-Бри',
    place: 'Париж',
    year: 1750,
    why: 'Белые отдают ферзя: слон уходит на d1, конь с c3 приходит на d5 — мат после Bxf7+ и королевского отступления на e7.',
    fact: 'Приём назван в честь Сире де Легаля — парижского шахматиста середины XVIII века.'
  }
];

if(typeof window !== 'undefined') {
  window.PUZZLE_BANK = PUZZLE_BANK;
  window.PUZZLE_DIFF = PUZZLE_DIFF;
  window.PUZZLE_TYPES = PUZZLE_TYPES;
  window.PUZZLE_WEEKDAY_TYPES = PUZZLE_WEEKDAY_TYPES;
  window.PUZZLE_SPECIAL_DAYS = PUZZLE_SPECIAL_DAYS;
}
