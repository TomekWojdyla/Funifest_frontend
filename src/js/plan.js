import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import {
    fullName,
    isStaff,
    isPersonActive,
    getSlotPerson,
    getParachuteLabel,
    getAvailablePeople,
    getAvailableParachutes,
    setPersonStatus,
    setParachuteStatus,
    getTandemInstructorsInFlight,
    validateTandemRules,
    showError,
} from './helpers/helpers.js';

/* =========================
   FINISH FLOW (PLAN -> HOME)
========================= */
const PLAN_SAVED_AT_KEY = 'funifest_last_plan_saved_at';
const PLAN_SAVED_ID_KEY = 'funifest_last_exit_plan_id';

function markPlanSaved(exitPlanId) {
    localStorage.setItem(PLAN_SAVED_AT_KEY, new Date().toISOString());
    if (exitPlanId) {
        localStorage.setItem(PLAN_SAVED_ID_KEY, String(exitPlanId));
    }
}

function clearPlanSavedMark() {
    localStorage.removeItem(PLAN_SAVED_AT_KEY);
    localStorage.removeItem(PLAN_SAVED_ID_KEY);
}

function goHome() {
    window.location.href = '../../index.html';
}

function setPlanButtonsBusy(isBusy) {
    const saveBtn = document.querySelector('.plan-go');
    const delBtn = document.querySelector('.plan-delete');

    if (saveBtn) saveBtn.disabled = isBusy || saveBtn.disabled;
    if (delBtn) delBtn.disabled = isBusy || delBtn.disabled;
}


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

function pickLatestExitPlan(plans) {
    if (!plans || plans.length === 0) return null;
    return [...plans].sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
}

function toApiPersonType(personType) {
    return personType === 'skydiver' ? 'Skydiver' : 'Passenger';
}

function buildExitPlanPayload(state) {
    return {
        date: new Date().toISOString(),
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
            status: 'ACTIVE',
        })),
        passengers: (passengers || []).map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            weight: p.weight ?? 0,
            status: 'ACTIVE',
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
        status: 'AVAILABLE',
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

function normalizeFlightPlan(plan, people) {
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
        slots: enriched,
    };
}

function applyPlanStatuses(state) {
    for (const slot of state.flightPlan.slots) {
        setPersonStatus(state, slot.personId, slot.personType, 'BLOCKED');

        if (slot.parachuteId) {
            setParachuteStatus(state, slot.parachuteId, 'ASSIGNED');
        }
    }
}

/* =========================
   ACTIONS
========================= */
function addToFlight(person, type) {
    if (!isPersonActive(person)) return;

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

        setPersonStatus(state, person.id, type, 'BLOCKED');
        return state;
    }, 'flightPlan');
}

function removeFromFlight(slotNumber) {
    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotNumber
        );
        if (!slot) return state;

        setPersonStatus(state, slot.personId, slot.personType, 'ACTIVE');

        if (slot.parachuteId) {
            setParachuteStatus(state, slot.parachuteId, 'AVAILABLE');
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
    slotWaitingForParachute = slotNumber;
    renderParachuteOptions();
    document.getElementById('parachuteSelectModal').classList.add('active');
}

function assignParachuteToSlot(parachuteId) {
    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotWaitingForParachute
        );
        if (!slot) return state;

        slot.parachuteId = parachuteId;
        setParachuteStatus(state, parachuteId, 'ASSIGNED');

        return state;
    }, 'flightPlan');

    closeParachuteModal();
}

function closeParachuteModal() {
    slotWaitingForParachute = null;
    document.getElementById('parachuteSelectModal').classList.remove('active');
}

/* =========================
   TANDEM FLOW (PASSENGER)
========================= */
function openTandemInstructorSelector(slotNumber) {
    passengerWaitingForInstructor = slotNumber;
    renderTandemInstructorOptions();
    document.getElementById('tandemSelectModal').classList.add('active');
}

function assignTandemInstructor(instructorId) {
    setState((state) => {
        const passengerSlot = state.flightPlan.slots.find(
            (s) => s.slotNumber === passengerWaitingForInstructor
        );
        if (!passengerSlot) return state;

        passengerSlot.tandemInstructorId = instructorId;

        const instructorSlot = state.flightPlan.slots.find(
            (s) => s.personType === 'skydiver' && s.personId === instructorId
        );

        passengerSlot.parachuteId = instructorSlot?.parachuteId ?? null;

        return state;
    }, 'flightPlan');

    closeTandemModal();
}

function closeTandemModal() {
    passengerWaitingForInstructor = null;
    document.getElementById('tandemSelectModal').classList.remove('active');
}

/* =========================
   RENDER
========================= */
function renderPlan() {
    const state = getState();

    renderPeople(
        getAvailablePeople(state, 'skydiver').filter((s) => !isStaff(s)),
        'plan-funjumpers',
        'skydiver'
    );

    renderPeople(
        getAvailablePeople(state, 'skydiver').filter((s) => isStaff(s)),
        'plan-staff',
        'skydiver'
    );

    renderPeople(
        getAvailablePeople(state, 'passenger'),
        'plan-passengers',
        'passenger'
    );

    renderSlots(state);
    renderButton(state);
}

