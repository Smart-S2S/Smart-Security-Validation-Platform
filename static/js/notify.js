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
