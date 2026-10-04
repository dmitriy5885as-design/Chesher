const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(require.resolve('../js/chess-logic.js'), 'utf8'), context);
const ChessEngine = context.window.ChessEngine;
function position(fen) {
  const engine = new ChessEngine();
  assert.equal(engine.loadFen(fen), true);
  return engine;
}
function play(engine, from, to) {
  const fc = from.charCodeAt(0) - 97, fr = 8 - Number(from[1]);
  const tc = to.charCodeAt(0) - 97, tr = 8 - Number(to[1]);
  const move = engine.getLegalMoves(fr, fc).find(m => m.tr === tr && m.tc === tc);
  assert.ok(move, `${from}-${to} must be legal`);
  engine.makeMove(move);
  return move;
}
function perft(engine, depth) {
  if(depth === 0) return 1;
  let count = 0;
  for(const move of engine.allLegalMoves(engine.turn)) {
    const saved = engine.saveState();
    engine.applyMove(move);
    count += perft(engine, depth - 1);
    engine.restoreState(saved);
  }
  return count;
}

test('classic move generation: perft depths 1-4', () => {
  const engine = new ChessEngine(); engine.newGame();
  for(const [depth, count] of [[1, 20], [2, 400], [3, 8902], [4, 197281]]) {
    assert.equal(perft(engine, depth), count);
  }
});

