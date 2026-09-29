/**
 * ЧЕШЕР — Разбор партии после поражения
 * Находит 1-2 хода игрока с наибольшей просадкой оценки (evalBoard из bot.js)
 * и показывает их в оверлее конца партии со ссылкой на реплей.
 */
"use strict";

const LOSS_THRESHOLD = -0.9; // ≈ потерянная пешка и больше (шум центра ≤0.6)

const ChesAnalysis = {
  /* entry: запись matchHistory ({startFen, moves:[{fen, notation}]})
     humanColor: 'w' | 'b'
     → [{ idx, notation, delta }] — худшие просадки, максимум 2 */
  analyze(entry, humanColor) {
    try {
      if(!entry || !entry.moves || !entry.moves.length || !humanColor) return [];
      const fens = [entry.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'];
      for(const m of entry.moves) {
        if(!m || !m.fen) return [];
        fens.push(m.fen);
      }
      const startTurn = (fens[0].split(' ')[1] || 'w') === 'b' ? 'b' : 'w';
      const blunders = [];
      for(let i = 0; i < entry.moves.length; i++) {
        const mover = startTurn === 'w' ? (i % 2 === 0 ? 'w' : 'b') : (i % 2 === 0 ? 'b' : 'w');
        if(mover !== humanColor) continue;
        const before = evalBoard(fenToBoard(fens[i]), humanColor);
        const after = evalBoard(fenToBoard(fens[i + 1]), humanColor);
        const delta = after - before;
        if(delta <= LOSS_THRESHOLD) {
          blunders.push({ idx: i, notation: entry.moves[i].notation || '—', delta: Math.round(delta * 10) / 10 });
        }
      }
      blunders.sort((a, b) => a.delta - b.delta);
      return blunders.slice(0, 2);
    } catch(e) {
      console.warn('ChesAnalysis:', e);
      return [];
    }
  }
};

/* --- Отрисовка секции «Где всё пошло не так» в #ovOver --- */
function renderGameAnalysis(blunders, entry) {
  const box = document.getElementById('goAnalysis');
  if(!box) return;
  if(!blunders || !blunders.length) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  box.innerHTML = '<div class="goAnTitle">🔍 Где всё пошло не так</div>' +
    blunders.map((b, k) => {
      const moveNo = Math.floor(b.idx / 2) + 1;
      const prefix = (b.idx % 2 === 0) ? moveNo + '.' : moveNo + '…';
      return '<div class="goAnRow">' +
        '<span class="goAnTx">Ход ' + prefix + ' <b>' + escapeHtml(b.notation) + '</b> — просадка ' + (b.delta > 0 ? '+' : '') + b.delta.toFixed(1) + '</span>' +
        '<button class="mBtn goAnBtn" data-k="' + k + '">Смотреть</button>' +
      '</div>';
    }).join('');
  box.querySelectorAll('.goAnBtn').forEach(btn => {
    btn.onclick = () => {
      const b = blunders[+btn.dataset.k];
      const cu = ProfilesManager.getCurrent();
      const idx = (cu.matchHistory || []).indexOf(entry);
      if(idx < 0 || !b) { toast('Партия уже удалена из истории'); return; }
      closeAllOverlays();
      openReplay(idx, b.idx + 1); // позиция ПОСЛЕ хода — видно последствия
    };
  });
}

if(typeof window !== 'undefined') {
  window.ChesAnalysis = ChesAnalysis;
  window.renderGameAnalysis = renderGameAnalysis;
}
