const form = document.getElementById("scanForm");
const btn = document.getElementById("scanBtn");
const statusText = document.getElementById("statusText") || { innerText: "", textContent: "" };
const currentStep = document.getElementById("currentStep");
const resultDiv = document.getElementById("result") || { innerHTML: "", textContent: "" };
const logsDiv = document.getElementById("logs");
const aiOutput = document.getElementById("aiOutput");
const toolOptions = document.getElementById("toolOptions");
const paramOptions = document.getElementById("paramOptions");
const portOptions = document.getElementById("portOptions");
const scanConfigNote = document.getElementById("scanConfigNote");
const networkSummaryText = document.getElementById("networkSummaryText");
const networkSummaryToggle = document.getElementById("networkSummaryToggle");
const networkSummaryPopover = document.getElementById("networkSummaryPopover");
const networkSummaryMenu = document.getElementById("networkSummaryMenu");
const profileMenuWrap = document.getElementById("profileMenuWrap");
const profileMenuToggle = document.getElementById("profileMenuToggle");
const profileMenuPopover = document.getElementById("profileMenuPopover");
const languageMenuToggle = document.getElementById("languageMenuToggle");
const languageSubmenu = document.getElementById("languageSubmenu");
const languageMenuLabel = document.getElementById("languageMenuLabel");
const currentLanguageLabel = document.getElementById("currentLanguageLabel");
const themeToggle = document.getElementById("themeToggle");
const profileMenuProfile = document.getElementById("profileMenuProfile");
const profileMenuUsers = document.getElementById("profileMenuUsers");
const profileMenuPanel = document.getElementById("profileMenuPanel");
const profileMenuNewTest = document.getElementById("profileMenuNewTest");
const profileMenuLogout = document.getElementById("profileMenuLogout");
const legalNoticeText = document.getElementById("legalNoticeText");
const paramConflictNote = document.getElementById("paramConflictNote");
const operationTabs = document.getElementById("operationTabs");
const pathBreadcrumb = document.getElementById("pathBreadcrumb");
const precheckPanel = document.getElementById("precheckPanel");
const legalConsent = document.getElementById("legalConsent");
const legalContinue = document.getElementById("legalContinue");
const directionPanel = document.getElementById("directionPanel");
const directionActions = document.getElementById("directionActions");
const directionNote = document.getElementById("directionNote");
const directionSelectionWrap = document.getElementById("directionSelectionWrap");
const directionNextBtn = document.getElementById("directionNextBtn");
const directionProceedBtn = document.getElementById("directionProceedBtn");
const directionLockedWrap = document.getElementById("directionLockedWrap");
const directionLockedText = document.getElementById("directionLockedText");
const directionOperationWindow = document.getElementById("directionOperationWindow");
const nextTestParamsWrap = document.getElementById("nextTestParamsWrap");
const nextTestParamsForm = document.getElementById("nextTestParamsForm");
const testPlanPanel = document.getElementById("testPlanPanel");
const stepOutputs = document.getElementById("stepOutputs");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const authOverlay = document.getElementById("authOverlay");
const authMessage = document.getElementById("authMessage");
const actionApprovalOverlay = document.getElementById("actionApprovalOverlay");
const actionApprovalTitle = document.getElementById("actionApprovalTitle");
const actionApprovalMessage = document.getElementById("actionApprovalMessage");
const actionApprovalCancelBtn = document.getElementById("actionApprovalCancelBtn");
const actionApprovalConfirmBtn = document.getElementById("actionApprovalConfirmBtn");
const loginForm = document.getElementById("loginForm");
const loginSubmit = document.getElementById("loginSubmit");
const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordSubmit = document.getElementById("changePasswordSubmit");
const loginUsernameInput = document.getElementById("loginUsername");
const loginPasswordInput = document.getElementById("loginPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmNewPasswordInput = document.getElementById("confirmNewPassword");
const userAdminPanel = document.getElementById("userAdminPanel");
const userAdminInfo = document.getElementById("userAdminInfo");
const userAdminFeedback = document.getElementById("userAdminFeedback");
const usersRefreshBtn = document.getElementById("usersRefreshBtn");
const usersTableBody = document.getElementById("usersTableBody");
const userCreateForm = document.getElementById("userCreateForm");
const userCreateSubmit = document.getElementById("userCreateSubmit");
const userCreateUsername = document.getElementById("userCreateUsername");
const userCreatePassword = document.getElementById("userCreatePassword");
const userCreatePasswordConfirm = document.getElementById("userCreatePasswordConfirm");
const userCreateIsAdmin = document.getElementById("userCreateIsAdmin");
const userCreateRoles = document.getElementById("userCreateRoles");
const userEditPanel = document.getElementById("userEditPanel");
const userEditForm = document.getElementById("userEditForm");
const userEditId = document.getElementById("userEditId");
const userEditUsername = document.getElementById("userEditUsername");
const userEditIsAdmin = document.getElementById("userEditIsAdmin");
const userEditIsActive = document.getElementById("userEditIsActive");
const userEditRoles = document.getElementById("userEditRoles");
const userEditCancelBtn = document.getElementById("userEditCancelBtn");
const userEditSaveBtn = document.getElementById("userEditSaveBtn");
const NEXT_TEST_CATALOG_I18N_BASE_URL = "/static/i18n/next_tests_catalog";
const I18N_MANIFEST_URL = "/static/i18n/languages.json";
const I18N_BASE_URL = "/static/i18n";
const THEME_STORAGE_KEY = "ssvp-theme";
const LANGUAGE_STORAGE_KEY = "ssvp-language";
const LEGAL_ACCEPTED_PREFIX = "ssvp-legal-accepted";
const stageMain = document.querySelector(".stage-main");

let nextTestCatalog = null;
let nextTestCatalogLanguage = "";
let hasScanTab = false;
let hasDirectionTab = false;
let selectedDirection = "";
let selectedDirectionStepKey = "";
let directionLocked = false;
let directionCompleted = false;
let directionOperationDetails = null;
let currentLanguage = "tr";
let supportedLanguages = [];
let i18nDictionary = {};
let currentUser = null;
let authResolve = null;
let lastLoginPassword = "";
let hasUsersTab = false;
let availableRoles = [];
let managedUsers = [];
let latestScanResult = null;
const stageSuggestionsByStage = {};
let workflowSteps = [];
const workflowStepByKey = {};
let approvalResolve = null;
let operationWindowIntents = [];
let operationWindowExecuted = false;
let operationWindowRunning = false;

const STAGE_ROLE_MAP = {
    scan: "test",
    attack: "attack",
    remediation: "remediation",
};


function roleForStage(stageName) {
    return STAGE_ROLE_MAP[stageName] || "test";
}


function setWorkflowSteps(steps) {
    workflowSteps = Array.isArray(steps) ? steps : [];
    Object.keys(workflowStepByKey).forEach((key) => delete workflowStepByKey[key]);

    for (const step of workflowSteps) {
        const key = String(step.step_key || "").trim().toLowerCase();
        if (!key) {
            continue;
        }
        workflowStepByKey[key] = step;
    }
}


function getStepsForDirection(directionValue) {
    const direction = String(directionValue || "").trim().toLowerCase();
    return workflowSteps.filter((item) => String(item.workflow_key || "").trim().toLowerCase() === direction);
}


function getDirectionCategories(directionValue) {
    const items = getStepsForDirection(directionValue);
    const map = new Map();

    for (const step of items) {
        const categoryKey = String(step.category_key || "general").trim().toLowerCase() || "general";
        if (!map.has(categoryKey)) {
            map.set(categoryKey, {
                key: categoryKey,
                label: categoryKey.replaceAll("_", " "),
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, currentLanguage));
}


function renderDirectionCategoryAndSteps() {
    const categorySelect = document.getElementById("nextTestCategory");
    const stepSelect = document.getElementById("nextTestPreset");
    const manualWrap = document.getElementById("nextTestManualWrap");
    const feedback = document.getElementById("nextTestFeedback");
    if (!categorySelect || !stepSelect) {
        return;
    }

    if (nextTestParamsWrap) {
        nextTestParamsWrap.style.display = "none";
    }
    if (nextTestParamsForm) {
        nextTestParamsForm.innerHTML = "";
    }

    if (manualWrap) {
        manualWrap.style.display = "none";
    }

    clearIntentSelectionUi();

    const categories = getDirectionCategories(selectedDirection);
    if (!selectedDirection || !categories.length) {
        categorySelect.innerHTML = `<option value="">${escapeHtml(t("direction.noCategory", "Kategori secilmedi"))}</option>`;
        stepSelect.innerHTML = `<option value="">${escapeHtml(t("direction.noStep", "Adim secilmedi"))}</option>`;
        selectedDirectionStepKey = "";
        if (feedback) {
            feedback.classList.remove("error");
            feedback.innerText = selectedDirection ? t("direction.noStep", "Adim secilmedi") : t("direction.waiting", "Yon secimi bekleniyor.");
        }
        directionNextBtn.disabled = true;
        if (directionProceedBtn) {
            directionProceedBtn.disabled = true;
        }
        return;
    }

    const previousCategory = categorySelect.value;
    categorySelect.innerHTML = categories
        .map((item) => `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`)
        .join("");

    if (categories.some((item) => item.key === previousCategory)) {
        categorySelect.value = previousCategory;
    }

    const activeCategory = categorySelect.value || categories[0].key;
    const steps = getStepsForDirection(selectedDirection)
        .filter((item) => (item.category_key || "general") === activeCategory)
        .sort((a, b) => String(a.step_name || "").localeCompare(String(b.step_name || ""), currentLanguage));

    if (!steps.length) {
        stepSelect.innerHTML = `<option value="">${escapeHtml(t("direction.noStep", "Adim secilmedi"))}</option>`;
        selectedDirectionStepKey = "";
        directionNextBtn.disabled = true;
        if (directionProceedBtn) {
            directionProceedBtn.disabled = true;
        }
        return;
    }

    const previousStep = selectedDirectionStepKey;
    stepSelect.innerHTML = steps
        .map((item) => `<option value="${escapeHtml(item.step_key)}">${escapeHtml(item.step_name || item.step_key)}</option>`)
        .join("");

    if (steps.some((item) => item.step_key === previousStep)) {
        stepSelect.value = previousStep;
    }

    selectedDirectionStepKey = stepSelect.value || steps[0].step_key;
    directionNextBtn.disabled = !selectedDirectionStepKey;
    if (directionProceedBtn) {
        directionProceedBtn.disabled = !selectedDirectionStepKey;
    }

    if (feedback) {
        feedback.classList.remove("error");
        feedback.innerText = `${t("direction.category", "Kategori")}: ${activeCategory.replaceAll("_", " ")} | ${t("direction.step", "Adim")}: ${stepSelect.selectedOptions?.[0]?.textContent || "-"}`;
    }
}


function renderWorkflowStepCards() {
    if (!directionActions) {
        return;
    }

    directionActions.innerHTML = `
        <button type="button" class="action-card" data-direction="scan">
            <p class="action-title">${escapeHtml(t("direction.scan", "Tarama"))}</p>
            <p class="action-description">${escapeHtml(t("direction.scan.desc", "Tarama odakli dogrulama aksiyonlarini planla."))}</p>
        </button>
        <button type="button" class="action-card" data-direction="attack">
            <p class="action-title">${escapeHtml(t("direction.attack", "Atak"))}</p>
            <p class="action-description">${escapeHtml(t("direction.attack.desc", "Yetkili aktif dogrulama aksiyonlarini calistir."))}</p>
        </button>
        <button type="button" class="action-card" data-direction="remediation">
            <p class="action-title">${escapeHtml(t("direction.remediation", "Duzenleme"))}</p>
            <p class="action-description">${escapeHtml(t("direction.remediation.desc", "Duzeltme odakli aksiyonlari calistir."))}</p>
        </button>
    `;
}


async function loadWorkflowStepsFromServer() {
    try {
        const response = await apiRequest("/validation/workflow-steps", { cache: "no-store" });
        setWorkflowSteps(response.items || []);
        renderWorkflowStepCards();
        renderDirectionCategoryAndSteps();
        applyRoleRestrictions();
    } catch (_) {
        setWorkflowSteps([]);
        renderWorkflowStepCards();
        renderDirectionCategoryAndSteps();
    }
}


function t(key, fallback = "") {
    return i18nDictionary[key] || fallback || key;
}


function tf(key, vars = {}, fallback = "") {
    let text = t(key, fallback);
    for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
}


function setAuthMessage(message, isError = false) {
    if (!authMessage) {
        return;
    }

    authMessage.innerText = message || "";
    authMessage.classList.toggle("error", Boolean(isError));
}


function appendProcessLog(message) {
    if (!logsDiv) {
        return;
    }

    const timestamp = new Date().toLocaleTimeString("tr-TR", { hour12: false });
    const line = document.createElement("div");
    line.textContent = `[${timestamp}] ${String(message || "").trim()}`;
    logsDiv.appendChild(line);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}


function appendAiEvaluation(title, text) {
    if (!aiOutput) {
        return;
    }
    // Manual 3YM mode is AI-free: never populate the AI evaluation box.
    if (workflowMode === "manual") {
        return;
    }

    const normalizedTitle = String(title || "Yapay Zeka Degerlendirmesi").trim();
    const normalizedText = String(text || "").trim();
    if (!normalizedText) {
        return;
    }

    const chunks = [];
    if (aiOutput.innerText.trim()) {
        chunks.push(aiOutput.innerText.trim());
    }
    chunks.push(`## ${normalizedTitle}`);
    chunks.push(normalizedText);

    aiOutput.innerText = chunks.join("\n\n");
}


function requestActionApproval({ title, message }) {
    if (!actionApprovalOverlay || !actionApprovalConfirmBtn || !actionApprovalCancelBtn) {
        return Promise.resolve(false);
    }

    if (actionApprovalTitle) {
        actionApprovalTitle.innerText = title || "Islem Onayi";
    }
    if (actionApprovalMessage) {
        actionApprovalMessage.innerText = message || "Bu islem backend Tool Runner ile calistirilacak.";
    }

    actionApprovalOverlay.hidden = false;

    return new Promise((resolve) => {
        approvalResolve = resolve;
    });
}


function closeActionApprovalModal(approved) {
    if (actionApprovalOverlay) {
        actionApprovalOverlay.hidden = true;
    }

    if (typeof approvalResolve === "function") {
        approvalResolve(Boolean(approved));
        approvalResolve = null;
    }
}


function showAuthOverlay(show) {
    if (!authOverlay) {
        return;
    }

    authOverlay.hidden = !show;
}


function resetAuthForms() {
    if (loginForm) {
        loginForm.style.display = "flex";
    }
    if (changePasswordForm) {
        changePasswordForm.style.display = "none";
    }
    if (loginPasswordInput) {
        loginPasswordInput.value = "";
    }
    if (newPasswordInput) {
        newPasswordInput.value = "";
    }
    if (confirmNewPasswordInput) {
        confirmNewPasswordInput.value = "";
    }
}


function completeAuthentication() {
    showAuthOverlay(false);
    setAuthMessage("");
    resetAuthForms();
    applyRoleRestrictions();

    if (typeof authResolve === "function") {
        authResolve(true);
        authResolve = null;
    }
}


function setUserAdminFeedback(message, isError = false) {
    const msg = String(message || "").trim();
    const isProgress = /\.\.\.$|olusturuluyor|guncelleniyor|creating|updating/i.test(msg);
    const toastType = isError ? "error" : (isProgress ? "info" : "success");

    if (!userAdminFeedback) {
        if (msg && window.SSVPNotify) {
            window.SSVPNotify.show({ message: msg, type: toastType, duration: 10000 });
        }
        return;
    }

    userAdminFeedback.innerText = msg;
    userAdminFeedback.classList.toggle("error", Boolean(isError));

    if (msg && window.SSVPNotify) {
        window.SSVPNotify.show({ message: msg, type: toastType, duration: 10000 });
    }
}


function hasUserManagementAccess() {
    return hasRole("user_management");
}


async function apiRequest(url, options = {}) {
    const mergedOptions = {
        ...options,
        headers: {
            "Accept-Language": currentLanguage,
            ...(options.headers || {}),
        },
    };

    const response = await fetch(url, mergedOptions);
    const contentType = response.headers.get("content-type") || "";
    let payload;
    if (contentType.includes("application/json")) {
        try {
            payload = await response.json();
        } catch (_) {
            const text = await response.text();
            payload = { detail: text || "Beklenmeyen yanit formati" };
        }
    } else {
        payload = { detail: await response.text() };
    }

    if (!response.ok) {
        if (response.status === 401) {
            currentUser = null;
            showAuthOverlay(true);
        }
        throw new Error(payload.detail || payload.error || "Islem basarisiz");
    }

    return payload;
}


function getSelectedRoles(container) {
    if (!container) {
        return [];
    }

    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
        .map((item) => item.value)
        .filter(Boolean);
}


function renderRoleCheckboxes(container, selected = [], disabled = false) {
    if (!container) {
        return;
    }

    const selectedSet = new Set(selected || []);
    container.innerHTML = availableRoles
        .map((roleName) => {
            const checkedAttr = selectedSet.has(roleName) ? " checked" : "";
            const disabledAttr = disabled ? " disabled" : "";
            return `
                <label class="check-chip">
                    <input type="checkbox" value="${escapeHtml(roleName)}"${checkedAttr}${disabledAttr}>
                    <span>${escapeHtml(roleName)}</span>
                </label>
            `;
        })
        .join("");
}


function canManageTarget(targetUser) {
    if (!currentUser || !targetUser) {
        return false;
    }

    if (currentUser.is_admin) {
        return true;
    }

    return !targetUser.is_admin;
}


function resetUserEditForm() {
    if (!userEditPanel || !userEditForm) {
        return;
    }

    userEditForm.reset();
    userEditPanel.style.display = "none";
    renderRoleCheckboxes(userEditRoles, []);
}


function openUserEditForm(userItem) {
    if (!userEditPanel || !userEditId || !userEditUsername || !userEditIsAdmin || !userEditIsActive) {
        return;
    }

    const canManage = canManageTarget(userItem);
    userEditPanel.style.display = "block";
    userEditId.value = String(userItem.id);
    userEditUsername.value = userItem.username || "";
    userEditIsAdmin.checked = Boolean(userItem.is_admin);
    userEditIsActive.checked = Boolean(userItem.is_active);

    const cannotToggleAdmin = !currentUser?.is_admin || !canManage || Number(userItem.id) === Number(currentUser?.id);
    userEditIsAdmin.disabled = cannotToggleAdmin;
    userEditIsActive.disabled = !canManage;
    if (userEditSaveBtn) {
        userEditSaveBtn.disabled = !canManage;
    }

    renderRoleCheckboxes(userEditRoles, userItem.roles || [], !canManage || Boolean(userItem.is_admin && !currentUser?.is_admin));
}


function renderUsersTable() {
    if (!usersTableBody) {
        return;
    }

    if (!managedUsers.length) {
        usersTableBody.innerHTML = `<tr><td colspan="5">${t("users.table.empty", "Kullanıcı bulunamadı.")}</td></tr>`;
        return;
    }

    usersTableBody.innerHTML = managedUsers
        .map((item) => {
            const canManage = canManageTarget(item);
            const isSelf = Number(item.id) === Number(currentUser?.id);
            return `
                <tr>
                    <td>${escapeHtml(item.username || "-")}</td>
                    <td>${item.is_admin ? t("users.common.yes", "Evet") : t("users.common.no", "Hayır")}</td>
                    <td>${item.is_active ? t("users.common.active", "Aktif") : t("users.common.inactive", "Pasif")}</td>
                    <td>${escapeHtml((item.roles || []).join(", ") || "-")}</td>
                    <td>
                        <div class="user-table-actions">
                            <button type="button" data-action="edit" data-user-id="${item.id}"${canManage ? "" : " disabled"}>${t("users.common.edit", "Düzenle")}</button>
                            <button type="button" data-action="reset" data-user-id="${item.id}"${canManage ? "" : " disabled"}>${t("users.common.resetPassword", "Şifre Sıfırla")}</button>
                            <button type="button" data-action="delete" data-user-id="${item.id}"${canManage && !isSelf ? "" : " disabled"}>${t("users.common.delete", "Sil")}</button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}


async function loadUserAdminData() {
    if (!hasUserManagementAccess()) {
        setUserAdminFeedback(t("users.error.noPermission", "Kullanıcı yönetimi rolünüz yok."), true);
        return;
    }

    try {
        const [rolesData, usersData] = await Promise.all([
            apiRequest("/roles", { cache: "no-store" }),
            apiRequest("/users", { cache: "no-store" })
        ]);

        availableRoles = Array.isArray(rolesData.roles) ? rolesData.roles : [];
        managedUsers = Array.isArray(usersData.items) ? usersData.items : [];

        renderRoleCheckboxes(userCreateRoles, []);
        syncCreateRoleSelection();
        renderUsersTable();

        if (userCreateIsAdmin) {
            userCreateIsAdmin.disabled = !Boolean(currentUser?.is_admin);
        }

        if (userAdminInfo) {
            userAdminInfo.innerText = currentUser?.is_admin
                ? t("users.info.admin", "Tüm kullanıcıları yönetebilirsiniz.")
                : t("users.info.manager", "Admin hesaplar görüntülenir ancak üzerlerinde işlem yapılamaz.");
        }
    } catch (error) {
        setUserAdminFeedback(error.message || t("users.error.listLoad", "Kullanıcı listesi alınamadı"), true);
    }
}


function ensureUsersTab() {
    if (hasUsersTab || !operationTabs) {
        return;
    }

    const opIndex = operationTabs.querySelectorAll(".stage-tab").length + 1;
    const tabRow = document.createElement("div");
    tabRow.className = "stage-tab-row";

    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "stage-tab";
    tabButton.dataset.op = "users";
    tabButton.innerText = `${opIndex}. ${t("users.tab.title", "Kullanıcı Yönetimi")}`;

    tabRow.appendChild(tabButton);
    operationTabs.appendChild(tabRow);
    hasUsersTab = true;
}


function syncCreateRoleSelection() {
    if (!userCreateRoles || !userCreateIsAdmin) {
        return;
    }

    const inputs = userCreateRoles.querySelectorAll('input[type="checkbox"]');
    if (userCreateIsAdmin.checked) {
        inputs.forEach((input) => {
            input.checked = true;
            input.disabled = true;
        });
    } else {
        inputs.forEach((input) => {
            input.disabled = false;
        });
    }
}


function bindUserAdminPanel() {
    if (usersRefreshBtn) {
        usersRefreshBtn.addEventListener("click", async () => {
            await loadUserAdminData();
            setUserAdminFeedback(t("users.success.listRefreshed", "Kullanıcı listesi güncellendi."));
        });
    }

    if (userCreateIsAdmin) {
        userCreateIsAdmin.addEventListener("change", syncCreateRoleSelection);
    }

    if (userCreateForm) {
        userCreateForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!userCreateUsername || !userCreatePassword || !userCreatePasswordConfirm || !userCreateIsAdmin) {
                return;
            }

            const username = userCreateUsername.value.trim();
            const password = userCreatePassword.value;
            const passwordConfirm = userCreatePasswordConfirm.value;
            const isAdmin = userCreateIsAdmin.checked;

            if (password !== passwordConfirm) {
                setUserAdminFeedback(t("users.error.passwordMismatch", "Şifre ve şifre doğrulama alanları aynı olmalı."), true);
                return;
            }

            userCreateSubmit.disabled = true;
            setUserAdminFeedback(t("users.progress.creating", "Kullanıcı oluşturuluyor..."));

            try {
                const roles = isAdmin ? availableRoles : getSelectedRoles(userCreateRoles);
                await apiRequest("/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username,
                        password,
                        is_admin: isAdmin,
                        roles,
                    })
                });

                userCreateForm.reset();
                renderRoleCheckboxes(userCreateRoles, []);
                syncCreateRoleSelection();
                await loadUserAdminData();
                setUserAdminFeedback(t("users.success.created", "Kullanıcı başarıyla oluşturuldu."));
            } catch (error) {
                setUserAdminFeedback(error.message || t("users.error.create", "Kullanıcı oluşturulamadı"), true);
            } finally {
                userCreateSubmit.disabled = false;
            }
        });
    }

    if (usersTableBody) {
        usersTableBody.addEventListener("click", async (event) => {
            const button = event.target.closest("button[data-action]");
            if (!button) {
                return;
            }

            const action = button.dataset.action;
            const userId = Number(button.dataset.userId || "0");
            const target = managedUsers.find((item) => Number(item.id) === userId);
            if (!target) {
                return;
            }

            if (action === "edit") {
                openUserEditForm(target);
                setUserAdminFeedback("");
                return;
            }

            if (action === "reset") {
                const password = window.prompt(tf("users.prompt.newPassword", { username: target.username }, "Yeni şifre girin ({username}):"), "");
                if (!password) {
                    return;
                }

                const confirmValue = window.prompt(t("users.prompt.newPasswordConfirm", "Yeni şifreyi tekrar girin:"), "");
                if (confirmValue !== password) {
                    setUserAdminFeedback(t("users.error.passwordConfirm", "Şifre doğrulama başarısız."), true);
                    return;
                }

                try {
                    await apiRequest(`/users/${userId}/reset-password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ new_password: password })
                    });
                    await loadUserAdminData();
                    setUserAdminFeedback(tf("users.success.passwordReset", { username: target.username }, "Kullanıcı şifresi sıfırlandı: {username}"));
                } catch (error) {
                    setUserAdminFeedback(error.message || t("users.error.passwordReset", "Şifre sıfırlama başarısız"), true);
                }
                return;
            }

            if (action === "delete") {
                const confirmed = window.confirm(tf("users.confirm.delete", { username: target.username }, "{username} kullanıcısını silmek istiyor musunuz?"));
                if (!confirmed) {
                    return;
                }

                try {
                    await apiRequest(`/users/${userId}`, {
                        method: "DELETE"
                    });
                    await loadUserAdminData();
                    resetUserEditForm();
                    setUserAdminFeedback(tf("users.success.deleted", { username: target.username }, "Kullanıcı silindi: {username}"));
                } catch (error) {
                    setUserAdminFeedback(error.message || t("users.error.delete", "Kullanıcı silinemedi"), true);
                }
            }
        });
    }

    if (userEditCancelBtn) {
        userEditCancelBtn.addEventListener("click", () => {
            resetUserEditForm();
            setUserAdminFeedback(t("users.info.editCancelled", "Düzenleme iptal edildi."));
        });
    }

    if (userEditForm) {
        userEditForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!userEditId || !userEditUsername || !userEditIsAdmin || !userEditIsActive) {
                return;
            }

            const userId = Number(userEditId.value || "0");
            const payload = {
                username: userEditUsername.value.trim(),
                is_admin: userEditIsAdmin.checked,
                is_active: userEditIsActive.checked,
                roles: getSelectedRoles(userEditRoles),
            };

            if (userEditSaveBtn) {
                userEditSaveBtn.disabled = true;
            }
            setUserAdminFeedback(t("users.progress.updating", "Kullanıcı güncelleniyor..."));

            try {
                await apiRequest(`/users/${userId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                await loadUserAdminData();
                const updated = managedUsers.find((item) => Number(item.id) === userId);
                if (updated) {
                    openUserEditForm(updated);
                }
                setUserAdminFeedback(t("users.success.updated", "Kullanıcı bilgileri güncellendi."));
            } catch (error) {
                setUserAdminFeedback(error.message || t("users.error.update", "Kullanıcı güncellenemedi"), true);
            } finally {
                if (userEditSaveBtn) {
                    userEditSaveBtn.disabled = false;
                }
            }
        });
    }
}


function hasRole(roleName) {
    if (!currentUser) {
        return false;
    }

    if (currentUser.is_admin) {
        return true;
    }

    return Array.isArray(currentUser.roles) && currentUser.roles.includes(roleName);
}


function updateCurrentUserUi() {
    if (!profileMenuToggle) {
        return;
    }

    const username = currentUser?.username || "U";
    profileMenuToggle.innerText = String(username).slice(0, 1).toUpperCase();
    profileMenuToggle.setAttribute("title", username);
}


function applyRoleRestrictions() {
    const canRunScan = hasRole("test");
    if (!canRunScan) {
        if (scanConfigNote) {
            scanConfigNote.innerText = "Bu hesapta test rolü yok. Tarama başlatamazsınız.";
        }
        if (btn) {
            btn.disabled = true;
        }
    } else {
        updateScanButtonState();
    }

    if (directionActions) {
        directionActions.querySelectorAll("[data-direction]").forEach((button) => {
            const direction = button.getAttribute("data-direction");
            const allowed = hasRole(roleForStage(direction));
            button.classList.toggle("disabled", !allowed);
            button.disabled = !allowed;
            if (!allowed) {
                button.setAttribute("title", "Bu yön için rolünüz yok");
            } else {
                button.removeAttribute("title");
            }
        });
    }

    if (profileMenuUsers) {
        profileMenuUsers.style.display = "block";
    }

    if (profileMenuPanel) {
        profileMenuPanel.style.display = currentUser?.is_admin ? "block" : "none";
    }

    if (userAdminPanel && userAdminPanel.style.display !== "none") {
        setActiveOperation("scan");
    }
}


function parseParametersFromManualInput() {
    const raw = (document.getElementById("nextTestManualName")?.value || "").trim();
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    } catch (_) {
        return {};
    }
}


// Parameter keys that take a wordlist/list file. On operation forms (YZO + 3YM)
// these render as a selectbox populated from the DB wordlist catalog instead of
// a free-text path input.
// The searchable wordlist combobox now lives in the shared window.SSVPWl helper
// (notify.js) so the same widget is used identically on every page. These thin
// wrappers keep the existing call sites working.
const WORDLIST_PARAM_KEYS = (window.SSVPWl && window.SSVPWl.WORDLIST_KEYS)
    || new Set(["wordlist", "wordlists", "userlist", "passlist", "combo_file"]);

async function loadWordlistCatalog() {
    if (window.SSVPWl) {
        await window.SSVPWl.load();
    }
}

// Wordlist param: a searchable combobox (live filter) instead of a plain path
// input. A hidden input carries the real value with the collector's data-attrs.
function wordlistSelectHtml(labelBlock, value, attrs) {
    const combo = window.SSVPWl
        ? window.SSVPWl.comboHtml(`${attrs} data-param-type="file"`, value)
        : `<input type="text" ${attrs} data-param-type="file" value="${escapeHtml(value == null ? "" : String(value))}">`;
    return `
        <div class="dynamic-param-field">
            ${labelBlock}
            ${combo}
        </div>
    `;
}


// Upload-type params (OSINT scan/exclude lists): on file pick, upload the .xml/.txt
// to the OSINT cache and store the returned filename as the param value.
document.addEventListener("change", async (event) => {
    const input = event.target.closest?.(".upload-param-input");
    if (!input || !input.files || !input.files.length) {
        return;
    }
    const wrap = input.closest(".upload-param");
    const hidden = wrap?.querySelector("input[type=hidden]");
    const nameSpan = wrap?.querySelector(".upload-param-name");
    const file = input.files[0];
    if (nameSpan) nameSpan.textContent = "Yükleniyor…";
    try {
        const formData = new FormData();
        formData.append("file", file);
        const data = await apiRequest("/validation/osint-list/upload", { method: "POST", body: formData });
        const savedName = data?.added?.name || file.name;
        if (hidden) hidden.value = savedName;
        if (nameSpan) nameSpan.textContent = savedName;
    } catch (error) {
        if (nameSpan) nameSpan.textContent = `Yüklenemedi: ${error.message || "hata"}`;
        if (hidden) hidden.value = "";
    }
});


function normalizeDynamicParamType(paramType) {
    const token = String(paramType || "string").trim().toLowerCase();
    if (token === "bool") return "boolean";
    if (token === "int") return "number";
    if (token === "float") return "number";
    if (token === "integer") return "number";
    if (token === "double") return "number";
    if (token === "ip_address") return "ip";
    return token;
}


// Threshold above which a parameter is treated as "advanced" and tucked into a
// collapsible section. The tool-wrapper seed assigns advanced options a
// sort_order >= 500 so common/required inputs stay on top of the operation form.
const ADVANCED_PARAM_SORT_THRESHOLD = 500;

function dynamicParamHelpHtml(item) {
    const desc = String(item?.description || "").trim();
    return desc ? `<p class="dynamic-param-help">${escapeHtml(desc)}</p>` : "";
}

// Render a single schema field. `attrs` is the data-* attribute string that lets
// the matching collector find the input (differs between the manual flow and the
// operation window). Centralizing this keeps every widget type, help text and
// required marker consistent across both renderers.
function dynamicParamFieldHtml(item, value, attrs) {
    const key = String(item?.key || "").trim();
    if (!key) {
        return "";
    }

    const label = String(item?.label || key);
    const required = Boolean(item?.required);
    const type = normalizeDynamicParamType(item?.type);
    const options = Array.isArray(item?.options_json) ? item.options_json : [];
    const keyAttr = escapeHtml(key);
    const labelBlock = `
        <div class="dynamic-param-label">
            <span>${escapeHtml(label)}</span>
            ${required ? `<span class="dynamic-param-required">gerekli</span>` : ""}
        </div>
        ${dynamicParamHelpHtml(item)}`;

    // Wordlist-type params become a selectbox fed by the wordlist catalog.
    if (WORDLIST_PARAM_KEYS.has(key)) {
        return wordlistSelectHtml(labelBlock, value, attrs);
    }

    if (type === "boolean") {
        const checked = value === true ? " checked" : "";
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <label class="check-chip">
                    <input type="checkbox" ${attrs} data-param-type="boolean"${checked}>
                    <span>${keyAttr}</span>
                </label>
            </div>
        `;
    }

    if (type === "textarea") {
        const shown = value == null ? "" : String(value);
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <textarea ${attrs} data-param-type="textarea" rows="4" placeholder="XML / liste">${escapeHtml(shown)}</textarea>
            </div>
        `;
    }

    if (type === "upload") {
        const shown = value == null ? "" : String(value);
        // Native file input is hidden and triggered by the styled "Dosya Seç"
        // button; the hidden input carries the uploaded cache filename value.
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <div class="upload-param">
                    <label class="upload-file-btn">
                        <input type="file" class="upload-param-input" accept=".xml,.txt">
                        <span>Dosya Seç</span>
                    </label>
                    <input type="hidden" ${attrs} data-param-type="string" value="${escapeHtml(shown)}">
                    <span class="upload-param-name">${shown ? escapeHtml(shown) : "Dosya seçilmedi"}</span>
                </div>
            </div>
        `;
    }

    if (type === "json" || type === "list" || type === "object" || type === "dict") {
        const serialized = typeof value === "string"
            ? value
            : JSON.stringify(value ?? (type === "list" ? [] : {}), null, 2);
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <textarea ${attrs} data-param-type="${escapeHtml(type)}" placeholder="JSON">${escapeHtml(serialized)}</textarea>
            </div>
        `;
    }

    if (type === "number") {
        const numericValue = Number(value);
        const shown = Number.isFinite(numericValue) ? String(numericValue) : "";
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <input type="number" ${attrs} data-param-type="number" value="${escapeHtml(shown)}">
            </div>
        `;
    }

    if (type === "select") {
        const selected = value == null ? "" : String(value);
        const optionsHtml = options.map((optionItem) => {
            const optionValue = typeof optionItem === "string" ? optionItem : String(optionItem?.value || optionItem?.label || "");
            const optionLabel = typeof optionItem === "string" ? optionItem : String(optionItem?.label || optionValue);
            if (!optionValue) {
                return "";
            }
            const isSelected = optionValue === selected ? " selected" : "";
            return `<option value="${escapeHtml(optionValue)}"${isSelected}>${escapeHtml(optionLabel)}</option>`;
        }).join("");
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <select ${attrs} data-param-type="select">
                    <option value="">Seciniz</option>
                    ${optionsHtml}
                </select>
            </div>
        `;
    }

    if (type === "url") {
        const shown = value == null ? "" : String(value);
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <input type="url" ${attrs} data-param-type="url" value="${escapeHtml(shown)}" placeholder="http://hedef/">
            </div>
        `;
    }

    if (type === "ip") {
        const shown = value == null ? "" : String(value);
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <input type="text" ${attrs} data-param-type="ip" value="${escapeHtml(shown)}" placeholder="192.168.1.10">
            </div>
        `;
    }

    if (type === "file") {
        const shown = value == null ? "" : String(value);
        return `
            <div class="dynamic-param-field">
                ${labelBlock}
                <input type="text" ${attrs} data-param-type="file" value="${escapeHtml(shown)}" placeholder="/path/to/file">
            </div>
        `;
    }

    const shown = value == null ? "" : String(value);
    return `
        <div class="dynamic-param-field">
            ${labelBlock}
            <input type="text" ${attrs} data-param-type="string" value="${escapeHtml(shown)}">
        </div>
    `;
}

// Keys of "page list" params (taranacak sayfa listesi) that stand in for the
// whole scan. They render above the target/parameters, split off by a divider,
// to signal "provide a ready list, OR fill in the target and parameters below".
const LIST_SOURCE_PARAM_KEYS = new Set(["scan_list"]);

// Render a whole schema, splitting basic vs advanced params. `valueFor(item)`
// resolves the value to prefill and `attrsFor(item)` returns the data-* string.
function renderDynamicParamGroups(schema, valueFor, attrsFor) {
    const sorted = [...schema].sort((a, b) => Number(a?.sort_order || 100) - Number(b?.sort_order || 100));
    const listSource = [];
    const basic = [];
    const advanced = [];
    for (const item of sorted) {
        const key = String(item?.key || "").trim();
        if (!key) {
            continue;
        }
        if (LIST_SOURCE_PARAM_KEYS.has(key)) {
            listSource.push(item);
        } else if (Number(item?.sort_order || 0) >= ADVANCED_PARAM_SORT_THRESHOLD) {
            advanced.push(item);
        } else {
            basic.push(item);
        }
    }

    let html = "";
    if (listSource.length) {
        const listHtml = listSource.map((item) => dynamicParamFieldHtml(item, valueFor(item), attrsFor(item))).join("");
        html += `
            <div class="dynamic-param-grid dynamic-param-list-source">${listHtml}</div>
            <div class="dynamic-param-divider"><span>ya da</span></div>
        `;
    }

    const basicHtml = basic.map((item) => dynamicParamFieldHtml(item, valueFor(item), attrsFor(item))).join("");
    html += `<div class="dynamic-param-grid">${basicHtml || `<p class="muted" style="margin:0;">Parametre gerekmiyor.</p>`}</div>`;

    if (advanced.length) {
        const advHtml = advanced.map((item) => dynamicParamFieldHtml(item, valueFor(item), attrsFor(item))).join("");
        html += `
            <details class="dynamic-param-advanced">
                <summary>Gelişmiş parametreler (${advanced.length})</summary>
                <div class="dynamic-param-grid" style="margin-top:10px;">${advHtml}</div>
            </details>
        `;
    }
    return html;
}


function renderDynamicIntentParameters(intent) {
    const schema = Array.isArray(intent?.parameter_schema) ? intent.parameter_schema : [];
    if (!nextTestParamsWrap || !nextTestParamsForm) {
        return;
    }

    if (!schema.length) {
        nextTestParamsWrap.style.display = "none";
        nextTestParamsForm.innerHTML = "";
        return;
    }

    nextTestParamsWrap.style.display = "block";
    nextTestParamsForm.innerHTML = renderDynamicParamGroups(
        schema,
        (item) => item?.default,
        (item) => `data-param-key="${escapeHtml(String(item?.key || "").trim())}"`,
    );
}


function collectDynamicIntentParameters(schema) {
    const rows = Array.isArray(schema) ? schema : [];
    if (!rows.length || !nextTestParamsForm) {
        return { values: {}, error: "" };
    }

    const values = {};
    for (const item of rows) {
        const key = String(item?.key || "").trim();
        if (!key) {
            continue;
        }

        const type = normalizeDynamicParamType(item?.type);
        const required = Boolean(item?.required);
        const node = nextTestParamsForm.querySelector(`[data-param-key="${CSS.escape(key)}"]`);
        if (!node) {
            continue;
        }

        if (type === "boolean") {
            values[key] = Boolean(node.checked);
            continue;
        }

        const raw = String(node.value || "").trim();
        if (required && !raw) {
            return { values: {}, error: `${key} zorunlu parametre.` };
        }

        if (!raw) {
            values[key] = raw;
            continue;
        }

        if (type === "number") {
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                return { values: {}, error: `${key} sayisal olmali.` };
            }
            values[key] = parsed;
            continue;
        }

        if (type === "url") {
            values[key] = raw;
            continue;
        }

        if (type === "ip") {
            const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(raw)) {
                return { values: {}, error: `${key} gecerli IPv4 olmali.` };
            }
            values[key] = raw;
            continue;
        }

        if (type === "file" || type === "select" || type === "textarea") {
            values[key] = raw;
            continue;
        }

        if (type === "json" || type === "list" || type === "object" || type === "dict") {
            try {
                values[key] = JSON.parse(raw);
            } catch (_) {
                return { values: {}, error: `${key} gecerli JSON olmali.` };
            }
            continue;
        }

        values[key] = raw;
    }

    return { values, error: "" };
}


function getCurrentStageIntents() {
    return stageSuggestionsByStage[selectedDirectionStepKey] || [];
}


function clearIntentSelectionUi() {
    operationWindowIntents = [];
    operationWindowExecuted = false;
    operationWindowRunning = false;

    if (directionOperationWindow) {
        directionOperationWindow.innerHTML = `
            <h4 style="margin:0 0 8px 0;">${escapeHtml(t("direction.newOperation", "Yeni Islem"))}</h4>
            <p class="muted" style="margin:0;">${escapeHtml(t("direction.waiting", "Yon secimi bekleniyor."))}</p>
        `;
    }

    if (directionProceedBtn) {
        directionProceedBtn.disabled = true;
    }
}


let stepToolIntents = [];

// 3YM: after a step is chosen, present its tools so the operator selects which
// to run; only the selected tools' parameters/scripts are then loaded.
function renderStepToolSelection(intents) {
    stepToolIntents = Array.isArray(intents) ? intents : [];
    const container = directionOperationWindow;
    if (!container) {
        return;
    }
    if (!stepToolIntents.length) {
        container.innerHTML = `<p class="muted" style="margin:0;">Bu adım için kayıtlı araç/script yok.</p>`;
        return;
    }

    const rows = stepToolIntents.map((intent, i) => {
        const name = escapeHtml(String(intent?.script?.display_name || intent?.action || `arac-${i + 1}`));
        const action = escapeHtml(String(intent?.action || ""));
        return `
            <label class="check-chip" style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <input type="checkbox" class="step-tool-check" data-tool-index="${i}" checked>
                <span><strong>${name}</strong> <span class="muted" style="font-size:12px;">(${action})</span></span>
            </label>`;
    }).join("");

    container.innerHTML = `
        <h4 style="margin:0 0 6px 0;">${escapeHtml(t("direction.toolSelect", "Araç Seçimi"))}</h4>
        <p class="muted" style="margin:0 0 10px 0;">Bu adımda çalıştırmak istediğiniz araçları seçin, sonra parametreleri yükleyin.</p>
        <div>${rows}</div>
        <div class="direction-global-actions" style="margin-top:12px;">
            <button id="stepToolLoadBtn" type="button">${escapeHtml(t("direction.loadSelected", "Seçili araçları yükle"))}</button>
        </div>
    `;

    const loadBtn = container.querySelector("#stepToolLoadBtn");
    if (loadBtn) {
        loadBtn.addEventListener("click", () => {
            const checkedIdx = Array.from(container.querySelectorAll(".step-tool-check:checked"))
                .map((cb) => Number(cb.dataset.toolIndex));
            const selected = stepToolIntents.filter((_, i) => checkedIdx.includes(i));
            if (!selected.length) {
                directionNote.innerText = t("direction.pickTool", "En az bir araç seçin.");
                return;
            }
            renderOperationWindowIntents(selected);
        });
    }
}

function renderOperationWindowIntents(intents, options = {}) {
    const container = options.container || directionOperationWindow;
    const showStartButton = options.showStartButton !== false;
    if (!container) {
        return;
    }

    operationWindowIntents = Array.isArray(intents) ? intents : [];
    operationWindowExecuted = false;
    operationWindowRunning = false;

    if (!operationWindowIntents.length) {
        container.innerHTML = `
            <h4 style="margin:0 0 8px 0;">${escapeHtml(t("direction.newOperation", "Yeni Islem"))}</h4>
            <p class="muted" style="margin:0;">AI bu adim icin kayitli gorev/script bulamadi.</p>
        `;
        if (directionProceedBtn) {
            directionProceedBtn.disabled = true;
        }
        return;
    }

    const cardsHtml = operationWindowIntents.map((intent, intentIndex) => {
        const action = String(intent?.action || "").trim();
        const name = String(intent?.script?.display_name || action || `script-${intentIndex + 1}`);
        const itemType = String(intent?.item_type || intent?.script?.item_type || "script").trim().toLowerCase();
        const reason = String(intent?.reason || "Script dogrulama aksiyonu");
        const schema = Array.isArray(intent?.parameter_schema) ? intent.parameter_schema : [];
        const fieldsHtml = renderDynamicParamGroups(
            schema,
            (item) => {
                const key = String(item?.key || "").trim();
                return intent?.parameters?.[key] ?? item?.default;
            },
            (item) => `data-intent-index="${intentIndex}" data-param-key="${escapeHtml(String(item?.key || "").trim())}"`,
        );

        return `
            <div class="next-test-panel op-intent-card" data-intent-index="${intentIndex}">
                <button type="button" class="op-cancel-btn" data-cancel-index="${intentIndex}" title="Bu operasyonu iptal et" aria-label="İptal">×</button>
                <h4 style="margin:0 24px 6px 0;">${escapeHtml(name)}</h4>
                <p class="muted" style="margin:0 0 6px 0;">Action: ${escapeHtml(action)}</p>
                <p class="muted" style="margin:0 0 6px 0;">Type: ${escapeHtml(itemType)}</p>
                <p class="muted" style="margin:0 0 6px 0;">${escapeHtml(reason)}</p>
                ${fieldsHtml}
            </div>
        `;
    }).join("");

    const headerHtml = showStartButton
        ? `<h4 style="margin:0 0 8px 0;">${escapeHtml(t("direction.newOperation", "Yeni Islem"))}</h4>
           <p class="muted" style="margin:0 0 8px 0;">Bu adimdaki tum gorev/scriptler yüklendi. Parametreleri girip baslatabilirsiniz.</p>`
        : "";
    const startBtnHtml = showStartButton
        ? `<div class="direction-global-actions" style="margin-top:12px;">
               <button id="directionStartBtn" type="button">${escapeHtml(t("direction.start", "Baslat"))}</button>
           </div>`
        : "";

    container.innerHTML = `
        ${headerHtml}
        ${cardsHtml}
        ${startBtnHtml}
    `;

    // YZO: when several operations are proposed, lay the cards out two-per-row
    // (50% each) instead of packing them at ~25%. A single card stays full width.
    if (typeof orchestratorOps !== "undefined" && container === orchestratorOps) {
        container.classList.toggle("ops-multi", operationWindowIntents.length > 1);
    }

    if (directionProceedBtn) {
        directionProceedBtn.disabled = true;
    }
}

// Cancel (×) a proposed operation before it runs: mark it cancelled (so the run
// loops skip it) and drop its card. Indices stay stable (no splice), so the
// remaining cards' param collectors keep matching.
function countActiveIntents() {
    return (operationWindowIntents || []).filter((intent) => intent && !intent._cancelled).length;
}

document.addEventListener("click", (event) => {
    const btn = event.target.closest?.(".op-cancel-btn");
    if (!btn) {
        return;
    }
    const idx = Number(btn.getAttribute("data-cancel-index"));
    if (!Number.isInteger(idx) || !operationWindowIntents[idx]) {
        return;
    }
    operationWindowIntents[idx]._cancelled = true;
    const card = btn.closest(".op-intent-card");
    if (card) {
        card.remove();
    }
    if (typeof orchestratorOps !== "undefined" && orchestratorOps) {
        orchestratorOps.classList.toggle("ops-multi", countActiveIntents() > 1);
    }
});


function collectWindowIntentParameters(intent, intentIndex, container = directionOperationWindow) {
    const schema = Array.isArray(intent?.parameter_schema) ? intent.parameter_schema : [];
    const values = {};

    for (const item of schema) {
        const key = String(item?.key || "").trim();
        if (!key) {
            continue;
        }

        const type = normalizeDynamicParamType(item?.type);
        const required = Boolean(item?.required);
        const node = (container || directionOperationWindow)?.querySelector(`[data-intent-index="${intentIndex}"][data-param-key="${CSS.escape(key)}"]`);
        if (!node) {
            continue;
        }

        if (type === "boolean") {
            values[key] = Boolean(node.checked);
            continue;
        }

        const raw = String(node.value || "").trim();
        if (required && !raw) {
            return { values: {}, error: `${intent.action || "action"} > ${key} zorunlu parametre.` };
        }

        if (!raw) {
            values[key] = raw;
            continue;
        }

        if (type === "number") {
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                return { values: {}, error: `${intent.action || "action"} > ${key} sayisal olmali.` };
            }
            values[key] = parsed;
            continue;
        }

        if (type === "url") {
            values[key] = raw;
            continue;
        }

        if (type === "ip") {
            const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
            if (!ipPattern.test(raw)) {
                return { values: {}, error: `${intent.action || "action"} > ${key} gecerli IPv4 olmali.` };
            }
            values[key] = raw;
            continue;
        }

        if (type === "file" || type === "select") {
            values[key] = raw;
            continue;
        }

        if (type === "json" || type === "list" || type === "object" || type === "dict") {
            try {
                values[key] = JSON.parse(raw);
            } catch (_) {
                return { values: {}, error: `${intent.action || "action"} > ${key} gecerli JSON olmali.` };
            }
            continue;
        }

        values[key] = raw;
    }

    return { values, error: "" };
}


// Manual 3-way flow: load the selected step's registered scripts + saved
// parameters WITHOUT any AI. No prior scan is required — the operator picked the
// direction/step, so we just fetch that step's scripts and their parameter schema.
async function fetchStageSuggestions() {
    const feedback = document.getElementById("nextTestFeedback");
    if (!selectedDirection || !selectedDirectionStepKey) {
        if (feedback) {
            feedback.classList.add("error");
            feedback.innerText = "Önce ilerleme yönü ve adım seçin.";
        }
        return { ok: false, intents: [] };
    }

    const target = document.getElementById("target")?.value.trim()
        || latestScanResult?.target
        || "authorized-target";

    if (feedback) {
        feedback.classList.remove("error");
        feedback.innerText = "Adımın kayıtlı script ve parametreleri yükleniyor...";
    }
    appendProcessLog(`${getDirectionLabel(selectedDirection)}: adım scriptleri yükleniyor (manuel, AI yok).`);
    // Refresh the wordlist catalog so the operation form's wordlist selects are current.
    await loadWordlistCatalog();

    try {
        const response = await apiRequest("/validation/step-scripts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                step_key: selectedDirectionStepKey,
                target,
            }),
        });

        const intents = Array.isArray(response.intents) ? response.intents : [];
        stageSuggestionsByStage[selectedDirectionStepKey] = intents;

        if (feedback) {
            feedback.classList.remove("error");
            feedback.innerText = response.summary || "Adımın scriptleri yüklendi.";
        }
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${intents.length} script/parametre hazır.`);
        return { ok: true, intents };
    } catch (error) {
        if (feedback) {
            feedback.classList.add("error");
            feedback.innerText = error.message || "Adım scriptleri yüklenemedi.";
        }
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: script yüklenemedi. ${error.message || "Unknown error"}`);
        return { ok: false, intents: [] };
    }
}


function getLegalAcceptanceKey() {
    const username = currentUser?.username || "anonymous";
    return `${LEGAL_ACCEPTED_PREFIX}:${username}`;
}


function hasAcceptedLegalNotice() {
    return localStorage.getItem(getLegalAcceptanceKey()) === "1";
}


function setAcceptedLegalNotice(value) {
    if (value) {
        localStorage.setItem(getLegalAcceptanceKey(), "1");
    } else {
        localStorage.removeItem(getLegalAcceptanceKey());
    }
}


function rerenderScanToolUiPreserveSelection() {
    const selectedTool = getSelectedToolKey();
    const selectedParams = getCheckedValues("scanParams");
    const selectedPorts = getCheckedValues("scanPorts");
    const manualPorts = document.getElementById("manualPortsInput")?.value || "";

    renderToolOptions();

    if (selectedTool) {
        const toolRadio = Array.from(form.querySelectorAll('input[name="scanTool"]')).find((item) => item.value === selectedTool);
        if (toolRadio) {
            toolRadio.checked = true;
        }
    }

    updateToolDependentOptions();

    form.querySelectorAll('input[name="scanParams"]').forEach((item) => {
        item.checked = selectedParams.includes(item.value);
    });

    form.querySelectorAll('input[name="scanPorts"]').forEach((item) => {
        item.checked = selectedPorts.includes(item.value);
    });

    const manualInput = document.getElementById("manualPortsInput");
    if (manualInput) {
        manualInput.value = manualPorts;
    }

    updateParamSelectionState();
    updatePortSelectionState();
    updateScanButtonState();
}


function resetCurrentTestState() {
    form?.reset();
    rerenderScanToolUiPreserveSelection();

    if (logsDiv) {
        logsDiv.innerHTML = "";
    }
    if (stepOutputs) {
        stepOutputs.innerHTML = "";
    }
    if (resultDiv) {
        resultDiv.innerHTML = t("scan.result.initial", "Tarama sonucu oluştuğunda sağ panelde adım çıktılarına eklenecektir.");
    }
    if (aiOutput && !aiOutput.innerText.trim()) {
        aiOutput.innerText = t("right.ai.initial", "Tarama sonrasında yapay zeka değerlendirmesi burada sabit kalır.");
    }
    if (statusText) {
        statusText.innerText = t("right.status.ready", "Durum: hazır");
    }
    if (currentStep) {
        currentStep.innerText = t("right.current.wait", "Beklemede.");
    }
    if (scanConfigNote) {
        scanConfigNote.innerText = t("scan.selectToolFirst", "Önce bir tarama aracı seçmelisin.");
    }

    selectedDirection = "";
    selectedDirectionStepKey = "";
    directionLocked = false;
    directionCompleted = false;
    directionOperationDetails = null;
    clearIntentSelectionUi();
    renderDirectionState();

    const accepted = hasAcceptedLegalNotice();
    if (legalConsent) {
        legalConsent.checked = accepted;
    }
    if (legalContinue) {
        legalContinue.disabled = !accepted;
    }

    if (accepted) {
        ensureScanTab();
        setActiveOperation("scan");
    } else {
        setActiveOperation("legal");
    }

    updateScanButtonState();
}


async function requestLogin(username, password) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);

    return apiRequest("/auth/login", {
        method: "POST",
        body: formData
    });
}


async function ensureAuthenticated() {
    const meResponse = await fetch("/auth/me", { cache: "no-store" });
    if (meResponse.ok) {
        currentUser = await meResponse.json();
        updateCurrentUserUi();
        completeAuthentication();
        return;
    }

    resetAuthForms();
    showAuthOverlay(true);
    if (loginUsernameInput) {
        loginUsernameInput.focus();
    }

    await new Promise((resolve) => {
        authResolve = resolve;
    });
}


function bindAuthUi() {
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!loginUsernameInput || !loginPasswordInput) {
                return;
            }

            loginSubmit.disabled = true;
            setAuthMessage("Giris yapiliyor...");

            try {
                const username = loginUsernameInput.value.trim();
                const password = loginPasswordInput.value;
                const data = await requestLogin(username, password);

                currentUser = data.user || null;
                updateCurrentUserUi();
                lastLoginPassword = password;

                if (data.must_change_password) {
                    setAuthMessage("Ilk giriste sifre degistirme zorunlu.");
                    loginForm.style.display = "none";
                    if (changePasswordForm) {
                        changePasswordForm.style.display = "flex";
                    }
                } else {
                    completeAuthentication();
                }
            } catch (error) {
                setAuthMessage(error.message || "Giris basarisiz", true);
            } finally {
                loginSubmit.disabled = false;
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!newPasswordInput) {
                return;
            }

            const newPassword = newPasswordInput.value.trim();
            if (newPassword.length < 8) {
                setAuthMessage("Yeni sifre en az 8 karakter olmali", true);
                return;
            }

            if (confirmNewPasswordInput && confirmNewPasswordInput.value.trim() !== newPassword) {
                setAuthMessage("Yeni sifre ve dogrulama alani ayni olmali", true);
                return;
            }

            changePasswordSubmit.disabled = true;
            setAuthMessage("Sifre degistiriliyor...");

            try {
                const payload = await apiRequest("/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        current_password: lastLoginPassword,
                        new_password: newPassword
                    })
                });

                currentUser = payload.user || currentUser;
                updateCurrentUserUi();
                completeAuthentication();
            } catch (error) {
                setAuthMessage(error.message || "Sifre degistirilemedi", true);
            } finally {
                changePasswordSubmit.disabled = false;
            }
        });
    }
}


function setText(selector, key, fallback = "") {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = t(key, fallback);
    }
}


function setAttr(selector, attrName, key, fallback = "") {
    const element = document.querySelector(selector);
    if (element) {
        element.setAttribute(attrName, t(key, fallback));
    }
}


function getLegalNoticeUrl() {
    return `${I18N_BASE_URL}/legal_notice.${currentLanguage}.txt`;
}


function getNextTestCatalogUrl(langCode = currentLanguage) {
    return `${NEXT_TEST_CATALOG_I18N_BASE_URL}.${langCode}.json`;
}


function translateJobStatus(status) {
    if (status === "queued") {
        return t("status.queued", "kuyrukta");
    }

    if (status === "running") {
        return t("status.running", "calisiyor");
    }

    if (status === "finished") {
        return t("status.finished", "tamamlandi");
    }

    return status || "";
}


function closeHeaderPopovers() {
    if (networkSummaryPopover) {
        networkSummaryPopover.hidden = true;
    }
    if (profileMenuPopover) {
        profileMenuPopover.hidden = true;
    }
    if (languageSubmenu) {
        languageSubmenu.hidden = true;
    }
    if (languageMenuToggle) {
        languageMenuToggle.setAttribute("aria-expanded", "false");
    }
}


function applyStaticTranslations() {
    document.title = t("meta.title", "Smart Security Validation Platform (SSVP v1.0)");
    document.documentElement.lang = currentLanguage;

    document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.getAttribute("data-i18n");
        if (!key) {
            return;
        }
        node.textContent = t(key, node.textContent || key);
    });

    setText("#networkSummaryPopover h3", "header.network.title", "Mevcut Network Ozeti");
    setAttr("#networkSummaryToggle", "title", "header.network", "Network Ozeti");
    setAttr("#networkSummaryToggle", "aria-label", "header.network", "Network Ozeti");
    setText(".header-title", "header.mainTitle", "Smart Security Validation Platform");
    setAttr(".header-title", "title", "header.mainTitleHint", "Sadece sana ait veya acikca izinli lab hedeflerinde kullan");
    setAttr("#profileMenuToggle", "title", "menu.user", "Kullanici Menusu");
    setAttr("#profileMenuToggle", "aria-label", "menu.user", "Kullanici Menusu");
    setText(".theme-toggle-label", "menu.theme", "Tema");
    setAttr("#themeToggle", "aria-label", "menu.theme.toggle", "Tema Degistir");
    setText("#languageMenuLabel", "menu.language", "Dil");
    setText("#profileMenuProfile", "menu.profile", "Profil");
    setText("#profileMenuUsers", "menu.users", "Ayarlar");
    setText("#profileMenuNewTest", "menu.newTest", "Yeni Test");
    setText("#profileMenuLogout", "menu.logout", "Cikis Yap");

    setText(".stage-sidebar h3", "sidebar.title", "Islem Sekmeleri");
    setText("#precheckPanel h3", "panel.legal.title", "Risk, Sonuçlar ve Yasal Şartlar");
    setText("#precheckPanel label span", "panel.legal.consent", "Riskleri ve yasal sorumlulugu okudum, onayliyorum.");
    setText("#legalContinue", "panel.legal.continue", "Onayla ve Devam Et");

    setText("#scanForm section:nth-of-type(1) h3", "scan.target.title", "Hedef Girisi");
    setText("#scanForm section:nth-of-type(1) label", "scan.target.label", "Hedefler (coklu IP, aralik, CIDR veya domain)");
    setAttr("#target", "placeholder", "scan.target.placeholder", "Orn: 192.168.1.10, 192.168.1.20-30, 192.168.1.0/24, test.local");
    setText("#scanForm section:nth-of-type(1) p", "scan.target.note", "Virgul, bosluk veya yeni satir ile birden fazla hedef girebilirsin.");

    setText("#scanForm section:nth-of-type(2) h3", "scan.tool.title", "Tarama Araci Sec");
    setText("#scanForm section:nth-of-type(2) p", "scan.tool.note", "Nmap, Masscan veya netdiscover seceneklerinden biriyle devam et.");
    setText("#scanForm section:nth-of-type(3) h3", "scan.params.title", "Parametre Secimi");
    setText("#scanForm section:nth-of-type(3) p", "scan.params.note", "Sectigin araca gore uygun parametreleri isaretle.");
    setText("#scanForm section:nth-of-type(4) h3", "scan.ports.title", "Port Secimi");
    setText("#scanForm section:nth-of-type(4) p", "scan.ports.note", "Portlar checkbox olarak secilir. Bazi araclarda port secimi gerekmeyebilir.");
    setText("#scanForm section:nth-of-type(5) h3", "scan.start.title", "Tarama Baslat");
    setText("#scanBtn", "scan.start.button", "Tarama Baslat");
    setText("#scanForm section:nth-of-type(6) h3", "scan.result.title", "Tarama Sonucu");

    setText("#directionPanel > h3", "direction.title", "Validation Workflow");
    setText("#directionPanel > p.muted", "direction.note.initial", "Tarama tamamlandi. Asama secip AI onerisi yukleyin.");
    setText("[data-direction='scan'] .action-title", "direction.scan", "Tarama");
    setText("[data-direction='scan'] .action-description", "direction.scan.desc", "Tarama odakli dogrulama aksiyonlarini planla.");
    setText("[data-direction='attack'] .action-title", "direction.attack", "Atak");
    setText("[data-direction='attack'] .action-description", "direction.attack.desc", "Yetkili aktif dogrulama aksiyonlarini calistir.");
    setText("[data-direction='remediation'] .action-title", "direction.remediation", "Duzenleme");
    setText("[data-direction='remediation'] .action-description", "direction.remediation.desc", "Duzeltme odakli aksiyonlari calistir.");
    setText("label[for='nextTestCategory']", "direction.category", "Test Kategorisi");
    setText("label[for='nextTestPreset']", "direction.step", "Yapilmak Istenen Adim");
    setText("label[for='nextTestManualName']", "direction.manual", "Parametre JSON (duzenlenebilir)");
    setAttr("#nextTestManualName", "placeholder", "direction.manual.placeholder", '{"scan_params":["service-version"],"scan_ports":["80","443"]}');
    setText("#directionNextBtn", "direction.newOperation", "Yeni Islem");
    setText("#directionProceedBtn", "direction.proceed", "Ilerle");

    setText(".right-rail h2:nth-of-type(1)", "right.tracking", "Islem Takibi");
    setText(".right-rail h2:nth-of-type(2)", "right.ai", "AI Ciktisi");
    setText(".right-rail h2:nth-of-type(3)", "right.outputs", "Adim Ciktilari");
    setText("#exportPdfBtn", "report.exportPdf", "PDF Olarak Disa Aktar");

    if (statusText) {
        const statusNow = statusText.innerText.trim().toLowerCase();
        if (statusNow === "durum: hazir" || statusNow === "status: ready") {
            statusText.innerText = t("right.status.ready", "Durum: hazir");
        }
    }
    if (currentStep) {
        const stepNow = currentStep.innerText.trim().toLowerCase();
        if (stepNow === "beklemede." || stepNow === "waiting.") {
            currentStep.innerText = t("right.current.wait", "Beklemede.");
        }
    }

    if (directionNote) {
        const noteNow = directionNote.innerText.trim().toLowerCase();
        if (noteNow === "yon secimi bekleniyor." || noteNow === "waiting for direction selection.") {
            directionNote.innerText = t("direction.waiting", "Yon secimi bekleniyor.");
        }
    }
}


function refreshOperationTabLabels() {
    operationTabs?.querySelectorAll(".stage-tab").forEach((button) => {
        const prefix = getTabOrderPrefix(button.innerText);
        const op = button.dataset.op;
        if (!prefix) {
            return;
        }
        if (op === "legal") {
            button.innerText = `${prefix}. ${t("tab.legal", "Yasal Sorumluluk")}`;
        }
        if (op === "scan") {
            button.innerText = `${prefix}. ${t("tab.scan", "Tarama")}`;
        }
        if (op === "users") {
            button.innerText = `${prefix}. ${t("tab.users", "Kullanici Yonetimi")}`;
        }
    });

    const directionTab = document.getElementById("directionTab");
    if (directionTab) {
        const prefix = getTabOrderPrefix(directionTab.innerText);
        if (!directionLocked) {
            directionTab.innerText = `${prefix}. ${t("tab.direction", "Ilerleme Yonu")}`;
        }
    }

    const directionResetBtn = document.getElementById("directionResetBtn");
    if (directionResetBtn) {
        directionResetBtn.innerText = t("tab.reset", "Sifirla");
    }
}


function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
}


function normalizeLanguage(value) {
    if (supportedLanguages.some((item) => item.code === value)) {
        return value;
    }
    return "tr";
}


async function loadLanguageResources(langCode) {
    const response = await fetch(`${I18N_BASE_URL}/${langCode}.json`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Language file not found: ${langCode}`);
    }
    return response.json();
}


