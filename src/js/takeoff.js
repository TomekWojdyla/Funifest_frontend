document.addEventListener('DOMContentLoaded', () => {
    const dispatchButton = document.getElementById('plan-dispatch');
    const overlay = document.getElementById('takeoffOverlay');

    if (!dispatchButton || !overlay) return;

    const directions = [
        'exit-top-left',
        'exit-top-right',
        'exit-bottom-left',
        'exit-bottom-right',
        'exit-top',
        'exit-right',
    ];

    dispatchButton.addEventListener('click', () => {
        if (overlay.classList.contains('active')) return;

        // losowy kierunek ucieczki
        const dir = directions[Math.floor(Math.random() * directions.length)];

        overlay.className = `takeoff-overlay active ${dir}`;

        setTimeout(() => {
            overlay.className = 'takeoff-overlay';
        }, 4600);
    });
});
