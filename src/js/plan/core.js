const PLAN_LEFT_COLLAPSE_KEY = 'funifest.ui.plan.left.collapsed';


function readPlanLeftCollapsed() {
    try {
        const raw = localStorage.getItem(PLAN_LEFT_COLLAPSE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writePlanLeftCollapsed(map) {
    try {
        localStorage.setItem(PLAN_LEFT_COLLAPSE_KEY, JSON.stringify(map || {}));
    } catch {}
}

function applyPlanLeftSectionState(headerEl, contentEl, collapsed) {
    contentEl.style.display = collapsed ? 'none' : '';
    headerEl.setAttribute('aria-expanded', String(!collapsed));

    const indicator = headerEl.querySelector('[data-collapse-indicator="1"]');
    if (indicator) indicator.textContent = collapsed ? '▸ ' : '▾ ';
}

function initPlanLeftCollapsibles() {
    const left = document.querySelector('.plan-left');
    if (!left) return;

    const headers = Array.from(left.querySelectorAll('h3'));

    headers.forEach((h, idx) => {
        const content = h.nextElementSibling;
        if (!content || !(content instanceof HTMLElement)) return;

        const key = content.id || h.textContent.trim() || String(idx);
        const collapsedMap = readPlanLeftCollapsed();
        const collapsed = collapsedMap[key] === true;

        h.style.cursor = 'pointer';
        h.tabIndex = 0;
        h.setAttribute('role', 'button');

        if (!h.querySelector('[data-collapse-indicator="1"]')) {
            const span = document.createElement('span');
            span.setAttribute('data-collapse-indicator', '1');
            span.textContent = collapsed ? '▸ ' : '▾ ';
            h.prepend(span);
        }

        applyPlanLeftSectionState(h, content, collapsed);

        const toggle = () => {
            const nextCollapsed = content.style.display !== 'none';
            writePlanLeftCollapsed({ ...readPlanLeftCollapsed(), [key]: nextCollapsed });
            applyPlanLeftSectionState(h, content, nextCollapsed);
        };

        h.onclick = toggle;
        h.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        };
    });
}

/* =========================
   HELPERS
========================= */
function getFirstFreeSlot(slots) {
    for (let i = 1; i <= 5; i++) {
        if (!slots.find((s) => s.slotNumber === i)) return i;
    }
    return null;
}

function normalizeTimeValue(v) {
    if (!v || typeof v !== 'string') return '';
    const m = v.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return '';
    const hh = String(m[1]).padStart(2, '0');
    return `${hh}:${m[2]}`;
}

function getTimePartsInWarsaw(date = new Date()) {
    const parts = new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const map = {};
    for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
    }

    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second),
    };
}

function getTimeZoneOffsetMinutes(timeZone, date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const map = {};
    for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
    }

    const asUtc = Date.UTC(
        Number(map.year),
        Number(map.month) - 1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
    );

    return Math.round((asUtc - date.getTime()) / 60000);
}

function zonedTimeToUtcMs(year, month, day, hour, minute, timeZone = 'Europe/Warsaw') {
    let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

    for (let i = 0; i < 2; i++) {
        const guess = new Date(utcMs);
        const offsetMin = getTimeZoneOffsetMinutes(timeZone, guess);
        utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMin * 60000;
    }

    return utcMs;
}

function parseApiDate(dateValue) {
    if (!dateValue) return null;

    const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(dateValue);
    if (hasTz) {
        const d = new Date(dateValue);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const m = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) {
        const d = new Date(dateValue);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);

    const utcMs = zonedTimeToUtcMs(year, month, day, hour, minute, 'Europe/Warsaw');
    const d = new Date(utcMs);
    return Number.isNaN(d.getTime()) ? null : d;
}

function getNowTimeValue() {
    const t = getTimePartsInWarsaw();
    const hh = String(t.hour).padStart(2, '0');
    const mm = String(t.minute).padStart(2, '0');
    return `${hh}:${mm}`;
}

