/**
 * ЧЕШЕР — Настройки игры (v0.18.2)
 * Управление настройками: режим, время, цвет, соперник, звук, тема, скин
 */
"use strict";

/* --- Объект настроек --- */
const cfg = {
  timeSec: 0,
  bot: 'medium',
  variant: 'classic',
  human: 'w',
  sound: true,
  soundVol: 70,
  theme: 'classic',
  memes: false,
  modeId: null,
  skin: 'classic',
  board: 'classic',
  shopTab: 'skins',
  gameMode: 'classic' // classic | bot | fischer | meme | local | ranked | multiplayer
};

/* --- Режимы игры --- */
const MODES = [
  {id: 'classic', icon: '♟', name: 'Классика', desc: 'Стандартные шахматы против бота'},
  {id: 'ranked', icon: '🏆', name: 'Рейтинговая', desc: 'Игра за ELO рейтинг'},
  {id: 'multiplayer', icon: '🌐', name: 'По сети', desc: 'Игра с другом онлайн'},
  {id: 'meme', icon: '🔫', name: 'Мемасия', desc: 'Шахматы, но есть нюансы...'},
  {id: 'bot', icon: '🤖', name: 'Против бота', desc: 'Игра против ИИ'},
  {id: 'local', icon: '👥', name: 'На одном ПК', desc: 'Два игрока за одним компьютером'},
  {id: 'fischer', icon: '🎲', name: 'Фишер 960', desc: 'Случайная расстановка фигур'},
  {id: 'tournament', icon: '🏅', name: 'Турнир', desc: 'Скоро...', soon: true}
];

/* --- Звук через Web Audio API --- */
const snd = (() => {
  let ctx = null;
  function getCtx() {
    if(!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return ctx;
  }
  function play(freq, dur, type, vol) {
    if(!cfg.sound) return;
    const c = getCtx();
    if(!c) return;
    if(c.state === 'suspended') c.resume();
    const osc = c.createOscillator();
    const gain = c.createGain();
    const v = (vol || 0.15) * ((cfg.soundVol || 70) / 100);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(v, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }
  const MOVE_SOUND = 'sounds/move_of_a_piece.mp3';
  return {
    ui()    { play(800, 0.08, 'sine', 0.1); },
    move()  {
      if(!cfg.sound) return;
      try {
        var a = new Audio(MOVE_SOUND);
        a.volume = (cfg.soundVol || 70) / 100;
        a.play();
      } catch(e) {}
    },
    capture(){ play(600, 0.15, 'square', 0.08); },
    check() { play(880, 0.2, 'sawtooth', 0.1); },
    win()   { play(523, 0.15, 'sine', 0.15); setTimeout(() => play(659, 0.15, 'sine', 0.15), 150); setTimeout(() => play(784, 0.3, 'sine', 0.15), 300); },
    lose()  { play(400, 0.3, 'sawtooth', 0.1); setTimeout(() => play(300, 0.4, 'sawtooth', 0.1), 200); },
    draw()  { play(440, 0.2, 'triangle', 0.1); setTimeout(() => play(440, 0.2, 'triangle', 0.1), 250); },
    promo() { play(660, 0.1, 'sine', 0.12); setTimeout(() => play(880, 0.2, 'sine', 0.12), 100); }
  };
})();

/* --- Построение сегмента переключателя --- */
function buildSeg(boxId, items, getVal, onPick) {
  const box = document.getElementById(boxId);
  if(!box) return function() {};
  
  box.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'segBtn';
    b.type = 'button';
    b.innerHTML = it.label + (it.sub ? '<small>' + it.sub + '</small>' : '');
    b.dataset.v = String(it.v);
    b.addEventListener('click', () => {
      snd.ui();
      onPick(it.v);
      paintSeg();
    });
    box.appendChild(b);
  });
  function paintSeg() {
    [...box.children].forEach(b =>
      b.classList.toggle('sel', b.dataset.v === String(getVal()))
    );
  }
  paintSeg();
  return paintSeg;
}

/* --- Секция варианта игры --- */
function buildVariantSeg() {
  return buildSeg('segVariant', [
    {v: 'classic', label: '♟ Классика', sub: 'стандарт'},
    {v: 'fischer', label: '🎲 Фишер', sub: '960'}
  ], () => cfg.variant, v => { cfg.variant = v; markDirty(); });
}

