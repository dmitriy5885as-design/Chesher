/**
 * ЧЕШЕР — Пользовательский интерфейс
 * Отрисовка доски, фигур, подсветка, модалки
 */
"use strict";

const elements = {
  gridEl: null,
  piecesEl: null,
  sqEls: null,
  boardBox: null,
  statusLine: null
};

/* --- Инициализация ссылок на DOM --- */
function initDOMrefs() {
  elements.gridEl = document.getElementById('grid');
  elements.piecesEl = document.getElementById('pieces');
  elements.boardBox = document.getElementById('boardBox');
  elements.statusLine = document.getElementById('statusLine');
}

/* --- Построение клеток доски --- */
function buildGrid() {
  if(!elements.gridEl) initDOMrefs();
  if(!elements.gridEl) return;
  elements.gridEl.innerHTML = '';
  elements.sqEls = [];

  const coordsEl = document.getElementById('coords');
  if(coordsEl) coordsEl.innerHTML = '';

  for(let r = 0; r < 8; r++) {
    elements.sqEls[r] = [];
    for(let c = 0; c < 8; c++) {
      const d = document.createElement('div');
      d.className = 'sq ' + ((r + c) % 2 === 0 ? 'l' : 'd');
      d.dataset.r = r;
      d.dataset.c = c;
      d.addEventListener('click', onSquareClick);
      elements.gridEl.appendChild(d);
      elements.sqEls[r][c] = d;
    }
  }

  if(!coordsEl) return;
  const flipped = document.getElementById('boardBox') && document.getElementById('boardBox').classList.contains('flipped');
  const sz = 'calc(var(--bsz) / 8)';

  for(let i = 0; i < 8; i++) {
    const rank = document.createElement('span');
    rank.className = 'coordR';
    rank.textContent = flipped ? String(i + 1) : String(8 - i);
    rank.style.top = 'calc(' + sz + ' * ' + i + ' + 2px)';
    coordsEl.appendChild(rank);

    const file = document.createElement('span');
    file.className = 'coordF';
    file.textContent = flipped ? FILES[7 - i] : FILES[i];
    file.style.left = 'calc(' + sz + ' * ' + i + ')';
    coordsEl.appendChild(file);
  }
}

/* --- Создание фигуры --- */
function spawnPiece(pieceChar, r, c) {
  if(!elements.piecesEl) initDOMrefs();
  if(!elements.piecesEl) return;
  const color = pieceChar === pieceChar.toUpperCase() ? 'w' : 'b';
  const type = pieceChar.toLowerCase();
  const el = document.createElement('div');
  el.className = 'piece ' + color;
  el.textContent = getSkinGlyph(color, type);
  el.style.left = (c * 12.5) + '%';
  el.style.top = (r * 12.5) + '%';
  el.style.width = '12.5%';
  el.style.height = '12.5%';
  elements.piecesEl.appendChild(el);
  return el;
}

/* --- Полная отрисовка --- */
function fullRender() {
  if(!elements.piecesEl) initDOMrefs();
  if(!elements.piecesEl) return;
  elements.piecesEl.innerHTML = '';
  if(!S) return;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      const p = S.board[r][c];
      if(p) spawnPiece(p, r, c);
    }
  }
  paintMarks();
  refreshBars();
}

/* --- Подсветка полей --- */
function paintMarks() {
  if(!elements.sqEls) return;
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      const sq = elements.sqEls[r][c];
      if(sq) sq.classList.remove('last','sel','dot','cap-dot','chk','hintF','hintT');
    }
  }

  if(lastMove && elements.sqEls[lastMove.fr] && elements.sqEls[lastMove.fr][lastMove.fc]) {
    elements.sqEls[lastMove.fr][lastMove.fc].classList.add('last');
    elements.sqEls[lastMove.tr][lastMove.tc].classList.add('last');
  }

  if(S) {
    const k = findKing(S.board, S.turn);
    if(k && S.inCheck(S.turn)) {
      elements.sqEls[k.r][k.c].classList.add('chk');
    }
  }

  if(selected && elements.sqEls[selected.r] && elements.sqEls[selected.r][selected.c]) {
    elements.sqEls[selected.r][selected.c].classList.add('sel');
    if(legalCache) {
      for(const m of legalCache) {
        if(m.fr === selected.r && m.fc === selected.c) {
          const targetSq = elements.sqEls[m.tr] && elements.sqEls[m.tr][m.tc];
          if(targetSq) {
            const hasPiece = S.board[m.tr][m.tc];
            targetSq.classList.add(hasPiece || m.ep ? 'cap-dot' : 'dot');
          }
        }
      }
    }
  }

  if(hintMove && elements.sqEls[hintMove.fr] && elements.sqEls[hintMove.fr][hintMove.fc]) {
    elements.sqEls[hintMove.fr][hintMove.fc].classList.add('hintF');
    elements.sqEls[hintMove.tr][hintMove.tc].classList.add('hintT');
  }
}

