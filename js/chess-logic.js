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
    return dr === dir && adc === 1 && (board[tr][tc] === null || pieceColorStatic(board[tr][tc]) === opp);
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

  setupFischer960() {
    // Fisher Random Chess 960 - random back row placement
    const backRow = ['r','n','b','q','k','b','n','r'];
    
    // Shuffle using Fisher-Yates
    for(let i = backRow.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [backRow[i], backRow[j]] = [backRow[j], backRow[i]];
    }
    
    // Ensure bishops are on opposite colors
    const bishops = [];
    for(let i = 0; i < 8; i++) {
      if(backRow[i] === 'b') bishops.push(i);
    }
    if(bishops.length === 2) {
      const sameColor = (bishops[0] + bishops[1]) % 2 === 0;
      if(sameColor) {
        // Swap one bishop with a non-bishop on opposite color
        for(let i = 0; i < 8; i++) {
          if(backRow[i] !== 'b' && backRow[i] !== 'k' && backRow[i] !== 'q') {
            if((i + bishops[1]) % 2 === 1) {
              [backRow[i], backRow[bishops[1]]] = [backRow[bishops[1]], backRow[i]];
              break;
            }
          }
        }
      }
    }
    
    // Ensure king is between the two rooks
    const kingIdx = backRow.indexOf('k');
    const rookIndices = [];
    for(let i = 0; i < 8; i++) {
      if(backRow[i] === 'r') rookIndices.push(i);
    }
    if(rookIndices.length === 2) {
      if(kingIdx < rookIndices[0] || kingIdx > rookIndices[1]) {
        // Move king between rooks
        const newKingIdx = Math.floor((rookIndices[0] + rookIndices[1]) / 2);
        [backRow[kingIdx], backRow[newKingIdx]] = [backRow[newKingIdx], backRow[kingIdx]];
      }
    }
    
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
      if(target && this.pieceColor(target) === color) return;
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
        if(target && this.pieceColor(target) === opp) {
          if(tr === lastR) {
            ['q','r','b','n'].forEach(pt => moves.push({fr, fc, tr, tc, type:'p', capture: pieceTypeStatic(target), promo: pt}));
          } else {
            moves.push({fr, fc, tr, tc, type:'p', capture: pieceTypeStatic(target)});
          }
        }
        if(this.ep && this.ep.r === tr && this.ep.c === tc) {
          moves.push({fr, fc, tr, tc, type:'p', ep:true});
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
      
      if(this.variant === 'fischer960') {
        // Fischer 960 castling - king moves to rook's square
        const rooks = [];
        for(let c = 0; c < 8; c++) {
          if(this.board[row][c] && pieceTypeStatic(this.board[row][c]) === 'r' &&
             pieceColorStatic(this.board[row][c]) === color) {
            rooks.push(c);
          }
        }
        
        for(const rookCol of rooks) {
          // Check if all squares between king and rook are empty
          const minCol = Math.min(fc, rookCol);
          const maxCol = Math.max(fc, rookCol);
          let clear = true;
          for(let c = minCol + 1; c < maxCol; c++) {
            if(this.board[row][c]) { clear = false; break; }
          }
          
          if(clear) {
            // King must not be in check
            if(!this.inCheck(color)) {
              // King must not pass through attacked squares
              const opp = color === 'w' ? 'b' : 'w';
              const step = Math.sign(rookCol - fc);
              let safe = true;
              for(let c = fc; c !== rookCol + step; c += step) {
                if(c !== fc && isAttackedStatic(this.board, row, c, opp)) {
                  safe = false;
                  break;
                }
              }
              
              if(safe) {
                // Determine if king-side or queen-side
                const castleType = rookCol > fc ? 'k' : 'q';
                moves.push({fr, fc, tr: row, tc: rookCol, type: 'k', castle: castleType});
              }
            }
          }
        }
      } else {
        // Standard castling
        // King-side: king to g-file (col 6)
        const rook = this.board[row][7];
        if(rook && pieceColorStatic(rook) === color && pieceTypeStatic(rook) === 'r') {
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
        if(rookQ && pieceColorStatic(rookQ) === color && pieceTypeStatic(rookQ) === 'r') {
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
    this.applyMove(m);
    const inCheck = this.inCheck(saved.turn);
    this.restoreState(saved);
    return !inCheck;
  }

  applyMove(m) {
    const p = this.board[m.fr][m.fc];
    const color = this.pieceColor(p);

    if(m.ep) {
      this.board[m.fr][m.tc] = null;
    }
    this.board[m.tr][m.tc] = m.promo ? (color === 'w' ? m.promo.toUpperCase() : m.promo.toLowerCase()) : p;
    this.board[m.fr][m.fc] = null;

    if(m.dbl) {
      this.ep = {r: (m.fr + m.tr) / 2, c: m.fc};
    } else {
      this.ep = null;
    }

    if(m.type === 'k') {
      // Castling
      if(this.variant === 'fischer960') {
        // Fischer 960 - rook moves to king's original square
        if(m.castle) {
          const rookFrom = m.tc; // Rook is at king's destination
          const rookTo = m.fc;   // Rook moves to king's original square
          this.board[m.tr][rookTo] = this.board[m.tr][rookFrom];
          this.board[m.tr][rookFrom] = null;
        }
      } else {
        // Standard castling
        if(m.fc === 4 && m.tc === 6) { // King-side
          this.board[m.tr][5] = this.board[m.tr][7];
          this.board[m.tr][7] = null;
        }
        if(m.fc === 4 && m.tc === 2) { // Queen-side
          this.board[m.tr][3] = this.board[m.tr][0];
          this.board[m.tr][0] = null;
        }
      }
    }

    this.turn = color === 'w' ? 'b' : 'w';
    if(color === 'b') this.fullmove++;
    // Reset halfmove clock on capture or pawn move
    if(m.capture || m.type === 'p') this.halfmove = 0;
    else this.halfmove++;
    this.plyCount++;
  }

  makeMove(m) {
    // Save for undo
    this.moveHistory.push(this.saveState());
    this.applyMove(m);
  }

  undoLastMove() {
    if(this.moveHistory.length === 0) return false;
    const state = this.moveHistory.pop();
    this.restoreState(state);
    return true;
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
    return this.board.map(r => r.join('')).join('/') + ' ' + this.turn +
      (this.ep ? ' ' + this.ep.r + ',' + this.ep.c : '');
  }

  isThreefoldRepetition() {
    if(!this.positionHistory) this.positionHistory = [];
    const key = this.positionKey();
    this.positionHistory.push(key);
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
      const wBishop = null, bBishop = null;
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
      fischerBackRow: this.fischerBackRow ? [...this.fischerBackRow] : null
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
    if(state.time) this.time = {...state.time};
    if(state.humanColor) this.humanColor = state.humanColor;
    if(state.fischerBackRow) this.fischerBackRow = [...state.fischerBackRow];
  }

  /* --- Сохранение/загрузка в localStorage --- */
  saveToStorage() {
    try {
      const data = {
        state: this.saveState(),
        moveHistory: this.moveHistory.map(s => ({
          board: s.board.map(row => [...row]),
          turn: s.turn,
          ep: s.ep ? {...s.ep} : null,
          halfmove: s.halfmove,
          fullmove: s.fullmove,
          plyCount: s.plyCount,
          gameOver: s.gameOver
        })),
        positionHistory: this.positionHistory || [],
        cfg: {
          variant: this.variant,
          human: this.humanColor,
          bot: cfg.bot,
          skin: cfg.skin,
          modeId: cfg.modeId,
          gameMode: cfg.gameMode || 'classic',
          timeSec: cfg.timeSec || 0
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
