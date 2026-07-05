// Standalone operation tester (Panel → "Operasyon Test").
// Cascade: flow (YZA/3YM) → stage → [category → step →] operation → parameter
// form → run → live progress + formatted result on the right. Self-contained so
// it never collides with panel.js / settings.js globals.
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const otFlow = $("otFlow");
    if (!otFlow) {
        return; // not on the panel page / tab absent
    }
    const otStage = $("otStage");
    const otCategory = $("otCategory");
    const otStep = $("otStep");
    const otOperation = $("otOperation");
    const otStageLabel = $("otStageLabel");
    const otCategoryLabel = $("otCategoryLabel");
    const otStepLabel = $("otStepLabel");
    const otOperationLabel = $("otOperationLabel");
    const otOperationDesc = $("otOperationDesc");
    const otOperationForm = $("otOperationForm");
    const otTarget = $("otTarget");
    const otListSource = $("otListSource");
    const otParamForm = $("otParamForm");
    const otRunBtn = $("otRunBtn");
    const otNote = $("otNote");
    const otLog = $("otLog");
    const otResult = $("otResult");

    let catalog = null;      // current flow catalog
    let currentOp = null;    // selected operation descriptor
    let running = false;

    function esc(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }

    async function api(url, options = {}) {
        const res = await fetch(url, { headers: { "Accept-Language": "tr" }, ...options });
        const ctype = res.headers.get("content-type") || "";
        const payload = ctype.includes("application/json") ? await res.json().catch(() => ({})) : { detail: await res.text() };
        if (!res.ok) {
            const err = new Error(payload?.detail || payload?.error || "İşlem başarısız.");
            err.status = res.status;
            throw err;
        }
        return payload;
    }

    function setNote(text, isError) {
        if (!otNote) return;
        otNote.textContent = String(text || "");
        otNote.classList.toggle("error", Boolean(isError));
    }

    function show(el, labelEl, visible) {
        if (el) el.hidden = !visible;
        if (labelEl) labelEl.hidden = !visible;
    }

    function fillSelect(select, items, placeholder) {
        if (!select) return;
        const opts = [`<option value="">${esc(placeholder)}</option>`];
        items.forEach((it, i) => {
            opts.push(`<option value="${i}">${esc(it.label || it.display_name || it.key || it.operation_key)}</option>`);
        });
        select.innerHTML = opts.join("");
    }

    function resetBelow(level) {
        // level: 'stage' | 'category' | 'step' | 'operation'
        const order = ["stage", "category", "step", "operation"];
        const from = order.indexOf(level);
        order.slice(from).forEach((lvl) => {
            if (lvl === "stage") { show(otStage, otStageLabel, false); otStage.innerHTML = ""; }
            if (lvl === "category") { show(otCategory, otCategoryLabel, false); otCategory.innerHTML = ""; }
            if (lvl === "step") { show(otStep, otStepLabel, false); otStep.innerHTML = ""; }
            if (lvl === "operation") {
                show(otOperation, otOperationLabel, false); otOperation.innerHTML = "";
                if (otOperationDesc) otOperationDesc.hidden = true;
                if (otOperationForm) otOperationForm.hidden = true;
                currentOp = null;
            }
        });
    }

    function stageObj() { return catalog?.stages?.[Number(otStage.value)] || null; }
    function categoryObj() { return stageObj()?.categories?.[Number(otCategory.value)] || null; }
    function stepObj() { return categoryObj()?.steps?.[Number(otStep.value)] || null; }

    // --- Cascade wiring ---------------------------------------------------
    const catalogCache = {}; // per-flow, so toggling flows is instant after first load
    otFlow.addEventListener("change", async () => {
        resetBelow("stage");
        currentOp = null;
        const flow = otFlow.value;
        if (!flow) return;
        if (catalogCache[flow]) {
            catalog = catalogCache[flow];
            setNote("");
            fillSelect(otStage, catalog.stages || [], "İlerleme yönü seçin…");
            show(otStage, otStageLabel, true);
            return;
        }
        setNote("Katalog yükleniyor…");
        try {
            catalog = await api(`/validation/op-test-catalog?flow=${encodeURIComponent(flow)}`, { cache: "no-store" });
            catalogCache[flow] = catalog;
            setNote("");
            fillSelect(otStage, catalog.stages || [], "İlerleme yönü seçin…");
            show(otStage, otStageLabel, true);
        } catch (e) {
            setNote(e.message || "Katalog alınamadı.", true);
        }
    });

    otStage.addEventListener("change", () => {
        resetBelow("category");
        const st = stageObj();
        if (!st) return;
        if (catalog.has_categories) {
            const cats = st.categories || [];
            if (!cats.length) { setNote("Bu yönde kategori yok.", true); return; }
            fillSelect(otCategory, cats, "Kategori seçin…");
            show(otCategory, otCategoryLabel, true);
        } else {
            // YZA: no category/step — operations directly under the stage.
            const ops = st.operations || [];
            if (!ops.length) { setNote("Bu yönde operasyon yok.", true); return; }
            fillSelect(otOperation, ops, "Operasyon seçin…");
            show(otOperation, otOperationLabel, true);
        }
    });

    otCategory.addEventListener("change", () => {
        resetBelow("step");
        const cat = categoryObj();
        if (!cat) return;
        fillSelect(otStep, cat.steps || [], "Adım seçin…");
        show(otStep, otStepLabel, true);
    });

    otStep.addEventListener("change", () => {
        resetBelow("operation");
        const step = stepObj();
        if (!step) return;
        fillSelect(otOperation, step.operations || [], "Operasyon seçin…");
        show(otOperation, otOperationLabel, true);
    });

    otOperation.addEventListener("change", async () => {
        const st = stageObj();
        const list = catalog.has_categories ? (stepObj()?.operations || []) : (st?.operations || []);
        currentOp = list[Number(otOperation.value)] || null;
        if (otOperationForm) otOperationForm.hidden = true;
        if (!currentOp) return;
        if (otOperationDesc) {
            otOperationDesc.textContent = currentOp.description || "";
            otOperationDesc.hidden = !currentOp.description;
        }
        // Schema is fetched lazily (keeps the catalog fast).
        setNote("Parametreler yükleniyor…");
        if (otParamForm) otParamForm.innerHTML = "";
        if (otListSource) { otListSource.innerHTML = ""; otListSource.hidden = true; }
        try {
            const resp = await api("/validation/op-test-schema", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ flow: otFlow.value, operation_key: currentOp.operation_key, step_key: currentOp.step_key || "" }),
            });
            currentOp.schema = Array.isArray(resp.schema) ? resp.schema : [];
            renderParamForm(currentOp.schema);
            if (otOperationForm) otOperationForm.hidden = false;
            setNote("");
        } catch (e) {
            setNote(e.message || "Parametreler alınamadı.", true);
        }
    });

    // --- Parameter form ---------------------------------------------------
    function normType(t) {
        const s = String(t || "string").toLowerCase();
        if (s === "bool") return "boolean";
        if (["int", "integer", "float", "double", "number"].includes(s)) return "number";
        return s;
    }

    // Keys of "page list" params (taranacak sayfa listesi) that stand in for the
    // whole scan — rendered above the target as an "either a list, or params" block.
    const LIST_SOURCE_KEYS = new Set(["scan_list"]);

    function paramFieldHtml(field) {
        const key = String(field.key || "").trim();
        if (!key) return "";
        const type = normType(field.type);
        const required = Boolean(field.required);
        const def = field.default;
        const attrs = `data-key="${esc(key)}" data-type="${esc(type)}"`;
        const labelHtml = `<div class="ot-param-label"><span>${esc(field.label || key)}</span>${required ? '<span class="ot-req">gerekli</span>' : ""}</div>${field.description ? `<p class="ot-help">${esc(field.description)}</p>` : ""}`;
        let control;
        if (type === "boolean") {
            const checked = (def === true || String(def).toLowerCase() === "on" || String(def).toLowerCase() === "true") ? " checked" : "";
            control = `<label class="ot-check"><input type="checkbox" ${attrs}${checked}><span>${esc(key)}</span></label>`;
        } else if (Array.isArray(field.options_json) && field.options_json.length) {
            const opts = field.options_json.map((o) => {
                const v = typeof o === "string" ? o : (o.value ?? o.label ?? "");
                const l = typeof o === "string" ? o : (o.label ?? v);
                const sel = String(v) === String(def ?? "") ? " selected" : "";
                return `<option value="${esc(v)}"${sel}>${esc(l)}</option>`;
            }).join("");
            control = `<select ${attrs}><option value="">Seçiniz</option>${opts}</select>`;
        } else if (type === "number") {
            control = `<input type="number" ${attrs} value="${esc(def ?? "")}">`;
        } else if (type === "textarea") {
            control = `<textarea ${attrs} rows="4" placeholder="XML / liste">${esc(def ?? "")}</textarea>`;
        } else if (type === "upload") {
            const shown = def ? esc(def) : "Dosya seçilmedi";
            // Hidden input carries the value (uploaded cache filename); data-type
            // string so collectParams reads it as a plain string. The native file
            // input is hidden and triggered by the styled "Dosya Seç" button.
            control = `<div class="upload-param">
                <label class="upload-file-btn">
                    <input type="file" class="upload-param-input" accept=".xml,.txt">
                    <span>Dosya Seç</span>
                </label>
                <input type="hidden" data-key="${esc(key)}" data-type="string" value="${esc(def ?? "")}">
                <span class="upload-param-name">${shown}</span>
            </div>`;
        } else {
            control = `<input type="text" ${attrs} value="${esc(def ?? "")}">`;
        }
        return `<div class="ot-param-field">${labelHtml}${control}</div>`;
    }

    function renderParamForm(schema) {
        if (!otParamForm) return;
        const sorted = [...schema].sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
        const listSource = sorted.filter((f) => LIST_SOURCE_KEYS.has(String(f.key || "").trim()));
        const rest = sorted.filter((f) => !LIST_SOURCE_KEYS.has(String(f.key || "").trim()));

        // "Taranacak sayfa listesi" sits above the target, split off by a divider:
        // provide a ready page list, OR fill in the target and parameters below.
        if (otListSource) {
            if (listSource.length) {
                otListSource.innerHTML = `<div class="ot-param-grid">${listSource.map(paramFieldHtml).join("")}</div>`
                    + `<div class="ot-list-divider"><span>ya da</span></div>`;
                otListSource.hidden = false;
            } else {
                otListSource.innerHTML = "";
                otListSource.hidden = true;
            }
        }

        otParamForm.innerHTML = rest.map(paramFieldHtml).join("")
            || `<p class="muted" style="margin:0;">Bu operasyonun parametresi yok.</p>`;
    }

    // Keys that auto-fill from the target (mirrors backend _SMART_HOST/URL_KEYS),
    // so a required host/url param left blank is filled instead of erroring.
    const HOST_KEYS = new Set(["host", "target_host", "rhost", "rhosts", "ip", "target_ip", "hosts", "target"]);
    const URL_KEYS = new Set(["url", "base_url", "target_url", "login_endpoint", "endpoint", "target_uri"]);
    function targetAsUrl(t) {
        t = String(t || "").trim();
        if (!t) return "";
        return /^https?:\/\//.test(t) ? t : "http://" + t;
    }

    function collectParams(schema, target) {
        const values = {};
        // Params live in the list-source block (scan_list) and the main grid.
        const nodes = [
            ...(otListSource ? otListSource.querySelectorAll("[data-key]") : []),
            ...otParamForm.querySelectorAll("[data-key]"),
        ];
        nodes.forEach((node) => {
            const key = node.getAttribute("data-key");
            const type = node.getAttribute("data-type");
            if (type === "boolean") { values[key] = Boolean(node.checked); return; }
            const raw = String(node.value || "").trim();
            if (!raw) return;
            if (type === "number") {
                const n = Number(raw);
                if (Number.isFinite(n)) values[key] = n;
                return;
            }
            values[key] = raw;
        });
        // Smart-fill empty target-like params from the entered target.
        (schema || []).forEach((f) => {
            const key = String(f.key || "").toLowerCase();
            if (values[key] !== undefined && values[key] !== "") return;
            if (URL_KEYS.has(key)) values[f.key] = targetAsUrl(target);
            else if (HOST_KEYS.has(key)) values[f.key] = String(target || "").trim();
        });
        return values;
    }

    // --- Run + poll -------------------------------------------------------
    function logLine(msg) {
        if (!otLog) return;
        const div = document.createElement("div");
        const ts = new Date().toLocaleTimeString("tr-TR", { hour12: false });
        div.textContent = `[${ts}] ${msg}`;
        otLog.appendChild(div);
        otLog.scrollTop = otLog.scrollHeight;
    }

    otRunBtn && otRunBtn.addEventListener("click", async () => {
        if (running || !currentOp) return;
        const target = String(otTarget.value || "").trim();
        const parameters = collectParams(currentOp.schema || [], target);
        // A "scan list" (taranacak sayfa listesi) makes the target optional — the
        // op scans the given URLs directly. Otherwise a target is required.
        const hasScanList = String(parameters.scan_list || "").trim().length > 0;
        if (!target && !hasScanList) { setNote("Hedef girin (veya taranacak sayfa listesi verin).", true); return; }
        // required-field guard against the FINAL params (after smart-fill)
        const missing = (currentOp.schema || []).filter((f) => f.required && f.type !== "boolean")
            .map((f) => f.key)
            .filter((k) => {
                const v = parameters[k];
                return v === undefined || v === null || String(v).trim() === "";
            });
        if (missing.length) { setNote(`Zorunlu parametre eksik: ${missing.join(", ")}`, true); return; }

        running = true;
        otRunBtn.disabled = true;
        setNote("");
        otLog.innerHTML = "";
        otResult.innerHTML = `<p class="muted" style="margin:0;">Çalışıyor…</p>`;
        logLine(`Başlatılıyor: ${currentOp.display_name} (${currentOp.exec === "ai" ? "YZA" : "3YM"})`);

        try {
            let start;
            if (currentOp.exec === "ai") {
                start = await api("/validation/ai-execute-intent", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ operation_key: currentOp.operation_key, target, reason: "Operasyon test", parameters, approved: true }),
                });
            } else {
                start = await api("/validation/execute-intent", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ step_key: currentOp.step_key, action: currentOp.operation_key, target, reason: "Operasyon test", parameters, approved: true }),
                });
            }
            const state = await poll(start.execution_id);
            renderResult(state);
        } catch (e) {
            logLine(`Hata: ${e.message || e}`);
            otResult.innerHTML = `<div class="ot-error">${esc(e.message || "Çalıştırılamadı.")}</div>`;
        } finally {
            running = false;
            otRunBtn.disabled = false;
        }
    });

    async function poll(executionId) {
        const id = String(executionId || "").trim();
        if (!id) throw new Error("Execution id yok");
        let last = 0;
        const startedAt = Date.now();
        while (true) {
            if (Date.now() - startedAt > 12 * 60 * 1000) throw new Error("Zaman aşımı");
            const state = await api(`/validation/executions/${encodeURIComponent(id)}`, { cache: "no-store" });
            const logs = Array.isArray(state.logs) ? state.logs : [];
            while (last < logs.length) { logLine(logs[last]?.message || ""); last += 1; }
            if (["finished", "cancelled", "failed"].includes(state.status)) return state;
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    // --- Result rendering (shape-aware, no raw JSON) ----------------------
    // Keys shown in the top meta strip / handled explicitly, so the generic loop
    // below only renders the operation-specific findings.
    const META_KEYS = new Set(["ok", "tool", "tool_installed", "exit_code", "target", "command", "line_count", "output_tail", "error", "cancelled", "status", "summary", "risk_level", "scanned_urls_file"]);

    function downloadLink(fileName) {
        const name = String(fileName || "").trim();
        if (!name) return "";
        const url = `/download-scan-file?file_name=${encodeURIComponent(name)}&language=tr`;
        return `<div class="ot-section"><p class="ot-label">Taranan sayfalar</p><p class="ot-detail"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)} — XML indir</a></p></div>`;
    }
    const LABELS = {
        emails: "E-postalar", phones: "Telefonlar", names: "İsimler", usernames: "Kullanıcı adları",
        addresses: "Adresler", social_profiles: "Sosyal medya", credentials: "Kimlik/Parola bulguları",
        employees: "Çalışanlar", technologies: "Teknolojiler", other: "Diğer bulgular",
        scanned_urls: "Taranan sayfalar", pages_scanned: "Taranan sayfa sayısı", ai_available: "Yapay zeka",
        hosts: "Hostlar", ports: "Portlar",
    };

    function humanize(k) {
        return LABELS[k] || String(k || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
    }

    function metaChips(result) {
        const chips = [];
        if (result.tool) chips.push(["Araç", result.tool]);
        if (result.target) chips.push(["Hedef", result.target]);
        if (typeof result.ok === "boolean") chips.push(["Sonuç", result.ok ? "Başarılı" : "Başarısız"]);
        if (result.tool_installed === false) chips.push(["Kurulum", "Kurulu değil"]);
        if (result.exit_code !== undefined && result.exit_code !== null) chips.push(["Çıkış", result.exit_code]);
        if (result.line_count !== undefined && result.line_count !== null) chips.push(["Satır", result.line_count]);
        if (result.pages_scanned !== undefined) chips.push(["Sayfa", result.pages_scanned]);
        if (!chips.length) return "";
        return `<div class="ot-chips">${chips.map(([k, v]) => `<span class="ot-chip"><b>${esc(k)}</b> ${esc(String(v))}</span>`).join("")}</div>`;
    }

    function stringList(items) {
        return `<ul class="ot-list">${items.map((v) => `<li>${esc(String(v))}</li>`).join("")}</ul>`;
    }

    function objArrayTable(rows) {
        const cols = [];
        rows.forEach((r) => Object.keys(r || {}).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
        if (!cols.length) return stringList(rows.map((r) => JSON.stringify(r)));
        const head = cols.map((c) => `<th>${esc(humanize(c))}</th>`).join("");
        const body = rows.map((r) => `<tr>${cols.map((c) => { const v = r?.[c]; return `<td>${esc(v && typeof v === "object" ? JSON.stringify(v) : String(v ?? "-"))}</td>`; }).join("")}</tr>`).join("");
        return `<div class="ot-tbl-wrap"><table class="ot-tbl2"><tr>${head}</tr>${body}</table></div>`;
    }

    function section(label, count, bodyHtml) {
        const countBadge = count !== null && count !== undefined ? ` <span class="ot-count">${count}</span>` : "";
        return `<div class="ot-section"><p class="ot-label">${esc(label)}${countBadge}</p>${bodyHtml}</div>`;
    }

    function formatResult(result, opts) {
        opts = opts || {};
        if (result === null || result === undefined) return `<p class="muted" style="margin:0;">Sonuç verisi yok.</p>`;
        if (Array.isArray(result)) {
            return result.length && typeof result[0] === "object" ? objArrayTable(result) : stringList(result);
        }
        if (typeof result !== "object") return `<pre class="ot-console">${esc(String(result))}</pre>`;

        const parts = [];
        parts.push(metaChips(result));
        if (result.risk_level) parts.push(`<div class="ot-risk ot-risk-${esc(String(result.risk_level).toLowerCase())}">Risk: ${esc(String(result.risk_level).toUpperCase())}</div>`);
        // For AI-native ops the summary is rendered separately as the AI report.
        if (result.summary && !opts.hideSummary) parts.push(`<div class="ot-summary">${esc(String(result.summary))}</div>`);
        if (result.error) parts.push(`<div class="ot-error">${esc(String(result.error))}</div>`);
        if (result.command) parts.push(section("Komut", null, `<pre class="ot-console">${esc(String(result.command))}</pre>`));
        if (Array.isArray(result.output_tail) && result.output_tail.length) {
            parts.push(section("Çıktı", result.output_tail.length, `<pre class="ot-console">${esc(result.output_tail.join("\n"))}</pre>`));
        }
        if (result.scanned_urls_file) parts.push(downloadLink(result.scanned_urls_file));

        let hadFindings = false;
        Object.entries(result).forEach(([key, value]) => {
            if (META_KEYS.has(key)) return;
            if (Array.isArray(value)) {
                if (!value.length) return;
                hadFindings = true;
                parts.push(section(humanize(key), value.length, typeof value[0] === "object" ? objArrayTable(value) : stringList(value)));
            } else if (value && typeof value === "object") {
                if (!Object.keys(value).length) return;
                hadFindings = true;
                const rows = Object.entries(value).map(([k, v]) => `<tr><th>${esc(humanize(k))}</th><td>${esc(typeof v === "object" ? JSON.stringify(v) : String(v))}</td></tr>`).join("");
                parts.push(section(humanize(key), null, `<table class="ot-tbl">${rows}</table>`));
            } else if (value !== undefined && value !== null && value !== "" && value !== false) {
                parts.push(`<p class="ot-detail"><b>${esc(humanize(key))}:</b> ${esc(String(value))}</p>`);
            }
        });

        // If the op produced a summary/output but no discrete findings, don't nag;
        // only show the "no findings" hint when there is genuinely nothing.
        const html = parts.filter(Boolean).join("");
        if (!html.trim()) return `<p class="muted" style="margin:0;">Sonuç verisi yok.</p>`;
        return html;
    }

    function renderResult(state) {
        const output = state?.result?.output || {};
        const scriptResult = output.result;
        const guidance = output.ai_guidance || {};
        const aiNative = Boolean(currentOp && currentOp.ai_native);
        const statusLabel = state.status === "finished" ? "Tamamlandı" : (state.status === "cancelled" ? "İptal edildi" : "Hata");
        logLine(`Durum: ${statusLabel}`);
        let html = `<div class="ot-status ot-status-${esc(state.status)}">${esc(statusLabel)}</div>`;
        // Fully AI-driven operations (e.g. AI OSINT): the AI was given the data and
        // wrote a report — show it prominently. Tool ops get no AI evaluation.
        if (aiNative) {
            const report = String((scriptResult && scriptResult.summary) || guidance.summary || guidance?.evaluation?.summary || "").trim();
            if (report) {
                html += `<div class="ot-ai-report"><div class="ot-ai-report-head">🧠 Yapay Zeka Raporu</div><div class="ot-ai-report-body">${esc(report)}</div></div>`;
            }
        }
        html += formatResult(scriptResult !== undefined ? scriptResult : { status: state.status }, { hideSummary: aiNative });
        otResult.innerHTML = html;
    }

    // --- Upload-type param (OSINT scan/exclude list): upload on pick ---------
    document.addEventListener("change", async (event) => {
        const input = event.target.closest && event.target.closest(".upload-param-input");
        if (!input || !input.files || !input.files.length) return;
        const wrap = input.closest(".upload-param");
        const hidden = wrap && wrap.querySelector("input[type=hidden]");
        const nameSpan = wrap && wrap.querySelector(".upload-param-name");
        const file = input.files[0];
        if (nameSpan) nameSpan.textContent = "Yükleniyor…";
        try {
            const fd = new FormData();
            fd.append("file", file);
            const data = await api("/validation/osint-list/upload", { method: "POST", body: fd });
            const savedName = (data && data.added && data.added.name) || file.name;
            if (hidden) hidden.value = savedName;
            if (nameSpan) nameSpan.textContent = savedName;
        } catch (e) {
            if (nameSpan) nameSpan.textContent = "Yüklenemedi: " + (e.message || "hata");
            if (hidden) hidden.value = "";
        }
    });

    // --- OSINT list cache manager (Panel tab "Ön Bellek") -------------------
    // Upload happens only from the operation form; here files are listed,
    // downloaded or deleted.
    const otfTbody = $("otfTbody");
    if (otfTbody) {
        const otfNote = $("otfNote");
        const otfRefresh = $("otfRefresh");
        const otfDeleteSelected = $("otfDeleteSelected");
        const otfSelectAll = $("otfSelectAll");

        const setOtfNote = (msg, err) => { if (otfNote) { otfNote.textContent = msg || ""; otfNote.classList.toggle("error", Boolean(err)); } };

        function renderFiles(items) {
            if (otfSelectAll) otfSelectAll.checked = false;
            if (!items.length) {
                otfTbody.innerHTML = `<tr><td colspan="5" class="muted">Önbellekte dosya yok. Operasyon formundaki dosya alanından .xml/.txt yükleyin.</td></tr>`;
                return;
            }
            otfTbody.innerHTML = items.map((it) => {
                const dl = `/validation/osint-list/download?name=${encodeURIComponent(it.name)}`;
                const date = it.modified ? new Date(it.modified * 1000).toLocaleString("tr-TR") : "-";
                return `<tr>
                    <td><input type="checkbox" class="otf-check" value="${esc(it.name)}"></td>
                    <td>${esc(it.name)}</td>
                    <td>${esc(it.size_h || "")}</td>
                    <td>${esc(date)}</td>
                    <td><a href="${esc(dl)}" target="_blank" rel="noopener">İndir</a> · <button type="button" class="otf-del" data-name="${esc(it.name)}">Sil</button></td>
                </tr>`;
            }).join("");
        }

        async function loadFiles() {
            try {
                const d = await api("/validation/osint-list", { cache: "no-store" });
                renderFiles(Array.isArray(d.items) ? d.items : []);
            } catch (e) {
                setOtfNote(e.message || "Dosya listesi alınamadı.", true);
            }
        }

        async function deleteNames(names) {
            if (!names.length) return;
            try {
                const d = await api("/validation/osint-list/delete", {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names }),
                });
                renderFiles(Array.isArray(d.items) ? d.items : []);
                setOtfNote(`${d.deleted || 0} dosya silindi.`);
            } catch (e) {
                setOtfNote(e.message || "Silinemedi.", true);
            }
        }

        otfRefresh && otfRefresh.addEventListener("click", loadFiles);
        otfTbody.addEventListener("click", (e) => {
            const del = e.target.closest && e.target.closest(".otf-del");
            if (del) deleteNames([del.getAttribute("data-name")]);
        });
        otfDeleteSelected && otfDeleteSelected.addEventListener("click", () => {
            const names = Array.from(otfTbody.querySelectorAll(".otf-check:checked")).map((c) => c.value);
            if (!names.length) { setOtfNote("Silmek için dosya seçin.", true); return; }
            deleteNames(names);
        });
        otfSelectAll && otfSelectAll.addEventListener("change", () => {
            otfTbody.querySelectorAll(".otf-check").forEach((c) => { c.checked = otfSelectAll.checked; });
        });
        const otfTabBtn = document.querySelector('.tab-btn[data-tab="osint-files"]');
        otfTabBtn && otfTabBtn.addEventListener("click", loadFiles);
        loadFiles();
    }
})();
