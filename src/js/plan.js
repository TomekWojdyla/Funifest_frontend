import { getState, setState, subscribe } from './state/state.js';
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
            personUid: person.uid,
            personType: type,
            parachuteUid: null,
            tandemInstructorUid: null,
        });

        setPersonStatus(state, person.uid, type, 'BLOCKED');
        return state;
    }, 'flightPlan');
}

function removeFromFlight(slotNumber) {
    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotNumber
        );
        if (!slot) return state;

        setPersonStatus(state, slot.personUid, slot.personType, 'ACTIVE');

        if (slot.parachuteUid) {
            setParachuteStatus(state, slot.parachuteUid, 'AVAILABLE');
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

function assignParachuteToSlot(parachuteUid) {
    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotWaitingForParachute
        );
        if (!slot) return state;

        slot.parachuteUid = parachuteUid;
        setParachuteStatus(state, parachuteUid, 'ASSIGNED');

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

function assignTandemInstructor(instructorUid) {
    setState((state) => {
        const passengerSlot = state.flightPlan.slots.find(
            (s) => s.slotNumber === passengerWaitingForInstructor
        );
        if (!passengerSlot) return state;

        passengerSlot.tandemInstructorUid = instructorUid;

        const instructorSlot = state.flightPlan.slots.find(
            (s) => s.personType === 'skydiver' && s.personUid === instructorUid
        );

        passengerSlot.parachuteUid = instructorSlot?.parachuteUid ?? null;

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
            slot.parachuteUid &&
            state.parachutes.find((p) => p.uid === slot.parachuteUid);

        const flags = [];
        if (person.isAFFInstructor) flags.push('AFF INS');
        if (person.isTandemInstructor) flags.push('TANDEM INS');

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
            extraBlock = slot.tandemInstructorUid
                ? `
          <strong>
            TANDEM INS:
            ${fullName(
                getSlotPerson(state, {
                    personUid: slot.tandemInstructorUid,
                    personType: 'skydiver',
                })
            )}
          </strong><br/>
          🪂 ${getParachuteLabel(parachute)}
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
      <strong>${fullName(person)}</strong><br/>
      <small>
        ${person.weight} kg
        ${
            person.licenseLevel
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

        if (slot.personType === 'passenger' && !slot.tandemInstructorUid) {
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
        el.querySelector('button').onclick = () => assignParachuteToSlot(p.uid);
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
            (p) => p.uid === slot.parachuteUid
        );

        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
      <div class="card-name">${fullName(person)}</div>
      <div class="card-meta">
        🪂 ${getParachuteLabel(parachute)}
      </div>
      <button class="btn btn--small">Wybierz</button>
    `;
        el.querySelector('button').onclick = () =>
            assignTandemInstructor(person.uid);
        target.appendChild(el);
    });
}

/* =========================
   BUTTON
========================= */
function renderButton(state) {
    const btn = document.querySelector('.plan-go');
    btn.disabled = !validateFlight(state);
}

function validateFlight(state) {
    for (const slot of state.flightPlan.slots) {
        if (!slot.parachuteUid) return false;
    }
    return validateTandemRules(state);
}

/* =========================
   EVENTS
========================= */
document.getElementById('cancelSelect').onclick = closeParachuteModal;

document.getElementById('cancelTandem').onclick = closeTandemModal;

/* =========================
   INIT
========================= */
subscribe('*', renderPlan);
renderPlan();
