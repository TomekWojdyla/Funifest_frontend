import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import {
    fullName,
    isStaff,
    isPersonBlocked,
    isParachuteBlocked,
    getSlotPerson,
    getParachuteLabel,
    getAvailablePeople,
    getAvailableParachutes,
    getTandemInstructorsInFlight,
    validateTandemRules,
    validateStudentRules,
} from './helpers/helpers.js';


/* =========================
   LOCAL UI STATE
========================= */
let slotWaitingForParachute = null;
let passengerWaitingForInstructor = null;

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

function normalizePeople(skydivers, passengers) {
    return {
        skydivers: (skydivers || []).map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            weight: s.weight ?? 0,
            licenseLevel: s.licenseLevel,
            role: s.role,
            isAffInstructor: s.isAFFInstructor,
            isTandemInstructor: s.isTandemInstructor,
            parachuteId: s.parachuteId ?? null,

            manualBlocked: s.manualBlocked === true,
            manualBlockedByExitPlanId: s.manualBlockedByExitPlanId ?? null,
            assignedExitPlanId: s.assignedExitPlanId ?? null,
        })),
        passengers: (passengers || []).map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            weight: p.weight ?? 0,

            manualBlocked: p.manualBlocked === true,
            manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
            assignedExitPlanId: p.assignedExitPlanId ?? null,
        })),
    };
}

function normalizeParachutes(parachutes) {
    return (parachutes || []).map((p) => ({
        id: p.id,
        model: p.model,
        size: p.size,
        type: p.type,
        customName: p.customName ?? null,

        manualBlocked: p.manualBlocked === true,
        manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
        assignedExitPlanId: p.assignedExitPlanId ?? null,
    }));
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
    if (person.manualBlocked) return '🔒 Zablokowany ręcznie';
    if (person.assignedExitPlanId !== null && person.assignedExitPlanId !== activePlanId) {
        return `📌 W innym planie (#${person.assignedExitPlanId})`;
    }
    return '';
}

function getParachuteBlockReason(parachute, activePlanId) {
    if (parachute.manualBlocked) return '🔒 Zablokowany ręcznie';
    if (parachute.assignedExitPlanId !== null && parachute.assignedExitPlanId !== activePlanId) {
        return `📌 W innym planie (#${parachute.assignedExitPlanId})`;
    }
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
    const message =
        err && err.message
            ? err.message
            : fallback;

    if (status === 409) {
        showPlanMessage('error', message || 'Konflikt danych', 7000);
        return;
    }

    if (status === 400) {
        showPlanMessage('error', message || 'Niepoprawne dane', 7000);
        return;
    }

    if (status && status >= 500) {
        showPlanMessage('error', message || 'Błąd serwera', 7000);
        return;
    }

    showPlanMessage('error', message || fallback, 7000);
}

/* =========================
   PLAN LIST
========================= */
function sortPlansForList(list) {
    const drafts = list
        .filter((p) => p.status === 'Draft')
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

    const dispatched = list
        .filter((p) => p.status === 'Dispatched')
        .sort((a, b) => {
            const ad = a.dispatchedAt ? new Date(a.dispatchedAt).getTime() : 0;
            const bd = b.dispatchedAt ? new Date(b.dispatchedAt).getTime() : 0;
            if (bd !== ad) return bd - ad;
            return (b.id ?? 0) - (a.id ?? 0);
        });

    return { drafts, dispatched };
}

