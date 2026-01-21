/* =========================
   CARD UI
========================= */
export function renderCards(targetId, cards) {
    const target = document.getElementById(targetId);
    if (!target) return;

    target.textContent = '';
    cards.forEach((card) => target.appendChild(createCard(card)));
}

/* =========================
   INTERNAL
========================= */
function createCard({
    title,
    metaHtml,
    isBlocked,
    toggleLabel,
    toggleDisabled,
    onToggle,
    onDelete,
}) {
    const el = document.createElement('div');
    el.className = `card ${isBlocked ? 'blocked' : ''}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.textContent = title ?? '';
    el.appendChild(nameEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'card-meta';
    metaEl.textContent = metaHtml ?? '';
    el.appendChild(metaEl);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'card-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn--small toggle';
    toggleBtn.textContent = toggleLabel ?? '';
    toggleBtn.disabled = toggleDisabled === true;
    if (!toggleBtn.disabled && typeof onToggle === 'function') {
        toggleBtn.onclick = onToggle;
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--small danger';
    deleteBtn.textContent = 'Usuń';
    if (typeof onDelete === 'function') {
        deleteBtn.onclick = onDelete;
    }

    actionsEl.appendChild(toggleBtn);
    actionsEl.appendChild(deleteBtn);
    el.appendChild(actionsEl);

    return el;
}