/* --- Обновление панелей --- */
function refreshBars() {
  const humanCol = cfg.gameMode === 'local' && S ? S.turn : (S ? S.humanColor : cfg.human);
  const topCol = humanCol === 'w' ? 'b' : 'w';
  const elNameTop = document.getElementById('nameTop');
  const elNameBot = document.getElementById('nameBot');
  const elAvaTop = document.getElementById('avaTop');
  const elNmTop = document.getElementById('nmTop');

  const cu = ProfilesManager.getCurrent();
  const botId = cu ? (cu.botId || 1) : 1;
  const bot = BOT_LIST.find(b => b.id === botId);

  if(cfg.gameMode === 'local' && S) {
    const myLabel = humanCol === 'w' ? 'Игрок 1 (⚪)' : 'Игрок 2 (⚫)';
    const oppLabel = topCol === 'w' ? 'Игрок 1 (⚪)' : 'Игрок 2 (⚫)';
    if(elNameTop) elNameTop.textContent = oppLabel;
    if(elAvaTop) elAvaTop.textContent = topCol === 'w' ? '⚪' : '⚫';
    if(elNmTop) elNmTop.textContent = oppLabel;
  } else if(cfg.bot !== 'off' && bot) {
    if(elNameTop) elNameTop.textContent = bot.emoji + ' ' + bot.name;
    if(elAvaTop) elAvaTop.textContent = bot.emoji;
    if(elNmTop) elNmTop.textContent = bot.name;
  } else if(cfg.gameMode === 'multiplayer' && typeof ChesMP !== 'undefined' && ChesMP.opponent) {
    const opp = ChesMP.opponent;
    if(elNameTop) elNameTop.textContent = (opp.ava || '❓') + ' ' + (opp.name || 'Соперник');
    if(elAvaTop) elAvaTop.textContent = opp.ava || '❓';
    if(elNmTop) elNmTop.textContent = opp.name || 'Соперник';
  } else {
    const oppName = (topCol === 'w' ? 'Белые' : 'Чёрные') + ' · Соперник';
    const oppId = (typeof S !== 'undefined' && S && S.opponentPlayerId) ? '  #' + S.opponentPlayerId : '';
    if(elNameTop) elNameTop.textContent = oppName + oppId;
    if(elAvaTop) elAvaTop.textContent = '🤖';
    if(elNmTop) elNmTop.textContent = 'Соперник';
  }

  // subTop: opponent captured pieces
  const subTop = document.getElementById('subTop');
  const subBot = document.getElementById('subBot');
  const tW = (takenByW || []).map(t => getSkinGlyph('w', t)).join('');
  const tB = (takenByB || []).map(t => getSkinGlyph('b', t)).join('');
  if(subTop) {
    subTop.textContent = topCol === 'w' ? tW : tB;
    if(!subTop.textContent.trim()) subTop.textContent = '';
  }

  const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
  let myName, myAva;
  if(cfg.gameMode === 'local' && S) {
    myName = humanCol === 'w' ? 'Игрок 1' : 'Игрок 2';
    myAva = humanCol === 'w' ? '⚪' : '⚫';
  } else {
    myName = isGuest ? ((cu.name && cu.name !== 'Гость') ? cu.name : 'Гость') : (cu.name || 'Игрок');
    myAva = isGuest ? '👽' : (cu.ava || '👽');
  }
  const playerPid = isGuest ? ChesAuth.guestPlayerId : cu.playerId;
  if(elNameBot) elNameBot.textContent = myAva + ' ' + myName + ' · ' + (humanCol === 'w' ? 'Белые' : 'Чёрные') + (playerPid ? '  #' + playerPid : '');

  // Update avatar in player card
  const elAvaBot = document.getElementById('avaBot');
  const elNmBot = document.getElementById('nmBot');
  if(elAvaBot) {
    if(!isGuest && cu.customAva) {
      elAvaBot.innerHTML = '<img src="' + cu.customAva + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      elAvaBot.textContent = myAva;
    }
  }
  if(elNmBot) elNmBot.textContent = myName;

  // subBot: my captured pieces
  if(subBot) {
    subBot.textContent = humanCol === 'w' ? tW : tB;
    if(!subBot.textContent.trim()) subBot.textContent = '';
  }

  // Taken pieces in pbar (opponent bar shows what opponent captured, my bar shows what I captured)
  const elTakTop = document.getElementById('takTop');
  const elTakBot = document.getElementById('takBot');
  if(elTakTop) elTakTop.textContent = topCol === 'w' ? tW : tB;
  if(elTakBot) elTakBot.textContent = humanCol === 'w' ? tW : tB;

  // Material advantage
  const mat = (takenByW || []).reduce((s, t) => s + (VAL[t]||0), 0) -
              (takenByB || []).reduce((s, t) => s + (VAL[t]||0), 0);
  const advTop = topCol === 'w' ? mat : -mat;
  const elAdvTop = document.getElementById('advTop');
  const elAdvBot = document.getElementById('advBot');
  if(elAdvTop) elAdvTop.textContent = advTop > 0 ? '+' + advTop : '';
  if(elAdvBot) elAdvBot.textContent = (-advTop > 0) ? '+' + (-advTop) : '';

  updateClockUI();
}