async function loadLanguageManifest() {
    try {
        const response = await fetch(I18N_MANIFEST_URL, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Manifest fetch failed");
        }

        const data = await response.json();
        supportedLanguages = Array.isArray(data.supported) ? data.supported : [];

        if (supportedLanguages.length === 0) {
            supportedLanguages = [{ code: "tr" }, { code: "en" }];
        }

        const defaultLang = data.default || "tr";
        currentLanguage = supportedLanguages.some((item) => item.code === defaultLang) ? defaultLang : "tr";
    } catch (_) {
        supportedLanguages = [
            { code: "tr" }, { code: "en" }
        ];
        currentLanguage = "tr";
    }
}


function renderLanguageSubmenu() {
    if (!languageSubmenu) {
        return;
    }

    languageSubmenu.innerHTML = supportedLanguages
        .map((item) => {
            const isActive = item.code === currentLanguage;
            const activeClass = isActive ? " active" : "";
            const safeLabel = escapeHtml(
                item.code === "tr"
                    ? t("menu.language.tr", "Türkçe")
                    : item.code === "en"
                        ? t("menu.language.en", "English")
                        : item.label || item.code.toUpperCase()
            );
            return `<button type="button" class="submenu-item${activeClass}" data-lang="${escapeHtml(item.code)}">${safeLabel}</button>`;
        })
        .join("");

    if (currentLanguageLabel) {
        currentLanguageLabel.textContent = currentLanguage.toUpperCase();
    }
}


