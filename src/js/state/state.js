import { createInitialState } from './initialState.js';

const STORAGE_WRITE_DELAY_MS = 150;

let pendingPersist = false;
let persistTimer = null;

function schedulePersist() {
    if (persistTimer) return;

    persistTimer = setTimeout(() => {
        persistTimer = null;

        if (pendingPersist) {
            pendingPersist = false;
            persistStateNow();
        }
    }, STORAGE_WRITE_DELAY_MS);
}

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
   NORMALIZATION
========================= */
function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function normalizeLoadedState(raw, source = 'load') {
    const base = createInitialState(source);

    if (!isPlainObject(raw)) return base;

    const rawMeta = isPlainObject(raw.meta) ? raw.meta : {};
    base.meta = { ...base.meta, ...rawMeta };

    const rawPeople = isPlainObject(raw.people) ? raw.people : {};
    base.people.skydivers = Array.isArray(rawPeople.skydivers)
        ? rawPeople.skydivers
        : base.people.skydivers;
    base.people.passengers = Array.isArray(rawPeople.passengers)
        ? rawPeople.passengers
        : base.people.passengers;

    base.parachutes = Array.isArray(raw.parachutes) ? raw.parachutes : base.parachutes;

    const rawPlans = isPlainObject(raw.plans) ? raw.plans : {};
    base.plans.list = Array.isArray(rawPlans.list) ? rawPlans.list : base.plans.list;
    base.plans.activeId =
        rawPlans.activeId === null || typeof rawPlans.activeId === 'number'
            ? rawPlans.activeId
            : base.plans.activeId;
    base.plans.activeStatus =
        typeof rawPlans.activeStatus === 'string'
            ? rawPlans.activeStatus
            : base.plans.activeStatus;

    const rawFlightPlan = isPlainObject(raw.flightPlan) ? raw.flightPlan : {};
    base.flightPlan.aircraft =
        typeof rawFlightPlan.aircraft === 'string'
            ? rawFlightPlan.aircraft
            : base.flightPlan.aircraft;
    base.flightPlan.time =
        typeof rawFlightPlan.time === 'string'
            ? rawFlightPlan.time
            : base.flightPlan.time;
    base.flightPlan.exitPlanId =
        rawFlightPlan.exitPlanId === null || typeof rawFlightPlan.exitPlanId === 'number'
            ? rawFlightPlan.exitPlanId
            : base.flightPlan.exitPlanId;
    base.flightPlan.slots = Array.isArray(rawFlightPlan.slots)
        ? rawFlightPlan.slots
        : base.flightPlan.slots;

    return base;
}

/* =========================
   HELPERS
========================= */
function notify(key) {
    const snapshot = structuredClone(state);

    if (observers[key]) {
        observers[key].forEach((cb) => cb(snapshot));
    }

    if (observers['*']) {
        observers['*'].forEach((cb) => cb(snapshot));
    }
}


function persistStateNow() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
}

function persist() {
    pendingPersist = true;
    schedulePersist();
}

/* =========================
   PUBLIC API
========================= */
export function initState({ source = 'skip', payload = null } = {}) {
    if (source === 'load' && payload) {
        state = normalizeLoadedState(payload, 'load');
    } else {
        state = createInitialState(source);
    }

    persistStateNow();
    notify('*');
}

export function getState() {
    return structuredClone(state);
}

export function setState(updater, notifyKey = '*') {
    state = updater(structuredClone(state));
    state.meta.lastUpdated = new Date().toISOString();

    persist();

    if (Array.isArray(notifyKey)) {
        const keys = [...new Set(notifyKey.filter((k) => typeof k === 'string' && k.length))];
        keys.forEach((k) => notify(k));
        return;
    }

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
        const parsed = JSON.parse(saved);
        state = normalizeLoadedState(parsed, 'load');
        notify('*');
        return true;
    } catch (e) {
        console.error('Failed to load state from storage', e);
        return false;
    }
}
