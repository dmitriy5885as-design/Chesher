/**
 * MemeConfig — настройки Meme Mode
 * v0.15.0
 */
"use strict";

const PIECE_KEYS = ['K', 'Q', 'R', 'B', 'N', 'P'];
const PIECE_NAMES = { K: 'Король', Q: 'Ферзь', R: 'Ладья', B: 'Слон', N: 'Конь', P: 'Пешка' };
const PIECE_ICONS = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };

const MEME_EVENT_TYPES = ['check', 'capture', 'threat', 'defense', 'promotion', 'sacrifice', 'blunder', 'brilliant'];
const MEME_EVENT_NAMES = {
  check: 'Шах', capture: 'Взятие', threat: 'Угроза', defense: 'Защита',
  promotion: 'Превращение', sacrifice: 'Жертва', blunder: 'Зевок', brilliant: 'Крутой ход'
};

const MemeConfig = (() => {
  var DEFAULT_VIDEO = 'video/eto-chto-takoe-a.mp4';

  function defaultPresets() {
    return {
      check:      { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] },
      capture:    { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] },
      threat:     { w: [], b: [] },
      defense:    { w: [], b: [] },
      promotion:  { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] },
      sacrifice:  { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] },
      blunder:    { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] },
      brilliant:  { w: [DEFAULT_VIDEO], b: [DEFAULT_VIDEO] }
    };
  }

  function ensureArrays(obj) {
    ['w','b'].forEach(function(c) {
      if(typeof obj[c] === 'string') obj[c] = [obj[c]];
      if(!Array.isArray(obj[c])) obj[c] = [];
    });
  }

  function migratePresets(vp) {
    if(!vp) return defaultPresets();

    if(vp.check && typeof vp.check === 'object' && !Array.isArray(vp.check)) {
      var hasPieceKeys = PIECE_KEYS.some(function(pk) { return vp.check[pk]; });
      if(!hasPieceKeys) {
        var newP = defaultPresets();
        MEME_EVENT_TYPES.forEach(function(k) {
          if(vp[k] && vp[k].w) newP[k].w = Array.isArray(vp[k].w) ? vp[k].w : [vp[k].w];
          if(vp[k] && vp[k].b) newP[k].b = Array.isArray(vp[k].b) ? vp[k].b : [vp[k].b];
        });
        MEME_EVENT_TYPES.forEach(function(k) { ensureArrays(newP[k]); });
        return newP;
      } else {
        MEME_EVENT_TYPES.forEach(function(k) {
          if(!vp[k]) vp[k] = { w: [], b: [] };
          PIECE_KEYS.forEach(function(pk) {
            if(vp[k][pk]) {
              ensureArrays(vp[k][pk]);
            }
          });
          if(!Array.isArray(vp[k].w)) vp[k].w = [];
          if(!Array.isArray(vp[k].b)) vp[k].b = [];
        });
        return vp;
      }
    }

    MEME_EVENT_TYPES.forEach(function(k) {
      if(!vp[k]) vp[k] = { w: [], b: [] };
      ensureArrays(vp[k]);
    });
    return vp;
  }

  const DEFAULTS = {
    enabled: false,
    reactions: true,
    threats: true,
    sounds: true,
    videos: true,
    volume: 0.7,
    reactionDuration: 1500,
    minInterval: 3000,
    criticalBypass: true,
    advancedPerPiece: false,
    videoPresets: defaultPresets()
  };

  let config = { ...DEFAULTS };

  function load() {
    try {
      const raw = localStorage.getItem('chesher_meme_cfg');
      if(raw) {
        Object.assign(config, JSON.parse(raw));
        config.videoPresets = migratePresets(config.videoPresets);
      }
    } catch(e) {}
  }

  function save() {
    try {
      localStorage.setItem('chesher_meme_cfg', JSON.stringify(config));
    } catch(e) {}
  }

  function get(key) {
    return key ? config[key] : { ...config };
  }

  function set(key, value) {
    config[key] = value;
    save();
  }

  function toggle(key) {
    config[key] = !config[key];
    save();
    return config[key];
  }

  function reset() {
    config = { ...DEFAULTS };
    save();
  }

  function isMemeMode() {
    return config.enabled;
  }

  var MAX_PRESETS = 3;
  var PRESETS_KEY = 'chesher_meme_presets';

  function loadPresets() {
    try {
      var raw = localStorage.getItem(PRESETS_KEY);
      if(raw) return JSON.parse(raw);
    } catch(e) {}
    return [];
  }

  function savePresetsList(list) {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function getPresetSlots() {
    return loadPresets();
  }

  function savePreset(name, vp) {
    var list = loadPresets();
    var preset = { name: name, videoPresets: JSON.parse(JSON.stringify(vp)) };
    var existing = list.findIndex(function(p) { return p.name === name; });
    if(existing >= 0) {
      list[existing] = preset;
    } else {
      if(list.length >= MAX_PRESETS) list.shift();
      list.push(preset);
    }
    savePresetsList(list);
    return list;
  }

  function loadPreset(name) {
    var list = loadPresets();
    var p = list.find(function(x) { return x.name === name; });
    if(p) {
      config.videoPresets = migratePresets(JSON.parse(JSON.stringify(p.videoPresets)));
      save();
    }
    return config.videoPresets;
  }

  function deletePreset(name) {
    var list = loadPresets().filter(function(p) { return p.name !== name; });
    savePresetsList(list);
    return list;
  }

  function resetVideoPresets() {
    config.videoPresets = defaultPresets();
    save();
  }

  function getVideoForEvent(eventType, color, pieceType) {
    var vp = config.videoPresets;
    if(!vp || !vp[eventType]) return null;
    if(config.advancedPerPiece && pieceType && vp[eventType][pieceType]) {
      var arr = vp[eventType][pieceType][color];
      if(arr && arr.length) return arr[Math.floor(Math.random() * arr.length)];
      return null;
    }
    var arr = vp[eventType][color];
    if(arr && arr.length) return arr[Math.floor(Math.random() * arr.length)];
    return null;
  }

  function setPieceVideo(eventType, pieceType, color, videos) {
    var vp = config.videoPresets;
    if(!vp[eventType]) return;
    if(!vp[eventType][pieceType]) vp[eventType][pieceType] = { w: [], b: [] };
    vp[eventType][pieceType][color] = videos;
    save();
  }

  function getPieceVideos(eventType, pieceType, color) {
    var vp = config.videoPresets;
    if(!vp || !vp[eventType]) return [];
    if(config.advancedPerPiece && pieceType && vp[eventType][pieceType]) {
      return vp[eventType][pieceType][color] || [];
    }
    return vp[eventType][color] || [];
  }

  load();

  return { get, set, toggle, reset, isMemeMode, load, save,
    getPresetSlots, savePreset, loadPreset, deletePreset, resetVideoPresets, MAX_PRESETS,
    getVideoForEvent, setPieceVideo, getPieceVideos };
})();

