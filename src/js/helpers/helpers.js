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
   LOCKS – SOURCE OF TRUTH (BE)
========================= */
export function isPersonBlocked(p) {
    return p.manualBlocked === true || p.assignedExitPlanId !== null;
}

export function isParachuteBlocked(p) {
    return p.manualBlocked === true || p.assignedExitPlanId !== null;
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

    return list.filter((p) => !isPersonBlocked(p));
}

export function getAvailableParachutes(state) {
    return state.parachutes.filter((p) => !isParachuteBlocked(p));
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

/* =========================
   VALIDATION – STUDENT (AFF)
========================= */
export function isStudentRole(role) {
    if (!role || typeof role !== 'string') return false;
    return role === 'Student' || role === 'StudentAffEntry' || role === 'StudentAffAdvanced';
}

function isEligibleInstructorForStudent(person) {
    if (!person) return false;
    return person.isAffInstructor === true || person.role === 'Instructor' || person.role === 'Examiner';
}

export function validateStudentRules(state) {
    const slots = state.flightPlan.slots;

    const skydiverSlots = slots.filter((s) => s.personType === 'skydiver');
    const passengerSlots = slots.filter((s) => s.personType === 'passenger');

    const studentPresent = skydiverSlots.some((s) => {
        const p = getPersonById(state, s.personId, 'skydiver');
        return p && isStudentRole(p.role);
    });

    if (!studentPresent) return true;

    const tandemInstructorIds = new Set(
        passengerSlots
            .map((p) => p.tandemInstructorId)
            .filter((id) => id !== null && id !== undefined)
    );

    const hasNonTandemInstructor = skydiverSlots.some((s) => {
        const p = getPersonById(state, s.personId, 'skydiver');
        if (!isEligibleInstructorForStudent(p)) return false;
        return !tandemInstructorIds.has(p.id);
    });

    return hasNonTandemInstructor;
}