async function setLanguage(langCode) {
    if (!langCode) {
        return;
    }

    try {
        i18nDictionary = await loadLanguageResources(langCode);
        currentLanguage = langCode;
    } catch (_) {
        if (langCode !== "tr") {
            i18nDictionary = await loadLanguageResources("tr");
            currentLanguage = "tr";
        }
    }

    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    nextTestCatalog = null;
    nextTestCatalogLanguage = "";
    applyStaticTranslations();
    rerenderScanToolUiPreserveSelection();
    refreshOperationTabLabels();
    renderLanguageSubmenu();
    await loadLegalNotice();
    if ((directionPanel?.style.display !== "none" || selectedDirection) && getCurrentStageIntents().length) {
        renderOperationWindowIntents(getCurrentStageIntents());
    }
    await loadNetworkSummary();
}


function applyTheme(themeName) {
    const normalizedTheme = normalizeTheme(themeName);
    const isLight = normalizedTheme === "light";
    document.body.classList.toggle("light-theme", isLight);

    if (themeToggle) {
        themeToggle.classList.toggle("is-light", isLight);
        themeToggle.setAttribute("aria-pressed", String(isLight));
        themeToggle.setAttribute("title", isLight ? t("theme.toDark", "Koyu Temaya Gec") : t("theme.toLight", "Acik Temaya Gec"));
    }

    localStorage.setItem(THEME_STORAGE_KEY, normalizedTheme);
}


