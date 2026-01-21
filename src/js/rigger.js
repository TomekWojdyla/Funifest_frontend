import { getState, setState, subscribe } from './state/state.js';
import { api, isOfflineMode } from './api/api.js';
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
    if (isOfflineMode()) {
        setState((state) => {
            state.parachutes = state.parachutes.map((p) =>
                p.id === id ? { ...p, manualBlocked: !isManualBlocked } : p
            );
            return state;
        }, 'parachutes');
        return;
    }

    try {
        if (isManualBlocked) await api.unblockParachute(id);
        else await api.blockParachute(id);

        await syncParachutesFromApi();
    } catch (e) {
        showError(e);
        if (!isOfflineMode()) {
            await syncParachutesFromApi();
        }
    }
}

async function removeParachute(id) {
    setState((state) => {
        state.parachutes = state.parachutes.filter((p) => p.id !== id);
        return state;
    }, 'parachutes');

    if (isOfflineMode()) {
        return;
    }

    try {
        await api.deleteParachute(id);
        await syncParachutesFromApi();
    } catch (e) {
        showError(e);
        if (!isOfflineMode()) {
            await syncParachutesFromApi();
        }
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

    if (isOfflineMode()) {
        setState((state) => {
            const maxId = Math.max(0, ...state.parachutes.map((p) => p.id || 0));
            const newId = maxId + 1;

            state.parachutes.push({
                id: newId,
                model,
                size,
                type,
                customName: customName || null,
                manualBlocked: false,
                manualBlockedByExitPlanId: null,
                assignedExitPlanId: null,
            });

            return state;
        }, 'parachutes');

        pcCustomName.value = '';
        pcModel.value = '';
        pcSize.value = '';
        pcType.value = '';

        modal.classList.remove('active');
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
    if (isOfflineMode()) return;

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
if (!isOfflineMode()) {
    syncParachutesFromApi();
}
