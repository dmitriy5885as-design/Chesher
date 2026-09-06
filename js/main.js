/**
 * ЧЕШЕР — Главный файл инициализации
 */
"use strict";

/* --- Глобальное состояние игры --- */
let S = null;
let lastMove = null;
let selected = null;    // {r, c}
let legalCache = [];    // legal moves for selected piece
let hintMove = null;
let pendingPromo = null;
let takenByW = [];
let takenByB = [];
let moveQueue = [];
let clockInterval = null;
let isBotThinking = false;

/* --- Получение глифа фигуры (deprecated, use getSkinGlyph) --- */
function G(color, type) {
  return getSkinGlyph(color, type);
}

/* --- Показать экран --- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  const el = document.getElementById(id);
  if(el) el.classList.add('show');

  // Devblog button only on main menu
  const cornerFloat = document.getElementById('cornerFloat');
  if(cornerFloat) cornerFloat.style.display = id === 'scrMenu' ? '' : 'none';
  const helpBtn = document.getElementById('helpBtn');
  if(helpBtn) helpBtn.style.display = id === 'scrMenu' ? '' : 'none';
  const giftBtn = document.getElementById('giftBtn');
  if(giftBtn) giftBtn.style.display = id === 'scrMenu' ? '' : 'none';
  const devblogBtnEl = document.getElementById('devblogBtn');
  if(devblogBtnEl) devblogBtnEl.style.display = id === 'scrMenu' ? '' : 'none';
  const friendsBtn = document.getElementById('friendsFloatBtn');
  if(friendsBtn) friendsBtn.style.display = id === 'scrMenu' ? '' : 'none';
  if(id !== 'scrMenu') {
    const fp = document.getElementById('friendsPanel');
    const fc = document.getElementById('friendChatPanel');
    if(fp) fp.classList.remove('open');
    if(fc) fc.classList.remove('open');
  }
  const chBtn = document.getElementById('cheatBtn');
  const chPanel = document.getElementById('cheatPanel');
  if(chBtn && id !== 'scrMenu') chBtn.style.display = 'none';
  if(chPanel) chPanel.classList.remove('show');

  // Refresh screen-specific content
  if(id === 'scrMenu') {
    renderProfBar();
    renderCoins();
    renderStats();
    showRandomTip();
  }
  if(id === 'scrSet') {
    buildSettings();
  }
  if(id === 'scrShop') {
    Store.renderShop();
    renderShopStates();
    renderCoins();
  }
  if(id === 'scrProf') {
    renderProfScr();
  }
  if(id === 'scrPlay') {
    // scrPlay is the game screen — nothing to render here
  }
  if(id === 'scrModes') {
    renderModeList();
  }
}
window.showScreen = showScreen;

/* --- Список режимов --- */
let selectedModeId = null;

function renderModeList() {
  const modesBox = document.getElementById('modesList');
  const modesCfg = document.getElementById('modesCfg');
  
  if(!modesBox) return;
  modesBox.innerHTML = '';
  
  MODES.forEach(m => {
    const d = document.createElement('div');
    d.className = 'modeCard' + (m.id === 'bot' ? ' reco' : '') + (m.soon ? ' soon' : '');
    const tag = m.soon ? '<span class="tag soon">СКОРО</span>' : '';
    d.innerHTML = '<div class="ic">' + m.icon + '</div>' +
      '<div class="tx"><div class="nm">' + m.name + '</div>' +
      '<div class="ds">' + m.desc + '</div></div>' + tag;
    d.addEventListener('click', () => {
      selectedModeId = m.id;
      cfg.modeId = m.id;
      cfg.gameMode = m.id === 'bot' ? 'bot' : m.id === 'fischer' ? 'fischer' : m.id;
      if(m.id === 'bot' || m.id === 'fischer') {
        modesBox.style.display = 'none';
        showBotSelection();
      } else if(m.id === 'multiplayer') {
        modesBox.style.display = 'none';
        showMultiplayerMenu();
      } else {
        modesBox.style.display = 'none';
        if(modesCfg) {
          modesCfg.style.display = '';
          buildModesCfg(m.id);
        }
      }
    });
    modesBox.appendChild(d);
  });
}

/* --- Экран выбора бота --- */
let selectedBotId = null;

function showBotSelection() {
  const cu = ProfilesManager.getCurrent();
  const elo = cu ? (cu.elo || 0) : 0;
  
  showScreen('scrBots');
  try { renderBotsScreen(elo); } catch(e) { console.error('renderBotsScreen error:', e); }
}

function renderBotsScreen(elo) {
  const indicator = document.getElementById('eloIndicator');
  const progressEl = document.getElementById('nextBotProgress');
  const grid = document.getElementById('botsGrid');
  const infoPanel = document.getElementById('botsInfo');
  
  const cu = ProfilesManager.getCurrent();
  const wins = cu ? (cu.winsBot || 0) : 0;
  const league = Elo.getLeague(elo);
  const recommended = Bot.getRecommendedBot();
  const bots = Bot.getBotsWithStatus();
  const nextBot = Bot.getNextBotProgress();
  
  // Indicator — текущий рейтинг
  if(indicator) {
    indicator.innerHTML = '<div class="eloBadge" style="border-color:' + league.color + '">' +
      league.emoji + ' ' + elo + '</div>' +
      '<div class="leagueName" style="color:' + league.color + '">' + league.name + '</div>' +
      '<div class="winsCount">🏆 Побед: ' + wins + '</div>' +
      '<div class="recBot">⭐ Рекомендуемый: ' + recommended.emoji + ' ' + recommended.name + ' (' + recommended.rating + ')</div>';
  }
  
  // Next bot progress — по победам
  if(progressEl) {
    if(nextBot.next) {
      progressEl.innerHTML = '<div class="nextBotLabel">До следующего бота: ' + 
        nextBot.next.emoji + ' ' + nextBot.next.name + ' (' + nextBot.next.rating + ') — ещё ' +
        nextBot.next.winsLeft + ' побед</div>' +
        '<div class="progressTrack"><div class="progressFill" style="width:' + Math.round(nextBot.progress) + '%"></div></div>' +
        '<div class="progressText">' + wins + ' / ' + nextBot.next.winsReq + ' побед</div>';
    } else {
      progressEl.innerHTML = '<div class="allUnlocked">🎉 Все боты открыты!</div>';
    }
  }
  
  // Bot grid — grouped by leagues
  if(grid) {
    grid.innerHTML = '';
    selectedBotId = recommended.id;
    
    const leagues = [
      {name:'Начинающие', color:'#4caf50', emoji:'🟢'},
      {name:'Любители', color:'#2196f3', emoji:'🔵'},
      {name:'Опытные', color:'#ff9800', emoji:'🟡'},
      {name:'Мастера', color:'#f44336', emoji:'🔴'}
    ];
    
    leagues.forEach(league => {
      const leagueBots = bots.filter(b => b.league === league.name);
      if(!leagueBots.length) return;
      
      // League header
      const header = document.createElement('div');
      header.className = 'leagueHeader';
      header.innerHTML = '<span class="leagueDot" style="background:' + league.color + '"></span> ЛИГА «' + league.name.toUpperCase() + '»';
      grid.appendChild(header);
      
      leagueBots.forEach(bot => {
        const card = document.createElement('div');
        card.className = 'botCard' + (bot.isAvailable ? ' available' : ' locked') + 
          (bot.id === recommended.id ? ' recommended' : '') + (bot.id === selectedBotId ? ' selected' : '');
        
        card.innerHTML = '<div class="botEmoji">' + bot.emoji + '</div>' +
          '<div class="botName">' + bot.name + '</div>' +
          '<div class="botRating">' + bot.rating + '</div>' +
          (!bot.isAvailable ? '<div class="lockIcon">🔒</div><div class="lockWins">Ещё ' + bot.winsLeft + ' побед</div>' : '') +
          (bot.id === recommended.id ? '<div class="recBadge">⭐</div>' : '');
        
        if(bot.isAvailable) {
          card.addEventListener('click', () => {
            selectedBotId = bot.id;
            grid.querySelectorAll('.botCard').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            showBotInfo(bot);
          });
        }
        
        grid.appendChild(card);
      });
    });
    
    // Show recommended bot info by default
    showBotInfo(recommended);
  }
}

/* --- Показать информацию о боте --- */
function showBotInfo(bot) {
  const infoPanel = document.getElementById('botsInfo');
  if(!infoPanel) return;
  
  const botLeague = Elo.getLeague(bot.rating);
  const cu = ProfilesManager.getCurrent();
  const bs = cu && cu.botStats ? cu.botStats[String(bot.id)] : null;
  const bsGames = bs ? bs.games : 0;
  const bsWins = bs ? bs.wins : 0;
  const bsLosses = bs ? bs.losses : 0;
  
  const leagueColors = {'Начинающие':'#4caf50','Любители':'#2196f3','Опытные':'#ff9800','Мастера':'#f44336'};
  const leagueEmojis = {'Начинающие':'🟢','Любители':'🔵','Опытные':'🟡','Мастера':'🔴'};
  const lColor = leagueColors[bot.league] || '#888';
  const lEmoji = leagueEmojis[bot.league] || '⚪';
  
  infoPanel.innerHTML = '<div class="botInfoCard">' +
    '<div class="botInfoEmoji">' + bot.emoji + '</div>' +
    '<div class="botInfoName">' + bot.name + '</div>' +
    '<div class="botInfoLeague" style="color:' + lColor + '">' + lEmoji + ' ' + bot.league + '</div>' +
    '<div class="botInfoRating" style="color:' + botLeague.color + '">' + bot.rating + ' · ' + botLeague.name + '</div>' +
    '<div class="botInfoDesc">' + bot.desc + '</div>' +
    (bot.personality ? '<div class="botInfoSection"><div class="botInfoLabel">Характер</div><div class="botInfoValue personality">' + bot.personality + '</div></div>' : '') +
    '<div class="botInfoSection">' +
      '<div class="botInfoLabel strong">Сильные стороны</div>' +
      '<div class="botInfoValue strong">' + bot.strengths + '</div>' +
    '</div>' +
    '<div class="botInfoSection">' +
      '<div class="botInfoLabel weak">Слабые стороны</div>' +
      '<div class="botInfoValue weak">' + bot.weaknesses + '</div>' +
    '</div>' +
    '<div class="botInfoSection">' +
      '<div class="botInfoLabel">Стратегия</div>' +
      '<div class="botInfoValue">' + bot.strategy + ' · глубина ' + bot.depth + '</div>' +
    '</div>' +
    (bsGames > 0 ?
      '<div class="botInfoSection botStatsSection">' +
        '<div class="botInfoLabel">Ваша статистика</div>' +
        '<div class="botStatsRow">' +
          '<span class="bsGames">🎮 ' + bsGames + ' игр</span>' +
          '<span class="bsWins">✅ ' + bsWins + ' побед</span>' +
          '<span class="bsLosses">❌ ' + bsLosses + ' поражений</span>' +
        '</div>' +
      '</div>' : '') +
  '</div>';
}

