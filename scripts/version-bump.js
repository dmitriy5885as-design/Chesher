#!/usr/bin/env node
/**
 * version-bump.js
 * Автоматическое формирование патчей и минорных версий из git-коммитов.
 *
 * Использование:
 *   node scripts/version-bump.js          — минорный бамп (0.23.0 → 0.24.0)
 *   node scripts/version-bump.js patch    — патч (0.23.0 → 0.23.1)
 *   node scripts/version-bump.js 0.25.0   — явная версия
 *
 * Что делает:
 * 1. Читает git log с момента последнего коммита version.json
 * 2. Классифицирует: BREAKING → minor, fix/feat/emoji → patch, остальное → patch
 * 3. Генерирует запись в version.json
 * 4. Обновляет version в main menu (index.html)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT, 'version.json');
const INDEX_FILE = path.join(ROOT, 'index.html');

// ─── helpers ──────────────────────────────────────────────────────────────────

function sh(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function parseVersion(v) {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function fmtVersion(v) {
  return `v${v.major}.${v.minor}.${v.patch}`;
}

function today() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ─── main ─────────────────────────────────────────────────────────────────────

function main() {
  const arg = (process.argv[2] || 'minor').toLowerCase();

  // 1. Read current version.json
  let log = [];
  try {
    log = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
  } catch (e) {
    console.error('Cannot read version.json:', e.message);
    process.exit(1);
  }

  const latest = log.length ? log[0].ver : 'v0.0.0';
  const cur = parseVersion(latest);
  if (!cur) {
    console.error('Invalid latest version:', latest);
    process.exit(1);
  }

  // 2. Determine new version
  let next;
  if (arg === 'patch') {
    next = { ...cur, patch: cur.patch + 1 };
  } else if (arg === 'minor') {
    next = { ...cur, minor: cur.minor + 1, patch: 0 };
  } else if (arg.startsWith('v') || /^\d/.test(arg)) {
    next = parseVersion(arg);
    if (!next) {
      console.error('Invalid version argument:', arg);
      process.exit(1);
    }
  } else {
    next = { ...cur, minor: cur.minor + 1, patch: 0 };
  }

  const newVer = fmtVersion(next);
  console.log(`Version: ${latest} → ${newVer}`);

  // 3. Git log since last version.json change
  let commits = [];
  try {
    // Find last commit that touched version.json
    const lastVersionCommit = sh(
      'git log -1 --format="%H" -- version.json'
    );
    if (lastVersionCommit) {
      const raw = sh(`git log ${lastVersionCommit}..HEAD --oneline --no-merges`);
      if (raw) {
        commits = raw.split('\n').map(line => {
          const m = line.match(/^[a-f0-9]+ (.+)$/);
          return m ? m[1] : line;
        });
      }
    } else {
      // No version.json commit found — get all commits
      const raw = sh('git log --oneline --no-merges -50');
      if (raw) {
        commits = raw.split('\n').map(line => {
          const m = line.match(/^[a-f0-9]+ (.+)$/);
          return m ? m[1] : line;
        });
      }
    }
  } catch (e) {
    // Fallback: use recent commits
    try {
      const raw = sh('git log --oneline --no-merges -20');
      if (raw) {
        commits = raw.split('\n').map(line => {
          const m = line.match(/^[a-f0-9]+ (.+)$/);
          return m ? m[1] : line;
        });
      }
    } catch (e2) {
      console.warn('No git history available');
    }
  }

  // 4. Filter out version-bump commits and auto-generated ones
  commits = commits.filter(c =>
    !c.startsWith('version-bump') &&
    !c.startsWith('Auto-version') &&
    !c.includes('version.json') &&
    !c.includes('bump version')
  );

  if (commits.length === 0) {
    console.log('No new commits since last version.');
    console.log('Creating empty patch entry...');
  }

  // 5. Clean up commit messages — remove prefixes like "feat:", "fix:", etc.
  const items = commits.map(c => {
    let text = c
      .replace(/^(feat|fix|chore|style|refactor|perf|test|docs|ci|build)[:(]/i, '')
      .replace(/^:/, '')
      .trim();
    // Capitalize first letter
    if (text) text = text.charAt(0).toUpperCase() + text.slice(1);
    return text;
  });

  // 6. Add entry to version.json
  const entry = {
    ver: newVer,
    date: today(),
    items: items.length ? items : ['Обновление версии']
  };

  log.unshift(entry);

  // 7. Write version.json
  fs.writeFileSync(VERSION_FILE, JSON.stringify(log, null, 2) + '\n', 'utf8');
  console.log(`Updated version.json with ${items.length} items`);

  // 8. Update index.html — menuFoot version
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const footRe = /(<div class="menuFoot">CHESHER )v[\d.]+(\s*alpha<\/div>)/;
  if (footRe.test(html)) {
    html = html.replace(footRe, `$1${newVer}$2`);
    fs.writeFileSync(INDEX_FILE, html, 'utf8');
    console.log(`Updated menuFoot in index.html → ${newVer}`);
  } else {
    console.warn('Could not find menuFoot in index.html');
  }

  console.log(`\n✅ Done! ${newVer} (${today()})`);
}

main();
