import { getState, setState, subscribe } from './state/state.js';
import { uuid, fullName, isStaff } from './helpers/helpers.js';

/* =========================
   MODALS
========================= */
const skydiverModal = document.getElementById('skydiverModal');
const passengerModal = document.getElementById('passengerModal');

window.closeModal = () => {
    skydiverModal.classList.remove('active');
    passengerModal.classList.remove('active');
};

/* =========================
   BUTTONS
========================= */
document.getElementById('addSkydiver').onclick = document.getElementById(
    'addStaff'
).onclick = () => skydiverModal.classList.add('active');

document.getElementById('addPassenger').onclick = () =>
    passengerModal.classList.add('active');

/* =========================
   RENDER
========================= */
function renderManifest() {
    const { people } = getState();

    const fj = document.getElementById('funjumpers');
    const staff = document.getElementById('staff');
    const pass = document.getElementById('passengers');

    fj.innerHTML = staff.innerHTML = pass.innerHTML = '';

    people.skydivers.forEach((s) => {
        (isStaff(s) ? staff : fj).appendChild(skydiverCard(s));
    });

    people.passengers.forEach((p) => pass.appendChild(passengerCard(p)));
}

/* =========================
   CARDS
========================= */
function skydiverCard(s) {
    const el = document.createElement('div');
    el.className = `card ${isStaff(s) ? 'staff' : ''}`;

    const flags = [];
    if (s.isAFFInstructor) flags.push('AFF INS');
    if (s.isTandemInstructor) flags.push('TANDEM INS');

    el.innerHTML = `
    <button class="card-remove">&times;</button>
    <div class="card-name">${fullName(s)}</div>
    <div class="card-meta">
      <span>${s.weight} kg</span>
      <span>${s.licenseLevel} · ${s.role}</span>
      ${flags.map((f) => `<span class="flag">${f}</span>`).join('')}
    </div>
  `;

    el.querySelector('.card-remove').onclick = () => removeSkydiver(s.uid);
    return el;
}

function passengerCard(p) {
    const el = document.createElement('div');
    el.className = 'card passenger';

    el.innerHTML = `
    <button class="card-remove">&times;</button>
    <div class="card-name">${fullName(p)}</div>
    <div class="card-meta">
      <span>${p.weight} kg</span>
    </div>
  `;

    el.querySelector('.card-remove').onclick = () => removePassenger(p.uid);
    return el;
}

/* =========================
   ACTIONS
========================= */
function removeSkydiver(uid) {
    setState((s) => {
        s.people.skydivers = s.people.skydivers.filter((x) => x.uid !== uid);
        return s;
    }, 'people');
}

function removePassenger(uid) {
    setState((s) => {
        s.people.passengers = s.people.passengers.filter((x) => x.uid !== uid);
        return s;
    }, 'people');
}

/* =========================
   SAVE SKYDIVER
========================= */
document.getElementById('saveSkydiver').onclick = () => {
    const firstName = sdFirstName.value.trim();
    const lastName = sdLastName.value.trim();
    const weight = Number(sdWeight.value);
    const licenseLevel = sdLicense.value;
    const role = sdRole.value;

    if (!firstName || !lastName || !weight || !licenseLevel || !role) {
        alert('Uzupełnij wymagane pola');
        return;
    }

    setState((s) => {
        s.people.skydivers.push({
            uid: uuid(),
            id: null,
            firstName,
            lastName,
            weight,
            licenseLevel,
            role,
            isAFFInstructor: sdAFF.checked,
            isTandemInstructor: sdTandem.checked,
        });
        return s;
    }, 'people');

    closeModal();
};

/* =========================
   SAVE PASSENGER
========================= */
document.getElementById('savePassenger').onclick = () => {
    const firstName = psFirstName.value.trim();
    const lastName = psLastName.value.trim();
    const weight = Number(psWeight.value);

    if (!firstName || !lastName || weight < 30 || weight > 120) {
        alert('Nieprawidłowe dane pasażera');
        return;
    }

    setState((s) => {
        s.people.passengers.push({
            uid: uuid(),
            id: null,
            firstName,
            lastName,
            weight,
        });
        return s;
    }, 'people');

    closeModal();
};

/* =========================
   INIT
========================= */
subscribe('people', renderManifest);
renderManifest();
