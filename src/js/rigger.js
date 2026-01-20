import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import { getParachuteLabel, isParachuteBlocked, showError } from './helpers/helpers.js';

/* =========================
   MODAL
========================= */
const modal = document.getElementById('parachuteModal');
const pcCustomName = document.getElementById('pcCustomName');
const pcModel = document.getElementById('pcModel');
const pcSize = document.getElementById('pcSize');
const pcType = document.getElementById('pcType');
const saveParachuteBtn = document.getElementById('saveParachute');

document.getElementById('addParachute').onclick = () =>
    modal.classList.add('active');

document.getElementById('cancelParachute').onclick = () =>
    modal.classList.remove('active');

/* =========================
   RENDER
========================= */
function renderRigger() {
    const { parachutes } = getState();
    renderParachutes(parachutes, 'dropzoneParachutes');
}

/* =========================
   UI
========================= */
function renderParachutes(list, targetId) {
    const target = document.getElementById(targetId);
    target.innerHTML = '';

    list.forEach((p) => {
        const blocked = isParachuteBlocked(p);
        const inUse = !p.manualBlocked && p.assignedExitPlanId !== null;
        const toggleLabel = p.manualBlocked ? 'Przywróć' : inUse ? 'W użyciu' : 'Zablokuj';

        const el = document.createElement('div');
        el.className = `card ${blocked ? 'blocked' : ''}`;

        el.innerHTML = `
      <div class="card-name">
        ${getParachuteLabel(p)}
      </div>
      <div class="card-meta">
        ${p.model} · ${p.size} · ${p.type}
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
        toggleBtn.disabled = inUse;

        if (!inUse) {
            toggleBtn.onclick = () => toggleParachute(p.id, p.manualBlocked);
        }

        el.querySelector('.danger').onclick = () => removeParachute(p.id);

        target.appendChild(el);
    });
}

/* =========================
   ACTIONS (BE)
========================= */
async function toggleParachute(id, isManualBlocked) {
    try {
        if (isManualBlocked) await api.unblockParachute(id);
        else await api.blockParachute(id);

        await syncParachutesFromApi();
    } catch (e) {
        showError(e);
        await syncParachutesFromApi();
    }
}

async function removeParachute(id) {
    setState((state) => {
        state.parachutes = state.parachutes.filter((p) => p.id !== id);
        return state;
    }, 'parachutes');

    try {
        await api.deleteParachute(id);
        await syncParachutesFromApi();
    } catch (e) {
        showError(e);
        await syncParachutesFromApi();
    }
}

/* =========================
   SAVE (POST → GET)
========================= */
saveParachuteBtn.onclick = async () => {
    const model = pcModel.value.trim();
    const size = Number(pcSize.value);
    const type = pcType.value;
    const customName = pcCustomName.value.trim();

    if (!model || !size || !type) {
        alert('Uzupełnij wymagane pola');
        return;
    }

    try {
        await api.createParachute({
            model,
            size,
            type,
            customName: customName || null,
        });

        pcCustomName.value = '';
        pcModel.value = '';
        pcSize.value = '';
        pcType.value = '';

        modal.classList.remove('active');
        await syncParachutesFromApi();
    } catch (e) {
        showError(e);
    }
};

/* =========================
   SYNC (GET → STATE)
========================= */
async function syncParachutesFromApi() {
    try {
        const parachutes = await api.getParachutes();

        setState((state) => {
            state.parachutes = (parachutes || []).map((p) => ({
                id: p.id,
                model: p.model,
                size: p.size,
                type: p.type,
                customName: p.customName ?? null,

                manualBlocked: p.manualBlocked === true,
                manualBlockedByExitPlanId: p.manualBlockedByExitPlanId ?? null,
                assignedExitPlanId: p.assignedExitPlanId ?? null,
            }));
            return state;
        }, 'parachutes');
    } catch (e) {
        showError(e);
    }
}

/* =========================
   INIT
========================= */
subscribe('parachutes', renderRigger);
renderRigger();
syncParachutesFromApi();