/* --- Секция времени --- */
function buildTimeSeg() {
  return buildSeg('segTime', [
    {v: 120, label: '⚡ Пуля', sub: '2 мин'},
    {v: 300, label: '🔥 Блиц', sub: '5 мин'},
    {v: 600, label: '🎯 Рапид', sub: '10 мин'},
    {v: 1800, label: '♔ Классика', sub: '30 мин'},
    {v: 0, label: '∞ Без.limit', sub: 'без часов'}
  ], () => cfg.timeSec, v => { cfg.timeSec = v; markDirty(); });
}

/* --- Секция вашего цвета --- */
function buildSideSeg() {
  return buildSeg('segSide', [
    {v: 'w', label: '⚪ Белые', sub: 'ход первыми'},
    {v: 'b', label: '⚫ Чёрные', sub: 'ответный ход'},
    {v: 'random', label: '🎲 Случайно', sub: 'undi'}
  ], () => cfg.human, v => { cfg.human = v; markDirty(); });
}

/* --- Секция звука (ползунки) --- */
function buildSndSliders() {
  const box = document.getElementById('sndSliders');
  if(!box) return function() {};
  box.innerHTML = '';

  function addSlider(label, key, getVal, setVal) {
    const row = document.createElement('div');
    row.className = 'sndSliderRow';
    const lbl = document.createElement('span');
    lbl.className = 'sndSliderLabel';
    lbl.textContent = label;
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '100';
    range.value = String(getVal());
    range.className = 'sndRange';
    const val = document.createElement('span');
    val.className = 'sndSliderVal';
    val.textContent = getVal() + '%';
    range.addEventListener('input', () => {
      const v = parseInt(range.value);
      val.textContent = v + '%';
      setVal(v);
      saveCfg();
    });
    row.appendChild(lbl);
    row.appendChild(range);
    row.appendChild(val);
    box.appendChild(row);
  }

  function addToggle(label, key) {
    const row = document.createElement('div');
    row.className = 'sndSliderRow';
    const lbl = document.createElement('span');
    lbl.className = 'sndSliderLabel';
    lbl.textContent = label;
    const sw = document.createElement('label');
    sw.className = 'toggle';
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = cfg[key];
    const sl = document.createElement('span');
    sl.className = 'toggleSlider';
    sw.appendChild(inp);
    sw.appendChild(sl);
    inp.addEventListener('change', () => { cfg[key] = inp.checked; saveCfg(); });
    row.appendChild(lbl);
    row.appendChild(sw);
    box.appendChild(row);
  }

  addToggle('Звуки', 'sound');
  addSlider('Громкость ходов', 'soundVol', () => cfg.soundVol || 70, v => { cfg.soundVol = v; });
  addSlider('Громкость мемов', 'memeVol', () => Math.round((MemeConfig.get('volume') || 0.7) * 100), v => { MemeConfig.set('volume', v / 100); });

  return function() {};
}

