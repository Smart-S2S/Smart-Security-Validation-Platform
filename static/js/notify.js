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
