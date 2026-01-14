// src/js/helpers/helpers.js

/* =========================
   BASIC
========================= */
export const uuid = () => crypto.randomUUID();

export const fullName = (p) => `${p.firstName} ${p.lastName}`;

/* =========================
   PERSON TYPES
========================= */
export const isSkydiver = (p) => 'licenseLevel' in p;

export const isPassenger = (p) => !isSkydiver(p);

export const isStaff = (s) =>
    s.role === 'Instructor' ||
    s.role === 'Examiner' ||
    s.isAFFInstructor ||
    s.isTandemInstructor;

/* =========================
   STATUS – PERSON
========================= */
export function setPersonStatus(state, uid, type, status) {
    const list =
        type === 'skydiver' ? state.people.skydivers : state.people.passengers;

    const p = list.find((x) => x.uid === uid);
    if (p) p.status = status;
}

export function isPersonActive(person) {
    return person.status === 'ACTIVE';
}

/* =========================
   STATUS – PARACHUTE
========================= */
export function setParachuteStatus(state, uid, status) {
    const p = state.parachutes.find((x) => x.uid === uid);
    if (p) p.status = status;
}

export function isParachuteAvailable(p) {
    return p.status === 'AVAILABLE';
}

/* =========================
   SELECTORS
========================= */
export function getPersonByUid(state, uid, type) {
    if (type === 'skydiver') {
        return state.people.skydivers.find((s) => s.uid === uid);
    }
    return state.people.passengers.find((p) => p.uid === uid);
}

export function getSlotPerson(state, slot) {
    return getPersonByUid(state, slot.personUid, slot.personType);
}

export function getParachuteByUid(state, uid) {
    return state.parachutes.find((p) => p.uid === uid);
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
            person: getPersonByUid(state, s.personUid, 'skydiver'),
        }))
        .filter(
            ({ person, slot }) =>
                person &&
                person.isTandemInstructor === true &&
                slot.parachuteUid
        );
}

/* =========================
   VALIDATION – TANDEM
========================= */
export function validateTandemRules(state) {
    const slots = state.flightPlan.slots;

    const passengerSlots = slots.filter((s) => s.personType === 'passenger');

    for (const ps of passengerSlots) {
        if (!ps.tandemInstructorUid) return false;

        const instructorSlot = slots.find(
            (s) =>
                s.personType === 'skydiver' &&
                s.personUid === ps.tandemInstructorUid
        );

        if (!instructorSlot) return false;

        if (
            !ps.parachuteUid ||
            ps.parachuteUid !== instructorSlot.parachuteUid
        ) {
            return false;
        }
    }

    // 1 instruktor = max 1 pasażer
    const usage = {};
    passengerSlots.forEach((ps) => {
        usage[ps.tandemInstructorUid] =
            (usage[ps.tandemInstructorUid] || 0) + 1;
    });

    return Object.values(usage).every((c) => c === 1);
}