function updateClockUI() {
  if(!S) return;
  const elTop = document.getElementById('clkTop');
  const elBot = document.getElementById('clkBot');
  const humanCol = S.humanColor || cfg.human;
  const topCol = humanCol === 'w' ? 'b' : 'w';
  const formatTime = (sec) => {
    if(!sec || sec <= 0) return '∞';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  };
  if(elTop) {
    elTop.textContent = formatTime(S.time ? S.time[topCol] : 0);
    elTop.classList.toggle('on', S.turn === topCol);
    elTop.classList.toggle('low', S.time && (S.time[topCol] || 0) < 30 && (S.time[topCol] || 0) > 0);
  }
  if(elBot) {
    elBot.textContent = formatTime(S.time ? S.time[humanCol] : 0);
    elBot.classList.toggle('on', S.turn === humanCol);
    elBot.classList.toggle('low', S.time && (S.time[humanCol] || 0) < 30 && (S.time[humanCol] || 0) > 0);
  }
}

/* --- Обновление метки режима --- */
function refreshModeLabel() {
  const modeId = cfg.modeId || 'classic';
  const m = (MODES || []).find(x => x.id === modeId) || MODES[0];
  if(!m) return;
  const modeLabel = document.getElementById('modeLabel');
  if(modeLabel) modeLabel.innerHTML = '<b>' + m.icon + ' ' + m.name + '</b><br>' + m.desc;
}

/* --- Монеты --- */
function renderCoins() {
  const cu = ProfilesManager.getCurrent();
  const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
  const c = isGuest ? 0 : (cu ? (cu.coins || 0) : 0);
  const g = isGuest ? 0 : (cu ? (cu.gems || 0) : 0);
  const a = document.getElementById('pbCoins');
  const b = document.getElementById('shopCoins');
  const ag = document.getElementById('pbGems');
  const sg = document.getElementById('shopGems');
  if(a) a.textContent = '🪙 ' + c;
  if(b) b.textContent = '🪙 ' + c;
  if(ag) ag.textContent = '💎 ' + g;
  if(sg) sg.textContent = '💎 ' + g;
}

/* --- Статистика --- */
function renderStats() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  const st = cu.st || {};
  const g = document.getElementById('stG');
  const w = document.getElementById('stW');
  const pc = document.getElementById('stPct');
  const ls = document.getElementById('stLast');
  if(g) g.textContent = st.games || 0;
  if(w) w.textContent = st.wins || 0;
  if(pc) pc.textContent = (st.games ? Math.round(st.wins / st.games * 100) : 0) + '%';
  if(ls) ls.textContent = st.lastResult || '—';
}