function buildModesCfg(modeId) {
  const botGroup = document.getElementById('botCfgGroup');
  const botToggleGroup = document.getElementById('botToggleGroup');
  const botToggle = document.getElementById('botToggle');
  const sideGroup = document.getElementById('sideCfgGroup');
  const timeGroup = document.getElementById('timeCfgGroup');
  const timeInput = document.getElementById('timeInput');
  const variantGroup = document.getElementById('variantCfgGroup');
  const cfgTitle = document.getElementById('modesCfgTitle');
  
  const modeNames = {classic:'Классика',bot:'Против бота',fischer:'Фишер 960',meme:'Мемасия',tournament:'Турнир'};
  if(cfgTitle) cfgTitle.textContent = 'Настройки: ' + (modeNames[modeId] || modeId);
  
  // Tournament placeholder
  if(modeId === 'tournament') {
    toast('🏆 Турнир будет доступен в следующем обновлении!');
    showModesList();
    return;
  }
  
  // For bot/fischer — redirect to bot selection
  if(modeId === 'bot' || modeId === 'fischer') {
    showBotSelection();
    return;
  }
  
  // Hide all first
  if(botGroup) botGroup.style.display = 'none';
  if(botToggleGroup) botToggleGroup.style.display = 'none';
  if(sideGroup) sideGroup.style.display = 'none';
  if(variantGroup) variantGroup.style.display = 'none';
  if(timeGroup) timeGroup.style.display = '';
  
  // Мемасия mode
  if(modeId === 'meme') {
    if(botToggleGroup) botToggleGroup.style.display = '';
    if(sideGroup) sideGroup.style.display = '';
    
    // Bot toggle handler
    if(botToggle) {
      botToggle.checked = cfg.bot !== 'off';
      botToggle.onchange = () => {
        if(botToggle.checked) {
          cfg.bot = 'medium';
          if(botGroup) botGroup.style.display = '';
          buildSeg('segBot', [
            {v: 'easy', label: 'Лёгкий', sub: 'рандом'},
            {v: 'medium', label: 'Средний', sub: 'взятия'},
            {v: 'hard', label: 'Сильный', sub: 'минимакс'}
          ], () => cfg.bot, v => { cfg.bot = v; saveCfg(); });
        } else {
          cfg.bot = 'off';
          if(botGroup) botGroup.style.display = 'none';
        }
        saveCfg();
      };
      // Trigger initial state
      botToggle.onchange();
    }
    
    // Side selection
    buildSeg('segSide', [
      {v: 'w', label: '⚪ Белые', sub: 'ход первыми'},
      {v: 'b', label: '⚫ Чёрные', sub: 'ответный ход'},
      {v: 'random', label: '🎲 Случайно', sub: ''}
    ], () => cfg.human, v => { cfg.human = v; saveCfg(); });
    
    // Time
    buildSeg('segTime', [
      {v: 120, label: '⚡ 2 мин', sub: ''},
      {v: 300, label: '🔥 5 мин', sub: ''},
      {v: 600, label: '🎯 10 мин', sub: ''},
      {v: 0, label: '∞', sub: 'без часов'}
    ], () => cfg.timeSec, v => {
      cfg.timeSec = v;
      if(timeInput) timeInput.style.display = (v !== 0) ? '' : 'none';
      saveCfg();
    });
    
    // Meme video settings — рендерим прямо здесь
    var memeGroup = document.getElementById('memeModesGroup');
    var memeBox = document.getElementById('memeModesOpts');
    if(memeGroup && memeBox) {
      memeGroup.style.display = '';
      memeBox.innerHTML = '';

      function mToggle(label, key) {
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
        inp.addEventListener('change', function() { MemeConfig.set(key, inp.checked); });
        var sl = document.createElement('span');
        sl.className = 'toggleSlider';
        sw.appendChild(inp);
        sw.appendChild(sl);
        row.appendChild(lbl);
        row.appendChild(sw);
        memeBox.appendChild(row);
      }

      mToggle('Режим включён', 'enabled');
      mToggle('Реакции (эмодзи)', 'reactions');
      mToggle('Угрозы (пистолеты)', 'threats');
      mToggle('Видео', 'videos');
      mToggle('Звуки', 'sounds');

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
      memeBox.appendChild(volRow);

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
      memeBox.appendChild(slider);

      var videoTitle = document.createElement('div');
      videoTitle.className = 'memeSectionTitle';
      videoTitle.textContent = 'Видео по событиям (можно выбрать несколько)';
      memeBox.appendChild(videoTitle);

      var evTypes = typeof MEME_EVENT_TYPES !== 'undefined' ? MEME_EVENT_TYPES : ['check','capture','threat'];
      var evNames = typeof MEME_EVENT_NAMES !== 'undefined' ? MEME_EVENT_NAMES : {check:'Шах',capture:'Взятие',threat:'Угроза'};
      var evIcons = {check:'♔',capture:'⚔',threat:'👁',defense:'🛡'};

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
      memeBox.appendChild(colorTabs);

      var pieceGrid = document.createElement('div');
      pieceGrid.className = 'memePieceGrid memePieceGrid--events';
      memeBox.appendChild(pieceGrid);

      var detailBox = document.createElement('div');
      detailBox.className = 'memeDetailBox';
      memeBox.appendChild(detailBox);

      var previewEl = document.createElement('div');
      previewEl.className = 'memeVidPreview';
      previewEl.style.display = 'none';
      memeBox.appendChild(previewEl);

      var activeEvent = null;

      function getVidName(file) {
        if(!file) return null;
        if(typeof AVAILABLE_VIDEOS !== 'undefined') {
          var f = AVAILABLE_VIDEOS.find(function(v) { return v.file === file; });
          if(f) return f.name;
        }
        return file.split('/').pop();
      }

      function renderPCards() {
        pieceGrid.innerHTML = '';
        var presets = MemeConfig.get('videoPresets') || {};
        evTypes.forEach(function(k) {
          var card = document.createElement('div');
          card.className = 'memePieceCard' + (activeEvent === k ? ' active' : '');
          var ico = document.createElement('div');
          ico.className = 'mpIcon';
          ico.textContent = evIcons[k] || '?';
          var nm = document.createElement('div');
          nm.className = 'mpName';
          nm.textContent = evNames[k] || k;
          var vl = document.createElement('div');
          var arr = presets[k] ? (presets[k][activeColor] || []) : [];
          var cnt = Array.isArray(arr) ? arr.length : 0;
          vl.className = 'mpVideo' + (cnt ? '' : ' none');
          vl.textContent = cnt ? cnt + ' видео' : 'не назначено';
          card.appendChild(ico);
          card.appendChild(nm);
          card.appendChild(vl);
          card.addEventListener('click', function() {
            activeEvent = (activeEvent === k) ? null : k;
            renderPCards();
            renderDetail();
          });
          pieceGrid.appendChild(card);
        });
      }

      function renderDetail() {
        detailBox.innerHTML = '';
        if(!activeEvent) return;
        var presets = MemeConfig.get('videoPresets') || {};
        var arr = (presets[activeEvent] && presets[activeEvent][activeColor]) || [];

        var head = document.createElement('div');
        head.className = 'memeDetailHead';
        head.textContent = (evIcons[activeEvent]||'') + ' ' + (evNames[activeEvent]||activeEvent) + ' — ' + (activeColor === 'w' ? 'Белые' : 'Чёрные');
        detailBox.appendChild(head);

        if(arr.length) {
          var selTitle = document.createElement('div');
          selTitle.className = 'memeDetailLabel';
          selTitle.textContent = 'Выбрано (' + arr.length + '):';
          detailBox.appendChild(selTitle);

          var chips = document.createElement('div');
          chips.className = 'memeChips';
          arr.forEach(function(file, idx) {
            var chip = document.createElement('div');
            chip.className = 'memeChip';
            chip.textContent = getVidName(file) || file;

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
            rm.textContent = '×';
            rm.addEventListener('click', function(e) {
              e.stopPropagation();
              var p = MemeConfig.get('videoPresets') || {};
              var a = p[activeEvent][activeColor];
              a.splice(idx, 1);
              MemeConfig.set('videoPresets', p);
              renderDetail();
              renderPCards();
            });
            chip.appendChild(rm);
            chips.appendChild(chip);
          });
          detailBox.appendChild(chips);
        }

        var availTitle = document.createElement('div');
        availTitle.className = 'memeDetailLabel';
        availTitle.textContent = 'Добавить видео:';
        detailBox.appendChild(availTitle);

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
              badge.textContent = '✓';
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
                if(!p[activeEvent]) p[activeEvent] = {w:[],b:[]};
                if(!p[activeEvent][activeColor]) p[activeEvent][activeColor] = [];
                p[activeEvent][activeColor].push(vid.file);
                MemeConfig.set('videoPresets', p);
                renderDetail();
                renderPCards();
              });
            }
            availList.appendChild(item);
          });
        }
        detailBox.appendChild(availList);
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
        activeColor = 'w'; tabW.classList.add('sel'); tabB.classList.remove('sel');
        renderDetail(); renderPCards();
      });
      tabB.addEventListener('click', function() {
        activeColor = 'b'; tabB.classList.add('sel'); tabW.classList.remove('sel');
        renderDetail(); renderPCards();
      });

      renderPCards();

      var btnsRow = document.createElement('div');
      btnsRow.className = 'memeBtnsRow';
      memeBox.appendChild(btnsRow);

      var resetBtn = document.createElement('button');
      resetBtn.className = 'mBtn';
      resetBtn.textContent = '↺ Сбросить все видео';
      resetBtn.addEventListener('click', function() {
        if(!confirm('Сбросить все назначенные видео?')) return;
        MemeConfig.resetVideoPresets();
        renderPCards();
        renderDetail();
        toast('Видео сброшены');
      });
      btnsRow.appendChild(resetBtn);

      var saveBtn = document.createElement('button');
      saveBtn.className = 'mBtn primary';
      saveBtn.textContent = '💾 Сохранить';
      saveBtn.addEventListener('click', function() {
        saveCfg();
        toast('Настройки сохранены');
      });
      btnsRow.appendChild(saveBtn);

      var presetsTitle = document.createElement('div');
      presetsTitle.className = 'memeSectionTitle';
      presetsTitle.textContent = 'Пресеты (макс. ' + (MemeConfig.MAX_PRESETS || 3) + ')';
      memeBox.appendChild(presetsTitle);

      var presetsBox = document.createElement('div');
      presetsBox.className = 'memePresets';
      memeBox.appendChild(presetsBox);

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
      memeBox.appendChild(presetInput);

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
            renderPCards();
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
    
    saveCfg();
    return;
  }
  
  // Classic mode
  buildSeg('segTime', [
    {v: 600, label: '10 мин', sub: '⏱'},
    {v: 900, label: '15 мин', sub: '⏱'},
    {v: 1200, label: '20 мин', sub: '⏱'},
    {v: 1800, label: '30 мин', sub: '♔'},
    {v: 0, label: '∞', sub: 'без часов'}
  ], () => cfg.timeSec, v => {
    cfg.timeSec = v;
    if(timeInput) timeInput.style.display = (v !== 0) ? '' : 'none';
    saveCfg();
  });
  
  saveCfg();
}

function showModesList() {
  const modesBox = document.getElementById('modesList');
  const modesCfg = document.getElementById('modesCfg');
  if(modesBox) modesBox.style.display = '';
  if(modesCfg) modesCfg.style.display = 'none';
  selectedModeId = null;
}

