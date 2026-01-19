// src/js/helpers/helpers.js

/* =========================
   BASIC
========================= */
export const uuid = () => crypto.randomUUID();

export const fullName = (p) => `${p.firstName} ${p.lastName}`;

/* =========================
   UI – ERRORS
========================= */
export function showError(message) {
    const text =
        typeof message === 'string'
            ? message
            : message && message.message
              ? message.message
              : 'Error';
    alert(text);
}

/* =========================
   PERSON TYPES
========================= */
export const isSkydiver = (p) => 'licenseLevel' in p;

export const isPassenger = (p) => !isSkydiver(p);

export const isStaff = (s) =>
    s.role === 'Instructor' ||
    s.role === 'Examiner' ||
    s.isAffInstructor ||
    s.isTandemInstructor;

/* =========================
   STATUS – PERSON
========================= */
export function setPersonStatus(state, id, type, status) {
    const list =
        type === 'skydiver' ? state.people.skydivers : state.people.passengers;

    const p = list.find((x) => x.id === id);
    if (p) p.status = status;
}

export function isPersonActive(person) {
    return person.status === 'ACTIVE';
}

/* =========================
   STATUS – PARACHUTE
========================= */
export function setParachuteStatus(state, id, status) {
    const p = state.parachutes.find((x) => x.id === id);
    if (p) p.status = status;
}

export function isParachuteAvailable(p) {
    return p.status === 'AVAILABLE';
}

/* =========================
   SELECTORS
========================= */
export function getPersonById(state, id, type) {
    if (type === 'skydiver') {
        return state.people.skydivers.find((s) => s.id === id);
    }
    return state.people.passengers.find((p) => p.id === id);
}

export function getSlotPerson(state, slot) {
    return getPersonById(state, slot.personId, slot.personType);
}

export function getParachuteById(state, id) {
    return state.parachutes.find((p) => p.id === id);
}

/* =========================
   PARACHUTE LABEL
========================= */
export function getParachuteLabel(p) {
    if (p.customName && p.customName.trim() !== '') {
        return p.customName;
    }
    return `${p.model} ${p.size} (${p.type})`;
}

/* =========================
   AVAILABLE LISTS (PLAN)
========================= */
export function getAvailablePeople(state, type) {
    const list =
        type === 'skydiver' ? state.people.skydivers : state.people.passengers;

    return list.filter((p) => p.status === 'ACTIVE');
}

export function getAvailableParachutes(state) {
    return state.parachutes.filter((p) => p.status === 'AVAILABLE');
}

/* =========================
   TANDEM HELPERS
========================= */
export function getTandemInstructorsInFlight(state) {
    return state.flightPlan.slots
        .filter((s) => s.personType === 'skydiver')
        .map((s) => ({
            slot: s,
            person: getPersonById(state, s.personId, 'skydiver'),
        }))
        .filter(
            ({ person, slot }) =>
                person && person.isTandemInstructor === true && slot.parachuteId
        );
}

/* =========================
   VALIDATION – TANDEM
========================= */
export function validateTandemRules(state) {
    const slots = state.flightPlan.slots;

    const passengerSlots = slots.filter((s) => s.personType === 'passenger');

    for (const ps of passengerSlots) {
        if (!ps.tandemInstructorId) return false;

        const instructorSlot = slots.find(
            (s) =>
                s.personType === 'skydiver' && s.personId === ps.tandemInstructorId
        );

        if (!instructorSlot) return false;

        if (!ps.parachuteId || ps.parachuteId !== instructorSlot.parachuteId) {
            return false;
        }
    }

    // 1 instruktor = max 1 pasażer
    const usage = {};
    passengerSlots.forEach((ps) => {
        usage[ps.tandemInstructorId] =
            (usage[ps.tandemInstructorId] || 0) + 1;
    });

    return Object.values(usage).every((c) => c === 1);
}
