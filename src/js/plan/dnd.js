import { getState, setState } from '../state/state.js';
import { isPersonBlocked } from '../helpers/helpers.js';
import { currentPlanId, getPersonBlockReason, isLockedPlan } from './core.js';

/* =========================
   DRAG & DROP
========================= */
let planDnDInitialized = false;

const SLOT_LIFT_CLASS = 'slot--lift';
const SLOT_HOVER_CLASS = 'slot--hover';

let planDrag = {
    pointerId: null,
    started: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    person: null,
    personType: null,
    originEl: null,
    ghostEl: null,
    hoverSlotEl: null,
    originSlotNumber: null,
    originIsSlot: false,
};

function setSlotsLiftActive(active) {
    const slots = document.querySelectorAll('.slot[data-slot]');
    slots.forEach((el) => {
        el.classList.toggle(SLOT_LIFT_CLASS, active);
        if (!active) el.classList.remove(SLOT_HOVER_CLASS);
    });
}

function setSlotHover(hoverEl) {
    if (planDrag.hoverSlotEl && planDrag.hoverSlotEl !== hoverEl) {
        planDrag.hoverSlotEl.classList.remove(SLOT_HOVER_CLASS);
    }
    if (hoverEl) hoverEl.classList.add(SLOT_HOVER_CLASS);
}

function cleanupPlanDrag() {
    if (planDrag.ghostEl && planDrag.ghostEl.parentNode) {
        planDrag.ghostEl.parentNode.removeChild(planDrag.ghostEl);
    }

    if (planDrag.hoverSlotEl) {
        planDrag.hoverSlotEl.classList.remove(SLOT_HOVER_CLASS);
    }

    planDrag = {
        pointerId: null,
        started: false,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
        person: null,
        personType: null,
        originEl: null,
        ghostEl: null,
        hoverSlotEl: null,
        originSlotNumber: null,
        originIsSlot: false,
    };

    document.body.classList.remove('is-dragging');
    setSlotsLiftActive(false);
}

function getSlotElFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    return el.closest ? el.closest('.slot[data-slot]') : null;
}

function getPersonFromState(state, slot) {
    if (!slot) return null;
    if (slot.personType === 'skydiver') {
        return (state.people.skydivers || []).find((p) => p.id === slot.personId) || null;
    }
    if (slot.personType === 'passenger') {
        return (state.people.passengers || []).find((p) => p.id === slot.personId) || null;
    }
    return null;
}

function clearSlot(slotNumber) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    setState((state) => {
        const removed = state.flightPlan.slots.find((s) => s.slotNumber === slotNumber);
        if (!removed) return state;

        if (removed.personType === 'skydiver') {
            const skydiverId = removed.personId;

            state.flightPlan.slots = state.flightPlan.slots.map((s) => {
                if (s.personType !== 'passenger') return s;
                if (s.tandemInstructorId !== skydiverId) return s;

                return {
                    ...s,
                    tandemInstructorId: null,
                    parachuteId: null,
                };
            });
        }

        state.flightPlan.slots = state.flightPlan.slots.filter((s) => s.slotNumber !== slotNumber);
        return state;
    }, 'flightPlan');
}

function assignPersonToSlot(person, type, slotNumber) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    const activeId = currentPlanId(stateNow);

    if (isPersonBlocked(person)) return;
    if (getPersonBlockReason(person, activeId)) return;

    setState((state) => {
        const removeSkydiverSideEffects = (skydiverId) => {
            state.flightPlan.slots = state.flightPlan.slots.map((s) => {
                if (s.personType !== 'passenger') return s;
                if (s.tandemInstructorId !== skydiverId) return s;

                return {
                    ...s,
                    tandemInstructorId: null,
                    parachuteId: null,
                };
            });
        };

        const existing = state.flightPlan.slots.find(
            (s) => s.personType === type && s.personId === person.id
        );

        if (existing && existing.slotNumber !== slotNumber) {
            if (existing.personType === 'skydiver') removeSkydiverSideEffects(existing.personId);

            state.flightPlan.slots = state.flightPlan.slots.filter(
                (s) => s.slotNumber !== existing.slotNumber
            );
        }

        const targetIdx = state.flightPlan.slots.findIndex((s) => s.slotNumber === slotNumber);

        if (targetIdx >= 0) {
            const removed = state.flightPlan.slots[targetIdx];
            if (removed.personType === 'skydiver') removeSkydiverSideEffects(removed.personId);

            state.flightPlan.slots[targetIdx] = {
                slotNumber,
                personId: person.id,
                personType: type,
                parachuteId: null,
                tandemInstructorId: null,
            };
        } else {
            state.flightPlan.slots.push({
                slotNumber,
                personId: person.id,
                personType: type,
                parachuteId: null,
                tandemInstructorId: null,
            });
        }

        return state;
    }, 'flightPlan');
}