/* --- Секция настроек Мемасии --- */
function buildMemeSegInner(box, group) {
  box.innerHTML = '';

  function addToggle(label, key) {
    var row = document.createElement('div');
    row.className = 'toggleRow';
    var lbl = document.createElement('span');
    lbl.className = 'toggleLabel';
    lbl.textContent = label;
    var sw = document.createElement('label');
    sw.className = 'toggle';
    var inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = MemeConfig.get(key);
    inp.addEventListener('change', function() {
      MemeConfig.set(key, inp.checked);
    });
    var sl = document.createElement('span');
    sl.className = 'toggleSlider';
    sw.appendChild(inp);
    sw.appendChild(sl);
    row.appendChild(lbl);
    row.appendChild(sw);
    box.appendChild(row);
  }

  addToggle('Режим включён', 'enabled');
  addToggle('Реакции (эмодзи)', 'reactions');
  addToggle('Угрозы (пистолеты)', 'threats');
  addToggle('Видео', 'videos');
  addToggle('Звуки', 'sounds');

  var volRow = document.createElement('div');
  volRow.className = 'toggleRow';
  var volLbl = document.createElement('span');
  volLbl.className = 'toggleLabel';
  volLbl.textContent = 'Громкость';
  var volVal = document.createElement('span');
  volVal.style.cssText = 'font-size:13px;color:var(--mut);min-width:32px;text-align:right';
  volVal.textContent = Math.round((MemeConfig.get('volume') || 0.7) * 100) + '%';
  volRow.appendChild(volLbl);
  volRow.appendChild(volVal);
  box.appendChild(volRow);

  var slider = document.createElement('div');
  slider.className = 'memeSlider';
  var range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.value = String(Math.round((MemeConfig.get('volume') || 0.7) * 100));
  range.addEventListener('input', function() {
    var v = parseInt(range.value) / 100;
    MemeConfig.set('volume', v);
    volVal.textContent = Math.round(v * 100) + '%';
  });
  slider.appendChild(range);
  box.appendChild(slider);

  var videoTitle = document.createElement('div');
  videoTitle.className = 'memeSectionTitle';
  videoTitle.textContent = 'Видео по событиям (можно выбрать несколько)';
  box.appendChild(videoTitle);

  var advRow = document.createElement('div');
  advRow.className = 'memeAdvRow';
  var advLabel = document.createElement('label');
  advLabel.className = 'memeAdvLabel';
  advLabel.textContent = 'Продвинутый режим: видео по фигурам';
  var advToggle = document.createElement('input');
  advToggle.type = 'checkbox';
  advToggle.checked = !!MemeConfig.get('advancedPerPiece');
  advToggle.addEventListener('change', function() {
    MemeConfig.set('advancedPerPiece', advToggle.checked);
    renderCards();
    renderDetail();
  });
  advLabel.prepend(advToggle);
  advRow.appendChild(advLabel);
  box.appendChild(advRow);

  var evTypes = typeof MEME_EVENT_TYPES !== 'undefined' ? MEME_EVENT_TYPES : ['check','capture','threat'];
  var evNames = typeof MEME_EVENT_NAMES !== 'undefined' ? MEME_EVENT_NAMES : {check:'Шах',capture:'Взятие',threat:'Угроза'};
  var evIcons = {check:'♔',capture:'⚔',threat:'👁',defense:'🛡',promotion:'👑',sacrifice:'💀',blunder:'😱',brilliant:'✨'};

  var colorTabs = document.createElement('div');
  colorTabs.className = 'memeColorTabs';
  var activeColor = 'w';
  var tabW = document.createElement('button');
  tabW.className = 'memeColorTab sel';
  tabW.textContent = '⚪ Белые';
  var tabB = document.createElement('button');
  tabB.className = 'memeColorTab';
  tabB.textContent = '⚫ Чёрные';
  colorTabs.appendChild(tabW);
  colorTabs.appendChild(tabB);
  box.appendChild(colorTabs);

  var pieceGrid = document.createElement('div');
  pieceGrid.className = 'memePieceGrid memePieceGrid--events';
  box.appendChild(pieceGrid);

  var detailBox = document.createElement('div');
  detailBox.className = 'memeDetailBox';
  box.appendChild(detailBox);

  var previewEl = document.createElement('div');
  previewEl.className = 'memeVidPreview';
  previewEl.style.display = 'none';
  box.appendChild(previewEl);

  var activeEvent = null;

  function getVideoName(file) {
    if(!file) return null;
    if(typeof AVAILABLE_VIDEOS !== 'undefined') {
      var found = AVAILABLE_VIDEOS.find(function(v) { return v.file === file; });
      if(found) return found.name;
    }
    return file.split('/').pop();
  }

  function renderCards() {
    pieceGrid.innerHTML = '';
    var presets = MemeConfig.get('videoPresets') || {};
    evTypes.forEach(function(k) {
      var card = document.createElement('div');
      card.className = 'memePieceCard' + (activeEvent === k ? ' active' : '');
      var icon = document.createElement('div');
      icon.className = 'mpIcon';
      icon.textContent = evIcons[k] || '?';
      var name = document.createElement('div');
      name.className = 'mpName';
      name.textContent = evNames[k] || k;
      var vidLabel = document.createElement('div');
      var arr = presets[k] ? (presets[k][activeColor] || []) : [];
      var cnt = Array.isArray(arr) ? arr.length : 0;
      vidLabel.className = 'mpVideo' + (cnt ? '' : ' none');
      vidLabel.textContent = cnt ? cnt + ' видео' : 'не назначено';
      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(vidLabel);
      card.addEventListener('click', function() {
        activeEvent = (activeEvent === k) ? null : k;
        renderCards();
        renderDetail();
      });
      pieceGrid.appendChild(card);
    });
  }

  var activePiece = null;

  function renderVideoList(targetBox, arr, eventType, color, pieceLabel) {
    if(arr.length) {
      var selTitle = document.createElement('div');
      selTitle.className = 'memeDetailLabel';
      selTitle.textContent = (pieceLabel ? pieceLabel + ': ' : '') + 'Выбрано (' + arr.length + '):';
      targetBox.appendChild(selTitle);

      var chips = document.createElement('div');
      chips.className = 'memeChips';
      arr.forEach(function(file, idx) {
        var chip = document.createElement('div');
        chip.className = 'memeChip';
        chip.textContent = getVideoName(file) || file;
        var prevTmr = null;
        chip.addEventListener('mouseenter', function() {
          prevTmr = setTimeout(function() { showPreview(file); }, 400);
        });
        chip.addEventListener('mouseleave', function() {
          clearTimeout(prevTmr);
          hidePreview();
        });
        var rm = document.createElement('span');
        rm.className = 'memeChipRm';
        rm.textContent = '\u00d7';
        rm.addEventListener('click', function(e) {
          e.stopPropagation();
          var p = MemeConfig.get('videoPresets') || {};
          if(pieceLabel) {
            var pt = pieceLabel.toLowerCase().charAt(0);
            if(p[eventType] && p[eventType][pt] && p[eventType][pt][color]) {
              p[eventType][pt][color].splice(idx, 1);
            }
          } else {
            if(p[eventType] && p[eventType][color]) {
              p[eventType][color].splice(idx, 1);
            }
          }
          MemeConfig.set('videoPresets', p);
          renderDetail();
          renderCards();
        });
        chip.appendChild(rm);
        chips.appendChild(chip);
      });
      targetBox.appendChild(chips);
    }

    var availTitle = document.createElement('div');
    availTitle.className = 'memeDetailLabel';
    availTitle.textContent = 'Добавить видео:';
    targetBox.appendChild(availTitle);

    var availList = document.createElement('div');
    availList.className = 'memeAvailList';
    if(typeof AVAILABLE_VIDEOS !== 'undefined') {
      AVAILABLE_VIDEOS.forEach(function(vid) {
        var already = arr.indexOf(vid.file) >= 0;
        var item = document.createElement('div');
        item.className = 'memeAvailItem' + (already ? ' used' : '');
        var nm = document.createElement('span');
        nm.textContent = vid.name;
        item.appendChild(nm);
        if(already) {
          var badge = document.createElement('span');
          badge.className = 'memeAvailBadge';
          badge.textContent = '\u2713';
          item.appendChild(badge);
        }
        var prevTmr = null;
        item.addEventListener('mouseenter', function() {
          prevTmr = setTimeout(function() { showPreview(vid.file); }, 400);
        });
        item.addEventListener('mouseleave', function() {
          clearTimeout(prevTmr);
          hidePreview();
        });
        if(!already) {
          item.addEventListener('click', function() {
            var p = MemeConfig.get('videoPresets') || {};
            if(pieceLabel) {
              var pt = pieceLabel.toLowerCase().charAt(0);
              if(!p[eventType]) p[eventType] = {};
              if(!p[eventType][pt]) p[eventType][pt] = {w:[],b:[]};
              if(!p[eventType][pt][color]) p[eventType][pt][color] = [];
              p[eventType][pt][color].push(vid.file);
            } else {
              if(!p[eventType]) p[eventType] = {w:[],b:[]};
              if(!p[eventType][color]) p[eventType][color] = [];
              p[eventType][color].push(vid.file);
            }
            MemeConfig.set('videoPresets', p);
            renderDetail();
            renderCards();
          });
        }
        availList.appendChild(item);
      });
    }
    targetBox.appendChild(availList);
  }

  function renderDetail() {
    detailBox.innerHTML = '';
    if(!activeEvent) return;
    var presets = MemeConfig.get('videoPresets') || {};
    var isAdv = MemeConfig.get('advancedPerPiece');

    var head = document.createElement('div');
    head.className = 'memeDetailHead';
    head.textContent = (evIcons[activeEvent]||'') + ' ' + (evNames[activeEvent]||activeEvent) + ' — ' + (activeColor === 'w' ? 'Белые' : 'Чёрные');
    detailBox.appendChild(head);

    if(isAdv) {
      PIECE_KEYS.forEach(function(pk) {
        var pieceSection = document.createElement('div');
        pieceSection.className = 'memePieceSection';
        var pieceHead = document.createElement('div');
        pieceHead.className = 'memePieceSectionHead';
        pieceHead.textContent = PIECE_ICONS[pk] + ' ' + PIECE_NAMES[pk];
        pieceSection.appendChild(pieceHead);
        var pArr = (presets[activeEvent] && presets[activeEvent][pk] && presets[activeEvent][pk][activeColor]) || [];
        renderVideoList(pieceSection, pArr, activeEvent, activeColor, PIECE_NAMES[pk]);
        detailBox.appendChild(pieceSection);
      });
    } else {
      var arr = (presets[activeEvent] && presets[activeEvent][activeColor]) || [];
      renderVideoList(detailBox, arr, activeEvent, activeColor, null);
    }
  }

  var previewVid = null;
  function showPreview(file) {
    if(!file) return;
    previewEl.innerHTML = '';
    previewEl.style.display = '';
    var v = document.createElement('video');
    v.src = file;
    v.autoplay = true;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.className = 'memeVidPreviewVideo';
    previewEl.appendChild(v);
    previewVid = v;
    v.play().catch(function(){});
  }
  function hidePreview() {
    if(previewVid) { previewVid.pause(); previewVid.src = ''; previewVid = null; }
    previewEl.style.display = 'none';
    previewEl.innerHTML = '';
  }

  tabW.addEventListener('click', function() {
    activeColor = 'w';
    tabW.classList.add('sel');
    tabB.classList.remove('sel');
    renderDetail();
    renderCards();
  });
  tabB.addEventListener('click', function() {
    activeColor = 'b';
    tabB.classList.add('sel');
    tabW.classList.remove('sel');
    renderDetail();
    renderCards();
  });

  renderCards();

  var btnsRow = document.createElement('div');
  btnsRow.className = 'memeBtnsRow';
  box.appendChild(btnsRow);

  var resetBtn = document.createElement('button');
  resetBtn.className = 'mBtn';
  resetBtn.textContent = '↺ Сбросить все видео';
  resetBtn.addEventListener('click', function() {
    if(!confirm('Сбросить все назначенные видео?')) return;
    MemeConfig.resetVideoPresets();
    renderCards();
    renderDetail();
    toast('Видео сброшены');
  });
  btnsRow.appendChild(resetBtn);

  var saveBtn = document.createElement('button');
  saveBtn.className = 'mBtn primary';
  saveBtn.textContent = '💾 Сохранить';
  saveBtn.addEventListener('click', function() {
    toast('Настройки сохранены');
  });
  btnsRow.appendChild(saveBtn);

  var presetsTitle = document.createElement('div');
  presetsTitle.className = 'memeSectionTitle';
  presetsTitle.textContent = 'Пресеты (макс. ' + (MemeConfig.MAX_PRESETS || 3) + ')';
  box.appendChild(presetsTitle);

  var presetsBox = document.createElement('div');
  presetsBox.className = 'memePresets';
  box.appendChild(presetsBox);

  var presetInput = document.createElement('div');
  presetInput.className = 'memePresetInput';
  var presetNameInp = document.createElement('input');
  presetNameInp.type = 'text';
  presetNameInp.placeholder = 'Название пресета...';
  presetNameInp.maxLength = 20;
  var presetSaveBtn = document.createElement('button');
  presetSaveBtn.className = 'mBtn';
  presetSaveBtn.style.padding = '6px 12px';
  presetSaveBtn.style.fontSize = '12px';
  presetSaveBtn.style.whiteSpace = 'nowrap';
  presetSaveBtn.textContent = '💾 Как пресет';
  presetSaveBtn.addEventListener('click', function() {
    var name = presetNameInp.value.trim();
    if(!name) { toast('Введите название'); return; }
    MemeConfig.savePreset(name, MemeConfig.get('videoPresets'));
    presetNameInp.value = '';
    renderPresets();
    toast('Пресет «' + name + '» сохранён');
  });
  presetInput.appendChild(presetNameInp);
  presetInput.appendChild(presetSaveBtn);
  box.appendChild(presetInput);

  function renderPresets() {
    presetsBox.innerHTML = '';
    var slots = MemeConfig.getPresetSlots();
    if(!slots.length) {
      var empty = document.createElement('div');
      empty.className = 'memePresetEmpty';
      empty.textContent = 'Нет сохранённых пресетов';
      presetsBox.appendChild(empty);
      return;
    }
    slots.forEach(function(p) {
      var row = document.createElement('div');
      row.className = 'memePresetRow';
      var nm = document.createElement('span');
      nm.className = 'memePresetName';
      nm.textContent = p.name;
      var loadB = document.createElement('button');
      loadB.className = 'mBtn small';
      loadB.textContent = '▶ Применить';
      loadB.addEventListener('click', function() {
        MemeConfig.loadPreset(p.name);
        renderCards();
        renderDetail();
        toast('Пресет «' + p.name + '» применён');
      });
      var delB = document.createElement('button');
      delB.className = 'mBtn small danger';
      delB.textContent = '✕';
      delB.addEventListener('click', function() {
        MemeConfig.deletePreset(p.name);
        renderPresets();
        toast('Пресет удалён');
      });
      row.appendChild(nm);
      row.appendChild(loadB);
      row.appendChild(delB);
      presetsBox.appendChild(row);
    });
  }

  renderPresets();
}

