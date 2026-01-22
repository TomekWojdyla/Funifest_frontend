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
   LOCKS
========================= */
export function isPersonBlocked(p) {
    return p.manualBlocked === true;
}

export function isParachuteBlocked(p) {
    return p.manualBlocked === true;
}

export function isPersonAssignedToOtherPlan(p, activePlanId = null) {
    return p.assignedExitPlanId !== null && p.assignedExitPlanId !== activePlanId;
}

export function isParachuteAssignedToOtherPlan(p, activePlanId = null) {
    return p.assignedExitPlanId !== null && p.assignedExitPlanId !== activePlanId;
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
export function getAvailablePeople(state, type, activePlanId = null) {
    const list =
        type === 'skydiver' ? state.people.skydivers : state.people.passengers;

    return list.filter(
        (p) => !isPersonBlocked(p) && !isPersonAssignedToOtherPlan(p, activePlanId)
    );
}

export function getAvailableParachutes(state, activePlanId = null) {
    return state.parachutes.filter(
        (p) => !isParachuteBlocked(p) && !isParachuteAssignedToOtherPlan(p, activePlanId)
    );
}

/* =========================
   TANDEM HELPERS
========================= */
export function getTandemInstructorsInFlight(state) {
    const ids = new Set();

    state.flightPlan.slots
        .filter((s) => s.personType === 'skydiver')
        .forEach((s) => {
            const person = getPersonById(state, s.personId, 'skydiver');
            if (!person || person.isTandemInstructor !== true) return;
            if (!s.parachuteId) return;
            ids.add(person.id);
        });

    return ids;
}

/* =========================
   VALIDATION – TANDEM
========================= */
export function validateTandemRules(state, passengerSlots = null, skydiverSlots = null) {
    const slots = state.flightPlan.slots;

    const passengers = passengerSlots || slots.filter((s) => s.personType === 'passenger');
    const skydivers = skydiverSlots || slots.filter((s) => s.personType === 'skydiver');

    for (const ps of passengers) {
        if (!ps.tandemInstructorId) return false;

        const instructorSlot = skydivers.find((s) => s.personId === ps.tandemInstructorId);

        if (!instructorSlot) return false;

        if (!ps.parachuteId || ps.parachuteId !== instructorSlot.parachuteId) {
            return false;
        }
    }

    // 1 instruktor = max 1 pasażer
    const usage = {};
    passengers.forEach((ps) => {
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

export function validateStudentRules(state, skydiverSlots = null) {
    const slots = state.flightPlan.slots;

    const skydivers = skydiverSlots || slots.filter((s) => s.personType === 'skydiver');
    const passengerSlots = slots.filter((s) => s.personType === 'passenger');

    const studentPresent = skydivers.some((s) => {
        const p = getPersonById(state, s.personId, 'skydiver');
        return p && isStudentRole(p.role);
    });

    if (!studentPresent) return true;

    const tandemInstructorIds = new Set(
        passengerSlots
            .map((p) => p.tandemInstructorId)
            .filter((id) => id !== null && id !== undefined)
    );

    const hasNonTandemInstructor = skydivers.some((s) => {
        const p = getPersonById(state, s.personId, 'skydiver');
        if (!isEligibleInstructorForStudent(p)) return false;
        return !tandemInstructorIds.has(p.id);
    });

    return hasNonTandemInstructor;
}