function beginPersonDrag(e, person, type, originEl) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    planDrag.pointerId = e.pointerId ?? null;
    planDrag.startX = e.clientX;
    planDrag.startY = e.clientY;
    planDrag.person = person;
    planDrag.personType = type;
    planDrag.originEl = originEl;

    planDrag.originSlotNumber = null;
    planDrag.originIsSlot = false;

    const rect = originEl.getBoundingClientRect();
    planDrag.offsetX = e.clientX - rect.left;
    planDrag.offsetY = e.clientY - rect.top;
}

function beginSlotDrag(e, slotNumber, originEl) {
    const stateNow = getState();
    if (isLockedPlan(stateNow)) return;

    const slot = stateNow.flightPlan.slots.find((s) => s.slotNumber === slotNumber);
    if (!slot) return;

    const person = getPersonFromState(stateNow, slot);
    if (!person) return;

    planDrag.pointerId = e.pointerId ?? null;
    planDrag.startX = e.clientX;
    planDrag.startY = e.clientY;
    planDrag.person = person;
    planDrag.personType = slot.personType;
    planDrag.originEl = originEl;

    planDrag.originSlotNumber = slotNumber;
    planDrag.originIsSlot = true;

    const rect = originEl.getBoundingClientRect();
    planDrag.offsetX = e.clientX - rect.left;
    planDrag.offsetY = e.clientY - rect.top;
}

function startGhostIfNeeded() {
    if (planDrag.started) return;
    if (!planDrag.originEl) return;

    planDrag.started = true;

    const ghost = planDrag.originEl.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.margin = '0';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.9';
    ghost.style.width = `${planDrag.originEl.getBoundingClientRect().width}px`;
    ghost.style.transform = 'translate(-10000px, -10000px)';
    ghost.style.boxShadow = '0 10px 22px rgba(0,0,0,0.28)';

    document.body.appendChild(ghost);
    planDrag.ghostEl = ghost;

    setSlotsLiftActive(true);
    document.body.classList.add('is-dragging');
}

function moveGhost(x, y) {
    if (!planDrag.ghostEl) return;
    const tx = x - planDrag.offsetX;
    const ty = y - planDrag.offsetY;
    planDrag.ghostEl.style.transform = `translate(${tx}px, ${ty}px)`;
}

function initPlanDragAndDrop() {
    if (planDnDInitialized) return;
    planDnDInitialized = true;

    document.addEventListener(
        'pointermove',
        (e) => {
            if (!planDrag.person || (planDrag.pointerId !== null && e.pointerId !== planDrag.pointerId)) return;

            const dx = e.clientX - planDrag.startX;
            const dy = e.clientY - planDrag.startY;

            if (!planDrag.started) {
                if (Math.hypot(dx, dy) < 7) return;
                startGhostIfNeeded();
            }

            if (e.cancelable) e.preventDefault();

            moveGhost(e.clientX, e.clientY);

            const slotEl = getSlotElFromPoint(e.clientX, e.clientY);
            if (planDrag.hoverSlotEl !== slotEl) {
                setSlotHover(slotEl);
                planDrag.hoverSlotEl = slotEl;
            }
        },
        { passive: false }
    );

    const finish = (e) => {
        if (!planDrag.person || (planDrag.pointerId !== null && e.pointerId !== planDrag.pointerId)) return;

        if (planDrag.started) {
            const slotEl = planDrag.hoverSlotEl;

            if (slotEl && slotEl.dataset && slotEl.dataset.slot) {
                const slotNumber = Number(slotEl.dataset.slot);
                if (!Number.isNaN(slotNumber)) {
                    if (!planDrag.originIsSlot) {
                        assignPersonToSlot(planDrag.person, planDrag.personType, slotNumber);
                    }
                }
            } else {
                if (planDrag.originIsSlot && planDrag.originSlotNumber !== null) {
                    clearSlot(planDrag.originSlotNumber);
                }
            }
        }

        cleanupPlanDrag();
    };

    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
    document.addEventListener('blur', () => cleanupPlanDrag(), true);
}

export { beginPersonDrag, beginSlotDrag, initPlanDragAndDrop };