function buildMemeSeg() {
  var box = document.getElementById('memeOpts');
  var group = document.getElementById('memeCfgGroup');
  if(!box || !group) return function() {};

  var isMeme = cfg.gameMode === 'meme' || cfg.modeId === 'meme';
  if(!isMeme) {
    group.style.display = 'none';
    return function() {};
  }
  group.style.display = '';
  buildMemeSegInner(box, group);

  return function() {
    var isMeme = cfg.gameMode === 'meme' || cfg.modeId === 'meme';
    if(!isMeme) {
      group.style.display = 'none';
    } else {
      group.style.display = '';
    }
  };
}

function buildMemeModesSeg() {
  var box = document.getElementById('memeModesOpts');
  var group = document.getElementById('memeModesGroup');
  if(!box || !group) return;
  group.style.display = '';
  buildMemeSegInner(box, group);
}

/* --- Информация о текущем боте --- */
function buildBotInfo() {
  const el = document.getElementById('setBotInfo');
  if(!el) return;
  
  const cu = ProfilesManager.getCurrent();
  const botId = cu ? (cu.botId || 1) : 1;
  const bot = BOT_LIST.find(b => b.id === botId);
  
  if(cfg.bot === 'off') {
    el.innerHTML = '<div class="setBotRow">' +
      '<span class="setBotEmoji">👥</span>' +
      '<div class="setBotText"><b>Игра на двоих</b><br><small>Без компьютерного соперника</small></div>' +
    '</div>';
  } else if(bot) {
    const leagueColors = {'Начинающие':'#4caf50','Любители':'#2196f3','Опытные':'#ff9800','Мастера':'#f44336'};
    const lColor = leagueColors[bot.league] || '#888';
    el.innerHTML = '<div class="setBotRow">' +
      '<span class="setBotEmoji">' + bot.emoji + '</span>' +
      '<div class="setBotText"><b>' + bot.name + '</b><br>' +
      '<small style="color:' + lColor + '">' + bot.league + ' · ' + bot.rating + ' Эло</small></div>' +
    '</div>';
  } else {
    el.innerHTML = '<div class="setBotRow">' +
      '<span class="setBotEmoji">🤖</span>' +
      '<div class="setBotText"><b>Бот</b><br><small>Выберите соперника</small></div>' +
    '</div>';
  }
}