/* --- Панель профиля --- */
function renderProfBar() {
  const cu = ProfilesManager.getCurrent();
  if(!cu) return;
  const pbAva = document.getElementById('pbAva');
  const pbName = document.getElementById('pbName');
  const pbSub = document.getElementById('pbSub');
  const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
  if(pbAva) {
    if(!isGuest && cu.customAva) {
      pbAva.innerHTML = '<img src="' + cu.customAva + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else {
      pbAva.textContent = isGuest ? '👽' : (cu.ava || '👽');
    }
  }
  if(isGuest) {
    if(!ChesAuth.guestPlayerId) ChesAuth.guestPlayerId = ChesAuth._genGuestPlayerId();
    if(pbName) pbName.textContent = (cu.name && cu.name !== 'Гость') ? cu.name : 'Гость';
    if(pbSub) pbSub.innerHTML = '<span style="color:var(--accent);font-size:10px">#' + ChesAuth.guestPlayerId + '</span>';
  } else {
    if(pbName) pbName.innerHTML = (cu.name || 'Игрок') + (cu.admin ? ' <span title="Администратор" style="color:var(--accent);font-size:11px">⭐</span>' : '');
    if(pbSub) pbSub.innerHTML = (cu.playerId ? '<span style="color:var(--accent);font-size:10px">#' + cu.playerId + '</span> · ' : '') + (cu.winrate || 0) + '% winrate · ' + (cu.st.games || 0) + ' партий';
  }
}

/* --- Экран профилей --- */
function renderProfScr() {
  const cu = ProfilesManager.getCurrent();

  // Profile tabs
  const profTabs = document.getElementById('profTabs');
  if(profTabs) {
    profTabs.onclick = function(e) {
      const tab = e.target.closest('.shopTab');
      if(!tab) return;
      snd.ui();
      const t = tab.dataset.tab;
      profTabs.querySelectorAll('.shopTab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
      document.getElementById('profTabMain').style.display = t === 'main' ? '' : 'none';
      document.getElementById('profTabStyle').style.display = t === 'style' ? '' : 'none';
      document.getElementById('profTabHistory').style.display = t === 'history' ? '' : 'none';
      document.getElementById('profTabSettings').style.display = t === 'settings' ? '' : 'none';
      if(t === 'style') renderProfStyleTab();
      if(t === 'history') renderMatchHistory(cu);
      if(t === 'settings') renderProfSettings(cu);
    };
  }

  // Reset to main tab
  if(profTabs) profTabs.querySelectorAll('.shopTab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'main'));
  const pm = document.getElementById('profTabMain'); if(pm) pm.style.display = '';
  const pStyle = document.getElementById('profTabStyle'); if(pStyle) pStyle.style.display = 'none';
  const ph = document.getElementById('profTabHistory'); if(ph) ph.style.display = 'none';
  const ps = document.getElementById('profTabSettings'); if(ps) ps.style.display = 'none';

  // Guest: show nick (1-time) + avatar; Authenticated: show nick + avatar normally
  const nickGroup = document.getElementById('nickGroup');
  const avaGroup = document.getElementById('customAvaGroup');
  const isGuestProf = !ChesAuth.user || ChesAuth.user.isAnonymous;

  if(isGuestProf) {
    // Guest nick: 1-time only
    if(nickGroup) nickGroup.style.display = '';
    const guestNameChanged = localStorage.getItem('chesher_guest_name_changed');
    const nickTitle = nickGroup ? nickGroup.querySelector('h3') : null;
    if(guestNameChanged) {
      if(nickTitle) nickTitle.textContent = '✏️ Имя (уже использовано)';
      const nickInputEl = document.getElementById('nickInput');
      const nickBtnEl = document.getElementById('nickChangeBtn');
      if(nickInputEl) { nickInputEl.disabled = true; nickInputEl.placeholder = 'Имя уже задано'; }
      if(nickBtnEl) { nickBtnEl.disabled = true; nickBtnEl.textContent = '✓ Задано'; }
    } else {
      if(nickTitle) nickTitle.textContent = '✏️ Имя (только 1 раз!)';
      const nickWarn = document.getElementById('nickCooldown');
      if(nickWarn) nickWarn.innerHTML = '<span style="color:var(--gold)">⚠ Сменить имя можно только один раз. Выбирайте с умом!</span>';
    }
    // Guest: hide file upload, show only suggested avatars
    if(avaGroup) {
      const fileLabel = avaGroup.querySelector('label[for]');
      const fileInput = document.getElementById('customAvaInput');
      const fileHint = avaGroup.querySelector('div[style*="font-size:11px"]');
      if(fileLabel && fileLabel.querySelector('input[type="file"]')) fileLabel.style.display = 'none';
      if(fileInput) fileInput.closest('label') ? fileInput.closest('label').style.display = 'none' : null;
      // Hide the file size hint text
      if(fileHint) fileHint.style.display = 'none';
      // Also hide the save button area for file uploads (keep clear for suggested)
      const saveBtn = document.getElementById('customAvaSave');
      if(saveBtn) saveBtn.style.display = 'none';
      // Update title
      const avaTitle = avaGroup.querySelector('h3');
      if(avaTitle) avaTitle.textContent = '🖼 Аватарка';
    }
  } else {
    if(nickGroup) nickGroup.style.display = '';
    if(avaGroup) avaGroup.style.display = '';
  }

  // Show playerId in profile header
  const profHeader = document.getElementById('profHeader');
  if(profHeader) {
    const isGuestProf = !ChesAuth.user || ChesAuth.user.isAnonymous;
    const displayId = isGuestProf ? ChesAuth.guestPlayerId : (cu && cu.playerId);
    if(displayId) {
      profHeader.innerHTML = '<div style="text-align:center;padding:8px;margin-bottom:8px;background:var(--panel2);border-radius:10px;border:1px solid var(--line)">' +
        '<div style="color:var(--mut);font-size:11px;margin-bottom:2px">' + (isGuestProf ? 'Гостевой ID' : 'Ваш ID') + '</div>' +
        '<div style="font-size:18px;font-weight:700;color:var(--accent);letter-spacing:1px">#' + displayId + '</div>' +
        '<div style="color:var(--mut);font-size:10px;margin-top:2px">' + (isGuestProf ? 'Сменяется при обновлении' : 'Используйте для добавления в друзья') + '</div>' +
        '</div>';
    } else {
      profHeader.innerHTML = '';
    }
  }

  // Nick change UI
  const nickInput = document.getElementById('nickInput');
  const nickBtn = document.getElementById('nickChangeBtn');
  const nickCd = document.getElementById('nickCooldown');
  const isGuestProfile = !ChesAuth.user || ChesAuth.user.isAnonymous;
  const guestNameUsed = isGuestProfile && localStorage.getItem('chesher_guest_name_changed');
  if(cu && nickBtn) {
    if(guestNameUsed) {
      nickBtn.disabled = true;
      nickBtn.textContent = '✓ Задано';
      nickInput.disabled = true;
      nickInput.value = cu.name || '';
      if(nickCd) nickCd.innerHTML = '<span style="color:var(--mut)">Имя уже задано</span>';
    } else {
      const cooldown = cu.getNickChangeCooldown();
      if(!isGuestProfile && cooldown) {
        nickBtn.disabled = true;
        nickBtn.textContent = '⏳';
        if(nickCd) nickCd.textContent = 'Следующая смена через: ' + cooldown;
      } else {
        nickBtn.disabled = false;
        nickBtn.textContent = isGuestProfile ? 'Задать имя' : 'Изменить';
        if(nickCd && !isGuestProfile) nickCd.textContent = '';
      }
    }
    nickBtn.onclick = () => {
      if(guestNameUsed) { toast('Имя уже задано — его нельзя изменить'); return; }
      const name = nickInput.value.trim();
      if(!name) { toast('Введите ник'); return; }
      if(name.length < 2) { toast('Минимум 2 символа'); return; }
      if(isGuestProfile && !confirm('Вы уверены? Имя можно задать только ОДИН раз!')) return;
      if(cu.changeNick(name)) {
        if(isGuestProfile) {
          localStorage.setItem('chesher_guest_name_changed', '1');
        }
        saveProfiles();
        if(ChesAuth && ChesAuth.user && !ChesAuth.user.isAnonymous) {
          ChesAuth.updateProfile({ name: name });
        }
        renderProfScr();
        renderProfBar();
        toast('Имя задано: "' + name + '"');
        nickInput.value = '';
      }
    };
  }

  // Custom avatar upload
  const avaPreview = document.getElementById('customAvaPreview');
  const avaInput = document.getElementById('customAvaInput');
  const avaClear = document.getElementById('customAvaClear');
  const avaSave = document.getElementById('customAvaSave');
  const avaSuggested = document.getElementById('avaSuggested');
  let pendingAva = null;

  if(cu && avaInput) {
    if(cu.customAva) {
      avaPreview.innerHTML = '<img src="' + cu.customAva + '" style="width:100%;height:100%;object-fit:cover">';
      avaClear.style.display = '';
    } else {
      avaPreview.innerHTML = cu.ava || '👽';
      avaClear.style.display = 'none';
    }
    avaSave.style.display = 'none';

    // Suggested avatars
    const suggested = ['👽','👽','🦊','🐸','🐼','🦁','🐺','🦉','🐙','🦄','🐲','🤖','💀','🎃','♔','♞','🐶','🐱','🐵','🦅','🐬','🦋','🌸','🔥','💎','🎯','🚀','⚡','🌈','🍕','🎸','👑','🏆','♟'];
    if(avaSuggested) {
      avaSuggested.innerHTML = '';
      suggested.forEach(em => {
        const btn = document.createElement('button');
        btn.className = 'suggestedAva';
        btn.textContent = em;
        btn.style.cssText = 'width:40px;height:40px;font-size:20px;border-radius:50%;border:2px solid var(--line);background:var(--panel2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .2s';
        btn.onmouseenter = () => btn.style.borderColor = 'var(--accent)';
        btn.onmouseleave = () => btn.style.borderColor = 'var(--line)';
        btn.onclick = () => {
          cu.ava = em;
          cu.customAva = null;
          saveProfiles();
          if(ChesAuth && ChesAuth.user && !ChesAuth.user.isAnonymous) {
            ChesAuth.updateProfile({ ava: em, customAva: null });
          }
          avaPreview.innerHTML = em;
          avaClear.style.display = 'none';
          avaSave.style.display = 'none';
          renderProfScr();
          renderProfBar();
          toast('Аватарка: ' + em);
        };
        avaSuggested.appendChild(btn);
      });
    }

    avaInput.onchange = (e) => {
      const file = e.target.files[0];
      if(!file) return;
      if(file.size > 2 * 1024 * 1024) { toast('Файл слишком большой (макс 2МБ)'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 256;
          let w = img.width, h = img.height;
          if(w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.beginPath();
          ctx.arc(w/2, h/2, w/2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, w, h);
          const quality = file.size > 1024 * 1024 ? 0.5 : 0.7;
          pendingAva = canvas.toDataURL('image/jpeg', quality);
          avaPreview.innerHTML = '<img src="' + pendingAva + '" style="width:100%;height:100%;object-fit:cover">';
          avaSave.style.display = '';
          avaClear.style.display = '';
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };

    if(avaSave) {
      avaSave.onclick = () => {
        if(!pendingAva) return;
        cu.customAva = pendingAva;
        saveProfiles();
        if(ChesAuth && ChesAuth.user && !ChesAuth.user.isAnonymous) {
          ChesAuth.updateProfile({ customAva: pendingAva });
        }
        avaSave.style.display = 'none';
        pendingAva = null;
        renderProfBar();
        toast('Аватарка сохранена!');
      };
    }

    if(avaClear) {
      avaClear.onclick = () => {
        cu.customAva = null;
        cu.ava = '👽';
        pendingAva = null;
        saveProfiles();
        if(ChesAuth && ChesAuth.user && !ChesAuth.user.isAnonymous) {
          ChesAuth.updateProfile({ customAva: null, ava: '👽' });
        }
        avaPreview.innerHTML = '👽';
        avaClear.style.display = 'none';
        avaSave.style.display = 'none';
        renderProfScr();
        renderProfBar();
        toast('Аватарка удалена');
      };
    }
  }
}

/* --- Модалка превращения --- */
function openPromoModal() {
  if(!S || !pendingPromo) return;
  const tr = pendingPromo.tr, tc = pendingPromo.tc;
  const sqDark = (tr + tc) % 2 === 1;
  const color = S.turn;
  const promoPs = document.querySelectorAll('.promoP');
  promoPs.forEach(el => {
    el.textContent = getSkinGlyph(color, el.dataset.p);
    el.classList.toggle('darkset', sqDark);
  });
  openOv('ovPr');
}

document.querySelectorAll('.promoP').forEach(el => {
  el.addEventListener('click', () => {
    closeOv('ovPr');
    if(pendingPromo) {
      const m = pendingPromo;
      pendingPromo = null;
      snd.promo();
      applyReal(m, el.dataset.p);
    }
  });
});

/* --- Overlays --- */
function closeAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show'));
}

function closeOv(id) {
  const ov = document.getElementById(id);
  if(ov) ov.classList.remove('show');
}

function openOv(id) {
  closeAllOverlays();
  const ov = document.getElementById(id);
  if(ov) ov.classList.add('show');
}

document.querySelectorAll('[data-close]').forEach(b => {
  b.addEventListener('click', () => closeOv(b.dataset.close));
});

document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => {
    if(e.target === o) o.classList.remove('show');
  });
});

/* --- Подтверждение --- */
function askConfirm(t, x, yes) {
  const confT = document.getElementById('confT');
  const confX = document.getElementById('confX');
  const confY = document.getElementById('confY');
  if(confT) confT.textContent = t;
  if(confX) confX.textContent = x;
  const handler = function() {
    confY.removeEventListener('click', handler);
    closeOv('ovConf');
    yes();
  };
  confY.addEventListener('click', handler);
  openOv('ovConf');
}

/* --- Тост --- */
let toastT = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2000);
}

