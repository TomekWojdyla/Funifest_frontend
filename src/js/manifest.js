import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import { fullName, isStaff, isPersonBlocked, showError } from './helpers/helpers.js';

/* =========================
   DOM
========================= */
const addSkydiverBtn = document.getElementById('addSkydiver');
const addStaffBtn = document.getElementById('addStaff');
const addPassengerBtn = document.getElementById('addPassenger');

const skydiverModal = document.getElementById('skydiverModal');
const passengerModal = document.getElementById('passengerModal');

const sdFirstName = document.getElementById('sdFirstName');
const sdLastName = document.getElementById('sdLastName');
const sdWeight = document.getElementById('sdWeight');
const sdLicense = document.getElementById('sdLicense');
const sdRole = document.getElementById('sdRole');
const sdAFF = document.getElementById('sdAFF');
const sdTandem = document.getElementById('sdTandem');
const saveSkydiverBtn = document.getElementById('saveSkydiver');

const psFirstName = document.getElementById('psFirstName');
const psLastName = document.getElementById('psLastName');
const psWeight = document.getElementById('psWeight');
const savePassengerBtn = document.getElementById('savePassenger');

/* =========================
   MODALS
========================= */
function openSkydiverModal({ defaultRole = 'FunJumper' } = {}) {
    sdFirstName.value = '';
    sdLastName.value = '';
    sdWeight.value = '';
    sdLicense.value = '';
    sdRole.value = defaultRole;
    sdAFF.checked = false;
    sdTandem.checked = false;

    skydiverModal.classList.add('active');
}

function openPassengerModal() {
    psFirstName.value = '';
    psLastName.value = '';
    psWeight.value = '';

    passengerModal.classList.add('active');
}

function closeModal() {
    skydiverModal.classList.remove('active');
    passengerModal.classList.remove('active');
}

window.closeModal = closeModal;

addSkydiverBtn.onclick = () => openSkydiverModal({ defaultRole: 'FunJumper' });
addStaffBtn.onclick = () => openSkydiverModal({ defaultRole: 'Instructor' });
addPassengerBtn.onclick = () => openPassengerModal();

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
        const blocked = isPersonBlocked(p);
        const inPlan = !p.manualBlocked && p.assignedExitPlanId !== null;
        const toggleLabel = p.manualBlocked ? 'Przywróć' : inPlan ? 'W planie' : 'Zablokuj';


        const el = document.createElement('div');
        el.className = `card ${blocked ? 'blocked' : ''}`;

        el.innerHTML = `
      <div class="card-name">
        ${fullName(p)}
      </div>
      <div class="card-meta">
        ${p.weight} kg
        ${type === 'skydiver' ? `· ${p.licenseLevel} · ${p.role}` : ''}
        ${p.assignedExitPlanId !== null ? `· PLAN #${p.assignedExitPlanId}` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn--small toggle">
            ${toggleLabel}
        </button>
        <button class="btn btn--small danger">Usuń</button>
      </div>
    `;

        const toggleBtn = el.querySelector('.toggle');
        toggleBtn.disabled = inPlan;

        if (!inPlan) {
            toggleBtn.onclick = () => togglePerson(p.id, type, p.manualBlocked);
        }
        el.querySelector('.danger').onclick = () => removePerson(p.id, type);

        target.appendChild(el);
    });
}

/* =========================
   ACTIONS (BE)
========================= */
async function togglePerson(id, type, isManualBlocked) {
    try {
        if (type === 'skydiver') {
            if (isManualBlocked) await api.unblockSkydiver(id);
            else await api.blockSkydiver(id);
        } else {
            if (isManualBlocked) await api.unblockPassenger(id);
            else await api.blockPassenger(id);
        }

        await syncPeopleFromApi();
    } catch (e) {
        showError(e);
        await syncPeopleFromApi();
    }
}

async function removePerson(id, type) {
    setState((state) => {
        if (type === 'skydiver') {
            state.people.skydivers = state.people.skydivers.filter((p) => p.id !== id);
        } else {
            state.people.passengers = state.people.passengers.filter((p) => p.id !== id);
        }
        return state;
    }, 'people');

    try {
        if (type === 'skydiver') {
            await api.deleteSkydiver(id);
        } else {
            await api.deletePassenger(id);
        }

        await syncPeopleFromApi();
    } catch (e) {
        showError(e);
        await syncPeopleFromApi();
    }
}

/* =========================
   CREATE (POST → GET)
========================= */
saveSkydiverBtn.onclick = async () => {
    const firstName = sdFirstName.value.trim();
    const lastName = sdLastName.value.trim();
    const weightRaw = sdWeight.value;
    const licenseLevel = sdLicense.value;
    const role = sdRole.value;

    if (!firstName || !lastName || !licenseLevel || !role) {
        alert('Uzupełnij wymagane pola');
        return;
    }

    const weight = weightRaw === '' ? null : Number(weightRaw);
    if (weight !== null && Number.isNaN(weight)) {
        alert('Waga musi być liczbą');
        return;
    }

    try {
        await api.createSkydiver({
            firstName,
            lastName,
            weight,
            licenseLevel,
            role,
            isAFFInstructor: sdAFF.checked,
            isTandemInstructor: sdTandem.checked,
            parachuteId: null,
        });

        closeModal();
        await syncPeopleFromApi();
    } catch (e) {
        showError(e);
    }
};

savePassengerBtn.onclick = async () => {
    const firstName = psFirstName.value.trim();
    const lastName = psLastName.value.trim();
    const weightRaw = psWeight.value;

    if (!firstName || !lastName) {
        alert('Uzupełnij wymagane pola');
        return;
    }

    const weight = weightRaw === '' ? null : Number(weightRaw);
    if (weight !== null && Number.isNaN(weight)) {
        alert('Waga musi być liczbą');
        return;
    }

    try {
        await api.createPassenger({
            firstName,
            lastName,
            weight,
        });

        closeModal();
        await syncPeopleFromApi();
    } catch (e) {
        showError(e);
    }
};

/* =========================
   SYNC (GET → STATE)
========================= */
async function syncPeopleFromApi() {
    const [skydivers, passengers] = await Promise.all([
        api.getSkydivers(),
        api.getPassengers(),
    ]);

    setState((state) => {
        state.people.skydivers = (skydivers || []).map((s) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            weight: s.weight ?? 0,
            licenseLevel: s.licenseLevel,
            role: s.role,
            isAffInstructor: s.isAFFInstructor,
            isTandemInstructor: s.isTandemInstructor,
            parachuteId: s.parachuteId ?? null,

            manualBlocked: s.manualBlocked === true,
            manualBlockedByExitPlanId: s.manualBlockedByExitPlanId ?? null,
            assignedExitPlanId: s.assignedExitPlanId ?? null,
        }));

        state.people.passengers = (passengers || []).map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            weight: p.weight ?? 0,

            manualBlocked: p.manualBlocked === true,
            manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
            assignedExitPlanId: p.assignedExitPlanId ?? null,
        }));

        return state;
    }, 'people');
}

/* =========================
   INIT
========================= */
subscribe('people', renderManifest);
renderManifest();

(async () => {
    try {
        await syncPeopleFromApi();
    } catch (e) {
        showError(e);
    }
})();