function initializeTheme() {
    applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || "dark");
}


function bindHeaderMenus() {
    if (networkSummaryToggle && networkSummaryPopover) {
        networkSummaryToggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const shouldOpen = networkSummaryPopover.hidden;
            closeHeaderPopovers();
            networkSummaryPopover.hidden = !shouldOpen;
        });
    }

    if (profileMenuToggle && profileMenuPopover) {
        profileMenuToggle.addEventListener("click", (event) => {
            event.stopPropagation();
            const shouldOpen = profileMenuPopover.hidden;
            closeHeaderPopovers();
            profileMenuPopover.hidden = !shouldOpen;
        });
    }

    document.addEventListener("click", (event) => {
        const target = event.target;
        const clickedNetwork = networkSummaryMenu?.contains(target);
        const clickedProfile = profileMenuWrap?.contains(target);
        if (!clickedNetwork && !clickedProfile) {
            closeHeaderPopovers();
        }
    });

    if (profileMenuProfile) {
        profileMenuProfile.addEventListener("click", () => {
            closeHeaderPopovers();
            window.location.href = "/panel#profile";
        });
    }

    if (profileMenuUsers) {
        profileMenuUsers.addEventListener("click", () => {
            closeHeaderPopovers();
            window.location.href = "/settings";
        });
    }

    if (profileMenuPanel) {
        profileMenuPanel.addEventListener("click", () => {
            closeHeaderPopovers();
            window.location.href = "/panel";
        });
    }

    if (profileMenuLogout) {
        profileMenuLogout.addEventListener("click", async () => {
            closeHeaderPopovers();
            await fetch("/auth/logout", {
                method: "POST"
            });
            window.location.reload();
        });
    }

    if (profileMenuNewTest) {
        profileMenuNewTest.addEventListener("click", () => {
            closeHeaderPopovers();
            resetCurrentTestState();
            if (!hasAcceptedLegalNotice() && directionNote) {
                directionNote.innerText = t("msg.newTestNeedLegal", "Yeni test için önce yasal onay adımını tamamla.");
            }
        });
    }

    if (pathBreadcrumb) {
        pathBreadcrumb.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-href]");
            if (!link) {
                return;
            }
            event.preventDefault();
            navigateAppPath(link.dataset.href || "");
        });
    }
}


async function loadLegalNotice() {
    if (!legalNoticeText) {
        return;
    }

    legalNoticeText.innerText = t("panel.legal.loading", "Yasal metin yukleniyor...");

    try {
        const response = await fetch(getLegalNoticeUrl(), { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Legal notice fetch failed");
        }

        const text = await response.text();
        legalNoticeText.innerText = text.trim() || t("panel.legal.loading", "Yasal metin yukleniyor...");
    } catch (_) {
        legalNoticeText.innerText = t("panel.legal.loading", "Yasal metin yukleniyor...");
    }
}

const COMMON_15_PORTS = [
    { value: "21", label: "21 (FTP)" },
    { value: "22", label: "22 (SSH)" },
    { value: "23", label: "23 (Telnet)" },
    { value: "25", label: "25 (SMTP)" },
    { value: "53", label: "53 (DNS)" },
    { value: "80", label: "80 (HTTP)" },
    { value: "110", label: "110 (POP3)" },
    { value: "143", label: "143 (IMAP)" },
    { value: "161", label: "161 (SNMP)" },
    { value: "443", label: "443 (HTTPS)" },
    { value: "445", label: "445 (SMB)" },
    { value: "3306", label: "3306 (MySQL)" },
    { value: "3389", label: "3389 (RDP)" },
    { value: "5432", label: "5432 (PostgreSQL)" },
    { value: "8080", label: "8080 (HTTP-Alt)" }
];

const SCAN_TOOL_CONFIG = {
    nmap: {
        labelKey: "scan.tool.nmap.label",
        descriptionKey: "scan.tool.nmap.description",
        params: [
            { value: "service-version", labelKey: "scan.tool.nmap.param.serviceVersion" },
            { value: "default-scripts", labelKey: "scan.tool.nmap.param.defaultScripts" },
            { value: "os-detection", labelKey: "scan.tool.nmap.param.osDetection" },
            { value: "aggressive-scan", labelKey: "scan.tool.nmap.param.aggressiveScan" },
            { value: "syn-scan", labelKey: "scan.tool.nmap.param.synScan" },
            { value: "udp-scan", labelKey: "scan.tool.nmap.param.udpScan" },
            { value: "ping-skip", labelKey: "scan.tool.nmap.param.pingSkip" },
            { value: "dns-skip", labelKey: "scan.tool.nmap.param.dnsSkip" },
            { value: "open-only", labelKey: "scan.tool.nmap.param.openOnly" },
            { value: "packet-reason", labelKey: "scan.tool.nmap.param.packetReason" },
            { value: "traceroute", labelKey: "scan.tool.nmap.param.traceroute" },
            { value: "verbose", labelKey: "scan.tool.nmap.param.verbose" },
            { value: "very-verbose", labelKey: "scan.tool.nmap.param.veryVerbose" },
            { value: "timing-t2", labelKey: "scan.tool.nmap.param.timingT2" },
            { value: "timing-t3", labelKey: "scan.tool.nmap.param.timingT3" },
            { value: "timing-t4", labelKey: "scan.tool.nmap.param.timingT4" },
            { value: "timing-t5", labelKey: "scan.tool.nmap.param.timingT5" },
            { value: "min-rate-1000", labelKey: "scan.tool.nmap.param.minRate1000" },
            { value: "min-rate-5000", labelKey: "scan.tool.nmap.param.minRate5000" },
            { value: "version-intensity-5", labelKey: "scan.tool.nmap.param.versionIntensity5" },
            { value: "version-intensity-9", labelKey: "scan.tool.nmap.param.versionIntensity9" }
        ],
        ports: COMMON_15_PORTS
    },
    masscan: {
        labelKey: "scan.tool.masscan.label",
        descriptionKey: "scan.tool.masscan.description",
        params: [
            { value: "banners", labelKey: "scan.tool.masscan.param.banners" },
            { value: "rate-1000", labelKey: "scan.tool.masscan.param.rate1000" },
            { value: "rate-5000", labelKey: "scan.tool.masscan.param.rate5000" },
            { value: "wait-2", labelKey: "scan.tool.masscan.param.wait2" },
            { value: "wait-5", labelKey: "scan.tool.masscan.param.wait5" },
            { value: "ping-scan", labelKey: "scan.tool.masscan.param.pingScan" },
            { value: "router-mac", labelKey: "scan.tool.masscan.param.routerMac" },
            { value: "randomize-hosts", labelKey: "scan.tool.masscan.param.randomizeHosts" },
            { value: "exclude-arp", labelKey: "scan.tool.masscan.param.excludeArp" },
            { value: "source-port-40000", labelKey: "scan.tool.masscan.param.sourcePort40000" }
        ],
        ports: COMMON_15_PORTS
    },
    netdiscover: {
        labelKey: "scan.tool.netdiscover.label",
        descriptionKey: "scan.tool.netdiscover.description",
        params: [
            { value: "passive", labelKey: "scan.tool.netdiscover.param.passive" },
            { value: "active", labelKey: "scan.tool.netdiscover.param.active" },
            { value: "scan-count-5", labelKey: "scan.tool.netdiscover.param.scanCount5" },
            { value: "scan-count-10", labelKey: "scan.tool.netdiscover.param.scanCount10" },
            { value: "sleep-1", labelKey: "scan.tool.netdiscover.param.sleep1" },
            { value: "sleep-10", labelKey: "scan.tool.netdiscover.param.sleep10" },
            { value: "ignore-home", labelKey: "scan.tool.netdiscover.param.ignoreHome" },
            { value: "enable-file", labelKey: "scan.tool.netdiscover.param.enableFile" },
            { value: "show-count", labelKey: "scan.tool.netdiscover.param.showCount" }
        ],
        ports: []
    }
};

const PARAM_CONFLICT_RULES = {
    nmap: {
        mutexGroups: [
            ["verbose", "very-verbose"],
            ["timing-t2", "timing-t3", "timing-t4", "timing-t5"],
            ["min-rate-1000", "min-rate-5000"],
            ["version-intensity-5", "version-intensity-9"]
        ],
        hardConflicts: [
            ["aggressive-scan", "service-version"],
            ["aggressive-scan", "default-scripts"],
            ["aggressive-scan", "os-detection"],
            ["aggressive-scan", "traceroute"]
        ]
    },
    masscan: {
        mutexGroups: [
            ["rate-1000", "rate-5000"],
            ["wait-2", "wait-5"]
        ],
        hardConflicts: []
    },
    netdiscover: {
        mutexGroups: [
            ["passive", "active"],
            ["scan-count-5", "scan-count-10"],
            ["sleep-1", "sleep-10"]
        ],
        hardConflicts: []
    }
};


function getParamConflictSet(selectedTool, selectedParams) {
    const rules = PARAM_CONFLICT_RULES[selectedTool];
    if (!rules) {
        return new Set();
    }

    const selected = new Set(selectedParams);
    const blocked = new Set();

    for (const group of rules.mutexGroups || []) {
        const selectedInGroup = group.filter((item) => selected.has(item));
        if (selectedInGroup.length > 0) {
            for (const item of group) {
                if (!selected.has(item)) {
                    blocked.add(item);
                }
            }
        }
    }

    for (const [left, right] of rules.hardConflicts || []) {
        if (selected.has(left) && !selected.has(right)) {
            blocked.add(right);
        }
        if (selected.has(right) && !selected.has(left)) {
            blocked.add(left);
        }
    }

    return blocked;
}


function getParamConflictMessages(selectedTool, selectedParams) {
    const rules = PARAM_CONFLICT_RULES[selectedTool];
    if (!rules) {
        return [];
    }

    const selected = new Set(selectedParams);
    const messages = [];

    for (const group of rules.mutexGroups || []) {
        const selectedInGroup = group.filter((item) => selected.has(item));
        if (selectedInGroup.length > 1) {
            messages.push(tf("scan.conflict.group", { items: selectedInGroup.join(", ") }, `Ayni gruptan birden fazla secim yapilamaz: ${selectedInGroup.join(", ")}`));
        }
    }

    for (const [left, right] of rules.hardConflicts || []) {
        if (selected.has(left) && selected.has(right)) {
            messages.push(tf("scan.conflict.hard", { left, right }, `Birlikte kullanilamaz: ${left} + ${right}`));
        }
    }

    return messages;
}


function updateParamSelectionState() {
    const selectedTool = getSelectedToolKey();
    const selectedParams = getCheckedValues("scanParams");
    const blocked = getParamConflictSet(selectedTool, selectedParams);

    form.querySelectorAll('input[name="scanParams"]').forEach((input) => {
        const chip = input.closest(".check-chip");
        const shouldDisable = blocked.has(input.value) && !input.checked;
        input.disabled = shouldDisable;

        if (chip) {
            chip.classList.toggle("disabled", shouldDisable);
        }
    });

    const messages = getParamConflictMessages(selectedTool, selectedParams);
    if (paramConflictNote) {
        if (messages.length > 0) {
            paramConflictNote.innerText = messages.join(" | ");
            paramConflictNote.classList.add("error");
            paramConflictNote.innerText = t("scan.conflict.blocked", "Cakisma nedeniyle bazi parametreler gecici olarak pasiflestirildi.");
            paramConflictNote.classList.remove("error");
        } else {
            paramConflictNote.innerText = "";
            paramConflictNote.classList.remove("error");
        }
    }
}


function setActiveOperation(opName) {
    if (!operationTabs) {
        return;
    }

    operationTabs.querySelectorAll(".stage-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.op === opName);
    });

    document.querySelectorAll("[data-op-panel]").forEach((panel) => {
        panel.style.display = panel.dataset.opPanel === opName ? "block" : "none";
    });

    renderPathNavigation(opName);

    // Self-guards on direction-panel visibility + AI mode + orchestrator state.
    maybeAutoStartOrchestrator();
}


function getActiveOperationFromUi() {
    const active = operationTabs?.querySelector(".stage-tab.active");
    return String(active?.dataset?.op || "legal").trim().toLowerCase() || "legal";
}


function crumbLabel(key) {
    const k = String(key || "").trim().toLowerCase();
    return t("breadcrumb." + k, k.replace(/[-_]+/g, " "));
}

function renderPathNavigation(opName = "") {
    if (!pathBreadcrumb) {
        return;
    }

    const activeOp = String(opName || getActiveOperationFromUi() || "legal").trim().toLowerCase();
    const crumbs = [
        { label: crumbLabel("root"), href: "/" },
        { label: crumbLabel("app"), href: "/app" },
        { label: crumbLabel(activeOp), href: `/app#${activeOp}` },
    ];

    pathBreadcrumb.innerHTML = crumbs
        .map((item, index) => {
            const separator = index > 0 ? "<span>/</span>" : "";
            return `${separator}<a href="${item.href}" data-href="${item.href}">${item.label}</a>`;
        })
        .join("");
}


function navigateAppPath(pathValue) {
    const raw = String(pathValue || "").trim();
    if (!raw) {
        return;
    }

    if (raw === "/app") {
        renderPathNavigation(getActiveOperationFromUi());
        return;
    }

    if (raw.startsWith("/app#")) {
        const opName = raw.slice("/app#".length).trim().toLowerCase();
        if (!opName) {
            return;
        }
        const hasTab = Boolean(operationTabs?.querySelector(`.stage-tab[data-op="${opName}"]`));
        if (hasTab) {
            setActiveOperation(opName);
        }
        return;
    }

    if (raw.startsWith("/")) {
        window.location.href = raw;
    }
}


// Buffer of the HTML for every result produced since the current operation tab
// was opened. When a tab is rolled over (İlerle), this buffer is baked into the
// completed tab's own panel so returning to that tab shows what ran + results.
let currentTabOutputsHtml = [];

function resetCurrentTabOutputs() {
    currentTabOutputsHtml = [];
}

function takeCurrentTabOutputsHtml() {
    const html = currentTabOutputsHtml.join("");
    currentTabOutputsHtml = [];
    return html;
}

