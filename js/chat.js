/**
 * ЧЕШЕР — Чат и эмоции
 * Система сообщений, эмодзи, ответы бота
 * 
 * Основные функции:
 * - Chat.sendChat() — отправить сообщение в чат
 * - Chat.botReply() — ответ бота
 * - Chat.appendChat() — добавить сообщение в историю
 * - Chat.sendEmoji() — отправить эмодзи
 * - Chat.botReactEmoji() — реакция бота эмодзи
 */
"use strict";

/* --- Константы --- */
const CHAT_REPLIES = [
  'Хороший ход!', 'Хм, интересно...', '😎', 'Давай!',
  'Не так просто!', 'Ок', 'Принимаю!', 'Гг',
  'Сильный ход', 'Ну надо же', 'Подумаю...', '😎',
  'А ты не weak', 'Хах, ок', 'И有趣... ой, интересно',
  'Попробуй ещё', 'Давай, атакуй', 'Защита — моё всё'
];

const CHAT_KEYWORD_REPLIES = [
  { keys: ['привет', 'здравствуй', 'хай', 'hello', 'hi'], replies: ['Привет! Да начнётся игра!', 'Хо-хо! Привет!', 'Здарова!'] },
  { keys: ['пока', 'bye', 'до встречи'], replies: ['Пока! Удачи!', 'Бай! Играем дальше!'] },
  { keys: ['хаха', 'ахах', 'лол', 'хех', 'удачн'], replies: ['😎', 'Хех', 'Ну да'] },
  { keys: ['гг', 'gg', 'красав'], replies: ['Гг!', '😎', 'Ты тоже!'] },
  { keys: ['сдаюсь', 'gg wp'], replies: ['Не сдавайся!', 'Ещё не всё!'] },
  { keys: ['ходи', 'давай', 'твой ход'], replies: ['Уже думаю!', 'Спешить не надо!'] },
  { keys: ['как дела', 'как ты'], replies: ['Норм, играю!', 'Отлично, давай шахматы!'] },
];

const EMOTIONS = ['😀','😎','😱','😂','😤','🤔','👏','👍','👎','🤷','😴','🎉'];

/* --- Словарь матершинных слов (автозамена) --- */
const SWEAR_WORDS = [
  {w:'хуй', r:'спасибо'},
  {w:'хуя', r:'спасибо'},
  {w:'хую', r:'спасибо'},
  {w:'хуе', r:'спасибо'},
  {w:'пизд', r:'ненавижу'},
  {w:'пидор', r:'друг'},
  {w:'пидар', r:'друг'},
  {w:'пидр', r:'друг'},
  {w:'еба', r:'удивляюсь'},
  {w:'еби', r:'удивляюсь'},
  {w:'ебу', r:'удивляюсь'},
  {w:'ебёт', r:'удивляюсь'},
  {w:'ебаш', r:'удивляюсь'},
  {w:'бляд', r:'блин'},
  {w:'блят', r:'блин'},
  {w:'бляч', r:'блин'},
  {w:'сука', r:'подруга'},
  {w:'сук', r:'подруга'},
  {w:'сучк', r:'подруга'},
  {w:'нахуй', r:'ладно'},
  {w:'нахер', r:'ладно'},
  {w:'нахуя', r:'ладно'},
  {w:'охуе', r:'удивляюсь'},
  {w:'охуи', r:'удивляюсь'},
  {w:'хуйн', r:'замечательно'},
  {w:'мудак', r:'человек'},
  {w:'мудач', r:'человек'},
  {w:'говн', r:'приятно'},
  {w:'говно', r:'приятно'},
  {w:'дерьм', r:'приятно'},
  {w:'дерьмо', r:'приятно'},
  {w:'говна', r:'приятного'},
  {w:'жоп', r:'спину'},
  {w:'жопу', r:'спину'},
  {w:'ерунд', r:'прекрасно'},
  {w:'тварь', r:'цветочек'},
  {w:'твари', r:'цветочки'},
  {w:'урод', r:'человек'},
  {w:'уродк', r:'человек'},
  {w:'идиот', r:'умник'},
  {w:'идиотк', r:'умница'},
  {w:'дебил', r:'молодец'},
  {w:'долб', r:'оппонент'},
  {w:'чмо', r:'друг'},
  {w:'чмов', r:'друг'}
];

/* --- Фильтр матершинных слов --- */
function filterSwears(text) {
  let result = text;
  SWEAR_WORDS.forEach(s => {
    const regex = new RegExp(s.w + '[а-яА-Яё]*', 'gi');
    result = result.replace(regex, (match) => {
      const prefix = match[0] === match[0].toLowerCase() ? match[0] : match[0].toUpperCase();
      return prefix + '*'.repeat(match.length - 1);
    });
  });
  return result;
}

/* --- Статус мьюта --- */
let opponentMuted = false;

