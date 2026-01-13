const btnLoad = document.getElementById('btnLoad');
const btnSkip = document.getElementById('btnSkip');
const statusMessage = document.getElementById('statusMessage');
const navLinks = document.querySelectorAll('.nav-link');
const clock = document.querySelector('.clock');

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
   NAV UNLOCK
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

    unlockNavigation(message);
}

btnLoad.addEventListener('click', () => {
    handleChoice(
        btnLoad,
        btnSkip,
        'Manifest załadowany. Przejdź dalej do opcji z menu.'
    );
});

btnSkip.addEventListener('click', () => {
    handleChoice(
        btnSkip,
        btnLoad,
        'From zero to hero! Przejdź dalej do opcji z menu.'
    );
});