function renderPlanList(state) {
    const target = document.getElementById('plan-list');
    if (!target) return;

    target.innerHTML = '';

    const { drafts, dispatched } = sortPlansForList(state.plans.list || []);

    const renderItem = (p, titleText, isActive, isPlaceholder) => {
        const item = document.createElement('div');

        const isDispatched = p.status === 'Dispatched';
        item.className = `plan-item ${isDispatched ? 'is-dispatched' : ''} ${isActive ? 'is-active' : ''}`;

        const badgeText = isDispatched ? 'WYSŁANY' : 'DRAFT';
        const badgeClass = isDispatched ? 'plan-item__badge--dispatched' : 'plan-item__badge--draft';

        const time = normalizeTimeValue(p.time) || '--:--';

        item.innerHTML = `
            <div class="plan-item__row">
                <div class="plan-item__title">${titleText}</div>
                <span class="plan-item__badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="plan-item__meta">
                <span>${time}</span>
            </div>
        `;

        if (isDispatched && p.dispatchedAt) {
            item.title = `Wysłano: ${formatDateTime(p.dispatchedAt)}`;
        } else {
            item.title = '';
        }

        if (!isPlaceholder) {
            item.onclick = () => setActivePlan(p.id);
        }

        target.appendChild(item);
    };

    if (state.plans.activeId === null) {
        renderItem(
            { status: 'Draft', time: state.flightPlan.time, dispatchedAt: null },
            'NOWY PLAN',
            true,
            true
        );
    }

    const renderSection = (title, plans) => {
        if (!plans.length) return;

        const h = document.createElement('div');
        h.className = 'plan-list-section';
        h.textContent = title;
        target.appendChild(h);

        plans.forEach((p) => {
            const isActive = state.plans.activeId === p.id;
            renderItem(p, `PLAN #${p.id}`, isActive, false);
        });
    };

    renderSection('AKTYWNE (DRAFT)', drafts);
    renderSection('WYSŁANE (ARCHIWUM)', dispatched);
}


function setActivePlan(id) {
    const stateNow = getState();
    const plan = (stateNow.plans.list || []).find((p) => p.id === id);
    if (!plan) return;

    clearPlanMessage();

    slotWaitingForParachute = null;
    passengerWaitingForInstructor = null;
    closeParachuteModal();
    closeTandemModal();

    setState((state) => {
        state.plans.activeId = id;
        state.plans.activeStatus = plan.status;

        state.flightPlan.exitPlanId = id;
        state.flightPlan.aircraft = plan.aircraft || state.flightPlan.aircraft;
        state.flightPlan.time = plan.time ? plan.time : getNowTimeValue();
        state.flightPlan.slots = plan.slots ? structuredClone(plan.slots) : [];

        return state;
    }, '*');
}

function startNewPlan() {
    clearPlanMessage();
    slotWaitingForParachute = null;
    passengerWaitingForInstructor = null;
    closeParachuteModal();
    closeTandemModal();

    setState((state) => {
        state.plans.activeId = null;
        state.plans.activeStatus = 'Draft';

        state.flightPlan.exitPlanId = null;
        state.flightPlan.slots = [];
        state.flightPlan.time = getNowTimeValue();

        return state;
    }, '*');
}

/* =========================
   ACTIONS
========================= */
function addToFlight(person, type) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    const activeId = currentPlanId(stateNow);

    if (isPersonBlocked(person)) return;
    if (getPersonBlockReason(person, activeId)) return;

    const used = getUsedPersonIds(stateNow, type);
    if (used.has(person.id)) return;

    setState((state) => {
        const slotNum = getFirstFreeSlot(state.flightPlan.slots);
        if (!slotNum) return state;

        state.flightPlan.slots.push({
            slotNumber: slotNum,
            personId: person.id,
            personType: type,
            parachuteId: null,
            tandemInstructorId: null,
        });

        return state;
    }, 'flightPlan');
}

function removeFromFlight(slotNumber) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    setState((state) => {
        const removed = state.flightPlan.slots.find((s) => s.slotNumber === slotNumber);
        if (!removed) return state;

        // jeśli usuwamy instruktora (skydiver), który był przypisany do tandemu,
        // to zdejmujemy go z pasażera (i czyścimy jego parachuteId)
        if (removed.personType === 'skydiver') {
            state.flightPlan.slots = state.flightPlan.slots.map((s) => {
                if (s.personType !== 'passenger') return s;
                if (s.tandemInstructorId !== removed.personId) return s;

                return {
                    ...s,
                    tandemInstructorId: null,
                    parachuteId: null,
                };
            });
        }

        state.flightPlan.slots = state.flightPlan.slots.filter(
            (s) => s.slotNumber !== slotNumber
        );

        return state;
    }, 'flightPlan');
}


/* =========================
   PARACHUTE FLOW (SKYDIVER)
========================= */
function openParachuteSelector(slotNumber) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    slotWaitingForParachute = slotNumber;
    renderParachuteOptions();
    document.getElementById('parachuteSelectModal').classList.add('active');
}

function assignParachuteToSlot(parachuteId) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    const activeId = currentPlanId(stateNow);
    const parachute = stateNow.parachutes.find((p) => p.id === parachuteId);
    if (!parachute) return;

    if (isParachuteBlocked(parachute)) return;
    if (getParachuteBlockReason(parachute, activeId)) return;

    const usedParachutes = getUsedParachuteIds(stateNow);
    if (usedParachutes.has(parachuteId)) return;

    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotWaitingForParachute
        );
        if (!slot) return state;

        slot.parachuteId = parachuteId;
        return state;
    }, 'flightPlan');

    closeParachuteModal();
}

