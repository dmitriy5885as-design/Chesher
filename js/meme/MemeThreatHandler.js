/**
 * MemeThreatHandler — пистолеты + видео при шахе, взятии, угрозе, защите, жертве, зевке, крутом ходе, превращении
 * v0.15.0 — поддержка 8 типов событий + per-piece видео
 */
"use strict";

const MemeThreatHandler = (() => {
  var GUN_LEFT = 'assets/Guns/guns_left.png';
  var GUN_RIGHT = 'assets/Guns/guns_right.png';
  var GUN_SOUND = 'sounds/freesound_community-lever-action-cocking-2-39680.mp3';
  var GUN_SIZE = 56;
  var SHOW_MS = 3000;
  var SPIN_MS = 800;
  var guns = [];
  var fadeTimer = null;
  var videoTimer = null;

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

  function clearGuns() {
    if(fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    for(var i = 0; i < guns.length; i++) {
      if(guns[i] && guns[i].parentNode) guns[i].parentNode.removeChild(guns[i]);
    }
    guns = [];
  }

  function clearAll() {
    clearGuns();
    if(videoTimer) { clearTimeout(videoTimer); videoTimer = null; }
    var old = document.querySelectorAll('.memeCheckVideo');
    for(var i = 0; i < old.length; i++) {
      var v = old[i].querySelector('video');
      if(v) { v.pause(); v.src = ''; }
      old[i].parentNode.removeChild(old[i]);
    }
  }

  function showGun(attR, attC, tgtR, tgtC, gunIndex) {
    var att = getSquarePos(attR, attC);
    var tgt = getSquarePos(tgtR, tgtC);
    if(!att || !tgt) return;

    var cx = att.x + att.sq / 2;
    var cy = att.y + att.sq / 2;
    var dx = (tgt.x + tgt.sq / 2) - cx;
    var dy = (tgt.y + tgt.sq / 2) - cy;
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;

    var targetLeft = dx < 0;
    var src = targetLeft ? GUN_LEFT : GUN_RIGHT;
    var rotate = targetLeft ? (angle + 180) : angle;

    var rad = angle * Math.PI / 180;
    var dist = att.sq / 2 + 6;
    var perpRad = (rad + Math.PI / 2);
    var offset = (gunIndex || 0) * 14 - 7;
    var gx = cx + Math.cos(rad) * dist + Math.cos(perpRad) * offset;
    var gy = cy + Math.sin(rad) * dist + Math.sin(perpRad) * offset;

    var el = document.createElement('div');
    el.className = 'memeGun memeGun--spin';
    el.style.left = (gx - GUN_SIZE / 2) + 'px';
    el.style.top = (gy - GUN_SIZE / 2) + 'px';
    el.style.width = GUN_SIZE + 'px';
    el.style.height = GUN_SIZE + 'px';
    el.style.setProperty('--ta', rotate + 'deg');

    var img = document.createElement('img');
    img.src = src;
    img.alt = 'gun';
    img.draggable = false;

    el.appendChild(img);
    document.body.appendChild(el);
    guns.push(el);

    try {
      var gunSnd = new Audio(GUN_SOUND);
      gunSnd.volume = MemeConfig.get('volume') || 0.7;
      gunSnd.play();
    } catch(e) {}

    setTimeout(function() {
      el.classList.remove('memeGun--spin');
      el.style.transform = 'rotate(' + rotate + 'deg)';
    }, SPIN_MS);
  }

  function pickVideo(eventType, color, pieceType) {
    if(MemeConfig.getVideoForEvent) {
      var src = MemeConfig.getVideoForEvent(eventType, color, pieceType);
      if(src) return src;
    }
    var presets = MemeConfig.get('videoPresets');
    if(!presets || !presets[eventType]) return null;
    var arr = presets[eventType][color];
    if(!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function showVideoAt(row, col, videoSrc) {
    if(!videoSrc) return;
    var pos = getSquarePos(row, col);
    if(!pos) return;

    var el = document.createElement('div');
    el.className = 'memeCheckVideo';
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.width = pos.sq + 'px';
    el.style.height = pos.sq + 'px';
    el.style.pointerEvents = 'none';

    var vid = document.createElement('video');
    vid.src = encodeURI(videoSrc);
    vid.autoplay = true;
    vid.muted = false;
    vid.loop = false;
    vid.playsInline = true;

    el.appendChild(vid);
    document.body.appendChild(el);

    vid.volume = MemeConfig.get('volume') || 0.7;
    vid.play().catch(function() { removeEl(el); });

    vid.addEventListener('ended', function() {
      el.classList.add('memeCheckVideo--fade');
      setTimeout(function() { removeEl(el); }, 400);
    });

    videoTimer = setTimeout(function() {
      removeEl(el);
    }, 4000);
  }

  function removeEl(el) {
    if(el && el.parentNode) {
      var v = el.querySelector('video');
      if(v) { v.pause(); v.src = ''; }
      el.parentNode.removeChild(el);
    }
  }

  function handleMoveEvents(data) {
    if(!MemeConfig.isMemeMode()) return;
    if(!MemeConfig.get('videos')) return;
    if(!data) return;

    var piece = S.board[data.toRow] && S.board[data.toRow][data.toCol];
    if(!piece) return;
    var movedColor = (piece === piece.toUpperCase()) ? 'w' : 'b';

    var isHuman = data.isHumanMove;
    var targetColor = isHuman ? (movedColor === 'w' ? 'b' : 'w') : S.humanColor;

    var seq = [];

    if(data.wasCheck && data.kingRow != null) {
      seq.push({ type: 'check', items: [{row: data.kingRow, col: data.kingCol, color: targetColor, piece: null}] });
    }

    if(data.brilliant) {
      seq.push({ type: 'brilliant', items: [{row: data.brilliant.row, col: data.brilliant.col, color: movedColor, piece: data.piece}] });
    }

    if(data.captured) {
      var capColor = (data.captured === data.captured.toUpperCase()) ? 'w' : 'b';
      seq.push({ type: 'capture', items: [{row: data.toRow, col: data.toCol, color: capColor, piece: data.captured}] });
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

    if(data.defended && data.defended.length) {
      var defItems = [];
      for(var i = 0; i < data.defended.length; i++) {
        var d = data.defended[i];
        defItems.push({ row: d.row, col: d.col, color: movedColor, piece: null });
      }
      if(defItems.length) seq.push({ type: 'defense', items: defItems });
    }

    if(!seq.length) return;

    var STEP_MS = 4500;
    var delay = isHuman ? (SHOW_MS + 400) : 200;

    for(var s = 0; s < seq.length; s++) {
      (function(step) {
        setTimeout(function() {
          for(var j = 0; j < step.items.length; j++) {
            var it = step.items[j];
            var src = pickVideo(step.type, it.color, it.piece);
            if(src) showVideoAt(it.row, it.col, src);
          }
        }, delay);
      })(seq[s]);
      delay += STEP_MS;
    }
  }

  function checkMove(data) {
    try {
      if(!MemeConfig.isMemeMode()) return;
      if(!MemeConfig.get('threats')) return;
      if(!data) return;

      if(typeof S === 'undefined' || !S) return;
      var piece = S.board[data.toRow] && S.board[data.toRow][data.toCol];
      if(!piece) return;

      var captures = data.captures;
      if(!captures || !captures.length) return;

      clearGuns();

      for(var i = 0; i < captures.length; i++) {
        showGun(data.toRow, data.toCol, captures[i].tr, captures[i].tc, i);
      }

      fadeTimer = setTimeout(function() {
        for(var i = 0; i < guns.length; i++) {
          guns[i].classList.add('memeGun--fade');
        }
        setTimeout(clearGuns, 400);
      }, SHOW_MS);
    } catch(e) {
      console.error('MemeThreatHandler:', e);
    }
  }

  function init() {
    MemeEventBus.subscribe('MOVE', function(event) {
      setTimeout(function() { checkMove(event.data); }, 200);
    });
    MemeEventBus.subscribe('MEME_EVENTS', function(event) {
      setTimeout(function() { handleMoveEvents(event.data); }, 100);
    });
  }

  function isVideoLocked() { return false; }

  return { showGun: showGun, clearAll: clearAll, clearGuns: clearGuns, init: init, isVideoLocked: isVideoLocked };
})();

if(typeof window !== 'undefined') {
  window.MemeThreatHandler = MemeThreatHandler;
}
