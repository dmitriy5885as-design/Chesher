#!/usr/bin/env node
/**
 * Генерация CHANGELOG.md из git-коммитов и version.json
 *
 * Usage:
 *   node scripts/changelog.js              — вывод в консоль
 *   node scripts/changelog.js --write      — запись в CHANGELOG.md
 *   node scripts/changelog.js --json       — вывод JSON
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'version.json');
const OUT_FILE = path.join(ROOT, 'CHANGELOG.md');

// --- аргументы ---
const args = process.argv.slice(2);
const doWrite = args.includes('--write');
const doJson = args.includes('--json');

// --- читаем version.json ---
let releases = [];
try {
  releases = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'));
} catch (e) {
  console.error('Не удалось прочитать version.json:', e.message);
}

// --- собираем коммиты по тегам/датам ---
function gitLog(since, until) {
  const range = since ? `${since}..${until || 'HEAD'}` : (until || 'HEAD');
  try {
    const raw = execSync(
      `git log ${range} --pretty=format:"%H|%s|%an|%ai" --no-merges 2>/dev/null`,
      { cwd: ROOT, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return raw.split('\n').filter(Boolean).map(line => {
      const [hash, subject, author, date] = line.split('|');
      return { hash, subject, author, date: date?.trim() };
    });
  } catch {
    return [];
  }
}

// --- определяем предыдущий тег ---
function prevTag(currentVer) {
  const idx = releases.findIndex(r => r.ver === currentVer);
  if (idx < 0 || idx >= releases.length - 1) return null;
  return releases[idx + 1].ver;
}

// --- собираем CHANGELOG ---
const lines = [];
lines.push('# CHANGELOG\n');
lines.push('> Автоматически сгенерирован из git-коммитов и version.json\n');

for (const rel of releases) {
  const prev = prevTag(rel.ver);
  const from = prev || '';
  const commits = gitLog(from, rel.ver);
  const dates = rel.date || '';

  lines.push(`## ${rel.ver} (${dates})\n`);

  // items из version.json
  if (rel.items?.length) {
    for (const item of rel.items) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // коммиты (если есть и не дублируют items)
  if (commits.length) {
    lines.push('<details><summary>Коммиты</summary>\n');
    for (const c of commits) {
      const short = c.hash.slice(0, 7);
      lines.push(`- \`${short}\` ${c.subject} — ${c.author}`);
    }
    lines.push('\n</details>\n');
  }
}

const output = lines.join('\n');

if (doJson) {
  console.log(JSON.stringify(releases, null, 2));
} else if (doWrite) {
  fs.writeFileSync(OUT_FILE, output, 'utf-8');
  console.log(`✅ CHANGELOG.md записан (${releases.length} релизов)`);
} else {
  console.log(output);
}