function closeParachuteModal() {
    slotWaitingForParachute = null;
    const modal = document.getElementById('parachuteSelectModal');
    if (modal) modal.classList.remove('active');
}

/* =========================
   TANDEM FLOW (PASSENGER)
========================= */
function openTandemInstructorSelector(slotNumber) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    passengerWaitingForInstructor = slotNumber;
    renderTandemInstructorOptions();
    document.getElementById('tandemSelectModal').classList.add('active');
}

function assignTandemInstructor(instructorId) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    setState((state) => {
        const passengerSlot = state.flightPlan.slots.find(
            (s) => s.slotNumber === passengerWaitingForInstructor
        );
        if (!passengerSlot) return state;

        passengerSlot.tandemInstructorId = instructorId;

        const instructorSlot = state.flightPlan.slots.find(
            (s) => s.personType === 'skydiver' && s.personId === instructorId
        );

        const instructorParachute =
            instructorSlot?.parachuteId
                ? state.parachutes.find((p) => p.id === instructorSlot.parachuteId)
                : null;

        if (!instructorParachute || instructorParachute.type !== 'Tandem') {
            showPlanMessage(
                'error',
                'Instruktor tandemowy musi mieć spadochron typu Tandem.',
                7000
            );
            return state;
        }

        passengerSlot.parachuteId = instructorSlot?.parachuteId ?? null;

        return state;
    }, 'flightPlan');

    closeTandemModal();
}

function closeTandemModal() {
    passengerWaitingForInstructor = null;
    const modal = document.getElementById('tandemSelectModal');
    if (modal) modal.classList.remove('active');
}

/* =========================
   RENDER
========================= */
function renderPlan() {
    const state = getState();
    const locked = isLockedPlan(state);
    const activeId = currentPlanId(state);

    renderPlanList(state);

    const usedSkydivers = getUsedPersonIds(state, 'skydiver');
    const usedPassengers = getUsedPersonIds(state, 'passenger');

    // 6F: pokazuj też zablokowanych, ale disabled + powód
    const skydivers = state.people.skydivers || [];
    const passengers = state.people.passengers || [];

    renderPeople(
        skydivers.filter((s) => !isStaff(s)),
        'plan-funjumpers',
        'skydiver',
        locked,
        usedSkydivers,
        activeId
    );

    renderPeople(
        skydivers.filter((s) => isStaff(s)),
        'plan-staff',
        'skydiver',
        locked,
        usedSkydivers,
        activeId
    );

    renderPeople(
        passengers,
        'plan-passengers',
        'passenger',
        locked,
        usedPassengers,
        activeId
    );

    renderSlots(state, locked);
    renderButtons(state);
}

/* =========================
   LEFT LISTS
========================= */function renderPeople(list, targetId, type, locked, usedSet, activeId) {
    const target = document.getElementById(targetId);
    target.innerHTML = '';

    list.forEach((p) => {
        const isUsed = usedSet.has(p.id);
        const reason = getPersonBlockReason(p, activeId);
        const blocked = isPersonBlocked(p) || reason !== '';
        const disabled = locked || isUsed || blocked;

        const el = document.createElement('div');
        el.className = `card ${disabled ? 'card--disabled' : ''}`;
        el.innerHTML = `
          <div class="card-name">${fullName(p)}</div>
          ${disabled && reason ? `<div class="card-meta card-meta--blocked">${reason}</div>` : ''}
          ${disabled && isUsed ? `<div class="card-meta card-meta--blocked">📌 Już w tym planie</div>` : ''}
          <button class="btn btn--small">${blocked ? 'Niedostępny' : '→ do wylotu'}</button>
        `;

        const btn = el.querySelector('button');
        btn.disabled = disabled;
        btn.title = reason || (isUsed ? 'Już w tym planie' : '');
        btn.onclick = () => addToFlight(p, type);

        target.appendChild(el);
    });
}