/* --- Секция скина фигур --- */
function buildSkinSeg() {
  if(typeof SKINS === 'undefined') return function() {};
  const items = Object.keys(SKINS).map(id => ({v: id, label: SKINS[id].name, sub: ''}));
  return buildSeg('segSkin', items, () => cfg.skin, v => {
    cfg.skin = v;
    saveCfg();
  });
}

/* --- Секция темы доски --- */
function buildThemeSeg() {
  const box = document.getElementById('themeRow');
  if(!box) return function() {};
  
  box.innerHTML = '';
  const THEMES = [
    {id: 'classic', name: 'Классика', l: '#f0d9b5', d: '#b58863'},
    {id: 'green', name: 'Зелёная', l: '#eeeed2', d: '#769656'},
    {id: 'blue', name: 'Синяя', l: '#dee3e6', d: '#8ca2ad'},
    {id: 'night', name: 'Ночь', l: '#a8a49c', d: '#55514b'},
    {id: 'rajasthani', name: 'Раджастхан', l: '#f5e6c8', d: '#8b4513'}
  ];
  
  THEMES.forEach(t => {
    const w = document.createElement('button');
    w.className = 'swatch';
    w.type = 'button';
    w.dataset.v = t.id;
    w.style.setProperty('--swL', t.l);
    w.style.setProperty('--swD', t.d);
    w.innerHTML = '<i></i><i></i><i></i><i></i><span class="swName">' + t.name + '</span>';
    w.addEventListener('click', () => {
      cfg.theme = t.id;
      saveCfg();
      syncThemeUI();
      snd.ui();
    });
    box.appendChild(w);
  });
  syncThemeUI();
}

