import { getState, setState } from '../state/state.js';
import { api } from '../api/api.js';
import { mapPeopleDto } from '../mappers/peopleMapper.js';
import { mapParachutesDto } from '../mappers/parachuteMapper.js';
import {
    fullName,
    getAvailableParachutes,
    getParachuteLabel,
    getSlotPerson,
    getTandemInstructorsInFlight,
    isParachuteBlocked,
    isPersonBlocked,
    validateTandemRules,
    validateStudentRules,
} from '../helpers/helpers.js';
import {
    buildExitPlanPayload,
    clearPlanMessage,
    currentPlanId,
    formatDateTime,
    getFirstFreeSlot,
    getNowTimeValue,
    getParachuteBlockReason,
    getPersonBlockReason,
    getUsedParachuteIds,
    getUsedPersonIds,
    handleApiError,
    isLockedPlan,
    normalizePlan,
    normalizeTimeValue,
    showPlanMessage,
} from './core.js';
import { escapeHtml } from '../ui/safe.js';


/* =========================
   LOCAL UI STATE
========================= */
let slotWaitingForParachute = null;
let passengerWaitingForInstructor = null;
function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stripIds(root) {
    if (!root || !root.querySelectorAll) return;
    const withId = root.querySelectorAll('[id]');
    withId.forEach((el) => el.removeAttribute('id'));
}

function createPlanCenterOverlay(centerEl) {
    const rect = centerEl.getBoundingClientRect();
    const overlay = centerEl.cloneNode(true);

    stripIds(overlay);

    overlay.classList.add('plan-center-overlay');
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    document.body.appendChild(overlay);
    return overlay;
}

function waitTransitionEnd(el, timeoutMs = 320) {
    return new Promise((resolve) => {
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('transitionend', onEnd);
            resolve();
        };

        const onEnd = (e) => {
            if (e.target !== el) return;
            finish();
        };

        el.addEventListener('transitionend', onEnd, { once: false });
        setTimeout(finish, timeoutMs);
    });
}

async function foldResetPlanCenter(updateFn) {
    const center = document.querySelector('.plan-center');
    if (!center || prefersReducedMotion()) {
        updateFn();
        return;
    }

    center.classList.remove('is-incoming');

    requestAnimationFrame(() => {
        center.classList.add('is-folding');
    });

    await waitTransitionEnd(center, 320);

    updateFn();

    requestAnimationFrame(() => {
        center.classList.remove('is-folding');
    });

    await waitTransitionEnd(center, 320);
}

function slideSwapPlanCenter(updateFn) {
    const center = document.querySelector('.plan-center');
    if (!center || prefersReducedMotion()) {
        updateFn();
        return;
    }

    const overlay = createPlanCenterOverlay(center);

    center.classList.add('is-incoming');

    updateFn();

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.classList.add('is-replacing');
            center.classList.remove('is-incoming');
        });
    });

    waitTransitionEnd(overlay, 520).then(() => {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
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

    slideSwapPlanCenter(() => {
        setState((state) => {
            state.plans.activeId = id;
            state.plans.activeStatus = plan.status;

            state.flightPlan.exitPlanId = id;
            state.flightPlan.aircraft = plan.aircraft || state.flightPlan.aircraft;
            state.flightPlan.time = plan.time ? plan.time : getNowTimeValue();
            state.flightPlan.slots = plan.slots ? structuredClone(plan.slots) : [];

            return state;
        }, ['plans', 'flightPlan']);
    });
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
    }, ['plans', 'flightPlan']);
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
        <div class="card-name">${escapeHtml(getParachuteLabel(p))}</div>
        <div class="card-meta">${escapeHtml(p.model)} · ${p.size} · ${escapeHtml(p.type)}</div>
        ${disabled && reason ? `<div class="card-meta card-meta--blocked">${escapeHtml(reason)}</div>` : ''}
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
        <div class="card-name">${escapeHtml(fullName(person))}</div>
        <div class="card-meta">🪂 ${escapeHtml(getParachuteLabel(parachute))}</div>
        <button class="btn btn--small">Wybierz</button>
        `;

        el.querySelector('button').onclick = () => assignTandemInstructor(person.id);
        target.appendChild(el);
    });
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
                }, ['plans', 'flightPlan']);
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


/* =========================
   DELETE
========================= */
async function deleteExitPlan() {
    const state = getState();
    const id = state.plans.activeId ?? state.flightPlan.exitPlanId;

    if (!id) {
        await foldResetPlanCenter(startNewPlan);
        showPlanMessage('info', 'Usunięto lot (wersja robocza)', 4000);
        return;
    }

    try {
        await api.deleteExitPlan(id);
        await foldResetPlanCenter(startNewPlan);
        showPlanMessage('info', 'Usunięto plan', 4000);
        await syncFromApi();
    } catch (e) {
        handleApiError(e, 'Nie udało się usunąć');
        await syncFromApi();
    }
}



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

        const people = mapPeopleDto(skydivers, passengers);
        const normalizedParachutes = mapParachutesDto(parachutes);

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
        }, ['people', 'parachutes', 'plans', 'flightPlan']);
    } catch (e) {
        handleApiError(e, 'Nie udało się odświeżyć danych');
    }
}

export {
    slideSwapPlanCenter,
    foldResetPlanCenter,
    setActivePlan,
    startNewPlan,
    addToFlight,
    removeFromFlight,
    openParachuteSelector,
    closeParachuteModal,
    openTandemInstructorSelector,
    closeTandemModal,
    saveExitPlan,
    dispatchActivePlan,
    undoDispatchedPlan,
    deleteExitPlan,
    syncFromApi,
};
