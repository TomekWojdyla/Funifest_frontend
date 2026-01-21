/* =========================
   PARACHUTE MAPPERS
========================= */
export function mapParachuteDto(p) {
    return {
        id: p.id,
        model: p.model,
        size: p.size,
        type: p.type,
        customName: p.customName ?? null,

        manualBlocked: p.manualBlocked === true,
        manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
        assignedExitPlanId: p.assignedExitPlanId ?? null,
    };
}

export function mapParachutesDto(parachutes) {
    return (parachutes || []).map(mapParachuteDto);
}