/* =========================
   SLOTS
========================= */
function renderSlots(state, locked) {
    document.querySelectorAll('.slot[data-slot]').forEach((el) => {
        const num = Number(el.dataset.slot);
        const slot = state.flightPlan.slots.find((s) => s.slotNumber === num);

        el.className = 'slot';

        if (!slot) {
            el.textContent = `SLOT ${num}`;
            return;
        }

        const person = getSlotPerson(state, slot);
        const parachute =
            slot.parachuteId &&
            state.parachutes.find((p) => p.id === slot.parachuteId);

        const flags = [];
        if (person?.isAffInstructor) flags.push('AFF INS');
        if (person?.isTandemInstructor) flags.push('TANDEM INS');

        let extraBlock = '';

        if (slot.personType === 'skydiver') {
            extraBlock = parachute
                ? `🪂 ${getParachuteLabel(parachute)}`
                : `
          <span class="invalid">❌ Brak spadochronu</span>
          <button class="btn btn--small assign">Przypisz spadochron</button>
        `;
        } else {
            extraBlock = slot.tandemInstructorId
                ? `
          <strong>
            TANDEM INS:
            ${fullName(
                getSlotPerson(state, {
                    personId: slot.tandemInstructorId,
                    personType: 'skydiver',
                })
            )}
          </strong><br/>
          🪂 ${parachute ? getParachuteLabel(parachute) : '-'}
        `
                : `
          <span class="invalid">❌ Brak instruktora tandemowego</span>
          <button class="btn btn--small assign">Wybierz instruktora</button>
        `;
        }

        el.innerHTML = `
      <strong>${person ? fullName(person) : '-'}</strong><br/>
      <small>
        ${person ? person.weight : 0} kg
        ${
            person && person.licenseLevel
                ? `· ${person.licenseLevel} · ${person.role}`
                : ''
        }
        ${flags.map((f) => `· ${f}`).join('')}
      </small>

      <div class="slot-parachute">${extraBlock}</div>

      <button class="btn btn--small remove">Usuń z wylotu</button>
    `;

        const removeBtn = el.querySelector('.remove');
        removeBtn.disabled = locked;
        removeBtn.onclick = () => removeFromFlight(num);

        const assignBtn = el.querySelector('.assign');
        if (assignBtn) {
            assignBtn.disabled = locked;
            if (!locked) {
                if (slot.personType === 'skydiver' && !parachute) {
                    assignBtn.onclick = () => openParachuteSelector(num);
                    el.classList.add('invalid');
                }
                if (slot.personType === 'passenger' && !slot.tandemInstructorId) {
                    assignBtn.onclick = () => openTandemInstructorSelector(num);
                    el.classList.add('invalid');
                }
            }
        }
    });
}

/* =========================
   PARACHUTE SELECT (6F: show disabled + reason)
========================= */
function renderParachuteOptions() {
    const target = document.getElementById('parachuteOptions');
    target.innerHTML = '';

    const state = getState();
    const activeId = currentPlanId(state);
    const usedParachutes = getUsedParachuteIds(state);

    const list = getAvailableParachutes(state);

    list.forEach((p) => {
        const isUsed = usedParachutes.has(p.id);
        const reason = getParachuteBlockReason(p, activeId);
        const disabled = isUsed || isParachuteBlocked(p) || reason !== '';

        const el = document.createElement('div');
        el.className = `card ${disabled ? 'card--disabled' : ''}`;
        el.innerHTML = `
          <div class="card-name">${getParachuteLabel(p)}</div>
          <div class="card-meta">${p.model} · ${p.size} · ${p.type}</div>
          ${disabled && reason ? `<div class="card-meta card-meta--blocked">${reason}</div>` : ''}
          ${disabled && isUsed ? `<div class="card-meta card-meta--blocked">📌 Już w tym planie</div>` : ''}
          <button class="btn btn--small">Wybierz</button>
        `;

        const btn = el.querySelector('button');
        btn.disabled = disabled;
        btn.title = reason || (isUsed ? 'Już w tym planie' : '');
        btn.onclick = () => assignParachuteToSlot(p.id);

        target.appendChild(el);
    });
}