/* --- Скрыть все экраны-заставки, показать доску --- */
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('show'));
  const dbBtn = document.getElementById('devblogBtn');
  if(dbBtn) dbBtn.style.display = 'none';
}

/* --- Советы на главном экране --- */
const TIPS = [
  '💡 Конь — единственная фигура, которая может перепрыгивать через другие.',
  '💡 Ферзь сочетает силу ладьи и слона — самая мощная фигура.',
  '💡 Рокировка — единственный ход, когда двигаются две фигуры за раз.',
  '💡 Пешка может превратиться в ферзя, ладью, слона или коня, дойдя до последнего ряда.',
  '💡 «В завязке» — положение, когда все фигуры ещё на доске и структура пешек не определена.',
  '💡 Мат — это шах, от которого нет защиты. Партия заканчивается.',
  '💡 Пат — когда у игрока нет ходов, но шаха нет. Ничья!',
  '💡 Рокировка возможна, если король и ладья не двигались, между ними нет фигур, и король не под шахом.',
  '💡 Срубление на проходе (en passant) — особый ход для пешек.',
  '💡 Контроль центра — ключ к успешной игре. Занять центр пешками и фигурами.',
  '💡 Подсказка: нажмите 💡 на панели во время игры, чтобы увидеть лучший ход.',
  '💡 За победу над ботом вы получаете 10 🪙, за ничью — 3 🪙.',
  '💡 Купите скины в 🛍 Магазине за монеты!',
  '💡 Ежедневный бонус: зайдите в игру и получите 25 🪙 бесплатно.',
  '💡 Используйте ↩️ Назад, чтобы отменить последний ход.',
];

function showRandomTip() {
  const el = document.getElementById('tipBox');
  if(!el) return;
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  el.innerHTML = tip;
}

/* --- Новая игра --- */
function newGame() {
  // Clear saved game
  ChessEngine.clearStorage();

  // Set game mode
  if(cfg.modeId === 'meme') {
    cfg.gameMode = 'meme';
    MemeConfig.set('enabled', true);
  } else if(cfg.modeId === 'bot' || cfg.bot !== 'off') {
    cfg.gameMode = 'bot';
    MemeConfig.set('enabled', false);
  } else if(cfg.variant === 'fischer960') {
    cfg.gameMode = 'fischer';
    MemeConfig.set('enabled', false);
  } else {
    cfg.gameMode = cfg.modeId || 'classic';
    MemeConfig.set('enabled', false);
  }

  // Handle random color
  let humanColor = cfg.human;
  if(humanColor === 'random') {
    humanColor = Math.random() < 0.5 ? 'w' : 'b';
  }
  
  S = new ChessEngine(cfg.variant || 'classic');
  S.newGame();
  if(typeof MemeThreatHandler !== 'undefined') MemeThreatHandler.clearAll();

  // Apply board colors
  if(cfg.board && BOARDS[cfg.board]) {
    const b = BOARDS[cfg.board];
    document.documentElement.style.setProperty('--sq-l', b.light);
    document.documentElement.style.setProperty('--sq-d', b.dark);
  }
  
  lastMove = null;
  selected = null;
  legalCache = [];
  hintMove = null;
  pendingPromo = null;
  takenByW = [];
  takenByB = [];
  isBotThinking = false;
  opponentMuted = false;
  const muteBtn = document.getElementById('muteBtn');
  if(muteBtn) { muteBtn.textContent = '🔊'; muteBtn.classList.remove('muted'); }
  const chatMsgs = document.getElementById('chatMsgs');
  if(chatMsgs) chatMsgs.innerHTML = '';
  S.humanColor = humanColor;

  // Bot greeting
  if(cfg.bot !== 'off') {
    const cu = ProfilesManager.getCurrent();
    const botId = cu ? (cu.botId || 1) : 1;
    const bot = BOT_LIST.find(b => b.id === botId);
    if(bot) {
      const greetings = {
        cheerful: ['Привет! Давай играть!','Приветствую! Начинаем!','Хо-хо! Поехали!'],
        sleepy:   ['Ой... привет... давай...','Здравствуй... Ну, поиграем...'],
        rush:     ['Быстро! Привет! Поехали!','Привет! Некогда ждать!'],
        random:   ['Привет! А вот как мы играть...','Сюрприз! Привет!'],
        cautious: ['Здравствуйте. Будем осторожны.','Привет. Без лишних рисков.'],
        aggressive:['Привет! Приготовься!','Давай! Атакуем!'],
        strategic:['Здравствуйте. Изучим позицию.','Привет. План таков...'],
        knighty:  ['Привет! Кони на старт!','Привет! Ищу вилку...'],
        flanky:   ['Привет! Играем на флангах.','Здравствуй! Центр не наш.'],
        queeny:   ['Привет! Ферзь на месте!','Здравствуй! Королева приветствует!'],
        checky:   ['Привет! Шах буде!','Давай! Проверим короля!'],
        deffy:    ['Здравствуй. Оборона — сила.','Привет. Строю стену.'],
        piecey:   ['Привет! Белые фигуры!','Здравствуй! Армия белых!'],
        movey:    ['Привет! Кони и ладьи!','Давай! Рыцарский натиск!'],
        ggamby:   ['Привет! Берёшь пешку?','Здравствуй! Гамбит!'],
        endy:     ['Привет! Эндшпиль — наше всё.','Здравствуй! Король главный!'],
        mini:     ['Привет. Считаю варианты.','Здравствуй. Два хода вперёд.'],
        alpha:    ['Привет. Чистая позиция.','Здравствуй. Объективно лучший ход.'],
        stocky:   ['Привет! Давим пешками!','Здравствуй! Как движок!'],
        gm:       ['Здравствуйте. Интересная партия.','Привет. Даю тебе фору.']
      };
      const pool = greetings[bot.chatType] || greetings.cheerful;
      const greeting = pool[Math.floor(Math.random() * pool.length)];
      setTimeout(() => { Chat.appendChat('opp', greeting); }, 600 + Math.random() * 400);
    }
  }

  // Flip board for black player + apply skin CSS
  const boardBox = document.getElementById('boardBox');
  if(boardBox) {
    boardBox.classList.toggle('flipped', humanColor === 'b');
    boardBox.classList.remove('skin-rajasthani');
    const skin = SKINS[cfg.skin];
    if(skin && skin.css) boardBox.classList.add(skin.css);
  }

  buildGrid();
  fullRender();
  refreshBars();
  updateCounters();

  // Clear move history display
  const movesEl = document.getElementById('moves');
  if(movesEl) {
    movesEl.innerHTML = '<div id="noMoves">Ходов пока нет</div>';
  }

  // Start clock if timed game
  if(cfg.timeSec > 0) {
    S.clockOn = true;
    S.time = {w: cfg.timeSec, b: cfg.timeSec};
    startClock();
  } else {
    S.clockOn = false;
    S.time = null;
  }
  updateClockUI();

  // If human plays black, bot moves first
  if(humanColor === 'b' && cfg.bot !== 'off') {
    const sl = document.getElementById('statusLine');
    if(sl) sl.textContent = '🤖 Бот думает...';
    setTimeout(botMove, 800 + Math.random() * 600);
  }
}

/* --- Часы --- */
function startClock() {
  stopClock();
  clockInterval = setInterval(() => {
    if(!S || !S.clockOn || S.gameOver) return;
    S.time[S.turn]--;
    updateClockUI();
    if(S.time[S.turn] <= 0) {
      S.gameOver = true;
      stopClock();
      const loser = S.turn;
      const winner = loser === 'w' ? 'b' : 'w';
      const cu = ProfilesManager.getCurrent();
      if(cu) {
        const result = loser === S.humanColor ? 'loss' : 'win';
        cu.recordResult(result, cfg.bot !== 'off', cfg.modeId);
        Store.checkAchievements();
      }
      // Toast notification
      let loserName = loser === S.humanColor ? 'Вы' : 'Соперник';
      if(loser !== S.humanColor && cfg.bot !== 'off') {
        const cu = ProfilesManager.getCurrent();
        const botId = cu ? (cu.botId || 1) : 1;
        const bot = BOT_LIST.find(b => b.id === botId);
        if(bot) loserName = bot.emoji + ' ' + bot.name;
      }
      toast('⏰ ' + loserName + ' просрочили время! ' + (winner === S.humanColor ? '🏆 Победа!' : '😔 Поражение'));
      ChessEngine.clearStorage();
      const resumeBtn = document.getElementById('mResume');
      if(resumeBtn) resumeBtn.style.display = 'none';
      renderCoins();
      renderProfBar();
      renderStats();
      snd.lose();
    }
  }, 1000);
}

function stopClock() {
  if(clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

/* --- Конец игры --- */
function endGame(reason, winnerColor, drawReason) {
  S.gameOver = true;
  stopClock();
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;

  let result;
  if(reason === 'resign') {
    result = winnerColor === S.humanColor ? 'win' : 'loss';
  } else if(reason === 'timeout') {
    result = winnerColor === S.humanColor ? 'win' : 'loss';
  } else if(reason === 'checkmate') {
    result = winnerColor === S.humanColor ? 'win' : 'loss';
  } else {
    result = 'draw';
  }

  // Sound
  if(result === 'win') snd.win();
  else if(result === 'loss') snd.lose();
  else snd.draw();

  // Get opponent rating for display
  let opponentRating = 1000;
  if(cfg.bot !== 'off') {
    const botId = cu.botId || 1;
    const bot = BOT_LIST.find(b => b.id === botId);
    if(bot) opponentRating = bot.rating;
  }

  cu.recordResult(result, cfg.bot !== 'off', cfg.modeId);
  Store.checkAchievements();
  renderCoins();
  renderProfBar();

  // Show game over overlay
  const goT = document.getElementById('goT');
  const goS = document.getElementById('goS');
  const reasons = {
    checkmate: 'Мат', timeout: 'Время вышло', stalemate: 'Пат',
    resign: 'Сдача', draw: 'По соглашению',
    '50-move': 'Правило 50 ходов', repetition: 'Тройное повторение', insufficient: 'Недостаток материала'
  };
  if(goT) goT.textContent = result === 'win' ? '🏆 Победа!' : result === 'loss' ? '😔 Поражение' : '🤝 Ничья';
  if(goS) goS.textContent = reasons[drawReason] || reasons[reason] || '';
  openOv('ovOver');
  snd[result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'draw']();
  renderStats();
  renderProfBar();

  // Record match history
  if(!cu.matchHistory) cu.matchHistory = [];
  let opponentName = 'Локальная игра';
  if(cfg.gameMode === 'bot') {
    const botId = cu.botId || 1;
    const bot = BOT_LIST.find(b => b.id === botId);
    opponentName = bot ? '🤖 ' + bot.name : '🤖 Бот';
  } else if(cfg.gameMode === 'multiplayer' && ChesMP && ChesMP.opponent) {
    opponentName = ChesMP.opponent.name;
  } else if(cfg.gameMode === 'meme') {
    opponentName = 'Мемасия';
  } else if(cfg.variant === 'fischer960' || cfg.gameMode === 'fischer') {
    opponentName = 'Фишер 960';
  }
  cu.matchHistory.push({
    result: result,
    opponent: opponentName,
    mode: cfg.gameMode || cfg.modeId || 'classic',
    reason: reasons[drawReason] || reasons[reason] || '',
    time: Date.now()
  });
  if(cu.matchHistory.length > 50) cu.matchHistory = cu.matchHistory.slice(-50);
  saveProfiles();

  // Sync profile to Firebase
  if(ChesAuth && ChesAuth.user && !ChesAuth.user.isAnonymous) {
    const cu = ProfilesManager.getCurrent();
    if(cu) ChesAuth.syncLocalToCloud(cu);
  }
  
  // Clear saved game
  ChessEngine.clearStorage();
  const resumeBtn = document.getElementById('mResume');
  if(resumeBtn) resumeBtn.style.display = 'none';
}

/* --- Клик по клетке --- */
function onSquareClick(e) {
  if(!S || S.gameOver || isBotThinking) return;
  if(cfg.bot !== 'off' && S.turn !== S.humanColor) return;

  const sq = e.currentTarget;
  const r = parseInt(sq.dataset.r);
  const c = parseInt(sq.dataset.c);
  const piece = S.board[r][c];

  // If a piece is selected
  if(selected) {
    // Click on same square — deselect
    if(selected.r === r && selected.c === c) {
      selected = null;
      legalCache = [];
      hintMove = null;
      paintMarks();
      return;
    }

    // Try to find a legal move to this square
    const move = legalCache.find(m => m.fr === selected.r && m.fc === selected.c && m.tr === r && m.tc === c);
    if(move) {
      // Check for promotion
      if(move.promo) {
        pendingPromo = move;
        openPromoModal();
        return;
      }
      executeMove(move);
      return;
    }

    // Click on own piece — reselect
    if(piece && pieceColorStatic(piece) === S.turn) {
      selected = {r, c};
      legalCache = S.getLegalMoves(r, c);
      hintMove = null;
      paintMarks();
      return;
    }

    // Click on empty or enemy with no legal move — deselect
    selected = null;
    legalCache = [];
    paintMarks();
    return;
  }

  // No piece selected — select own piece
  if(piece && pieceColorStatic(piece) === S.turn) {
    selected = {r, c};
    legalCache = S.getLegalMoves(r, c);
    hintMove = null;
    snd.ui();
    paintMarks();
  }
}

/* --- Найти короля (main.js версия — использует S.board) --- */
function findKingPos(color) {
  const k = color === 'w' ? 'K' : 'k';
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(S.board[r][c] === k) return {r, c};
    }
  }
  return null;
}

