const btnLoad = document.getElementById('btnLoad');
const btnSkip = document.getElementById('btnSkip');
const statusMessage = document.getElementById('statusMessage');
const navLinks = document.querySelectorAll('.nav-link');
const clock = document.querySelector('.clock');
const subtitle = document.getElementById('subtitle');
const buttons = document.getElementById('buttons');

/* =========================
   STORAGE KEYS
========================= */
const STORAGE_KEY = 'funifest_app_state';
const PLAN_SAVED_AT_KEY = 'funifest_last_plan_saved_at';
const PLAN_SAVED_ID_KEY = 'funifest_last_exit_plan_id';

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

function lockChoiceButtons() {
    btnLoad.classList.add('is-disabled');
    btnSkip.classList.add('is-disabled');
    btnLoad.disabled = true;
    btnSkip.disabled = true;
}

function hideChoiceButtons() {
    if (buttons) buttons.style.display = 'none';
}

/* =========================
   PLAN SAVED MODE
========================= */
function tryEnterPlanSavedMode() {
    const savedAt = localStorage.getItem(PLAN_SAVED_AT_KEY);
    if (!savedAt) return false;

    const dt = new Date(savedAt);
    const dateText = Number.isNaN(dt.getTime())
        ? 'Plan został zapisany'
        : `Plan zapisany: ${dt.toLocaleString('pl-PL')}`;

    if (subtitle) subtitle.textContent = dateText;

    hideChoiceButtons();
    unlockNavigation('Plan gotowy. Przejdź dalej z menu.');

    return true;
}

/* =========================
   CHOICE HANDLER
========================= */
function handleChoice(selectedBtn, otherBtn, message) {
    selectedBtn.classList.add('is-selected');
    otherBtn.classList.add('is-disabled');
    otherBtn.disabled = true;

    unlockNavigation(message);
}

btnLoad.addEventListener('click', () => {
    lockChoiceButtons();
    handleChoice(
        btnLoad,
        btnSkip,
        'Cache zostaje. Przejdź dalej z menu.'
    );
});

btnSkip.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PLAN_SAVED_AT_KEY);
    localStorage.removeItem(PLAN_SAVED_ID_KEY);

    lockChoiceButtons();
    handleChoice(
        btnSkip,
        btnLoad,
        'Cache wyczyszczony. Przejdź dalej z menu.'
    );
});

/* =========================
   INIT
========================= */
tryEnterPlanSavedMode();
