import { getState, setState, subscribe } from './state/state.js';
import {
    uuid,
    fullName,
    isStaff,
    setPersonStatus,
    isPersonActive,
} from './helpers/helpers.js';

/* =========================
   RENDER
========================= */
function renderManifest() {
    const { people } = getState();

    renderPeople(
        people.skydivers.filter((s) => !isStaff(s)),
        'funjumpers',
        'skydiver'
    );

    renderPeople(
        people.skydivers.filter((s) => isStaff(s)),
        'staff',
        'skydiver'
    );

    renderPeople(people.passengers, 'passengers', 'passenger');
}

/* =========================
   UI HELPERS
========================= */
function renderPeople(list, targetId, type) {
    const target = document.getElementById(targetId);
    target.innerHTML = '';

    list.forEach((p) => {
        const el = document.createElement('div');
        el.className = `card ${p.status === 'BLOCKED' ? 'blocked' : ''}`;

        el.innerHTML = `
      <div class="card-name">
        ${fullName(p)} ${p.status === 'BLOCKED' ? '🔒' : ''}
      </div>
      <div class="card-meta">
        ${p.weight} kg
        ${type === 'skydiver' ? `· ${p.licenseLevel} · ${p.role}` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn--small toggle">
          ${p.status === 'BLOCKED' ? 'Odblokuj' : 'Zablokuj'}
        </button>
        <button class="btn btn--small danger">Usuń</button>
      </div>
    `;

        el.querySelector('.toggle').onclick = () =>
            togglePerson(p.uid, type, p.status);

        el.querySelector('.danger').onclick = () => removePerson(p.uid, type);

        target.appendChild(el);
    });
}

/* =========================
   ACTIONS
========================= */
function togglePerson(uid, type, status) {
    setState((state) => {
        setPersonStatus(
            state,
            uid,
            type,
            status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
        );
        return state;
    }, 'people');
}

function removePerson(uid, type) {
    setState((state) => {
        const list =
            type === 'skydiver'
                ? state.people.skydivers
                : state.people.passengers;

        if (type === 'skydiver') {
            state.people.skydivers = list.filter((p) => p.uid !== uid);
        } else {
            state.people.passengers = list.filter((p) => p.uid !== uid);
        }

        return state;
    }, 'people');
}

/* =========================
   INIT
========================= */
subscribe('people', renderManifest);
renderManifest();
