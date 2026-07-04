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


function normalizeDynamicParamType(paramType) {
    const token = String(paramType || "string").trim().toLowerCase();
    if (token === "bool") return "boolean";
    if (token === "int") return "number";
    if (token === "float") return "number";
    return token;
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

    const rows = [...schema].sort((a, b) => Number(a?.sort_order || 100) - Number(b?.sort_order || 100));
    nextTestParamsWrap.style.display = "block";

    nextTestParamsForm.innerHTML = rows
        .map((item) => {
            const key = String(item?.key || "").trim();
            if (!key) {
                return "";
            }

            const label = String(item?.label || key);
            const required = Boolean(item?.required);
            const type = normalizeDynamicParamType(item?.type);
            const defaultValue = item?.default;

            if (type === "boolean") {
                const checked = defaultValue === true ? " checked" : "";
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <label class="check-chip">
                            <input type="checkbox" data-param-key="${escapeHtml(key)}" data-param-type="boolean"${checked}>
                            <span>${escapeHtml(key)}</span>
                        </label>
                    </div>
                `;
            }

            if (type === "json" || type === "list" || type === "object" || type === "dict") {
                const serialized = typeof defaultValue === "string"
                    ? defaultValue
                    : JSON.stringify(defaultValue ?? (type === "list" ? [] : {}), null, 2);
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <textarea data-param-key="${escapeHtml(key)}" data-param-type="${escapeHtml(type)}" placeholder="JSON">${escapeHtml(serialized)}</textarea>
                    </div>
                `;
            }

            if (type === "number") {
                const numericValue = Number(defaultValue);
                const value = Number.isFinite(numericValue) ? String(numericValue) : "";
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <input type="number" data-param-key="${escapeHtml(key)}" data-param-type="number" value="${escapeHtml(value)}">
                    </div>
                `;
            }

            const value = defaultValue == null ? "" : String(defaultValue);
            return `
                <div class="dynamic-param-field">
                    <div class="dynamic-param-label">
                        <span>${escapeHtml(label)}</span>
                        ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                    </div>
                    <input type="text" data-param-key="${escapeHtml(key)}" data-param-type="string" value="${escapeHtml(value)}">
                </div>
            `;
        })
        .join("");
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


function renderOperationWindowIntents(intents) {
    if (!directionOperationWindow) {
        return;
    }

    operationWindowIntents = Array.isArray(intents) ? intents : [];
    operationWindowExecuted = false;
    operationWindowRunning = false;

    if (!operationWindowIntents.length) {
        directionOperationWindow.innerHTML = `
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
        const schema = Array.isArray(intent?.parameter_schema) ? [...intent.parameter_schema] : [];
        schema.sort((a, b) => Number(a?.sort_order || 100) - Number(b?.sort_order || 100));

        const fieldsHtml = schema.map((item) => {
            const key = String(item?.key || "").trim();
            if (!key) {
                return "";
            }

            const label = String(item?.label || key);
            const required = Boolean(item?.required);
            const type = normalizeDynamicParamType(item?.type);
            const defaultValue = intent?.parameters?.[key] ?? item?.default;
            const keyAttr = escapeHtml(key);

            if (type === "boolean") {
                const checked = defaultValue === true ? " checked" : "";
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <label class="check-chip">
                            <input type="checkbox" data-intent-index="${intentIndex}" data-param-key="${keyAttr}" data-param-type="boolean"${checked}>
                            <span>${keyAttr}</span>
                        </label>
                    </div>
                `;
            }

            if (type === "json" || type === "list" || type === "object" || type === "dict") {
                const serialized = typeof defaultValue === "string"
                    ? defaultValue
                    : JSON.stringify(defaultValue ?? (type === "list" ? [] : {}), null, 2);
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <textarea data-intent-index="${intentIndex}" data-param-key="${keyAttr}" data-param-type="${escapeHtml(type)}" placeholder="JSON">${escapeHtml(serialized)}</textarea>
                    </div>
                `;
            }

            if (type === "number") {
                const numericValue = Number(defaultValue);
                const value = Number.isFinite(numericValue) ? String(numericValue) : "";
                return `
                    <div class="dynamic-param-field">
                        <div class="dynamic-param-label">
                            <span>${escapeHtml(label)}</span>
                            ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                        </div>
                        <input type="number" data-intent-index="${intentIndex}" data-param-key="${keyAttr}" data-param-type="number" value="${escapeHtml(value)}">
                    </div>
                `;
            }

            const value = defaultValue == null ? "" : String(defaultValue);
            return `
                <div class="dynamic-param-field">
                    <div class="dynamic-param-label">
                        <span>${escapeHtml(label)}</span>
                        ${required ? `<span class="dynamic-param-required">required</span>` : ""}
                    </div>
                    <input type="text" data-intent-index="${intentIndex}" data-param-key="${keyAttr}" data-param-type="string" value="${escapeHtml(value)}">
                </div>
            `;
        }).join("");

        return `
            <div class="next-test-panel" style="margin-top:10px;">
                <h4 style="margin:0 0 6px 0;">${escapeHtml(name)}</h4>
                <p class="muted" style="margin:0 0 6px 0;">Action: ${escapeHtml(action)}</p>
                <p class="muted" style="margin:0 0 6px 0;">Type: ${escapeHtml(itemType)}</p>
                <p class="muted" style="margin:0;">${escapeHtml(reason)}</p>
                <div class="dynamic-param-grid" style="margin-top:10px;">${fieldsHtml || `<p class="muted" style="margin:0;">Parametre gerekmiyor.</p>`}</div>
            </div>
        `;
    }).join("");

    directionOperationWindow.innerHTML = `
        <h4 style="margin:0 0 8px 0;">${escapeHtml(t("direction.newOperation", "Yeni Islem"))}</h4>
        <p class="muted" style="margin:0 0 8px 0;">Bu adimdaki tum gorev/scriptler yüklendi. Parametreleri girip baslatabilirsiniz.</p>
        ${cardsHtml}
        <div class="direction-global-actions" style="margin-top:12px;">
            <button id="directionStartBtn" type="button">${escapeHtml(t("direction.start", "Baslat"))}</button>
        </div>
    `;

    if (directionProceedBtn) {
        directionProceedBtn.disabled = true;
    }
}


function collectWindowIntentParameters(intent, intentIndex) {
    const schema = Array.isArray(intent?.parameter_schema) ? intent.parameter_schema : [];
    const values = {};

    for (const item of schema) {
        const key = String(item?.key || "").trim();
        if (!key) {
            continue;
        }

        const type = normalizeDynamicParamType(item?.type);
        const required = Boolean(item?.required);
        const node = directionOperationWindow?.querySelector(`[data-intent-index="${intentIndex}"][data-param-key="${CSS.escape(key)}"]`);
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


async function fetchStageSuggestions() {
    const feedback = document.getElementById("nextTestFeedback");
    if (!selectedDirection || !selectedDirectionStepKey || !latestScanResult) {
        if (feedback) {
            feedback.classList.add("error");
            feedback.innerText = "Aşama önerisi için önce bir tarama sonucu gerekli.";
        }
        return false;
    }

    if (feedback) {
        feedback.classList.remove("error");
        feedback.innerText = "AI önerileri alınıyor...";
    }
    appendProcessLog(`${getDirectionLabel(selectedDirection)}: AI action intent onerileri aliniyor.`);

    try {
        const response = await apiRequest("/validation/step-intents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                step_key: selectedDirectionStepKey,
                target: latestScanResult.target || document.getElementById("target")?.value.trim() || "authorized-target",
                scan_tool: latestScanResult.scan_tool || "nmap",
                scan_result: latestScanResult,
                evidence: [],
            }),
        });

        const intents = Array.isArray(response.intents) ? response.intents : [];
        stageSuggestionsByStage[selectedDirectionStepKey] = intents;

        if (feedback) {
            feedback.classList.remove("error");
            feedback.innerText = response.summary || "AI önerileri yüklendi.";
        }
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: AI action intent onerileri hazir.`);
        appendAiEvaluation(`Asama Degerlendirmesi - ${getDirectionLabel(selectedDirection)}`, response.summary || "AI ozeti alinamadi.");
        return { ok: true, intents };
    } catch (error) {
        if (feedback) {
            feedback.classList.add("error");
            feedback.innerText = error.message || "AI aşama önerisi alınamadı.";
        }
        appendProcessLog(`${getDirectionLabel(selectedDirection)}: AI onerisi alinamadi. ${error.message || "Unknown error"}`);
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
}


function getActiveOperationFromUi() {
    const active = operationTabs?.querySelector(".stage-tab.active");
    return String(active?.dataset?.op || "legal").trim().toLowerCase() || "legal";
}


function renderPathNavigation(opName = "") {
    if (!pathBreadcrumb) {
        return;
    }

    const activeOp = String(opName || getActiveOperationFromUi() || "legal").trim().toLowerCase();
    const crumbs = [
        { label: "root", href: "/" },
        { label: "app", href: "/app" },
        { label: activeOp, href: `/app#${activeOp}` },
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


function appendStepOutput(title, text) {
    if (!stepOutputs) {
        return;
    }

    const item = document.createElement("div");
    item.className = "step-output-item";
    item.innerHTML = `
        <p class="step-output-title">${escapeHtml(title)}</p>
        <p class="step-output-text">${escapeHtml(text)}</p>
    `;
    stepOutputs.appendChild(item);
}


function appendStepOutputHtml(title, htmlContent) {
    if (!stepOutputs) {
        return;
    }

    const item = document.createElement("div");
    item.className = "step-output-item";
    item.innerHTML = `
        <p class="step-output-title">${escapeHtml(title)}</p>
        <div class="step-output-text">${htmlContent}</div>
    `;
    stepOutputs.appendChild(item);
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
            directionProceedBtn.disabled = true;
            directionProceedBtn.hidden = false;
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
        directionProceedBtn.disabled = !operationWindowExecuted;
        directionProceedBtn.hidden = directionCompleted;
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


function archiveCompletedDirectionPanel(opId, directionValue, categoryLabel, stepLabel) {
    if (!stageMain || !opId) {
        return;
    }

    const directionLabel = getDirectionLabel(directionValue);
    const panel = document.createElement("section");
    panel.className = "wizard-section operation-panel";
    panel.dataset.opPanel = opId;
    panel.style.display = "none";
    panel.innerHTML = `
        <h3>${directionLabel} Islem Penceresi</h3>
        <p class="muted">Kategori: ${escapeHtml(categoryLabel)}</p>
        <p class="muted">Secilen Adim: ${escapeHtml(stepLabel)}</p>
        <p class="muted">Bu sekme tamamlandi ve kilitlendi. Yeni islem farkli bir sekmede devam eder.</p>
    `;

    stageMain.appendChild(panel);
}


function rolloverDirectionWorkflowTab(directionValue, categoryLabel, stepLabel) {
    if (!operationTabs) {
        return;
    }

    const currentTab = document.getElementById("directionTab");
    const currentReset = document.getElementById("directionResetBtn");
    const currentOpId = directionPanel.dataset.opPanel || "direction";

    if (currentTab) {
        currentTab.removeAttribute("id");
        const safeCategory = (categoryLabel || "Kategori").trim() || "Kategori";
        currentTab.innerText = `${currentTab.innerText} (${safeCategory})`;
    }

    if (currentReset) {
        currentReset.removeAttribute("id");
        currentReset.hidden = true;
    }

    archiveCompletedDirectionPanel(currentOpId, directionValue, categoryLabel, stepLabel);

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

    if (!toolConfig.ports || toolConfig.ports.length === 0) {
        scanConfigNote.innerText = `${toolConfig.label} ${t("scan.note.noPorts", "secildi. Bu arac port yerine ag host kesfi yapar.")}`;
    } else {
        scanConfigNote.innerText = `${toolConfig.label} ${t("scan.note.ready", "icin parametre ve port secimlerini tamamlayip taramayi baslatabilirsin.")}`;
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
            feedback.innerText = `${t("direction.selectedStep", "Secilen adim")}: ${directionOperationDetails.categoryLabel} / ${directionOperationDetails.stepLabel}. AI onerisi ve parametreler yuklendi.`;
        }
    }

    if (!loadResult.ok) {
        return;
    }

    directionLocked = true;
    directionCompleted = false;
    renderDirectionState();
    renderOperationWindowIntents(loadResult.intents || []);
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

        if (state.status === "finished") {
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

    operationWindowRunning = true;
    const startBtn = directionOperationWindow?.querySelector("#directionStartBtn");
    if (startBtn) {
        startBtn.disabled = true;
    }

    try {
        for (const { intent, parameters } of prepared) {
            const executable = Boolean(intent?.executable ?? (String(intent?.item_type || "script").toLowerCase() === "script"));
            if (!executable) {
                appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${intent.action} manuel gorev olarak kaydedildi.`);
                appendStepOutput(
                    `${getDirectionLabel(selectedDirection)} - Manual Task (${intent.action})`,
                    JSON.stringify({ target: resolvedTarget, parameters }, null, 2),
                );
                continue;
            }

            const payload = {
                step_key: selectedDirectionStepKey,
                action: intent.action,
                target: resolvedTarget,
                reason: intent.reason || "Stage execution requested by user",
                parameters,
                approved: true,
            };

            appendProcessLog(`${getDirectionLabel(selectedDirection)}: ${intent.action} calistiriliyor.`);
            const executionStart = await apiRequest("/validation/execute-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const executionState = await pollValidationExecution(executionStart.execution_id, getDirectionLabel(selectedDirection));

            const execResult = executionState?.result || {};
            const execOutput = execResult?.output || {};
            const outputText = execOutput?.result?.error
                ? `Error: ${execOutput.result.error}`
                : `Action: ${intent.action || "-"} | Status: ${execResult.status || "completed"}`;
            appendStepOutput(`${getDirectionLabel(selectedDirection)} - Tool Runner`, outputText);

            if (execOutput.result && typeof execOutput.result === "object") {
                appendStepOutput(
                    `${getDirectionLabel(selectedDirection)} - Script Result (${intent.action})`,
                    JSON.stringify(execOutput.result, null, 2),
                );
            }

            if (execOutput.ai_guidance?.summary) {
                appendAiEvaluation("Execution Guidance", execOutput.ai_guidance.summary);
            }

            try {
                const evidenceAnalysis = await apiRequest("/validation/evidence-analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        target: resolvedTarget,
                        evidence: [
                            {
                                action: intent.action,
                                target: resolvedTarget,
                                output: execOutput,
                            },
                        ],
                    }),
                });

                const remediationSummary = evidenceAnalysis?.analysis?.summary || "Evidence analizi tamamlandi.";
                appendStepOutput("Evidence & Remediation Analysis", remediationSummary);
                appendAiEvaluation("Evidence ve Remediation Degerlendirmesi", remediationSummary);
            } catch (analysisError) {
                appendStepOutput("Evidence & Remediation Analysis", analysisError.message || "Evidence analizi alınamadı.");
            }
        }

        operationWindowExecuted = true;
        directionNote.innerText = "Tum gorev/scriptler tamamlandi. Ilerle ile sonraki asamaya gecebilirsiniz.";
        if (directionProceedBtn) {
            directionProceedBtn.disabled = false;
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
        await executeOperationWindowIntents();
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

        rolloverDirectionWorkflowTab(completedDirection, details.categoryLabel, details.stepLabel);
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

    const popup = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
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
            <body>
                <h1>${escapeHtml(t("report.title", "Islem Sonuclari Raporu"))}</h1>
                ${stepOutputs.innerHTML}
            </body>
        </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
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
