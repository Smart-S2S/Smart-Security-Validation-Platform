// ---------------------------------------------------------------------------
// Shared table enhancer (window.SSVPTable)
// ---------------------------------------------------------------------------
// Adds per-column search/filter, click-to-sort headers and pagination (with a
// page-size selectbox) to every data table across Settings and Panel, without
// touching each table's own render code. Tables are re-rendered dynamically
// (tbody.innerHTML = ...), so a MutationObserver re-applies filter/sort/paging
// after each render. Loaded right after notify.js on both pages.
(function installTableTools() {
    if (window.SSVPTable) {
        return;
    }

    const LANG = () => (window.__ssvpLang === "en" ? "en" : "tr");
    const T = {
        tr: {
            filter: "Filtrele", total: "kayıt", page: "Sayfa", of: "/",
            all: "Hepsi", empty: "Eşleşen kayıt yok", prev: "‹", next: "›",
            perPage: "Sayfa başına",
        },
        en: {
            filter: "Filter", total: "records", page: "Page", of: "/",
            all: "All", empty: "No matching records", prev: "‹", next: "›",
            perPage: "Per page",
        },
    };
    const tr = (k) => (T[LANG()] || T.tr)[k];

    const PAGE_SIZES = [10, 25, 50, 100, 0]; // 0 = all
    const DEFAULT_SIZE = 10;
    // Per-user default (from Appearance settings); pushed in via setDefaultPageSize.
    let globalDefault = DEFAULT_SIZE;
    const instances = [];
    // ASCII-folded (see norm): covers "İşlem"/"İşlemler"/"Actions"/"Aksiyon".
    const SKIP_HEADERS = new Set(["", "actions", "action", "islem", "islemler", "aksiyon", "aksiyonlar"]);

    // Lowercase + strip combining marks so Turkish headers/search fold to ASCII
    // ("İşlem" -> "islem", "Ş" -> "s"), sidestepping the Turkish-I lowercasing quirk.
    function norm(s) {
        return String(s || "").trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
    }

    function injectStyles() {
        if (document.getElementById("ssvp-tbl-styles")) {
            return;
        }
        const css = `
        .ssvp-filter-row th { padding: 4px 6px; background: transparent; }
        .ssvp-filter-input {
            width: 100%; box-sizing: border-box; font-size: 12px; font-weight: 400;
            padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px;
            background: var(--bg-soft); color: var(--text);
        }
        .ssvp-filter-input::placeholder { color: var(--muted, #8aa0c0); opacity: .8; }
        .ssvp-filter-input:focus {
            outline: none; border-color: #78a4eb;
            box-shadow: 0 0 0 2px rgba(80, 133, 218, 0.18);
        }
        .ssvp-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
        .ssvp-sortable:hover { color: #3b82f6; }
        /* Indicator via ::after so an i18n textContent reset can't remove it. */
        .ssvp-sortable::after { content: " \\2195"; opacity: .4; font-size: 10px; }
        .ssvp-sortable[data-dir="asc"]::after { content: " \\25B2"; opacity: 1; color: #3b82f6; }
        .ssvp-sortable[data-dir="desc"]::after { content: " \\25BC"; opacity: 1; color: #3b82f6; }
        .ssvp-tbl-foot {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; flex-wrap: wrap; margin: 8px 0 4px; font-size: 12px; color: var(--muted, var(--text));
        }
        .ssvp-tbl-foot .ssvp-foot-mid { display: flex; align-items: center; gap: 6px; }
        .ssvp-tbl-foot select, .ssvp-tbl-foot button {
            font-size: 12px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 6px;
            background: var(--bg-soft); color: var(--text); cursor: pointer;
        }
        .ssvp-tbl-foot button:disabled { opacity: .4; cursor: default; }
        .ssvp-page-ind { min-width: 64px; text-align: center; }
        `;
        const style = document.createElement("style");
        style.id = "ssvp-tbl-styles";
        style.textContent = css;
        document.head.appendChild(style);
    }

    function cellText(row, i) {
        const c = row.cells && row.cells[i];
        return c ? (c.textContent || "").trim() : "";
    }

    function isDataRow(row) {
        if (!row || row.classList.contains("ssvp-empty-row")) return false;
        // Placeholder rows (e.g. "not found") are a single cell spanning columns.
        if (row.cells.length === 1 && row.cells[0].colSpan > 1) return false;
        return true;
    }

    const NUM_RE = /^-?\d+([.,]\d+)?$/;

    function enhance(table) {
        if (!table || table.dataset.ssvpEnhanced === "1" || table.hasAttribute("data-no-enhance")) {
            return;
        }
        const thead = table.tHead;
        const tbody = table.tBodies && table.tBodies[0];
        if (!thead || !tbody || !thead.rows.length) {
            return;
        }
        const headerRow = thead.rows[0];
        const cols = headerRow.cells.length;
        if (!cols) {
            return;
        }
        table.dataset.ssvpEnhanced = "1";
        injectStyles();

        const skip = [];
        for (let i = 0; i < cols; i++) {
            const th = headerRow.cells[i];
            skip[i] = SKIP_HEADERS.has(norm(th.textContent)) || th.hasAttribute("data-no-sort");
        }

        // Default rows-per-page comes from the per-user Appearance setting
        // (globalDefault). A table the user manually re-pages keeps its own choice.
        const state = { sortCol: -1, sortDir: 0, page: 1, pageSize: globalDefault, filters: {}, userChanged: false };

        // --- Sortable headers -------------------------------------------------
        for (let i = 0; i < cols; i++) {
            if (skip[i]) continue;
            const th = headerRow.cells[i];
            th.classList.add("ssvp-sortable");
            th.dataset.dir = "";
            th.addEventListener("click", () => {
                if (state.sortCol === i) {
                    state.sortDir = state.sortDir === 1 ? -1 : (state.sortDir === -1 ? 0 : 1);
                    if (state.sortDir === 0) state.sortCol = -1;
                } else {
                    state.sortCol = i;
                    state.sortDir = 1;
                }
                for (let j = 0; j < cols; j++) {
                    const h = headerRow.cells[j];
                    if (!h.classList.contains("ssvp-sortable")) continue;
                    h.dataset.dir = (j === state.sortCol && state.sortDir) ? (state.sortDir === 1 ? "asc" : "desc") : "";
                }
                apply();
            });
        }

        // --- Filter row (skip if the table already ships one) -----------------
        const hasOwnFilters = thead.rows.length >= 2;
        if (!hasOwnFilters) {
            const frow = document.createElement("tr");
            frow.className = "ssvp-filter-row";
            for (let i = 0; i < cols; i++) {
                const th = document.createElement("th");
                if (!skip[i]) {
                    const input = document.createElement("input");
                    input.type = "text";
                    input.className = "ssvp-filter-input";
                    input.placeholder = tr("filter");
                    input.addEventListener("input", () => {
                        state.filters[i] = norm(input.value);
                        state.page = 1;
                        apply();
                    });
                    th.appendChild(input);
                }
                frow.appendChild(th);
            }
            thead.appendChild(frow);
        }

        // --- Footer: count · pager · page-size --------------------------------
        const foot = document.createElement("div");
        foot.className = "ssvp-tbl-foot";
        const countEl = document.createElement("div");
        countEl.className = "ssvp-foot-count";
        const mid = document.createElement("div");
        mid.className = "ssvp-foot-mid";
        const prevBtn = document.createElement("button");
        prevBtn.type = "button";
        prevBtn.textContent = tr("prev");
        const pageInd = document.createElement("span");
        pageInd.className = "ssvp-page-ind";
        const nextBtn = document.createElement("button");
        nextBtn.type = "button";
        nextBtn.textContent = tr("next");
        mid.append(prevBtn, pageInd, nextBtn);
        const sizeWrap = document.createElement("div");
        const sizeSel = document.createElement("select");
        PAGE_SIZES.forEach((s) => {
            const o = document.createElement("option");
            o.value = String(s);
            o.textContent = s === 0 ? tr("all") : String(s);
            if (s === state.pageSize) o.selected = true;
            sizeSel.appendChild(o);
        });
        sizeSel.title = tr("perPage");
        sizeWrap.append(sizeSel);
        foot.append(countEl, mid, sizeWrap);
        (table.parentNode || table).insertBefore(foot, table.nextSibling);

        prevBtn.addEventListener("click", () => { if (state.page > 1) { state.page--; apply(); } });
        nextBtn.addEventListener("click", () => { state.page++; apply(); });
        sizeSel.addEventListener("change", () => {
            state.pageSize = parseInt(sizeSel.value, 10) || 0;
            state.userChanged = true; // stop this table from following the global default
            state.page = 1;
            apply();
        });

        // Let the per-user Appearance default retro-update tables the user hasn't
        // manually re-paged.
        instances.push({
            setDefault(n) {
                if (state.userChanged) return;
                state.pageSize = n;
                sizeSel.value = String(n);
                state.page = 1;
                apply();
            },
        });

        // --- Core: filter → sort → paginate -----------------------------------
        let observer = null;
        function apply() {
            if (observer) observer.disconnect();
            try {
                // drop any empty-row we previously injected
                tbody.querySelectorAll(".ssvp-empty-row").forEach((r) => r.remove());
                const allRows = Array.from(tbody.rows).filter(isDataRow);
                const placeholders = Array.from(tbody.rows).filter((r) => !isDataRow(r) && !r.classList.contains("ssvp-empty-row"));

                let rows = allRows;
                if (!hasOwnFilters) {
                    rows = rows.filter((row) => {
                        for (const k in state.filters) {
                            const v = state.filters[k];
                            if (v && !norm(cellText(row, Number(k))).includes(v)) return false;
                        }
                        return true;
                    });
                }
                const excluded = allRows.filter((r) => !rows.includes(r));

                if (state.sortCol >= 0 && state.sortDir !== 0) {
                    const ci = state.sortCol;
                    const numeric = rows.length > 0 && rows.every((r) => {
                        const txt = cellText(r, ci);
                        return txt === "" || NUM_RE.test(txt);
                    });
                    rows = rows.slice().sort((a, b) => {
                        const ta = cellText(a, ci), tb = cellText(b, ci);
                        let cmp;
                        if (numeric) {
                            cmp = (parseFloat(ta.replace(",", ".")) || 0) - (parseFloat(tb.replace(",", ".")) || 0);
                        } else {
                            cmp = ta.localeCompare(tb, undefined, { numeric: true, sensitivity: "base" });
                        }
                        return state.sortDir === 1 ? cmp : -cmp;
                    });
                }

                // Reorder DOM: matched (sorted) first, then excluded, then placeholders.
                [...rows, ...excluded, ...placeholders].forEach((r) => tbody.appendChild(r));

                const size = state.pageSize > 0 ? state.pageSize : rows.length || 1;
                const pageCount = Math.max(1, Math.ceil(rows.length / size));
                if (state.page > pageCount) state.page = pageCount;
                const start = (state.page - 1) * size;
                const end = start + size;

                rows.forEach((r, idx) => { r.style.display = (idx >= start && idx < end) ? "" : "none"; });
                excluded.forEach((r) => { r.style.display = "none"; });

                // Empty-match message (only when the table actually has data rows).
                if (rows.length === 0 && allRows.length > 0) {
                    const er = document.createElement("tr");
                    er.className = "ssvp-empty-row";
                    const td = document.createElement("td");
                    td.colSpan = cols;
                    td.textContent = tr("empty");
                    td.className = "muted";
                    er.appendChild(td);
                    tbody.appendChild(er);
                }

                const shownFrom = rows.length ? start + 1 : 0;
                const shownTo = Math.min(end, rows.length);
                countEl.textContent = rows.length
                    ? `${shownFrom}–${shownTo} / ${rows.length} ${tr("total")}`
                    : `0 ${tr("total")}`;
                pageInd.textContent = `${tr("page")} ${state.page} ${tr("of")} ${pageCount}`;
                prevBtn.disabled = state.page <= 1;
                nextBtn.disabled = state.page >= pageCount;
                const hidePager = state.pageSize === 0 || rows.length <= size;
                mid.style.visibility = hidePager ? "hidden" : "visible";
            } finally {
                if (observer) observer.observe(tbody, { childList: true });
            }
        }

        observer = new MutationObserver(() => apply());
        observer.observe(tbody, { childList: true });
        apply();
    }

    function init(root) {
        (root || document).querySelectorAll("table").forEach((t) => {
            try { enhance(t); } catch (_) { /* never break a page over a table */ }
        });
    }

    // Called by the Settings/Panel bootstrap once the per-user Appearance default
    // is known; updates already-enhanced tables and any enhanced later.
    function setDefaultPageSize(n) {
        n = parseInt(n, 10);
        if (Number.isNaN(n) || !PAGE_SIZES.includes(n)) return;
        globalDefault = n;
        instances.forEach((i) => i.setDefault(n));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init());
    } else {
        init();
    }

    window.SSVPTable = { enhance, init, setDefaultPageSize };
})();