/* --- Синхронизация темы --- */
function syncThemeUI() {
  document.body.dataset.theme = cfg.theme;
  [...document.querySelectorAll('.swatch')].forEach(sw =>
    sw.classList.toggle('sel', sw.dataset.v === cfg.theme)
  );
}

/* --- Обновление сегментов --- */
let repaintSkin, repaintMeme;
let dirty = false;

function markDirty() {
  dirty = true;
  document.getElementById('setApply').textContent = 'Применить и начать заново';
}

function repaintAllSegs() {
  try {
    if(repaintSkin) repaintSkin();
    if(repaintMeme) repaintMeme();
    buildBotInfo();
    buildSndSliders();
  } catch(e) {}
  syncThemeUI();
}

/* --- Построение всего экрана настроек --- */
function buildSettings() {
  buildBotInfo();
  buildSndSliders();
  buildThemeSeg();
  repaintSkin = buildSkinSeg();
  repaintMeme = buildMemeSeg();
  
  // Кнопка выбора бота
  const btnBot = document.getElementById('btnChangeBot');
  if(btnBot) {
    btnBot.onclick = () => {
      const cu = ProfilesManager.getCurrent();
      const elo = cu ? (cu.elo || 0) : 0;
      showScreen('scrBots');
      try { renderBotsScreen(elo); } catch(e) {}
    };
  }
}

