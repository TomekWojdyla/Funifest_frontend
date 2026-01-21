import { getState, setState, subscribe } from './state/state.js';
import { getNowTimeValue, initPlanLeftCollapsibles, normalizeTimeValue } from './plan/core.js';
import { initPlanDragAndDrop } from './plan/dnd.js';
import { renderPlan } from './plan/render.js';
import {
    closeParachuteModal,
    closeTandemModal,
    deleteExitPlan,
    dispatchActivePlan,
    saveExitPlan,
    slideSwapPlanCenter,
    startNewPlan,
    syncFromApi,
    undoDispatchedPlan,
} from './plan/actions.js';

/* =========================
   EVENTS
========================= */
const cancelSelect = document.getElementById('cancelSelect');
if (cancelSelect) cancelSelect.onclick = closeParachuteModal;

const cancelTandem = document.getElementById('cancelTandem');
if (cancelTandem) cancelTandem.onclick = closeTandemModal;

const addBtn = document.getElementById('plan-add');
if (addBtn) addBtn.onclick = () => slideSwapPlanCenter(startNewPlan);

const saveBtn = document.querySelector('.plan-go');
if (saveBtn) saveBtn.onclick = saveExitPlan;

const dispatchBtn = document.getElementById('plan-dispatch');
if (dispatchBtn) dispatchBtn.onclick = dispatchActivePlan;

const undoBtn = document.getElementById('plan-undo');
if (undoBtn) undoBtn.onclick = undoDispatchedPlan;

const delBtn = document.querySelector('.plan-delete');
if (delBtn) delBtn.onclick = deleteExitPlan;

/* =========================
   INIT
========================= */
initPlanDragAndDrop();
subscribe('flightPlan', renderPlan);
subscribe('plans', renderPlan);
subscribe('people', renderPlan);
subscribe('parachutes', renderPlan);
initPlanLeftCollapsibles();
renderPlan();

const init = getState();
if (!normalizeTimeValue(init.flightPlan.time)) {
    setState((s) => {
        if (!normalizeTimeValue(s.flightPlan.time)) {
            s.flightPlan.time = getNowTimeValue();
        }
        return s;
    }, 'flightPlan');
}

syncFromApi();