function buildStepOutputItemHtml(title, innerHtml) {
    return `
        <p class="step-output-title">${escapeHtml(title)}</p>
        <div class="step-output-text">${innerHtml}</div>
    `;
}


function appendStepOutput(title, text) {
    appendStepOutputHtml(title, `<p class="step-output-text" style="margin:0;">${escapeHtml(String(text ?? ""))}</p>`);
}


function appendStepOutputHtml(title, htmlContent) {
    const itemHtml = buildStepOutputItemHtml(title, htmlContent);
    currentTabOutputsHtml.push(`<div class="step-output-item">${itemHtml}</div>`);

    if (!stepOutputs) {
        return;
    }

    const item = document.createElement("div");
    item.className = "step-output-item";
    item.innerHTML = itemHtml;
    stepOutputs.appendChild(item);
}


// Convenience: format a raw script/tool result object into readable HTML and
// append it as an operation-result card (never a raw JSON dump).
function appendResultOutput(title, result) {
    appendStepOutputHtml(title, formatResultHtml(result));
}


// ---------------------------------------------------------------------------
// Result formatting (Req 5): every result that lands in "İşlem Sonuçları" is
// rendered by shape — summary table, command block, console output, or nested
// tables — instead of a raw JSON string, mirroring how the first nmap scan
// returns a proper table.
// ---------------------------------------------------------------------------
const RESULT_FIELD_LABELS = {
    tool: "Araç",
    target: "Hedef",
    exit_code: "Çıkış kodu",
    line_count: "Satır sayısı",
    action: "Aksiyon",
    status: "Durum",
    duration: "Süre",
};

const RESULT_HANDLED_KEYS = new Set([
    "ok", "tool", "tool_installed", "exit_code", "target", "command",
    "line_count", "output_tail", "error", "cancelled", "status", "scanned_urls_file",
]);

// Download link for a scanned-URL XML list saved under scans/ (Req: keep the big
// list off the page). Served by /download-scan-file.
function scannedUrlsDownloadHtml(fileName) {
    const name = String(fileName || "").trim();
    if (!name) {
        return "";
    }
    const url = `/download-scan-file?file_name=${encodeURIComponent(name)}&language=${encodeURIComponent(currentLanguage)}`;
    return `<p class="result-label">Taranan sayfalar</p><p class="result-detail"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)} — XML indir</a></p>`;
}

function humanizeKey(key) {
    const label = RESULT_FIELD_LABELS[key];
    if (label) {
        return label;
    }
    return String(key || "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
}

function resultSummaryTableHtml(rows) {
    if (!rows.length) {
        return "";
    }
    const body = rows
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
        .join("");
    return `<table class="result-summary">${body}</table>`;
}

function arrayOfObjectsTableHtml(rows) {
    const columns = [];
    for (const row of rows) {
        for (const key of Object.keys(row || {})) {
            if (!columns.includes(key)) {
                columns.push(key);
            }
        }
    }
    if (!columns.length) {
        return `<pre class="result-console">${escapeHtml(JSON.stringify(rows, null, 2))}</pre>`;
    }
    const head = columns.map((c) => `<th>${escapeHtml(humanizeKey(c))}</th>`).join("");
    const body = rows
        .map((row) => {
            const cells = columns
                .map((c) => {
                    const value = row?.[c];
                    const text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "-");
                    return `<td>${escapeHtml(text)}</td>`;
                })
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");
    return `<div class="result-table-wrap"><table class="result-table"><tr>${head}</tr>${body}</table></div>`;
}

function objectTableHtml(obj) {
    const rows = Object.entries(obj)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [humanizeKey(k), typeof v === "object" ? JSON.stringify(v) : String(v)]);
    return resultSummaryTableHtml(rows);
}

function formatResultHtml(result) {
    if (result === null || result === undefined) {
        return `<p class="muted" style="margin:0;">Sonuç verisi yok.</p>`;
    }
    if (Array.isArray(result)) {
        return result.length && typeof result[0] === "object"
            ? arrayOfObjectsTableHtml(result)
            : `<pre class="result-console">${escapeHtml(result.join("\n"))}</pre>`;
    }
    if (typeof result !== "object") {
        return `<pre class="result-console">${escapeHtml(String(result))}</pre>`;
    }

    const parts = [];

    const summaryRows = [];
    if (result.tool) summaryRows.push(["Araç", result.tool]);
    if (result.target) summaryRows.push(["Hedef", result.target]);
    if (typeof result.ok === "boolean") summaryRows.push(["Durum", result.ok ? "Başarılı" : "Başarısız"]);
    if (result.tool_installed === false) summaryRows.push(["Kurulum", "Araç kurulu değil"]);
    if (result.status) summaryRows.push(["Durum", result.status]);
    if (result.exit_code !== undefined && result.exit_code !== null) summaryRows.push(["Çıkış kodu", result.exit_code]);
    if (result.line_count !== undefined && result.line_count !== null) summaryRows.push(["Satır sayısı", result.line_count]);
    if (result.cancelled) summaryRows.push(["Durum", "İptal edildi"]);
    parts.push(resultSummaryTableHtml(summaryRows));

    if (result.command) {
        parts.push(`<p class="result-label">Komut</p><pre class="result-console">${escapeHtml(String(result.command))}</pre>`);
    }

    if (result.error) {
        parts.push(`<div class="result-error">${escapeHtml(String(result.error))}</div>`);
    }

    if (Array.isArray(result.output_tail) && result.output_tail.length) {
        parts.push(`<p class="result-label">Çıktı</p><pre class="result-console">${escapeHtml(result.output_tail.join("\n"))}</pre>`);
    }

    if (result.scanned_urls_file) {
        parts.push(scannedUrlsDownloadHtml(result.scanned_urls_file));
    }

    for (const [key, value] of Object.entries(result)) {
        if (RESULT_HANDLED_KEYS.has(key)) {
            continue;
        }
        if (Array.isArray(value)) {
            if (!value.length) {
                continue;
            }
            parts.push(`<p class="result-label">${escapeHtml(humanizeKey(key))}</p>`);
            parts.push(
                typeof value[0] === "object"
                    ? arrayOfObjectsTableHtml(value)
                    : `<pre class="result-console">${escapeHtml(value.join("\n"))}</pre>`,
            );
        } else if (value && typeof value === "object") {
            if (!Object.keys(value).length) {
                continue;
            }
            parts.push(`<p class="result-label">${escapeHtml(humanizeKey(key))}</p>`);
            parts.push(objectTableHtml(value));
        } else if (value !== undefined && value !== null && value !== "") {
            parts.push(`<p class="result-detail"><b>${escapeHtml(humanizeKey(key))}:</b> ${escapeHtml(String(value))}</p>`);
        }
    }

    const html = parts.filter(Boolean).join("");
    return html || `<pre class="result-console">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
}


// Render a target + parameters block (used for non-executable manual tasks) as
// a small table instead of a JSON dump.
function formatParametersHtml(target, parameters) {
    const rows = [["Hedef", target]];
    for (const [key, value] of Object.entries(parameters || {})) {
        rows.push([humanizeKey(key), typeof value === "object" ? JSON.stringify(value) : String(value)]);
    }
    return resultSummaryTableHtml(rows);
}


function ensureDirectionTab() {
    if (hasDirectionTab || !operationTabs) {
        return;
    }

    const opIndex = operationTabs.querySelectorAll(".stage-tab").length + 1;

    const tabRow = document.createElement("div");
    tabRow.className = "stage-tab-row";
    tabRow.id = "directionTabRow";

    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "stage-tab";
    tabButton.dataset.op = "direction";
    tabButton.id = "directionTab";
    tabButton.innerText = `${opIndex}. ${t("tab.direction", "Ilerleme Yonu")}`;

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "tab-reset-btn";
    resetButton.id = "directionResetBtn";
    resetButton.innerText = t("tab.reset", "Sifirla");
    resetButton.hidden = true;

    tabRow.appendChild(tabButton);
    tabRow.appendChild(resetButton);
    operationTabs.appendChild(tabRow);
    hasDirectionTab = true;
}


function ensureScanTab() {
    if (hasScanTab || !operationTabs) {
        return;
    }

    const opIndex = operationTabs.querySelectorAll(".stage-tab").length + 1;
    const tabRow = document.createElement("div");
    tabRow.className = "stage-tab-row";

    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "stage-tab";
    tabButton.dataset.op = "scan";
    tabButton.innerText = `${opIndex}. ${t("tab.scan", "Tarama")}`;

    tabRow.appendChild(tabButton);
    operationTabs.appendChild(tabRow);
    hasScanTab = true;
}


function getDirectionLabel(directionValue) {
    const key = String(directionValue || "").trim().toLowerCase();
    if (workflowStepByKey[key]) {
        return workflowStepByKey[key].step_name || workflowStepByKey[key].step_key || t("tab.direction", "Ilerleme Yonu");
    }
    if (key === "scan") return t("direction.scan", "Tarama");
    if (key === "attack") return t("direction.attack", "Atak");
    if (key === "remediation") return t("direction.remediation", "Duzenleme");
    return t("tab.direction", "Ilerleme Yonu");
}


function getDirectionSelectionDetails() {
    const categorySelect = document.getElementById("nextTestCategory");
    const stepSelect = document.getElementById("nextTestPreset");

    const categoryLabel = categorySelect?.selectedOptions?.[0]?.textContent?.trim() || t("direction.noCategory", "Kategori secilmedi");
    const stepLabel = stepSelect?.selectedOptions?.[0]?.textContent?.trim() || t("direction.noStep", "Adim secilmedi");

    return {
        categoryLabel,
        stepLabel
    };
}


function getTabOrderPrefix(tabText) {
    const parts = String(tabText || "").split(".");
    const prefix = parts[0]?.trim() || "";
    return /^\d+$/.test(prefix) ? prefix : "";
}


function renderDirectionState() {
    if (!hasDirectionTab) {
        return;
    }

    const tab = document.getElementById("directionTab");
    const resetBtn = document.getElementById("directionResetBtn");
    if (!tab || !resetBtn) {
        return;
    }

    if (!directionLocked) {
        const prefix = getTabOrderPrefix(tab.innerText);
        tab.innerText = prefix ? `${prefix}. ${t("tab.direction", "Ilerleme Yonu")}` : t("tab.direction", "Ilerleme Yonu");
        resetBtn.hidden = true;
        directionSelectionWrap.style.display = "block";
        directionLockedWrap.style.display = "none";
        directionActions.querySelectorAll("[data-direction]").forEach((item) => {
            item.classList.remove("active");
        });
        directionNextBtn.disabled = true;
        directionNextBtn.hidden = false;
        if (directionProceedBtn) {
            // İlerle stays hidden until an operation is selected and run.
            directionProceedBtn.disabled = true;
            directionProceedBtn.hidden = true;
        }
        if (testPlanPanel) {
            testPlanPanel.style.display = selectedDirection ? "block" : "none";
        }
        if (directionOperationWindow) {
            directionOperationWindow.style.display = "none";
            directionOperationWindow.innerHTML = "";
        }
        directionOperationDetails = null;
        directionNote.innerText = t("direction.waiting", "Yon secimi bekleniyor.");
        applyWorkflowMode();
        return;
    }

    const label = getDirectionLabel(selectedDirection);
    const prefix = getTabOrderPrefix(tab.innerText);
    tab.innerText = prefix ? `${prefix}. ${label}` : label;
    resetBtn.hidden = directionCompleted;
    directionSelectionWrap.style.display = "none";
    directionLockedWrap.style.display = "block";
    directionNextBtn.hidden = true;
    if (testPlanPanel) {
        testPlanPanel.style.display = "none";
    }
    if (directionOperationWindow) {
        directionOperationWindow.style.display = "block";
        const categoryText = directionOperationDetails?.categoryLabel || t("direction.noCategory", "Kategori secilmedi");
        const stepText = directionOperationDetails?.stepLabel || t("direction.noStep", "Adim secilmedi");
        directionOperationWindow.innerHTML = `
            <h4 style="margin:0 0 8px 0;">${escapeHtml(t("direction.newOperation", "Yeni Islem"))}</h4>
            <p class="muted" style="margin:0 0 6px 0;">${escapeHtml(t("tab.direction", "Ilerleme Yonu"))}: ${escapeHtml(label)}</p>
            <p class="muted" style="margin:0 0 6px 0;">${escapeHtml(t("direction.category", "Kategori"))}: ${escapeHtml(categoryText)}</p>
            <p class="muted" style="margin:0;">${escapeHtml(t("direction.step", "Adim"))}: ${escapeHtml(stepText)}</p>
        `;
    }
    if (directionProceedBtn) {
        // 3YM: İlerle appears only after an operation is selected and its Başlat
        // run has completed (operationWindowExecuted); hidden once tab completes.
        directionProceedBtn.disabled = !operationWindowExecuted;
        directionProceedBtn.hidden = !operationWindowExecuted || directionCompleted;
    }
    directionLockedText.innerText = tf("direction.locked", { direction: label }, `${label} yonu secildi. Sekme sifirlanana kadar bu secim kilitli kalir.`);
    directionNote.innerText = tf("direction.selected", { direction: label }, `${label} yonu secildi.`);
}


function prepareDirectionPanelForNextOperation() {
    selectedDirection = "";
    selectedDirectionStepKey = "";
    directionLocked = false;
    directionCompleted = false;
    directionOperationDetails = null;
    operationWindowIntents = [];
    operationWindowExecuted = false;
    operationWindowRunning = false;

    const nextTestForm = document.getElementById("nextTestForm");
    if (nextTestForm) {
        nextTestForm.reset();
    }

    const manualWrap = document.getElementById("nextTestManualWrap");
    const feedback = document.getElementById("nextTestFeedback");
    if (manualWrap) {
        manualWrap.style.display = "none";
    }
    if (feedback) {
        feedback.classList.remove("error");
        feedback.innerText = "";
    }

    renderDirectionState();
}


function archiveCompletedDirectionPanel(opId, directionValue, info = {}) {
    if (!stageMain || !opId) {
        return;
    }

    const categoryLabel = info.categoryLabel || "-";
    const operationLabel = info.operationLabel || "-";
    const outputsHtml = info.outputsHtml || "";
    const heading = info.heading || getDirectionLabel(directionValue);

    const panel = document.createElement("section");
    panel.className = "wizard-section operation-panel";
    panel.dataset.opPanel = opId;
    panel.style.display = "none";
    panel.innerHTML = `
        <h3>${escapeHtml(heading)} — Tamamlandı</h3>
        <p class="muted">Aşama / Kategori: ${escapeHtml(categoryLabel)}</p>
        <p class="muted">Operasyon: ${escapeHtml(operationLabel)}</p>
        <p class="muted" style="margin-bottom:12px;">Bu sekme tamamlandı ve kilitlendi. Aşağıda bu işlemde yapılanlar ve sonuçları yer alır.</p>
        <div class="archived-outputs">
            ${outputsHtml || `<p class="muted">Bu işlemde kayıtlı çıktı yok.</p>`}
        </div>
    `;

    stageMain.appendChild(panel);
}


// Roll the current direction/operation tab into a completed, results-bearing tab
// and open a fresh one for the next operation. `tabLabel` is the full label for
// the completed tab, e.g. "Tarama (Nmap)"; `archiveInfo` carries the metadata +
// captured result HTML rendered into the completed tab's own panel (Req 1 & 4).
function rolloverDirectionWorkflowTab(directionValue, tabLabel, archiveInfo = {}) {
    if (!operationTabs) {
        return;
    }

    const currentTab = document.getElementById("directionTab");
    const currentReset = document.getElementById("directionResetBtn");
    const currentOpId = directionPanel.dataset.opPanel || "direction";

    if (currentTab) {
        currentTab.removeAttribute("id");
        const prefix = getTabOrderPrefix(currentTab.innerText);
        const label = String(tabLabel || "").trim() || t("tab.direction", "Ilerleme Yonu");
        currentTab.innerText = prefix ? `${prefix}. ${label}` : label;
    }

    if (currentReset) {
        currentReset.removeAttribute("id");
        currentReset.hidden = true;
    }

    archiveCompletedDirectionPanel(currentOpId, directionValue, archiveInfo);

    const newOpId = `direction-${Date.now()}`;
    const opIndex = operationTabs.querySelectorAll(".stage-tab").length + 1;

    const tabRow = document.createElement("div");
    tabRow.className = "stage-tab-row";

    const tabButton = document.createElement("button");
    tabButton.type = "button";
    tabButton.className = "stage-tab";
    tabButton.dataset.op = newOpId;
    tabButton.id = "directionTab";
    tabButton.innerText = `${opIndex}. Ilerleme Yonu`;

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "tab-reset-btn";
    resetButton.id = "directionResetBtn";
    resetButton.innerText = "Sifirla";
    resetButton.hidden = true;

    tabRow.appendChild(tabButton);
    tabRow.appendChild(resetButton);
    operationTabs.appendChild(tabRow);

    directionPanel.dataset.opPanel = newOpId;
}


function bindStageTabNavigation() {
    const onTabClick = (event) => {
        const resetBtn = event.target.closest(".tab-reset-btn");
        if (resetBtn) {
            if (directionCompleted) {
                directionNote.innerText = t("direction.resetLocked", "Ilerleme tamamlandigi icin sifirlama kapali.");
                return;
            }

            selectedDirection = "";
            directionLocked = false;
            renderDirectionState();
            setActiveOperation("direction");
            return;
        }

        const tab = event.target.closest(".stage-tab");
        if (!tab) {
            return;
        }

        const opName = tab.dataset.op;

        if (precheckPanel.style.display !== "none") {
            return;
        }

        setActiveOperation(opName);
    };

    if (operationTabs) {
        operationTabs.addEventListener("click", onTabClick);
    }
}


function renderToolOptions() {
    if (!toolOptions) {
        return;
    }

    let html = "";

    for (const [key, cfg] of Object.entries(SCAN_TOOL_CONFIG)) {
        const label = t(cfg.labelKey, cfg.label || key);
        const description = t(cfg.descriptionKey, cfg.description || "");
        html += `
            <label class="tool-option">
                <input type="radio" name="scanTool" value="${escapeHtml(key)}">
                <span>
                    <strong>${escapeHtml(label)}</strong>
                    <small>${escapeHtml(description)}</small>
                </span>
            </label>
        `;
    }

    toolOptions.innerHTML = html;
}


function renderCheckboxOptions(container, name, options) {
    if (!container) {
        return;
    }

    if (!options.length) {
        container.innerHTML = `<p class="muted">${escapeHtml(t("scan.noSelection", "Bu arac icin secim yok."))}</p>`;
        return;
    }

    container.innerHTML = options
        .map((item) => {
            const value = typeof item === "string" ? item : item.value;
            const label = typeof item === "string"
                ? item
                : item.labelKey
                    ? t(item.labelKey, item.label || item.value)
                    : item.label;

            return `
                <label class="check-chip">
                    <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
                    <span>${escapeHtml(label)}</span>
                </label>
            `;
        })
        .join("");
}


function renderPortSelection(toolConfig) {
    if (!portOptions) {
        return;
    }

    if (!toolConfig?.ports?.length) {
        portOptions.innerHTML = `<p class="muted">${escapeHtml(t("scan.noPortSelection", "Bu arac icin port secimi kullanilmiyor."))}</p>`;
        return;
    }

    const commonPortHtml = toolConfig.ports
        .map((portItem) => {
            return `
                <label class="check-chip">
                    <input type="checkbox" name="scanPorts" value="${escapeHtml(portItem.value)}">
                    <span>${escapeHtml(portItem.label)}</span>
                </label>
            `;
        })
        .join("");

    portOptions.innerHTML = `
        <label class="check-chip">
            <input type="checkbox" name="scanPorts" value="all">
            <span>${escapeHtml(t("scan.ports.all", "Hepsi"))} (1-65535)</span>
        </label>

        ${commonPortHtml}

        <div class="manual-port-wrap">
            <label for="manualPortsInput">${escapeHtml(t("scan.ports.manual", "Diger portlar (virgulle ayir)"))}</label>
            <input id="manualPortsInput" class="manual-port-input" placeholder="${escapeHtml(t("scan.ports.manual.placeholder", "Orn: 8080,8443,9000"))}" />
            <p id="manualPortsFeedback" class="muted" style="margin:8px 0 0 0;"></p>
        </div>
    `;
}


function getSelectedToolKey() {
    return form.querySelector('input[name="scanTool"]:checked')?.value || "";
}


function getCheckedValues(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value);
}


function parseManualPorts() {
    const manualInput = document.getElementById("manualPortsInput");
    if (!manualInput) {
        return { ports: [], invalid: [] };
    }

    const raw = manualInput.value.trim();
    if (!raw) {
        return { ports: [], invalid: [] };
    }

    const tokens = raw
        .split(/[;,\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

    const ports = [];
    const invalid = [];

    for (const token of tokens) {
        if (!/^\d+$/.test(token)) {
            invalid.push(token);
            continue;
        }

        const numeric = Number(token);
        if (numeric < 1 || numeric > 65535) {
            invalid.push(token);
            continue;
        }

        ports.push(String(numeric));
    }

    return {
        ports: Array.from(new Set(ports)),
        invalid
    };
}


function getFinalPortSelection() {
    const checkedPorts = getCheckedValues("scanPorts");
    if (checkedPorts.includes("all")) {
        return { ports: ["all"], invalid: [] };
    }

    const manualParsed = parseManualPorts();
    const merged = [...checkedPorts.filter((item) => item !== "all"), ...manualParsed.ports];

    return {
        ports: Array.from(new Set(merged)),
        invalid: manualParsed.invalid
    };
}


function updatePortSelectionState() {
    const allPortCheckbox = form.querySelector('input[name="scanPorts"][value="all"]');
    const isAllSelected = Boolean(allPortCheckbox?.checked);

    form.querySelectorAll('input[name="scanPorts"]').forEach((item) => {
        if (item.value === "all") {
            return;
        }

        const chip = item.closest(".check-chip");
        item.disabled = isAllSelected;
        if (chip) {
            chip.classList.toggle("disabled", isAllSelected);
        }
    });

    const manualInput = document.getElementById("manualPortsInput");
    if (manualInput) {
        manualInput.disabled = isAllSelected;
        manualInput.placeholder = isAllSelected
            ? t("scan.ports.manual.disabled", "Hepsi secili oldugu icin manuel port girisi pasif.")
            : t("scan.ports.manual.placeholder", "Orn: 8080,8443,9000");
    }

    const manualFeedback = document.getElementById("manualPortsFeedback");
    if (manualFeedback && isAllSelected) {
        manualFeedback.innerText = t("scan.ports.all.selected", "Hepsi secili: diger port secimleri bypass edilir.");
        manualFeedback.classList.remove("error");
    }
}


function updateToolDependentOptions() {
    const selectedTool = getSelectedToolKey();
    const toolConfig = SCAN_TOOL_CONFIG[selectedTool];

    if (!selectedTool || !toolConfig) {
        renderCheckboxOptions(paramOptions, "scanParams", []);
        renderCheckboxOptions(portOptions, "scanPorts", []);
        scanConfigNote.innerText = t("scan.selectToolFirst", "Once bir tarama araci secmelisin.");
        updateScanButtonState();
        return;
    }

    renderCheckboxOptions(paramOptions, "scanParams", toolConfig.params || []);
    renderPortSelection(toolConfig);
    updateParamSelectionState();
    updatePortSelectionState();

    const toolLabel = t(toolConfig.labelKey, toolConfig.label || selectedTool);
    if (!toolConfig.ports || toolConfig.ports.length === 0) {
        scanConfigNote.innerText = `${toolLabel} ${t("scan.note.noPorts", "secildi. Bu arac port yerine ag host kesfi yapar.")}`;
    } else {
        scanConfigNote.innerText = `${toolLabel} ${t("scan.note.ready", "icin parametre ve port secimlerini tamamlayip taramayi baslatabilirsin.")}`;
    }

    updateScanButtonState();
}


function updateScanButtonState() {
    const targetValue = document.getElementById("target").value.trim();
    const selectedTool = getSelectedToolKey();

    let isValid = Boolean(targetValue && selectedTool);

    const paramConflictMessages = getParamConflictMessages(selectedTool, getCheckedValues("scanParams"));
    if (paramConflictMessages.length > 0) {
        isValid = false;
    }

    if (selectedTool && SCAN_TOOL_CONFIG[selectedTool]?.ports?.length) {
        const finalPortSelection = getFinalPortSelection();
        const feedback = document.getElementById("manualPortsFeedback");

        if (feedback) {
            if (finalPortSelection.invalid.length) {
                feedback.innerText = `Geçersiz port girdileri: ${finalPortSelection.invalid.join(", ")}`;
                feedback.classList.add("error");
            } else {
                feedback.innerText = "";
                feedback.classList.remove("error");
            }
        }

        isValid = isValid && finalPortSelection.ports.length > 0 && finalPortSelection.invalid.length === 0;
    }

    btn.disabled = !isValid;
}


function initializeScanWizard() {
    hasScanTab = Boolean(operationTabs?.querySelector('.stage-tab[data-op="scan"]'));
    renderToolOptions();
    updateToolDependentOptions();
    updateScanButtonState();
    bindStageTabNavigation();
    setActiveOperation("legal");
}


async function loadNetworkSummary() {
    if (!networkSummaryText) {
        return;
    }

    networkSummaryText.innerText = t("header.network.loading", "Network bilgisi yukleniyor...");

    try {
        const response = await fetch("/network-summary", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Network ozeti alinamadi");
        }

        const data = await response.json();
        const rows = [];

        rows.push(`Host: ${data.hostname || "-"}`);
        rows.push(`Gateway: ${data.gateway || "-"}`);

        const interfaces = Array.isArray(data.interfaces) ? data.interfaces : [];
        if (interfaces.length === 0) {
            rows.push(t("network.noActiveInterface", "Aktif IPv4 arayuzu bulunamadi."));
        } else {
            for (const item of interfaces) {
                rows.push(`${item.interface}: ${item.ip} (${item.cidr})`);
            }
        }

        networkSummaryText.innerText = rows.join("\n");
    } catch (_) {
        networkSummaryText.innerText = t("network.unavailable", "Network ozeti su an alinamadi. Yine de manuel hedef girebilirsin.");
    }
}


function getFallbackCatalog() {
    return {
        categories: [
            {
                id: "network-validation",
                label: t("catalog.fallback.networkValidation", "Network Validation"),
                flows: ["test"],
                tests: [
                    t("catalog.fallback.test1", "Açık port doğrulama ve servis gereklilik analizi"),
                    t("catalog.fallback.test2", "Yönetim portları için erişim kuralı doğrulaması"),
                    t("option.other", "Diğer")
                ]
            }
        ]
    };
}


async function ensureNextTestCatalogLoaded() {
    if (nextTestCatalog && nextTestCatalogLanguage === currentLanguage) {
        return;
    }

    try {
        const response = await fetch(getNextTestCatalogUrl(), { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Catalog fetch failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data?.categories || !Array.isArray(data.categories) || data.categories.length === 0) {
            nextTestCatalog = getFallbackCatalog();
            return;
        }

        nextTestCatalog = data;
        nextTestCatalogLanguage = currentLanguage;
    } catch (_) {
        nextTestCatalog = getFallbackCatalog();
        nextTestCatalogLanguage = currentLanguage;
    }
}


function getSelectedCategory(categoryId) {
    const categories = getCatalogCategoriesForDirection(selectedDirection);
    if (!categories.length) {
        return null;
    }

    return categories.find((item) => item.id === categoryId) || categories[0];
}


function getCatalogCategoriesForDirection(direction) {
    if (!nextTestCatalog?.categories?.length) {
        return [];
    }

    if (!direction) {
        return nextTestCatalog.categories;
    }

    const filtered = nextTestCatalog.categories.filter((item) => {
        if (!Array.isArray(item.flows) || item.flows.length === 0) {
            return true;
        }

        return item.flows.includes(direction);
    });

    return filtered.length ? filtered : nextTestCatalog.categories;
}


function populateCategoryOptions(selectedCategoryId = "") {
    const categorySelect = document.getElementById("nextTestCategory");
    const filteredCategories = getCatalogCategoriesForDirection(selectedDirection);
    if (!categorySelect || !filteredCategories.length) {
        return;
    }

    const optionsHtml = filteredCategories
        .map((item) => {
            const selectedAttr = item.id === selectedCategoryId ? " selected" : "";
            return `<option value="${escapeHtml(item.id)}"${selectedAttr}>${escapeHtml(item.label)}</option>`;
        })
        .join("");

    categorySelect.innerHTML = optionsHtml;

    if (!selectedCategoryId && filteredCategories[0]) {
        categorySelect.value = filteredCategories[0].id;
    }
}


function populateTestOptions(categoryId, selectedTest = "") {
    const testSelect = document.getElementById("nextTestPreset");
    const manualWrap = document.getElementById("nextTestManualWrap");
    const manualInput = document.getElementById("nextTestManualName");
    if (!testSelect) {
        return;
    }

    const category = getSelectedCategory(categoryId);
    const tests = [...(category?.tests || [])];
    const otherLabel = t("option.other", "Diğer");

    if (!tests.some((item) => item.trim().toLowerCase() === otherLabel.trim().toLowerCase() || item.trim().toLowerCase() === "other")) {
        tests.push(otherLabel);
    }

    const optionsHtml = tests
        .map((testName) => {
            const normalized = testName.trim().toLowerCase();
            const isOther = normalized === otherLabel.trim().toLowerCase() || normalized === "diğer" || normalized === "other";
            const optionValue = isOther ? "__other__" : testName;
            const selectedAttr = selectedTest === optionValue ? " selected" : "";
            return `<option value="${escapeHtml(optionValue)}"${selectedAttr}>${escapeHtml(testName)}</option>`;
        })
        .join("");
    testSelect.innerHTML = optionsHtml;

    if (!selectedTest && testSelect.options.length > 0) {
        testSelect.selectedIndex = 0;
    }

    const isOtherSelected = testSelect.value === "__other__";
    if (manualWrap) {
        manualWrap.style.display = isOtherSelected ? "block" : "none";
    }

    if (!isOtherSelected && manualInput) {
        manualInput.value = "";
    }
}

directionActions.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-direction]");

    if (!button) {
        return;
    }

    const selectedAction = button.getAttribute("data-direction");
    const requiredRole = roleForStage(selectedAction);
    if (!hasRole(requiredRole)) {
        directionNote.innerText = "Bu yon icin yetkiniz bulunmuyor.";
        return;
    }

    selectedDirection = selectedAction;
    selectedDirectionStepKey = "";

    directionActions.querySelectorAll("[data-direction]").forEach((item) => {
        item.classList.remove("active");
    });
    button.classList.add("active");
    directionNextBtn.disabled = false;
    if (directionProceedBtn) {
        directionProceedBtn.disabled = true;
    }

    if (testPlanPanel) {
        testPlanPanel.style.display = "block";
    }

    renderDirectionCategoryAndSteps();
    const selectedStep = document.getElementById("nextTestPreset")?.selectedOptions?.[0]?.textContent || "-";

    appendProcessLog(`${getDirectionLabel(selectedDirection)}: yon secildi | adim: ${selectedStep}`);
    clearIntentSelectionUi();
    directionNote.innerText = `${getDirectionLabel(selectedDirection)} ${t("direction.selectedLock", "secildi.")}`;
});

directionPanel.addEventListener("change", (event) => {
    const target = event.target;

    if (target.id === "nextTestCategory") {
        renderDirectionCategoryAndSteps();
        return;
    }

    if (target.id === "nextTestPreset") {
        selectedDirectionStepKey = target.value || "";
        directionNextBtn.disabled = !selectedDirectionStepKey;
        if (directionProceedBtn) {
            directionProceedBtn.disabled = true;
        }
        clearIntentSelectionUi();
        return;
    }
});

directionPanel.addEventListener("submit", (event) => {
    const formElement = event.target;
    if (formElement.id !== "nextTestForm") {
        return;
    }

    event.preventDefault();
});

directionNextBtn.addEventListener("click", async () => {
    if (!selectedDirection || !selectedDirectionStepKey) {
        return;
    }

    const feedback = document.getElementById("nextTestFeedback");
    directionOperationDetails = getDirectionSelectionDetails();
    const loadResult = await fetchStageSuggestions();
    if (feedback) {
        if (loadResult.ok) {
            feedback.classList.remove("error");
            feedback.innerText = `${t("direction.selectedStep", "Secilen adim")}: ${directionOperationDetails.categoryLabel} / ${directionOperationDetails.stepLabel}. Kayıtlı script ve parametreler yüklendi.`;
        }
    }

    if (!loadResult.ok) {
        return;
    }

    directionLocked = true;
    directionCompleted = false;
    renderDirectionState();
    // Requirement: after the step is chosen, let the operator pick which tool(s)
    // to run before loading their parameters/scripts.
    renderStepToolSelection(loadResult.intents || []);
});


async function pollValidationExecution(executionId, directionLabel) {
    const safeId = String(executionId || "").trim();
    if (!safeId) {
        throw new Error("Execution id bulunamadi");
    }

    let lastLogIndex = 0;
    const startedAt = Date.now();
    const hardTimeoutMs = 10 * 60 * 1000;

    while (true) {
        if (Date.now() - startedAt > hardTimeoutMs) {
            throw new Error("Execution timeout");
        }

        const state = await apiRequest(`/validation/executions/${encodeURIComponent(safeId)}`, { cache: "no-store" });
        const logs = Array.isArray(state.logs) ? state.logs : [];

        while (lastLogIndex < logs.length) {
            const line = logs[lastLogIndex];
            appendProcessLog(`${directionLabel}: ${line?.message || ""}`);
            lastLogIndex += 1;
        }

        if (state.status === "finished" || state.status === "cancelled") {
            return state;
        }
        if (state.status === "failed") {
            throw new Error(state.error || "Execution failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 700));
    }
}


async function executeOperationWindowIntents() {
    if (!selectedDirection || !selectedDirectionStepKey) {
        directionNote.innerText = t("direction.selectFirst", "Lutfen once ilerleme yonu sec.");
        return;
    }

    if (!operationWindowIntents.length) {
        directionNote.innerText = "Baslatmak icin bu adimda en az bir gorev/script olmali.";
        return;
    }

    if (operationWindowRunning) {
        return;
    }

    const resolvedTarget = latestScanResult?.target || document.getElementById("target")?.value.trim() || "authorized-target";
    const userApproved = await requestActionApproval({
        title: "Islem Onayi",
        message: `${operationWindowIntents.length} adet gorev/script backend Tool Runner ile calistirilacak.\n\nTarget: ${resolvedTarget}`,
    });
    if (!userApproved) {
        directionNote.innerText = "Islem kullanici tarafindan onaylanmadi.";
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: kullanici onayi verilmedi.`);
        return;
    }

    const prepared = [];
    for (let i = 0; i < operationWindowIntents.length; i += 1) {
        const intent = operationWindowIntents[i];
        if (intent?._cancelled) {
            continue;
        }
        const dynamicParamData = collectWindowIntentParameters(intent, i);
        if (dynamicParamData.error) {
            directionNote.innerText = dynamicParamData.error;
            return;
        }

        prepared.push({
            intent,
            parameters: {
                ...(intent?.parameters || {}),
                ...dynamicParamData.values,
            },
        });
    }
    if (!prepared.length) {
        directionNote.innerText = "Tüm operasyonlar iptal edildi. Çalıştırılacak işlem yok.";
        return;
    }

    operationWindowRunning = true;
    // Fresh capture window for this tab's results (Req 4).
    resetCurrentTabOutputs();
    const startBtn = directionOperationWindow?.querySelector("#directionStartBtn");
    if (startBtn) {
        startBtn.disabled = true;
    }

    try {
        // Manual 3YM flow (Req 2): NO AI interaction at all. We only run the
        // registered scripts, track progress, and render their results — no AI
        // evaluation and no evidence-analysis calls.
        for (const { intent, parameters } of prepared) {
            const opLabel = String(intent?.script?.display_name || intent.action || "-");
            const executable = Boolean(intent?.executable ?? (String(intent?.item_type || "script").toLowerCase() === "script"));
            if (!executable) {
                appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${opLabel} manuel gorev olarak kaydedildi.`);
                appendStepOutputHtml(
                    `${getDirectionLabel(selectedDirection)} — Manuel Görev (${opLabel})`,
                    formatParametersHtml(resolvedTarget, parameters),
                );
                continue;
            }

            const payload = {
                step_key: intent.step_key || selectedDirectionStepKey,
                action: intent.action,
                target: resolvedTarget,
                reason: intent.reason || "Stage execution requested by user",
                parameters,
                approved: true,
            };

            appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${opLabel} calistiriliyor.`);
            const executionStart = await apiRequest("/validation/execute-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const executionState = await pollValidationExecution(executionStart.execution_id, getDirectionLabel(selectedDirection));

            const execResult = executionState?.result || {};
            const execOutput = execResult?.output || {};
            const scriptResult = execOutput.result;

            if (scriptResult && typeof scriptResult === "object") {
                appendResultOutput(`${getDirectionLabel(selectedDirection)} — ${opLabel}`, scriptResult);
            } else {
                appendResultOutput(`${getDirectionLabel(selectedDirection)} — ${opLabel}`, {
                    action: intent.action || "-",
                    status: execResult.status || "completed",
                });
            }
            appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${opLabel} tamamlandi (${execResult.status || "completed"}).`);
        }

        operationWindowExecuted = true;
        // Replace the operation form with an inline "Yapılanlar + Sonuçlar"
        // summary in the current tab (same as YZO), so the run + its results
        // stay visible here until İlerle rolls them into a completed tab.
        renderRunSummaryInto(directionOperationWindow, prepared.map((p) => p.intent));
        directionNote.innerText = "Tum gorev/scriptler tamamlandi. Ilerle ile sonraki asamaya gecebilirsiniz.";
        if (directionProceedBtn) {
            // Operation ran: reveal İlerle so the user can advance to a new tab.
            directionProceedBtn.disabled = false;
            directionProceedBtn.hidden = false;
        }
    } catch (error) {
        directionNote.innerText = error.message || "Validation action calistirilamadi.";
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: calistirma hatasi. ${error.message || "Unknown error"}`);
        if (startBtn) {
            startBtn.disabled = false;
        }
    } finally {
        operationWindowRunning = false;
    }
}


