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

        plans: {
            list: [],
            activeId: null,
            activeStatus: 'Draft',
        },

        flightPlan: {
            aircraft: 'CESSNA_182',
            time: '',
            exitPlanId: null,
            slots: [],
        },
    };
}