const AVAILABLE_VIDEOS = [
  { file: 'video/eto-chto-takoe-a.mp4', name: 'Это что такое?!' },
  { file: 'video/why-are-you-running.mp4', name: 'Why are you running' },
  { file: 'video/this-is-sparta.mp4', name: 'This is Sparta' },
  { file: 'video/daaaammmmm.mp4', name: 'Даааааммм' },
  { file: 'video/МЫ В ДЕРЬМЕ.mp4', name: 'Мы в дерьме' },
  { file: 'video/НУ НАХЕР. НУ ТЫ.mp4', name: 'Ну нахер. Ну ты' },
  { file: 'video/Вот это поворот!.mp4', name: 'Вот это поворот!' },
  { file: 'video/А ЧЕ ТАК МОЖНО.mp4', name: 'А че так можно?' },
  { file: 'video/sho-opyat.mp4', name: 'Шо опять' },
  { file: 'video/oh-my-god-wowww.mp4', name: 'Oh my God wow' },
  { file: 'video/net.mp4', name: 'Нет!' },
  { file: 'video/gendalf-vlastelin.mp4', name: 'Гэндальф' },
  { file: 'video/chuvaaak-scary-movie.mp4', name: 'Чувак' },
  { file: 'video/a-lovko-ty-eto-pridumal.mp4', name: 'Ловко придумал' },
  { file: 'video/ЧТО ЗА УЖАС.mp4', name: 'Что за ужас' },
  { file: 'video/ТИТРЫ РОБЕРТ.mp4', name: 'Титры Роберт' },
  { file: 'video/zoolander-meme.mp4', name: 'Zoolander' },
  { file: 'video/polskaya-korova.mp4', name: 'Польская корова' },
  { file: 'video/uz-multa-idut.mp4', name: 'Уж мульта идут' },
  { file: 'video/qewrew.mp4', name: 'Qewrew' }
];

if(typeof window !== 'undefined') {
  window.MemeConfig = MemeConfig;
  window.AVAILABLE_VIDEOS = AVAILABLE_VIDEOS;
  window.PIECE_KEYS = PIECE_KEYS;
  window.PIECE_NAMES = PIECE_NAMES;
  window.PIECE_ICONS = PIECE_ICONS;
  window.MEME_EVENT_TYPES = MEME_EVENT_TYPES;
  window.MEME_EVENT_NAMES = MEME_EVENT_NAMES;
}
