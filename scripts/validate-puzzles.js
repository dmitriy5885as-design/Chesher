/**
 * Валидация банка задач дня движком (без браузера).
 * Запуск: node scripts/validate-puzzles.js
 * Проверяет: легальность line/fen, легальность каждого хода solution,
 * финальное условие (mate/stalemate), флаг only (ровно 1 легальный ход).
 */
"use strict";
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isFinite: isFinite,
  String: String,
  Number: Number,
  Array: Array,
  Object: Object,
  Error: Error,
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(src, sandbox, { filename: file });
}

load('js/chess-logic.js');
load('js/puzzle-data.js');
load('js/puzzles.js');

const Puzzles = sandbox.Puzzles;
const bank = sandbox.PUZZLE_BANK;

let failed = 0;
console.log('Банк задач: ' + bank.length + ' записей\n');

for(const entry of bank) {
  const built = Puzzles.build(entry);
  if(built) {
    const specials = [];
    if(entry.players) specials.push(entry.players + ', ' + entry.place + ', ' + entry.year);
    console.log('OK   ' + entry.id.padEnd(16) + ' [' + entry.difficulty + '] ' +
      entry.types.join(',') + (specials.length ? '  (' + specials[0] + ')' : ''));
  } else {
    failed++;
    console.log('FAIL ' + entry.id.padEnd(16) + ' — не прошёл валидацию (line/fen/solution/expect)');
  }
}

// Детерминизм выбора: одинаковая дата => одинаковая задача
const k = Puzzles.todayKey(new Date(2026, 9, 2)); // 2026-10-02
const a = Puzzles.select(k), b = Puzzles.select(k);
if(!a || a.id !== b.id) { failed++; console.log('FAIL детерминизм выбора по дате'); }
else console.log('\nДетерминизм: OK (2026-10-02 -> ' + a.id + ')');

// Покрытие ротации: каждый день недели имеет >=1 кандидата
for(let wd = 0; wd <= 6; wd++) {
  const types = sandbox.PUZZLE_WEEKDAY_TYPES[wd];
  const pool = bank.filter(e => e.types.some(t => types.indexOf(t) !== -1));
  if(!pool.length) { failed++; console.log('FAIL нет записей для weekday=' + wd); }
}
console.log('Ротация по дням недели: OK');

// Особые дни имеют записи
for(const mmdd of Object.keys(sandbox.PUZZLE_SPECIAL_DAYS)) {
  const type = sandbox.PUZZLE_SPECIAL_DAYS[mmdd].type;
  const pool = bank.filter(e => e.types.indexOf(type) !== -1);
  if(!pool.length) { failed++; console.log('FAIL особый день ' + mmdd + ' (' + type + ') без записей'); }
}
console.log('Особые дни: OK');

// Таксономия: каждый тип из PUZZLE_TYPES хоть раз используется
const used = new Set();
bank.forEach(e => e.types.forEach(t => used.add(t)));
const unused = Object.keys(sandbox.PUZZLE_TYPES).filter(t => !used.has(t));
if(unused.length) console.log('Замечание: типы без записей (допустимо, есть fallback): ' + unused.join(', '));

console.log(failed ? '\nИТОГ: ОШИБОК — ' + failed : '\nИТОГ: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exit(failed ? 1 : 0);
