import { getState } from '../state/state.js';
import {
    fullName,
    getParachuteLabel,
    getSlotPerson,
    isStaff,
    isPersonBlocked,
    isPersonAssignedToOtherPlan,
} from '../helpers/helpers.js';
import {
    currentPlanId,
    formatDateTime,
    getPersonBlockReason,
    getUsedPersonIds,
    isLockedPlan,
    normalizeTimeValue,
} from './core.js';
import {
    addToFlight,
    openParachuteSelector,
    openTandemInstructorSelector,
    removeFromFlight,
    setActivePlan,
} from './actions.js';
import { beginPersonDrag, beginSlotDrag } from './dnd.js';
import { escapeHtml } from '../ui/safe.js';

/* =========================
   UI HELPERS
========================= */
function clearEl(el) {
    if (!el) return;
    el.textContent = '';
}

function div(className, text = null) {
    const el = document.createElement('div');
    if (className) el.className = className;
    if (text !== null && text !== undefined) el.textContent = String(text);
    return el;
}

function span(className, text = null) {
    const el = document.createElement('span');
    if (className) el.className = className;
    if (text !== null && text !== undefined) el.textContent = String(text);
    return el;
}

function button(className, text, { disabled = false, title = '', onClick = null } = {}) {
    const el = document.createElement('button');
    el.className = className || 'btn btn--small';
    el.textContent = text ?? '';
    el.disabled = disabled === true;
    if (title) el.title = title;
    if (typeof onClick === 'function') el.onclick = onClick;
    return el;
}

function card({ disabled = false, name = '', metas = [], buttonText = '', buttonDisabled = false, buttonTitle = '', onButtonClick = null }) {
    const el = document.createElement('div');
    el.className = `card ${disabled ? 'card--disabled' : ''}`;

    el.appendChild(div('card-name', name));

    metas.forEach(({ text, blocked }) => {
        const meta = div(`card-meta${blocked ? ' card-meta--blocked' : ''}`, text);
        el.appendChild(meta);
    });

    el.appendChild(
        button('btn btn--small', buttonText, {
            disabled: buttonDisabled,
            title: buttonTitle,
            onClick: onButtonClick,
        })
    );

    return el;
}

function planItem({ titleText, timeText, status, dispatchedAt, isActive, isPlaceholder, onClick }) {
    const item = document.createElement('div');

    const isDispatched = status === 'Dispatched';
    item.className = `plan-item ${isDispatched ? 'is-dispatched' : ''} ${isActive ? 'is-active' : ''}`;

    const row = div('plan-item__row');
    row.appendChild(div('plan-item__title', titleText));

    const badgeText = isDispatched ? 'WYSŁANY' : 'DRAFT';
    const badgeClass = isDispatched ? 'plan-item__badge--dispatched' : 'plan-item__badge--draft';
    row.appendChild(span(`plan-item__badge ${badgeClass}`, badgeText));
    item.appendChild(row);

    const meta = div('plan-item__meta');
    meta.appendChild(span('', timeText));
    item.appendChild(meta);

    if (isDispatched && dispatchedAt) {
        item.title = `Wysłano: ${formatDateTime(dispatchedAt)}`;
    } else {
        item.title = '';
    }

    if (!isPlaceholder && typeof onClick === 'function') {
        item.onclick = onClick;
    }

    return item;
}

/* =========================
   PLAN LIST
========================= */
function sortPlansForList(list) {
    const drafts = list
        .filter((p) => p.status === 'Draft')
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

    const dispatched = list
        .filter((p) => p.status === 'Dispatched')
        .sort((a, b) => {
            const ad = a.dispatchedAt ? new Date(a.dispatchedAt).getTime() : 0;
            const bd = b.dispatchedAt ? new Date(b.dispatchedAt).getTime() : 0;
            if (bd !== ad) return bd - ad;
            return (b.id ?? 0) - (a.id ?? 0);
        });

    return { drafts, dispatched };
}

function renderPlanList(state) {
    const target = document.getElementById('plan-list');
    if (!target) return;

    clearEl(target);

    const { drafts, dispatched } = sortPlansForList(state.plans.list || []);

    if (state.plans.activeId === null) {
        target.appendChild(
            planItem({
                titleText: 'NOWY PLAN',
                timeText: normalizeTimeValue(state.flightPlan.time) || '--:--',
                status: 'Draft',
                dispatchedAt: null,
                isActive: true,
                isPlaceholder: true,
                onClick: null,
            })
        );
    }

    const renderSection = (title, plans) => {
        if (!plans.length) return;

        target.appendChild(div('plan-list-section', title));

        plans.forEach((p) => {
            const isActive = state.plans.activeId === p.id;
            target.appendChild(
                planItem({
                    titleText: `PLAN #${p.id}`,
                    timeText: normalizeTimeValue(p.time) || '--:--',
                    status: p.status,
                    dispatchedAt: p.dispatchedAt ?? null,
                    isActive,
                    isPlaceholder: false,
                    onClick: () => setActivePlan(p.id),
                })
            );
        });
    };

    renderSection('AKTYWNE (DRAFT)', drafts);
    renderSection('WYSŁANE (ARCHIWUM)', dispatched);
}

/* =========================
   RENDER
========================= */
function renderPlan(snapshot = null) {
    const state = snapshot || getState();
    const locked = isLockedPlan(state);
    const activeId = currentPlanId(state);

    renderPlanList(state);

    const usedSkydivers = getUsedPersonIds(state, 'skydiver');
    const usedPassengers = getUsedPersonIds(state, 'passenger');

    const skydivers = state.people.skydivers || [];
    const passengers = state.people.passengers || [];

    renderPeople(
        skydivers.filter((s) => !isStaff(s)),
        'plan-funjumpers',
        'skydiver',
        locked,
        usedSkydivers,
        activeId
    );

    renderPeople(
        skydivers.filter((s) => isStaff(s)),
        'plan-staff',
        'skydiver',
        locked,
        usedSkydivers,
        activeId
    );

    renderPeople(
        passengers,
        'plan-passengers',
        'passenger',
        locked,
        usedPassengers,
        activeId
    );

    renderSlots(state, locked);
    renderButtons(state);
}

