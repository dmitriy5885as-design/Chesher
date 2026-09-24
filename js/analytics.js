/**
 * ЧЕШЕР — Аналитика (Яндекс.Метрика)
 * Вставь свой ID счётчика в YM_COUNTER_ID — и события пойдут в Метрику.
 * Пока ID не задан (null) — модуль молча работает в no-op.
 */
"use strict";

const YM_COUNTER_ID = null; // например: 12345678

const Analytics = {
  _ready: false,

  init() {
    if(this._ready || !YM_COUNTER_ID) return;
    this._ready = true;
    window.ym = window.ym || function() {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
    ym(YM_COUNTER_ID, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false
    });
    const s = document.createElement('script');
    s.src = 'https://mc.yandex.ru/metrika/tag.js';
    s.async = true;
    document.head.appendChild(s);
  },

  /* Экран: showScreen() -> Analytics.screen('scrShop') */
  screen(name) {
    if(!this._ready || typeof ym === 'undefined') return;
    try { ym(YM_COUNTER_ID, 'hit', '/' + name); } catch(e) {}
  },

  /* Событие: Analytics.track('purchase_gem_item', { id, price }) */
  track(goal, params) {
    if(!this._ready || typeof ym === 'undefined') return;
    try { ym(YM_COUNTER_ID, 'reachGoal', goal, params || {}); } catch(e) {}
  },

  /* Ошибка: Analytics.sendError('message') -> цель js_error в Метрике */
  sendError(message) {
    const msg = String((message && message.message) || message || 'unknown').slice(0, 200);
    if(typeof console !== 'undefined' && console.error) console.error('[Analytics.error]', msg);
    this.track('js_error', { message: msg });
  }
};

document.addEventListener('DOMContentLoaded', () => Analytics.init());

/* Глобальные обработчики ошибок -> Яндекс.Метрика */
if(typeof window !== 'undefined') {
  window.addEventListener('error', e => {
    try { Analytics.sendError(e.message || 'script error'); } catch(err) {}
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e && e.reason;
    try { Analytics.sendError((r && (r.message || r)) || 'unhandled rejection'); } catch(err) {}
  });
}