window.toast = toast;
window.fullRender = fullRender;
window.paintMarks = paintMarks;
window.buildGrid = buildGrid;
window.initDOMrefs = initDOMrefs;
window.refreshBars = refreshBars;
window.refreshModeLabel = refreshModeLabel;
window.renderCoins = renderCoins;

/* --- Вкладка: Стилизация --- */
function applyBoardTheme(id) {
  if(!BOARDS[id]) return;
  const b = BOARDS[id];
  document.documentElement.style.setProperty('--sq-l', b.light);
  document.documentElement.style.setProperty('--sq-d', b.dark);
}
function renderProfStyleTab() {
  const cu = ProfilesManager.getCurrent();
  const owned = cu ? cu.owned || [] : [];

  // Board themes
  const themeRow = document.getElementById('themeRow');
  if(themeRow) {
    themeRow.innerHTML = '';
    Object.keys(BOARDS).forEach(id => {
      const b = BOARDS[id];
      const isOwned = owned.includes('board_' + id) || b.price === 0;
      const isActive = cfg.board === id || (!cfg.board && id === 'classic');
      const w = document.createElement('button');
      w.className = 'swatch' + (isActive ? ' sel' : '');
      w.type = 'button';
      w.style.setProperty('--swL', b.light);
      w.style.setProperty('--swD', b.dark);
      w.style.opacity = isOwned ? '1' : '0.4';
      w.innerHTML = '<i></i><i></i><i></i><i></i><span class="swName">' + b.name + '</span>';
      if(!isOwned) w.innerHTML += '<span style="font-size:10px;color:var(--gold)">🪙 ' + b.price + '</span>';
      w.addEventListener('click', () => {
        if(!isOwned) { toast('Купите доску в магазине'); return; }
        cfg.board = id;
        saveCfg();
        applyBoardTheme(id);
        snd.ui();
        renderProfStyleTab();
      });
      themeRow.appendChild(w);
    });
  }

  // Piece skins
  const segSkinProf = document.getElementById('segSkinProf');
  if(segSkinProf && typeof SKINS !== 'undefined') {
    segSkinProf.innerHTML = '';
    const skinRow = document.createElement('div');
    skinRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
    Object.keys(SKINS).forEach(id => {
      const s = SKINS[id];
      const isOwned = owned.includes('skin_' + id) || s.price === 0;
      const isActive = cfg.skin === id || (!cfg.skin && id === 'classic');
      const btn = document.createElement('button');
      btn.className = 'mBtn' + (isActive ? ' primary' : '');
      btn.style.cssText = 'flex:0 0 auto;padding:10px 14px;font-size:18px;opacity:' + (isOwned ? '1' : '0.4');
      const preview = s.glyph ? (s.glyph.w.k + ' ' + s.glyph.b.k) : '♟';
      btn.innerHTML = preview + '<div style="font-size:11px;margin-top:4px">' + s.name + '</div>';
      if(!isOwned) btn.innerHTML += '<div style="font-size:10px;color:var(--gold)">🪙 ' + s.price + '</div>';
      btn.addEventListener('click', () => {
        if(!isOwned) { toast('Купите скин в магазине'); return; }
        cfg.skin = id;
        saveCfg();
        snd.ui();
        renderProfStyleTab();
        fullRender();
      });
      skinRow.appendChild(btn);
    });
    segSkinProf.appendChild(skinRow);
  }
}