/* --- Выполнить ход --- */
function executeMove(move) {
  const isHumanMove = S.turn === S.humanColor;
  // Record capture
  let capturePiece = null;
  if(move.capture) {
    const captured = move.type === 'p' && move.ep ? (S.turn === 'w' ? 'p' : 'P') : (S.board[move.tr][move.tc] || null);
    if(captured) {
      const capColor = pieceColorStatic(captured);
      if(capColor === 'w') takenByW.push(pieceTypeStatic(captured));
      else takenByB.push(pieceTypeStatic(captured));
      capturePiece = captured;
    }
  }

  S.makeMove(move);
  lastMove = {fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc};
  selected = null;
  legalCache = [];
  hintMove = null;
  if(move.capture) snd.capture(); else snd.move();

  // Multiplayer: send move to server
  if(cfg.gameMode === 'multiplayer' && typeof ChesMP !== 'undefined' && ChesMP.lobbyId && isHumanMove) {
    const fromSq = String.fromCharCode(97 + move.fc) + (8 - move.fr);
    const toSq = String.fromCharCode(97 + move.tc) + (8 - move.tr);
    const notation = fromSq + (move.capture ? 'x' : '-') + toSq + (move.promo ? '=' + move.promo.toUpperCase() : '') + (S.inCheck(S.turn) ? '+' : '');
    ChesMP.sendMove(fromSq, toSq, S.toFen(), notation);
  }

  // Get captures from the NEW position (restore turn temporarily for isLegal)
  var memeCaptures = null;
  if(MemeConfig.isMemeMode()) {
    try {
    var savedTurn = S.turn;
    S.turn = isHumanMove ? S.humanColor : (S.humanColor === 'w' ? 'b' : 'w');
    var postMoves = S.getLegalMoves(move.tr, move.tc);
    S.turn = savedTurn;
    if(postMoves) {
      memeCaptures = postMoves.filter(function(m) { return m.capture; });
    }
    } catch(e) { console.error('memeCaptures error:', e); }
  }

  // Publish meme events — for both human and bot moves
  if(MemeConfig.isMemeMode()) {
    try {
    var memeData = {
      toRow: move.tr, toCol: move.tc,
      piece: move.type, captured: move.capture || null,
      threats: [],
      defended: [],
      wasCheck: false,
      kingRow: null, kingCol: null,
      isHumanMove: isHumanMove
    };

    var memeCheck = S.inCheck(S.turn);
    if(memeCheck) {
      var kp = findKingPos(S.turn);
      if(kp) { memeData.wasCheck = true; memeData.kingRow = kp.r; memeData.kingCol = kp.c; }
    }

    if(memeCaptures && memeCaptures.length) {
      memeData.threats = memeCaptures
        .filter(function(mc) { return !(move.capture && mc.tr === move.tr && mc.tc === move.tc); })
        .map(function(mc) { return { row: mc.tr, col: mc.tc }; });

      var movedPc = S.board[move.tr][move.tc];
      var movedColor = movedPc ? (movedPc === movedPc.toUpperCase() ? 'w' : 'b') : (isHumanMove ? S.humanColor : (S.humanColor === 'w' ? 'b' : 'w'));
      for(var fr = 0; fr < 8; fr++) {
        for(var fc = 0; fc < 8; fc++) {
          if(fr === move.tr && fc === move.tc) continue;
          var fp = S.board[fr] && S.board[fr][fc];
          if(!fp) continue;
          var fpColor = (fp === fp.toUpperCase()) ? 'w' : 'b';
          if(fpColor !== movedColor) continue;
          for(var mc = 0; mc < memeCaptures.length; mc++) {
            if(memeCaptures[mc].tr === fr && memeCaptures[mc].tc === fc) {
              memeData.defended.push({ row: fr, col: fc });
              break;
            }
          }
        }
      }
    }

    // --- New events: promotion, sacrifice, blunder, brilliant ---
    var movedPc2 = S.board[move.tr][move.tc];
    var mc2 = movedPc2 ? (movedPc2 === movedPc2.toUpperCase() ? 'w' : 'b') : null;
    var opp2 = mc2 === 'w' ? 'b' : 'w';

    // Find opponent attacks on the moved piece
    var oppMoves = [];
    try { oppMoves = S.allLegalMoves(opp2); } catch(e) {}
    var attacksOnMoved = oppMoves.filter(function(m) {
      return m.tr === move.tr && m.tc === move.tc && m.capture;
    });

    // promotion: pawn within 3 ranks of promotion, path clear
    if(mc2 && move.type === 'p') {
      var promoRow = mc2 === 'w' ? 0 : 7;
      var dist = Math.abs(move.tr - promoRow);
      if(dist <= 3) {
        var dir = mc2 === 'w' ? -1 : 1;
        var clear = true;
        for(var pr = move.tr + dir; pr !== promoRow; pr += dir) {
          if(S.board[pr][move.tc]) { clear = false; break; }
        }
        if(clear) memeData.promotion = { row: move.tr, col: move.tc };
      }
    }

    // sacrifice: moved piece can be captured by a less valuable piece
    if(attacksOnMoved.length) {
      var movedVal = VAL[move.type] || 0;
      var minAttVal = 999;
      attacksOnMoved.forEach(function(am) {
        var atype = am.type || '';
        var av = VAL[atype] || 0;
        if(av < minAttVal) minAttVal = av;
      });
      if(minAttVal < movedVal && !memeData.wasCheck) {
        memeData.sacrifice = { row: move.tr, col: move.tc };
      }
      // blunder: moved piece is undefended and can be captured for free
      var isDefended = false;
      for(var dr = 0; dr < 8 && !isDefended; dr++) {
        for(var dc = 0; dc < 8 && !isDefended; dc++) {
          if(dr === move.tr && dc === move.tc) continue;
          var dp = S.board[dr] && S.board[dr][dc];
          if(!dp) continue;
          var dpColor = (dp === dp.toUpperCase()) ? 'w' : 'b';
          if(dpColor !== mc2) continue;
          var defMoves = [];
          try { defMoves = S.getLegalMoves(dr, dc); } catch(e) {}
          for(var di = 0; di < defMoves.length; di++) {
            if(defMoves[di].tr === move.tr && defMoves[di].tc === move.tc) {
              isDefended = true;
              break;
            }
          }
        }
      }
      if(!isDefended && minAttVal < movedVal && minAttVal <= movedVal - 2) {
        memeData.blunder = { row: move.tr, col: move.tc };
        delete memeData.sacrifice;
      }
    }

    // brilliant: check delivered while piece is under attack, or capture-with-check
    if(memeData.wasCheck && attacksOnMoved.length && move.capture) {
      memeData.brilliant = { row: move.tr, col: move.tc };
      delete memeData.sacrifice;
      delete memeData.blunder;
    }

    MemeEventBus.publish('MEME_EVENTS', memeData);
    var moveEventData = {
      fromRow: move.fr, fromCol: move.fc,
      toRow: move.tr, toCol: move.tc,
      capture: !!move.capture,
      captures: memeCaptures || [],
      isHumanMove: isHumanMove
    };
    MemeEventBus.publish('MOVE', moveEventData);
    } catch(e) { console.error('[MEME] MemeEvent error:', e); }
  }

  // Record move in history
  const wasCheck = S.inCheck(S.turn);
  const moveNum = S.fullmove;
  appendMoveToHistory(move, S.turn === 'b' ? moveNum : moveNum - 1, wasCheck);

  // Capture animation
  if(capturePiece) {
    const boardBox = document.getElementById('boardBox');
    if(boardBox) {
      const ghost = document.createElement('div');
      ghost.className = 'piece capAnim';
      ghost.textContent = getSkinGlyph(pieceColorStatic(capturePiece), pieceTypeStatic(capturePiece));
      ghost.style.left = (move.tc * 12.5) + '%';
      ghost.style.top = (move.tr * 12.5) + '%';
      ghost.style.width = '12.5%';
      ghost.style.height = '12.5%';
      boardBox.appendChild(ghost);
      setTimeout(() => ghost.remove(), 350);
    }
  }
  // Promotion animation
  if(move.promo) {
    const boardBox = document.getElementById('boardBox');
    if(boardBox) {
      const ghost = document.createElement('div');
      ghost.className = 'piece promoAnim';
      ghost.textContent = getSkinGlyph(S.turn === 'w' ? 'b' : 'w', move.promo);
      ghost.style.left = (move.tc * 12.5) + '%';
      ghost.style.top = (move.tr * 12.5) + '%';
      ghost.style.width = '12.5%';
      ghost.style.height = '12.5%';
      boardBox.appendChild(ghost);
      setTimeout(() => ghost.remove(), 450);
    }
  }

  fullRender();
  
  // Save game state
  if(S && !S.gameOver) S.saveToStorage();

  // Update status line
  const sl = document.getElementById('statusLine');
  if(sl) {
    if(S.inCheck(S.turn)) { sl.textContent = '⚠ Шах!'; snd.check(); }
    else sl.textContent = S.turn === 'w' ? 'Ход белых' : 'Ход чёрных';
  }

  // Check game state
  if(S.isCheckmate(S.turn)) {
    const winner = S.turn === 'w' ? 'b' : 'w';
    setTimeout(() => endGame('checkmate', winner), 300);
    return;
  }
  if(S.isStalemate(S.turn)) {
    setTimeout(() => endGame('stalemate', null), 300);
    return;
  }
  const drawReason = S.checkDrawRules();
  if(drawReason) {
    setTimeout(() => endGame('draw', null, drawReason), 300);
    return;
  }

  // Bot's turn
  if(cfg.bot !== 'off' && S.turn !== S.humanColor && !S.gameOver) {
    const sl = document.getElementById('statusLine');
    if(sl) sl.textContent = '🤖 Бот думает...';
    setTimeout(botMove, 800 + Math.random() * 1200);
  }
}

