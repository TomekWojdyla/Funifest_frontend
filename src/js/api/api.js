/* =========================
   API CONFIG
========================= */
export const BASE_URL = 'http://localhost:5030/api';

export function getAppMode() {
    return sessionStorage.getItem('funifest_mode') || 'online';
}

export function isOfflineMode() {
    const m = getAppMode();
    return m === 'offline' || m === 'offline-lost';
}

export function markOfflineLostSignal() {
    sessionStorage.setItem('funifest_mode', 'offline-lost');
}


/* =========================
   CORE FETCH
========================= */
export async function fetchJson(path, options = {}) {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

    const headers = new Headers(options.headers || {});
    const hasBody = options.body !== undefined && options.body !== null;

    let body = options.body;
    if (hasBody && typeof body !== 'string') {
        body = JSON.stringify(body);
    }

    if (hasBody && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    let response;
    try {
        response = await fetch(url, { ...options, headers, body });
    } catch {
        markOfflineLostSignal();
        throw new Error('Network error');
    }

    const contentType = response.headers.get('content-type') || '';
    let data = null;

    if (contentType.includes('application/json')) {
        try {
            data = await response.json();
        } catch {
            data = null;
        }
    } else {
        try {
            const text = await response.text();
            data = text === '' ? null : { message: text };
        } catch {
            data = null;
        }
    }

    if (!response.ok) {
        const message =
            data && (data.error || data.message)
                ? data.error || data.message
                : `HTTP ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        err.data = data;
        throw err;
    }

    return data;
}

/* =========================
   ENDPOINTS
========================= */
export const api = {
    /* =========================
       PEOPLE: SKYDIVERS
    ========================= */
    getSkydivers: () => fetchJson('/skydiver'),
    createSkydiver: (payload) =>
        fetchJson('/skydiver', { method: 'POST', body: payload }),
    deleteSkydiver: (id) => fetchJson(`/skydiver/${id}`, { method: 'DELETE' }),
    blockSkydiver: (id) => fetchJson(`/skydiver/${id}/block`, { method: 'PUT' }),
    unblockSkydiver: (id) =>
        fetchJson(`/skydiver/${id}/unblock`, { method: 'PUT' }),

    /* =========================
       PEOPLE: PASSENGERS
    ========================= */
    getPassengers: () => fetchJson('/passenger'),
    createPassenger: (payload) =>
        fetchJson('/passenger', { method: 'POST', body: payload }),
    deletePassenger: (id) =>
        fetchJson(`/passenger/${id}`, { method: 'DELETE' }),
    blockPassenger: (id) =>
        fetchJson(`/passenger/${id}/block`, { method: 'PUT' }),
    unblockPassenger: (id) =>
        fetchJson(`/passenger/${id}/unblock`, { method: 'PUT' }),

    /* =========================
       PARACHUTES
    ========================= */
    getParachutes: () => fetchJson('/parachute'),
    createParachute: (payload) =>
        fetchJson('/parachute', { method: 'POST', body: payload }),
    deleteParachute: (id) => fetchJson(`/parachute/${id}`, { method: 'DELETE' }),
    blockParachute: (id) =>
        fetchJson(`/parachute/${id}/block`, { method: 'PUT' }),
    unblockParachute: (id) =>
        fetchJson(`/parachute/${id}/unblock`, { method: 'PUT' }),

    /* =========================
       EXIT PLANS
    ========================= */
    getExitPlans: () => fetchJson('/exitplan'),
    getExitPlanById: (id) => fetchJson(`/exitplan/${id}`),

    createExitPlan: (payload) =>
        fetchJson('/exitplan', { method: 'POST', body: payload }),
    updateExitPlan: (id, payload) =>
        fetchJson(`/exitplan/${id}`, { method: 'PUT', body: payload }),
    deleteExitPlan: (id) => fetchJson(`/exitplan/${id}`, { method: 'DELETE' }),

    dispatchExitPlan: (id) =>
        fetchJson(`/exitplan/${id}/dispatch`, { method: 'POST' }),
    undoDispatchExitPlan: (id) =>
        fetchJson(`/exitplan/${id}/undo-dispatch`, { method: 'POST' }),
};