/* =========================
   LEFT LISTS
========================= */
function renderPeople(list, targetId, type, locked, usedSet, activeId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    clearEl(target);

    list.forEach((p) => {
        if (isPersonBlocked(p)) return;

        const isUsed = usedSet.has(p.id);
        if (isUsed) return;

        if (isPersonAssignedToOtherPlan(p, activeId)) return;


        const reason = getPersonBlockReason(p, activeId);
        const isManualBlocked = isPersonBlocked(p) || reason !== '';
        const disabled = locked || isManualBlocked;

        const metas = [];
        if (disabled && reason) metas.push({ text: reason, blocked: true });

        const el = card({
            disabled,
            name: fullName(p),
            metas,
            buttonText: isManualBlocked ? 'Niedostępny' : '→ do wylotu',
            buttonDisabled: disabled,
            buttonTitle: reason || '',
            onButtonClick: () => addToFlight(p, type),
        });

        if (!disabled) {
            el.onpointerdown = (e) => {
                if (e.target && e.target.closest && e.target.closest('button')) return;
                if (e.button !== undefined && e.button !== 0) return;
                beginPersonDrag(e, p, type, el);
            };
        }

        target.appendChild(el);
    });
}

/* =========================
   SLOTS
========================= */
function renderSlots(state, locked) {
    document.querySelectorAll('.slot[data-slot]').forEach((el) => {
        const num = Number(el.dataset.slot);
        const slot = state.flightPlan.slots.find((s) => s.slotNumber === num);

        el.className = 'slot';

        if (!slot) {
            el.textContent = `SLOT ${num}`;
            el.onpointerdown = null;
            return;
        }

        const person = getSlotPerson(state, slot);
        const parachute =
            slot.parachuteId &&
            state.parachutes.find((p) => p.id === slot.parachuteId);

        const flags = [];
        if (person?.isAffInstructor) flags.push('AFF INS');
        if (person?.isTandemInstructor) flags.push('TANDEM INS');

        let extraBlock = '';

        if (slot.personType === 'skydiver') {
            extraBlock = parachute
                ? `🪂 ${escapeHtml(getParachuteLabel(parachute))}`
                : `
          <span class="invalid">❌ Brak spadochronu</span>
          <button class="btn btn--small assign">Przypisz spadochron</button>
        `;
        } else {
            extraBlock = slot.tandemInstructorId
                ? `
          <strong>
            TANDEM INS:
            ${escapeHtml(
                fullName(
                    getSlotPerson(state, {
                        personId: slot.tandemInstructorId,
                        personType: 'skydiver',
                    })
                )
            )}
          </strong><br/>
          🪂 ${parachute ? escapeHtml(getParachuteLabel(parachute)) : '-'}
        `
                : `
          <span class="invalid">❌ Brak instruktora tandemowego</span>
          <button class="btn btn--small assign">Wybierz instruktora</button>
        `;
        }

        el.innerHTML = `
      <strong>${person ? escapeHtml(fullName(person)) : '-'}</strong><br/>
      <small>
        ${person ? person.weight : 0} kg
        ${
            person && person.licenseLevel
                ? `· ${escapeHtml(person.licenseLevel)} · ${escapeHtml(person.role)}`
                : ''
        }
        ${flags.map((f) => `· ${escapeHtml(f)}`).join('')}
      </small>

      <div class="slot-parachute">${extraBlock}</div>

      <button class="btn btn--small remove">Usuń z wylotu</button>
    `;

        const removeBtn = el.querySelector('.remove');
        removeBtn.disabled = locked;
        removeBtn.onclick = () => removeFromFlight(num);

        const assignBtn = el.querySelector('.assign');
        if (assignBtn) {
            assignBtn.disabled = locked;
            if (!locked) {
                if (slot.personType === 'skydiver' && !parachute) {
                    assignBtn.onclick = () => openParachuteSelector(num);
                    el.classList.add('invalid');
                }
                if (slot.personType === 'passenger' && !slot.tandemInstructorId) {
                    assignBtn.onclick = () => openTandemInstructorSelector(num);
                    el.classList.add('invalid');
                }
            }
        }

        if (!locked) {
            el.onpointerdown = (e) => {
                if (e.target && e.target.closest && e.target.closest('button')) return;
                if (e.button !== undefined && e.button !== 0) return;
                beginSlotDrag(e, num, el);
            };
        } else {
            el.onpointerdown = null;
        }
    });
}


/* =========================
   BUTTONS
========================= */
function renderButtons(state) {
    const locked = isLockedPlan(state);

    const saveBtn = document.querySelector('.plan-go');
    const delBtn = document.querySelector('.plan-delete');
    const dispatchBtn = document.getElementById('plan-dispatch');

    const hasId = state.flightPlan.exitPlanId !== null;

    if (saveBtn) {
        saveBtn.textContent = hasId ? 'MODYFIKUJ' : 'ZAPISZ';
        saveBtn.style.display = locked ? 'none' : '';
        saveBtn.disabled = locked;
    }

    if (dispatchBtn) {
        dispatchBtn.style.display = locked ? 'none' : '';
        dispatchBtn.disabled = locked;
    }

    if (delBtn) {
        delBtn.disabled = locked ? !hasId : false;
    }
}

export { renderPlan };