/* --- Ход бота --- */
function botMove() {
  if(!S || S.gameOver || S.turn === S.humanColor) return;
  isBotThinking = true;

  try {
  const moves = S.allLegalMoves(S.turn);
  if(!moves.length) {
    isBotThinking = false;
    if(S.inCheck(S.turn)) endGame('checkmate', S.turn === 'w' ? 'b' : 'w');
    else endGame('stalemate', null);
    return;
  }

  let move = null;
  const cu = ProfilesManager.getCurrent();
  const botId = cu ? (cu.botId || 1) : 1;
  try {
    move = Bot.makeMoveById(botId, S.turn, S);
  } catch(e) {
    console.error('Bot error:', e);
    move = moves[0];
  }

  isBotThinking = false;
  if(move) {
    executeMove(move);
    return;
  }
  } catch(e) {
    console.error('BotMove error:', e);
    isBotThinking = false;
  }
}

/* --- Хинт --- */
let hintsLeft = 2;
function showHint() {
  if(!S || S.gameOver || hintsLeft <= 0) return;
  hintsLeft--;
  updateCounters();
  const moves = S.allLegalMoves(S.turn);
  if(!moves.length) return;
  let best = moves[0];
  let bestScore = -Infinity;
  for(const m of moves) {
    const saved = S.saveState();
    S.applyMove(m);
    const score = -S.evalPosition(S.turn);
    S.restoreState(saved);
    if(score > bestScore) { bestScore = score; best = m; }
  }
  hintMove = {fr: best.fr, fc: best.fc, tr: best.tr, tc: best.tc};
  paintMarks();
  setTimeout(() => { hintMove = null; paintMarks(); }, 2500);
}

/* --- Отмена хода --- */
let undosLeft = 3;
function undoMove() {
  if(!S || S.moveHistory.length === 0) return;
  if(isBotThinking) return;
  if(undosLeft <= 0) { toast('Отмены закончились'); return; }
  undosLeft--;
  const hadBot = cfg.bot !== 'off';
  S.undoLastMove();
  if(hadBot && S.moveHistory.length > 0) S.undoLastMove();
  if(hadBot && S.moveHistory.length > 0) S.undoLastMove();
  lastMove = null;
  selected = null;
  legalCache = [];
  hintMove = null;
  const movesEl = document.getElementById('moves');
  if(movesEl) {
    const toRemove = hadBot ? 3 : 1;
    for(let i = 0; i < toRemove; i++) {
      if(movesEl.lastChild && movesEl.lastChild.id !== 'noMoves') {
        movesEl.removeChild(movesEl.lastChild);
      }
    }
    if(!movesEl.querySelector('.mrow')) {
      const noMoves = document.getElementById('noMoves');
      if(noMoves) noMoves.style.display = '';
    }
  }
  if(MemeConfig.isMemeMode()) MemeThreatHandler.clearAll();
  updateCounters();
  fullRender();
  toast('Ход отменён');
}

/* --- Обновление счётчиков хинтов/отмен --- */
function updateCounters() {
  const h = document.getElementById('hintN');
  const u = document.getElementById('undoN');
  if(h) h.textContent = '(' + hintsLeft + ')';
  if(u) u.textContent = '(' + undosLeft + ')';
  const btnH = document.getElementById('btnHint');
  const btnU = document.getElementById('btnUndo');
  if(btnH) btnH.disabled = hintsLeft <= 0;
  if(btnU) btnU.disabled = undosLeft <= 0;
}

/* --- Запись хода в историю --- */
function notationFromMove(m, wasCheck) {
  const files = 'abcdefgh';
  const from = files[m.fc] + (8 - m.fr);
  const to = files[m.tc] + (8 - m.tr);
  const piece = m.type === 'p' ? '' : m.type.toUpperCase();
  const promo = m.promo ? '=' + m.promo.toUpperCase() : '';
  const check = wasCheck ? '+' : '';
  let notation = '';
  if(m.type === 'p') {
    if(m.capture) notation = files[m.fc] + 'x' + to;
    else notation = to;
  } else {
    notation = piece + (m.capture ? 'x' : '') + to;
  }
  return notation + promo + check;
}

function appendMoveToHistory(m, moveNum, wasCheck) {
  const movesEl = document.getElementById('moves');
  if(!movesEl) return;
  const noMoves = document.getElementById('noMoves');
  if(noMoves) noMoves.style.display = 'none';

  const notation = notationFromMove(m, wasCheck);
  const row = document.createElement('div');
  row.className = 'mrow';
  if(S.turn === 'b') {
    row.innerHTML = '<span class="mnum">' + moveNum + '.</span><span class="mv">' + notation + '</span>';
  } else {
    row.innerHTML = '<span class="mnum"></span><span class="mv">' + notation + '</span>';
  }
  movesEl.appendChild(row);
  movesEl.scrollTop = movesEl.scrollHeight;
}

/* --- Сдача --- */
function resignGame() {
  if(!S || S.gameOver) return;
  askConfirm('Сдаться?', 'Вы уверены что хотите сдаться?', () => {
    const winner = S.humanColor === 'w' ? 'b' : 'w';
    endGame('resign', winner);
  });
}

/* --- Ничья --- */
function offerDraw() {
  if(!S || S.gameOver) return;
  askConfirm('Предложить ничью?', 'Вы уверены?', () => {
    endGame('draw', null);
  });
}

/* --- Мультиплеер: входящий ход --- */
function handleIncomingMove(move) {
  if(!S || S.gameOver) return;
  if(S.turn === S.humanColor) return;

  const fromR = 8 - parseInt(move.from[1]);
  const fromC = move.from.charCodeAt(0) - 97;
  const toR = 8 - parseInt(move.to[1]);
  const toC = move.to.charCodeAt(0) - 97;

  const legal = S.getLegalMoves(fromR, fromC);
  const isLegal = legal.some(m => m[0] === toR && m[1] === toC);
  if(!isLegal) return;

  executeMove(fromR, fromC, toR, toC);
}

/* --- Настройка лобби --- */
let _lobbyCfg = { mode: 'classic', timeSec: 600, color: 'random' };

function renderLobbySetup() {
  const modes = [
    {v:'classic', label:'♟ Классика'},
    {v:'meme', label:'🔫 Мемасия'},
    {v:'fischer', label:'🎲 Фишер 960'}
  ];
  const colors = [
    {v:'w', label:'⚪ Белые'},
    {v:'b', label:'⚫ Чёрные'},
    {v:'random', label:'🎲 Случайно'}
  ];

  function renderSeg(boxId, items, key) {
    const box = document.getElementById(boxId);
    if(!box) return;
    box.innerHTML = '';
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'segBtn' + (_lobbyCfg[key] === it.v ? ' sel' : '');
      btn.innerHTML = '<span class="nm">' + it.label + '</span>';
      btn.onclick = () => { _lobbyCfg[key] = it.v; renderSeg(boxId, items, key); };
      box.appendChild(btn);
    });
  }

  renderSeg('lobbyModeSeg', modes, 'mode');
  renderSeg('lobbyColorSeg', colors, 'color');

  // Time slider
  const timeMarks = [
    {v:60, label:'1 мин'},
    {v:180, label:'3 мин'},
    {v:300, label:'5 мин'},
    {v:600, label:'10 мин'},
    {v:900, label:'15 мин'},
    {v:1200, label:'20 мин'},
    {v:1800, label:'30 мин'},
    {v:3600, label:'1 ч'},
    {v:5400, label:'1.5 ч'},
    {v:7200, label:'2 ч'},
    {v:0, label:'∞'}
  ];
  const timeBox = document.getElementById('lobbyTimeSeg');
  if(timeBox) {
    const curIdx = timeMarks.findIndex(m => m.v === _lobbyCfg.timeSec);
    const sliderVal = curIdx >= 0 ? curIdx : 3;
    timeBox.innerHTML =
      '<div class="timeSliderWrap">' +
        '<input type="range" id="lobbyTimeSlider" min="0" max="' + (timeMarks.length - 1) + '" value="' + sliderVal + '" class="timeSlider">' +
        '<div class="timeSliderLabels">' +
          '<span>1 мин</span><span>∞</span>' +
        '</div>' +
        '<div class="timeSliderMarks" id="timeSliderMarks"></div>' +
        '<div class="timeSliderValue" id="timeSliderValue">' + _formatTime(_lobbyCfg.timeSec) + '</div>' +
      '</div>';
    const slider = document.getElementById('lobbyTimeSlider');
    const marksEl = document.getElementById('timeSliderMarks');
    const valEl = document.getElementById('timeSliderValue');
    if(marksEl) {
      timeMarks.forEach((m, i) => {
        const dot = document.createElement('div');
        dot.className = 'timeMark' + (i === sliderVal ? ' sel' : '');
        dot.style.left = (i / (timeMarks.length - 1) * 100) + '%';
        dot.title = m.v === 0 ? 'Бесконечно' : m.label + ' мин';
        dot.onclick = () => {
          slider.value = i;
          _lobbyCfg.timeSec = timeMarks[i].v;
          valEl.textContent = _formatTime(timeMarks[i].v);
          marksEl.querySelectorAll('.timeMark').forEach((d, j) => d.classList.toggle('sel', j === i));
        };
        marksEl.appendChild(dot);
      });
    }
    if(slider) {
      slider.oninput = () => {
        const idx = parseInt(slider.value);
        _lobbyCfg.timeSec = timeMarks[idx].v;
        valEl.textContent = _formatTime(timeMarks[idx].v);
        marksEl.querySelectorAll('.timeMark').forEach((d, j) => d.classList.toggle('sel', j === idx));
      };
    }
  }
}

function _formatTime(sec) {
  if(sec === 0) return '∞ Без ограничений';
  if(sec >= 3600) {
    const h = sec / 3600;
    return (h % 1 === 0 ? h : h.toFixed(1)) + ' ч';
  }
  const m = Math.floor(sec / 60);
  return m + ' мин';
}

