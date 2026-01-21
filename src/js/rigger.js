import { getState, setState, subscribe } from './state/state.js';
import { api } from './api/api.js';
import { getParachuteLabel, isParachuteBlocked, showError } from './helpers/helpers.js';
import { mapParachutesDto } from './mappers/parachuteMapper.js';
import { renderCards } from './ui/cards.js';

/* =========================
   MODAL
========================= */
const modal = document.getElementById('parachuteModal');
const pcCustomName = document.getElementById('pcCustomName');
const pcModel = document.getElementById('pcModel');
const pcSize = document.getElementById('pcSize');
const pcType = document.getElementById('pcType');
const saveParachuteBtn = document.getElementById('saveParachute');

document.getElementById('addParachute').onclick = () => modal.classList.add('active');
document.getElementById('cancelParachute').onclick = () => modal.classList.remove('active');

/* =========================
   RENDER
========================= */
function renderRigger(snapshot = null) {
    const { parachutes } = snapshot || getState();
    renderParachuteCards(parachutes, 'dropzoneParachutes');
}

/* =========================
   UI
========================= */
function renderParachuteCards(list, targetId) {
    const cards = (list || []).map((p) => {
        const blocked = isParachuteBlocked(p);
        const inUse = !p.manualBlocked && p.assignedExitPlanId !== null;
        const toggleLabel = p.manualBlocked ? 'Przywróć' : inUse ? 'W użyciu' : 'Zablokuj';

        const planPart = p.assignedExitPlanId !== null ? `· PLAN #${p.assignedExitPlanId}` : '';
        const metaHtml = `${p.model} · ${p.size} · ${p.type} ${planPart}`.trim();

        return {
            title: getParachuteLabel(p),
            metaHtml,
            isBlocked: blocked,
            toggleLabel,
            toggleDisabled: inUse,
            onToggle: inUse ? null : () => toggleParachute(p.id, p.manualBlocked),
            onDelete: () => removeParachute(p.id),
        };
    });

    renderCards(targetId, cards);
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
            state.parachutes = mapParachutesDto(parachutes);
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