/* --- Сохранение конфига --- */
function saveCfg() {
  try {
    localStorage.setItem('chesher_cfg', JSON.stringify({
      timeSec: cfg.timeSec,
      bot: cfg.bot,
      variant: cfg.variant,
      human: cfg.human,
      sound: cfg.sound,
      soundVol: cfg.soundVol,
      theme: cfg.theme,
      memes: cfg.memes,
      modeId: cfg.modeId,
      skin: cfg.skin,
      board: cfg.board,
      shopTab: cfg.shopTab,
      gameMode: cfg.gameMode
    }));
  } catch(e) {}
}

/* --- Загрузка конфига --- */
function loadCfg() {
  try {
    const raw = localStorage.getItem('chesher_cfg');
    if(raw) Object.assign(cfg, JSON.parse(raw));
  } catch(e) {}
}

/* --- Сброс всех данных --- */
function resetAllData() {
  if(confirm('Сбросить ВСЁ данные?\n- Профили\n- Статистику\n- Монеты\n- Настройки\n- Сохраненные игры')) {
    localStorage.removeItem('chesher_profiles');
    localStorage.removeItem('chesher_cfg');
    localStorage.removeItem('chesher_save');
    localStorage.removeItem('chesher_guest_id');
    if(ChesAuth && typeof ChesAuth.logout === 'function') {
      ChesAuth.logout().then(() => location.reload());
    } else {
      location.reload();
    }
  }
}

/* --- Автозагрузка --- */
loadCfg();

if(typeof window !== 'undefined') {
  window.cfg = cfg;
  window.Settings = {buildSettings, saveCfg, loadCfg, resetAllData, syncThemeUI};
  window.MODES = MODES;
  window.snd = snd;
}
