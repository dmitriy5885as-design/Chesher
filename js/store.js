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
const CLASSIC_GLYPH = {
  w: {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
  b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
};
const SOLID_GLYPH = {
  w: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},
  b: {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
};
const SKINS = {
  classic: {
    name: 'Классика',
    price: 0,
    glyph: CLASSIC_GLYPH
  },
  classic_plus: {
    name: 'Классика+',
    price: 250,
    css: 'skin-classic-plus',
    glyph: CLASSIC_GLYPH
  },
  cartoon: {
    name: 'Мультяшный',
    price: 200,
    css: 'skin-cartoon',
    glyph: CLASSIC_GLYPH
  },
  pixel: {
    name: 'Пиксельный',
    price: 300,
    css: 'skin-pixel',
    glyph: SOLID_GLYPH
  },
  street: {
    name: 'Городской / Стрит',
    price: 300,
    css: 'skin-street',
    glyph: CLASSIC_GLYPH
  },
  nature: {
    name: 'Природа / Фэнтези',
    price: 350,
    css: 'skin-nature',
    glyph: {
      w: {k:'🧙',q:'🧝',r:'🏰',b:'🍄',n:'🦄',p:'🌱'},
      b: {k:'🧙',q:'🧝',r:'🏰',b:'🍄',n:'🦄',p:'🌱'}
    }
  },
  cosmos: {
    name: 'Космос',
    price: 350,
    css: 'skin-cosmic',
    glyph: {
      w: {k:'🌟',q:'🪐',r:'🛸',b:'☄️',n:'🌙',p:'⭐'},
      b: {k:'🌟',q:'🪐',r:'🛸',b:'☄️',n:'🌙',p:'⭐'}
    }
  },
  cyber: {
    name: 'Киберпанк',
    price: 450,
    css: 'skin-cyber',
    glyph: CLASSIC_GLYPH
  },
  horror: {
    name: 'Хоррор',
    price: 400,
    css: 'skin-horror',
    glyph: {
      w: {k:'💀',q:'🧟',r:'⚰️',b:'🦇',n:'🕷️',p:'🩸'},
      b: {k:'💀',q:'🧟',r:'⚰️',b:'🦇',n:'🕷️',p:'🩸'}
    }
  },
  trash: {
    name: 'Трэш / Мем',
    price: 150,
    css: 'skin-trash',
    glyph: {
      w: {k:'🤡',q:'💅',r:'🚜',b:'🎸',n:'🐸',p:'💩'},
      b: {k:'🤡',q:'💅',r:'🚜',b:'🎸',n:'🐸',p:'💩'}
    }
  }
};

/* --- Доски --- */
const BOARDS = {
  /* Стандартные — символическая цена */
  classic: {name: 'Классика', price: 0, light: '#f0d9b5', dark: '#b58863'},
  blue: {name: 'Синева', price: 5, light: '#dee3e6', dark: '#8ca2ad'},
  green: {name: 'Трава', price: 5, light: '#ffffdd', dark: '#86a666'},
  purple: {name: 'Аметист', price: 5, light: '#e8d5e8', dark: '#9b59b6'},
  ocean: {name: 'Океан', price: 5, light: '#d4f1f9', dark: '#006bab'},
  lava: {name: 'Лава', price: 5, light: '#ffecd2', dark: '#c0392b'},
  /* Под тематику скинов фигур */
  classic_plus: {name: 'Классика+', price: 250, light: '#f1ede2', dark: '#6e6a60'},
  cartoon: {name: 'Мультяшный', price: 250, light: '#fff9d6', dark: '#6cc4f5'},
  pixel: {name: 'Пиксельный', price: 300, light: '#9bbc0f', dark: '#306230'},
  street: {name: 'Городской / Стрит', price: 300, light: '#d6d4cc', dark: '#565a60'},
  nature: {name: 'Природа / Фэнтези', price: 350, light: '#d6e7bd', dark: '#4f7a41'},
  cosmos: {name: 'Космос', price: 350, light: '#cfc9f2', dark: '#463b8c'},
  horror: {name: 'Хоррор', price: 400, light: '#b0a5a5', dark: '#5a1018'},
  cyber: {name: 'Киберпанк', price: 450, light: '#141a35', dark: '#00c8ff'},
  trash: {name: 'Трэш / Мем', price: 200, light: '#ffe9f7', dark: '#5de08f'}
};

/* --- Фоны интерфейса (экраны и главное меню) --- */
const BACKGROUNDS = {
  classic: {name: 'Классика', price: 0, style: ''},
  space: {name: 'Космос', price: 250, style: 'radial-gradient(circle at 70% -10%, #241a4d 0%, #100d26 45%, #07060f 100%)'},
  ocean: {name: 'Океан', price: 200, style: 'radial-gradient(circle at 50% -20%, #12507a 0%, #0b2c47 45%, #061420 100%)'},
  sunset: {name: 'Закат', price: 200, style: 'linear-gradient(180deg, #5a2a5f 0%, #a8473c 45%, #2a1526 100%)'},
  forest: {name: 'Лес', price: 180, style: 'radial-gradient(circle at 30% 10%, #1d4a2a 0%, #12301d 50%, #08130c 100%)'},
  lava: {name: 'Лава', price: 300, style: 'radial-gradient(circle at 50% 110%, #8a1f0e 0%, #3c1008 45%, #120603 100%)'},
  neon: {name: 'Неон', price: 350, style: 'linear-gradient(135deg, #0d0221 0%, #2b0a4d 45%, #071018 100%)'},
  royal: {name: 'Королевский', price: 300, style: 'radial-gradient(circle at 50% -20%, #3d2f10 0%, #1d1607 55%, #0c0a05 100%)'},
  aurora: {name: 'Сияние', price: 0, gemPrice: 8, gem: true, style: 'linear-gradient(160deg, #041a1f 0%, #0a3d3f 40%, #0f1d3d 75%, #060a14 100%)'},
  void: {name: 'Бездна', price: 0, gemPrice: 10, gem: true, style: 'radial-gradient(circle at 50% 40%, #17111f 0%, #0a0710 55%, #000 100%)'}
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
  default: {name: 'Стандарт', price: 0, emoji: '👽'},
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

/* --- Премиум-косметика (покупается за кристаллы 💎) --- */
const NICK_COLORS = [
  { id: 'nick_gold',   name: 'Золотой',    color: '#f7c531', gemPrice: 20 },
  { id: 'nick_amber',  name: 'Янтарный',   color: '#f0a830', gemPrice: 20 },
  { id: 'nick_violet', name: 'Фиолетовый', color: '#b48ee8', gemPrice: 30 },
  { id: 'nick_green',  name: 'Изумрудный', color: '#67c26b', gemPrice: 30 },
  { id: 'nick_red',    name: 'Алый',       color: '#e86a5a', gemPrice: 30 }
];
const PROFILE_FRAMES = [
  { id: 'frame_gold',   name: 'Золотая рамка',    color: '#f7c531', gemPrice: 40 },
  { id: 'frame_violet', name: 'Сиреневая рамка',  color: '#b48ee8', gemPrice: 40 },
  { id: 'frame_green',  name: 'Изумрудная рамка', color: '#67c26b', gemPrice: 40 },
  { id: 'frame_flame',  name: 'Пламенная рамка',  color: '#e86a5a', gemPrice: 60 }
];
const WIN_FX = [
  { id: 'fx_confetti', name: 'Конфетти', gemPrice: 50 },
  { id: 'fx_rays',     name: 'Сияние',   gemPrice: 50 }
];

/* --- Текущая вкладка магазина --- */
// shopTab now stored in cfg.shopTab

/* --- Константы игры --- */
const ACHS = [
  {id:'first_win', name:'Первая кровь', desc:'Победить впервые', coins:20, chk:p=>p.st.wins>=1},
  {id:'ten_wins', name:'Десятка', desc:'10 побед всего', coins:50, chk:p=>p.st.wins>=10},
  {id:'streak3', name:'В огне', desc:'3 победы подряд', coins:30, chk:p=>(p.st.streak||0)>=3},
  {id:'slayer', name:'Убийца машин', desc:'5 побед над ботом', coins:40, chk:p=>(p.winsBot||0)>=5},
  {id:'rich', name:'Богач', desc:'Накопить 500 монет', coins:0, gems:10, chk:p=>p.coins>=500},
  {id:'gift_streak_7', name:'Постоялец', desc:'Серия входов 7 дней', coins:50, gems:15, chk:p=>(p.giftStreak||0)>=7}
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
    if(typeof renderCoins === 'function') renderCoins();
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
    const note = document.querySelector('#scrShop .note');

    // Превью-панель справа: тип зависит от вкладки
    const pvType = cfg.shopTab === 'skins' ? 'skin' : cfg.shopTab === 'boards' ? 'board' : cfg.shopTab === 'backgrounds' ? 'background' : null;
    if(Store._pv.type !== pvType) Store._pv = { type: pvType, id: null };
    if(pvType && !Store._pv.id) {
      Store._pv.id = pvType === 'skin' ? cfg.skin : pvType === 'board' ? cfg.board : (cfg.bg || 'classic');
    }
    Store.renderPreview();

    if(cfg.shopTab === 'videos') {
      if(note) note.textContent = 'Все видео-мемы: не проигрываются автоматически. Нажми на видео, чтобы открыть его крупнее и со звуком. Клик за границами видео — вернуть как было.';
      if(typeof AVAILABLE_VIDEOS !== 'undefined') {
        AVAILABLE_VIDEOS.forEach(v => {
          const card = document.createElement('div');
          card.className = 'shopItem memVidItem';
          card.dataset.id = v.file;
          card.innerHTML =
            '<div class="shopItemPreview vidPrev">' +
              '<video loop muted playsinline preload="metadata" src="' + v.file + '#t=0.001"></video>' +
              '<span class="vidPlayBadge">▶</span>' +
            '</div>' +
            '<div class="shopItemName">' + v.name + '</div>';
          grid.appendChild(card);
        });
      }
      Store.initShopClicks();
      return;
    }

    if(note) note.textContent = cfg.shopTab === 'backgrounds'
      ? 'Фоны меняют фон всех экранов и главного меню. Покупаются за монеты 🪙 или кристаллы 💎 и применяются сразу.'
      : cfg.shopTab === 'boards'
        ? 'Доски меняют расцветку клеток. Нажми на карточку — справа откроется крупное превью.'
        : cfg.shopTab === 'skins'
          ? 'Скины меняют вид фигур. Нажми на карточку — справа появится большое превью доски с этим скином.'
          : 'Скины меняют вид фигур на доске. Монеты 🪙 — игровая валюта: победы (+10), ничьи (+3), серии и ежедневный вход (+25). Кристаллы 💎 — донатная валюта: выдаётся только за реальные деньги, баланс хранится на сервере.';

    if(cfg.shopTab === 'skins') {
      Object.keys(SKINS).forEach(id => {
        const skin = SKINS[id];
        if(skin.gem) return;
        const isOwned = owned.includes(id);
        const isActive = cfg.skin === id;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.dataset.pvType = 'skin';
        card.dataset.pvId = id;
        card.innerHTML = '<div class="shopItemPreview skinPrev' + (skin.css ? ' ' + skin.css : '') + '">' +
          '<i class="piece w">' + skin.glyph.w.k + '</i><i class="piece w">' + skin.glyph.w.q + '</i><i class="piece w">' + skin.glyph.w.r + '</i><i class="piece w">' + skin.glyph.w.n + '</i>' +
          '</div>' +
          '<div class="shopItemName">' + skin.name + '</div>' +
          (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
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
          (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
          '<button class="buyBtn" data-type="skin" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '💎 ' + skin.gemPrice)) + '</button>';
        grid.appendChild(card);
      });
      // Премиум-косметика: цвет ника, рамка профиля, эффект победы
      const cosSections = [
        { title: '✨ Цвет ника', type: 'nick', list: NICK_COLORS, field: 'nickColor' },
        { title: '🖼 Рамка профиля', type: 'frame', list: PROFILE_FRAMES, field: 'profileFrame' },
        { title: '🎉 Эффект победы', type: 'fx', list: WIN_FX, field: 'winFx' }
      ];
      cosSections.forEach(sec => {
        const head = document.createElement('div');
        head.className = 'shopSectionTitle';
        head.textContent = sec.title;
        grid.appendChild(head);
        sec.list.forEach(item => {
          const isOwned = owned.includes(item.id);
          const isActive = profile && profile[sec.field] === item.id;
          const card = document.createElement('div');
          card.className = 'shopItem premiumItem' + (isActive ? ' active' : '');
          let prev = '';
          if(sec.type === 'nick') prev = '<div class="shopItemPreview nickPrev" style="color:' + item.color + '">Игрок</div>';
          else if(sec.type === 'frame') prev = '<div class="shopItemPreview framePrev" style="border-color:' + item.color + '">🖼</div>';
          else prev = '<div class="shopItemPreview fxPrev">🎉</div>';
          card.innerHTML = prev +
            '<div class="shopItemName">' + item.name + '</div>' +
            (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
            '<button class="buyBtn" data-type="' + sec.type + '" data-id="' + item.id + '">' +
            (isActive ? '✓' : (isOwned ? 'Выбрать' : '💎 ' + item.gemPrice)) + '</button>';
          grid.appendChild(card);
        });
      });
    } else if(cfg.shopTab === 'boards') {
      Object.keys(BOARDS).forEach(id => {
        const b = BOARDS[id];
        const isOwned = owned.includes('board_' + id);
        const isActive = cfg.board === id;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.dataset.pvType = 'board';
        card.dataset.pvId = id;
        card.innerHTML = '<div class="shopItemPreview boardPrev">' +
          '<div class="boardMini" style="background:linear-gradient(135deg,' + b.light + ' 25%,' + b.dark + ' 25%,' + b.dark + ' 50%,' + b.light + ' 50%,' + b.light + ' 75%,' + b.dark + ' 75%);background-size:20px 20px"></div>' +
          '</div>' +
          '<div class="shopItemName">' + b.name + '</div>' +
          (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
          '<button class="buyBtn" data-type="board" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : '🪙 ' + b.price)) + '</button>';
        grid.appendChild(card);
      });
    } else if(cfg.shopTab === 'backgrounds') {
      Object.keys(BACKGROUNDS).forEach(id => {
        const bg = BACKGROUNDS[id];
        const isOwned = owned.includes('bg_' + id);
        const isActive = (cfg.bg || 'classic') === id;
        const card = document.createElement('div');
        card.className = 'shopItem' + (isActive ? ' active' : '');
        card.dataset.pvType = 'background';
        card.dataset.pvId = id;
        const priceLbl = bg.gem ? '💎 ' + bg.gemPrice : '🪙 ' + bg.price;
        card.innerHTML = '<div class="shopItemPreview bgPrev"' +
          (bg.style ? ' style="background:' + bg.style + '"' : '') + '>' +
          (bg.style ? '' : '<span class="bgPrevDef">♔</span>') + '</div>' +
          '<div class="shopItemName">' + bg.name + '</div>' +
          (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
          '<button class="buyBtn" data-type="background" data-id="' + id + '">' +
          (isActive ? '✓' : (isOwned ? 'Выбрать' : priceLbl)) + '</button>';
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
          (isActive ? '<div class="shopItemSt on">✓ Экипировано</div>' : (isOwned ? '<div class="shopItemSt">Куплено</div>' : '')) +
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
        if(Store.videoOverlay) Store.closeVideoPreview();
        Store.renderShop(tab.dataset.tab);
      };
    }
    
    grid.onclick = function(e) {
      const vidItem = e.target.closest('.memVidItem');
      if(vidItem) {
        const video = vidItem.querySelector('video');
        if(video) Store.openVideoPreview(vidItem, video);
        return;
      }

      const btn = e.target.closest('.buyBtn');
      if(!btn) {
        const pvCard = e.target.closest('[data-pv-id]');
        if(pvCard && pvCard.dataset.pvId && Store._pv && Store._pv.type) {
          snd.ui();
          Store._pv = { type: pvCard.dataset.pvType, id: pvCard.dataset.pvId };
          Store.renderPreview();
        }
        return;
      }

      snd.ui();
      Store.onAction(btn.dataset.type, btn.dataset.id);
    };
  },

  /* --- Действие кнопки: купить / выбрать (карточка или превью) --- */
  onAction(type, id) {
      // Переключаем превью-панель на предмет действия (если он видим на этой вкладке)
      const pvMap = { skin: 'skin', board: 'board', background: 'background' };
      if(pvMap[type] && Store._pv && Store._pv.type === pvMap[type]) Store._pv.id = id;

      const profile = Store.getCurrentProfile();
      if(!profile) return;

      const lackCoins = (price) => {
        const need = Math.max((price || 0) - (profile.coins || 0), 0);
        toast(need > 0 ? 'Не хватает ' + need + ' 🪙' : 'Не хватает монет!');
      };
      const lackGems = (price) => {
        const need = Math.max((price || 0) - (profile.gems || 0), 0);
        toast(need > 0 ? 'Не хватает ' + need + ' 💎' : 'Не хватает кристаллов!');
      };

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
          if((profile.gems || 0) < skin.gemPrice) { lackGems(skin.gemPrice); return; }
          profile.spendGems(skin.gemPrice);
          if(typeof Analytics !== 'undefined') Analytics.track('purchase_gem_item', { id: id, price: skin.gemPrice });
          renderCoins();
        } else {
          if(!Store.spendCoins(skin.price)) { lackCoins(skin.price); return; }
          if(typeof Analytics !== 'undefined') Analytics.track('purchase_coin_item', { id: id, price: skin.price });
        }
        profile.owned.push(id);
        saveProfiles();
        if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
          Promise.resolve(ChesAuth.updateProfile({ gems: profile.gems, owned: profile.owned })).catch(() => {});
        }
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
          if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
            Promise.resolve(ChesAuth.updateProfile({ owned: profile.owned })).catch(() => {});
          }
          cfg.board = id;
          saveCfg();
          Store.renderShop();
          toast('Куплена доска "' + board.name + '"!');
          snd.win();
        } else {
          lackCoins(board.price);
        }
      } else if(type === 'background') {
        const bg = BACKGROUNDS[id];
        if(!bg) return;
        const ownedKey = 'bg_' + id;
        if(profile.owned.includes(ownedKey)) {
          if((cfg.bg || 'classic') === id) return;
          cfg.bg = id;
          saveCfg();
          applyBackground();
          Store.renderShop();
          toast('Фон "' + bg.name + '" выбран');
          return;
        }
        if(bg.gem) {
          if((profile.gems || 0) < bg.gemPrice) { lackGems(bg.gemPrice); return; }
          profile.spendGems(bg.gemPrice);
        } else {
          if(!Store.spendCoins(bg.price)) { lackCoins(bg.price); return; }
        }
        profile.owned.push(ownedKey);
        saveProfiles();
        if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
          Promise.resolve(ChesAuth.updateProfile({ gems: profile.gems, owned: profile.owned })).catch(() => {});
        }
        cfg.bg = id;
        saveCfg();
        applyBackground();
        Store.renderShop();
        renderCoins();
        if(typeof Analytics !== 'undefined') Analytics.track(bg.gem ? 'purchase_gem_item' : 'purchase_coin_item', { id: id, price: bg.gem ? bg.gemPrice : bg.price });
        toast('Куплен фон "' + bg.name + '"!');
        snd.win();
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
          if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
            Promise.resolve(ChesAuth.updateProfile({ owned: profile.owned })).catch(() => {});
          }
          Store.renderShop();
          toast('Куплен стикер "' + sticker.name + '"!');
          snd.win();
        } else {
          lackCoins(sticker.price);
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
          if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
            Promise.resolve(ChesAuth.updateProfile({ owned: profile.owned })).catch(() => {});
          }
          profile.ava = avatar.emoji;
          saveProfiles();
          Store.renderShop();
          renderProfBar();
          toast('Куплена аватарка "' + avatar.name + '"!');
          snd.win();
        } else {
          lackCoins(avatar.price);
        }
      } else if(type === 'nick' || type === 'frame' || type === 'fx') {
        const list = type === 'nick' ? NICK_COLORS : type === 'frame' ? PROFILE_FRAMES : WIN_FX;
        const item = list.find(x => x.id === id);
        if(!item) return;
        const field = type === 'nick' ? 'nickColor' : type === 'frame' ? 'profileFrame' : 'winFx';
        const equip = () => {
          profile[field] = item.id;
          saveProfiles();
          if(typeof applyCosmetics === 'function') applyCosmetics();
          Store.renderShop();
          toast('Выбрано: ' + item.name);
        };
        if(profile.owned.includes(item.id)) { equip(); return; }
        if((profile.gems || 0) < item.gemPrice) { lackGems(item.gemPrice); return; }
        profile.spendGems(item.gemPrice);
        profile.owned.push(item.id);
        profile[field] = item.id;
        saveProfiles();
        if(typeof ChesAuth !== 'undefined' && ChesAuth.user) {
          Promise.resolve(ChesAuth.updateProfile({ gems: profile.gems, owned: profile.owned })).catch(() => {});
        }
        if(typeof applyCosmetics === 'function') applyCosmetics();
        renderCoins();
        Store.renderShop();
        if(typeof Analytics !== 'undefined') Analytics.track('purchase_gem_item', { id: id, price: item.gemPrice });
        toast('Куплено: ' + item.name + ' ✨');
        snd.win();
      }
  },

  /* --- Превью-панель справа в магазине --- */
  _pv: { type: null, id: null },

  /* --- Превью-панель справа (скин / доска / фон) --- */
  renderPreview() {
    const panel = document.getElementById('shopPreview');
    if(!panel) return;
    const pv = Store._pv;
    if(!pv || !pv.type || !pv.id) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
    const profile = Store.getCurrentProfile();
    const owned = profile ? profile.owned : ['classic'];

    let visual = '', title = '', sub = '', action = '';
    if(pv.type === 'skin') {
      const skin = SKINS[pv.id];
      if(!skin) { panel.style.display = 'none'; return; }
      const isActive = cfg.skin === pv.id;
      const isOwned = owned.includes(pv.id);
      const bd = BOARDS[cfg.board] || BOARDS.classic;
      visual = Store._spBoard({ skinCss: skin.css, skinId: pv.id, light: bd.light, dark: bd.dark, pieces: true });
      title = skin.name;
      sub = 'Скин фигур · ' + (isActive ? 'экипирован' : isOwned ? 'куплен' : (skin.gem ? '💎 ' + skin.gemPrice : '🪙 ' + skin.price));
      action = isActive
        ? '<div class="spStatus on">✓ Экипировано</div>'
        : '<button class="buyBtn" data-type="skin" data-id="' + pv.id + '">' + (isOwned ? 'Выбрать' : (skin.gem ? '💎 ' + skin.gemPrice : '🪙 ' + skin.price)) + '</button>';
    } else if(pv.type === 'board') {
      const b = BOARDS[pv.id];
      if(!b) { panel.style.display = 'none'; return; }
      const isActive = cfg.board === pv.id;
      const isOwned = owned.includes('board_' + pv.id);
      visual = Store._spBoard({ light: b.light, dark: b.dark, pieces: false });
      title = b.name;
      sub = 'Доска · ' + (isActive ? 'экипирована' : isOwned ? 'куплена' : '🪙 ' + b.price);
      action = isActive
        ? '<div class="spStatus on">✓ Экипировано</div>'
        : '<button class="buyBtn" data-type="board" data-id="' + pv.id + '">' + (isOwned ? 'Выбрать' : '🪙 ' + b.price) + '</button>';
    } else if(pv.type === 'background') {
      const bg = BACKGROUNDS[pv.id];
      if(!bg) { panel.style.display = 'none'; return; }
      const isActive = (cfg.bg || 'classic') === pv.id;
      const isOwned = owned.includes('bg_' + pv.id);
      const priceLbl = bg.gem ? '💎 ' + bg.gemPrice : '🪙 ' + bg.price;
      visual = '<div class="spBg' + (bg.style ? '' : ' spBgDefault') + '"' +
        (bg.style ? ' style="background:' + bg.style + '"' : '') + '>' +
        '<div class="spBgMock"><i></i><i></i><i></i><span>♔ ♕ ♖</span></div></div>';
      title = bg.name;
      sub = 'Фон интерфейса · ' + (isActive ? 'экипирован' : isOwned ? 'куплен' : priceLbl);
      action = isActive
        ? '<div class="spStatus on">✓ Экипировано</div>'
        : '<button class="buyBtn" data-type="background" data-id="' + pv.id + '">' + (isOwned ? 'Выбрать' : priceLbl) + '</button>';
    }

    panel.innerHTML = '<div class="spHead"><span class="spName">' + title + '</span></div>' +
      visual +
      '<div class="spSub">' + sub + '</div>' +
      '<div class="spAction">' + action + '</div>';
    panel.style.display = '';
    const ab = panel.querySelector('.buyBtn');
    if(ab) ab.onclick = () => { snd.ui(); Store.onAction(ab.dataset.type, ab.dataset.id); };
  },

  _glyph(skinId, color, type) {
    const s = SKINS[skinId];
    if(s && s.glyph && s.glyph[color] && s.glyph[color][type]) return s.glyph[color][type];
    if(typeof GLYPH !== 'undefined' && GLYPH[color] && GLYPH[color][type]) return GLYPH[color][type];
    return '?';
  },

  _spBoard(o) {
    const light = o.light || '#f0d9b5', dark = o.dark || '#b58863';
    const order = ['r','n','b','q','k','b','n','r'];
    let cells = '';
    for(let r = 0; r < 8; r++) {
      for(let c = 0; c < 8; c++) {
        let inner = '';
        if(o.pieces) {
          if(r === 0 || r === 7) {
            const color = r === 0 ? 'b' : 'w';
            inner = '<span class="piece ' + color + '">' + Store._glyph(o.skinId, color, order[c]) + '</span>';
          } else if(r === 1 || r === 6) {
            const color = r === 1 ? 'b' : 'w';
            inner = '<span class="piece ' + color + '">' + Store._glyph(o.skinId, color, 'p') + '</span>';
          }
        }
        cells += '<div class="spSq' + ((r + c) % 2 ? ' d' : ' l') + '">' + inner + '</div>';
      }
    }
    return '<div class="spBoard' + (o.skinCss ? ' ' + o.skinCss : '') +
      '" style="--spL:' + light + ';--spD:' + dark + '">' + cells + '</div>';
  },

  /* --- Превью видео-мема (открыть крупно со звуком) --- */
  videoOverlay: null,
  videoOrigin: null,

  openVideoPreview(card, video) {
    if(Store.videoOverlay) Store.closeVideoPreview();
    Store.videoOrigin = card;

    const dim = document.createElement('div');
    dim.className = 'vidExpandedDim';

    const wrap = document.createElement('div');
    wrap.className = 'vidExpandedWrap';
    wrap.appendChild(video);
    dim.appendChild(wrap);

    document.body.appendChild(dim);
    Store.videoOverlay = dim;
    video.muted = false;
    video.play().catch(() => {});

    wrap.addEventListener('click', e => {
      e.stopPropagation();
      if(video.paused) {
        video.play().catch(() => {});
        wrap.classList.remove('paused');
      } else {
        video.pause();
        wrap.classList.add('paused');
      }
    });

    dim.addEventListener('click', e => {
      if(e.target === dim) Store.closeVideoPreview();
    });
  },

  closeVideoPreview() {
    const dim = Store.videoOverlay;
    if(!dim) return;
    const video = dim.querySelector('video');
    if(video) {
      video.pause();
      video.muted = true;
      video.currentTime = 0;
      if(Store.videoOrigin && document.contains(Store.videoOrigin)) {
        const prev = Store.videoOrigin.querySelector('.vidPrev');
        if(prev) prev.appendChild(video);
      }
    }
    dim.remove();
    Store.videoOverlay = null;
    Store.videoOrigin = null;
  },

  /* --- Проверка достижений --- */
  checkAchievements() {
    const profile = Store.getCurrentProfile();
    if(!profile) return;
    
    ACHS.forEach(ach => {
      if(!profile.ach[ach.id] && ach.chk(profile)) {
        profile.ach[ach.id] = Date.now();
        const msg = '🏆 "' + ach.name + '" · +' + ach.coins + ' 🪙' + (ach.gems ? ' +' + ach.gems + ' 💎' : '');
        setTimeout(() => {
          toast(msg);
          if(ach.coins) {
            Store.addCoins(ach.coins);
            if(typeof ChesAuth !== 'undefined' && ChesAuth.user) ChesAuth.awardCoins('achievement', ach.coins);
          }
          if(ach.gems) {
            profile.gems = (profile.gems || 0) + ach.gems;
            if(typeof ChesAuth !== 'undefined' && ChesAuth.user && ChesAuth.awardGems) ChesAuth.awardGems('achievement', ach.gems);
          }
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
    
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    if(isGuest) return false;
    
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
  if (!cfg.bg || !BACKGROUNDS[cfg.bg]) {
    cfg.bg = 'classic';
  }
  if (profile && !profile.owned.includes('bg_' + cfg.bg)) {
    cfg.bg = 'classic';
  }
}

/* --- Применение фона интерфейса --- */
function applyBackground() {
  if(typeof document === 'undefined' || !document.body) return;
  const id = (typeof cfg !== 'undefined' && cfg.bg) ? cfg.bg : 'classic';
  const bg = BACKGROUNDS[id];
  const custom = bg && bg.style ? bg.style : '';
  const root = document.documentElement;
  if(custom) root.style.setProperty('--bgx', custom);
  document.body.classList.toggle('bg-custom', !!custom);
  document.querySelectorAll('.screen').forEach(el => el.classList.toggle('bg-custom', !!custom));
}
if(typeof window !== 'undefined') window.applyBackground = applyBackground;

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
    if(!profile.owned.includes('bg_classic')) profile.owned.push('bg_classic');
    saveProfiles();
  }
  applyBackground();
  renderShopStates();
}

// Инициализация перенесена в main.js
// (document.addEventListener('DOMContentLoaded', initStore) — удалено, чтобы избежать конфликта)

/* --- Применение премиум-косметики профиля --- */
function applyCosmetics() {
  const cu = ProfilesManager.getCurrent();
  const root = document.documentElement;
  const nc = NICK_COLORS.find(x => x.id === (cu && cu.nickColor));
  if(nc && nc.color) root.style.setProperty('--nick-cos', nc.color);
  else root.style.removeProperty('--nick-cos');
  const fr = PROFILE_FRAMES.find(x => x.id === (cu && cu.profileFrame));
  document.body.dataset.frame = (fr && fr.id) || '';
  applyBackground();
}
window.applyCosmetics = applyCosmetics;

/* --- Эффект победы на оверлее конца партии --- */
function applyWinFx() {
  const cu = ProfilesManager.getCurrent();
  const fx = cu && cu.winFx;
  if(!fx) return;
  const modal = document.querySelector('#ovOver .modal');
  if(!modal) return;
  if(fx === 'fx_confetti') {
    const colors = ['#f7c531', '#f0a830', '#67c26b', '#b48ee8', '#e86a5a'];
    for(let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.className = 'confetti';
      s.style.left = Math.round(Math.random() * 100) + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      s.style.animationDuration = (1.2 + Math.random() * 0.9).toFixed(2) + 's';
      modal.appendChild(s);
    }
    setTimeout(() => modal.querySelectorAll('.confetti').forEach(el => el.remove()), 2600);
  } else if(fx === 'fx_rays') {
    modal.classList.remove('fxRays');
    void modal.offsetWidth; // рестарт анимации
    modal.classList.add('fxRays');
    setTimeout(() => modal.classList.remove('fxRays'), 2200);
  }
}
window.applyWinFx = applyWinFx;

if(typeof window !== 'undefined') {
  window.SKINS = SKINS;
  window.BACKGROUNDS = BACKGROUNDS;
  window.ACHS = ACHS;
  window.Store = Store;
  window.normalizeSkin = normalizeSkin;
}