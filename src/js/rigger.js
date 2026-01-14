import { getState, setState, subscribe } from './state/state.js';
import {
    uuid,
    getParachuteLabel,
    setParachuteStatus,
} from './helpers/helpers.js';

/* =========================
   MODAL
========================= */
const modal = document.getElementById('parachuteModal');

document.getElementById('addParachute').onclick = () =>
    modal.classList.add('active');

document.getElementById('cancelParachute').onclick = () =>
    modal.classList.remove('active');

/* =========================
   RENDER
========================= */
function renderRigger() {
    const { parachutes } = getState();

    renderParachutes(
        parachutes.filter((p) => p.status !== 'ASSIGNED'),
        'dropzoneParachutes'
    );
}

/* =========================
   UI
========================= */
function renderParachutes(list, targetId) {
    const target = document.getElementById(targetId);
    target.innerHTML = '';

    list.forEach((p) => {
        const el = document.createElement('div');
        el.className = `card ${p.status === 'BLOCKED' ? 'blocked' : ''}`;

        el.innerHTML = `
      <div class="card-name">
        ${getParachuteLabel(p)}
        ${p.status === 'BLOCKED' ? '🔒' : ''}
      </div>
      <div class="card-meta">
        ${p.model} · ${p.size} · ${p.type}
      </div>
      <div class="card-actions">
        <button class="btn btn--small toggle">
          ${p.status === 'BLOCKED' ? 'Odblokuj' : 'Zablokuj'}
        </button>
        <button class="btn btn--small danger">Usuń</button>
      </div>
    `;

        el.querySelector('.toggle').onclick = () =>
            toggleParachute(p.uid, p.status);

        el.querySelector('.danger').onclick = () => removeParachute(p.uid);

        target.appendChild(el);
    });
}

/* =========================
   ACTIONS
========================= */
function toggleParachute(uid, status) {
    setState((state) => {
        setParachuteStatus(
            state,
            uid,
            status === 'BLOCKED' ? 'AVAILABLE' : 'BLOCKED'
        );
        return state;
    }, 'parachutes');
}

function removeParachute(uid) {
    setState((state) => {
        state.parachutes = state.parachutes.filter((p) => p.uid !== uid);
        return state;
    }, 'parachutes');
}

/* =========================
   SAVE
========================= */
document.getElementById('saveParachute').onclick = () => {
    const model = pcModel.value.trim();
    const size = Number(pcSize.value);
    const type = pcType.value;
    const customName = pcCustomName.value.trim();

    if (!model || !size || !type) {
        alert('Uzupełnij wymagane pola');
        return;
    }

    setState((state) => {
        state.parachutes.push({
            uid: uuid(),
            id: null,
            model,
            size,
            type,
            customName: customName || null,
            status: 'AVAILABLE',
        });
        return state;
    }, 'parachutes');

    modal.classList.remove('active');
};

/* =========================
   INIT
========================= */
subscribe('parachutes', renderRigger);
renderRigger();