function startLobbyFromSetup() {
  ensureAuth().then(() => {
    if(!ChesAuth.user) {
      toast('❌ Не удалось войти. Проверьте подключение к интернету.');
      showScreen('scrMulti');
      return;
    }
    if(!firebaseRtdb) {
      toast('❌ Firebase не инициализирован. Обновите страницу.');
      showScreen('scrMulti');
      return;
    }
    NetUI._lobbySettings = _lobbyCfg;
    NetUI._showLobby('Создание...', 'Создаём лобби...');
    showScreen('scrLobby');
    ChesMP.createLobby(_lobbyCfg).then(id => {
      if(!id) {
        toast('❌ Не удалось создать лобби. Проверьте Firebase правила.');
        showScreen('scrMulti');
        return;
      }
      NetUI._lobbyId = id;
      NetUI._showLobby(id, 'Ожидание соперника...');
      ChesMP.onStart(opponent => { NetUI._startMultiplayerGame(); });
      ChesMP.onMove(move => { NetUI._onOpponentMove(move); });
      ChesMP.onEnd((winner, reason) => {
        const result = winner === ChesMP.myColor ? 'win' : 'loss';
        NetUI._onMultiplayerEnd(result, reason);
      });
      ChesMP._listenGame();
    }).catch(e => {
      console.error('createLobby error:', e);
      toast('❌ Ошибка: ' + (e.message || e));
      showScreen('scrMulti');
    });
  });
}

/* --- Меню сетевой игры --- */
function showMultiplayerMenu() {
  showScreen('scrMulti');
  const mpStatus = document.getElementById('mpStatus');
  if(mpStatus) {
    if(!ChesAuth.user) {
      mpStatus.textContent = 'Вы играете как гость — лобби доступны без регистрации';
    } else if(ChesAuth.user.isAnonymous) {
      mpStatus.textContent = 'Анонимный вход · Лобби доступны';
    } else {
      mpStatus.textContent = 'Вы вошли как: ' + (ChesAuth.profile ? ChesAuth.profile.name : ChesAuth.user.email);
    }
  }

  // Auto-login as anonymous for lobby access
  if(!ChesAuth.user) {
    ChesAuth.loginAnon().then(() => {
      ChesMP.setOnline();
      if(mpStatus) mpStatus.textContent = 'Анонимный вход · Лобби доступны';
      if(ChesAuth.user) {
        ChesMP.listenInvites(inv => {
          if(confirm(inv.fromName + ' приглашает в игру! Принять?')) {
            NetUI.acceptInvite(inv);
          }
        });
      }
    }).catch(e => {
      console.warn('Auto anon login failed:', e.message);
    });
  } else {
    ChesMP.setOnline();
    ChesMP.listenInvites(inv => {
      if(confirm(inv.fromName + ' приглашает в игру! Принять?')) {
        NetUI.acceptInvite(inv);
      }
    });
  }
}

/* --- Мультиплеер: начать сетевую игру --- */
function startMultiplayerGame(mpColor, opponentName) {
  cfg.gameMode = 'multiplayer';
  cfg.human = mpColor;
  cfg.bot = 'off';

  const ls = NetUI._lobbySettings || ChesMP.lobbySettings || {};
  const mpMode = ls.mode || 'classic';
  cfg.modeId = mpMode;
  cfg.memes = mpMode === 'meme';
  MemeConfig.set('enabled', mpMode === 'meme');
  cfg.timeSec = ls.timeSec != null ? ls.timeSec : 300;

  S = new ChessEngine(mpMode === 'fischer' ? 'fischer' : 'classic');
  S.newGame();
  S.humanColor = mpColor;

  lastMove = null;
  selected = null;
  legalCache = [];
  hintMove = null;
  hintCount = 0;

  if(typeof MemeThreatHandler !== 'undefined') MemeThreatHandler.clearAll();
  if(cfg.board && BOARDS[cfg.board]) {
    const b = BOARDS[cfg.board];
    document.documentElement.style.setProperty('--sq-l', b.light);
    document.documentElement.style.setProperty('--sq-d', b.dark);
  }

  hideAllScreens();
  gameBox.style.display = '';

  const boardBox = document.getElementById('boardBox');
  if(boardBox) boardBox.classList.toggle('flipped', mpColor === 'b');

  renderPieces();
  renderStatus();
  updateClock();

  ChesMP.onMove(move => { handleIncomingMove(move); });
  ChesMP.onEnd((winner) => {
    const result = winner === mpColor ? 'win' : 'loss';
    endGame('checkmate', winner);
  });

  // Fetch opponent's playerId
  if(ChesMP.opponent && ChesMP.opponent.uid && firebaseDB) {
    firebaseDB.collection('users').doc(ChesMP.opponent.uid).get().then(snap => {
      if(snap.exists) {
        const d = snap.data();
        if(d.playerId) S.opponentPlayerId = d.playerId;
        refreshBars();
      }
    }).catch(() => {});
  }

  toast('Сетевая игра: vs ' + opponentName);
}

/* --- Применить превращение --- */
function applyReal(move, promoType) {
  move.promo = promoType;
  executeMove(move);
}

/* --- Восстановление игры --- */
function resumeGame() {
  const savedGame = ChessEngine.loadFromStorage();
  if(!savedGame || !savedGame.state) {
    toast('Нет сохранённой игры');
    return;
  }
  
  // Restore config
  if(savedGame.cfg) {
    if(savedGame.cfg.variant) cfg.variant = savedGame.cfg.variant;
    if(savedGame.cfg.human) cfg.human = savedGame.cfg.human;
    if(savedGame.cfg.bot) cfg.bot = savedGame.cfg.bot;
    if(savedGame.cfg.skin) cfg.skin = savedGame.cfg.skin;
    if(savedGame.cfg.modeId) cfg.modeId = savedGame.cfg.modeId;
  }
  
  // Create engine and restore state
  S = new ChessEngine(savedGame.state.variant || 'classic');
  S.restoreState(savedGame.state);
  
  // Restore move history
  if(savedGame.moveHistory) {
    S.moveHistory = savedGame.moveHistory;
  }
  if(savedGame.positionHistory) {
    S.positionHistory = savedGame.positionHistory;
  }
  
  lastMove = null;
  selected = null;
  legalCache = [];
  hintMove = null;
  pendingPromo = null;
  takenByW = [];
  takenByB = [];
  isBotThinking = false;
  hintsLeft = 2;
  undosLeft = 3;

  // Flip board
  const boardBox = document.getElementById('boardBox');
  if(boardBox) boardBox.classList.toggle('flipped', S.humanColor === 'b');

  buildGrid();
  fullRender();
  refreshBars();
  updateCounters();

  // Clear move history display
  const movesEl = document.getElementById('moves');
  if(movesEl) {
    movesEl.innerHTML = '<div id="noMoves">Ходов пока нет</div>';
  }

  // Restore clock
  if(S.clockOn && S.time) {
    startClock();
  }

  hideAllScreens();
  toast('Игра восстановлена');
}

/* === ТАБЛИЦА ЛИДЕРОВ === */
let lbMode = 'classic';

function renderLeaderboard(mode) {
  if(mode) lbMode = mode;
  const lbTop = document.getElementById('lbTop');
  const lbList = document.getElementById('lbList');
  const tabs = document.getElementById('lbTabs');
  if(!lbList) return;
  
  // Update active tab
  if(tabs) {
    tabs.querySelectorAll('.shopTab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === lbMode);
    });
    tabs.onclick = function(e) {
      const tab = e.target.closest('.shopTab');
      if(!tab) return;
      snd.ui();
      renderLeaderboard(tab.dataset.mode);
    };
  }
  
  const curId = ProfilesManager.getCurrent() ? ProfilesManager.getCurrent().id : null;
  const profiles = ProfilesManager.profiles || [];
  
  const players = profiles
    .filter(p => p.name && p.name !== 'Гость' && p.name !== 'Guest')
    .map(p => {
      const ratings = p.ratings || {classic:1000,bot:1000,fischer:1000,meme:1000};
      let rating;
      if(lbMode === 'overall') {
        rating = Math.round((ratings.classic + ratings.bot + ratings.fischer + ratings.meme) / 4);
      } else {
        rating = ratings[lbMode] || 0;
      }
      return {
        id: p.id,
        name: p.name,
        ava: p.ava || '🐣',
        rating: rating,
        games: (p.st && p.st.games) || 0,
        wins: (p.st && p.st.wins) || 0,
        winrate: (p.st && p.st.games) ? Math.round(p.st.wins / p.st.games * 100) : 0,
        playerId: p.playerId || null
      };
    })
    .sort((a, b) => b.rating - a.rating);
  
  if(!players.length) {
    lbList.innerHTML = '<div class="lbEmpty">Пока нет игроков. Создайте профиль!</div>';
    if(lbTop) lbTop.innerHTML = '';
    return;
  }
  
  const top = players[0];
  const league = Elo.getLeague(top.rating);
  
  if(lbTop) {
    lbTop.innerHTML = '<div class="lbChamp">' +
      '<div class="lbChampAva">' + top.ava + '</div>' +
      '<div class="lbChampInfo">' +
        '<div class="lbChampName">🏆 ' + top.name + '</div>' +
        '<div class="lbChampRating" style="color:' + league.color + '">' + league.emoji + ' ' + top.rating + ' — ' + league.name + '</div>' +
        '<div class="lbChampStats">' + top.wins + ' побед · ' + top.winrate + '% винрейт · ' + top.games + ' партий</div>' +
      '</div>' +
    '</div>';
  }
  
  lbList.innerHTML = '';
  players.forEach((p, i) => {
    const pLeague = Elo.getLeague(p.rating);
    const isMe = p.id === curId;
    const row = document.createElement('div');
    row.className = 'lbRow' + (isMe ? ' me' : '');
    row.innerHTML = '<div class="lbRank">' + (i + 1) + '</div>' +
      '<div class="lbAva">' + p.ava + '</div>' +
      '<div class="lbInfo">' +
        '<div class="lbName">' + p.name + (isMe ? ' <span class="lbMeTag">Вы</span>' : '') + (p.playerId ? ' <span style="color:var(--accent);font-size:10px">#' + p.playerId + '</span>' : '') + '</div>' +
        '<div class="lbStats">' + p.wins + ' побед · ' + p.winrate + '%</div>' +
      '</div>' +
      '<div class="lbRating" style="color:' + pLeague.color + '">' + p.rating + '</div>';
    lbList.appendChild(row);
  });
}

