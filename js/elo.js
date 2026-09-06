/**
 * ЧЕШЕР — Система Эло-рейтинга и лиг (v0.16.5)
 * 7 лиг, прогресс-бары, расчёт Эло
 */
"use strict";

const Elo = {
  /* --- 7 лиг --- */
  leagues: [
    {id: 'pawn',    min: 1000, max: 1199, name: 'Пешка',          emoji: '♟️', color: '#888'},
    {id: 'knight',  min: 1200, max: 1399, name: 'Конь',           emoji: '🐴', color: '#4a9eff'},
    {id: 'bishop',  min: 1400, max: 1599, name: 'Слон',           emoji: '🐘', color: '#ffcc00'},
    {id: 'rook',    min: 1600, max: 1799, name: 'Ладья',          emoji: '🏰', color: '#ff8800'},
    {id: 'queen',   min: 1800, max: 1999, name: 'Ферзь',          emoji: '👑', color: '#ff3344'},
    {id: 'king',    min: 2000, max: 2199, name: 'Король',         emoji: '♚', color: '#aa44ff'},
    {id: 'grand',   min: 2200, max: 9999, name: 'Гроссмейстер',   emoji: '🌟', color: '#ffd700'}
  ],

  /* --- Получить лигу по рейтингу --- */
  getLeague(elo) {
    for(const l of this.leagues) {
      if(elo >= l.min && elo <= l.max) return l;
    }
    return this.leagues[this.leagues.length - 1];
  },

  /* --- Прогресс до следующей лиги (0-100%) --- */
  getNextLeagueProgress(elo) {
    for(let i = 0; i < this.leagues.length; i++) {
      if(elo < this.leagues[i].max) {
        const league = this.leagues[i];
        const prevMin = league.min;
        const progress = ((elo - prevMin) / (league.max - prevMin)) * 100;
        return {
          progress: Math.min(Math.max(progress, 0), 100),
          next: (i < this.leagues.length - 1) ? this.leagues[i + 1] : null,
          current: league
        };
      }
    }
    return {progress: 100, next: null, current: this.leagues[this.leagues.length - 1]};
  },

  /* --- Расчёт изменения Эло --- */
  calculateEloChange(playerElo, opponentElo, outcome) {
    const K = 32;
    const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    let actual = 0;
    if(outcome === 'win') actual = 1;
    else if(outcome === 'draw') actual = 0.5;
    else actual = 0;
    return Math.round(K * (actual - expected));
  },

  /* --- Обратная совместимость --- */
  ratingToLevel(rating) {
    const l = this.getLeague(rating);
    return l ? l.id : 'pawn';
  },

  levelToRating(levelId) {
    const l = this.leagues.find(x => x.id === levelId);
    return l ? l.min : 1000;
  },

  getLevelName(levelId) {
    const l = this.leagues.find(x => x.id === levelId);
    return l ? l.name : 'Пешка';
  }
};

if(typeof window !== 'undefined') window.Elo = Elo;
