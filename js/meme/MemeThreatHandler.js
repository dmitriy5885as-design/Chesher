/**
 * MemeThreatHandler — пистолеты + видео при шахе, взятии, угрозе
 * v0.16.0 — анимация блокирует ход соперника直到完成，统一威胁视频，序列化动画
 */
"use strict";

const MemeThreatHandler = (() => {
  var GUN_LEFT = 'assets/Guns/guns_left.png';
  var GUN_RIGHT = 'assets/Guns/guns_right.png';
  var GUN_SOUND = 'sounds/freesound_community-lever-action-cocking-2-39680.mp3';
  var GUN_SIZE = 56;
  var SHOW_MS = 3000;
  var SPIN_MS = 800;
  var GUN_FADE_MS = 400;
  var guns = [];
  var _gunAnchors = [];
  var fadeTimer = null;
  var _locked = false;
  var _pendingMemeData = null;
  var _activeEls = [];
  var _safetyTimers = [];
  var gunAudio = null;
  var _seenVideos = {};
  var _gen = 0;

  function getSquarePos(row, col) {
    var b = document.getElementById('boardBox');
    if(!b) return null;
    var rect = b.getBoundingClientRect();
    if(rect.width < 10) return null;
    var sq = rect.width / 8;
    var f = b.classList.contains('flipped');
    var r = f ? (7 - row) : row;
    var c = f ? (7 - col) : col;
    return { x: rect.left + c * sq, y: rect.top + r * sq, sq: sq };
  }

  /* Проценты внутри #boardBox — позиция НЕ зависит от скролла/resize/zoom,
     потому что оверлей лежит в самом боксе и едет вместе с доской */
  function getSquarePct(row, col) {
    var b = document.getElementById('boardBox');
    if(!b) return null;
    var f = b.classList.contains('flipped');
    var r = f ? (7 - row) : row;
    var c = f ? (7 - col) : col;
    return { x: c * 12.5, y: r * 12.5, s: 12.5 };
  }

  function clearGuns() {
    if(fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    for(var i = 0; i < guns.length; i++) {
      if(guns[i] && guns[i].parentNode) guns[i].parentNode.removeChild(guns[i]);
    }
    guns = [];
    _gunAnchors = [];
  }

  function clearSafetyTimers() {
    for(var i = 0; i < _safetyTimers.length; i++) clearTimeout(_safetyTimers[i]);
    _safetyTimers = [];
  }

  function clearAll() {
    _gen++; // инвалидирует отложенные setTimeout(checkMove, 200) после конца партии
    clearGuns();
    clearSafetyTimers();
    _locked = false;
    _pendingMemeData = null;
    for(var i = 0; i < _activeEls.length; i++) removeEl(_activeEls[i]);
    _activeEls = [];
  }

  function lock() { _locked = true; }
  function unlock() { _locked = false; _activeEls = []; clearSafetyTimers(); }
  function isVideoLocked() { return _locked; }

  /* Пропустить всю текущую анимацию (видео/пистолеты) по тапу */
  function skipAnimation() {
    if(!_locked && !_activeEls.length && !guns.length) return;
    clearSafetyTimers();
    if(fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    for(var i = 0; i < _activeEls.length; i++) removeEl(_activeEls[i]);
    _activeEls = [];
    clearGuns();
    _pendingMemeData = null;
    _locked = false;
  }

  function removeEl(el) {
    if(el && el.parentNode) {
      var v = el.querySelector('video');
      if(v) { v.pause(); v.src = ''; }
      el.parentNode.removeChild(el);
    }
  }

  function showGun(attR, attC, tgtR, tgtC, gunIndex) {
    var att = getSquarePos(attR, attC);
    var tgt = getSquarePos(tgtR, tgtC);
    if(!att || !tgt) return;

    var el = document.createElement('div');
    el.className = 'memeGun memeGun--spin';
    el.addEventListener('click', function(ev) { ev.stopPropagation(); skipAnimation(); });

    var img = document.createElement('img');
    img.src = (function() {
      var cx0 = att.x + att.sq / 2, cy0 = att.y + att.sq / 2;
      var dx0 = (tgt.x + tgt.sq / 2) - cx0;
      return dx0 < 0 ? GUN_LEFT : GUN_RIGHT;
    })();
    img.alt = 'gun';
    img.draggable = false;

    el.appendChild(img);
    document.body.appendChild(el);
    guns.push(el);

    var anchor = { attR: attR, attC: attC, tgtR: tgtR, tgtC: tgtC, gunIndex: gunIndex || 0, el: el };
    _gunAnchors.push(anchor);
    _positionGun(anchor);

    try {
      if(!gunAudio) {
        gunAudio = new Audio(GUN_SOUND);
        gunAudio.preload = 'auto';
      }
      gunAudio.currentTime = 0;
      gunAudio.volume = MemeConfig.get('volume') || 0.7;
      gunAudio.play();
    } catch(e) {}

    setTimeout(function() {
      if(!el.parentNode) return;
      el.classList.remove('memeGun--spin');
      var a = _gunAnchors.filter(function(x) { return x.el === el; })[0];
      if(a) el.style.transform = 'rotate(' + _gunAngle(a) + 'deg)';
    }, SPIN_MS);
  }

  function _gunAngle(a) {
    var att = getSquarePos(a.attR, a.attC);
    var tgt = getSquarePos(a.tgtR, a.tgtC);
    if(!att || !tgt) return 0;
    var cx = att.x + att.sq / 2;
    var cy = att.y + att.sq / 2;
    var dx = (tgt.x + tgt.sq / 2) - cx;
    var dy = (tgt.y + tgt.sq / 2) - cy;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    return dx < 0 ? (angle + 180) : angle;
  }

  function _positionGun(a) {
    var att = getSquarePos(a.attR, a.attC);
    var tgt = getSquarePos(a.tgtR, a.tgtC);
    if(!att || !tgt || !a.el || !a.el.parentNode) return;

    var cx = att.x + att.sq / 2;
    var cy = att.y + att.sq / 2;
    var dx = (tgt.x + tgt.sq / 2) - cx;
    var dy = (tgt.y + tgt.sq / 2) - cy;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;

    var targetLeft = dx < 0;
    var rotate = targetLeft ? (angle + 180) : angle;
    var gunSize = Math.min(GUN_SIZE, Math.max(26, att.sq * 0.9));

    var rad = angle * Math.PI / 180;
    var dist = att.sq / 2 + 6;
    var perpRad = (rad + Math.PI / 2);
    var offset = a.gunIndex * 14 - 7;
    var gx = cx + Math.cos(rad) * dist + Math.cos(perpRad) * offset;
    var gy = cy + Math.sin(rad) * dist + Math.sin(perpRad) * offset;

    a.el.style.left = (gx - gunSize / 2) + 'px';
    a.el.style.top = (gy - gunSize / 2) + 'px';
    a.el.style.width = gunSize + 'px';
    a.el.style.height = gunSize + 'px';
    a.el.style.setProperty('--ta', rotate + 'deg');
  }

  /* Пистолеты висят в viewport — при скролле/resize пересчитываем их позицию */
  function _repositionGuns() {
    if(!guns.length) return;
    for(var i = 0; i < _gunAnchors.length; i++) _positionGun(_gunAnchors[i]);
  }

  /* FNV-1a: детерминированный выбор — оба игрока MP видят ОДНО И ТО ЖЕ видео
     (сид = FEN позиции после хода + тип события) */
  function _seedIndex(str, len) {
    var h = 2166136261;
    for(var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % len;
  }

  function pickVideo(eventType, color, pieceType) {
    var fen = '';
    try { if(typeof S !== 'undefined' && S && S.toFen) fen = S.toFen(); } catch(e) {}
    var seed = fen + '|' + eventType + '|' + color + '|' + (pieceType || '');
    if(MemeConfig.getVideoForEvent) {
      var src = MemeConfig.getVideoForEvent(eventType, color, pieceType, seed);
      if(src) return src;
    }
    var presets = MemeConfig.get('videoPresets');
    if(!presets || !presets[eventType]) return null;
    var arr = presets[eventType][color];
    if(!arr || !arr.length) return null;
    return arr[_seedIndex(seed, arr.length)];
  }

  function showVideoAt(row, col, videoSrc, muted) {
    if(!videoSrc) return null;
    var b = document.getElementById('boardBox');
    var pos = getSquarePct(row, col);
    if(!b || !pos) return null;

    var el = document.createElement('div');
    el.className = 'memeCheckVideo';
    el.style.left = pos.x + '%';
    el.style.top = pos.y + '%';
    el.style.width = pos.s + '%';
    el.style.height = pos.s + '%';
    // тап по видео пропускает анимацию и разблокирует ход
    el.addEventListener('pointerdown', function(ev) { ev.stopPropagation(); skipAnimation(); });
    el.addEventListener('click', function(ev) { ev.stopPropagation(); skipAnimation(); });

    var vid = document.createElement('video');
    vid.src = encodeURI(videoSrc);
    vid.preload = 'auto';
    vid.autoplay = true;
    vid.muted = !!muted;
    vid.loop = false;
    vid.playsInline = true;

    el.appendChild(vid);
    b.appendChild(el);
    _activeEls.push(el);

    vid.volume = muted ? 0 : (MemeConfig.get('volume') || 0.7);
    vid.play().catch(function() { removeEl(el); });

    return el;
  }

  function playStep(items, eventType, onDone) {
    if(!items.length) { onDone(); return; }
    var src = pickVideo(eventType, items[0].color, items[0].piece);
    if(!src) { onDone(); return; }

    var remaining = items.length;

    for(var i = 0; i < items.length; i++) {
      var el = showVideoAt(items[i].row, items[i].col, src, i > 0);
      if(!el) { remaining--; if(remaining <= 0) onDone(); continue; }

      (function(elRef) {
        var vid = elRef.querySelector('video');
        var done = false;
        function stepDone() {
          if(done) return;
          done = true;
          elRef.classList.add('memeCheckVideo--fade');
          setTimeout(function() { removeEl(elRef); }, GUN_FADE_MS);
          remaining--;
          if(remaining <= 0) onDone();
        }
        if(vid) {
          vid.addEventListener('ended', stepDone);
          vid.addEventListener('error', stepDone);
        }
        var st = setTimeout(stepDone, 5000);
        _safetyTimers.push(st);
      })(el);
    }
  }

  function playSequence(seq, onAllDone) {
    if(!seq.length) { onAllDone(); return; }
    var idx = 0;
    function next() {
      if(idx >= seq.length) { onAllDone(); return; }
      var step = seq[idx++];
      playStep(step.items, step.type, next);
    }
    next();
  }

  function buildSequence(data) {
    var piece = S.board[data.toRow] && S.board[data.toRow][data.toCol];
    if(!piece) return [];
    var movedColor = (piece === piece.toUpperCase()) ? 'w' : 'b';
    // цель события — всегда цвет соперника ходящей фигуры: одинаково на клиентах обоих игроков
    var targetColor = movedColor === 'w' ? 'b' : 'w';

    var seq = [];

    if(data.threats && data.threats.length) {
      var threatItems = [];
      for(var i = 0; i < data.threats.length; i++) {
        var t = data.threats[i];
        var tp = S.board[t.row] && S.board[t.row][t.col];
        if(!tp) continue;
        var tc = (tp === tp.toUpperCase()) ? 'w' : 'b';
        if(tc !== targetColor) continue;
        threatItems.push({ row: t.row, col: t.col, color: tc, piece: null });
      }
      if(threatItems.length) seq.push({ type: 'threat', items: threatItems });
    }

    if(data.wasCheck && data.kingRow != null) {
      seq.push({ type: 'check', items: [{row: data.kingRow, col: data.kingCol, color: targetColor, piece: null}] });
    }

    if(data.captured) {
      var capColor = (data.captured === data.captured.toUpperCase()) ? 'w' : 'b';
      seq.push({ type: 'capture', items: [{row: data.toRow, col: data.toCol, color: capColor, piece: data.captured}] });
    }

    if(data.brilliant) {
      seq.push({ type: 'brilliant', items: [{row: data.brilliant.row, col: data.brilliant.col, color: movedColor, piece: data.piece}] });
    }

    if(data.promotion) {
      seq.push({ type: 'promotion', items: [{row: data.promotion.row, col: data.promotion.col, color: movedColor, piece: 'P'}] });
    }

    if(data.sacrifice) {
      seq.push({ type: 'sacrifice', items: [{row: data.sacrifice.row, col: data.sacrifice.col, color: targetColor, piece: data.piece}] });
    }

    if(data.blunder) {
      seq.push({ type: 'blunder', items: [{row: data.blunder.row, col: data.blunder.col, color: movedColor, piece: data.piece}] });
    }

    if(data.defended && data.defended.length) {
      var defItems = [];
      for(var i = 0; i < data.defended.length; i++) {
        var d = data.defended[i];
        defItems.push({ row: d.row, col: d.col, color: movedColor, piece: null });
      }
      if(defItems.length) seq.push({ type: 'defense', items: defItems });
    }

    return seq;
  }

  function handleMoveEvents(data) {
    if(!MemeConfig.isMemeMode()) { unlock(); return; }
    if(!MemeConfig.get('videos')) { unlock(); return; }
    if(!data) { unlock(); return; }

    var seq = buildSequence(data);
    if(!seq.length) { unlock(); return; }

    playSequence(seq, function() { unlock(); });
  }

  function checkMove(moveData) {
    try {
      if(!MemeConfig.isMemeMode()) return;
      if(!moveData) return;
      if(typeof S === 'undefined' || !S) return;

      var piece = S.board[moveData.toRow] && S.board[moveData.toRow][moveData.toCol];
      if(!piece) return;

      var memeData = _pendingMemeData;
      _pendingMemeData = null;

      var captures = moveData.captures || [];

      if(!captures.length) {
        if(memeData) {
          lock();
          handleMoveEvents(memeData);
        }
        return;
      }

      lock();

      clearGuns();
      for(var i = 0; i < captures.length; i++) {
        showGun(moveData.toRow, moveData.toCol, captures[i].tr, captures[i].tc, i);
      }

      fadeTimer = setTimeout(function() {
        for(var i = 0; i < guns.length; i++) {
          guns[i].classList.add('memeGun--fade');
        }
        setTimeout(function() {
          clearGuns();
          if(memeData) {
            handleMoveEvents(memeData);
          } else {
            unlock();
          }
        }, GUN_FADE_MS);
      }, SHOW_MS);
    } catch(e) {
      console.error('MemeThreatHandler:', e);
      unlock();
    }
  }

  function warmup() {
    try {
      var il = new Image(); il.src = GUN_LEFT;
      var ir = new Image(); ir.src = GUN_RIGHT;
    } catch(e) {}
    try {
      var a = document.createElement('audio');
      a.preload = 'auto';
      a.src = GUN_SOUND;
      a.load();
    } catch(e) {}
    if(MemeConfig.isMemeMode && MemeConfig.isMemeMode()) {
      try {
        var vp = MemeConfig.get('videoPresets');
        if(vp && typeof vp === 'object') {
          var walk = function(v) {
            if(Array.isArray(v)) {
              for(var i = 0; i < v.length; i++) walk(v[i]);
            } else if(typeof v === 'string' && /\.mp4$/i.test(v) && !_seenVideos[v]) {
              _seenVideos[v] = 1;
              var l = document.createElement('link');
              l.rel = 'preload';
              l.as = 'video';
              l.href = v;
              document.head.appendChild(l);
            }
          };
          walk(vp);
        }
      } catch(e) {}
    }
  }

  function init() {
    warmup();
    if(typeof window !== 'undefined') {
      var reposition = function() { _repositionGuns(); };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      try {
        if(window.visualViewport) window.visualViewport.addEventListener('resize', reposition);
      } catch(e) {}
    }
    MemeEventBus.subscribe('MEME_EVENTS', function(event) {
      _pendingMemeData = event.data;
    });
    MemeEventBus.subscribe('MOVE', function(event) {
      var g = _gen;
      setTimeout(function() {
        if(g !== _gen) return; // партия закончилась/сброшена — не навешиваем пистолеты постфактум
        checkMove(event.data);
      }, 200);
    });
  }

  function forceUnlock() {
    unlock();
    clearAll();
  }

  return { showGun: showGun, clearAll: clearAll, clearGuns: clearGuns, init: init, warmup: warmup, isVideoLocked: isVideoLocked, forceUnlock: forceUnlock, skipAnimation: skipAnimation };
})();

if(typeof window !== 'undefined') {
  window.MemeThreatHandler = MemeThreatHandler;
}
