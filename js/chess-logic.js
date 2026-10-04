/**
 * ЧЕШЕР — Шахматная логика
 * Класс ChessEngine — полная реализация правил игры
 */
"use strict";

const VAL = {p:1,n:3,b:3,r:5,q:9,k:200};
const GLYPH = {
  w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
  b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
};
const LETTER = {n:'N',b:'B',r:'R',q:'Q',k:'K'};
const FILES = 'abcdefgh';

function getSkinGlyph(color, type) {
  const skinId = (window.cfg && cfg.skin) || 'classic';
  const skin = (window.SKINS && SKINS[skinId]) || SKINS.classic || GLYPH;
  if(skin.glyph && skin.glyph[color] && skin.glyph[color][type]) {
    return skin.glyph[color][type];
  }
  return GLYPH[color][type] || '?';
}

/* --- Вспомогательные функции для доски --- */
function findKing(board, color) {
  const k = color === 'w' ? 'K' : 'k';
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if(board[r][c] === k) return {r, c};
    }
  }
  return null;
}

function inCheck(board, color) {
  const king = findKing(board, color);
  if(!king) return false;
  const opp = color === 'w' ? 'b' : 'w';
  return isAttackedStatic(board, king.r, king.c, opp);
}

function isAttackedStatic(board, sqR, sqC, byColor) {
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      const p = board[r][c];
      if(p && pieceColorStatic(p) === byColor) {
        if(canAttackStatic(board, r, c, sqR, sqC)) return true;
      }
    }
  }
  return false;
}

function pieceColorStatic(p) {
  if(!p) return null;
  return p === p.toUpperCase() ? 'w' : 'b';
}

function pieceTypeStatic(p) {
  return p ? p.toLowerCase() : null;
}

function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function colorRow(color) { return color === 'w' ? 7 : 0; }

function canAttackStatic(board, fr, fc, tr, tc) {
  const p = board[fr][fc];
  if(!p) return false;
  const color = pieceColorStatic(p);
  const type = pieceTypeStatic(p);
  const opp = color === 'w' ? 'b' : 'w';
  const dr = tr - fr;
  const dc = tc - fc;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);

  if(type === 'p') {
    const dir = color === 'w' ? -1 : 1;
    return dr === dir && adc === 1;
  }
  if(type === 'n') {
    return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
  }
  if(type === 'b') {
    if(adr !== adc || adr === 0) return false;
    return clearDiagonal(board, fr, fc, tr, tc);
  }
  if(type === 'r') {
    if(dr !== 0 && dc !== 0) return false;
    return clearStraight(board, fr, fc, tr, tc);
  }
  if(type === 'q') {
    if(dr === 0 || dc === 0 || adr === adc) {
      if(adr === 0 && adc === 0) return false;
      return adr === adc ? clearDiagonal(board, fr, fc, tr, tc) : clearStraight(board, fr, fc, tr, tc);
    }
    return false;
  }
  if(type === 'k') {
    return adr <= 1 && adc <= 1 && (adr + adc > 0);
  }
  return false;
}

