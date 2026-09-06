/**
 * ЧЕШЕР — Система ботов (v0.18.0)
 * 20 ботов, 4 лиги, уникальные характеры и фразы
 */
"use strict";

/* --- БОТ-ФРАЗЫ по типу характера --- */
const BOT_PHRASES = {
  cheerful: ['Ха-ха! Ну и ход!','Весело играем!','А вот так!','Это было интересно!','Учись, учись!'],
  sleepy:   ['Ой, извините...','Мне бы чайку...','Спокойной ночи...','Куда я это поставил?','Зевок? Где?..'],
  rush:     ['Быстро!','Некогда думать!','Ходи-ходи!','Я уже машина!','Время — деньги!'],
  random:   ['А вот так!','Попробуй угадай!','Сюрприз!','Ход дня!','Я гений!'],
  cautious: ['Без риска...','Рокируюсь на всякий случай','Осторожность — мать...','Лучше перестрахуюсь','Надёжно'],
  aggressive:['Атака!','Держись!','Я иду!','Сейчас разменяем!','Вперёд!'],
  strategic:['План этапный','Выжидательная позиция','Контроль центра','Развитие фигур','Строю крепость'],
  knighty:  ['Конём!','Вилка!','Кони правят бал!','Ищу вилку...','Конь — король доски!'],
  flanky:   ['На флангах!','Центр не нужен','Боковые линии','Широкая игра','Обходной манёвр'],
  queeny:   ['Ферзь — королева!','Не менять ферзя!','Ферзь решает','Дива на доске','Королева атакует'],
  checky:   ['Шах!','Ещё шах!','Шах и мат!','Проверяй короля!','Шаховать — моё'],
  deffy:    ['Оборона превыше всего','Сиди в защите','Стена','Непробиваемый','Жду ошибки'],
  piecey:   ['Белые фигуры!','Слон и ферзь — моя команда','Развитие пешек','Не люблю коней','Белая армия'],
  movey:    ['Кони и ладьи!','Атака на короля','Мощная связка','Давлю конями','Рыцарский натиск'],
  ggamby:   ['Я тебе пешку, а ты мне — партию','Гамбит!','Жертвую!','Азарт — моя игра','Бери, не стесняйся'],
  endy:     ['Эндшпиль — моё','Король — главная фигура','Цейтнот','Проходная пешка','Миниатюра'],
  mini:     ['Считаю на 2 хода','Не зеваю','Точный просчёт','Каждый ход на учёте','Математика'],
  alpha:    ['Объективно лучший','Чистая игра','Без ошибок','Точность','Альфа-бета отсечение'],
  stocky:   ['Как движок','Давлю пешками','Иногда ошибаюсь','Эндшпиль — царство','Сила позиции'],
  gm:       ['Интересная позиция...','Даю тебе фору','Хм...','Не стандартно, ноильно','Играю с закрытыми глазами']
};

