// src/js/helpers/helpers.js

export const uuid = () => crypto.randomUUID();

export const fullName = (p) => `${p.firstName} ${p.lastName}`;

export const isStaff = (s) =>
    s.role === 'Instructor' ||
    s.role === 'Examiner' ||
    s.isAFFInstructor ||
    s.isTandemInstructor;

export const isPassenger = (person) => !('licenseLevel' in person);

/* =========================
   STATE HELPERS
========================= */
export const getPersonByUid = (state, uid, type) => {
    if (type === 'skydiver') {
        return state.people.skydivers.find((s) => s.uid === uid);
    }
    return state.people.passengers.find((p) => p.uid === uid);
};

export const getSlotPerson = (state, slot) =>
    getPersonByUid(state, slot.personUid, slot.personType);

/* =========================
   TANDEM VALIDATION
========================= */
export function validateTandemRules(state) {
    const slots = state.flightPlan.slots;

    const passengers = slots.filter((s) => s.personType === 'passenger');

    for (const passengerSlot of passengers) {
        // musi mieć instruktora
        const instructorSlot = slots.find((s) => {
            if (s.personType !== 'skydiver') return false;

            const sd = getPersonByUid(state, s.personUid, 'skydiver');

            return sd?.isTandemInstructor;
        });

        if (!instructorSlot) return false;

        // muszą dzielić ten sam spadochron
        if (
            !passengerSlot.parachuteUid ||
            passengerSlot.parachuteUid !== instructorSlot.parachuteUid
        ) {
            return false;
        }
    }

    // 1:1 – instruktor nie może obsługiwać >1 pasażera
    const instructorUsage = {};

    passengers.forEach((p) => {
        const instructor = slots.find(
            (s) =>
                s.personType === 'skydiver' && s.parachuteUid === p.parachuteUid
        );

        if (!instructor) return;

        instructorUsage[instructor.personUid] =
            (instructorUsage[instructor.personUid] || 0) + 1;
    });

    return Object.values(instructorUsage).every((c) => c === 1);
}

/* =========================
   PARACHUTES
========================= */
export function getParachuteByUid(state, uid) {
    return state.parachutes.find((p) => p.uid === uid);
}

export function getFirstAvailableParachute(state) {
    const used = state.flightPlan.slots
        .map((s) => s.parachuteUid)
        .filter(Boolean);

    return state.parachutes.find((p) => !used.includes(p.uid));
}
