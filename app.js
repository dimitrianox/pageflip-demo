const viewer = document.getElementById("viewer");
const front = document.getElementById("page-front");
const shadow = document.getElementById("page-shadow");
const highlight = document.getElementById("page-highlight");

let dragging = false;
let startX = 0;
let progress = 0;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function ease(t) {
    return 1 - Math.pow(1 - t, 3);
}

function render(p) {

    progress = clamp(p, 0, 1);

    const angle = -180 * progress;

    front.style.transform =
        `rotateY(${angle}deg)`;

    shadow.style.opacity =
        (progress * 0.75).toFixed(2);

    highlight.style.opacity =
        (progress * 0.35).toFixed(2);

}

viewer.addEventListener("pointerdown", e => {

    dragging = true;

    startX = e.clientX;

    viewer.setPointerCapture(e.pointerId);

});

viewer.addEventListener("pointermove", e => {

    if (!dragging) return;

    const dx = startX - e.clientX;

    render(dx / window.innerWidth);

});

viewer.addEventListener("pointerup", finish);
viewer.addEventListener("pointercancel", finish);

function finish() {

    if (!dragging) return;

    dragging = false;

    const target =
        progress > 0.5 ? 1 : 0;

    const from = progress;

    const start = performance.now();

    function animate(now) {

        let t =
            (now - start) / 260;

        if (t > 1) t = 1;

        t = ease(t);

        render(
            from + (target - from) * t
        );

        if (t < 1) {

            requestAnimationFrame(animate);

        }

    }

    requestAnimationFrame(animate);

}

render(0);