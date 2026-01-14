// src/js/state/state.js

import { createInitialState } from './initialState.js';

const STORAGE_KEY = 'funifest_app_state';

/* =========================
   STATE (PRIVATE)
========================= */
let state = null;

/* =========================
   OBSERVERS
========================= */
const observers = {};

/* =========================
   HELPERS
========================= */
function notify(key) {
    if (observers[key]) {
        observers[key].forEach((cb) => cb(getState()));
    }

    // global observers (*)
    if (observers['*']) {
        observers['*'].forEach((cb) => cb(getState()));
    }
}

function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* =========================
   PUBLIC API
========================= */
export function initState({ source = 'skip', payload = null } = {}) {
    if (source === 'load' && payload) {
        state = payload;
    } else {
        state = createInitialState(source);
    }

    persist();
    notify('*');
}

export function getState() {
    return structuredClone(state);
}

export function setState(updater, notifyKey = '*') {
    state = updater(structuredClone(state));
    state.meta.lastUpdated = new Date().toISOString();

    persist();
    notify(notifyKey);
}

export function subscribe(key, callback) {
    if (!observers[key]) {
        observers[key] = [];
    }
    observers[key].push(callback);
}

export function unsubscribe(key, callback) {
    if (!observers[key]) return;
    observers[key] = observers[key].filter((cb) => cb !== callback);
}

export function loadStateFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {
        state = JSON.parse(saved);
        notify('*');
        return true;
    } catch (e) {
        console.error('Failed to load state from storage', e);
        return false;
    }
}
