const btnLoad = document.getElementById('btnLoad');
const btnSkip = document.getElementById('btnSkip');
const statusMessage = document.getElementById('statusMessage');
const navLinks = document.querySelectorAll('.nav-link');
const clock = document.querySelector('.clock');

/* =========================
   STORAGE KEYS
========================= */
const ENTRY_KEY = 'funifest_entry_planner';
const DONE_KEY = 'funifest_planista_done';
const MODE_KEY = 'funifest_mode';

const STORAGE_KEY = 'funifest_app_state';
const PLAN_SAVED_AT_KEY = 'funifest_last_plan_saved_at';
const PLAN_SAVED_ID_KEY = 'funifest_last_exit_plan_id';

/* =========================
   ENTRY GUARD
========================= */
function guardEntry() {
    const ok = sessionStorage.getItem(ENTRY_KEY) === '1';
    if (ok) return true;

    window.location.replace('../../index.html');
    return false;
}

function markPlanistaDone(mode) {
    sessionStorage.setItem(DONE_KEY, '1');
    if (mode) sessionStorage.setItem(MODE_KEY, mode);
}

/* =========================
   CLOCK
========================= */
function updateClock() {
    const now = new Date();

    const date = now.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    const time = now.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    clock.textContent = `${date} ${time}`;
}

updateClock();
setInterval(updateClock, 1000);

/* =========================
   NAV
========================= */
function unlockNavigation(message) {
    statusMessage.textContent = message;

    navLinks.forEach((link) => {
        link.classList.remove('is-disabled');
        link.href = `./${link.dataset.section}.html`;
    });
}

/* =========================
   BUTTON CHOICE HANDLER
========================= */
function handleChoice(selectedBtn, otherBtn, message) {
    selectedBtn.classList.add('is-selected');
    otherBtn.classList.add('is-disabled');
    otherBtn.disabled = true;

    unlockNavigation(message);
}

btnLoad.addEventListener('click', () => {
    btnLoad.disabled = true;
    btnSkip.disabled = true;

    markPlanistaDone('online');
    handleChoice(btnLoad, btnSkip, 'Tryb online (BE). Przejdź dalej z menu.');
});

btnSkip.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PLAN_SAVED_AT_KEY);
    localStorage.removeItem(PLAN_SAVED_ID_KEY);

    btnLoad.disabled = true;
    btnSkip.disabled = true;

    markPlanistaDone('offline');
    handleChoice(btnSkip, btnLoad, 'Tryb offline. Przejdź dalej z menu.');
});

/* =========================
   INIT
========================= */
guardEntry();
