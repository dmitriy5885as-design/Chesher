/**
 * ЧЕШЕР — Единый сервис прогресса (XP / уровни / награды)
 * Один источник правды для начисления опыта:
 * - Progress.addXp(amount, source) — единственный вход для получения XP
 * - Уровень вычисляется из суммарного XP (не хранится отдельно — нет рассинхрона)
 * - Компактные не-блокирующие анимации: «+50 XP», «LEVEL UP!»
 * - XP никак не влияет на ELO/ratings — разные оси прогресса
 */
"use strict";

const Progress = {
  /* --- Таблица начислений XP (менять только здесь) --- */
  GAIN: {
    gameFinish: 10,     // любая завершённая партия
    win: 40,            // победа
    draw: 20,           // ничья
    loss: 5,            // участие
    checkmate: 15,      // победа именно матом
    winStreak: 5,       // +N за каждый шаг серии побед (с потолком)
    winStreakCap: 50,
    quest: 50,          // каждый квест дня
    questsAll: 100,      // бонус за все 3 квеста дня
    achievement: 30,    // достижение
    dailyGift: 20,      // ежедневный подарок
    milestoneBase: 100, // майлстоун стрика задачек (× порядковый номер)
    tournamentRound: 25,
    tournamentWin: 200,
    memeWin: 10,
    puzzle: {           // задача дня по сложности
      easy: 80,
      medium: 120,
      hard: 180,
      expert: 250,
      legendary: 400
    }
  },

  /* --- XP, необходимый для перехода с level на level+1 --- */
  need(level) {
    const L = Math.max(1, Math.floor(level || 1));
    return Math.round(120 * Math.pow(L, 1.25));
  },

  /* --- Уровень из суммарного XP --- */
  fromXp(xp) {
    let rest = Math.max(0, Math.floor(typeof xp === 'number' ? xp : 0));
    let level = 1;
    while(level < 999 && rest >= this.need(level)) {
      rest -= this.need(level);
      level++;
    }
    const need = this.need(level);
    return {
      level: level,
      cur: rest,
      need: need,
      pct: Math.max(0, Math.min(100, Math.round(rest / need * 100))),
      total: Math.max(0, Math.floor(typeof xp === 'number' ? xp : 0))
    };
  },

  /* --- Текущий прогресс текущего профиля --- */
  summary() {
    const cu = typeof ProfilesManager !== 'undefined' ? ProfilesManager.getCurrent() : null;
    if(!cu) return this.fromXp(0);
    return this.fromXp(cu.xp || 0);
  },

  /**
   * Начислить XP. Единственная точка входа.
   * opts: { silent (без анимаций), node (позиция float), skipSeason }
   * Возвращает { gained, before, after, levelUp }
   */
  addXp(amount, source, opts) {
    opts = opts || {};
    amount = Math.round(amount || 0);
    const cu = typeof ProfilesManager !== 'undefined' ? ProfilesManager.getCurrent() : null;
    if(!cu || amount <= 0) return { gained: 0, before: null, after: null, levelUp: false };

    const before = this.fromXp(cu.xp || 0);
    cu.xp = before.total + amount;
    const after = this.fromXp(cu.xp);
    if(typeof saveProfiles === 'function') saveProfiles();

    if(!opts.silent) {
      this.float(amount, opts.node);
      if(after.level > before.level) this.levelUp(after.level);
    }
    if(!opts.skipSeason && typeof Season !== 'undefined' && Season && typeof Season.addXp === 'function') {
      try { Season.addXp(amount); } catch(e) {}
    }
    if(typeof Analytics !== 'undefined' && Analytics && Analytics.track) {
      try { Analytics.track('xp_gain', { source: source || '', amount: amount, level: after.level }); } catch(e) {}
    }
    if(typeof renderProfBar === 'function') renderProfBar();
    return { gained: amount, before: before, after: after, levelUp: after.level > before.level };
  },

  /* --- Компактный float «+N XP» (не блокирует клики) --- */
  float(amount, node) {
    if(typeof document === 'undefined' || !amount) return;
    const el = document.createElement('div');
    el.className = 'xpFloat';
    el.textContent = '+' + amount + ' XP';
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch(e) {} }, 1400);
  },

  /* --- «LEVEL UP!» (не блокирует клики) --- */
  levelUp(level) {
    if(typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = 'xpLevelUp';
    el.innerHTML = '<b>LEVEL UP!</b><span>Уровень ' + level + '</span>';
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch(e) {} }, 2200);
    if(typeof snd !== 'undefined' && snd && typeof snd.win === 'function') {
      try { snd.win(); } catch(e) {}
    }
  },

  /* --- Начислить XP за достижение (единая обёртка) --- */
  awardAchievement() {
    return this.addXp(this.GAIN.achievement, 'achievement');
  }
};

if(typeof window !== 'undefined') window.Progress = Progress;
