document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       FLEXIBLE IMAGE SYSTEM
       ---------------------------------------------------------
       1. Directory listing of ./images/  (dev servers)
       2. ./images/manifest.json          (static hosts)
       3. Brute-force numbers 1..30       (file:// fallback)
       Any name, any extension.
       ========================================================= */

    const IMG_FOLDER = "images";

    const EXTS = [
        "png","jpg","jpeg","webp","gif","bmp","svg","avif",
        "jfif","jpe","tif","tiff","ico",
        "PNG","JPG","JPEG","WEBP","GIF","BMP","SVG","AVIF",
        "JFIF","JPE","TIF","TIFF"
    ];

    async function scanImageFolder() {
        for (const url of [IMG_FOLDER + "/", IMG_FOLDER]) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) continue;
                const text = await res.text();
                const hrefs = [...text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)]
                    .map(m => decodeURIComponent(m[1]));
                const files = hrefs
                    .map(h => h.split("?")[0].split("#")[0])
                    .filter(h => !h.endsWith("/"))
                    .map(h => h.split("/").pop())
                    .filter(n => n && !n.startsWith("."))
                    .filter(n => /\.(png|jpe?g|jfif|jpe|webp|gif|bmp|svg|avif|tiff?|ico)$/i.test(n));
                if (files.length) return files;
            } catch (e) {}
        }
        try {
            const res = await fetch(IMG_FOLDER + "/manifest.json", { cache: "no-store" });
            if (res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length) return list;
            }
        } catch (e) {}
        return [];
    }

    function findInList(files, baseName) {
        const target = baseName.toLowerCase();
        for (const f of files) {
            const dot = f.lastIndexOf(".");
            const base = (dot > -1 ? f.slice(0, dot) : f).toLowerCase();
            if (base === target) return IMG_FOLDER + "/" + f;
        }
        return null;
    }

    function bruteForceLoad(imgEl, baseName) {
        let i = 0;
        const tryNext = () => {
            if (i >= EXTS.length) { imgEl.onerror = null; return; }
            const src = `${IMG_FOLDER}/${baseName}.${EXTS[i++]}`;
            imgEl.onerror = tryNext;
            imgEl.src = src;
        };
        imgEl.onload = () => { imgEl.onerror = null; };
        tryNext();
    }

    (async function initImages() {

        const files = await scanImageFolder();
        const haveList = files.length > 0;

        document.querySelectorAll("[data-img]").forEach((el) => {
            const base = el.getAttribute("data-img");
            if (!base) return;
            const found = haveList ? findInList(files, base) : null;
            if (found) el.src = found;
            else bruteForceLoad(el, base);
        });

        /* =========================================================
           GALLERY — staggered cross-fade
           ========================================================= */

        const SLOT_CHANGE_MS = 800;
        const FADE_MS        = 1000;

        const slotEls = Array.from(document.querySelectorAll(".gallery-slot"));
        if (!slotEls.length) return;

        const reserved = new Set([
            "cover","index-photo","guru","award1","award2",
            "guest1","guest2","guest3","guest4","guest5",
            "guest6","guest7","guest8","guest9","guest10",
            "article","guest-photo","manifest"
        ]);

        let pool = [];

        if (haveList) {
            pool = files
                .filter(f => {
                    const dot = f.lastIndexOf(".");
                    const base = (dot > -1 ? f.slice(0, dot) : f).toLowerCase();
                    return !reserved.has(base);
                })
                .map(f => IMG_FOLDER + "/" + f);
        }

        if (!pool.length) {
            pool = await new Promise((resolve) => {
                const found = [];
                const candidates = [];
                for (let i = 1; i <= 30; i++) candidates.push(String(i));
                let pending = candidates.length;
                if (!pending) { resolve(found); return; }
                candidates.forEach((name) => {
                    let i = 0;
                    const tryNext = () => {
                        if (i >= EXTS.length) { if (--pending === 0) resolve(found); return; }
                        const src = `${IMG_FOLDER}/${name}.${EXTS[i++]}`;
                        const probe = new Image();
                        probe.onerror = tryNext;
                        probe.onload = () => { found.push(src); if (--pending === 0) resolve(found); };
                        probe.src = src;
                    };
                    tryNext();
                });
            });
        }

        if (!pool.length) return;

        function shuffle(a) {
            const x = a.slice();
            for (let i = x.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [x[i], x[j]] = [x[j], x[i]];
            }
            return x;
        }

        let bag = shuffle(pool);
        let bagIndex = 0;

        function nextImage() {
            if (bagIndex >= bag.length) {
                bag = shuffle(pool);
                bagIndex = 0;
            }
            return bag[bagIndex++];
        }

        const slots = slotEls.map((slotEl) => {
            const layers = slotEl.querySelectorAll(".gallery-img");
            return {
                layers: [layers[0], layers[1]],
                active: 0,
                busy: false
            };
        });

        slots.forEach((sd) => {
            const src = nextImage();
            const first = sd.layers[0];
            first.style.transition = "none";
            first.onload = () => {
                first.classList.add("visible");
                requestAnimationFrame(() => {
                    first.style.transition = "";
                });
            };
            first.src = src;
        });

        function changeSlot(sd) {
            if (sd.busy) return;
            sd.busy = true;

            const src     = nextImage();
            const nextIdx = 1 - sd.active;
            const nextLyr = sd.layers[nextIdx];
            const currLyr = sd.layers[sd.active];

            const pre = new Image();
            pre.onload = () => {
                nextLyr.src = src;
                requestAnimationFrame(() => {
                    nextLyr.classList.add("visible");
                    currLyr.classList.remove("visible");
                    sd.active = nextIdx;
                    setTimeout(() => { sd.busy = false; }, FADE_MS);
                });
            };
            pre.onerror = () => { sd.busy = false; };
            pre.src = src;
        }

        let cursor = 0;
        setInterval(() => {
            changeSlot(slots[cursor]);
            cursor = (cursor + 1) % slots.length;
        }, SLOT_CHANGE_MS);

    })();

    /* =========================================================
       FLIP BOOK
       ========================================================= */

    const book = document.getElementById("book");
    if (!book) return;

    const leaves = Array.from(book.querySelectorAll(".leaf")).reverse();
    const totalLeaves = leaves.length;

    let currentIndex = 0;
    let isAnimating = false;
    let animatingLeaf = null;

    const FLIP_DURATION = 900;

    function render() {
        leaves.forEach((leaf, i) => {
            const shouldBeFlipped = i < currentIndex;
            if (shouldBeFlipped) leaf.classList.add("flipped");
            else leaf.classList.remove("flipped");

            if (leaf === animatingLeaf) leaf.style.zIndex = 999;
            else if (shouldBeFlipped) leaf.style.zIndex = 10 + i;
            else leaf.style.zIndex = 100 - i;
        });
        if (currentIndex > 0) book.classList.add("open");
        else book.classList.remove("open");
    }

    function next() {
        if (isAnimating) return;
        if (currentIndex >= totalLeaves) return;
        isAnimating = true;
        animatingLeaf = leaves[currentIndex];
        currentIndex++;
        render();
        setTimeout(() => { isAnimating = false; animatingLeaf = null; render(); }, FLIP_DURATION);
    }

    function prev() {
        if (isAnimating) return;
        if (currentIndex <= 0) return;
        isAnimating = true;
        animatingLeaf = leaves[currentIndex - 1];
        currentIndex--;
        render();
        setTimeout(() => { isAnimating = false; animatingLeaf = null; render(); }, FLIP_DURATION);
    }

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        book.addEventListener("mouseenter", () => { if (currentIndex === 0) next(); });
    }

    /* --- Tap / click navigation --- */
    document.addEventListener("click", (event) => {
        if (isAnimating) return;

        // Ignore taps on text inside [data-external] blocks
        if (event.target.closest("[data-external]")) return;

        const rect = book.getBoundingClientRect();
        const bookWidth = rect.width;
        if (event.clientY < rect.top - 20) return;
        if (event.clientY > rect.bottom + 20) return;

        if (currentIndex === 0) {
            if (event.clientX >= rect.left - 20 && event.clientX <= rect.right + 20) next();
            return;
        }

        const spineX = window.innerWidth / 2;
        if (event.clientX < spineX - bookWidth - 40) return;
        if (event.clientX > spineX + bookWidth + 40) return;

        if (event.clientX < spineX) prev();
        else next();
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
            event.preventDefault(); next();
        } else if (event.key === "ArrowLeft") {
            event.preventDefault(); prev();
        }
    });

    /* =========================================================
       EXTERNAL LINKS
       Only the TEXT inside each [data-external] block is clickable.
       ========================================================= */

    document.querySelectorAll("[data-external]").forEach((el) => {
        const url = el.getAttribute("data-external");
        if (!url) return;

        el.querySelectorAll("span, b, small").forEach((child) => {
            child.style.cursor = "pointer";
            child.addEventListener("click", (event) => {
                event.stopPropagation();
                event.preventDefault();
                window.open(url, "_blank", "noopener");
            });
        });
    });

    /* =========================================================
       TOUCH SWIPE (mobile) — optional gesture navigation
       ========================================================= */

    let touchStartX = 0, touchStartY = 0, touchTime = 0;
    let swiped = false;

    book.addEventListener("touchstart", (e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchTime = Date.now();
        swiped = false;
    }, { passive: true });

    book.addEventListener("touchend", (e) => {
        if (e.changedTouches.length !== 1) return;
        if (e.target.closest("[data-external]")) return;

        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        const dt = Date.now() - touchTime;

        if (dt > 500) return;
        if (Math.abs(dx) < 40) return;
        if (Math.abs(dx) < Math.abs(dy) * 1.5) return;

        swiped = true;

        if (currentIndex === 0) { next(); return; }
        if (dx < 0) next();
        else prev();
    }, { passive: true });

    render();
});