/* === CHEAT FUNCTIONS (dev tools) === */
function cheatAddCoins(amount) {
  const cu = ProfilesManager.getCurrent();
  if(!cu) { toast('Нет профиля'); return; }
  cu.coins = Math.max(0, cu.coins + amount);
  saveProfiles();
  renderCoins();
  toast('🪙 ' + cu.coins);
}
function cheatResetCoins() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.coins = 0;
  saveProfiles();
  renderCoins();
  toast('🪙 0');
}
function cheatAddGems(amount) {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.addGems(amount);
  saveProfiles();
  renderCoins();
  toast('💎 ' + cu.gems);
}
function cheatUnlockAll() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  Object.keys(SKINS).forEach(id => { if(!cu.owned.includes(id)) cu.owned.push(id); });
  Object.keys(BOARDS).forEach(id => { const k = 'board_' + id; if(!cu.owned.includes(k)) cu.owned.push(k); });
  Object.keys(STICKERS).forEach(id => { const k = 'sticker_' + id; if(!cu.owned.includes(k)) cu.owned.push(k); });
  Object.keys(AVATARS).forEach(id => { const k = 'avatar_' + id; if(!cu.owned.includes(k)) cu.owned.push(k); });
  cu.addGems(100);
  saveProfiles();
  renderCoins();
  toast('🔓 Всё открыто + 💎 100');
}
function cheatLockAll() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.owned = ['classic'];
  saveProfiles();
  toast('🔒 Всё заблокировано');
}
function cheatAddWins(amount) {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.winsBot = Math.max(0, (cu.winsBot || 0) + amount);
  saveProfiles();
  renderProfBar();
  toast('🏆 ' + cu.winsBot + ' побед');
}
function cheatResetWins() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.winsBot = 0;
  saveProfiles();
  renderProfBar();
  toast('🏆 0 побед');
}
function cheatMaxElo() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.elo = 3000;
  cu.ratings = {classic:3000, bot:3000, fischer:3000, meme:3000};
  saveProfiles();
  renderProfBar();
  toast('↑ Эло 3000');
}
function cheatResetElo() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  cu.elo = 0;
  cu.ratings = {classic:1000, bot:1000, fischer:1000, meme:1000};
  saveProfiles();
  renderProfBar();
  toast('↓ Эло 1000');
}
function cheatToggleSound() {
  cfg.sound = !cfg.sound;
  saveCfg();
  toast(cfg.sound ? '🔊 Звук включён' : '🔇 Звук выключен');
}
function cheatTestWin() {
  if(S && !S.gameOver) endGame('checkmate', S.humanColor);
}
function cheatTestLose() {
  if(S && !S.gameOver) endGame('checkmate', S.humanColor === 'w' ? 'b' : 'w');
}

/* === ИНИЦИАЛИЗАЦИЯ === */

