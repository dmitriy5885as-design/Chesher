/**
 * MemeEventBus — шина событий для Meme Mode
 * Подписка/публикация событий между шахматным движком и meme-системой
 * v0.19.0
 */
"use strict";

const MemeEventBus = (() => {
  const listeners = {};
  let eventLog = [];
  const MAX_LOG = 100;

  /**
   * Подписаться на событие
   * @param {string} eventType - тип события (MOVE, CAPTURE, CHECK, etc.)
   * @param {function} callback - функция-обработчик
   * @returns {function} отписка
   */
  function subscribe(eventType, callback) {
    if(!listeners[eventType]) listeners[eventType] = [];
    listeners[eventType].push(callback);
    return () => {
      listeners[eventType] = listeners[eventType].filter(cb => cb !== callback);
    };
  }

  /**
   * Опубликовать событие
   * @param {string} eventType - тип события
   * @param {object} data - данные события
   */
  function publish(eventType, data) {
    const event = {
      type: eventType,
      data: data || {},
      timestamp: Date.now()
    };

    // Log
    eventLog.push(event);
    if(eventLog.length > MAX_LOG) eventLog.shift();

    // Notify listeners
    const cbs = listeners[eventType];
    if(cbs) {
      cbs.forEach(cb => {
        try { cb(event); } catch(e) { console.error('MemeEventBus error:', e); }
      });
    }

    // Also notify wildcard listeners
    const wildcards = listeners['*'];
    if(wildcards) {
      wildcards.forEach(cb => {
        try { cb(event); } catch(e) { console.error('MemeEventBus wildcard error:', e); }
      });
    }
  }

  /**
   * Очистить всех слушателей
   */
  function clear() {
    Object.keys(listeners).forEach(k => { delete listeners[k]; });
    eventLog = [];
  }

  /**
   * Получить лог событий
   */
  function getLog() {
    return [...eventLog];
  }

  /**
   * Количество слушателей
   */
  function listenerCount(eventType) {
    if(eventType) return (listeners[eventType] || []).length;
    return Object.values(listeners).reduce((s, arr) => s + arr.length, 0);
  }

  return { subscribe, publish, clear, getLog, listenerCount };
})();

if(typeof window !== 'undefined') {
  window.MemeEventBus = MemeEventBus;
}