test('castling, checks and pinned pieces: Kiwipete perft', () => {
  const engine = position('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(engine, 1), 48);
  assert.equal(perft(engine, 2), 2039);
  assert.equal(perft(engine, 3), 97862);
});

test('draw queries never count as moves; initial position counts in repetition', () => {
  const engine = new ChessEngine(); engine.newGame();
  for(let i = 0; i < 8; i++) assert.equal(engine.isThreefoldRepetition(), false);
  for(let cycle = 0; cycle < 2; cycle++) {
    play(engine, 'g1', 'f3'); play(engine, 'g8', 'f6');
    play(engine, 'f3', 'g1'); play(engine, 'f6', 'g8');
    assert.equal(engine.isThreefoldRepetition(), cycle === 1);
  }
  engine.undoLastMove();
  assert.equal(engine.isThreefoldRepetition(), false);
  play(engine, 'f6', 'g8');
  assert.equal(engine.isThreefoldRepetition(), true);
  engine.rebuildPositionHistory();
  assert.equal(engine.isThreefoldRepetition(), true);
});

test('position identity preserves empty squares and castling rights', () => {
  const a = position('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  const b = position('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
  assert.notEqual(a.positionKey(), b.positionKey());
  const c = position('4k3/8/8/8/8/8/8/1R2K2R w - - 0 1');
  assert.notEqual(b.positionKey(), c.positionKey());
});

test('en passant counts as capture, cannot expose king, and normalizes unavailable targets', () => {
  const engine = position('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const move = play(engine, 'e5', 'd6');
  assert.equal(move.capture, 'p');
  assert.equal(engine.board[3][3], null);
  const pinned = position('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  assert.equal(pinned.getLegalMoves(3, 4).some(m => m.ep), false);
  const noEp = position('k3r3/8/8/3pP3/8/8/8/4K3 w - - 0 1');
  assert.equal(pinned.positionKey(), noEp.positionKey());
});

test('legal moves for either side check the moving king', () => {
  const engine = position('4k3/4r3/8/8/8/8/8/K3R3 w - - 0 1');
  assert.equal(engine.allLegalMoves('b').some(m => m.fr === 1 && m.fc === 4 && m.tc !== 4), false);
});

test('ordinary two-square king move must not move a rook', () => {
  const engine = position('4k3/8/8/8/8/8/4K3/7R w - - 0 1');
  // applyMove is used by analysis as well; only an explicit castle may move the rook.
  engine.applyMove({fr:6, fc:4, tr:7, tc:6, type:'k'});
  assert.equal(engine.board[7][7], 'R');
});

test('seeded Chess960 starts are valid and deterministic', () => {
  for(let seed = 0; seed < 2000; seed++) {
    const a = new ChessEngine(); a.newGameFischer960(seed);
    const b = new ChessEngine(); b.newGameFischer960(seed);
    assert.equal(a.toFen(), b.toFen());
    const row = a.fischerBackRow;
    const bishops = row.map((p, c) => p === 'b' ? c : -1).filter(c => c >= 0);
    assert.notEqual(bishops[0] % 2, bishops[1] % 2);
    assert.ok(row.indexOf('r') < row.indexOf('k') && row.indexOf('k') < row.lastIndexOf('r'));
    assert.equal(row.slice().sort().join(''), 'bbknnqrr');
  }
});

test('Chess960 castling retains both pieces for every king/rook origin pair, both colors', () => {
  for(const color of ['w', 'b']) {
    const row = color === 'w' ? 7 : 0;
    for(let king = 1; king <= 6; king++) {
      for(let rook = 0; rook < 8; rook++) {
        if(rook === king) continue;
        const castle = rook > king ? 'k' : 'q';
        const engine = new ChessEngine('fischer960');
        engine.board[row][king] = color === 'w' ? 'K' : 'k';
        engine.board[row][rook] = color === 'w' ? 'R' : 'r';
        engine.board[7 - row][4] = color === 'w' ? 'k' : 'K';
        engine.fischerBackRow = Array(8).fill(null);
        engine.fischerBackRow[king] = 'k'; engine.fischerBackRow[rook] = 'r';
        engine.turn = color;
        const move = engine.getLegalMoves(row, king).find(m => m.castle === castle);
        assert.ok(move, `${color} king ${king} rook ${rook}`);
        engine.makeMove(move);
        assert.equal(engine.board[row][castle === 'k' ? 6 : 2], color === 'w' ? 'K' : 'k');
        assert.equal(engine.board[row][castle === 'k' ? 5 : 3], color === 'w' ? 'R' : 'r');
        assert.equal(engine.board[row].filter(Boolean).length, 2);
        assert.equal(engine.castleRights[color + 'K'], false);
        engine.undoLastMove();
        assert.equal(engine.board[row][king], color === 'w' ? 'K' : 'k');
        assert.equal(engine.board[row][rook], color === 'w' ? 'R' : 'r');
      }
    }
  }
});

test('Chess960 cannot overwrite a blocker, cross check or uncover final check', () => {
  const engine = position('4k3/8/8/8/8/8/8/RK5R w HA - 0 1');
  engine.board[7][5] = 'N';
  assert.equal(engine.getLegalMoves(7, 1).some(m => m.castle === 'k'), false);
  engine.board[7][5] = null; engine.board[0][5] = 'r';
  assert.equal(engine.getLegalMoves(7, 1).some(m => m.castle === 'k'), false);
  const uncovered = position('4k3/8/8/8/8/8/8/rRK5 w B - 0 1');
  assert.equal(uncovered.getLegalMoves(7, 2).some(m => m.castle), false);
});

test('Shredder FEN round-trips rights; moved rooks cannot regain them', () => {
  const engine = new ChessEngine(); engine.newGameFischer960(123);
  const fen = engine.toFen();
  assert.equal(position(fen).toFen(), fen);
  const castle = position('4k3/8/8/8/8/8/8/RK5R w HA - 0 1');
  play(castle, 'h1', 'h2'); play(castle, 'e8', 'e7'); play(castle, 'h2', 'h1');
  assert.equal(castle.castleRights.wK, false);
  assert.equal(castle.castleRights.wQ, true);
  assert.equal(castle.toFen().split(' ')[2], 'A');
});

test('malformed FEN rejects without changing the board', () => {
  const engine = new ChessEngine(); engine.newGame();
  const original = engine.toFen();
  for(const fen of ['8/8/8/8/8/8/8/8 w - - 0 1', '4k3/8/8/8/8/8/8/4X3 w - - 0 1']) {
    assert.equal(engine.loadFen(fen), false);
    assert.equal(engine.toFen(), original);
  }
});