function ensureAuth() {
  if(ChesAuth.user) {
    ChesMP.setOnline();
    return Promise.resolve(true);
  }
  return ChesAuth.loginAnon().then(() => {
    ChesMP.setOnline();
    return true;
  }).catch(e => {
    console.error('ensureAuth loginAnon error:', e);
    return false;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCfg();
  if(typeof normalizeSkin === 'function') normalizeSkin();
  initStore();
  initDOMrefs();
  syncThemeUI();
  if(typeof MemeThreatHandler !== 'undefined') MemeThreatHandler.init();

  // Check for saved game
  const savedGame = ChessEngine.loadFromStorage();
  const resumeBtn = document.getElementById('mResume');
  if(savedGame && savedGame.state && !savedGame.state.gameOver) {
    if(resumeBtn) {
      resumeBtn.style.display = '';
      resumeBtn.disabled = false;
    }
  } else {
    if(resumeBtn) resumeBtn.style.display = 'none';
    ChessEngine.clearStorage();
  }

  // Build board and start
  showScreen('scrMenu');

  // Daily bonus
  const _profile = ProfilesManager.getCurrent();
  if(_profile && _profile.checkDailyBonus) {
    const got = _profile.checkDailyBonus();
    if(got) setTimeout(() => toast('🎁 Ежедневный бонус: +25 🪙'), 450);
  }

  refreshModeLabel();
  renderProfBar();
  renderCoins();
  renderStats();
  showRandomTip();

  // Load saved board theme
  if(cfg.board && BOARDS[cfg.board]) {
    const b = BOARDS[cfg.board];
    document.documentElement.style.setProperty('--sq-l', b.light);
    document.documentElement.style.setProperty('--sq-d', b.dark);
  }

  // === Button event listeners ===
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', fn);
  };

  // Main menu
  bind('mPlay', () => { showMultiplayerMenu(); });
  bind('mResume', () => resumeGame());
  bind('mModes', () => { showScreen('scrModes'); showModesList(); });
  bind('mShop', () => showScreen('scrShop'));
  bind('mLeaderboard', () => { showScreen('scrLeaderboard'); renderLeaderboard(); });
  bind('mSettings', () => showScreen('scrSet'));
  bind('helpBtn', () => { toast('Раздел помощи скоро будет доступен!'); });

  // Daily gift
  function updateGiftBtn() {
    const btn = document.getElementById('giftBtn');
    if(!btn) return;
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    if(isGuest) {
      btn.classList.add('disabled');
      btn.title = 'Войдите, чтобы получать ежедневные подарки';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = localStorage.getItem('chesher_daily_gift');
    if(lastClaim === today) {
      btn.classList.add('claimed');
      btn.classList.remove('disabled');
      btn.title = 'Уже получено сегодня!';
    } else {
      btn.classList.remove('claimed', 'disabled');
      btn.title = 'Забрать ежедневный подарок!';
    }
  }
  window.updateGiftBtn = updateGiftBtn;
  updateGiftBtn();

  bind('giftBtn', () => {
    const btn = document.getElementById('giftBtn');
    if(!btn || btn.classList.contains('disabled') || btn.classList.contains('claimed')) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = localStorage.getItem('chesher_daily_gift');
    if(lastClaim === today) { toast('Уже получено сегодня!'); return; }

    const coins = 25 + Math.floor(Math.random() * 26);
    const gems = Math.random() < 0.3 ? 1 : 0;

    localStorage.setItem('chesher_daily_gift', today);
    const cu = ProfilesManager.getCurrent();
    if(cu) {
      cu.coins = (cu.coins || 0) + coins;
      cu.gems = (cu.gems || 0) + gems;
      saveProfiles();
    }
    renderCoins();
    updateGiftBtn();
    toast('🎁 Ежедневный подарок: +' + coins + ' 🪙' + (gems ? ' +1 💎' : ''));
  });

  // === Friends panel ===
  let _fpOpen = false;
  let _fcOpen = false;
  let _fcChatUid = null;
  let _fcChatUnsub = null;

  function toggleFriendsPanel() {
    const panel = document.getElementById('friendsPanel');
    const chatPanel = document.getElementById('friendChatPanel');
    if(!panel) return;
    _fpOpen = !_fpOpen;
    if(_fpOpen) {
      if(chatPanel) chatPanel.classList.remove('open');
      _fcOpen = false;
      panel.classList.add('open');
      loadFriendsList();
      loadFriendRequests();
    } else {
      panel.classList.remove('open');
    }
  }

  async function loadFriendsList() {
    const list = document.getElementById('fpList');
    if(!list) return;
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    if(isGuest) { list.innerHTML = '<div class="fpEmpty">Войдите, чтобы видеть друзей</div>'; return; }

    list.innerHTML = '<div class="fpEmpty">Загрузка...</div>';
    try {
      const friends = await ChesFriends.getFriends();
      if(!friends.length) { list.innerHTML = '<div class="fpEmpty">Добавьте друзей, чтобы начать общение</div>'; return; }
      list.innerHTML = friends.map(f => {
        const chatId = [ChesAuth.getUid(), f.uid].sort().join('_');
        return '<div class="fpItem" data-uid="' + f.uid + '">' +
          '<div class="fpAva">' + f.ava + '</div>' +
          '<div class="fpInfo"><div class="fpNm">' + f.name + '</div>' +
          '<div class="fpSub">' + f.elo + ' эло</div></div>' +
          '<div class="fpOnline ' + (f.online ? 'on' : 'off') + '"></div>' +
          '<div class="fpActions">' +
            '<button class="fpChatBtn" data-uid="' + f.uid + '" data-name="' + f.name + '" title="Написать">💬</button>' +
            '<button class="fpRemoveBtn" data-uid="' + f.uid + '" data-name="' + f.name + '" title="Удалить">✕</button>' +
          '</div></div>';
      }).join('');

      list.querySelectorAll('.fpChatBtn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          openFriendChat(btn.dataset.uid, btn.dataset.name);
        });
      });
      list.querySelectorAll('.fpRemoveBtn').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          if(confirm('Удалить ' + btn.dataset.name + ' из друзей?')) {
            await ChesFriends.removeFriend(btn.dataset.uid);
            loadFriendsList();
            toast(btn.dataset.name + ' удалён из друзей');
          }
        });
      });
    } catch(e) {
      list.innerHTML = '<div class="fpEmpty">Ошибка загрузки</div>';
    }
  }

  async function loadFriendRequests() {
    const el = document.getElementById('fpRequests');
    if(!el) return;
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    if(isGuest) { el.innerHTML = ''; return; }

    try {
      const requests = await ChesFriends.getRequests();
      if(!requests.length) { el.innerHTML = ''; return; }
      el.innerHTML = requests.map(r =>
        '<div class="fpReqItem">' +
          '<div class="fpAva" style="font-size:20px">' + r.ava + '</div>' +
          '<div class="fpInfo"><div class="fpNm">' + r.name + '</div></div>' +
          '<div class="fpReqBtns">' +
            '<button class="fpAccept" data-uid="' + r.uid + '">✓</button>' +
            '<button class="fpReject" data-uid="' + r.uid + '">✕</button>' +
          '</div></div>'
      ).join('');

      el.querySelectorAll('.fpAccept').forEach(btn => {
        btn.addEventListener('click', async () => {
          await ChesFriends.acceptRequest(btn.dataset.uid);
          loadFriendsList();
          loadFriendRequests();
          toast('Заявка принята!');
        });
      });
      el.querySelectorAll('.fpReject').forEach(btn => {
        btn.addEventListener('click', async () => {
          await ChesFriends.rejectRequest(btn.dataset.uid);
          loadFriendRequests();
        });
      });
    } catch(e) { el.innerHTML = ''; }
  }

  function openFriendChat(uid, name) {
    const panel = document.getElementById('friendChatPanel');
    const fpPanel = document.getElementById('friendsPanel');
    const nameEl = document.getElementById('fcName');
    const statusEl = document.getElementById('fcStatus');
    const msgsEl = document.getElementById('fcMessages');
    if(!panel) return;

    _fcOpen = true;
    _fcChatUid = uid;
    if(fpPanel) fpPanel.classList.remove('open');
    _fpOpen = false;
    panel.classList.add('open');
    if(nameEl) nameEl.textContent = name;
    if(msgsEl) msgsEl.innerHTML = '<div class="fcEmpty">Загрузка...</div>';

    const chatId = [ChesAuth.getUid(), uid].sort().join('_');
    const chatRef = firebaseRtdb ? firebaseRtdb.ref('friendChats/' + chatId) : null;

    if(chatRef) {
      chatRef.limitToLast(50).on('value', snap => {
        const data = snap.val() || {};
        const msgs = Object.values(data).sort((a, b) => a.ts - b.ts);
        if(!msgsEl) return;
        if(!msgs.length) { msgsEl.innerHTML = '<div class="fcEmpty">Начните переписку!</div>'; return; }
        const myUid = ChesAuth.getUid();
        msgsEl.innerHTML = msgs.map(m => {
          const isMe = m.by === myUid;
          const t = new Date(m.ts);
          const time = t.getHours().toString().padStart(2,'0') + ':' + t.getMinutes().toString().padStart(2,'0');
          return '<div class="fcMsg ' + (isMe ? 'me' : 'them') + '">' +
            m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') +
            '<div class="fcMsgTime">' + time + '</div></div>';
        }).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
      });
      _fcChatUnsub = () => chatRef.off();
    }

    // Check online status
    if(firebaseRtdb) {
      firebaseRtdb.ref('status/' + uid).once('value').then(snap => {
        const st = snap.val();
        const online = st && (Date.now() - st.lastSeen < 60000);
        if(statusEl) {
          statusEl.textContent = online ? 'В сети' : 'Не в сети';
          statusEl.className = 'fcStatus ' + (online ? 'on' : '');
        }
      });
    }
  }

  function closeFriendChat() {
    const panel = document.getElementById('friendChatPanel');
    if(panel) panel.classList.remove('open');
    _fcOpen = false;
    if(_fcChatUnsub) { _fcChatUnsub(); _fcChatUnsub = null; }
    _fcChatUid = null;
  }

  async function sendFriendMessage() {
    const inp = document.getElementById('fcInput');
    if(!inp || !inp.value.trim() || !_fcChatUid) return;
    const txt = inp.value.trim();
    inp.value = '';

    const chatId = [ChesAuth.getUid(), _fcChatUid].sort().join('_');
    if(!firebaseRtdb) return;
    await firebaseRtdb.ref('friendChats/' + chatId).push({
      by: ChesAuth.getUid(),
      text: txt,
      ts: Date.now()
    });
  }

  // Bind friends panel
  bind('friendsFloatBtn', async () => {
    await ensureAuth();
    toggleFriendsPanel();
  });
  bind('fpClose', () => {
    const panel = document.getElementById('friendsPanel');
    if(panel) panel.classList.remove('open');
    _fpOpen = false;
  });
  bind('fpSearchBtn', async () => {
    const inp = document.getElementById('fpSearchInput');
    const box = document.getElementById('fpSearchResults');
    if(!inp || !box) return;
    const q = inp.value.trim();
    if(q.length < 2) { box.innerHTML = ''; box.classList.remove('hasItems'); return; }

    const results = await ChesFriends.search(q);
    const myUid = ChesAuth.getUid();
    const filtered = results.filter(r => r.uid !== myUid);
    if(!filtered.length) { box.innerHTML = '<div class="fpEmpty">Ничего не найдено</div>'; box.classList.add('hasItems'); return; }

    box.innerHTML = filtered.map(r =>
      '<div class="fpItem" data-uid="' + r.uid + '">' +
        '<div class="fpAva">' + r.ava + '</div>' +
        '<div class="fpInfo"><div class="fpNm">' + r.name + '</div>' +
        '<div class="fpSub">' + r.elo + ' эло</div></div>' +
        '<div class="fpActions"><button class="fpAddBtn" data-uid="' + r.uid + '" data-name="' + r.name + '">+ Друг</button></div>' +
      '</div>'
    ).join('');
    box.classList.add('hasItems');

    box.querySelectorAll('.fpAddBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await ChesFriends.sendRequest(btn.dataset.uid);
        toast('Заявка отправлена ' + btn.dataset.name);
        btn.textContent = '✓ Отправлено';
        btn.disabled = true;
      });
    });
  });
  bind('fcBack', closeFriendChat);
  bind('fcClose', closeFriendChat);
  bind('fcSend', sendFriendMessage);
  const fcInp = document.getElementById('fcInput');
  if(fcInp) fcInp.addEventListener('keydown', e => { if(e.key === 'Enter') sendFriendMessage(); });

  // Hide friends panel on non-menu screens
  const _origShowScreen = showScreen;
  const _friendsPanelHide = () => {
    const fp = document.getElementById('friendsPanel');
    const fc = document.getElementById('friendChatPanel');
    if(fp) fp.classList.remove('open');
    if(fc) fc.classList.remove('open');
    _fpOpen = false;
    _fcOpen = false;
  };

  bind('mFriends', async () => {
    await ensureAuth();
    showScreen('scrFriends');
    NetUI._loadFriends();
  });
  bind('profBar', () => showScreen('scrProf'));

  // Multiplayer menu
  bind('mpCreateBtn', async () => {
    await ensureAuth();
    showScreen('scrLobbySetup');
    renderLobbySetup();
  });
  bind('mpJoinBtn', async () => {
    const code = prompt('Введите код лобби:');
    if(!code) return;
    await ensureAuth();
    NetUI._joinByCode(code.trim());
  });
  bind('mpFriendsBtn', async () => {
    await ensureAuth();
    showScreen('scrFriends');
    NetUI._loadFriends();
  });
  bind('mpRandomBtn', () => {
    toast('Случайный матч — скоро!');
  });

  // Game screen
  bind('btnNew', () => { askConfirm('Новая игра?', 'Текущая партия будет потеряна', () => { newGame(); hideAllScreens(); }); });
  bind('btnGoMenu', () => { showScreen('scrMenu'); });
  bind('btnSet', () => showScreen('scrSet'));
  bind('btnHint', () => showHint());
  bind('btnUndo', () => undoMove());
  bind('btnRes', () => resignGame());
  bind('btnDraw', () => offerDraw());

  // Game over overlay
  bind('overNew', () => { closeAllOverlays(); newGame(); hideAllScreens(); });
  bind('overMenu', () => { closeAllOverlays(); showScreen('scrMenu'); });

  // Settings
  bind('setApply', () => { saveCfg(); newGame(); hideAllScreens(); });
  bind('btnReset', () => { if(window.Settings) Settings.resetAllData(); });

  // Modes start button
  bind('modesStart', () => {
    const customTimeEl = document.getElementById('customTime');
    const timeInputDiv = document.getElementById('timeInput');
    if(timeInputDiv && timeInputDiv.style.display !== 'none' && customTimeEl) {
      const customMinutes = parseInt(customTimeEl.value);
      if(customMinutes >= 1 && customMinutes <= 60) {
        cfg.timeSec = customMinutes * 60;
      }
    }
    saveCfg();
    newGame();
    hideAllScreens();
  });

  // Bot selection start button
  bind('botsStart', () => {
    if(!selectedBotId) { toast('Выберите бота'); return; }
    const cu = ProfilesManager.getCurrent();
    if(cu) cu.botId = selectedBotId;
    if(cfg.bot === 'off') cfg.bot = 'medium';
    saveProfiles();
    saveCfg();
    newGame();
    hideAllScreens();
  });

  // Profile
  bind('npCreate', () => {
    const inp = document.getElementById('npName');
    const name = inp ? inp.value.trim() : '';
    if(!name) { toast('Введите имя'); return; }
    const selectedAva = document.querySelector('#emoGrid .emo.sel');
    const avaIdx = selectedAva ? parseInt(selectedAva.dataset.idx) : Math.floor(Math.random() * DEFAULT_AVATARS.length);
    ProfilesManager.newProfile(name, avaIdx);
    renderProfScr();
    renderProfBar();
    if(inp) inp.value = '';
    toast('Профиль создан');
  });

  // Avatar grid
  const emoGrid = document.getElementById('emoGrid');
  if(emoGrid) {
    DEFAULT_AVATARS.forEach((ava, i) => {
      const d = document.createElement('div');
      d.className = 'emo' + (i === 0 ? ' sel' : '');
      d.textContent = ava;
      d.dataset.idx = i;
      d.addEventListener('click', () => {
        emoGrid.querySelectorAll('.emo').forEach(e => e.classList.remove('sel'));
        d.classList.add('sel');
      });
      emoGrid.appendChild(d);
    });
  }

  // Chat
  bind('chatSend', () => { if(window.Chat) Chat.sendChat(); });
  const chatInp = document.getElementById('chatInput');
  if(chatInp) chatInp.addEventListener('keydown', e => {
    if(e.key === 'Enter') { e.preventDefault(); if(window.Chat) Chat.sendChat(); }
  });

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(b => {
    b.addEventListener('click', () => {
      const currentScreen = document.querySelector('.screen.show');
      if(currentScreen && currentScreen.id === 'scrBots') {
        showScreen('scrModes');
        showModesList();
      } else {
        const modesCfg = document.getElementById('modesCfg');
        if(modesCfg && modesCfg.style.display !== 'none') {
          showModesList();
        } else {
          showScreen('scrMenu');
        }
      }
    });
  });

  /* === DEV BLOG === */
  let DEVLOG = [];

  async function loadDevlog() {
    try {
      const res = await fetch('version.json?t=' + Date.now());
      DEVLOG = await res.json();
    } catch(e) {
      DEVLOG = [];
    }
  }

  function renderDevblog() {
    const wrap = document.getElementById('dbWrap');
    if(!wrap) return;
    if(!DEVLOG.length) {
      wrap.innerHTML = '<div style="text-align:center;color:var(--mut);padding:40px">Загрузка...</div>';
      loadDevlog().then(() => renderDevblog());
      return;
    }
    wrap.innerHTML = '';
    DEVLOG.forEach(entry => {
      const div = document.createElement('div');
      div.className = 'dbEntry';
      div.innerHTML = '<div class="dbVer">' + entry.ver + '</div>' +
        '<div class="dbDate">' + entry.date + '</div>' +
        '<ul class="dbList">' + 
        entry.items.map(item => '<li>' + item + '</li>').join('') +
        '</ul>';
      wrap.appendChild(div);
    });
  }

  const devblogBtn = document.getElementById('devblogBtn');
  if(devblogBtn) {
    devblogBtn.addEventListener('click', () => {
      snd.ui();
      renderDevblog();
      showScreen('scrDevblog');
    });
  }

  // Cheat button (dev tools) — triple-click devblog OR coins to toggle
  let dbClicks = 0, dbTimer = null;
  const cheatBtn = document.getElementById('cheatBtn');
  const cheatPanel = document.getElementById('cheatPanel');
  function toggleCheatBtn() {
    if(!cheatBtn) return;
    cheatBtn.style.display = cheatBtn.style.display === 'none' ? '' : 'none';
  }
  if(devblogBtn && cheatBtn) {
    devblogBtn.addEventListener('click', () => {
      dbClicks++;
      clearTimeout(dbTimer);
      dbTimer = setTimeout(() => { dbClicks = 0; }, 500);
      if(dbClicks >= 3) { dbClicks = 0; toggleCheatBtn(); }
    });
    cheatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if(cheatPanel) cheatPanel.classList.toggle('show');
    });
  }
  const pbCoinsEl = document.getElementById('pbCoins');
  let coinClicks = 0, coinTimer = null;
  if(pbCoinsEl) {
    pbCoinsEl.addEventListener('click', () => {
      coinClicks++;
      clearTimeout(coinTimer);
      coinTimer = setTimeout(() => { coinClicks = 0; }, 500);
      if(coinClicks >= 3) {
        coinClicks = 0;
        toggleCheatBtn();
        if(cheatPanel) cheatPanel.classList.add('show');
      }
    });
  }

  // Firebase init
  if(typeof initFirebase === 'function') {
    if(initFirebase()) {
      ChesAuth.init();
      NetUI.init();
      ChesAuth.onAuthChange(() => { if(typeof updateGiftBtn === 'function') updateGiftBtn(); });
    }
  }

  // Show auth screen on first visit
  const hasVisited = localStorage.getItem('chesher_visited');
  if(!hasVisited && ChesAuth && !ChesAuth.user) {
    localStorage.setItem('chesher_visited', '1');
    showScreen('scrAuth');
  }

  console.log('CHESHER v0.18.0 alpha — инициализация завершена');
});