/* --- Добавить сообщение в чат --- */
function appendChat(sender, text) {
  if(sender === 'opp' && opponentMuted) return;
  
  const box = document.getElementById('chatMsgs');
  if(!box) return;
  
  const div = document.createElement('div');
  div.className = 'chatMsg ' + (sender === 'me' ? 'me' : 'opp');
  
  const now = new Date();
  const time = now.getHours().toString().padStart(2, '0') + ':' + 
               now.getMinutes().toString().padStart(2, '0');
  
  const filtered = filterSwears(text);
  let author = 'Вы';
  if(sender !== 'me') {
    if(cfg.bot !== 'off') {
      const cu = ProfilesManager.getCurrent();
      const botId = cu ? (cu.botId || 1) : 1;
      const bot = BOT_LIST.find(b => b.id === botId);
      author = bot ? bot.emoji + ' ' + bot.name : 'Бот';
    } else {
      author = 'Соперник';
    }
  }
  div.innerHTML = '<div class="author">' + author + '</div>' +
    '<div class="text">' + filtered.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' +
    '<div class="time">' + time + '</div>';
  
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

/* --- Отправка чата --- */
function sendChat() {
  const inp = document.getElementById('chatInput');
  if(!inp) return;
  const txt = inp.value.trim();
  if(!txt) return;
  
  appendChat('me', txt);
  inp.value = '';
  
  if(cfg.bot !== 'off') {
    setTimeout(() => botReply(txt), 600 + Math.random() * 1000);
  }
}

/* --- Ответ бота --- */
function botReply(msg) {
  if(!msg || opponentMuted) return;
  const lower = msg.toLowerCase();
  
  // Try keyword matching first
  for(const kw of CHAT_KEYWORD_REPLIES) {
    if(kw.keys.some(k => lower.includes(k))) {
      const r = kw.replies[Math.floor(Math.random() * kw.replies.length)];
      appendChat('opp', r);
      return;
    }
  }
  
  // Default random reply
  const r = CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)];
  appendChat('opp', r);
}

/* --- Отправка эмодзи --- */
function sendEmoji(side, emoji) {
  const popId = side === 'top' ? 'emoPopTop' : 'emoPopBot';
  const pop = document.getElementById(popId);
  if(!pop) return;
  
  const b = [...pop.querySelectorAll('.emBtn')].find(x => x.textContent === emoji);
  if(b) {
    b.classList.add('sent');
    setTimeout(() => b.classList.remove('sent'), 350);
  }
  
  flyEmoji(emoji);
  
  if(side === 'bot') {
    setTimeout(botReactEmoji, 800 + Math.random() * 1200);
  }
}

/* --- Летящий эмодзи --- */
function flyEmoji(emoji) {
  const box = document.getElementById('boardBox');
  if(!box) return;
  
  const d = document.createElement('div');
  d.textContent = emoji;
  d.style.cssText = `
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    pointer-events: none;
    z-index: 50;
    animation: flyE 1.2s ease-out forwards`;
  
  box.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

/* --- Реакция бота эмодзи --- */
function botReactEmoji() {
  if(cfg.bot === 'off' || opponentMuted) return;
  const responses = ['😎','😱','🤔','👏','😂','😤','😎','🤷'];
  const r = responses[Math.floor(Math.random() * responses.length)];
  flyEmoji(r);
}

/* --- Модалка эмодзи --- */
function buildEmotions(targetId) {
  const cont = document.getElementById(targetId);
  if(!cont) return;
  cont.innerHTML = '';
  EMOTIONS.forEach(e => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'emBtn';
    b.textContent = e;
    b.addEventListener('click', evt => {
      evt.stopPropagation();
      sendEmoji(targetId === 'emoPopTop' ? 'top' : 'bot', e);
    });
    cont.appendChild(b);
  });
}

/* --- Инициализация --- */
function initChat() {
  buildEmotions('emoPopBot');
  
  const pBot = document.getElementById('pBot');
  const emPop = document.getElementById('emoPopBot');
  if(pBot && emPop) {
    pBot.addEventListener('click', (e) => {
      e.stopPropagation();
      const show = emPop.classList.toggle('show');
      if(show) {
        const r = pBot.getBoundingClientRect();
        emPop.style.left = r.left + 'px';
        emPop.style.bottom = (window.innerHeight - r.top + 6) + 'px';
        emPop.style.top = 'auto';
        emPop.style.right = 'auto';
      }
    });
    document.addEventListener('click', () => {
      emPop.classList.remove('show');
    });
  }

  const muteBtn = document.getElementById('muteBtn');
  if(muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      opponentMuted = !opponentMuted;
      muteBtn.textContent = opponentMuted ? '🔇' : '🔊';
      muteBtn.classList.toggle('muted', opponentMuted);
      let muteName = 'Соперник';
      if(cfg.bot !== 'off') {
        const cu = ProfilesManager.getCurrent();
        const botId = cu ? (cu.botId || 1) : 1;
        const bot = BOT_LIST.find(b => b.id === botId);
        if(bot) muteName = bot.emoji + ' ' + bot.name;
      }
      toast(opponentMuted ? '🔇 ' + muteName + ' заглушён' : '🔊 ' + muteName + ' включён');
    });
  }

  const chatInp = document.getElementById('chatInput');
  if(chatInp) {
    chatInp.addEventListener('input', () => {
      chatInp.value = filterSwears(chatInp.value);
    });
  }
}

// Запуск при DOMContentLoaded
document.addEventListener('DOMContentLoaded', initChat);

if(typeof window !== 'undefined') {
  window.Chat = {appendChat, sendChat, botReply, sendEmoji, flyEmoji, botReactEmoji, buildEmotions, filterSwears, get opponentMuted() { return opponentMuted; }};
}