/* =========================
   TANDEM SELECT
========================= */
function renderTandemInstructorOptions() {
    const target = document.getElementById('tandemOptions');
    target.innerHTML = '';

    const state = getState();

    const instructors = getTandemInstructorsInFlight(state)
        .map(({ person, slot }) => {
            const parachute = state.parachutes.find((p) => p.id === slot.parachuteId);
            return { person, slot, parachute };
        })
        .filter(({ parachute }) => parachute && parachute.type === 'Tandem');

    if (instructors.length === 0) {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
          <div class="card-name">Brak instruktorów tandemowych ze spadochronem typu Tandem</div>
        `;
        target.appendChild(el);
        return;
    }

    instructors.forEach(({ person, slot, parachute }) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
          <div class="card-name">${fullName(person)}</div>
          <div class="card-meta">🪂 ${getParachuteLabel(parachute)}</div>
          <button class="btn btn--small">Wybierz</button>
        `;
        el.querySelector('button').onclick = () => assignTandemInstructor(person.id);
        target.appendChild(el);
    });
}


/* =========================
   BUTTONS
========================= */function renderButtons(state) {
    const locked = isLockedPlan(state);

    const saveBtn = document.querySelector('.plan-go');
    const delBtn = document.querySelector('.plan-delete');
    const dispatchBtn = document.getElementById('plan-dispatch');
    const undoBtn = document.getElementById('plan-undo');

    const hasId = state.flightPlan.exitPlanId !== null;

    if (saveBtn) {
        saveBtn.textContent = hasId ? 'MODYFIKUJ' : 'ZAPISZ';
        saveBtn.style.display = locked ? 'none' : '';
        saveBtn.disabled = locked;
    }

    if (dispatchBtn) {
        dispatchBtn.style.display = locked ? 'none' : '';
        dispatchBtn.disabled = locked;
    }

    if (undoBtn) {
        undoBtn.style.display = locked ? '' : 'none';
        undoBtn.disabled = !hasId;
    }

    if (delBtn) {
        delBtn.disabled = locked ? !hasId : false;
    }
}


function getFlightValidationMessage(state) {
    for (const slot of state.flightPlan.slots) {
        if (!slot.parachuteId) return 'Brakuje spadochronu w co najmniej jednym slocie.';
    }

    if (!validateTandemRules(state)) {
        return 'Pasażer wymaga instruktora tandemowego (1 instruktor = 1 pasażer).';
    }

    // Tandem: instruktor musi mieć spadochron typu Tandem
    for (const slot of state.flightPlan.slots) {
        if (slot.personType !== 'passenger') continue;
        if (!slot.tandemInstructorId) continue;

        const instructorSlot = state.flightPlan.slots.find(
            (s) => s.personType === 'skydiver' && s.personId === slot.tandemInstructorId
        );

        const parachute =
            instructorSlot?.parachuteId
                ? state.parachutes.find((p) => p.id === instructorSlot.parachuteId)
                : null;

        if (!parachute || parachute.type !== 'Tandem') {
            return 'Instruktor tandemowy musi mieć spadochron typu Tandem.';
        }
    }


    if (!validateStudentRules(state)) {
        return 'Jeśli leci student, musi lecieć też instruktor (AFF/Instructor/Examiner) nielecący w tandemie.';
    }

    return '';
}

function validateFlight(state) {
    return getFlightValidationMessage(state) === '';
}


/* =========================
   EVENTS
========================= */
const cancelSelect = document.getElementById('cancelSelect');
if (cancelSelect) cancelSelect.onclick = closeParachuteModal;

const cancelTandem = document.getElementById('cancelTandem');
if (cancelTandem) cancelTandem.onclick = closeTandemModal;

const addBtn = document.getElementById('plan-add');
if (addBtn) addBtn.onclick = startNewPlan;

/* =========================
   SAVE
========================= */
async function saveExitPlan() {
    const state = getState();
    if (isLockedPlan(state)) return;

    if (!validateFlight(state)) {
        showPlanMessage('error', getFlightValidationMessage(state), 7000);
        return;
    }

    try {
        const payload = buildExitPlanPayload(state);

        if (state.plans.activeId === null) {
            const created = await api.createExitPlan(payload);

            let createdId = null;
            const rawId = created?.id ?? created?.exitPlanId ?? null;
            if (rawId !== null && rawId !== undefined) {
                const n = Number(rawId);
                createdId = Number.isNaN(n) ? null : n;
            }

            if (createdId !== null) {
                setState((s) => {
                    s.plans.activeId = createdId;
                    s.plans.activeStatus = 'Draft';
                    s.flightPlan.exitPlanId = createdId;
                    return s;
                }, '*');
            }
        } else {
            await api.updateExitPlan(state.plans.activeId, payload);
        }

        showPlanMessage('success', 'Zapisano', 3500);
        await syncFromApi();
    } catch (e) {
        handleApiError(e, 'Nie udało się zapisać');
        await syncFromApi();
    }
}

