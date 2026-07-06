// Resilient fetch: transparently retries transient failures so a single hiccup
// during page load (connection reset under the single-worker server, a brief 5xx)
// does not leave a tab/card/page empty. Only idempotent GETs are retried, so
// POST/PATCH/DELETE are never accidentally repeated. Installed here because
// notify.js is the first script on every page, before any data fetching runs.
(function installResilientFetch() {
    if (window.__ssvpFetchPatched || typeof window.fetch !== "function") {
        return;
    }
    window.__ssvpFetchPatched = true;

    const nativeFetch = window.fetch.bind(window);
    const RETRYABLE_STATUS = new Set([502, 503, 504]);
    const MAX_RETRIES = 2;

    function methodOf(init) {
        return String((init && init.method) || "GET").toUpperCase();
    }
    function isRetryableMethod(init) {
        return methodOf(init) === "GET";
    }
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    window.fetch = async function resilientFetch(input, init) {
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await nativeFetch(input, init);
                if (
                    RETRYABLE_STATUS.has(response.status) &&
                    isRetryableMethod(init) &&
                    attempt < MAX_RETRIES
                ) {
                    await delay(200 * (attempt + 1));
                    continue;
                }
                return response;
            } catch (error) {
                // Network-level failure (connection reset / "Failed to fetch").
                lastError = error;
                if (isRetryableMethod(init) && attempt < MAX_RETRIES) {
                    await delay(200 * (attempt + 1));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    };
})();

(function initSsvpNotify() {
    if (window.SSVPNotify) {
        return;
    }

    const DEFAULT_DURATION = 10000;
    const TITLES = {
        success: "Basarili",
        error: "Hata",
        warning: "Uyari",
        info: "Bilgi",
    };

    function ensureRoot() {
        let root = document.getElementById("ssvp-toast-root");
        if (root) {
            return root;
        }

        root = document.createElement("div");
        root.id = "ssvp-toast-root";
        root.setAttribute("aria-live", "polite");
        root.setAttribute("aria-atomic", "false");
        document.body.appendChild(root);
        return root;
    }

    function removeToast(toast) {
        if (!toast || !toast.parentElement) {
            return;
        }

        toast.classList.remove("visible");
        toast.classList.add("hiding");

        window.setTimeout(() => {
            toast.remove();
        }, 180);
    }

    function show(options) {
        const rawMessage = typeof options === "string" ? options : options?.message;
        const message = String(rawMessage || "").trim();
        if (!message) {
            return;
        }

        const type = ["success", "error", "warning", "info"].includes(options?.type) ? options.type : "info";
        const title = String(options?.title || TITLES[type]);
        const duration = Number(options?.duration) > 0 ? Number(options.duration) : DEFAULT_DURATION;

        const root = ensureRoot();
        const toast = document.createElement("section");
        toast.className = `ssvp-toast ${type}`;
        toast.setAttribute("role", type === "error" ? "alert" : "status");

        const body = document.createElement("div");
        body.className = "ssvp-toast-body";

        const head = document.createElement("header");
        head.className = "ssvp-toast-head";

        const titleNode = document.createElement("strong");
        titleNode.className = "ssvp-toast-title";
        titleNode.textContent = title;

        const closeBtn = document.createElement("button");
        closeBtn.className = "ssvp-toast-close";
        closeBtn.type = "button";
        closeBtn.textContent = "x";
        closeBtn.setAttribute("aria-label", "Kapat");

        head.appendChild(titleNode);
        head.appendChild(closeBtn);

        const text = document.createElement("p");
        text.className = "ssvp-toast-message";
        text.textContent = message;

        body.appendChild(head);
        body.appendChild(text);
        toast.appendChild(body);
        root.appendChild(toast);

        window.requestAnimationFrame(() => {
            toast.classList.add("visible");
        });

        const timer = window.setTimeout(() => {
            removeToast(toast);
        }, duration);

        closeBtn.addEventListener("click", () => {
            window.clearTimeout(timer);
            removeToast(toast);
        });

        return toast;
    }

    window.SSVPNotify = {
        show,
        success: (message, title = TITLES.success, duration = DEFAULT_DURATION) => show({ message, title, type: "success", duration }),
        error: (message, title = TITLES.error, duration = DEFAULT_DURATION) => show({ message, title, type: "error", duration }),
        warning: (message, title = TITLES.warning, duration = DEFAULT_DURATION) => show({ message, title, type: "warning", duration }),
        info: (message, title = TITLES.info, duration = DEFAULT_DURATION) => show({ message, title, type: "info", duration }),
    };
})();


// ---------------------------------------------------------------------------
// Shared searchable wordlist combobox (window.SSVPWl)
// ---------------------------------------------------------------------------
// A single implementation used by every page that asks for a wordlist path —
// the Pentest operation forms (index.js), Operation Test (op_tester.js) and the
// per-tool parameter defaults in Settings (settings.js). Living here (notify.js
// loads first on every page) means the catalog is fetched once and the delegated
// document handlers are installed exactly once, so pages where two of those
// scripts co-exist (panel.html loads settings.js + op_tester.js) never double-
// render or fight over the same `.wl-combo-list`.
(function installWordlistCombo() {
    if (window.SSVPWl) {
        return;
    }

    const WORDLIST_KEYS = new Set(["wordlist", "wordlists", "userlist", "passlist", "combo_file"]);
    let catalog = [];
    let loadPromise = null;

    function esc(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function optionLabel(w) {
        return `${w.name || w.path}${w.size_h ? ` — ${w.size_h}` : ""}`;
    }

    async function load(force) {
        if (loadPromise && !force) {
            return loadPromise;
        }
        loadPromise = (async () => {
            try {
                const res = await fetch("/validation/wordlists", { cache: "no-store" });
                const data = res.ok ? await res.json() : null;
                catalog = Array.isArray(data?.items) ? data.items : [];
            } catch (_) {
                // Non-fatal: callers fall back to the raw path already in the box.
                catalog = [];
            }
            return catalog;
        })();
        return loadPromise;
    }

    // Build one combobox. `hiddenAttrs` is a raw attribute string for the hidden
    // input that carries the real value (each caller supplies its own collector
    // data-attrs, e.g. data-param-key / data-key / data-tc-param).
    function comboHtml(hiddenAttrs, value) {
        const selected = value == null ? "" : String(value);
        const match = catalog.find((w) => w.path === selected);
        const shownText = match ? optionLabel(match) : selected;
        return `
            <div class="wl-combo">
                <input type="text" class="wl-combo-search" placeholder="Sözlük ara / seç…" value="${esc(shownText)}" autocomplete="off" spellcheck="false">
                <input type="hidden" ${hiddenAttrs || ""} value="${esc(selected)}">
                <div class="wl-combo-list" hidden></div>
            </div>
        `;
    }

    function renderList(combo, query) {
        const list = combo?.querySelector(".wl-combo-list");
        if (!list) {
            return;
        }
        const q = String(query || "").trim().toLowerCase();
        const items = catalog.filter((w) => {
            if (!w?.path) return false;
            if (!q) return true;
            return String(w.name || "").toLowerCase().includes(q) || String(w.path || "").toLowerCase().includes(q);
        });
        const shown = items.slice(0, 300);
        if (!shown.length) {
            list.innerHTML = `<div class="wl-combo-empty">${esc(catalog.length ? "Eşleşen sözlük yok" : "Kayıtlı sözlük yok")}</div>`;
        } else {
            list.innerHTML = shown
                .map((w) => `<div class="wl-combo-item" data-path="${esc(w.path)}" title="${esc(w.path)}">${esc(optionLabel(w))}</div>`)
                .join("");
            if (items.length > shown.length) {
                list.innerHTML += `<div class="wl-combo-empty">…${items.length - shown.length} sonuç daha, aramayı daraltın</div>`;
            }
        }
        list.hidden = false;
    }

    // Delegated behaviour — installed once, works for every dynamically rendered
    // form on the page.
    document.addEventListener("focusin", (event) => {
        const search = event.target.closest?.(".wl-combo-search");
        if (search) {
            renderList(search.closest(".wl-combo"), "");
        }
    });
    document.addEventListener("input", (event) => {
        const search = event.target.closest?.(".wl-combo-search");
        if (search) {
            renderList(search.closest(".wl-combo"), search.value);
        }
    });
    document.addEventListener("click", (event) => {
        const item = event.target.closest?.(".wl-combo-item");
        if (item) {
            const combo = item.closest(".wl-combo");
            const hidden = combo?.querySelector("input[type=hidden]");
            const search = combo?.querySelector(".wl-combo-search");
            const list = combo?.querySelector(".wl-combo-list");
            if (hidden) hidden.value = item.getAttribute("data-path") || "";
            if (search) search.value = item.textContent || "";
            if (list) list.hidden = true;
            return;
        }
        if (!event.target.closest?.(".wl-combo")) {
            document.querySelectorAll(".wl-combo-list").forEach((el) => { el.hidden = true; });
        }
    });

    window.SSVPWl = {
        WORDLIST_KEYS,
        load,
        catalog: () => catalog,
        comboHtml,
        optionLabel,
    };
})();
