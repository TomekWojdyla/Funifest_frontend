/* =========================
   API CONFIG
========================= */
export const BASE_URL = 'http://localhost:5030/api';

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
        throw new Error(message);
    }

    return data;
}

/* =========================
   ENDPOINTS
========================= */
export const api = {
    // People
    getSkydivers: () => fetchJson('/skydiver'),
    getPassengers: () => fetchJson('/passenger'),

    // Parachutes
    getParachutes: () => fetchJson('/parachute'),

    // Exit plans
    getExitPlans: () => fetchJson('/exitplan'),
    getExitPlanById: (id) => fetchJson(`/exitplan/${id}`),

    // POST/DELETE (kolejny etap)
    createSkydiver: (payload) =>
        fetchJson('/skydiver', { method: 'POST', body: payload }),
    deleteSkydiver: (id) => fetchJson(`/skydiver/${id}`, { method: 'DELETE' }),

    createPassenger: (payload) =>
        fetchJson('/passenger', { method: 'POST', body: payload }),
    deletePassenger: (id) =>
        fetchJson(`/passenger/${id}`, { method: 'DELETE' }),

    createParachute: (payload) =>
        fetchJson('/parachute', { method: 'POST', body: payload }),
    deleteParachute: (id) => fetchJson(`/parachute/${id}`, { method: 'DELETE' }),

    createExitPlan: (payload) =>
        fetchJson('/exitplan', { method: 'POST', body: payload }),
    deleteExitPlan: (id) => fetchJson(`/exitplan/${id}`, { method: 'DELETE' }),
};