function clearDiagonal(board, fr, fc, tr, tc) {
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  let r = fr + dr, c = fc + dc;
  while(r !== tr || c !== tc) {
    if(board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function clearStraight(board, fr, fc, tr, tc) {
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  let r = fr + dr, c = fc + dc;
  while(r !== tr || c !== tc) {
    if(board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

/* --- Класс шахматной машины --- */
class ChessEngine {
  constructor(variant) {
    this.variant = variant || 'classic';
    this.resetBoard();
    this.moveHistory = [];
    this.positionHistory = [];
    this.gameOver = false;
    this.drawOffer = false;
    this.clockOn = false;
    this.time = {w: 600, b: 600};
  }

  resetBoard() {
    this.board = new Array(8).fill(null).map(() => new Array(8).fill(null));
    this.turn = 'w';
    this.ep = null;
    this.halfmove = 0;
    this.fullmove = 1;
    this.plyCount = 0;
    this.moveHistory = [];
    this.positionHistory = [];
    this.gameOver = false;
    this.castleRights = {wK:true, wQ:true, bK:true, bQ:true};
    this.fischerBackRow = null;
  }

  newGame() {
    this.resetBoard();
    
    if(this.variant === 'fischer960') {
      this.setupFischer960();
    } else {
      this.board[0] = ['r','n','b','q','k','b','n','r'];
      this.board[1] = ['p','p','p','p','p','p','p','p'];
      this.board[6] = ['P','P','P','P','P','P','P','P'];
      this.board[7] = ['R','N','B','Q','K','B','N','R'];
    }
    
    this.turn = 'w';
    this.ep = null;
    this.halfmove = 0;
    this.fullmove = 1;
    this.plyCount = 0;
    this.gameOver = false;
    this.moveHistory = [];
    this.positionHistory = [];
  }

  /* --- Загрузить позицию из FEN (фигуры, очередь, ep) --- */
  loadFen(fen) {
    const parts = String(fen || '').trim().split(/\s+/);
    const rows = parts[0] ? parts[0].split('/') : [];
    if(rows.length !== 8) return false;
    const board = [];
    for(let ri = 0; ri < 8; ri++) {
      const row = [];
      let c = 0;
      for(const ch of rows[ri]) {
        if(ch >= '1' && ch <= '8') {
          const n = parseInt(ch);
          for(let i = 0; i < n; i++) row.push(null);
          c += n;
        } else if(/^[prnbqkPRNBQK]$/.test(ch)) {
          row.push(ch);
          c++;
        } else return false;
      }
      if(row.length !== 8 || c !== 8) return false;
      board[ri] = row;
    }
    if(parts[1] && !/^[wb]$/.test(parts[1])) return false;
    if(parts[2] && !/^(-|[KQkqA-Ha-h]+)$/.test(parts[2])) return false;
    if(parts[3] && !/^(-|[a-h][36])$/.test(parts[3])) return false;
    if(board.flat().filter(p => p === 'K').length !== 1 ||
       board.flat().filter(p => p === 'k').length !== 1) return false;
    this.board = board;
    this.variant = 'classic';
    this.fischerBackRow = null;
    this.turn = (parts[1] || 'w') === 'b' ? 'b' : 'w';
    const cr = {wK:false, wQ:false, bK:false, bQ:false};
    const cast = parts[2];
    if(cast && cast !== '-') {
      if(cast.indexOf('K') !== -1) cr.wK = true;
      if(cast.indexOf('Q') !== -1) cr.wQ = true;
      if(cast.indexOf('k') !== -1) cr.bK = true;
      if(cast.indexOf('q') !== -1) cr.bQ = true;
      if(/[A-Ha-h]/.test(cast)) {
        this.variant = 'fischer960';
        this.fischerBackRow = new Array(8).fill(null);
        for(const letter of cast) {
          const color = letter === letter.toUpperCase() ? 'w' : 'b';
          const row = colorRow(color);
          const king = this.board[row].indexOf(color === 'w' ? 'K' : 'k');
          const rook = FILES.indexOf(letter.toLowerCase());
          if(king < 0 || rook < 0) continue;
          this.fischerBackRow[king] = 'k';
          this.fischerBackRow[rook] = 'r';
          cr[color + (rook > king ? 'K' : 'Q')] = true;
        }
      }
    }
    this.castleRights = cr;
    const ep = parts[3] && parts[3] !== '-' ? parts[3] : null;
    if(ep && /^[a-h][36]$/.test(ep)) {
      this.ep = { r: 8 - parseInt(ep[1]), c: ep.charCodeAt(0) - 97 };
    } else {
      this.ep = null;
    }
    this.halfmove = parts[4] ? parseInt(parts[4]) || 0 : 0;
    this.fullmove = parts[5] ? parseInt(parts[5]) || 1 : 1;
    this.plyCount = 0;
    this.moveHistory = [];
    this.positionHistory = [this.positionKey()];
    this.gameOver = false;
    this.opponentPlayerId = null;
    return true;
  }

  /* --- Фишер 960 с детерминированным seed (для мультиплеера) --- */
  newGameFischer960(seed) {
    this.resetBoard();
    this.variant = 'fischer960';
    const rand = this._mulberry32(seed >>> 0);
    this.setupFischer960(rand);
    this.turn = 'w';
    this.ep = null;
    this.halfmove = 0;
    this.fullmove = 1;
    this.plyCount = 0;
    this.gameOver = false;
    this.moveHistory = [];
    this.positionHistory = [];
  }

  /* --- Mulberry32: быстрый детерминированный PRNG --- */
  _mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  setupFischer960(randFn) {
    const rand = randFn || Math.random;
    const backRow = new Array(8).fill(null);
    backRow[2 * Math.floor(rand() * 4)] = 'b';
    backRow[2 * Math.floor(rand() * 4) + 1] = 'b';
    const place = type => {
      const free = backRow.map((p, c) => p ? -1 : c).filter(c => c !== -1);
      backRow[free[Math.floor(rand() * free.length)]] = type;
    };
    place('q');
    place('n');
    place('n');
    const remaining = backRow.map((p, c) => p ? -1 : c).filter(c => c !== -1);
    ['r', 'k', 'r'].forEach((p, i) => { backRow[remaining[i]] = p; });
    
    this.board[0] = backRow;
    this.board[1] = ['p','p','p','p','p','p','p','p'];
    this.board[6] = ['P','P','P','P','P','P','P','P'];
    this.board[7] = backRow.map(p => p.toUpperCase());
    
    // Store original back row for castling rights
    this.fischerBackRow = [...backRow];
  }

  pieceColor(p) { return p ? (p === p.toUpperCase() ? 'w' : 'b') : null; }
  pieceType(p) { return p ? p.toLowerCase() : null; }

  pseudoLegalMoves(fr, fc) {
    const p = this.board[fr][fc];
    if(!p) return [];
    const color = this.pieceColor(p);
    const type = this.pieceType(p);
    const opp = color === 'w' ? 'b' : 'w';
    const moves = [];

    const addMove = (tr, tc, extra) => {
      const target = this.board[tr][tc];
      if(target && (this.pieceColor(target) === color || this.pieceType(target) === 'k')) return;
      moves.push({fr, fc, tr, tc, type, capture: target ? pieceTypeStatic(target) : null, ...extra});
    };

    if(type === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startR = color === 'w' ? 6 : 1;
      const lastR = color === 'w' ? 0 : 7;
      // Forward
      if(inside(fr+dir, fc) && !this.board[fr+dir][fc]) {
        if(fr+dir === lastR) {
          ['q','r','b','n'].forEach(pt => moves.push({fr, fc, tr: fr+dir, tc: fc, type:'p', promo: pt}));
        } else {
          moves.push({fr, fc, tr: fr+dir, tc: fc, type:'p'});
        }
        // Double push
        if(fr === startR && !this.board[fr+2*dir][fc]) {
          moves.push({fr, fc, tr: fr+2*dir, tc: fc, type:'p', dbl:true});
        }
      }
      // Captures
      for(const dc of [-1, 1]) {
        const tr = fr + dir, tc = fc + dc;
        if(!inside(tr, tc)) continue;
        const target = this.board[tr][tc];
        if(target && this.pieceColor(target) === opp && this.pieceType(target) !== 'k') {
          if(tr === lastR) {
            ['q','r','b','n'].forEach(pt => moves.push({fr, fc, tr, tc, type:'p', capture: pieceTypeStatic(target), promo: pt}));
          } else {
            moves.push({fr, fc, tr, tc, type:'p', capture: pieceTypeStatic(target)});
          }
        }
        if(this.ep && this.ep.r === tr && this.ep.c === tc && !target &&
           this.board[fr][tc] === (color === 'w' ? 'p' : 'P')) {
          moves.push({fr, fc, tr, tc, type:'p', ep:true, capture:'p'});
        }
      }
    }
    if(type === 'n') {
      for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        if(inside(fr+dr, fc+dc)) addMove(fr+dr, fc+dc);
      }
    }
    if(type === 'b') {
      for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        for(let i = 1; i < 8; i++) {
          const tr = fr+dr*i, tc = fc+dc*i;
          if(!inside(tr, tc)) break;
          if(this.board[tr][tc]) {
            if(this.pieceColor(this.board[tr][tc]) === opp) addMove(tr, tc);
            break;
          }
          addMove(tr, tc);
        }
      }
    }
    if(type === 'r') {
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        for(let i = 1; i < 8; i++) {
          const tr = fr+dr*i, tc = fc+dc*i;
          if(!inside(tr, tc)) break;
          if(this.board[tr][tc]) {
            if(this.pieceColor(this.board[tr][tc]) === opp) addMove(tr, tc);
            break;
          }
          addMove(tr, tc);
        }
      }
    }
    if(type === 'q') {
      for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        for(let i = 1; i < 8; i++) {
          const tr = fr+dr*i, tc = fc+dc*i;
          if(!inside(tr, tc)) break;
          if(this.board[tr][tc]) {
            if(this.pieceColor(this.board[tr][tc]) === opp) addMove(tr, tc);
            break;
          }
          addMove(tr, tc);
        }
      }
    }
    if(type === 'k') {
      for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        if(inside(fr+dr, fc+dc)) addMove(fr+dr, fc+dc);
      }
      // Castling
      const row = color === 'w' ? 7 : 0;
      
      if(fr !== row) return moves;
      if(this.variant === 'fischer960') {
        // Select the original rook; final squares are always g/f or c/d.
        const original = this.fischerBackRow || [];
        if(fc === original.indexOf('k') && !this.inCheck(color)) {
          for(const castle of ['k', 'q']) {
            const rookCol = castle === 'k' ? original.lastIndexOf('r') : original.indexOf('r');
            if(this.canCastle960(color, fc, rookCol, castle)) {
              moves.push({fr, fc, tr: row, tc: rookCol, type: 'k', castle});
            }
          }
        }
      } else {
        // Standard castling (права рокировки + король строго на e-линии)
        const cr = this.castleRights || {};
        const side = color === 'w' ? 'w' : 'b';
        // King-side: king to g-file (col 6)
        const rook = this.board[row][7];
        if(fc === 4 && cr[side + 'K'] &&
           rook && pieceColorStatic(rook) === color && pieceTypeStatic(rook) === 'r') {
          if(!this.board[row][5] && !this.board[row][6]) {
            if(!this.inCheck(color) &&
               !isAttackedStatic(this.board, row, 5, color === 'w' ? 'b' : 'w') &&
               !isAttackedStatic(this.board, row, 6, color === 'w' ? 'b' : 'w')) {
              moves.push({fr, fc, tr: row, tc: 6, type: 'k', castle: 'k'});
            }
          }
        }
        // Queen-side: king to c-file (col 2)
        const rookQ = this.board[row][0];
        if(fc === 4 && cr[side + 'Q'] &&
           rookQ && pieceColorStatic(rookQ) === color && pieceTypeStatic(rookQ) === 'r') {
          if(!this.board[row][1] && !this.board[row][2] && !this.board[row][3]) {
            if(!this.inCheck(color) &&
               !isAttackedStatic(this.board, row, 3, color === 'w' ? 'b' : 'w') &&
               !isAttackedStatic(this.board, row, 2, color === 'w' ? 'b' : 'w')) {
              moves.push({fr, fc, tr: row, tc: 2, type: 'k', castle: 'q'});
            }
          }
        }
      }
    }
    return moves;
  }

  allLegalMoves(color) {
    const all = [];
    for(let r = 0; r < 8; r++) {
      for(let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if(p && this.pieceColor(p) === color) {
          for(const m of this.pseudoLegalMoves(r, c)) {
            if(this.isLegal(m)) all.push(m);
          }
        }
      }
    }
    return all;
  }

  isLegal(m) {
    // Simulate move on copy
    const saved = this.saveState();
    const color = this.pieceColor(this.board[m.fr][m.fc]);
    if(!color) return false;
    try {
      this.applyMove(m);
      return !this.inCheck(color);
    } finally {
      this.restoreState(saved);
    }
  }

  canCastle960(color, kingCol, rookCol, castle) {
    const row = colorRow(color);
    const key = color + (castle === 'k' ? 'K' : 'Q');
    if(!this.castleRights[key] || rookCol < 0 ||
       this.board[row][rookCol] !== (color === 'w' ? 'R' : 'r')) return false;
    const kingTo = castle === 'k' ? 6 : 2;
    const rookTo = castle === 'k' ? 5 : 3;
    for(const [from, to] of [[kingCol, kingTo], [rookCol, rookTo]]) {
      for(let c = Math.min(from, to); c <= Math.max(from, to); c++) {
        if(c !== kingCol && c !== rookCol && this.board[row][c]) return false;
      }
    }
    const transit = this.board.map(r => [...r]);
    transit[row][kingCol] = null;
    const opp = color === 'w' ? 'b' : 'w';
    const step = Math.sign(kingTo - kingCol);
    for(let c = kingCol; c !== kingTo; c += step) {
      if(isAttackedStatic(transit, row, c, opp)) return false;
    }
    transit[row][rookCol] = null;
    transit[row][rookTo] = color === 'w' ? 'R' : 'r';
    return !isAttackedStatic(transit, row, kingTo, opp);
  }

  applyMove(m) {
    const p = this.board[m.fr][m.fc];
    const color = this.pieceColor(p);

    const cr = this.castleRights;
    if(cr && color) {
      const side = color === 'w' ? 'w' : 'b';
      if(m.type === 'k') {
        cr[side + 'K'] = false;
        cr[side + 'Q'] = false;
      } else if(m.type === 'r') {
        if(this.variant === 'fischer960' && this.fischerBackRow) {
          if(m.fr === colorRow(color) && m.fc === this.fischerBackRow.lastIndexOf('r')) cr[side + 'K'] = false;
          if(m.fr === colorRow(color) && m.fc === this.fischerBackRow.indexOf('r')) cr[side + 'Q'] = false;
        } else if(m.fr === colorRow(color) && (m.fc === 0 || m.fc === 7)) {
          cr[side + (m.fc === 7 ? 'K' : 'Q')] = false;
        }
      }
      if(m.capture === 'r') {
        const tSide = m.tr === 0 ? 'b' : (m.tr === 7 ? 'w' : null);
        if(tSide) {
          if(this.variant === 'fischer960' && this.fischerBackRow) {
            if(m.tc === this.fischerBackRow.lastIndexOf('r')) cr[tSide + 'K'] = false;
            if(m.tc === this.fischerBackRow.indexOf('r')) cr[tSide + 'Q'] = false;
          } else if(m.tc === 0 || m.tc === 7) {
            cr[tSide + (m.tc === 7 ? 'K' : 'Q')] = false;
          }
        }
      }
    }

    if(m.ep) {
      this.board[m.fr][m.tc] = null;
    }
    if(m.castle && this.variant === 'fischer960') {
      // Sources may overlap destinations: clear both before placing either piece.
      this.board[m.fr][m.fc] = null;
      this.board[m.tr][m.tc] = null;
      this.board[m.tr][m.castle === 'k' ? 6 : 2] = p;
      this.board[m.tr][m.castle === 'k' ? 5 : 3] = color === 'w' ? 'R' : 'r';
    } else {
      this.board[m.tr][m.tc] = m.promo ? (color === 'w' ? m.promo.toUpperCase() : m.promo.toLowerCase()) : p;
      this.board[m.fr][m.fc] = null;
      if(m.castle) {
        const rookFrom = m.castle === 'k' ? 7 : 0;
        const rookTo = m.castle === 'k' ? 5 : 3;
        this.board[m.tr][rookTo] = this.board[m.tr][rookFrom];
        this.board[m.tr][rookFrom] = null;
      }
    }
    this.ep = m.dbl ? {r: (m.fr + m.tr) / 2, c: m.fc} : null;

    this.turn = color === 'w' ? 'b' : 'w';
    if(color === 'b') this.fullmove++;
    // Reset halfmove clock on capture or pawn move
    if(m.capture || m.type === 'p') this.halfmove = 0;
    else this.halfmove++;
    this.plyCount++;
  }

  makeMove(m) {
    // Save for undo
    if(!this.positionHistory.length) this.positionHistory.push(this.positionKey());
    this.moveHistory.push(this.saveState());
    this.applyMove(m);
    this.positionHistory.push(this.positionKey());
  }

  undoLastMove() {
    if(this.moveHistory.length === 0) return false;
    const state = this.moveHistory.pop();
    this.restoreState(state);
    this.positionHistory.pop();
    return true;
  }

  /* --- FEN-представление текущей позиции --- */
  rebuildPositionHistory() {
    const current = this.saveState();
    this.positionHistory = this.moveHistory.map(state => {
      this.restoreState(state);
      return this.positionKey();
    });
    this.restoreState(current);
    this.positionHistory.push(this.positionKey());
  }

  toFen() {
    const rows = [];
    for(let r = 0; r < 8; r++) {
      let s = '', gap = 0;
      for(let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if(p) {
          if(gap) { s += gap; gap = 0; }
          s += p;
        } else gap++;
      }
      if(gap) s += gap;
      rows.push(s);
    }
    const cr = this.castleRights || {};
    let castle = '';
    for(const color of ['w', 'b']) {
      for(const side of ['K', 'Q']) {
        if(!cr[color + side]) continue;
        let letter = side;
        if(this.variant === 'fischer960' && this.fischerBackRow) {
          const col = side === 'K' ? this.fischerBackRow.lastIndexOf('r') : this.fischerBackRow.indexOf('r');
          letter = FILES[col].toUpperCase();
        }
        castle += color === 'w' ? letter : letter.toLowerCase();
      }
    }
    if(!castle) castle = '-';
    let ep = '-';
    if(this.ep && this.ep.r !== undefined) ep = FILES[this.ep.c] + (8 - this.ep.r);
    return `${rows.join('/')} ${this.turn} ${castle} ${ep} ${this.halfmove} ${this.fullmove}`;
  }

  inCheck(color) {
    const king = findKing(this.board, color || this.turn);
    if(!king) return false;
    const opp = (color || this.turn) === 'w' ? 'b' : 'w';
    return isAttackedStatic(this.board, king.r, king.c, opp);
  }

  isCheckmate(color) {
    return this.inCheck(color) && this.allLegalMoves(color).length === 0;
  }

  isStalemate(color) {
    return !this.inCheck(color) && this.allLegalMoves(color).length === 0;
  }

  /* --- Хеш позиции для тройного повторения --- */
  positionKey() {
    const parts = this.toFen().split(' ');
    // An en-passant target distinguishes positions only if a legal capture exists.
    let ep = '-';
    if(this.ep) {
      const row = this.ep.r + (this.turn === 'w' ? 1 : -1);
      for(const col of [this.ep.c - 1, this.ep.c + 1]) {
        if(inside(row, col) && this.board[row][col] === (this.turn === 'w' ? 'P' : 'p') &&
           this.getLegalMoves(row, col).some(m => m.ep)) { ep = parts[3]; break; }
      }
    }
    return parts.slice(0, 3).join(' ') + ' ' + ep;
  }

  isThreefoldRepetition() {
    if(!this.positionHistory) this.positionHistory = [];
    const key = this.positionKey();
    let count = 0;
    for(const k of this.positionHistory) {
      if(k === key) count++;
      if(count >= 3) return true;
    }
    return false;
  }

  isInsufficientMaterial() {
    const pieces = {w: [], b: []};
    for(let r = 0; r < 8; r++) {
      for(let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if(p) {
          const col = pieceColorStatic(p);
          const typ = pieceTypeStatic(p);
          pieces[col].push(typ);
        }
      }
    }
    const wk = pieces.w.filter(t => t === 'k');
    const bk = pieces.b.filter(t => t === 'k');
    const wb = pieces.w.filter(t => t === 'b');
    const wn = pieces.w.filter(t => t === 'n');
    const bb = pieces.b.filter(t => t === 'b');
    const bn = pieces.b.filter(t => t === 'n');
    // K vs K
    if(pieces.w.length === 1 && pieces.b.length === 1) return true;
    // K+B vs K or K+N vs K
    if(wk.length === 1 && pieces.w.length === 2 && pieces.b.length === 1) {
      if(wb.length === 1 || wn.length === 1) return true;
    }
    if(bk.length === 1 && pieces.b.length === 2 && pieces.w.length === 1) {
      if(bb.length === 1 || bn.length === 1) return true;
    }
    // K+B vs K+B (same color bishops)
    if(pieces.w.length === 2 && pieces.b.length === 2 && wb.length === 1 && bb.length === 1) {
      let wBishop = null, bBishop = null;
      for(let r = 0; r < 8; r++) {
        for(let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if(p && pieceTypeStatic(p) === 'b') {
            if(pieceColorStatic(p) === 'w') wBishop = (r + c) % 2;
            else bBishop = (r + c) % 2;
          }
        }
      }
      if(wBishop === bBishop) return true;
    }
    return false;
  }

  /* --- Проверка правил ничьих --- */
  checkDrawRules() {
    if(this.halfmove >= 100) return '50-move';
    if(this.isThreefoldRepetition()) return 'repetition';
    if(this.isInsufficientMaterial()) return 'insufficient';
    return null;
  }

  getLegalMoves(fr, fc) {
    return this.pseudoLegalMoves(fr, fc).filter(m => this.isLegal(m));
  }

  evalPosition(color) {
    let value = 0;
    for(let r = 0; r < 8; r++) {
      for(let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if(p) {
          const v = VAL[pieceTypeStatic(p)] || 0;
          value += (pieceColorStatic(p) === color ? 1 : -1) * v;
        }
      }
    }
    return value;
  }

  saveState() {
    return {
      board: this.board.map(row => [...row]),
      turn: this.turn,
      ep: this.ep ? {...this.ep} : null,
      halfmove: this.halfmove,
      fullmove: this.fullmove,
      plyCount: this.plyCount,
      gameOver: this.gameOver,
      variant: this.variant,
      clockOn: this.clockOn,
      time: this.time ? {...this.time} : null,
      humanColor: this.humanColor,
      fischerBackRow: this.fischerBackRow ? [...this.fischerBackRow] : null,
      castleRights: this.castleRights ? {...this.castleRights} : null
    };
  }

  restoreState(state) {
    this.board = state.board.map(row => [...row]);
    this.turn = state.turn;
    this.ep = state.ep;
    this.halfmove = state.halfmove;
    this.fullmove = state.fullmove;
    this.plyCount = state.plyCount;
    this.gameOver = state.gameOver;
    if(state.variant) this.variant = state.variant;
    if(state.clockOn !== undefined) this.clockOn = state.clockOn;
    if(state.time !== undefined) this.time = state.time ? {...state.time} : null;
    if(state.humanColor) this.humanColor = state.humanColor;
    if(state.fischerBackRow !== undefined) this.fischerBackRow = state.fischerBackRow ? [...state.fischerBackRow] : null;
    if(state.castleRights) this.castleRights = {...state.castleRights};
  }

  /* --- Сохранение/загрузка в localStorage --- */
  saveToStorage() {
    try {
      const data = {
        state: this.saveState(),
        moveHistory: this.moveHistory,
        positionHistory: this.positionHistory || [],
        gameMoves: typeof gameMoves !== 'undefined' ? gameMoves : [],
        gameStartFen: typeof gameStartFen !== 'undefined' ? gameStartFen : this.toFen(),
        takenByW: typeof takenByW !== 'undefined' ? takenByW : [],
        takenByB: typeof takenByB !== 'undefined' ? takenByB : [],
        hintsLeft: typeof hintsLeft !== 'undefined' ? hintsLeft : 2,
        undosLeft: typeof undosLeft !== 'undefined' ? undosLeft : 3,
        lastMove: typeof lastMove !== 'undefined' ? lastMove : null,
        botId: typeof ProfilesManager !== 'undefined' && ProfilesManager.getCurrent() ? ProfilesManager.getCurrent().botId : null,
        activeBotOverride: typeof _activeBotOverride !== 'undefined' ? _activeBotOverride : null,
        cfg: {
          variant: this.variant,
          human: this.humanColor,
          bot: cfg.bot,
          skin: cfg.skin,
          modeId: cfg.modeId,
          gameMode: cfg.gameMode || 'classic',
          timeSec: cfg.timeSec || 0,
          timeInc: cfg.timeInc || 0
        },
        mp: cfg.gameMode === 'multiplayer' ? {
          lobbyId: ChesMP.lobbyId,
          myColor: ChesMP.myColor,
          opponent: ChesMP.opponent,
          isHost: ChesMP._isHost
        } : null
      };
      localStorage.setItem('chesher_save', JSON.stringify(data));
    } catch(e) {}
  }

  static loadFromStorage() {
    try {
      const raw = localStorage.getItem('chesher_save');
      if(!raw) return null;
      const data = JSON.parse(raw);
      if(!data || !data.state) return null;
      return data;
    } catch(e) {
      return null;
    }
  }

  static clearStorage() {
    localStorage.removeItem('chesher_save');
  }
}

// Глобальный доступ
window.VAL = VAL;
window.GLYPH = GLYPH;
window.FILES = FILES;
window.ChessEngine = ChessEngine;
window.getSkinGlyph = getSkinGlyph;
window.findKing = findKing;
window.inCheck = inCheck;
window.pieceColorStatic = pieceColorStatic;
window.pieceTypeStatic = pieceTypeStatic;
