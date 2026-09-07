/**
 * ЧЕШЕР — Система профилей игроков
 * Управление профилями: имя, аватар, статистика, настройки
 * Хранение данных в localStorage
 * 
 * Основные функции:
 * - Profile.load() — загрузить профили из localStorage
 * - Profile.save() — сохранить профили в localStorage
 * - Profile.newProfile(name, avatar) — создать новый профиль
 * - Profile.selectProfile(id) — выбрать профиль
 * - Profile.recordResult(result, vsBot) — записать результат игры
 * - Profile.getCurrent() — получить текущий профиль
 * - Profile.addCoins(amount) — добавить монеты
 * - Profile.spendCoins(amount) — потратить монеты
 */
"use strict";

/* --- Константы --- */
const DEFAULT_AVATARS = [
  '👽','🐣','🦊','🐸','🐼','🦁','🐺','🦉','🐙',
  '🦄','🐲','🤖','💀','🎃','♔','♞'
];

const DEFAULT_START_STATS = {
  games: 0, wins: 0, losses: 0, draws: 0,
  streak: 0, lastResult: '—', lastOpponent: '—'
};

/* --- Класс Profile --- */
class Profile {
  constructor(id, data = {}) {
    this.id = id || 'p' + Date.now().toString(36);
    this.name = data.name || 'Игрок';
    this.ava = data.ava || DEFAULT_AVATARS[0];
    this.st = {...DEFAULT_START_STATS, ...data.st};
    this.coins = typeof data.coins === 'number' ? data.coins : 50;
    this.gems = typeof data.gems === 'number' ? data.gems : 0;
    this.owned = data.owned || ['classic', 'board_classic'];
    this.ach = data.ach || {};
    this.lastBonus = data.lastBonus || '';
    this.lastNickChange = data.lastNickChange || 0;
    this.customAva = data.customAva || null;
    this.admin = data.admin || false;
    this.winsBot = data.winsBot || 0;
    this.elo = typeof data.elo === 'number' ? data.elo : 0;
    this.botId = data.botId || 1;
    this.botStats = data.botStats || {};
    this.matchHistory = data.matchHistory || [];
    this.playerId = data.playerId || null;
    // Auto-generate playerId for profiles that don't have one
    if(!this.playerId && this.name && this.name !== 'Гость' && this.name !== 'Guest') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let id = 'CHS-';
      for(let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
      this.playerId = id;
    }
    // Per-mode ratings
    this.ratings = data.ratings || {
      classic: 1000,
      bot: 1000,
      fischer: 1000,
      meme: 1000,
      ranked: 1000
    };
    // Ensure all modes exist
    ['classic','bot','fischer','meme','ranked'].forEach(m => {
      if(typeof this.ratings[m] !== 'number') this.ratings[m] = 0;
    });
  }

  /* --- Статистика --- */
  get winrate() {
    if(this.st.games === 0) return 0;
    return Math.round(this.st.wins / this.st.games * 100);
  }

  get statsString() {
    return `${this.winrate}% winrate · ${this.st.games} партий · ${this.st.wins}/${this.st.losses}/${this.st.draws}`;
  }

  /* --- Монеты --- */
  addCoins(amount) {
    this.coins = Math.max(0, (this.coins || 0) + amount);
    return this.coins;
  }

  spendCoins(amount) {
    if(this.coins < amount) return false;
    this.coins -= amount;
    return true;
  }

  /* --- Кристаллы --- */
  addGems(amount) {
    this.gems = Math.max(0, (this.gems || 0) + amount);
    return this.gems;
  }

  spendGems(amount) {
    if((this.gems || 0) < amount) return false;
    this.gems -= amount;
    return true;
  }

  /* --- Смена ника (раз в 7 дней) --- */
  canChangeNick() {
    const now = Date.now();
    const last = this.lastNickChange || 0;
    const diff = now - last;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    return diff >= SEVEN_DAYS;
  }

  getNickChangeCooldown() {
    const now = Date.now();
    const last = this.lastNickChange || 0;
    const diff = now - last;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if(diff >= SEVEN_DAYS) return null;
    const remaining = SEVEN_DAYS - diff;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return days + 'д ' + hours + 'ч';
  }

  changeNick(newName) {
    if(!this.canChangeNick()) return false;
    this.name = newName;
    this.lastNickChange = Date.now();
    return true;
  }

  /* --- Результат игры --- */
  recordResult(result, vsBot = false, mode) {
    this.st.games++;
    if(result === 'win') {
      this.st.wins++;
      this.st.lastResult = 'победа';
      this.streak++;
      if(vsBot) this.winsBot++;
      this.addCoins(10);
      if(this.st.wins % 3 === 0) this.addGems(1);
    } else if(result === 'loss') {
      this.st.losses++;
      this.st.lastResult = 'поражение';
      this.streak = 0;
    } else if(result === 'draw') {
      this.st.draws++;
      this.st.lastResult = 'ничья';
      this.addCoins(3);
    }
    // Track per-bot stats
    if(vsBot && this.botId) {
      const bid = String(this.botId);
      if(!this.botStats[bid]) this.botStats[bid] = {games: 0, wins: 0, losses: 0};
      this.botStats[bid].games++;
      if(result === 'win') this.botStats[bid].wins++;
      else if(result === 'loss') this.botStats[bid].losses++;
    }
    // Update per-mode rating
    const modeId = mode || (vsBot ? 'bot' : 'classic');
    if(this.ratings[modeId] !== undefined) {
      const K = 32;
      const elo = this.ratings[modeId];
      const opponentElo = 0;
      const expected = 1 / (1 + Math.pow(10, (opponentElo - elo) / 400));
      const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
      this.ratings[modeId] = Math.round(elo + K * (actual - expected));
    }
    saveProfiles();
  }

