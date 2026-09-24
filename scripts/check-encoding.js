#!/usr/bin/env node
/**
 * check-encoding.js — анти-mojibake проверка для CI.
 * index.html, version.json и все js/css обязаны быть строгим UTF-8
 * без U+FFFD и без следов cp1251-мусора.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['index.html', 'version.json', 'package.json', 'sw.js'];

// Собираем также все js/css
function walk(dir, out) {
  for(const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if(entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if(entry.isDirectory()) walk(p, out);
    else if(/\.(js|css|html|json)$/.test(entry.name)) out.push(p);
  }
}
const files = [...new Set(TARGETS.map(f => path.join(ROOT, f)))];
walk(ROOT, files);

let failed = 0;
for(const file of files) {
  if(!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const rel = path.relative(ROOT, file);

  // Строгий UTF-8: битые последовательности -> ошибка
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch(e) {
    console.error('[FAIL] ' + rel + ': not valid UTF-8');
    failed++;
    continue;
  }
  if(text.includes(String.fromCharCode(0xFFFD))) {
    console.error('[FAIL] ' + rel + ': contains U+FFFD replacement char');
    failed++;
  }
  // Классический мусор cp1251/latin1 в UTF-8 (Ð, Ñ + мусорные байты)
  if(/[\u00C0-\u00DF][\u0080-\u00BF]/.test(text) || /\u0460|\u0472|\u0474/.test(text)) {
    console.error('[FAIL] ' + rel + ': possible mojibake sequences');
    failed++;
  }
}

if(failed) {
  console.error('Encoding check FAILED: ' + failed + ' file(s)');
  process.exit(1);
}
console.log('Encoding check OK: ' + files.length + ' files, strict UTF-8');