const saveBtn = document.querySelector('.plan-go');
if (saveBtn) saveBtn.onclick = saveExitPlan;

/* =========================
   DISPATCH
========================= */
async function dispatchActivePlan() {
    const state = getState();
    if (isLockedPlan(state)) return;

    const id = state.plans.activeId ?? state.flightPlan.exitPlanId;
    if (!id) {
        showPlanMessage('info', 'Najpierw zapisz plan, potem możesz go wysłać.', 7000);
        return;
    }

    if (!validateFlight(state)) {
        showPlanMessage('error', getFlightValidationMessage(state), 7000);
        return;
    }


    try {
        await api.dispatchExitPlan(id);
        showPlanMessage('success', 'Wysłano', 4000);
        await syncFromApi();
    } catch (e) {
        handleApiError(e, 'Nie udało się wysłać planu');
        await syncFromApi();
    }
}

const dispatchBtn = document.getElementById('plan-dispatch');
if (dispatchBtn) dispatchBtn.onclick = dispatchActivePlan;

/* =========================
   UNDO-DISPATCH
========================= */
async function undoDispatchedPlan() {
    const state = getState();
    const id = state.plans.activeId ?? state.flightPlan.exitPlanId;
    if (!id) return;

    try {
        await api.undoDispatchExitPlan(id);
        startNewPlan();
        showPlanMessage('info', 'Cofnięto wysłany plan', 5000);
        await syncFromApi();
    } catch (e) {
        handleApiError(e, 'Nie udało się cofnąć');
        await syncFromApi();
    }
}

const undoBtn = document.getElementById('plan-undo');
if (undoBtn) undoBtn.onclick = undoDispatchedPlan;

/* =========================
   DELETE
========================= */
async function deleteExitPlan() {
    const state = getState();
    const id = state.plans.activeId ?? state.flightPlan.exitPlanId;
    if (!id) {
        startNewPlan();
        showPlanMessage('info', 'Usunięto lot (wersja robocza)', 4000);
        return;
    }

    try {
        await api.deleteExitPlan(id);
        startNewPlan();
        showPlanMessage('info', 'Usunięto plan', 4000);
        await syncFromApi();
    } catch (e) {
        handleApiError(e, 'Nie udało się usunąć');
        await syncFromApi();
    }
}

const delBtn = document.querySelector('.plan-delete');
if (delBtn) delBtn.onclick = deleteExitPlan;

/* =========================
   SYNC (GET → STATE)
========================= */
async function syncFromApi() {
    try {
        const [skydivers, passengers, parachutes, plans] = await Promise.all([
            api.getSkydivers(),
            api.getPassengers(),
            api.getParachutes(),
            api.getExitPlans(),
        ]);

        const people = normalizePeople(skydivers, passengers);
        const normalizedParachutes = normalizeParachutes(parachutes);

        const normalizedPlans = (plans || [])
            .map((p) => normalizePlan(p, people))
            .filter((p) => p !== null);

        setState((state) => {
            state.people.skydivers = people.skydivers;
            state.people.passengers = people.passengers;
            state.parachutes = normalizedParachutes;

            state.plans.list = normalizedPlans;

            const activeId = state.plans.activeId;
            if (activeId !== null) {
                const active = normalizedPlans.find((p) => p.id === activeId);
                if (active) {
                    state.plans.activeStatus = active.status;
                    state.flightPlan.exitPlanId = active.id;
                    state.flightPlan.aircraft = active.aircraft || state.flightPlan.aircraft;
                    state.flightPlan.time = active.time || getNowTimeValue();
                    state.flightPlan.slots = structuredClone(active.slots || []);
                } else {
                    state.plans.activeId = null;
                    state.plans.activeStatus = 'Draft';
                    state.flightPlan.exitPlanId = null;
                }
            }

            return state;
        }, '*');
    } catch (e) {
        handleApiError(e, 'Nie udało się odświeżyć danych');
    }
}

/* =========================
   INIT
========================= */
subscribe('*', renderPlan);
renderPlan();
const init = getState();
if (!normalizeTimeValue(init.flightPlan.time)) {
    setState((s) => {
        if (!normalizeTimeValue(s.flightPlan.time)) {
            s.flightPlan.time = getNowTimeValue();
        }
        return s;
    }, 'flightPlan');
}
syncFromApi();

