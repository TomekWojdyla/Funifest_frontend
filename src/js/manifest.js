import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import { fullName, isStaff, isPersonBlocked, showError } from './helpers/helpers.js';
import { mapPeopleDto } from './mappers/peopleMapper.js';
import { renderCards } from './ui/cards.js';

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
function renderManifest(snapshot = null) {
    const { people } = snapshot || getState();


    renderPeopleCards(
        people.skydivers.filter((s) => !isStaff(s)),
        'funjumpers',
        'skydiver'
    );

    renderPeopleCards(
        people.skydivers.filter((s) => isStaff(s)),
        'staff',
        'skydiver'
    );

    renderPeopleCards(people.passengers, 'passengers', 'passenger');
}

/* =========================
   UI
========================= */
function renderPeopleCards(list, targetId, type) {
    const cards = (list || []).map((p) => {
        const blocked = isPersonBlocked(p);
        const inPlan = !p.manualBlocked && p.assignedExitPlanId !== null;
        const toggleLabel = p.manualBlocked ? 'Przywróć' : inPlan ? 'W planie' : 'Zablokuj';

        const rolePart = type === 'skydiver' ? `· ${p.licenseLevel} · ${p.role}` : '';
        const planPart = p.assignedExitPlanId !== null ? `· PLAN #${p.assignedExitPlanId}` : '';
        const metaHtml = `${p.weight} kg ${rolePart} ${planPart}`.trim();

        return {
            title: fullName(p),
            metaHtml,
            isBlocked: blocked,
            toggleLabel,
            toggleDisabled: inPlan,
            onToggle: inPlan ? null : () => togglePerson(p.id, type, p.manualBlocked),
            onDelete: () => removePerson(p.id, type),
        };
    });

    renderCards(targetId, cards);
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
        const people = mapPeopleDto(skydivers, passengers);
        state.people.skydivers = people.skydivers;
        state.people.passengers = people.passengers;
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
