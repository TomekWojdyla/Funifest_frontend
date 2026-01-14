import { getState, setState, subscribe } from './state/state.js';
import { uuid } from './helpers/helpers.js';

/* =========================
   ELEMENTS
========================= */
const modal = document.getElementById('parachuteModal');
const dropzoneList = document.getElementById('dropzoneParachutes');

document.getElementById('addParachute').onclick = () =>
    modal.classList.add('active');

document.getElementById('cancelParachute').onclick = () =>
    modal.classList.remove('active');

/* =========================
   RENDER
========================= */
function renderRigger() {
    const { parachutes } = getState();
    dropzoneList.innerHTML = '';

    parachutes.forEach((p) => dropzoneList.appendChild(parachuteCard(p)));
}

/* =========================
   CARD
========================= */
function parachuteCard(p) {
    const el = document.createElement('div');
    el.className = 'card';

    el.innerHTML = `
    <button class="card-remove">&times;</button>
    <div class="card-name">${p.model}</div>
    <div class="card-meta">
      <span>${p.size}</span>
      <span>${p.type}</span>
    </div>
  `;

    el.querySelector('.card-remove').onclick = () => removeParachute(p.uid);

    return el;
}

/* =========================
   ACTIONS
========================= */
function removeParachute(uid) {
    setState((s) => {
        s.parachutes = s.parachutes.filter((p) => p.uid !== uid);
        return s;
    }, 'parachutes');
}

document.getElementById('saveParachute').onclick = () => {
    const model = pcModel.value.trim();
    const size = Number(pcSize.value);
    const type = pcType.value;

    if (!model || !size || !type) {
        alert('Uzupełnij wszystkie pola');
        return;
    }

    setState((s) => {
        s.parachutes.push({
            uid: uuid(),
            id: null,
            model,
            size,
            type,
        });
        return s;
    }, 'parachutes');

    modal.classList.remove('active');
};

/* =========================
   INIT
========================= */
subscribe('parachutes', renderRigger);
renderRigger();
