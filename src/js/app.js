// src/js/app.js

import { initState, loadStateFromStorage } from './state/state.js';

function bootstrap() {
    const restored = loadStateFromStorage();

    if (!restored) {
        initState({ source: 'skip' });
    }

    console.log('AppState ready');
}

bootstrap();
