/**
 * ЧЕШЕР — Магазин, скины, монеты, достижения, бонусы
 * 
 * Основные функции:
 * - Store.SKINS — определение всех скинов с ценами и глифами
 * - Store.getCurrentProfile() — получить текущий профиль
 * - Store.addCoins(amount) — добавить монеты
 * - Store.spendCoins(amount) — потратить монеты
 * - Store.buySkin(skinId) — купить скин
 * - Store.renderShop() — отрисовать магазин
 * - Store.checkAchievements() — проверить достижения
 * - Store.dailyBonus() — ежедневный бонус
 */
"use strict";

/* --- Определение скинов фигур --- */
const SKINS = {
  classic: {
    name: 'Классика',
    price: 0,
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  mono: {
    name: 'Монохром',
    price: 100,
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  rajasthani: {
    name: 'Раджастхан',
    price: 350,
    css: 'skin-rajasthani',
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  gothic: {
    name: 'Готика',
    price: 200,
    css: 'skin-gothic',
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  neon: {
    name: 'Неон',
    price: 300,
    css: 'skin-neon',
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'}
    }
  },
  antique: {
    name: 'Античность',
    price: 250,
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  skeleton: {
    name: 'Скелеты',
    price: 350,
    css: 'skin-skeleton',
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  fire: {
    name: 'Огненные',
    price: 400,
    css: 'skin-fire',
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  ice: {
    name: 'Ледяные',
    price: 400,
    css: 'skin-ice',
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  shadow: {
    name: 'Тени',
    price: 300,
    css: 'skin-shadow',
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  gold: {
    name: 'Золотые',
    price: 500,
    css: 'skin-gold',
    glyph: {
      w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  blood: {
    name: 'Кровь',
    price: 350,
    css: 'skin-blood',
    glyph: {
      w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
      b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
    }
  },
  dragon: {
    name: 'Драконий',
    price: 450,
    glyph: {
      w: {k:'🐉',q:'🐲',r:'🏰',b:'🦄',n:'🦅',p:'🐾'},
      b: {k:'🐉',q:'🐲',r:'🏰',b:'🦄',n:'🦅',p:'🐾'}
    }
  },
  forest: {
    name: 'Лесной',
    price: 300,
    css: 'skin-forest',
    glyph: {
      w: {k:'🌲',q:'👑',r:'🪵',b:'🍄',n:'🦊',p:'🍃'},
      b: {k:'🌲',q:'👑',r:'🪵',b:'🍄',n:'🦊',p:'🍃'}
    }
  },
  robot: {
    name: 'Робот',
    price: 400,
    css: 'skin-robot',
    glyph: {
      w: {k:'🤖',q:'🦾',r:'🏗',b:'⚙️',n:'🦿',p:'🔩'},
      b: {k:'🤖',q:'🦾',r:'🏗',b:'⚙️',n:'🦿',p:'🔩'}
    }
  },
  ghost: {
    name: 'Призраки',
    price: 350,
    css: 'skin-ghost',
    glyph: {
      w: {k:'👻',q:'💀',r:'🫥',b:'👽',n:'🫠',p:'🫧'},
      b: {k:'👻',q:'💀',r:'🫥',b:'👽',n:'🫠',p:'🫧'}
    }
  },
  crystal: {
    name: 'Кристалл',
    price: 400,
    css: 'skin-crystal',
    glyph: {
      w: {k:'💎',q:'🔷',r:'⬡',b:'◇',n:'△',p:'○'},
      b: {k:'💎',q:'🔷',r:'⬡',b:'◇',n:'△',p:'○'}
    }
  },
  theatre: {
    name: 'Театр',
    price: 300,
    glyph: {
      w: {k:'🎭',q:'👸',r:'🏰',b:'🧙',n:'🏇',p:'🎪'},
      b: {k:'🎭',q:'👸',r:'🏰',b:'🧙',n:'🏇',p:'🎪'}
    }
  },
  pirate: {
    name: 'Пиратский',
    price: 350,
    css: 'skin-pirate',
    glyph: {
      w: {k:'☠️',q:'👸',r:'⛵',b:'🗡️',n:'🦜',p:'💀'},
      b: {k:'☠️',q:'👸',r:'⛵',b:'🗡️',n:'🦜',p:'💀'}
    }
  },
  cosmic: {
    name: 'Космос',
    price: 0,
    gemPrice: 5,
    css: 'skin-cosmic',
    gem: true,
    glyph: {
      w: {k:'🌟',q:'🪐',r:'🛸',b:'☄️',n:'🌙',p:'⭐'},
      b: {k:'🌟',q:'🪐',r:'🛸',b:'☄️',n:'🌙',p:'⭐'}
    }
  },
  anime: {
    name: 'Аниме',
    price: 0,
    gemPrice: 8,
    gem: true,
    glyph: {
      w: {k:'⚔️',q:'👑',r:'🏯',b:'🌸',n:'🦊',p:'💢'},
      b: {k:'⚔️',q:'👑',r:'🏯',b:'🌸',n:'🦊',p:'💢'}
    }
  },
  cyber: {
    name: 'Киберпанк',
    price: 0,
    gemPrice: 10,
    css: 'skin-cyber',
    gem: true,
    glyph: {
      w: {k:'🔌',q:'💾',r:'🖥️',b:'📀',n:'🦾',p:'🔋'},
      b: {k:'🔌',q:'💾',r:'🖥️',b:'📀',n:'🦾',p:'🔋'}
    }
  },
  royal: {
    name: 'Королевский',
    price: 0,
    gemPrice: 12,
    css: 'skin-royal',
    gem: true,
    glyph: {
      w: {k:'👑',q:'💎',r:'🏰',b:'🗡️',n:'🐎',p:'⚜️'},
      b: {k:'👑',q:'💎',r:'🏰',b:'🗡️',n:'🐎',p:'⚜️'}
    }
  },
  void: {
    name: 'Бездна',
    price: 0,
    gemPrice: 15,
    css: 'skin-void',
    gem: true,
    glyph: {
      w: {k:'👁️',q:'🌑',r:'⬛',b:'🕳️',n:'🦑',p:'🖤'},
      b: {k:'👁️',q:'🌑',r:'⬛',b:'🕳️',n:'🦑',p:'🖤'}
    }
  }
};

/* --- Доски --- */
const BOARDS = {
  classic: {name: 'Классика', price: 0, light: '#f0d9b5', dark: '#b58863'},
  blue: {name: 'Синева', price: 120, light: '#dee3e6', dark: '#8ca2ad'},
  green: {name: 'Трава', price: 120, light: '#ffffdd', dark: '#86a666'},
  purple: {name: 'Аметист', price: 180, light: '#e8d5e8', dark: '#9b59b6'},
  ocean: {name: 'Океан', price: 200, light: '#d4f1f9', dark: '#006bab'},
  lava: {name: 'Лава', price: 250, light: '#ffecd2', dark: '#c0392b'},
  wood: {name: 'Дерево', price: 300, light: '#f5deb3', dark: '#8b4513'},
  rajasthani: {name: 'Раджастхан', price: 200, light: '#f5e6c8', dark: '#8b4513'},
  neon: {name: 'Неон', price: 400, light: '#1a1a2e', dark: '#00ff88'}
};

/* --- Стикеры --- */
const STICKERS = {
  fire: {name: 'Огонь', price: 50, emoji: '🔥'},
  star: {name: 'Звезда', price: 50, emoji: '⭐'},
  heart: {name: 'Сердце', price: 50, emoji: '❤️'},
  thunder: {name: 'Молния', price: 80, emoji: '⚡'},
  crown: {name: 'Корона', price: 80, emoji: '👑'},
  gem: {name: 'Кристалл', price: 100, emoji: '💎'},
  dragon: {name: 'Дракон', price: 150, emoji: '🐉'},
  phoenix: {name: 'Феникс', price: 200, emoji: '🔥'}
};

/* --- Аватарки --- */
const AVATARS = {
  default: {name: 'Стандарт', price: 0, emoji: '🐣'},
  cat: {name: 'Кот', price: 80, emoji: '🐱'},
  dog: {name: 'Собака', price: 80, emoji: '🐶'},
  lion: {name: 'Лев', price: 120, emoji: '🦁'},
  wolf: {name: 'Волк', price: 120, emoji: '🐺'},
  owl: {name: 'Сова', price: 150, emoji: '🦉'},
  eagle: {name: 'Орёл', price: 150, emoji: '🦅'},
  dragon: {name: 'Дракон', price: 200, emoji: '🐉'},
  robot: {name: 'Робот', price: 250, emoji: '🤖'},
  alien: {name: 'Пришелец', price: 300, emoji: '👽'}
};

/* --- Текущая вкладка магазина --- */
// shopTab now stored in cfg.shopTab

/* --- Константы игры --- */
const ACHS = [
  {id:'first_win', name:'Первая кровь', desc:'Победить впервые', coins:20, chk:p=>p.st.wins>=1},
  {id:'ten_wins', name:'Десятка', desc:'10 побед всего', coins:50, chk:p=>p.st.wins>=10},
  {id:'streak3', name:'В огне', desc:'3 победы подряд', coins:30, chk:p=>(p.st.streak||0)>=3},
  {id:'slayer', name:'Убийца машин', desc:'5 побед над ботом', coins:40, chk:p=>(p.winsBot||0)>=5},
  {id:'rich', name:'Богач', desc:'Накопить 500 монет', coins:0, chk:p=>p.coins>=500}
];

/* --- Менеджмент магазина --- */
const Store = {
  /* --- Получить текущий профиль --- */
  getCurrentProfile() {
    return ProfilesManager.getCurrent();
  },

  /* --- Добавить монеты --- */
  addCoins(amount) {
    const profile = ProfilesManager.getCurrent();
    if(profile) return profile.addCoins(amount);
    return false;
  },

  /* --- Потратить монеты --- */
  spendCoins(amount) {
    const profile = ProfilesManager.getCurrent();
    if(profile) return profile.spendCoins(amount);
    return false;
  },

  /* --- Купить скин --- */
  buySkin(skinId) {
    const skin = SKINS[skinId];
    if(!skin) return false;
    
    const profile = Store.getCurrentProfile();
    if(!profile) return false;
    
    // Проверяем, хватает ли монет
    if(profile.coins < skin.price) {
      toast('Не хватает монет — побеждайте чаще!');
      return false;
    }
    
    // Покупаем
    profile.spendCoins(skin.price);
    
    // Добавляем в список владеных (если ещё нет)
    if(!profile.owned.includes(skinId)) {
      profile.owned.push(skinId);
    }
    
    // Устанавливаем как текущий
    cfg.skin = skinId;
    saveCfg();
    fullRender();
    renderShopStates();
    toast('Куплен скин "' + skin.name + '"!');
    snd.win();
    return true;
  },

  /* --- Рендер магазина --- */
  renderShop(tab) {
    if(tab) cfg.shopTab = tab;
    const grid = document.getElementById('shopGrid');
    const tabs = document.getElementById('shopTabs');
    if(!grid) return;

    // Update active tab
    if(tabs) {
      tabs.querySelectorAll('.shopTab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === cfg.shopTab);
      });
    }
    
    const profile = Store.getCurrentProfile();
    const owned = profile ? profile.owned : ['classic'];
    grid.innerHTML = '';

    if(cfg.shopTab === 'skins') {
      Object.keys(SKINS).forEach(id => {
        const skin = SKINS[id];
        if(skin.gem) return;
        const isOwned = owned.includes(id);
        const isActive = cfg.skin === id;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.innerHTML = '<div class="shopItemPreview skinPrev">' +
          '<i>' + skin.glyph.w.k + '</i><i>' + skin.glyph.w.q + '</i><i>' + skin.glyph.w.r + '</i><i>' + skin.glyph.w.n + '</i>' +
          '</div>' +
          '<div class="shopItemName">' + skin.name + '</div>' +
          '<button class="buyBtn" data-type="skin" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '🪙 ' + skin.price)) + '</button>';
        grid.appendChild(card);
      });
    } else if(cfg.shopTab === 'premium') {
      Object.keys(SKINS).forEach(id => {
        const skin = SKINS[id];
        if(!skin.gem) return;
        const isOwned = owned.includes(id);
        const isActive = cfg.skin === id;
        const card = document.createElement('div');
        card.className = 'shopItem premiumItem' + (isActive ? ' active' : '');
        card.innerHTML = '<div class="shopItemPreview skinPrev">' +
          '<i>' + skin.glyph.w.k + '</i><i>' + skin.glyph.w.q + '</i><i>' + skin.glyph.w.r + '</i><i>' + skin.glyph.w.n + '</i>' +
          '</div>' +
          '<div class="shopItemName">' + skin.name + '</div>' +
          '<button class="buyBtn" data-type="skin" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '💎 ' + skin.gemPrice)) + '</button>';
        grid.appendChild(card);
      });
    } else if(cfg.shopTab === 'boards') {
      Object.keys(BOARDS).forEach(id => {
        const b = BOARDS[id];
        const isOwned = owned.includes('board_' + id);
        const isActive = cfg.board === id;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.innerHTML = '<div class="shopItemPreview boardPrev">' +
          '<div class="boardMini" style="background:linear-gradient(135deg,' + b.light + ' 25%,' + b.dark + ' 25%,' + b.dark + ' 50%,' + b.light + ' 50%,' + b.light + ' 75%,' + b.dark + ' 75%);background-size:20px 20px"></div>' +
          '</div>' +
          '<div class="shopItemName">' + b.name + '</div>' +
          '<button class="buyBtn" data-type="board" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '🪙 ' + b.price)) + '</button>';
        grid.appendChild(card);
      });
    } else if(cfg.shopTab === 'stickers') {
      Object.keys(STICKERS).forEach(id => {
        const s = STICKERS[id];
        const isOwned = owned.includes('sticker_' + id);
        const card = document.createElement('div');
        card.className = 'shopItem';
        card.innerHTML = '<div class="shopItemPreview stickerPrev">' + s.emoji + '</div>' +
          '<div class="shopItemName">' + s.name + '</div>' +
          '<button class="buyBtn" data-type="sticker" data-id="' + id + '">' +
          (isOwned ? '✓ Куплено' : '🪙 ' + s.price) + '</button>';
        grid.appendChild(card);
      });
    } else if(cfg.shopTab === 'avatars') {
      Object.keys(AVATARS).forEach(id => {
        const a = AVATARS[id];
        const isOwned = owned.includes('avatar_' + id);
        const isActive = profile && profile.ava === a.emoji;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.innerHTML = '<div class="shopItemPreview avatarPrev">' + a.emoji + '</div>' +
          '<div class="shopItemName">' + a.name + '</div>' +
          '<button class="buyBtn" data-type="avatar" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '🪙 ' + a.price)) + '</button>';
        grid.appendChild(card);
      });
    }
    
    Store.initShopClicks();
  },

  /* --- Инициализация кликов в магазине --- */
  initShopClicks() {
    const grid = document.getElementById('shopGrid');
    if(!grid) return;
    
    // Tab switching
    const tabs = document.getElementById('shopTabs');
    if(tabs) {
      tabs.onclick = function(e) {
        const tab = e.target.closest('.shopTab');
        if(!tab) return;
        snd.ui();
        Store.renderShop(tab.dataset.tab);
      };
    }
    
    grid.onclick = function(e) {
      const btn = e.target.closest('.buyBtn');
      if(!btn) return;
      
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      snd.ui();
      
      const profile = Store.getCurrentProfile();
      if(!profile) return;

      if(type === 'skin') {
        const skin = SKINS[id];
        if(profile.owned.includes(id)) {
          if(cfg.skin === id) return;
          cfg.skin = id;
          saveCfg();
          Store.renderShop();
          toast('Скин "' + skin.name + '" выбран');
          return;
        }
        if(skin.gem) {
          if((profile.gems || 0) < skin.gemPrice) { toast('Не хватает кристаллов!'); return; }
          profile.spendGems(skin.gemPrice);
          renderCoins();
        } else {
          if(!Store.spendCoins(skin.price)) { toast('Не хватает монет!'); return; }
        }
        profile.owned.push(id);
        saveProfiles();
        cfg.skin = id;
        saveCfg();
        Store.renderShop();
        toast('Куплен скин "' + skin.name + '"!');
        snd.win();
      } else if(type === 'board') {
        const board = BOARDS[id];
        const ownedKey = 'board_' + id;
        if(profile.owned.includes(ownedKey)) {
          if(cfg.board === id) return;
          cfg.board = id;
          saveCfg();
          Store.renderShop();
          toast('Доска "' + board.name + '" выбрана');
          return;
        }
        if(Store.spendCoins(board.price)) {
          profile.owned.push(ownedKey);
          saveProfiles();
          cfg.board = id;
          saveCfg();
          Store.renderShop();
          toast('Куплена доска "' + board.name + '"!');
          snd.win();
        } else {
          toast('Не хватает монет!');
        }
      } else if(type === 'sticker') {
        const sticker = STICKERS[id];
        const ownedKey = 'sticker_' + id;
        if(profile.owned.includes(ownedKey)) {
          toast('Стикер уже куплен');
          return;
        }
        if(Store.spendCoins(sticker.price)) {
          profile.owned.push(ownedKey);
          saveProfiles();
          Store.renderShop();
          toast('Куплен стикер "' + sticker.name + '"!');
          snd.win();
        } else {
          toast('Не хватает монет!');
        }
      } else if(type === 'avatar') {
        const avatar = AVATARS[id];
        const ownedKey = 'avatar_' + id;
        if(profile.owned.includes(ownedKey)) {
          if(profile.ava === avatar.emoji) return;
          profile.ava = avatar.emoji;
          saveProfiles();
          Store.renderShop();
          renderProfBar();
          toast('Аватарка "' + avatar.name + '" выбрана');
          return;
        }
        if(Store.spendCoins(avatar.price)) {
          profile.owned.push(ownedKey);
          saveProfiles();
          profile.ava = avatar.emoji;
          saveProfiles();
          Store.renderShop();
          renderProfBar();
          toast('Куплена аватарка "' + avatar.name + '"!');
          snd.win();
        } else {
          toast('Не хватает монет!');
        }
      }
    };
  },

  /* --- Проверка достижений --- */
  checkAchievements() {
    const profile = Store.getCurrentProfile();
    if(!profile) return;
    
    ACHS.forEach(ach => {
      if(!profile.ach[ach.id] && ach.chk(profile)) {
        profile.ach[ach.id] = Date.now();
        const msg = '🏆 "' + ach.name + '" · +' + ach.coins + ' 🪙';
        setTimeout(() => {
          toast(msg);
          if(ach.coins) Store.addCoins(ach.coins);
          saveProfiles();
        }, 650);
      }
    });
    saveProfiles();
  },

  /* --- Ежедневный бонус --- */
  dailyBonus() {
    const profile = Store.getCurrentProfile();
    if(!profile) return false;
    
    const today = new Date().toISOString().split('T')[0];
    if(profile.lastBonus === today) return false;
    
    profile.lastBonus = today;
    profile.addCoins(25);
    saveProfiles();
    toast('🎁 Ежедневный бонус: +25 🪙');
    return true;
  }
};

/* --- Нормализация текущего скина и доски --- */
function normalizeSkin() {
  const profile = ProfilesManager.getCurrent();
  if (!cfg.skin || !SKINS[cfg.skin]) {
    cfg.skin = 'classic';
  }
  if (profile && !profile.owned.includes(cfg.skin)) {
    cfg.skin = 'classic';
  }
  if (!cfg.board || !BOARDS[cfg.board]) {
    cfg.board = 'classic';
  }
  if (profile && !profile.owned.includes('board_' + cfg.board)) {
    cfg.board = 'classic';
  }
}

/* --- Обновление состояния кнопок в магазине --- */
function renderShopStates() {
  Store.renderShop();
}

/* --- Начальная инициализация --- */
function initStore() {
  const profile = ProfilesManager.getCurrent();
  if(profile) {
    if(!profile.owned.includes('classic')) profile.owned.push('classic');
    if(!profile.owned.includes('board_classic')) profile.owned.push('board_classic');
    saveProfiles();
  }
  renderShopStates();
}

// Инициализация перенесена в main.js
// (document.addEventListener('DOMContentLoaded', initStore) — удалено, чтобы избежать конфликта)

if(typeof window !== 'undefined') {
  window.SKINS = SKINS;
  window.ACHS = ACHS;
  window.Store = Store;
  window.normalizeSkin = normalizeSkin;
}