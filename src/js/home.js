// src/js/home.js

const HOLD_MS = 2000; // ile ma zostać obrazek po animacji

/* =========================
   PLAN SAVED BANNER
========================= */
const PLAN_SAVED_AT_KEY = 'funifest_last_plan_saved_at';

function applyPlanSavedBanner() {
    const savedAt = localStorage.getItem(PLAN_SAVED_AT_KEY);
    if (!savedAt) return;

    const subtitle = document.querySelector('.hero__subtitle');
    if (!subtitle) return;

    const dt = new Date(savedAt);
    if (Number.isNaN(dt.getTime())) {
        subtitle.textContent = 'Plan zapisany';
        return;
    }

    subtitle.textContent = `Plan zapisany: ${dt.toLocaleString('pl-PL')}`;
}


function createTransitionLayer(imgSrc) {
    const layer = document.createElement('div');
    layer.className = 'page-transition';
    layer.setAttribute('aria-hidden', 'true');

    const img = document.createElement('img');
    img.className = 'page-transition__img';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = imgSrc;

    layer.appendChild(img);
    document.body.appendChild(layer);

    return { layer, img };
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function playTransitionAndNavigate(href, imgSrc) {
    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduceMotion) {
        window.location.href = href;
        return;
    }

    const { layer, img } = createTransitionLayer(imgSrc);

    const imgLoaded = new Promise((resolve) => {
        const done = () => resolve(true);
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', () => resolve(false), { once: true });
    });

    layer.classList.add('is-visible');
    await new Promise((r) => requestAnimationFrame(r));

    const ok = await Promise.race([imgLoaded, sleep(600)]);
    if (!ok) {
        window.location.href = href;
        return;
    }

    layer.classList.add('is-animating');

    await sleep(420 + HOLD_MS);

    window.location.href = href;
}

function setupButtons() {
    const links = document.querySelectorAll('.hero__buttons a.btn');
    if (!links.length) return;

    links.forEach((a) => {
        a.addEventListener('click', (e) => {
            e.preventDefault();

            if (document.body.dataset.transitioning === '1') return;
            document.body.dataset.transitioning = '1';

            const href = a.getAttribute('href');
            if (!href) return;

            const imgSrc =
                a.dataset.transitionImg || './src/images/fkyeah.webp';

            playTransitionAndNavigate(href, imgSrc);
        });
    });
}

applyPlanSavedBanner();
setupButtons();