/* --- Вкладка: История матчей --- */
function renderMatchHistory(cu) {
  const histBox = document.getElementById('matchHistory');
  if(!histBox) return;
  if(!cu) { histBox.innerHTML = ''; return; }
  const history = cu.matchHistory || [];
  if(history.length === 0) {
    histBox.innerHTML = '<div style="color:var(--mut);text-align:center;padding:20px;font-size:13px">Пока нет сыгранных матчей</div>';
    return;
  }
  histBox.innerHTML = history.slice(-30).reverse().map(h => {
    const icon = h.result === 'win' ? '🏆' : h.result === 'loss' ? '😔' : '🤝';
    const color = h.result === 'win' ? '#4caf50' : h.result === 'loss' ? '#f44336' : '#ff9800';
    const time = h.time ? new Date(h.time).toLocaleString('ru', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--line)">' +
      '<span style="font-size:20px">' + icon + '</span>' +
      '<div style="flex:1">' +
        '<div style="font-size:14px;font-weight:600;color:' + color + '">' + (h.opponent || '—') + '</div>' +
        '<div style="font-size:12px;color:var(--mut)">' + (h.mode || 'Классика') + (h.reason ? ' · ' + h.reason : '') + '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--mut);white-space:nowrap">' + time + '</div>' +
    '</div>';
  }).join('');
}