if (directionOperationWindow) {
    directionOperationWindow.addEventListener("click", async (event) => {
        const button = event.target.closest("#directionStartBtn");
        if (!button) {
            return;
        }
        if (orchestratorActive) {
            // In orchestrator mode the AI proposal is run via its own approve
            // button; ignore the manual start button rendered in the window.
            return;
        }
        await executeOperationWindowIntents();
    });
}


// ---------------------------------------------------------------------------
// AI Orchestrator: the local LLM drives the workflow one turn at a time. Each
// turn it proposes the next operations + parameters (shown as editable inputs);
// the user approves, tweaks, suggests, or redirects, then results feed back and
// the next turn is requested. A busy overlay blocks new operations while the AI
// works or a script runs, and any running script can be stopped.
// ---------------------------------------------------------------------------
const orchestratorContainer = document.getElementById("orchestratorContainer");
const orchestratorOps = document.getElementById("orchestratorOps");
const orchestratorPlan = document.getElementById("orchestratorPlan");
const orchestratorInstruction = document.getElementById("orchestratorInstruction");
const orchestratorSuggestPanel = document.getElementById("orchestratorSuggestPanel");
const orchestratorApproveBtn = document.getElementById("orchestratorApproveBtn");
const orchestratorProceedBtn = document.getElementById("orchestratorProceedBtn");
const orchestratorSuggestBtn = document.getElementById("orchestratorSuggestBtn");
const orchestratorRedirect = document.getElementById("orchestratorRedirect");
const orchestratorRedirectOp = document.getElementById("orchestratorRedirectOp");
const orchestratorExitBtn = document.getElementById("orchestratorExitBtn");
const orchestratorNote = document.getElementById("orchestratorNote");
const orchestratorStageBadge = document.getElementById("orchestratorStageBadge");
const operationBusy = document.getElementById("operationBusy");
const aiBusyTitle = document.getElementById("aiBusyTitle");
const aiBusyMessage = document.getElementById("aiBusyMessage");
const aiBusyStopBtn = document.getElementById("aiBusyStopBtn");

let orchestratorActive = false;
let orchestratorBusy = false;
let orchestratorStopRequested = false;
let orchestratorRunningExecutionId = "";
let orchestratorAbort = null;
let orchestratorStage = "";
let orchestratorCatalog = [];
let workflowMode = "manual";
let aiProvider = "local";

function aiWorkingMessage() {
    return aiProvider === "cloud"
        ? t("orchestrate.busyCloud", "Bulut yapay zeka calisiyor, lutfen bekleyin.")
        : t("orchestrate.busyLocal", "Yerel model calisiyor, bu birkac dakika surebilir.");
}

const STAGE_LABELS = { scan: "Tarama", attack: "Atak", remediation: "Düzenleme" };

function stageLabel(stage) {
    const key = String(stage || "").trim().toLowerCase();
    return STAGE_LABELS[key] || "";
}

// Show the active stage in parentheses on the direction tab, e.g. "İlerleme Yönü (Tarama)".
function setDirectionTabStage(stage) {
    const tab = document.getElementById("directionTab");
    if (!tab) {
        return;
    }
    const prefix = getTabOrderPrefix(tab.innerText);
    const base = t("tab.direction", "Ilerleme Yonu");
    const label = stageLabel(stage);
    const text = label ? `${base} (${label})` : base;
    tab.innerText = prefix ? `${prefix}. ${text}` : text;
}