function buildDateIsoFromTime(timeValue) {
    const base = getTimePartsInWarsaw();
    const normalized = normalizeTimeValue(timeValue) || getNowTimeValue();
    const [hh, mm] = normalized.split(':').map((x) => Number(x));

    const utcMs = zonedTimeToUtcMs(base.year, base.month, base.day, hh, mm, 'Europe/Warsaw');
    return new Date(utcMs).toISOString();
}

function extractTimeFromDate(dateValue) {
    const d = parseApiDate(dateValue);
    if (!d) return '';

    return new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(d);
}

function toApiPersonType(personType) {
    return personType === 'skydiver' ? 'Skydiver' : 'Passenger';
}

function buildExitPlanPayload(state) {
    return {
        date: buildDateIsoFromTime(state.flightPlan.time),
        aircraft: state.flightPlan.aircraft,
        slots: state.flightPlan.slots
            .slice()
            .sort((a, b) => a.slotNumber - b.slotNumber)
            .map((s) => ({
                slotNumber: s.slotNumber,
                personId: s.personId,
                personType: toApiPersonType(s.personType),
                parachuteId: s.parachuteId,
            })),
    };
}

function inferTandemInstructorId({ slots, skydivers }, passengerSlot) {
    if (!passengerSlot.parachuteId) return null;

    const match = slots
        .filter((s) => s.personType === 'skydiver')
        .find((s) => s.parachuteId === passengerSlot.parachuteId);

    if (!match) return null;

    const person = skydivers.find((s) => s.id === match.personId);
    if (!person || person.isTandemInstructor !== true) return null;

    return match.personId;
}

function normalizeStatus(rawStatus) {
    if (rawStatus === 1) return 'Dispatched';
    if (rawStatus === 0) return 'Draft';
    if (typeof rawStatus === 'string') {
        if (rawStatus.toLowerCase() === 'dispatched') return 'Dispatched';
        if (rawStatus.toLowerCase() === 'draft') return 'Draft';
    }
    return 'Draft';
}

function normalizePlan(plan, people) {
    if (!plan) return null;

    const slots = (plan.slots || []).map((s) => ({
        slotNumber: s.slotNumber,
        personId: s.personId,
        personType: s.personType === 'Skydiver' ? 'skydiver' : 'passenger',
        parachuteId: s.parachuteId ?? null,
        tandemInstructorId: null,
    }));

    const enriched = slots.map((slot) => {
        if (slot.personType !== 'passenger') return slot;
        return {
            ...slot,
            tandemInstructorId: inferTandemInstructorId(
                { slots, skydivers: people.skydivers },
                slot
            ),
        };
    });

    return {
        id: plan.id,
        aircraft: plan.aircraft,
        time: extractTimeFromDate(plan.date),
        status: normalizeStatus(plan.status),
        dispatchedAt: plan.dispatchedAt ?? null,
        slots: enriched,
    };
}

function getUsedPersonIds(state, type) {
    if (type === 'both') {
        return new Set(state.flightPlan.slots.map((s) => s.personId));
    }

    return new Set(
        state.flightPlan.slots
            .filter((s) => s.personType === type)
            .map((s) => s.personId)
    );
}


function getUsedParachuteIds(state) {
    return new Set(
        state.flightPlan.slots
            .map((s) => s.parachuteId)
            .filter((id) => id !== null)
    );
}

function isLockedPlan(state) {
    return state.plans.activeStatus === 'Dispatched';
}

function currentPlanId(state) {
    return state.plans.activeId ?? state.flightPlan.exitPlanId ?? null;
}

function getPersonBlockReason(person, activePlanId) {
    if (person.manualBlocked) return 'Zablokowany ręcznie';
    return '';
}

function getParachuteBlockReason(parachute, activePlanId) {
    if (parachute.manualBlocked) return 'Zablokowany ręcznie';
    return '';
}

/* =========================
   UI – MESSAGES (6H)
========================= */
let planMessageTimer = null;

function getPlanMessageEl() {
    return document.getElementById('plan-message');
}
function clearPlanMessage() {
    const el = getPlanMessageEl();
    if (!el) return;

    el.textContent = '';
    el.classList.remove('is-visible', 'is-success', 'is-error', 'is-info');

    el.style.background = '';
    el.style.color = '';
    el.style.textAlign = '';

    if (planMessageTimer) {
        clearTimeout(planMessageTimer);
        planMessageTimer = null;
    }
}