/* =========================
   LEFT LISTS
========================= */
function renderPeople(list, targetId, type) {
    const target = document.getElementById(targetId);
    target.innerHTML = '';

    list.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
      <div class="card-name">${fullName(p)}</div>
      <button class="btn btn--small">→ do wylotu</button>
    `;
        el.querySelector('button').onclick = () => addToFlight(p, type);
        target.appendChild(el);
    });
}

/* =========================
   SLOTS
========================= */
function renderSlots(state) {
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
          <button class="btn btn--small assign">
            Przypisz spadochron
          </button>
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
          <span class="invalid">
            ❌ Brak instruktora tandemowego
          </span>
          <button class="btn btn--small assign">
            Wybierz instruktora
          </button>
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

      <div class="slot-parachute">
        ${extraBlock}
      </div>

      <button class="btn btn--small remove">
        Usuń z wylotu
      </button>
    `;

        if (slot.personType === 'skydiver' && !parachute) {
            el.querySelector('.assign').onclick = () =>
                openParachuteSelector(num);
            el.classList.add('invalid');
        }

        if (slot.personType === 'passenger' && !slot.tandemInstructorId) {
            el.querySelector('.assign').onclick = () =>
                openTandemInstructorSelector(num);
            el.classList.add('invalid');
        }

        el.querySelector('.remove').onclick = () => removeFromFlight(num);
    });
}

/* =========================
   PARACHUTE SELECT
========================= */
function renderParachuteOptions() {
    const target = document.getElementById('parachuteOptions');
    target.innerHTML = '';

    const state = getState();
    const list = getAvailableParachutes(state);

    list.forEach((p) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
      <div class="card-name">${getParachuteLabel(p)}</div>
      <div class="card-meta">
        ${p.model} · ${p.size} · ${p.type}
      </div>
      <button class="btn btn--small">Wybierz</button>
    `;
        el.querySelector('button').onclick = () => assignParachuteToSlot(p.id);
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
    const instructors = getTandemInstructorsInFlight(state);

    instructors.forEach(({ person, slot }) => {
        const parachute = state.parachutes.find(
            (p) => p.id === slot.parachuteId
        );

        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
      <div class="card-name">${fullName(person)}</div>
      <div class="card-meta">
        🪂 ${parachute ? getParachuteLabel(parachute) : '-'}
      </div>
      <button class="btn btn--small">Wybierz</button>
    `;
        el.querySelector('button').onclick = () =>
            assignTandemInstructor(person.id);
        target.appendChild(el);
    });
}

/* =========================
   BUTTON
========================= */
function renderButton(state) {
    const btn = document.querySelector('.plan-go');
    const delBtn = document.querySelector('.plan-delete');
    btn.disabled = !validateFlight(state);
    delBtn.disabled = !state.flightPlan.exitPlanId;
}

function validateFlight(state) {
    for (const slot of state.flightPlan.slots) {
        if (!slot.parachuteId) return false;
    }
    return validateTandemRules(state);
}

/* =========================
   EVENTS
========================= */
document.getElementById('cancelSelect').onclick = closeParachuteModal;
document.getElementById('cancelTandem').onclick = closeTandemModal;

/* =========================
   SAVE (POST → GET)
========================= */
async function saveExitPlan() {
    const state = getState();
    if (!validateFlight(state)) {
        alert('Plan jest niekompletny');
        return;
    }

    setPlanButtonsBusy(true);

    try {
        const payload = buildExitPlanPayload(state);
        await api.createExitPlan(payload);

        await syncPlanFromApi({ forceFlightPlan: true });

        const exitPlanId = getState().flightPlan.exitPlanId;
        markPlanSaved(exitPlanId);

        goHome();
    } catch (e) {
        setPlanButtonsBusy(false);
        showError(e);
    }
}

document.querySelector('.plan-go').onclick = saveExitPlan;


/* =========================
   DELETE (DELETE → GET)
========================= */
async function deleteExitPlan() {
    const state = getState();
    const id = state.flightPlan.exitPlanId;
    if (!id) {
        alert('Brak planu na serwerze do usunięcia');
        return;
    }

    setPlanButtonsBusy(true);

    try {
        await api.deleteExitPlan(id);
        await syncPlanFromApi({ forceFlightPlan: true });

        clearPlanSavedMark();

        alert('Plan usunięty');
    } catch (e) {
        showError(e);
    } finally {
        setPlanButtonsBusy(false);
    }
}

document.querySelector('.plan-delete').onclick = deleteExitPlan;


/* =========================
   SYNC (GET → STATE)
========================= */
async function syncPlanFromApi({ forceFlightPlan = false } = {}) {
    try {
        const [skydivers, passengers, parachutes, plans] = await Promise.all([
            api.getSkydivers(),
            api.getPassengers(),
            api.getParachutes(),
            api.getExitPlans(),
        ]);

        const people = normalizePeople(skydivers, passengers);
        const normalizedParachutes = normalizeParachutes(parachutes);
        const latestPlanRaw = pickLatestExitPlan(plans);
        const latestPlan = normalizeFlightPlan(latestPlanRaw, people);

        setState((state) => {
            state.people.skydivers = people.skydivers;
            state.people.passengers = people.passengers;
            state.parachutes = normalizedParachutes;

            if (forceFlightPlan) {
                if (latestPlan) {
                    state.flightPlan.aircraft = latestPlan.aircraft;
                    state.flightPlan.slots = latestPlan.slots;
                    state.flightPlan.exitPlanId = latestPlan.id ?? null;
                } else {
                    state.flightPlan.slots = [];
                    state.flightPlan.exitPlanId = null;
                }
            } else if (state.flightPlan.slots.length === 0 && latestPlan) {
                state.flightPlan.aircraft = latestPlan.aircraft;
                state.flightPlan.slots = latestPlan.slots;
                state.flightPlan.exitPlanId = latestPlan.id ?? null;
            }

            applyPlanStatuses(state);
            return state;
        }, '*');
    } catch (e) {
        showError(e);
    }
}

/* =========================
   INIT
========================= */
subscribe('*', renderPlan);
renderPlan();
syncPlanFromApi();