/* --- 20 ботов: 4 лиги --- */
const BOT_LIST = [
  // ═══ ЛИГА «НАЧИНАЮЩИЕ» (100–400) ═══
  {id:1,  name:'Вася-Пешка',      emoji:'♟️', rating:100,  winsReq:0,  league:'Начинающие',
    strategy:'random', depth:0, desc:'Только учится, ходит куда попало',
    strengths:'Непредсказуемость', weaknesses:'Забывает правила взятия',
    personality:'Дружелюбный новичок, рад любой игре. Может забыть, что фигуры бьют по-разному.',
    chatType:'cheerful', phrases:['Только учуcь!','А вот так!','Ой, а где тут ходить?','Я стараюсь!']},
  {id:2,  name:'Дед Сеньор',      emoji:'👴', rating:150,  winsReq:0,  league:'Начинающие',
    strategy:'random', depth:0, desc:'Добрый дедушка, но сонный',
    strengths:'Жизненный опыт', weaknesses:'Засыпает за доской',
    personality:'Добрый дедушка, но сонный. Часто «засыпает» и делает странные ходы.',
    chatType:'sleepy', phrases:['Ой, извините...','Мне бы чайку...','Куда я это поставил?','Спокойной ночи...']},
  {id:3,  name:'Маша-Торопыга',   emoji:'💨', rating:200,  winsReq:1,  league:'Начинающие',
    strategy:'random', depth:0, desc:'Всё время спешит',
    strengths:'Скорость', weaknesses:'Зевает фигуры',
    personality:'Всё время спешит. Ходит быстро, но часто зевает фигуры.',
    chatType:'rush', phrases:['Быстро!','Некогда думать!','Ходи-ходи!','Я уже машина!']},
  {id:4,  name:'Коля-Рандом',     emoji:'🎲', rating:250,  winsReq:1,  league:'Начинающие',
    strategy:'random', depth:0, desc:'Играет случайно, но с энтузиазмом',
    strengths:'Энтузиазм', weaknesses:'Нет логики',
    personality:'Играет случайно, но с энтузиазмом. Забавные фразы: «А вот так!»',
    chatType:'random', phrases:['А вот так!','Попробуй угадай!','Сюрприз!','Ход дня!']},
  {id:5,  name:'Тётя Клава',      emoji:'🫖', rating:300,  winsReq:1,  league:'Начинающие',
    strategy:'random', depth:0, desc:'Осторожная, боится рисковать',
    strengths:'Осторожность', weaknesses:'Всегда рокируется',
    personality:'Осторожная, боится рисковать. Всегда рокируется, даже когда не надо.',
    chatType:'cautious', phrases:['Без риска...','Рокируюсь на всякий случай','Лучше перестрахуюсь','Надёжно']},
  // ═══ ЛИГА «ЛЮБИТЕЛИ» (500–800) ═══
  {id:6,  name:'Серёга-Агрессор', emoji:'⚔️', rating:500,  winsReq:3,  league:'Любители',
    strategy:'greedy', depth:0, desc:'Всегда идёт в атаку, не смотрит на защиту',
    strengths:'Атакующий стиль', weaknesses:'Жертвует без нужды',
    personality:'Всегда идёт в атаку, не смотрит на защиту. Часто жертвует фигуры ради атаки.',
    chatType:'aggressive', phrases:['Атака!','Держись!','Я иду!','Сейчас разменяем!']},
  {id:7,  name:'Лена-Стратег',    emoji:'🧠', rating:600,  winsReq:3,  league:'Любители',
    strategy:'greedy', depth:1, desc:'Любит строить планы, но не додумывает до конца',
    strengths:'Планирование', weaknesses:'Зевает в миттельшпиле',
    personality:'Любит строить планы, но не додумывает до конца. Хорошо развивает фигуры.',
    chatType:'strategic', phrases:['План этапный','Выжидательная позиция','Контроль центра','Развитие фигур']},
  {id:8,  name:'Робоконь',        emoji:'🐴', rating:700,  winsReq:3,  league:'Любители',
    strategy:'greedy', depth:1, desc:'Конь — его любимая фигура',
    strengths:'Вилки конём', weaknesses:'Только кони',
    personality:'Конь — его любимая фигура. Постоянно ищет вилки конём.',
    chatType:'knighty', phrases:['Конём!','Вилка!','Кони правят бал!','Ищу вилку...']},
  {id:9,  name:'Слон-Бродяга',    emoji:'🐾', rating:750,  winsReq:3,  league:'Любители',
    strategy:'greedy', depth:1, desc:'Предпочитает слонов, любит открытые позиции',
    strengths:'Открытые позиции', weaknesses:'Игнорирует центр',
    personality:'Предпочитает слонов, любит открытые позиции. Игнорирует центр.',
    chatType:'flanky', phrases:['На флангах!','Центр не нужен','Широкая игра','Обходной манёвр']},
  {id:10, name:'Ферзь-Дива',      emoji:'👑', rating:800,  winsReq:3,  league:'Любители',
    strategy:'minimax', depth:1, desc:'Обожает ферзя, не хочет его менять',
    strengths:'Игра ферзём', weaknesses:'Не разменивает ферзя',
    personality:'Обожает ферзя, не хочет его менять. Долго держит ферзя.',
    chatType:'queeny', phrases:['Ферзь — королева!','Не менять ферзя!','Ферзь решает','Дива на доске']},
  // ═══ ЛИГА «ОПЫТНЫЕ» (1000–1400) ═══
  {id:11, name:'Капитан Шах',     emoji:'🎖️', rating:1000, winsReq:8,  league:'Опытные',
    strategy:'minimax', depth:2, desc:'Атакующий, агрессивный стиль',
    strengths:'Шахи', weaknesses:'Шахует без нужды',
    personality:'Атакующий, агрессивный стиль. Постоянно шахует, даже если невыгодно.',
    chatType:'checky', phrases:['Шах!','Ещё шах!','Шах и мат!','Проверяй короля!']},
  {id:12, name:'Доктор Тихон',    emoji:'🩺', rating:1100, winsReq:8,  league:'Опытные',
    strategy:'minimax', depth:2, desc:'Защитный стиль, сидит в обороне',
    strengths:'Оборона', weaknesses:'Пассивный',
    personality:'Защитный стиль, сидит в обороне. Любит закрытые позиции.',
    chatType:'deffy', phrases:['Оборона превыше всего','Сиди в защите','Стена','Жду ошибки']},
  {id:13, name:'Белая Королева',  emoji:'🤍', rating:1200, winsReq:15, league:'Опытные',
    strategy:'minimax+position', depth:2, desc:'Играет ферзём и слоном, развивает пешки',
    strengths:'Белые фигуры', weaknesses:'Не любит коней',
    personality:'Играет ферзём и слоном, развивает пешки. Не любит коней.',
    chatType:'piecey', phrases:['Белые фигуры!','Слон и ферзь — моя команда','Развитие пешек','Не люблю коней']},
  {id:14, name:'Чёрный Рыцарь',   emoji:'🖤', rating:1250, winsReq:15, league:'Опытные',
    strategy:'minimax+ab', depth:2, desc:'Играет конями и ладьями',
    strengths:'Атака на короля', weaknesses:'Слабая оборона',
    personality:'Играет конями и ладьями. Любит атаковать короля.',
    chatType:'movey', phrases:['Кони и ладьи!','Атака на короля','Давлю конями','Рыцарский натиск']},
  {id:15, name:'Гамбит Геннадий', emoji:'🎯', rating:1300, winsReq:25, league:'Опытные',
    strategy:'minimax+ab', depth:3, desc:'Любит гамбиты и жертвы',
    strengths:'Гамбиты', weaknesses:'Пережертвует',
    personality:'Любит гамбиты и жертвы. «Я тебе пешку, а ты мне — партию»',
    chatType:'ggamby', phrases:['Я тебе пешку, а ты мне — партию','Гамбит!','Жертвую!','Бери, не стесняйся']},
  {id:16, name:'Эндшпиль Элвис', emoji:'🕺', rating:1400, winsReq:35, league:'Опытные',
    strategy:'minimax+ab+pos', depth:3, desc:'Мастер эндшпиля, но слаб в дебюте',
    strengths:'Эндшпиль', weaknesses:'Дебют',
    personality:'Мастер эндшпиля, но слаб в дебюте. «Король — моя главная фигура»',
    chatType:'endy', phrases:['Эндшпиль — моё','Король — главная фигура','Проходная пешка','Миниатюра']},
  // ═══ ЛИГА «МАСТЕРА» (1500–2100) ═══
  {id:17, name:'Минимакс Миша',   emoji:'🔢', rating:1500, winsReq:50, league:'Мастера',
    strategy:'minimax+ab+pos', depth:4, desc:'Всегда считает на 2 хода вперёд',
    strengths:'Точный просчёт', weaknesses:'Медленный',
    personality:'Всегда считает на 2 хода вперёд. Никогда не зевает фигуры.',
    chatType:'mini', phrases:['Считаю на 2 хода','Не зеваю','Точный просчёт','Каждый ход на учёте']},
  {id:18, name:'Альфа-Бета Анна', emoji:'🧪', rating:1700, winsReq:75, league:'Мастера',
    strategy:'minimax+ab+pos', depth:5, desc:'Отсекает плохие варианты, играет чисто',
    strengths:'Альфа-бета отсечение', weaknesses:'Предсказуема',
    personality:'Отсекает плохие варианты, играет чисто. Всегда выбирает объективно лучший ход.',
    chatType:'alpha', phrases:['Объективно лучший','Чистая игра','Без ошибок','Альфа-бета отсечение']},
  {id:19, name:'Стокфиш Сергей', emoji:'🐟', rating:1900, winsReq:105, league:'Мастера',
    strategy:'minimax+ab+pos', depth:5, desc:'Играет как движок, но иногда ошибается',
    strengths:'Давление пешками', weaknesses:'Иногда ошибается',
    personality:'Играет как движок, но иногда ошибается. Любит давить пешками в эндшпиле.',
    chatType:'stocky', phrases:['Как движок','Давлю пешками','Иногда ошибаюсь','Сила позиции']},
  {id:20, name:'Гроссмейстер Гриша', emoji:'🏆', rating:2100, winsReq:140, league:'Мастера',
    strategy:'minimax+ab+pos+book', depth:6, desc:'Почти идеальная игра',
    strengths:'Всё', weaknesses:'Редко бывает скучно',
    personality:'Почти идеальная игра. Изредка делает нестандартные ходы, чтобы не было скучно.',
    chatType:'gm', phrases:['Интересная позиция...','Даю тебе фору','Хм...','Играю с закрытыми глазами']}
];