function showPlanMessage(type, text, timeoutMs = 4000) {
    const el = getPlanMessageEl();
    if (!el) return;

    const t = (type || '').toLowerCase();

    el.textContent = text ?? '';
    el.classList.add('is-visible');
    el.classList.remove('is-success', 'is-error', 'is-info');

    let bg = '#f7e38a'; // reszta: żółte
    let fg = '#111';

    if (t === 'success') {
        el.classList.add('is-success');
        bg = '#2ecc71'; // zielone
        fg = '#fff';
    } else if (t === 'warning' || t === 'error') {
        el.classList.add('is-error');
        bg = '#e74c3c'; // czerwone
        fg = '#fff';
    } else {
        el.classList.add('is-info');
    }

    el.style.background = bg;
    el.style.color = fg;
    el.style.textAlign = 'center';

    if (planMessageTimer) {
        clearTimeout(planMessageTimer);
        planMessageTimer = null;
    }

    if (timeoutMs && timeoutMs > 0) {
        planMessageTimer = setTimeout(() => {
            clearPlanMessage();
        }, timeoutMs);
    }
}


function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function handleApiError(err, fallback = 'Wystąpił błąd') {
    const status = err && typeof err.status === 'number' ? err.status : null;

    const getProblemDetails = () => {
        const data = err && err.data ? err.data : null;
        if (!data) return null;

        if (typeof data === 'string') {
            const t = data.trim();
            if (t.startsWith('{') && t.endsWith('}')) {
                try {
                    return JSON.parse(t);
                } catch {
                    return null;
                }
            }
            return null;
        }

        if (data && typeof data.message === 'string') {
            const t = data.message.trim();
            if (t.startsWith('{') && t.endsWith('}')) {
                try {
                    return JSON.parse(t);
                } catch {
                    return null;
                }
            }
        }

        return data;
    };

    const pd = getProblemDetails();

    if (status === 409) {
        const message =
            (pd && (pd.error || pd.message)) || (err && err.message) || 'Konflikt danych';
        showPlanMessage('error', message, 7000);
        return;
    }

    if (status === 400) {
        const errors = pd && pd.errors && typeof pd.errors === 'object' ? pd.errors : null;

        if (errors) {
            const keys = Object.keys(errors);

            const hasParachuteIdError =
                keys.some((k) => k.toLowerCase().includes('parachuteid')) ||
                Object.values(errors)
                    .flat()
                    .some((m) =>
                        String(m).toLowerCase().includes('could not be converted to system.int32')
                    );

            if (hasParachuteIdError) {
                showPlanMessage(
                    'error',
                    `${fallback} — przypisz spadochron.`,
                    7000
                );
                return;
            }

            const first = Object.values(errors).flat().map(String).find((x) => x.trim() !== '');
            if (first) {
                showPlanMessage('error', `${fallback} — ${first}`, 7000);
                return;
            }
        }

        const message =
            (pd && (pd.error || pd.message || pd.title)) || (err && err.message) || 'Niepoprawne dane';

        showPlanMessage('error', `${fallback} — ${message}`, 7000);
        return;
    }

    if (status && status >= 500) {
        const message =
            (pd && (pd.error || pd.message || pd.title)) || (err && err.message) || 'Błąd serwera';
        showPlanMessage('error', message, 7000);
        return;
    }

    const message =
        (pd && (pd.error || pd.message || pd.title)) || (err && err.message) || fallback;

    showPlanMessage('error', message, 7000);
}

export { initPlanLeftCollapsibles, getFirstFreeSlot, normalizeTimeValue, getNowTimeValue, buildExitPlanPayload, normalizePlan, currentPlanId, isLockedPlan, getUsedPersonIds, getUsedParachuteIds, getPersonBlockReason, getParachuteBlockReason, clearPlanMessage, showPlanMessage, handleApiError, formatDateTime };
