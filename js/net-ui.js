/**
 * ЧЕШЕР — UI для авторизации, друзей, лобби, мультиплеера
 */
"use strict";

const NetUI = {
  _lobbyId: null,

  /* --- Инициализация --- */
  init() {
    this._initAuth();
    this._initFriends();
    this._initLobby();
    this._checkAuth();
  },

  /* ==================== АВТОРИЗАЦИЯ ==================== */
  _initAuth() {
    const regBtn = document.getElementById('authRegBtn');
    const loginBtn = document.getElementById('authLoginBtn');
    const googleBtn = document.getElementById('authGoogleBtn');
    const anonBtn = document.getElementById('authAnonBtn');
    const skipBtn = document.getElementById('authSkipBtn');

    if(regBtn) regBtn.onclick = async () => {
      const name = document.getElementById('authName').value.trim();
      const email = document.getElementById('authEmail').value.trim();
      const pass = document.getElementById('authPass').value;
      if(!name || !email || !pass) { toast('Заполните все поля'); return; }
      try {
        await ChesAuth.register(email, pass, name);
        const cu = ProfilesManager.getCurrent();
        if(cu) {
          cu.name = name;
          saveProfiles();
          await ChesAuth.syncLocalToCloud(cu);
        }
        showScreen('scrMenu');
        toast('Аккаунт создан!');
      } catch(e) { toast('Ошибка: ' + e.message); }
    };

    if(loginBtn) loginBtn.onclick = async () => {
      const email = document.getElementById('authEmail').value.trim();
      const pass = document.getElementById('authPass').value;
      if(!email || !pass) { toast('Введите email и пароль'); return; }
      try {
        await ChesAuth.login(email, pass);
        showScreen('scrMenu');
        toast('Добро пожаловать!');
      } catch(e) { toast('Ошибка: ' + e.message); }
    };

    if(googleBtn) googleBtn.onclick = async () => {
      try {
        await ChesAuth.loginGoogle();
        const cu = ProfilesManager.getCurrent();
        if(cu && ChesAuth.profile) {
          await ChesAuth.syncLocalToCloud(cu);
        }
        showScreen('scrMenu');
        toast('Вход через Google выполнен!');
      } catch(e) { toast('Ошибка: ' + e.message); }
    };

    if(anonBtn) anonBtn.onclick = async () => {
      try {
        await ChesAuth.loginAnon();
        showScreen('scrMenu');
        toast('Анонимный вход выполнен!');
      } catch(e) { toast('Ошибка: ' + e.message); }
    };

    if(skipBtn) skipBtn.onclick = () => {
      showScreen('scrMenu');
    };

    ChesAuth.onAuthChange(user => {
      this._syncFirebaseProfile(user);
      this._updateProfileBar(user);
    });
  },

  _checkAuth() {
    if(ChesAuth.user) {
      this._syncFirebaseProfile(ChesAuth.user);
      this._updateProfileBar(ChesAuth.user);
    }
  },

  _syncFirebaseProfile(user) {
    if(!user || user.isAnonymous || !ChesAuth.profile) return;
    const cu = ProfilesManager.getCurrent();
    if(!cu) return;

    cu.name = ChesAuth.profile.name || user.displayName || user.email || cu.name;
    cu.ava = ChesAuth.profile.ava || cu.ava;
    cu.coins = typeof ChesAuth.profile.coins === 'number' ? ChesAuth.profile.coins : cu.coins;
    cu.gems = typeof ChesAuth.profile.gems === 'number' ? ChesAuth.profile.gems : cu.gems;
    cu.elo = typeof ChesAuth.profile.elo === 'number' ? ChesAuth.profile.elo : cu.elo;
    if(ChesAuth.profile.ratings) {
      cu.ratings = ChesAuth.profile.ratings;
    }
    if(ChesAuth.profile.owned) {
      cu.owned = ChesAuth.profile.owned;
    }
    if(ChesAuth.profile.lastNickChange) {
      cu.lastNickChange = ChesAuth.profile.lastNickChange;
    }
    if(ChesAuth.profile.customAva) {
      cu.customAva = ChesAuth.profile.customAva;
    }
    if(ChesAuth.profile.playerId) {
      cu.playerId = ChesAuth.profile.playerId;
    } else if(!cu.playerId && ChesAuth.user && !ChesAuth.user.isAnonymous) {
      cu.playerId = ChesAuth._genPlayerId();
      ChesAuth.updateProfile({ playerId: cu.playerId });
    }
    if(ChesAuth.profile.admin) {
      cu.admin = true;
    }
    if(ChesAuth.profile.wins) {
      cu.st.wins = ChesAuth.profile.wins;
    }
    if(ChesAuth.profile.games) {
      cu.st.games = ChesAuth.profile.games;
    }
    saveProfiles();
    renderProfBar();
    renderCoins();
  },

  _updateProfileBar(user) {
    const pbName = document.getElementById('pbName');
    const pbSub = document.getElementById('pbSub');
    const pbAva = document.getElementById('pbAva');
    const mAuthBtn = document.getElementById('mAuth');
    if(user && !user.isAnonymous) {
      const cu = ProfilesManager.getCurrent();
      if(pbName) pbName.textContent = cu ? cu.name : (user.displayName || user.email);
      if(pbAva && cu) {
        if(cu.customAva) {
          pbAva.innerHTML = '<img src="' + cu.customAva + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
        } else {
          pbAva.textContent = cu.ava || '🐣';
        }
      }
      if(pbSub) pbSub.textContent = 'Онлайн';
      if(mAuthBtn) mAuthBtn.style.display = 'none';
    } else {
      if(pbName) pbName.textContent = 'Гость';
      if(pbAva) pbAva.textContent = '🐣';
      if(pbSub) pbSub.textContent = 'Войдите для сохранения';
      if(mAuthBtn) mAuthBtn.style.display = '';
    }
  },

  /* ==================== ДРУЗЬЯ ==================== */
  _initFriends() {
    const searchBtn = document.getElementById('friendSearchBtn');
    const searchInput = document.getElementById('friendSearch');

    if(searchBtn) searchBtn.onclick = () => this._searchFriends();
    if(searchInput) searchInput.addEventListener('keydown', e => {
      if(e.key === 'Enter') this._searchFriends();
    });

    // Load friends when screen opens
    const friendsBtn = document.querySelector('[data-screen="scrFriends"]');
    if(friendsBtn) {
      friendsBtn.addEventListener('click', () => this._loadFriends());
    }
  },

  async _searchFriends() {
    const q = document.getElementById('friendSearch').value.trim();
    const box = document.getElementById('friendSearchResults');
    if(!box) return;
    if(!q || q.length < 2) { box.innerHTML = ''; return; }

    const results = await ChesFriends.search(q);
    const myUid = ChesAuth.getUid();
    box.innerHTML = results.filter(r => r.uid !== myUid).map(r =>
      '<div class="friendRow">' +
        '<span class="friendAva">' + r.ava + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<span class="friendName">' + r.name + '</span>' +
          (r.playerId ? '<div style="font-size:10px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">#' + r.playerId + '</div>' : '') +
          '<div style="font-size:10px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + r.uid + '">' + r.uid + '</div>' +
        '</div>' +
        '<button class="mBtn friendAddBtn" data-uid="' + r.uid + '">➕ Добавить</button>' +
      '</div>'
    ).join('');

    box.querySelectorAll('.friendAddBtn').forEach(btn => {
      btn.onclick = async () => {
        const uid = btn.dataset.uid;
        await ChesFriends.sendRequest(uid);
        btn.textContent = '✓ Отправлено';
        btn.disabled = true;
        toast('Заявка отправлена!');
      };
    });
  },

  async _loadFriends() {
    if(!ChesAuth.user) return;
    const list = document.getElementById('friendList');
    const reqBox = document.getElementById('friendRequests');
    if(!list) return;

    // Load requests
    const requests = await ChesFriends.getRequests();
    if(reqBox) {
      reqBox.innerHTML = requests.length ?
        '<h3 style="color:var(--txt);margin-bottom:8px">Заявки в друзья</h3>' +
        requests.map(r =>
          '<div class="friendRow">' +
            '<span class="friendAva">' + r.ava + '</span>' +
            '<span class="friendName">' + r.name + '</span>' +
            '<button class="mBtn" onclick="NetUI._acceptReq(\'' + r.uid + '\')">✓</button>' +
            '<button class="mBtn" onclick="NetUI._rejectReq(\'' + r.uid + '\')">✕</button>' +
          '</div>'
        ).join('') : '';
    }

    // Load friends
    const friends = await ChesFriends.getFriends();
    list.innerHTML = friends.length ? friends.map(f =>
      '<div class="friendRow">' +
        '<span class="friendAva">' + f.ava + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<span class="friendName">' + f.name + '</span>' +
          (f.playerId ? '<div style="font-size:10px;color:var(--accent)">#' + f.playerId + '</div>' : '') +
        '</div>' +
        '<span class="friendElo" style="color:var(--mut)">' + f.elo + ' эло</span>' +
        (f.online ? '<span class="friendOnline">🟢</span>' : '<span class="friendOnline">⚫</span>') +
        (f.online ? '<button class="mBtn friendPlayBtn" data-uid="' + f.uid + '">🎮 Играть</button>' : '') +
      '</div>'
    ).join('') : '<p style="color:var(--mut);text-align:center;padding:20px">Пока нет друзей. Найдите игроков выше!</p>';

    list.querySelectorAll('.friendPlayBtn').forEach(btn => {
      btn.onclick = async () => {
        const uid = btn.dataset.uid;
        await this._inviteAndCreate(uid);
      };
    });
  },

  async _acceptReq(uid) {
    await ChesFriends.acceptRequest(uid);
    this._loadFriends();
    toast('Друг добавлен!');
  },

  async _rejectReq(uid) {
    await ChesFriends.rejectRequest(uid);
    this._loadFriends();
  },

  /* ==================== ЛОББИ ==================== */
  _initLobby() {
    const backBtn = document.getElementById('lobbyBackBtn');
    if(backBtn) backBtn.onclick = () => {
      ChesMP.cancelLobby();
      showScreen('scrMulti');
    };
  },

  async _inviteAndCreate(friendUid) {
    if(!ChesAuth.user) {
      try { await ChesAuth.loginAnon(); } catch(e) { console.error('inviteAndCreate auth error:', e); }
    }
    if(!ChesAuth.user) { toast('Нужна авторизация'); return; }
    const lobbyId = await ChesMP.createLobby();
    if(!lobbyId) { toast('Ошибка создания лобби'); return; }

    // Store lobby ID for invite
    this._lobbyId = lobbyId;

    // Update lobby screen
    this._showLobby(lobbyId, 'Ожидание друга...');

    // Listen for game start
    ChesMP.onStart(opponent => {
      toast(opponent.name + ' присоединился!');
      this._startMultiplayerGame();
    });

    // Listen for moves
    ChesMP.onMove(move => {
      this._onOpponentMove(move);
    });

    // Listen for game end
    ChesMP.onEnd((winner, reason) => {
      const result = winner === ChesMP.myColor ? 'win' : 'loss';
      this._onMultiplayerEnd(result, reason);
    });

    // Send invite
    await ChesFriends.inviteFriend(friendUid);
    showScreen('scrLobby');
    toast('Приглашение отправлено!');
  },

  async _joinByCode(code) {
    if(!ChesAuth.user) {
      try { await ChesAuth.loginAnon(); } catch(e) { console.error('joinByCode auth error:', e); }
    }
    if(!ChesAuth.user) { toast('Нужна авторизация'); return; }
    const ok = await ChesMP.joinLobby(code);
    if(!ok) { toast('Лобби не найдено или уже занято'); return; }

    this._showLobby(code, 'Игра началась!');

    ChesMP.onStart(opponent => {
      this._startMultiplayerGame();
    });
    ChesMP.onMove(move => {
      this._onOpponentMove(move);
    });
    ChesMP.onEnd((winner, reason) => {
      const result = winner === ChesMP.myColor ? 'win' : 'loss';
      this._onMultiplayerEnd(result, reason);
    });

    showScreen('scrLobby');
  },

  _showLobby(lobbyId, status) {
    const statusEl = document.getElementById('lobbyStatus');
    const codeEl = document.getElementById('lobbyCode');
    const idText = document.getElementById('lobbyIdText');
    const actionsEl = document.getElementById('lobbyActions');
    const playersEl = document.getElementById('lobbyPlayers');

    const modeNames = {classic:'♟ Классика',fischer:'🎲 Фишер 960',meme:'🔫 Мемасия'};
    const timeNames = {60:'1 мин',120:'2 мин',300:'5 мин',600:'10 мин',900:'15 мин',1200:'20 мин',1500:'25 мин',1800:'30 мин'};
    const _ls = this._lobbySettings;
    const modeLabel = _ls && _ls.mode ? (modeNames[_ls.mode] || _ls.mode) : '';
    const timeLabel = _ls && _ls.timeSec != null ? (timeNames[_ls.timeSec] || _ls.timeSec + ' сек') : '';
    const settingsInfo = (modeLabel || timeLabel) ?
      '<div style="color:var(--mut);font-size:12px;margin-top:4px">' + modeLabel + (modeLabel && timeLabel ? ' · ' : '') + timeLabel + '</div>' : '';

    if(statusEl) statusEl.textContent = status;
    if(codeEl) codeEl.style.display = '';
    if(idText) {
      idText.textContent = lobbyId;
      idText.onclick = () => {
        navigator.clipboard.writeText(lobbyId).then(() => toast('Код скопирован!'));
      };
    }
    if(playersEl) {
      const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
      const myPid = isGuest ?
        (ChesAuth.guestPlayerId ? '  #' + ChesAuth.guestPlayerId : '') :
        ((ChesAuth.profile && ChesAuth.profile.playerId) ? '  #' + ChesAuth.profile.playerId : '');
      playersEl.innerHTML =
        '<div style="text-align:center"><div style="font-size:32px">' + (isGuest ? '🐣' : (ChesAuth.profile ? ChesAuth.profile.ava : '🐣')) + '</div><div style="font-size:12px;color:var(--mut)">' + (isGuest ? 'Гость' : (ChesAuth.profile ? ChesAuth.profile.name : 'Вы')) + myPid + '</div></div>' +
        settingsInfo +
        '<div style="color:var(--mut);font-size:24px;align-self:center">VS</div>' +
        '<div style="text-align:center;color:var(--mut)"><div style="font-size:32px">❓</div><div style="font-size:12px">Ожидание...</div></div>';
    }
    if(actionsEl) {
      actionsEl.innerHTML =
        '<button class="mBtn" onclick="NetUI._showJoinInput()" style="width:100%">Ввести код лобби</button>';
    }
  },

  _showJoinInput() {
    const code = prompt('Введите код лобби:');
    if(code) this._joinByCode(code.trim());
  },

  _startMultiplayerGame() {
    // Start a local game with the MP state
    const opponent = ChesMP.opponent;
    if(opponent) {
      const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
      const myAva = isGuest ? '🐣' : (ChesAuth.profile ? ChesAuth.profile.ava : '🐣');
      const myName = isGuest ? 'Гость' : (ChesAuth.profile ? ChesAuth.profile.name : 'Вы');
      const playersEl = document.getElementById('lobbyPlayers');
      if(playersEl) {
        playersEl.innerHTML =
          '<div style="text-align:center"><div style="font-size:32px">' + myAva + '</div><div style="font-size:12px;color:var(--mut)">' + myName + ' (' + (ChesMP.myColor === 'w' ? '⚪' : '⚫') + ')</div></div>' +
          '<div style="color:var(--mut);font-size:24px;align-self:center">VS</div>' +
          '<div style="text-align:center"><div style="font-size:32px">' + (opponent.ava || '🐣') + '</div><div style="font-size:12px;color:var(--mut)">' + opponent.name + ' (' + (ChesMP.myColor === 'w' ? '⚫' : '⚪') + ')</div></div>';
      }

      const actionsEl = document.getElementById('lobbyActions');
      if(actionsEl) actionsEl.innerHTML = '';

      // Start the actual chess game
      setTimeout(() => {
        startMultiplayerGame(ChesMP.myColor, opponent.name);
      }, 1000);
    }
  },

  _onOpponentMove(move) {
    if(typeof handleIncomingMove === 'function') {
      handleIncomingMove(move);
    }
  },

  _onMultiplayerEnd(result, reason) {
    if(result === 'win') {
      toast('🏆 Победа!');
      snd.win();
    } else {
      toast('😔 Поражение');
      snd.lose();
    }
  }
};