  /* --- Ежедневный бонус --- */
  checkDailyBonus() {
    const today = new Date().toISOString().split('T')[0];
    if(this.lastBonus === today) return false;
    this.lastBonus = today;
    this.addCoins(25);
    saveProfiles();
    return true;
  }

  /* --- Достижения --- */
  checkAchievements() {
    if(typeof Store !== 'undefined' && Store.checkAchievements) {
      Store.checkAchievements();
    }
    return [];
  }

  /* --- Сохранение / Загрузка --- */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ava: this.ava,
      st: this.st,
      coins: this.coins,
      gems: this.gems,
      owned: this.owned,
      ach: this.ach,
      lastBonus: this.lastBonus,
      lastNickChange: this.lastNickChange,
      customAva: this.customAva,
      admin: this.admin,
      winsBot: this.winsBot,
      elo: this.elo,
      botId: this.botId,
      botStats: this.botStats,
      ratings: this.ratings,
      matchHistory: this.matchHistory,
      playerId: this.playerId
    };
  }

  static fromJSON(data) {
    return new this(data.id, {
      name: data.name,
      ava: data.ava,
      st: data.st,
      coins: data.coins,
      gems: data.gems,
      owned: data.owned,
      ach: data.ach,
      lastBonus: data.lastBonus,
      lastNickChange: data.lastNickChange,
      customAva: data.customAva,
      admin: data.admin,
      winsBot: data.winsBot,
      elo: data.elo,
      botId: data.botId,
      botStats: data.botStats,
      ratings: data.ratings,
      matchHistory: data.matchHistory,
      playerId: data.playerId
    });
  }
}

/* --- Хранилище профилей --- */
const ProfilesManager = {
  /* --- Загрузка профилей --- */
  load() {
    try {
      const raw = localStorage.getItem('chesher_profiles');
      if(raw) {
        const data = JSON.parse(raw);
        if(data && Array.isArray(data.profiles)) {
          this.profiles = data.profiles.map(p => Profile.fromJSON(p));
          this.current = data.current || this.profiles[0].id;
          return this.profiles;
        }
      }
    } catch(e) {
      console.error('Ошибка загрузки профилей:', e);
    }
    
    // Создать первый профиль если пусто
    const firstId = 'p' + Date.now().toString(36);
    const firstProfile = new Profile(firstId, {
      name: 'Гость',
      ava: '👽',
      coins: 50
    });
    this.profiles = [firstProfile];
    this.current = firstId;
    this.save();
    return this.profiles;
  },

  /* --- Сохранение профилей --- */
  save() {
    try {
      const data = {
        profiles: this.profiles.map(p => p.toJSON()),
        current: this.current
      };
      localStorage.setItem('chesher_profiles', JSON.stringify(data));
    } catch(e) {
      console.error('Ошибка сохранения профилей:', e);
    }
  },

  /* --- Выбор профиля --- */
  selectProfile(id) {
    const profile = this.profiles.find(p => p.id === id);
    if(profile) {
      this.current = id;
      saveProfiles(); // сохраняем выбранный профиль
      return profile;
    }
    return null;
  },

  /* --- Получить текущий профиль --- */
  getCurrent() {
    const profile = this.profiles.find(p => p.id === this.current);
    return profile || this.profiles[0];
  },

  /* --- Создание нового профиля --- */
  newProfile(name, avatarIndex = 0) {
    const avatar = DEFAULT_AVATARS[avatarIndex % DEFAULT_AVATARS.length];
    const id = 'p' + Math.random().toString(36).slice(2, 11);
    const newProfile = new Profile(id, {name, ava: avatar});
    this.profiles.push(newProfile);
    this.current = id;
    this.save();
    return newProfile;
  },

  /* --- Удаление профиля --- */
  deleteProfile(id) {
    if(this.profiles.length <= 1) {
      // toast('Нельзя удалить единственный профиль');
      return false;
    }
    const idx = this.profiles.findIndex(p => p.id === id);
    if(idx > -1) {
      this.profiles.splice(idx, 1);
      if(this.current === id) this.current = this.profiles[0].id;
      this.save();
      return true;
    }
    return false;
  }
};

/* --- Глобальная функция сохранения профилей --- */
function saveProfiles() {
  ProfilesManager.save();
}

// Инициализация при загрузке
ProfilesManager.load();

if(typeof window !== 'undefined') {
  window.Profile = Profile;
  window.ProfilesManager = ProfilesManager;
  window.DEFAULT_AVATARS = DEFAULT_AVATARS;
}