function applyWorkflowMode() {
    const aiMode = workflowMode === "ai";
    // Manual (3YM) is fully AI-free: hide the right-rail "AI Çıktısı" section
    // (heading + output box) entirely; it only exists for the YZO/scan AI flow.
    const aiHeading = document.querySelector(".right-rail h2:nth-of-type(2)");
    if (aiHeading) {
        aiHeading.style.display = aiMode ? "" : "none";
    }
    if (aiOutput) {
        aiOutput.style.display = aiMode ? "" : "none";
    }
    if (directionActions) {
        directionActions.style.display = aiMode ? "none" : "grid";
    }
    // In AI mode the direction cards are replaced by a single "start AI" affordance,
    // shown only when the orchestrator is not already open.
    const restartWrap = document.getElementById("aiOrchestrateRestartWrap");
    if (restartWrap) {
        restartWrap.style.display = aiMode && !orchestratorActive ? "block" : "none";
    }
    if (aiMode && directionNextBtn && !directionLocked) {
        directionNextBtn.hidden = true;
    }
    // Leaving AI mode while the orchestrator is open returns to manual selection.
    if (!aiMode && orchestratorActive) {
        exitOrchestrator();
    }
}

// Auto-open the orchestrator when the user lands on the direction panel in AI
// mode (Requirement: don't ask with a button, open the orchestrator directly).
function maybeAutoStartOrchestrator() {
    if (workflowMode !== "ai") {
        return;
    }
    if (orchestratorActive || orchestratorBusy || directionLocked) {
        return;
    }
    if (!directionPanel || directionPanel.style.display === "none") {
        return;
    }
    startOrchestrator();
}

async function loadWorkflowMode() {
    try {
        const cfg = await apiRequest("/settings/config");
        const mode = String(cfg?.workflow?.mode || "manual").toLowerCase();
        workflowMode = mode === "ai" ? "ai" : "manual";
        aiProvider = String(cfg?.ai?.provider || "local").toLowerCase() === "cloud" ? "cloud" : "local";
    } catch (_) {
        workflowMode = "manual";
    }
    applyWorkflowMode();
}

function setOrchestratorNote(text, isError = false) {
    if (!orchestratorNote) {
        return;
    }
    orchestratorNote.classList.toggle("error", Boolean(isError));
    orchestratorNote.innerText = String(text || "");
}

function showAiBusy(title, message, allowStop = true) {
    if (!operationBusy) {
        return;
    }
    if (aiBusyTitle) {
        aiBusyTitle.innerText = title || t("orchestrate.busyTitle", "Yapay zeka calisiyor...");
    }
    if (aiBusyMessage) {
        aiBusyMessage.innerText = message || t("orchestrate.busyMessage", "Islem devam ederken lutfen yeni bir islem baslatmayin.");
    }
    if (aiBusyStopBtn) {
        aiBusyStopBtn.disabled = !allowStop;
    }
    operationBusy.hidden = false;
}

function hideAiBusy() {
    if (operationBusy) {
        operationBusy.hidden = true;
    }
}

function resolveOperationTarget() {
    return latestScanResult?.target || document.getElementById("target")?.value.trim() || "authorized-target";
}

function startOrchestrator() {
    if (orchestratorBusy) {
        return;
    }
    orchestratorActive = true;
    orchestratorStopRequested = false;
    operationWindowIntents = [];
    operationWindowExecuted = false;

    if (directionSelectionWrap) {
        directionSelectionWrap.style.display = "none";
    }
    if (testPlanPanel) {
        testPlanPanel.style.display = "none";
    }
    if (directionNextBtn) {
        directionNextBtn.hidden = true;
    }
    if (directionProceedBtn) {
        directionProceedBtn.hidden = true;
    }
    if (orchestratorProceedBtn) {
        orchestratorProceedBtn.hidden = true;
    }
    setOrchestratorInteractionVisible(true);
    if (directionLockedWrap) {
        directionLockedWrap.style.display = "none";
    }
    if (orchestratorContainer) {
        orchestratorContainer.style.display = "block";
    }
    // Refresh wordlist catalog so operation forms show current wordlists (the AI
    // planning round-trip gives this ample time to complete before render).
    loadWordlistCatalog();
    orchestratorTurn("", "");
}

function exitOrchestrator() {
    orchestratorActive = false;
    orchestratorStopRequested = true;
    orchestratorRunningExecutionId = "";
    if (orchestratorContainer) {
        orchestratorContainer.style.display = "none";
    }
    if (orchestratorOps) {
        orchestratorOps.innerHTML = "";
    }
    if (orchestratorProceedBtn) {
        orchestratorProceedBtn.hidden = true;
    }
    operationWindowIntents = [];
    hideAiBusy();
    setDirectionTabStage("");
    if (workflowMode === "ai") {
        // Stay in AI mode: show the "start AI" affordance again.
        if (directionSelectionWrap) {
            directionSelectionWrap.style.display = "block";
        }
        applyWorkflowMode();
    } else {
        renderDirectionState();
    }
}

async function orchestratorTurn(userInstruction, preferredStage, preferredAction) {
    if (!orchestratorActive || orchestratorBusy) {
        return;
    }
    orchestratorBusy = true;
    orchestratorStopRequested = false;
    orchestratorAbort = new AbortController();
    setOrchestratorControlsEnabled(false);
    // A user-picked operation opens directly (no slow AI selection round-trip).
    const directRedirect = Boolean(preferredAction);
    showAiBusy(
        directRedirect
            ? t("orchestrate.openingOp", "Seçilen operasyon açılıyor...")
            : t("orchestrate.planningTitle", "Yapay zeka bir sonraki islemi planliyor..."),
        aiWorkingMessage(),
        true,
    );
    appendProcessLog(directRedirect
        ? `AI Orkestrator: '${preferredAction}' operasyonuna yönlendiriliyor.`
        : "AI Orkestrator: sonraki islem plani isteniyor.");

    try {
        const data = await apiRequest("/validation/ai-orchestrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                target: resolveOperationTarget(),
                user_instruction: String(userInstruction || ""),
                preferred_stage: String(preferredStage || ""),
                preferred_action: String(preferredAction || ""),
            }),
            signal: orchestratorAbort.signal,
        });
        hideAiBusy();
        renderOrchestratorProposal(data);
    } catch (error) {
        hideAiBusy();
        if (error?.name === "AbortError" || orchestratorStopRequested) {
            setOrchestratorNote(t("orchestrate.stopped", "Islem durduruldu."));
            appendProcessLog("AI Orkestrator: planlama durduruldu.");
        } else {
            setOrchestratorNote(error?.message || t("orchestrate.planError", "Yapay zeka plani alinamadi."), true);
            appendProcessLog(`AI Orkestrator: plan hatasi. ${error?.message || "Bilinmeyen hata"}`);
        }
    } finally {
        orchestratorBusy = false;
        orchestratorAbort = null;
        setOrchestratorControlsEnabled(true);
    }
}

function redirectOpLabel(item) {
    const notInstalled = item.installed ? "" : " (kurulu değil)";
    return `<option value="${escapeHtml(String(item.action || ""))}">${escapeHtml(String(item.name || item.action || ""))}${notInstalled}</option>`;
}

// Render the operation picker. With a stage filter it lists only that stage's
// operations; without one it groups all operations by stage.
function renderRedirectOperationOptions(stageFilter) {
    if (!orchestratorRedirectOp) {
        return;
    }
    const filter = String(stageFilter || "").trim();
    if (filter) {
        const ops = orchestratorCatalog.filter((c) => String(c?.stage || "").trim() === filter);
        let html = `<option value="">${escapeHtml(stageLabel(filter) || filter)} — operasyon seçin…</option>`;
        html += ops.map(redirectOpLabel).join("");
        orchestratorRedirectOp.innerHTML = html;
        return;
    }

    const byStage = {};
    for (const item of orchestratorCatalog) {
        const st = String(item?.stage || "").trim();
        (byStage[st] = byStage[st] || []).push(item);
    }
    let html = `<option value="">Operasyon Seç</option>`;
    for (const st of ["scan", "attack", "remediation"]) {
        const ops = byStage[st];
        if (!ops || !ops.length) {
            continue;
        }
        html += `<optgroup label="${escapeHtml(stageLabel(st) || st)}">${ops.map(redirectOpLabel).join("")}</optgroup>`;
    }
    orchestratorRedirectOp.innerHTML = html;
}

function populateRedirectOperations(catalog) {
    orchestratorCatalog = Array.isArray(catalog) ? catalog : [];
    renderRedirectOperationOptions(orchestratorRedirect ? orchestratorRedirect.value : "");
}

function renderOrchestratorProposal(data) {
    const plan = String(data?.plan || data?.summary || "").trim();
    const stage = String(data?.stage || "").trim();
    const intents = Array.isArray(data?.intents) ? data.intents : [];
    const done = Boolean(data?.done);

    orchestratorStage = stage;
    // A fresh proposal returns us to approve mode: hide the İlerle button and
    // bring back the suggestion/redirect areas for review.
    if (orchestratorProceedBtn) {
        orchestratorProceedBtn.hidden = true;
    }
    setOrchestratorInteractionVisible(true);
    // Keep the redirect operation picker in sync with the current catalog.
    populateRedirectOperations(Array.isArray(data?.catalog) ? data.catalog : []);

    if (orchestratorPlan) {
        orchestratorPlan.innerText = plan || t("orchestrate.noPlan", "Yapay zeka plan uretemedi.");
    }
    const label = stageLabel(stage);
    if (orchestratorStageBadge) {
        if (label) {
            orchestratorStageBadge.style.display = "inline-block";
            orchestratorStageBadge.innerText = label;
        } else {
            orchestratorStageBadge.style.display = "none";
        }
    }
    // Reflect the active stage in the direction tab, e.g. "İlerleme Yönü (Atak)".
    setDirectionTabStage(stage);
    if (plan) {
        appendAiEvaluation(t("orchestrate.aiTitle", "AI Orkestrator Plani"), plan);
    }

    if (done || !intents.length) {
        operationWindowIntents = [];
        if (orchestratorOps) {
            orchestratorOps.innerHTML = "";
        }
        if (orchestratorApproveBtn) {
            orchestratorApproveBtn.disabled = true;
        }
        setOrchestratorNote(t("orchestrate.done", "Yapay zeka bu hedef icin yapilacak baska islem gormuyor. Oneri verebilir veya cikabilirsiniz."));
        return;
    }

    // Reuse the intent renderer (editable param inputs) into the orchestrator's
    // own operations container; no manual start button here.
    renderOperationWindowIntents(intents, { container: orchestratorOps, showStartButton: false });
    if (orchestratorApproveBtn) {
        orchestratorApproveBtn.disabled = false;
    }
    setOrchestratorNote(t("orchestrate.review", "Parametreleri gozden gecirip Onayla ve Calistir'a basin ya da oneri/yonlendirme verin."));
}

async function runOrchestratorProposal() {
    if (!orchestratorActive || orchestratorBusy) {
        return;
    }
    if (!operationWindowIntents.length) {
        setOrchestratorNote(t("orchestrate.nothingToRun", "Calistirilacak bir islem yok."), true);
        return;
    }

    const resolvedTarget = resolveOperationTarget();
    const prepared = [];
    for (let i = 0; i < operationWindowIntents.length; i += 1) {
        const intent = operationWindowIntents[i];
        if (intent?._cancelled) {
            continue;
        }
        const collected = collectWindowIntentParameters(intent, i, orchestratorOps);
        if (collected.error) {
            setOrchestratorNote(collected.error, true);
            return;
        }
        prepared.push({ intent, parameters: { ...(intent?.parameters || {}), ...collected.values } });
    }
    if (!prepared.length) {
        setOrchestratorNote(t("orchestrate.allCancelled", "Tüm operasyonlar iptal edildi. Öneri/yönlendirme verebilir veya çıkabilirsiniz."), true);
        return;
    }

    orchestratorBusy = true;
    orchestratorStopRequested = false;
    setOrchestratorControlsEnabled(false);
    // Approve+run hides the suggestion/redirect areas; they return on the next
    // proposal (via renderOrchestratorProposal).
    setOrchestratorInteractionVisible(false);
    // Fresh capture window for this turn's tab results (Req 4).
    resetCurrentTabOutputs();

    try {
        for (const { intent, parameters } of prepared) {
            if (orchestratorStopRequested) {
                break;
            }

            const opLabel = String(intent?.script?.display_name || intent.action || "-");
            const executable = Boolean(intent?.executable ?? (String(intent?.item_type || "script").toLowerCase() === "script"));
            if (!executable) {
                appendStepOutputHtml(`AI Orkestrator — Manuel Görev (${opLabel})`, formatParametersHtml(resolvedTarget, parameters));
                continue;
            }

            showAiBusy(
                t("orchestrate.runningTitle", "Islem calistiriliyor..."),
                `${intent.action} — ${resolvedTarget}`,
                true,
            );
            appendProcessLog(`AI Orkestrator: ${intent.action} calistiriliyor.`);

            // AI Orchestrator operations live in the independent ai_operations
            // catalog and run through their own endpoint (operation_key based),
            // fully separate from the manual step_items execute-intent path.
            const isAiOperation = Boolean(intent.ai_operation || intent.operation_key);
            const executionStart = isAiOperation
                ? await apiRequest("/validation/ai-execute-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        operation_key: intent.operation_key || intent.action,
                        target: resolvedTarget,
                        reason: intent.reason || "AI orchestrator operation",
                        parameters,
                        approved: true,
                    }),
                })
                : await apiRequest("/validation/execute-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        step_key: intent.step_key || selectedDirectionStepKey,
                        action: intent.action,
                        target: resolvedTarget,
                        reason: intent.reason || "AI orchestrator step",
                        parameters,
                        approved: true,
                    }),
                });

            orchestratorRunningExecutionId = executionStart.execution_id;
            let executionState;
            try {
                executionState = await pollValidationExecution(executionStart.execution_id, "AI Orkestrator");
            } finally {
                orchestratorRunningExecutionId = "";
            }

            const execResult = executionState?.result || {};
            const execOutput = execResult?.output || {};

            if (executionState?.status === "cancelled" || execResult?.status === "cancelled") {
                appendStepOutput(`AI Orkestrator — Durduruldu (${opLabel})`, t("orchestrate.stopped", "Islem durduruldu."));
                orchestratorStopRequested = true;
                break;
            }

            const scriptResult = execOutput.result;
            if (scriptResult && typeof scriptResult === "object") {
                appendResultOutput(`AI Orkestrator — ${opLabel}`, scriptResult);
            } else {
                appendResultOutput(`AI Orkestrator — ${opLabel}`, {
                    action: intent.action || "-",
                    status: execResult.status || "completed",
                });
            }

            const guidance = execOutput.ai_guidance || {};
            const evaluation = guidance.evaluation || {};
            if (guidance.summary || evaluation.summary) {
                const riskLabel = String(guidance.risk_level || evaluation.risk_level || "").trim();
                const findings = Array.isArray(evaluation.findings) ? evaluation.findings.filter(Boolean) : [];
                const nextSteps = Array.isArray(evaluation.recommended_next_steps) ? evaluation.recommended_next_steps.filter(Boolean) : [];
                const lines = [];
                if (riskLabel) {
                    lines.push(`Risk seviyesi: ${riskLabel}`);
                }
                lines.push(String(guidance.summary || evaluation.summary || "").trim());
                if (findings.length) {
                    lines.push("Bulgular:");
                    findings.forEach((item) => lines.push(`- ${String(item).trim()}`));
                }
                if (nextSteps.length) {
                    lines.push("Onerilen sonraki adimlar:");
                    nextSteps.forEach((item) => lines.push(`- ${String(item).trim()}`));
                }
                appendAiEvaluation(`Script Degerlendirmesi (${intent.action})`, lines.join("\n"));
            }
        }
    } catch (error) {
        setOrchestratorNote(error?.message || t("orchestrate.runError", "Islem calistirilamadi."), true);
        appendProcessLog(`AI Orkestrator: calistirma hatasi. ${error?.message || "Bilinmeyen hata"}`);
        hideAiBusy();
        orchestratorBusy = false;
        setOrchestratorControlsEnabled(true);
        return;
    }

    hideAiBusy();
    orchestratorBusy = false;
    setOrchestratorControlsEnabled(true);

    if (orchestratorStopRequested) {
        setOrchestratorNote(t("orchestrate.stoppedContinue", "Islem durduruldu. Oneri verip devam edebilir veya cikabilirsiniz."));
        return;
    }

    // After an approved run we replace the parameter inputs with an inline
    // "what ran + results" summary and then WAIT: no auto-advance to a new tab
    // and no automatic AI planning request. The user must click "İlerle" to roll
    // over and ask the AI for the next operation.
    if (orchestratorActive) {
        renderOrchestratorRunSummary(prepared.map((p) => p.intent));
        if (orchestratorApproveBtn) {
            orchestratorApproveBtn.disabled = true;
        }
        if (orchestratorProceedBtn) {
            orchestratorProceedBtn.hidden = false;
        }
        setOrchestratorNote(t(
            "orchestrate.runDoneProceed",
            "İşlem tamamlandı. Sonraki operasyona geçmek için İlerle'ye basın.",
        ));
    }
}


