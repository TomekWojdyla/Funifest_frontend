import { initState, loadStateFromStorage } from './state/state.js';

function guardPlannerPages() {
    const path = window.location.pathname || '';
    const isPlannerPage = /\/(plan|manifest|rigger)\.html$/i.test(path);
    if (!isPlannerPage) return true;

    const ok = sessionStorage.getItem('funifest_planista_done') === '1';
    if (ok) return true;

    window.location.replace('../../index.html');
    return false;
}

function bootstrap() {
    if (!guardPlannerPages()) return;

    const restored = loadStateFromStorage();

    if (!restored) {
        initState({ source: 'skip' });
    }

    console.log('AppState ready');
}

bootstrap();