/* --- Вкладка: Настройки профиля --- */
function renderProfSettings(cu) {
  if(!cu) return;
  const infoBox = document.getElementById('profSettingsInfo');
  const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
  if(infoBox) {
    if(isGuest) {
      const gId = ChesAuth.guestPlayerId || '—';
      infoBox.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Имя</span><b style="color:var(--txt)">' + ((cu.name && cu.name !== 'Гость') ? cu.name : 'Гость') + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">ID</span><b style="color:var(--accent)">#' + gId + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Эло</span><b style="color:var(--txt)">0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Лига</span><b style="color:var(--txt)">—</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Партий</span><b style="color:var(--txt)">0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Побед</span><b style="color:var(--txt)">0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Поражений</span><b style="color:var(--txt)">0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Винрейт</span><b style="color:var(--txt)">0%</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Серия</span><b style="color:var(--txt)">0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Монеты</span><b style="color:var(--txt)">🪙 0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Кристаллы</span><b style="color:var(--txt)">💎 0</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Предметов</span><b style="color:var(--txt)">0</b></div>' +
        '</div>';
    } else {
      const st = cu.st || {};
      const league = Elo.getLeague(cu.elo || 0);
      infoBox.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:6px;font-size:13px">' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Имя</span><b style="color:var(--txt)">' + (cu.name || 'Игрок') + '</b></div>' +
          (cu.playerId ? '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">ID</span><b style="color:var(--accent)">#' + cu.playerId + '</b></div>' : '') +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Эло</span><b style="color:var(--txt)">' + (cu.elo || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Лига</span><b style="color:var(--txt)">' + league.name + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Партий</span><b style="color:var(--txt)">' + (st.games || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Побед</span><b style="color:var(--txt)">' + (st.wins || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Поражений</span><b style="color:var(--txt)">' + (st.losses || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Винрейт</span><b style="color:var(--txt)">' + (cu.winrate || 0) + '%</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Серия</span><b style="color:var(--txt)">' + (st.streak || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Монеты</span><b style="color:var(--txt)">🪙 ' + (cu.coins || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Кристаллы</span><b style="color:var(--txt)">💎 ' + (cu.gems || 0) + '</b></div>' +
          '<div style="display:flex;justify-content:space-between"><span style="color:var(--mut)">Предметов</span><b style="color:var(--txt)">' + (cu.owned ? cu.owned.length : 0) + '</b></div>' +
        '</div>';
    }
  }

  const logoutBtn2 = document.getElementById('profLogoutBtn2');
  if(logoutBtn2) {
    logoutBtn2.onclick = async () => {
      if(confirm('Выйти из аккаунта?')) {
        await ChesAuth.logout();
        renderProfBar();
        renderProfScr();
        showScreen('scrMenu');
        toast('Вы вышли из аккаунта');
      }
    };
  }
}

window.renderStats = renderStats;
window.renderProfBar = renderProfBar;
window.renderProfScr = renderProfScr;
window.closeAllOverlays = closeAllOverlays;
window.closeOv = closeOv;
window.openOv = openOv;
window.openPromoModal = openPromoModal;
window.askConfirm = askConfirm;
window.spawnPiece = spawnPiece;
window.updateClockUI = updateClockUI;
