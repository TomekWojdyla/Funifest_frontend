// src/js/state/initialState.js

export function createInitialState(source = 'skip') {
    return {
        meta: {
            source,
            lastUpdated: new Date().toISOString(),
        },

        people: {
            skydivers: [],
            passengers: [],
        },

        parachutes: [],

        flightPlan: {
            aircraft: 'CESSNA_182',
            exitPlanId: null,
            slots: [],
        },
    };
}
