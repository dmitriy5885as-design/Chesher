/**
 * ЧЕШЕР — Задача дня (Daily Puzzle 2.0)
 * Детерминированный контент по календарной дате, без Math.random.
 *
 * State machine дня:
 *   OPEN      — записи нет
 *   PLAY      — started=true, completed=false  (позиция НЕ сохраняется — при
 *               переоткрытии задача начинается заново с начала)
 *   SOLVED    — completed=true (только «✓ РЕШЕНА», награда выдаётся один раз)
 *
 * Награда идемпотентна: completed в профиле + маркер claim_<date> + перечитывание
 * raw localStorage (защита от дубля между вкладками/офлайн-повторами).
 */
"use strict";

const Puzzles = {
  LEGACY_PREFIX: 'chesher_puzzle_',
  CLAIM_PREFIX: 'chesher_puzzle_claim_',
  HISTORY_CAP: 60,
  MILESTONES: [3, 7, 14, 30, 60, 100],
  MILESTONE_REWARDS: {
    3:  { coins: 30 },
    7:  { coins: 60 },
    14: { coins: 80 },
    30: { coins: 120 },
    60: { coins: 150 },
    100: { coins: 200 }
  },

  _built: null,      // кэш построенной сегодняшней задачи
  _builtKey: '',
  _seq: null,        // runtime: {solution, idx}

  /* --- Даты (локальные, не UTC — смена в полночь по времени игрока) --- */
  todayKey(d) {
    const dt = d || new Date();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return dt.getFullYear() + '-' + m + '-' + day;
  },
  dayNumber(key) {
    return parseInt(key.replace(/-/g, ''), 10);
  },
  prevKey(key) {
    const p = key.split('-');
    const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    dt.setDate(dt.getDate() - 1);
    return this.todayKey(dt);
  },
  dateObj(key) {
    const p = key.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  },

  /* --- Детерминированный хеш строки --- */
  _hash(str) {
    let seed = 0;
    for(let i = 0; i < str.length; i++) seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
    return seed;
  },

  /* --- Выбор записи банка на дату (детерминированно) --- */
  select(key) {
    const bank = (typeof PUZZLE_BANK !== 'undefined') ? PUZZLE_BANK : [];
    if(!bank.length) return null;
    const dt = this.dateObj(key);
    const mmdd = String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const special = (typeof PUZZLE_SPECIAL_DAYS !== 'undefined') ? PUZZLE_SPECIAL_DAYS[mmdd] : null;
    const wantTypes = special
      ? [special.type]
      : ((typeof PUZZLE_WEEKDAY_TYPES !== 'undefined') ? (PUZZLE_WEEKDAY_TYPES[dt.getDay()] || []) : []);

    let pool = bank.filter(e => e.types && e.types.some(t => wantTypes.indexOf(t) !== -1));
    if(!pool.length) pool = bank.slice();

    // Не повторять вчерашнюю задачу, если пул позволяет
    if(pool.length > 1) {
      const yKey = this.prevKey(key);
      const rec = this.record(yKey);
      if(rec && rec.slug) {
        const filtered = pool.filter(e => e.id !== rec.slug);
        if(filtered.length) pool = filtered;
      }
    }
    const idx = this._hash(key + ':' + pool.map(e => e.id).join(',')) % pool.length;
    return pool[idx];
  },

  /* --- Утилиты сопоставления ходов --- */
  _uciMove(eng, uci) {
    const fr = 8 - parseInt(uci[1], 10), fc = uci.charCodeAt(0) - 97;
    const tr = 8 - parseInt(uci[3], 10), tc = uci.charCodeAt(2) - 97;
    const promo = uci[4];
    const list = eng.getLegalMoves(fr, fc).filter(x => x.tr === tr && x.tc === tc);
    if(!list.length) return null;
    if(promo) return list.find(m => m.promo === promo) || null;
    return list[0];
  },
  _uciStr(m) {
    return FILES[m.fc] + (8 - m.fr) + FILES[m.tc] + (8 - m.tr) + (m.promo || '');
  },

  /* --- Построить + валидировать запись движком (кэш по id/key) --- */
  build(entry) {
    if(!entry || typeof ChessEngine === 'undefined') return null;
    try {
      const eng = new ChessEngine('classic');
      eng.newGame();
      if(entry.line) {
        for(let i = 0; i < entry.line.length; i++) {
          const m = this._uciMove(eng, entry.line[i]);
          if(!m || eng.plyCount >= 300) return null;
          eng.makeMove(m);
        }
      } else if(entry.fen) {
        eng.loadFen(entry.fen);
      } else {
        return null;
      }
      const startFen = eng.toFen();
      const startTurn = eng.turn;

      if(!entry.solution || !entry.solution.length) return null;
      // Флаг only: ровно 1 легальный ход ДО выполнения решения
      if(entry.only && eng.allLegalMoves(startTurn).length !== 1) return null;
      for(let i = 0; i < entry.solution.length; i++) {
        const m = this._uciMove(eng, entry.solution[i]);
        if(!m) return null;
        eng.makeMove(m);
      }
      if(entry.expect === 'mate' && !eng.isCheckmate(eng.turn)) return null;
      if(entry.expect === 'stalemate' && !eng.isStalemate(eng.turn)) return null;

      const diff = (typeof PUZZLE_DIFF !== 'undefined' && PUZZLE_DIFF[entry.difficulty])
        ? PUZZLE_DIFF[entry.difficulty] : PUZZLE_DIFF.easy;
      const xpTable = (typeof Progress !== 'undefined' && Progress.GAIN && Progress.GAIN.puzzle)
        ? Progress.GAIN.puzzle : { easy: 80, medium: 120, hard: 180, expert: 250, legendary: 400 };
      const typeLabel = (typeof PUZZLE_TYPES !== 'undefined') ? (PUZZLE_TYPES[entry.types[0]] || '') : '';

      return {
        id: entry.id,
        fen: startFen,
        turn: startTurn,
        solution: entry.solution.slice(),
        answer: entry.solution[0],
        expect: entry.expect,
        title: entry.title,
        hint: entry.hint || '',
        difficulty: entry.difficulty,
        diffLabel: diff.label,
        reward: diff.coins,
        xp: xpTable[entry.difficulty] || 80,
        types: entry.types.slice(),
        typeLabel: typeLabel,
        why: entry.why || '',
        fact: entry.fact || '',
        players: entry.players || '',
        place: entry.place || '',
        year: entry.year || 0
      };
    } catch(e) {
      console.error('Puzzles.build error:', entry && entry.id, e);
      return null;
    }
  },

  /* --- Сегодняшняя задача (детерминированно) --- */
  buildToday(key) {
    const k = key || this.todayKey();
    if(this._built && this._builtKey === k) return this._built;
    const entry = this.select(k);
    const built = this.build(entry);
    this._built = built;
    this._builtKey = k;
    return built;
  },

  /* --- Запись дня в профиле (с миграцией legacy-ключа) --- */
  record(key) {
    const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
    if(!cu) return null;
    const k = key || this.todayKey();
    if(!cu.puzzles) cu.puzzles = {};
    if(cu.puzzles[k]) return cu.puzzles[k];
    // Миграция: решено в старой версии (chesher_puzzle_<yyyymmdd>) — фиксируем без
    // повторной выдачи монет (XP выдаём — его в старой версии не было)
    let legacy = null;
    try { legacy = localStorage.getItem(this.LEGACY_PREFIX + this.dayNumber(k)); } catch(e) {}
    if(legacy !== null) {
      const built = this.buildToday(k);
      const streak = this._nextStreak(cu, k);
      cu.puzzles[k] = {
        slug: built ? built.id : '', type: built ? built.types[0] : '',
        difficulty: built ? built.difficulty : 'easy',
        started: true, completed: true, migrated: true,
        streak: streak, xp: 0, coins: 0, ts: Date.now()
      };
      cu.puzzleStreak = streak;
      cu.puzzleStreakLast = k;
      this._pushHistory(cu, k, built, streak);
      if(typeof Progress !== 'undefined') Progress.addXp(built ? built.xp : 0, 'puzzle_migrate', { silent: true });
      if(typeof saveProfiles === 'function') saveProfiles();
      try { localStorage.setItem(this.CLAIM_PREFIX + k, '1'); } catch(e) {}
    }
    return cu.puzzles[k] || null;
  },

  _nextStreak(cu, key) {
    if(cu.puzzleStreakLast === this.prevKey(key)) return (cu.puzzleStreak || 0) + 1;
    if(cu.puzzleStreakLast === key) return cu.puzzleStreak || 1;
    return 1;
  },

  _pushHistory(cu, key, built, streak) {
    if(!Array.isArray(cu.puzzleHistory)) cu.puzzleHistory = [];
    cu.puzzleHistory.push({
      date: key,
      title: built ? built.title : '',
      type: built ? built.types[0] : '',
      difficulty: built ? built.difficulty : 'easy',
      streak: streak,
      ts: Date.now()
    });
    if(cu.puzzleHistory.length > this.HISTORY_CAP) {
      cu.puzzleHistory = cu.puzzleHistory.slice(-this.HISTORY_CAP);
    }
  },

  isCompletedToday() {
    const rec = this.record();
    return !!(rec && rec.completed);
  },
  isStartedToday() {
    const rec = this.record();
    return !!(rec && rec.started && !rec.completed);
  },

  /* --- Начало попытки: started=true, completed=false, БЕЗ чекпоинта --- */
  markStarted(built) {
    const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
    if(!cu || !built) return;
    const key = this.todayKey();
    if(!cu.puzzles) cu.puzzles = {};
    const rec = cu.puzzles[key];
    if(rec && rec.completed) return; // решённая задача не перезаписывается
    cu.puzzles[key] = {
      slug: built.id, type: built.types[0], difficulty: built.difficulty,
      started: true, completed: false, ts: Date.now()
    };
    if(typeof saveProfiles === 'function') saveProfiles();
  },

  /* --- State machine решения --- */
  begin(built) {
    this._seq = built ? { solution: built.solution.slice(), idx: 0, id: built.id } : null;
  },
  abort() { this._seq = null; },

  /**
   * Ход игрока.
   * Возвращает { status: 'wrong'|'needOpponent'|'solved', uci? }
   */
  step(move) {
    if(!this._seq || !move) return { status: 'wrong' };
    const expect = this._seq.solution[this._seq.idx];
    if(!expect) return { status: 'wrong' };
    const fr = 8 - parseInt(expect[1], 10), fc = expect.charCodeAt(0) - 97;
    const tr = 8 - parseInt(expect[3], 10), tc = expect.charCodeAt(2) - 97;
    const promo = expect[4];
    if(move.fr !== fr || move.fc !== fc || move.tr !== tr || move.tc !== tc) return { status: 'wrong' };
    if(promo && move.promo !== promo) return { status: 'wrong' };
    this._seq.idx++;
    if(this._seq.idx >= this._seq.solution.length) return { status: 'solved' };
    return { status: 'needOpponent', uci: this._seq.solution[this._seq.idx] };
  },

  /* --- После хода соперника по сценарию --- */
  afterOpponent() {
    if(!this._seq) return { status: 'wrong' };
    this._seq.idx++;
    if(this._seq.idx >= this._seq.solution.length) return { status: 'solved' };
    return { status: 'needPlayer' };
  },

  currentAnswerUci() {
    if(!this._seq) return null;
    return this._seq.solution[this._seq.idx] || null;
  },

  /**
   * Завершение задачи: идемпотентная выдача награды.
   * Возвращает { first, coins, xp, streak, milestone, difficulty, title, ... }
   */
  complete() {
    const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
    const key = this.todayKey();
    const built = this.buildToday(key);
    const out = {
      first: false, coins: 0, xp: 0, streak: 0, milestone: null,
      difficulty: built ? built.difficulty : 'easy',
      title: built ? built.title : '', diffLabel: built ? built.diffLabel : '',
      reward: built ? built.reward : 0, rewardXp: built ? built.xp : 0,
      why: built ? built.why : '', fact: built ? built.fact : '',
      players: built ? built.players : '', place: built ? built.place : '', year: built ? built.year : 0
    };
    if(!cu) return out;

    // --- Защита от дублей: перечитываем raw-состояние (другая вкладка могла успеть) ---
    let rawRec = null;
    try {
      const raw = JSON.parse(localStorage.getItem('chesher_profiles') || 'null');
      if(raw && Array.isArray(raw.profiles)) {
        const rp = raw.profiles.find(p => p.id === cu.id);
        if(rp && rp.puzzles && rp.puzzles[key]) rawRec = rp.puzzles[key];
        if(rp && rawRec && rawRec.completed) {
          // Синхронизируем локальное состояние из raw, награду НЕ выдаём повторно
          if(!(cu.puzzles[key] && cu.puzzles[key].completed)) {
            cu.puzzles[key] = rawRec;
            if(rp.puzzleStreak) cu.puzzleStreak = rp.puzzleStreak;
            if(rp.puzzleStreakLast) cu.puzzleStreakLast = rp.puzzleStreakLast;
            if(Array.isArray(rp.puzzleHistory)) cu.puzzleHistory = rp.puzzleHistory;
            if(typeof saveProfiles === 'function') saveProfiles();
          }
          out.first = false;
          out.streak = cu.puzzleStreak || 0;
          return out;
        }
      }
    } catch(e) {}

    const already = (cu.puzzles[key] && cu.puzzles[key].completed) ||
      (function() { try { return localStorage.getItem(Puzzles.CLAIM_PREFIX + key) !== null; } catch(e) { return false; } })();
    if(already) {
      out.first = false;
      out.streak = cu.puzzleStreak || 0;
      return out;
    }

    // --- Первая (и единственная) выдача за день ---
    const streak = this._nextStreak(cu, key);
    const coins = out.reward;
    const xp = out.rewardXp;

    cu.puzzleStreak = streak;
    cu.puzzleStreakLast = key;
    cu.puzzles[key] = {
      slug: built ? built.id : '', type: built ? built.types[0] : '',
      difficulty: out.difficulty, started: true, completed: true,
      streak: streak, xp: xp, coins: coins, ts: Date.now()
    };
    this._pushHistory(cu, key, built, streak);

    if(coins > 0 && typeof cu.addCoins === 'function') cu.addCoins(coins);
    if(typeof Progress !== 'undefined') Progress.addXp(xp, 'puzzle');

    // Майлстоуны стрика (идемпотентно за всю жизнь профиля)
    if(!Array.isArray(cu.puzzleMilestones)) cu.puzzleMilestones = [];
    if(this.MILESTONES.indexOf(streak) !== -1 && cu.puzzleMilestones.indexOf(streak) === -1) {
      cu.puzzleMilestones.push(streak);
      const ms = this.MILESTONE_REWARDS[streak] || {};
      if(ms.coins && typeof cu.addCoins === 'function') cu.addCoins(ms.coins);
      out.milestone = streak;
      out.milestoneCoins = ms.coins || 0;
    }

    if(typeof saveProfiles === 'function') saveProfiles();

    // Маркеры (новый + legacy-совместимость с тестами/очисткой)
    try {
      localStorage.setItem(this.CLAIM_PREFIX + key, '1');
      localStorage.setItem(this.LEGACY_PREFIX + this.dayNumber(key), String(coins));
    } catch(e) {}

    // Квесты + серверная выдача (кап AWARD_CAPS.puzzle = 10/сутки)
    if(typeof Quests !== 'undefined') Quests.onEvent('puzzle');
    if(coins > 0 && typeof ChesAuth !== 'undefined' && ChesAuth.user) {
      try { ChesAuth.awardCoins('puzzle', coins); } catch(e) {}
    }
    // Облачная синхронизация состояния (восстановление между устройствами)
    if(typeof ChesAuth !== 'undefined' && ChesAuth.user && !ChesAuth.user.isAnonymous) {
      try { ChesAuth.syncLocalToCloud(cu); } catch(e) {}
    }

    out.first = true;
    out.coins = coins;
    out.xp = xp;
    out.streak = streak;
    return out;
  },

  /* --- История (последние решения) --- */
  history(limit) {
    const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
    if(!cu || !Array.isArray(cu.puzzleHistory)) return [];
    const list = cu.puzzleHistory.slice().reverse();
    return limit ? list.slice(0, limit) : list;
  },
  streak() {
    const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
    return cu ? (cu.puzzleStreak || 0) : 0;
  },
  milestoneProgress() {
    const s = this.streak();
    let next = 0;
    for(let i = 0; i < this.MILESTONES.length; i++) {
      if(this.MILESTONES[i] > s) { next = this.MILESTONES[i]; break; }
    }
    return { streak: s, next: next };
  },

  /* --- Валидация всего банка (движком) --- */
  validateAll() {
    const bad = [];
    const bank = (typeof PUZZLE_BANK !== 'undefined') ? PUZZLE_BANK : [];
    for(let i = 0; i < bank.length; i++) {
      if(!this.build(bank[i])) bad.push(bank[i].id);
    }
    return bad;
  },

  /* --- Карточка «Задача дня» на экране режимов --- */
  renderDayCard() {
    const box = document.getElementById('puzzleDayCard');
    if(!box) return;
    const built = this.buildToday();
    if(!built) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const rec = this.record();
    const mp = this.milestoneProgress();
    const done = rec && rec.completed;
    const started = rec && rec.started && !rec.completed;
    const statusHtml = done
      ? '<span class="pdcStatus ok">✓ Решена сегодня</span>'
      : started
        ? '<span class="pdcStatus run">▶ Начата — можно пройти заново</span>'
        : '<span class="pdcStatus new">▶ Новая задача ждёт</span>';
    box.style.display = '';
    box.innerHTML =
      '<div class="pdcHead"><span class="pdcName">🧩 ЗАДАЧА ДНЯ</span>' +
      '<span class="pdcDiff d_' + built.difficulty + '">' + built.diffLabel + '</span></div>' +
      '<div class="pdcTitle">' + built.title + '</div>' +
      '<div class="pdcMeta">' + built.typeLabel +
      ' · <b>+' + built.xp + ' XP</b> · <b>+' + built.reward + ' 🪙</b>' +
      (mp.streak > 0 ? ' · <b class="pdcStreak">🔥 DAILY STREAK ×' + mp.streak + '</b>' : '') +
      '</div>' +
      '<div class="pdcRow">' + statusHtml +
      '<button class="pdcBtn" id="pdcHistory">📜 История</button></div>';
    const hb = box.querySelector('#pdcHistory');
    if(hb) hb.onclick = () => Puzzles.showHistory();
  },

  /* --- Оверлей истории решений --- */
  showHistory() {
    const old = document.getElementById('ovPzHistory');
    if(old) old.remove();
    const key = this.todayKey();
    const yKey = this.prevKey(key);
    const list = this.history(30);
    const rows = list.length ? list.map(h => {
      let when = h.date;
      if(h.date === key) when = 'Сегодня';
      else if(h.date === yKey) when = 'Вчера';
      else {
        const p = h.date.split('-');
        when = Number(p[2]) + '.' + Number(p[1]) + '.' + p[0];
      }
      const diff = (typeof PUZZLE_DIFF !== 'undefined' && PUZZLE_DIFF[h.difficulty]) ? PUZZLE_DIFF[h.difficulty] : null;
      return '<div class="phRow">' +
        '<span class="phWhen">' + when + '</span>' +
        '<span class="phTitle">' + h.title + '</span>' +
        '<span class="phDiff d_' + h.difficulty + '">' + (diff ? diff.label : h.difficulty) + '</span>' +
        '<span class="phStreak">×' + (h.streak || 1) + '</span>' +
        '</div>';
    }).join('') : '<div class="phEmpty">Пока ни одной решённой задачи. Начни сегодняшнюю!</div>';

    const ov = document.createElement('div');
    ov.className = 'overlay show';
    ov.id = 'ovPzHistory';
    ov.innerHTML = '<div class="modal"><h2>📜 История задач</h2>' +
      '<div class="phList">' + rows + '</div>' +
      '<div class="modalBtns"><button class="btn" id="phClose">Закрыть</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#phClose').addEventListener('click', () => ov.remove());
  }
};

if(typeof window !== 'undefined') window.Puzzles = Puzzles;