// Show, inside a container, exactly what ran in this turn and the results it
// produced (the same formatted cards that go to İşlem Sonuçları). Reads the
// current tab's output buffer without clearing it — İlerle takes it. Used by
// both YZO (orchestratorOps) and 3YM (directionOperationWindow).
function renderRunSummaryInto(container, intents) {
    if (!container) {
        return;
    }
    const names = (intents || [])
        .map((i) => String(i?.script?.display_name || i?.action || "").trim())
        .filter(Boolean);
    const doneHtml = names.length
        ? `<ul class="orchestrator-done-list">${names.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
        : `<p class="muted" style="margin:0;">-</p>`;
    const resultsHtml = currentTabOutputsHtml.join("") || `<p class="muted" style="margin:0;">Sonuç üretilmedi.</p>`;
    container.innerHTML = `
        <div class="orchestrator-summary">
            <p class="result-label" style="margin-top:0;">Yapılanlar</p>
            ${doneHtml}
            <p class="result-label">Sonuçlar</p>
            <div class="archived-outputs">${resultsHtml}</div>
        </div>
    `;
}

function renderOrchestratorRunSummary(intents) {
    renderRunSummaryInto(orchestratorOps, intents);
}


// İlerle: roll the completed operation into its own left tab (with its results)
// and request the next AI plan. Only runs on an explicit user click.
function proceedOrchestratorToNextTab() {
    if (!orchestratorActive || orchestratorBusy) {
        return;
    }
    const opNames = (operationWindowIntents || [])
        .filter((i) => i && !i._cancelled)
        .map((i) => i?.script?.display_name || i?.action)
        .filter(Boolean);
    const ranSummary = opNames.join(", ") || "-";
    const stageText = stageLabel(orchestratorStage) || "YZO";
    // Completed left-menu tab reads "Aşama (Operasyon)", e.g. "Tarama (Nmap)".
    const completedTabLabel = opNames.length ? `${stageText} (${ranSummary})` : stageText;
    if (orchestratorProceedBtn) {
        orchestratorProceedBtn.hidden = true;
    }
    rolloverDirectionWorkflowTab(orchestratorStage || "scan", completedTabLabel, {
        heading: stageText,
        categoryLabel: stageText,
        operationLabel: ranSummary,
        outputsHtml: takeCurrentTabOutputsHtml(),
    });
    setActiveOperation(directionPanel.dataset.opPanel);
    orchestratorTurn("", "");
}

async function stopOrchestrator() {
    orchestratorStopRequested = true;
    if (orchestratorAbort) {
        try {
            orchestratorAbort.abort();
        } catch (_) {
            // ignore
        }
    }
    if (orchestratorRunningExecutionId) {
        try {
            await apiRequest(`/validation/executions/${encodeURIComponent(orchestratorRunningExecutionId)}/stop`, { method: "POST" });
            appendProcessLog("AI Orkestrator: durdurma istegi gonderildi.");
        } catch (error) {
            appendProcessLog(`AI Orkestrator: durdurma hatasi. ${error?.message || "Bilinmeyen hata"}`);
        }
    }
    hideAiBusy();
}

function setOrchestratorControlsEnabled(enabled) {
    [orchestratorApproveBtn, orchestratorProceedBtn, orchestratorSuggestBtn, orchestratorRedirect, orchestratorRedirectOp, orchestratorExitBtn].forEach((el) => {
        if (el) {
            el.disabled = !enabled;
        }
    });
}

// The "Yapay zekaya öneri" panel and the "Yönlendir"/"Operasyon Seç" selects are
// shown while a proposal is under review, and hidden once the user approves and
// runs it (they reappear with the next proposal). Çık stays visible throughout.
function setOrchestratorInteractionVisible(visible) {
    const display = visible ? "" : "none";
    if (orchestratorSuggestPanel) {
        orchestratorSuggestPanel.style.display = display;
    }
    if (orchestratorRedirect) {
        orchestratorRedirect.style.display = display;
    }
    if (orchestratorRedirectOp) {
        orchestratorRedirectOp.style.display = display;
    }
}

const aiOrchestrateRestartBtn = document.getElementById("aiOrchestrateRestartBtn");
if (aiOrchestrateRestartBtn) {
    aiOrchestrateRestartBtn.addEventListener("click", () => {
        startOrchestrator();
    });
}
if (orchestratorApproveBtn) {
    orchestratorApproveBtn.addEventListener("click", () => {
        runOrchestratorProposal();
    });
}
if (orchestratorProceedBtn) {
    orchestratorProceedBtn.addEventListener("click", () => {
        proceedOrchestratorToNextTab();
    });
}
if (orchestratorSuggestBtn) {
    orchestratorSuggestBtn.addEventListener("click", () => {
        const instruction = String(orchestratorInstruction?.value || "").trim();
        if (!instruction) {
            setOrchestratorNote(t("orchestrate.needSuggestion", "Once bir oneri/talimat yazin."), true);
            return;
        }
        orchestratorTurn(instruction, "");
    });
}
if (orchestratorRedirect) {
    // Selecting a stage does NOT run a turn — it only filters the operation
    // picker to that stage's operations. Picking an operation there runs it.
    orchestratorRedirect.addEventListener("change", () => {
        renderRedirectOperationOptions(String(orchestratorRedirect.value || "").trim());
    });
}
if (orchestratorRedirectOp) {
    // Redirect straight to a specific operation: it opens with its parameters.
    orchestratorRedirectOp.addEventListener("change", () => {
        const action = String(orchestratorRedirectOp.value || "").trim();
        if (!action) {
            return;
        }
        const instruction = String(orchestratorInstruction?.value || "").trim();
        orchestratorRedirectOp.value = "";
        orchestratorTurn(instruction, "", action);
    });
}
if (orchestratorExitBtn) {
    orchestratorExitBtn.addEventListener("click", () => {
        exitOrchestrator();
    });
}
if (aiBusyStopBtn) {
    aiBusyStopBtn.addEventListener("click", () => {
        stopOrchestrator();
    });
}


if (directionProceedBtn) {
    directionProceedBtn.addEventListener("click", async () => {
        if (!selectedDirection || !selectedDirectionStepKey) {
            directionNote.innerText = t("direction.selectFirst", "Lutfen once ilerleme yonu sec.");
            return;
        }

        if (!operationWindowExecuted) {
            directionNote.innerText = "Ilerlemek icin once Yeni Islem penceresindeki Baslat islemini tamamlayin.";
            return;
        }

        const feedback = document.getElementById("nextTestFeedback");
        const details = getDirectionSelectionDetails();
        const completedDirection = selectedDirection;

        directionCompleted = true;
        directionProceedBtn.hidden = true;
        directionNextBtn.hidden = true;

        if (feedback) {
            feedback.classList.remove("error");
            feedback.innerText = `${t("direction.proceeded", "Sekme ilerletildi")}: ${details.categoryLabel} / ${details.stepLabel}`;
        }

        const directionResetBtn = document.getElementById("directionResetBtn");
        if (directionResetBtn) {
            directionResetBtn.hidden = true;
        }

        // Completed tab reads "Aşama (Operasyon)" exactly like YZO, e.g.
        // "Tarama (Nmap)" — the stage (Tarama/Atak/Düzenleme) plus the operations
        // that actually ran. Read op names before prepareDirectionPanelForNextOperation
        // clears operationWindowIntents.
        const opNames = (operationWindowIntents || [])
            .filter((i) => i && !i._cancelled)
            .map((i) => i?.script?.display_name || i?.action)
            .filter(Boolean);
        const ranSummary = opNames.join(", ") || details.stepLabel;
        const stageText = stageLabel(completedDirection) || getDirectionLabel(completedDirection);
        const completedTabLabel = opNames.length ? `${stageText} (${ranSummary})` : stageText;
        rolloverDirectionWorkflowTab(completedDirection, completedTabLabel, {
            heading: stageText,
            categoryLabel: details.categoryLabel,
            operationLabel: ranSummary,
            outputsHtml: takeCurrentTabOutputsHtml(),
        });
        prepareDirectionPanelForNextOperation();
        setActiveOperation(directionPanel.dataset.opPanel);
    });
}

legalConsent.addEventListener("change", () => {
    legalContinue.disabled = !legalConsent.checked;
});

legalContinue.addEventListener("click", () => {
    if (!legalConsent.checked) {
        return;
    }

    setAcceptedLegalNotice(true);

    if (!hasRole("test")) {
        directionNote.innerText = t("scan.role.testRequired", "Test rolü olmayan kullanıcı tarama ekranına geçemez.");
    }

    ensureScanTab();
    setActiveOperation("scan");
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!hasRole("test")) {
        scanConfigNote.innerText = "Bu islem icin test rolune sahip olmaniz gerekiyor.";
        return;
    }

    const target = document.getElementById("target").value.trim();
    const scanTool = getSelectedToolKey();
    const scanParams = getCheckedValues("scanParams");
    const finalPortSelection = getFinalPortSelection();
    const scanPorts = finalPortSelection.ports;

    if (!target || !scanTool) {
        scanConfigNote.innerText = t("scan.required.targetTool", "Hedef ve tarama araci zorunludur.");
        return;
    }

    const paramConflictMessages = getParamConflictMessages(scanTool, scanParams);
    if (paramConflictMessages.length > 0) {
        scanConfigNote.innerText = `${t("scan.conflict", "Parametre cakismasi")}: ${paramConflictMessages.join(" | ")}`;
        updateParamSelectionState();
        return;
    }

    if (finalPortSelection.invalid.length > 0) {
        scanConfigNote.innerText = `${t("scan.invalidPorts", "Gecersiz port girdileri var")}: ${finalPortSelection.invalid.join(", ")}`;
        return;
    }

    if (SCAN_TOOL_CONFIG[scanTool]?.ports?.length && scanPorts.length === 0) {
        scanConfigNote.innerText = t("scan.required.port", "Bu arac icin en az bir port secmelisin.");
        return;
    }

    const formData = new FormData();
    formData.append("target", target);
    formData.append("scan_tool", scanTool);
    formData.append("scan_params", scanParams.join(","));
    formData.append("scan_ports", scanPorts.join(","));
    formData.append("language", currentLanguage);

    btn.disabled = true;
    latestScanResult = null;
    Object.keys(stageSuggestionsByStage).forEach((key) => {
        delete stageSuggestionsByStage[key];
    });
    statusText.innerText = t("status.preparing", "Durum: hazirlaniyor...");
    currentStep.innerText = "";
    appendAiEvaluation("Tarama Durumu", t("right.ai.wait", "AI analizi bekleniyor..."));
    resultDiv.innerHTML = t("scan.running", "Tarama calisiyor. Sonuclar sag panelde adim ciktilarina eklenecek.");
    logsDiv.innerHTML = "";

    const response = await fetch("/scan", {
        method: "POST",
        body: formData
    });

    const data = await response.json();

    if (data.job_id) {
        pollStatus(data.job_id);
    } else {
        statusText.innerText = data.error || t("status.jobCreateFail", "Job olusturulamadi.");
        updateScanButtonState();
    }
});

form.addEventListener("change", (event) => {
    if (event.target.name === "scanTool") {
        updateToolDependentOptions();
        return;
    }

    if (event.target.name === "scanParams" || event.target.name === "scanPorts") {
        if (event.target.name === "scanParams") {
            updateParamSelectionState();
        }

        if (event.target.name === "scanPorts") {
            const allPortCheckbox = form.querySelector('input[name="scanPorts"][value="all"]');

            if (event.target.value === "all" && event.target.checked) {
                form.querySelectorAll('input[name="scanPorts"]').forEach((item) => {
                    if (item.value !== "all") {
                        item.checked = false;
                    }
                });
            } else if (event.target.value !== "all" && event.target.checked && allPortCheckbox) {
                allPortCheckbox.checked = false;
            }

            updatePortSelectionState();
        }

        updateScanButtonState();
    }
});

form.addEventListener("input", (event) => {
    if (event.target.id === "manualPortsInput") {
        const allPortCheckbox = form.querySelector('input[name="scanPorts"][value="all"]');
        if (allPortCheckbox && allPortCheckbox.checked) {
            allPortCheckbox.checked = false;
        }

        updatePortSelectionState();
        updateScanButtonState();
    }
});

document.getElementById("target").addEventListener("input", () => {
    updateScanButtonState();
});

async function pollStatus(jobId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/status/${jobId}`);
            const job = await response.json();

            statusText.innerText = `${t("status.prefix", "Durum")}: ${translateJobStatus(job.status)}`;
            currentStep.innerText = job.current_step || "";

            renderLogs(job.logs || []);

            if (job.status === "finished") {
                clearInterval(interval);
                updateScanButtonState();
                statusText.innerText = `${t("status.prefix", "Durum")}: ${translateJobStatus("finished")}`;
                currentStep.innerText = t("scan.completed", "Tarama tamamlandi.");
                renderResult(job.result);
                await loadWorkflowStepsFromServer();
                ensureDirectionTab();
                selectedDirection = "";
                directionLocked = false;
                directionCompleted = false;
                renderDirectionState();
                setActiveOperation("direction");
                return;
            }

            if (job.status === "failed") {
                clearInterval(interval);
                updateScanButtonState();
                statusText.innerText = `${t("status.prefix", "Durum")}: failed`;
                currentStep.innerText = t("scan.result.error", "Tarama hata ile sonlandi.");
                renderResult(job.result || { error: t("scan.result.error", "Tarama hata ile sonlandi.") });
            }
        } catch (error) {
            clearInterval(interval);
            updateScanButtonState();
            statusText.innerText = `${t("status.prefix", "Durum")}: error`;
            currentStep.innerText = error.message || "Durum sorgusu basarisiz.";
        }
    }, 1000);
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderLogs(logs) {
    let html = "";

    for (const item of logs) {
        html += `<div>[${escapeHtml(item.time)}] ${escapeHtml(item.message)}</div>`;
    }

    logsDiv.innerHTML = html;
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

function renderResult(result) {
    if (!result) {
        resultDiv.innerHTML = t("scan.result.none", "Tarama sonucu alinamadi.");
        appendAiEvaluation("Tarama AI Degerlendirmesi", t("right.ai.none", "Sonuc alinamadigi icin AI cikti yok."));
        appendStepOutput(t("scan.result.title", "Tarama Sonucu"), t("scan.result.none", "Sonuc alinamadi."));
        return;
    }

    if (result.error) {
        resultDiv.innerHTML = t("scan.result.error", "Tarama hata ile sonlandi.");
        appendAiEvaluation("Tarama AI Degerlendirmesi", t("right.ai.error", "Tarama hata ile sonlandigi icin AI cikti yok."));
        appendStepOutput(t("scan.result.title", "Tarama Sonucu"), `${t("scan.error", "Hata")}: ${result.error}`);
        return;
    }

    latestScanResult = result;

    if (result.ai_analysis) {
        appendAiEvaluation("Tarama AI Degerlendirmesi", result.ai_analysis);
    } else {
        appendAiEvaluation("Tarama AI Degerlendirmesi", t("right.ai.noAnalysis", "Bu tarama icin AI analizi uretilmedi."));
    }

    resultDiv.innerHTML = t("scan.result.done", "Tarama tamamlandi. Ilerleme Yonu sekmesine gecildi.");

    const activeTool = result.scan_tool || "nmap";

    let hostSummaryHtml = "";
    if (activeTool === "nmap" && Array.isArray(result.hosts) && result.hosts.length > 0) {
        let hostRows = "";
        for (const h of result.hosts) {
            hostRows += `
                <tr>
                    <td>${escapeHtml(h.host || "-")}</td>
                    <td>${escapeHtml(h.hostname || "-")}</td>
                    <td>${escapeHtml(h.status || "-")}</td>
                    <td>${escapeHtml(h.os || "-")}</td>
                    <td>${escapeHtml(h.os_accuracy || "-")}</td>
                    <td>${escapeHtml(String(h.open_ports ?? "-"))}</td>
                </tr>
            `;
        }

        hostSummaryHtml = `
            <p><b>${escapeHtml(t("result.hostSummary", "Host Özeti"))}</b></p>
            <table>
                <tr>
                    <th>${escapeHtml(t("result.host", "Host/IP"))}</th>
                    <th>${escapeHtml(t("result.hostname", "Hostname"))}</th>
                    <th>${escapeHtml(t("result.status", "Durum"))}</th>
                    <th>${escapeHtml(t("result.os", "İşletim Sistemi"))}</th>
                    <th>${escapeHtml(t("result.osAccuracy", "OS Doğruluk"))}</th>
                    <th>${escapeHtml(t("result.openPorts", "Açık Port"))}</th>
                </tr>
                ${hostRows}
            </table>
        `;
    }

    let downloadFileHtml = "";
    if (typeof result.xml_file === "string" && !result.xml_file.startsWith("mock://") && !result.xml_file.startsWith("netdiscover://")) {
        const fileName = result.xml_file.split(/[\\/]/).pop();
        if (fileName) {
            const downloadUrl = `/download-scan-file?file_name=${encodeURIComponent(fileName)}&language=${encodeURIComponent(currentLanguage)}`;
            downloadFileHtml = `<p><a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">${escapeHtml(t("result.downloadFile", "XML/Cikti dosyasini indir"))}</a></p>`;
        }
    }

    let detailsTableHtml = "";
    if (activeTool === "nmap") {
        let tableRows = "";
        for (const p of result.ports || []) {
            tableRows += `
                <tr>
                    <td>${escapeHtml(p.host || "-")}</td>
                    <td>${escapeHtml(p.port)}</td>
                    <td>${escapeHtml(p.protocol)}</td>
                    <td>${escapeHtml(p.state)}</td>
                    <td>${escapeHtml(p.service)}</td>
                    <td>${escapeHtml(p.product)}</td>
                    <td>${escapeHtml(p.version)}</td>
                </tr>
            `;
        }

        if (!tableRows) {
            tableRows = `<tr><td colspan="7">${escapeHtml(t("scan.ports.none", "Port sonucu yok."))}</td></tr>`;
        }

        detailsTableHtml = `
            <table>
                <tr>
                    <th>${escapeHtml(t("result.host", "Host/IP"))}</th>
                    <th>${escapeHtml(t("result.port", "Port"))}</th>
                    <th>${escapeHtml(t("result.protocol", "Protocol"))}</th>
                    <th>${escapeHtml(t("result.state", "State"))}</th>
                    <th>${escapeHtml(t("result.service", "Service"))}</th>
                    <th>${escapeHtml(t("result.product", "Product"))}</th>
                    <th>${escapeHtml(t("result.version", "Version"))}</th>
                </tr>
                ${tableRows}
            </table>
        `;
    } else if (activeTool === "masscan") {
        let tableRows = "";
        for (const p of result.ports || []) {
            tableRows += `
                <tr>
                    <td>${escapeHtml(p.host || "-")}</td>
                    <td>${escapeHtml(p.port)}</td>
                    <td>${escapeHtml(p.protocol)}</td>
                    <td>${escapeHtml(p.state)}</td>
                </tr>
            `;
        }

        if (!tableRows) {
            tableRows = `<tr><td colspan="4">${escapeHtml(t("scan.ports.none", "Port sonucu yok."))}</td></tr>`;
        }

        detailsTableHtml = `
            <table>
                <tr>
                    <th>${escapeHtml(t("result.host", "Host/IP"))}</th>
                    <th>${escapeHtml(t("result.port", "Port"))}</th>
                    <th>${escapeHtml(t("result.protocol", "Protocol"))}</th>
                    <th>${escapeHtml(t("result.state", "State"))}</th>
                </tr>
                ${tableRows}
            </table>
        `;
    } else {
        let tableRows = "";
        for (const h of result.hosts || []) {
            tableRows += `
                <tr>
                    <td>${escapeHtml(h.host || "-")}</td>
                    <td>${escapeHtml(h.hostname || "-")}</td>
                    <td>${escapeHtml(h.status || "-")}</td>
                    <td>${escapeHtml(String(h.open_ports ?? 0))}</td>
                </tr>
            `;
        }

        if (!tableRows) {
            tableRows = `<tr><td colspan="4">${escapeHtml(t("scan.hosts.none", "Host sonucu yok."))}</td></tr>`;
        }

        detailsTableHtml = `
            <table>
                <tr>
                    <th>${escapeHtml(t("result.host", "Host/IP"))}</th>
                    <th>${escapeHtml(t("result.hostname", "Hostname"))}</th>
                    <th>${escapeHtml(t("result.status", "Durum"))}</th>
                    <th>${escapeHtml(t("result.openPorts", "Açık Port"))}</th>
                </tr>
                ${tableRows}
            </table>
        `;
    }

    const resultHtml = `
        <p><b>${escapeHtml(t("result.target", "Target"))}:</b> ${escapeHtml(result.target)}</p>
        <p><b>${escapeHtml(t("result.tool", "Tool"))}:</b> ${escapeHtml(result.scan_tool || "nmap")}</p>
        <p><b>${escapeHtml(t("result.params", "Params"))}:</b> ${escapeHtml((result.selected_params || []).join(", ") || "-")}</p>
        <p><b>${escapeHtml(t("result.ports", "Ports"))}:</b> ${escapeHtml((result.selected_ports || []).join(", ") || "-")}</p>
        <p><b>XML:</b> ${escapeHtml(result.xml_file)}</p>
        ${downloadFileHtml}
        ${hostSummaryHtml}
        ${detailsTableHtml}
    `;

    appendStepOutputHtml(t("scan.result.title", "Tarama Sonucu"), resultHtml);
}


function exportStepOutputsPdf() {
    if (!stepOutputs || !stepOutputs.innerHTML.trim()) {
        if (window.SSVPNotify) {
            window.SSVPNotify.show({
                message: t("report.empty", "PDF olusturmak icin raporlanacak bir islem sonucu bulunamadi."),
                type: "warning",
                duration: 10000,
            });
        }
        return;
    }

    // NOTE: do NOT pass "noopener"/"noreferrer" here — they sever the opener
    // reference so document.write() lands on a detached document (or returns
    // null), which is what produced the blank export page.
    const popup = window.open("", "_blank", "width=1024,height=768");
    if (!popup) {
        if (window.SSVPNotify) {
            window.SSVPNotify.show({
                message: t("report.popupBlocked", "PDF olusturma penceresi engellendi. Lutfen popup izni ver."),
                type: "warning",
                duration: 10000,
            });
        }
        return;
    }

    // Print is triggered from the popup's own body onload so it fires only
    // after the content has been parsed and laid out; printing synchronously
    // right after document.write() yields a blank page.
    popup.document.write(`
        <html>
            <head>
                <title>${escapeHtml(t("report.title", "Islem Sonuclari Raporu"))}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                    h1 { margin: 0 0 16px 0; }
                    .step-output-item { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
                    .step-output-title { font-weight: 700; margin: 0 0 8px 0; }
                    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
                    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
                    .step-output-text { white-space: normal; }
                </style>
            </head>
            <body onload="window.focus(); window.print();">
                <h1>${escapeHtml(t("report.title", "Islem Sonuclari Raporu"))}</h1>
                ${stepOutputs.innerHTML}
            </body>
        </html>
    `);
    popup.document.close();
}

async function bootstrapApp() {
    await loadLanguageManifest();
    initializeTheme();
    initializeScanWizard();
    bindHeaderMenus();
    bindUserAdminPanel();
    bindAuthUi();
    await ensureAuthenticated();

    const userLang = normalizeLanguage(currentUser?.ui_language);
    const userTheme = normalizeTheme(currentUser?.ui_theme);
    currentLanguage = userLang;
    applyTheme(userTheme);

    applyStaticTranslations();
    await setLanguage(userLang);
    applyRoleRestrictions();
    await loadWorkflowMode();
    await loadWordlistCatalog();

    if (hasAcceptedLegalNotice()) {
        if (legalConsent) {
            legalConsent.checked = true;
        }
        if (legalContinue) {
            legalContinue.disabled = false;
        }
        ensureScanTab();
        setActiveOperation("scan");
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", exportStepOutputsPdf);
    }

    renderPathNavigation(getActiveOperationFromUi());
}

bootstrapApp();

if (actionApprovalCancelBtn) {
    actionApprovalCancelBtn.addEventListener("click", () => closeActionApprovalModal(false));
}

if (actionApprovalConfirmBtn) {
    actionApprovalConfirmBtn.addEventListener("click", () => closeActionApprovalModal(true));
}