/* --- Оценка позиции --- */
function evalBoard(board, me) {
  let v = 0;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      const p = board[r][c];
      if(p) {
        const color = pieceColorStatic(p);
        const type = pieceTypeStatic(p);
        const val = VAL[type] || 0;
        const centerBonus = (r >= 2 && r <= 5 && c >= 2 && c <= 5) ? 0.3 : 0;
        v += (color === me ? 1 : -1) * (val + centerBonus);
      }
    }
  }
  return v;
}

/* --- Бот: случайный ход --- */
function botRandom(moves) {
  return moves[Math.floor(Math.random() * moves.length)];
}

/* --- Бот: жадный --- */
function botGreedy(moves) {
  const caps = moves.filter(m => m.capture);
  if(caps.length) {
    caps.sort((a, b) => (VAL[b.capture] || 0) - (VAL[a.capture] || 0));
    return Math.random() < 0.85 ? caps[0] : caps[Math.floor(Math.random() * caps.length)];
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

/* --- Минимакс с альфа-бета --- */
function botMinimaxAB(engine, depth, maximizing, color, alpha, beta, usePos) {
  const currentColor = engine.turn;
  const legal = engine.allLegalMoves(currentColor);
  if(depth === 0 || legal.length === 0) {
    if(legal.length === 0) {
      return engine.inCheck(currentColor) ? (maximizing ? -100000 : 100000) : 0;
    }
    return evalBoard(engine.board, color);
  }
  if(maximizing) {
    let maxEval = -Infinity;
    for(const m of legal) {
      const saved = engine.saveState();
      engine.applyMove(m);
      const score = botMinimaxAB(engine, depth - 1, false, color, alpha, beta, usePos);
      engine.restoreState(saved);
      maxEval = Math.max(maxEval, score);
      alpha = Math.max(alpha, score);
      if(beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for(const m of legal) {
      const saved = engine.saveState();
      engine.applyMove(m);
      const score = botMinimaxAB(engine, depth - 1, true, color, alpha, beta, usePos);
      engine.restoreState(saved);
      minEval = Math.min(minEval, score);
      beta = Math.min(beta, score);
      if(beta <= alpha) break;
    }
    return minEval;
  }
}

/* --- Выбор лучшего хода --- */
function pickBest(moves, scores) {
  let best = -Infinity;
  const candidates = [];
  for(let i = 0; i < scores.length; i++) {
    const s = scores[i] + Math.random() * 0.01;
    if(s > best + 0.005) { best = s; candidates.length = 0; candidates.push(moves[i]); }
    else if(Math.abs(s - best) <= 0.005) { candidates.push(moves[i]); }
  }
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

/* --- Главный объект бота --- */
const Bot = {
  /* Получить текущие победы игрока */
  _getWins() {
    const cu = ProfilesManager.getCurrent();
    return cu ? (cu.winsBot || 0) : 0;
  },

  /* Рекомендуемый бот = самый сильный из разблокированных */
  getRecommendedBot() {
    const wins = this._getWins();
    const available = BOT_LIST.filter(b => wins >= b.winsReq);
    return available[available.length - 1] || BOT_LIST[0];
  },

  /* Список ботов с доступностью */
  getBotsWithStatus() {
    const wins = this._getWins();
    return BOT_LIST.map(bot => ({
      ...bot,
      isAvailable: wins >= bot.winsReq,
      winsLeft: Math.max(0, bot.winsReq - wins)
    }));
  },

  /* Прогресс до следующего бота */
  getNextBotProgress() {
    const wins = this._getWins();
    let next = null;
    let prevWins = 0;
    for(let i = 0; i < BOT_LIST.length; i++) {
      if(wins < BOT_LIST[i].winsReq) {
        next = BOT_LIST[i];
        prevWins = i > 0 ? BOT_LIST[i - 1].winsReq : 0;
        break;
      }
    }
    if(!next) return {progress: 100, next: null, prevWins: wins};
    const progress = ((wins - prevWins) / (next.winsReq - prevWins)) * 100;
    return {progress: Math.min(Math.max(progress, 0), 100), next, prevWins};
  },

  /* Сделать ход по ID бота */
  makeMoveById(botId, color, engine) {
    const bot = BOT_LIST.find(b => b.id === botId);
    if(!bot) return this.makeMove('random', color, engine);
    return this.makeMove(bot.strategy, color, engine, bot.depth);
  },

  /* Сделать ход по стратегии */
  makeMove(strategy, color, engine, depth) {
    const moves = engine.allLegalMoves(color);
    if(!moves.length) return null;

    switch(strategy) {
      case 'random':
        return botRandom(moves);
      case 'greedy':
        return botGreedy(moves);
      case 'minimax': {
        const scores = moves.map(m => {
          const saved = engine.saveState();
          engine.applyMove(m);
          const s = botMinimaxAB(engine, depth, false, color, -Infinity, Infinity, false);
          engine.restoreState(saved);
          return s;
        });
        return pickBest(moves, scores);
      }
      case 'minimax+position': {
        const scores = moves.map(m => {
          const saved = engine.saveState();
          engine.applyMove(m);
          const s = botMinimaxAB(engine, depth, false, color, -Infinity, Infinity, true);
          engine.restoreState(saved);
          return s;
        });
        return pickBest(moves, scores);
      }
      case 'minimax+ab': {
        const scores = moves.map(m => {
          const saved = engine.saveState();
          engine.applyMove(m);
          const s = botMinimaxAB(engine, depth, false, color, -Infinity, Infinity, false);
          engine.restoreState(saved);
          return s;
        });
        return pickBest(moves, scores);
      }
      case 'minimax+ab+pos': {
        const scores = moves.map(m => {
          const saved = engine.saveState();
          engine.applyMove(m);
          const s = botMinimaxAB(engine, depth, false, color, -Infinity, Infinity, true);
          engine.restoreState(saved);
          return s;
        });
        return pickBest(moves, scores);
      }
      case 'minimax+ab+pos+book': {
        if(moves.some(m => m.capture)) return botGreedy(moves);
        const scores = moves.map(m => {
          const saved = engine.saveState();
          engine.applyMove(m);
          const s = botMinimaxAB(engine, depth, false, color, -Infinity, Infinity, true);
          engine.restoreState(saved);
          return s;
        });
        return pickBest(moves, scores);
      }
      default:
        return botRandom(moves);
    }
  },

  /* Обратная совместимость */
  easy(col, engine) { return this.makeMove('random', col, engine); },
  medium(col, engine) { return this.makeMove('greedy', col, engine); },
  hard(col, engine) { return this.makeMove('minimax', col, engine, 2); },
  grandmaster(col, engine) { return this.makeMove('minimax+ab+pos', col, engine, 3); }
};

if(typeof window !== 'undefined') {
  window.Bot = Bot;
  window.BOT_LIST = BOT_LIST;
  window.evalBoard = evalBoard;
}
