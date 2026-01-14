import { getState, setState, subscribe } from './state/state.js';
import {
    fullName,
    isStaff,
    getSlotPerson,
    getParachuteByUid,
    getFirstAvailableParachute,
    validateTandemRules,
} from './helpers/helpers.js';

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
    setState((state) => {
        const slotNum = getFirstFreeSlot(state.flightPlan.slots);
        if (!slotNum) return state;

        state.flightPlan.slots.push({
            slotNumber: slotNum,
            personUid: person.uid,
            personType: type,
            parachuteUid: null,
        });

        return state;
    }, 'flightPlan');
}

function removeFromFlight(slotNumber) {
    setState((state) => {
        state.flightPlan.slots = state.flightPlan.slots.filter(
            (s) => s.slotNumber !== slotNumber
        );
        return state;
    }, 'flightPlan');
}

function assignParachuteToSlot(slotNumber) {
    setState((state) => {
        const slot = state.flightPlan.slots.find(
            (s) => s.slotNumber === slotNumber
        );
        if (!slot) return state;

        const parachute = getFirstAvailableParachute(state);
        if (!parachute) return state;

        slot.parachuteUid = parachute.uid;
        return state;
    }, 'flightPlan');
}

/* =========================
   VALIDATION
========================= */
function validateFlight(state) {
    for (const slot of state.flightPlan.slots) {
        if (!slot.parachuteUid) return false;
    }
    return validateTandemRules(state);
}

/* =========================
   RENDER
========================= */
function renderPlan() {
    const state = getState();

    renderPeople(
        state.people.skydivers.filter((s) => !isStaff(s)),
        'plan-funjumpers',
        'skydiver'
    );

    renderPeople(
        state.people.skydivers.filter((s) => isStaff(s)),
        'plan-staff',
        'skydiver'
    );

    renderPeople(state.people.passengers, 'plan-passengers', 'passenger');

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
        const parachute = slot.parachuteUid
            ? getParachuteByUid(state, slot.parachuteUid)
            : null;

        const flags = [];
        if (person.isAFFInstructor) flags.push('AFF INS');
        if (person.isTandemInstructor) flags.push('TANDEM INS');

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
        ${
            parachute
                ? `🪂 ${parachute.model} ${parachute.size} · ${parachute.type}`
                : `<span class="invalid">❌ Brak spadochronu</span>
               <button class="btn btn--small assign">Przypisz spadochron</button>`
        }
      </div>
      <button class="btn btn--small remove">Usuń z wylotu</button>
    `;

        if (!parachute) {
            el.querySelector('.assign').onclick = () =>
                assignParachuteToSlot(num);
            el.classList.add('invalid');
        }

        el.querySelector('.remove').onclick = () => removeFromFlight(num);
    });
}

/* =========================
   BUTTON
========================= */
function renderButton(state) {
    const btn = document.querySelector('.plan-go');
    btn.disabled = !validateFlight(state);
}

/* =========================
   INIT
========================= */
subscribe('*', renderPlan);
renderPlan();
