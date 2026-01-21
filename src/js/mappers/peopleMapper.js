/* =========================
   PEOPLE MAPPERS
========================= */
export function mapSkydiverDto(s) {
    return {
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
    };
}

export function mapPassengerDto(p) {
    return {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        weight: p.weight ?? 0,

        manualBlocked: p.manualBlocked === true,
        manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
        assignedExitPlanId: p.assignedExitPlanId ?? null,
    };
}

export function mapPeopleDto(skydivers, passengers) {
    return {
        skydivers: (skydivers || []).map(mapSkydiverDto),
        passengers: (passengers || []).map(mapPassengerDto),
    };
}
