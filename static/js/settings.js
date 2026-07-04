const THEME_STORAGE_KEY = "ssvp-theme";
const LANGUAGE_STORAGE_KEY = "ssvp-language";

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const panels = Array.from(document.querySelectorAll(".panel"));
const settingsInfo = document.getElementById("settingsInfo");
const settingsFeedback = document.getElementById("settingsFeedback");
const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");
const settingsMenuWrap = document.getElementById("settingsMenuWrap");
const settingsMenuToggle = document.getElementById("settingsMenuToggle");
const settingsMenuPopover = document.getElementById("settingsMenuPopover");
const settingsMenuProfile = document.getElementById("settingsMenuProfile");
const settingsMenuSystem = document.getElementById("settingsMenuSystem");
const settingsMenuPanel = document.getElementById("settingsMenuPanel");
const settingsMenuApp = document.getElementById("settingsMenuApp");
const appearanceForm = document.getElementById("appearanceForm");
const appearanceTheme = document.getElementById("appearanceTheme");
const appearanceLanguage = document.getElementById("appearanceLanguage");
const projectInfoList = document.getElementById("projectInfoList");
const hostInfoList = document.getElementById("hostInfoList");
const resourceInfoList = document.getElementById("resourceInfoList");

const profileForm = document.getElementById("profileForm");
const profileUsername = document.getElementById("profileUsername");
const profileFullName = document.getElementById("profileFullName");
const profileJobTitle = document.getElementById("profileJobTitle");
const profilePhone = document.getElementById("profilePhone");
const profilePasswordForm = document.getElementById("profilePasswordForm");
const profileCurrentPassword = document.getElementById("profileCurrentPassword");
const profileNewPassword = document.getElementById("profileNewPassword");
const profileNewPasswordConfirm = document.getElementById("profileNewPasswordConfirm");

const createUserForm = document.getElementById("createUserForm");
const newUsername = document.getElementById("newUsername");
const newFullName = document.getElementById("newFullName");
const newJobTitle = document.getElementById("newJobTitle");
const newPhone = document.getElementById("newPhone");
const newPassword = document.getElementById("newPassword");
const newPasswordConfirm = document.getElementById("newPasswordConfirm");
const newIsAdmin = document.getElementById("newIsAdmin");
const newUserRoles = document.getElementById("newUserRoles");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");
const usersTbody = document.getElementById("usersTbody");

const editUserForm = document.getElementById("editUserForm");
const editUserId = document.getElementById("editUserId");
const editUsername = document.getElementById("editUsername");
const editFullName = document.getElementById("editFullName");
const editJobTitle = document.getElementById("editJobTitle");
const editPhone = document.getElementById("editPhone");
const editIsAdmin = document.getElementById("editIsAdmin");
const editIsActive = document.getElementById("editIsActive");
const editUserRoles = document.getElementById("editUserRoles");
const editNewPassword = document.getElementById("editNewPassword");
const editNewPasswordConfirm = document.getElementById("editNewPasswordConfirm");
const cancelEditUserBtn = document.getElementById("cancelEditUserBtn");

const rolesTbody = document.getElementById("rolesTbody");

const aiSettingsForm = document.getElementById("aiSettingsForm");
const aiModelSelect = document.getElementById("aiModelSelect");
const aiModelManual = document.getElementById("aiModelManual");
const aiTimeout = document.getElementById("aiTimeout");
const aiUrl = document.getElementById("aiUrl");
const aiFakeResponse = document.getElementById("aiFakeResponse");

const scanSettingsForm = document.getElementById("scanSettingsForm");
const nmapTimeout = document.getElementById("nmapTimeout");
const masscanTimeout = document.getElementById("masscanTimeout");
const netdiscoverTimeout = document.getElementById("netdiscoverTimeout");
const workflowStepForm = document.getElementById("workflowStepForm");
const workflowStepKey = document.getElementById("workflowStepKey");
const workflowStepName = document.getElementById("workflowStepName");
const workflowStepRole = document.getElementById("workflowStepRole");
const workflowStepOrder = document.getElementById("workflowStepOrder");
const workflowStepDescription = document.getElementById("workflowStepDescription");
const workflowStepHint = document.getElementById("workflowStepHint");
const workflowStepActive = document.getElementById("workflowStepActive");
const refreshWorkflowStepsBtn = document.getElementById("refreshWorkflowStepsBtn");
const workflowStepsTbody = document.getElementById("workflowStepsTbody");
const toolRegistryForm = document.getElementById("toolRegistryForm");
const toolActionKey = document.getElementById("toolActionKey");
const toolDisplayName = document.getElementById("toolDisplayName");
const toolName = document.getElementById("toolName");
const toolRiskLevel = document.getElementById("toolRiskLevel");
const toolTimeout = document.getElementById("toolTimeout");
const toolBaseCommand = document.getElementById("toolBaseCommand");
const toolRequiresApproval = document.getElementById("toolRequiresApproval");
const toolActive = document.getElementById("toolActive");
const refreshToolsBtn = document.getElementById("refreshToolsBtn");
const toolsTbody = document.getElementById("toolsTbody");
const toolParameterForm = document.getElementById("toolParameterForm");
const parameterToolId = document.getElementById("parameterToolId");
const parameterKey = document.getElementById("parameterKey");
const parameterLabel = document.getElementById("parameterLabel");
const parameterType = document.getElementById("parameterType");
const parameterDefault = document.getElementById("parameterDefault");
const toolParametersTbody = document.getElementById("toolParametersTbody");

const I18N = {
    tr: {
        "settings.meta.title": "SSVP Ayarlar",
        "settings.header.title": "Ayarlar",
        "settings.header.home": "Ana Sayfa",
        "settings.header.logout": "Çıkış Yap",
        "settings.tab.profile": "Profil Düzenle",
        "settings.tab.appearance": "Görünüm",
        "settings.tab.system": "Sistem ve Proje",
        "settings.tab.users": "Kullanıcı Yönetimi",
        "settings.tab.roles": "Rol Yönetimi",
        "settings.tab.ai": "AI Model",
        "settings.tab.scan": "Tarama Ayarları",
        "settings.profile.title": "Profil Düzenle",
        "settings.profile.card.profile": "Profil Bilgileri",
        "settings.profile.card.password": "Şifre Değiştir",
        "settings.profile.currentPassword": "Mevcut Şifre",
        "settings.profile.newPassword": "Yeni Şifre",
        "settings.profile.newPasswordConfirm": "Yeni Şifre (Doğrula)",
        "settings.profile.save": "Profili Kaydet",
        "settings.profile.passwordSave": "Şifreyi Güncelle",
        "settings.users.title": "Kullanıcı Yönetimi",
        "settings.users.create.title": "Yeni Kullanıcı",
        "settings.users.create.submit": "Kullanıcı Ekle",
        "settings.users.edit.title": "Kullanıcı Düzenle",
        "settings.users.edit.newPasswordOptional": "Yeni Şifre (opsiyonel)",
        "settings.users.edit.newPasswordConfirm": "Yeni Şifre (Doğrula)",
        "settings.users.edit.save": "Değişiklikleri Kaydet",
        "settings.users.list.title": "Kullanıcılar",
        "settings.roles.title": "Rol Yönetimi",
        "settings.roles.note": "Yönetici bu sekmede kullanıcıların rollerini toplu olarak düzenleyebilir.",
        "settings.ai.title": "AI Model Ayarları",
        "settings.ai.installedModel": "Sunucuda Yüklü Model",
        "settings.ai.modelManual": "Model Adı (manuel)",
        "settings.ai.timeout": "AI Zaman Aşımı (sn)",
        "settings.ai.url": "Ollama URL",
        "settings.ai.useDemo": "Demo AI yanıtı kullan",
        "settings.ai.save": "AI Ayarlarını Kaydet",
        "settings.scan.title": "Tarama Ayarları",
        "settings.scan.nmapTimeout": "Nmap Zaman Aşımı (sn)",
        "settings.scan.masscanTimeout": "Masscan Zaman Aşımı (sn)",
        "settings.scan.netdiscoverTimeout": "Netdiscover Zaman Aşımı (sn)",
        "settings.scan.save": "Tarama Ayarlarını Kaydet",
        "settings.appearance.title": "Görünüm",
        "settings.appearance.theme": "Tema",
        "settings.appearance.theme.dark": "Koyu",
        "settings.appearance.theme.light": "Açık",
        "settings.appearance.language": "Dil",
        "settings.appearance.language.tr": "Türkçe",
        "settings.appearance.language.en": "English",
        "settings.appearance.save": "Görünüm Ayarlarını Uygula",
        "settings.appearance.saved": "Görünüm ayarları güncellendi.",
        "settings.system.title": "Sistem ve Proje Bilgileri",
        "settings.system.note": "Sunucudan alınan güncel sistem ve proje özeti.",
        "settings.system.project": "Proje",
        "settings.system.host": "Sunucu",
        "settings.system.resources": "Kaynaklar",
        "settings.system.projectName": "Proje Adı",
        "settings.system.shortName": "Kısa Ad",
        "settings.system.version": "Versiyon",
        "settings.system.vendor": "Üretici",
        "settings.system.repoRoot": "Proje Kök Dizini",
        "settings.system.hostname": "Host",
        "settings.system.os": "İşletim Sistemi",
        "settings.system.osDetail": "OS Detayı",
        "settings.system.python": "Python",
        "settings.system.gateway": "Gateway",
        "settings.system.network": "Ağ (IPv4)",
        "settings.system.cpu": "İşlemci",
        "settings.system.cores": "Mantıksal Çekirdek",
        "settings.system.arch": "Mimari",
        "settings.system.ram": "RAM",
        "settings.system.storage": "Depolama",
        "settings.common.unknown": "Bilinmiyor",
        "settings.field.username": "Kullanıcı Adı",
        "settings.field.fullName": "Ad Soyad",
        "settings.field.jobTitle": "İş / Ünvan",
        "settings.field.phone": "Telefon",
        "settings.field.password": "Şifre",
        "settings.field.passwordConfirm": "Şifre (Doğrula)",
        "settings.field.admin": "Yönetici",
        "settings.field.active": "Aktif",
        "settings.field.roles": "Roller",
        "settings.table.username": "Kullanıcı",
        "settings.table.fullName": "Ad Soyad",
        "settings.table.admin": "Yönetici",
        "settings.table.status": "Durum",
        "settings.table.roles": "Roller",
        "settings.table.actions": "İşlemler",
        "settings.table.save": "Kaydet",
        "settings.common.cancel": "İptal",
        "settings.common.refresh": "Yenile",
        "settings.common.yes": "Evet",
        "settings.common.no": "Hayır",
        "settings.common.active": "Aktif",
        "settings.common.inactive": "Pasif",
        "settings.common.edit": "Düzenle",
        "settings.common.delete": "Sil",
        "settings.common.admin": "Admin",
        "settings.common.activeModel": "aktif",
        "settings.users.empty": "Kullanıcı bulunamadı.",
        "settings.users.deleteConfirm": "{username} kullanıcısını silmek istiyor musunuz?",
        "settings.error.unexpectedFormat": "Beklenmeyen yanıt formatı",
        "settings.error.operationFailed": "İşlem başarısız",
        "settings.error.profileUpdate": "Profil güncellenemedi",
        "settings.error.passwordChange": "Şifre değiştirilemedi",
        "settings.error.userCreate": "Kullanıcı oluşturulamadı",
        "settings.error.userList": "Liste alınamadı",
        "settings.error.userUpdate": "Kullanıcı güncellenemedi",
        "settings.error.userDelete": "Kullanıcı silinemedi",
        "settings.error.rolesUpdate": "Roller güncellenemedi",
        "settings.error.modelRequired": "Model adı boş olamaz.",
        "settings.error.aiSave": "AI ayarları kaydedilemedi",
        "settings.error.scanSave": "Tarama ayarları kaydedilemedi",
        "settings.error.pageLoad": "Ayarlar yüklenemedi",
        activeUser: "Aktif kullanıcı",
        profileSaved: "Profil güncellendi.",
        passwordSaved: "Şifre başarıyla değiştirildi.",
        usersLoaded: "Kullanıcı listesi güncellendi.",
        userCreated: "Kullanıcı oluşturuldu.",
        userUpdated: "Kullanıcı güncellendi.",
        userDeleted: "Kullanıcı silindi.",
        rolesUpdated: "Roller güncellendi.",
        aiSaved: "AI ayarları kaydedildi.",
        scanSaved: "Tarama ayarları kaydedildi.",
        passMismatch: "Şifre alanları aynı olmalı.",
    },
    en: {
        "settings.meta.title": "SSVP Settings",
        "settings.header.title": "Settings",
        "settings.header.home": "Home",
        "settings.header.logout": "Log Out",
        "settings.tab.profile": "Edit Profile",
        "settings.tab.appearance": "Appearance",
        "settings.tab.system": "System & Project",
        "settings.tab.users": "User Management",
        "settings.tab.roles": "Role Management",
        "settings.tab.ai": "AI Model",
        "settings.tab.scan": "Scan Settings",
        "settings.profile.title": "Edit Profile",
        "settings.profile.card.profile": "Profile Information",
        "settings.profile.card.password": "Change Password",
        "settings.profile.currentPassword": "Current Password",
        "settings.profile.newPassword": "New Password",
        "settings.profile.newPasswordConfirm": "New Password (Confirm)",
        "settings.profile.save": "Save Profile",
        "settings.profile.passwordSave": "Update Password",
        "settings.users.title": "User Management",
        "settings.users.create.title": "New User",
        "settings.users.create.submit": "Add User",
        "settings.users.edit.title": "Edit User",
        "settings.users.edit.newPasswordOptional": "New Password (optional)",
        "settings.users.edit.newPasswordConfirm": "New Password (Confirm)",
        "settings.users.edit.save": "Save Changes",
        "settings.users.list.title": "Users",
        "settings.roles.title": "Role Management",
        "settings.roles.note": "Admin can bulk edit user roles on this tab.",
        "settings.ai.title": "AI Model Settings",
        "settings.ai.installedModel": "Installed Model on Server",
        "settings.ai.modelManual": "Model Name (manual)",
        "settings.ai.timeout": "AI Timeout (sec)",
        "settings.ai.url": "Ollama URL",
        "settings.ai.useDemo": "Use demo AI response",
        "settings.ai.save": "Save AI Settings",
        "settings.scan.title": "Scan Settings",
        "settings.scan.nmapTimeout": "Nmap Timeout (sec)",
        "settings.scan.masscanTimeout": "Masscan Timeout (sec)",
        "settings.scan.netdiscoverTimeout": "Netdiscover Timeout (sec)",
        "settings.scan.save": "Save Scan Settings",
        "settings.appearance.title": "Appearance",
        "settings.appearance.theme": "Theme",
        "settings.appearance.theme.dark": "Dark",
        "settings.appearance.theme.light": "Light",
        "settings.appearance.language": "Language",
        "settings.appearance.language.tr": "Türkçe",
        "settings.appearance.language.en": "English",
        "settings.appearance.save": "Apply Appearance Settings",
        "settings.appearance.saved": "Appearance settings updated.",
        "settings.system.title": "System and Project Information",
        "settings.system.note": "Live system and project summary fetched from server.",
        "settings.system.project": "Project",
        "settings.system.host": "Host",
        "settings.system.resources": "Resources",
        "settings.system.projectName": "Project Name",
        "settings.system.shortName": "Short Name",
        "settings.system.version": "Version",
        "settings.system.vendor": "Vendor",
        "settings.system.repoRoot": "Project Root",
        "settings.system.hostname": "Hostname",
        "settings.system.os": "Operating System",
        "settings.system.osDetail": "OS Detail",
        "settings.system.python": "Python",
        "settings.system.gateway": "Gateway",
        "settings.system.network": "Network (IPv4)",
        "settings.system.cpu": "CPU",
        "settings.system.cores": "Logical Cores",
        "settings.system.arch": "Architecture",
        "settings.system.ram": "RAM",
        "settings.system.storage": "Storage",
        "settings.common.unknown": "Unknown",
        "settings.field.username": "Username",
        "settings.field.fullName": "Full Name",
        "settings.field.jobTitle": "Job / Title",
        "settings.field.phone": "Phone",
        "settings.field.password": "Password",
        "settings.field.passwordConfirm": "Password (Confirm)",
        "settings.field.admin": "Admin",
        "settings.field.active": "Active",
        "settings.field.roles": "Roles",
        "settings.table.username": "Username",
        "settings.table.fullName": "Full Name",
        "settings.table.admin": "Admin",
        "settings.table.status": "Status",
        "settings.table.roles": "Roles",
        "settings.table.actions": "Actions",
        "settings.table.save": "Save",
        "settings.common.cancel": "Cancel",
        "settings.common.refresh": "Refresh",
        "settings.common.yes": "Yes",
        "settings.common.no": "No",
        "settings.common.active": "Active",
        "settings.common.inactive": "Inactive",
        "settings.common.edit": "Edit",
        "settings.common.delete": "Delete",
        "settings.common.admin": "Admin",
        "settings.common.activeModel": "active",
        "settings.users.empty": "No users found.",
        "settings.users.deleteConfirm": "Do you want to delete user {username}?",
        "settings.error.unexpectedFormat": "Unexpected response format",
        "settings.error.operationFailed": "Operation failed",
        "settings.error.profileUpdate": "Profile update failed",
        "settings.error.passwordChange": "Password change failed",
        "settings.error.userCreate": "User could not be created",
        "settings.error.userList": "List could not be loaded",
        "settings.error.userUpdate": "User could not be updated",
        "settings.error.userDelete": "User could not be deleted",
        "settings.error.rolesUpdate": "Roles could not be updated",
        "settings.error.modelRequired": "Model name cannot be empty.",
        "settings.error.aiSave": "AI settings could not be saved",
        "settings.error.scanSave": "Scan settings could not be saved",
        "settings.error.pageLoad": "Settings page could not be loaded",
        activeUser: "Active user",
        profileSaved: "Profile updated.",
        passwordSaved: "Password changed successfully.",
        usersLoaded: "User list refreshed.",
        userCreated: "User created.",
        userUpdated: "User updated.",
        userDeleted: "User deleted.",
        rolesUpdated: "Roles updated.",
        aiSaved: "AI settings saved.",
        scanSaved: "Scan settings saved.",
        passMismatch: "Password fields must match.",
    },
};

let lang = "tr";
let accessTabs = [];
let currentUser = null;
let validRoles = [];
let users = [];
let settingsConfig = null;
let systemInfoCache = null;
let workflowSteps = [];
let registryTools = [];
let registryParameters = [];


function t(key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.tr[key] || key;
}


function setFeedback(message, isError = false) {
    if (settingsFeedback) {
        settingsFeedback.innerText = "";
        settingsFeedback.classList.remove("error");
    }

    if (message && window.SSVPNotify) {
        window.SSVPNotify.show({
            message,
            type: isError ? "error" : "success",
            duration: 10000,
        });
    }
}


function normalizeTheme(value) {
    return value === "light" ? "light" : "dark";
}


function normalizeLanguage(value) {
    return value === "en" ? "en" : "tr";
}


function applyThemeAndLanguage(themeValue, languageValue) {
    const theme = normalizeTheme(themeValue ?? localStorage.getItem(THEME_STORAGE_KEY));
    lang = normalizeLanguage(languageValue ?? localStorage.getItem(LANGUAGE_STORAGE_KEY));

    document.body.classList.toggle("light-theme", theme === "light");
    document.documentElement.lang = lang;
    document.title = t("settings.meta.title");
    applyStaticI18n();

    if (appearanceTheme) {
        appearanceTheme.value = theme;
    }
    if (appearanceLanguage) {
        appearanceLanguage.value = lang;
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);

    if (systemInfoCache) {
        renderSystemInfoPanels(systemInfoCache);
    }
}


function applyStaticI18n() {
    document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.getAttribute("data-i18n");
        if (!key) {
            return;
        }
        node.textContent = t(key);
    });
}


async function apiRequest(url, options = {}) {
    const mergedOptions = {
        ...options,
        headers: {
            "Accept-Language": lang,
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
            payload = { detail: t("settings.error.unexpectedFormat") };
        }
    } else {
        payload = { detail: await response.text() };
    }

    if (!response.ok) {
        const requestError = new Error(payload.detail || payload.error || t("settings.error.operationFailed"));
        requestError.status = response.status;
        throw requestError;
    }

    return payload;
}


function hasTab(tabName) {
    return accessTabs.includes(tabName);
}


function activateTab(tabName) {
    if (!hasTab(tabName)) {
        return;
    }

    tabButtons.forEach((button) => {
        const isActive = button.dataset.tab === tabName;
        button.classList.toggle("active", isActive);
    });

    panels.forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tabName;
    });
}


function selectedRolesFrom(container) {
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map((item) => item.value);
}


function renderRolesCheckboxes(container, selected = [], disabled = false) {
    const selectedSet = new Set(selected || []);
    container.innerHTML = validRoles
        .map((roleName) => {
            const checked = selectedSet.has(roleName) ? " checked" : "";
            const disabledAttr = disabled ? " disabled" : "";
            return `<label class="chip"><input type="checkbox" value="${roleName}"${checked}${disabledAttr}><span>${roleName}</span></label>`;
        })
        .join("");
}


function canManageUser(user) {
    if (!currentUser || !user) {
        return false;
    }

    if (currentUser.is_admin) {
        return true;
    }

    return !user.is_admin;
}


function safeText(value) {
    if (value === null || value === undefined || value === "") {
        return t("settings.common.unknown");
    }
    return String(value);
}


function formatGiB(total, free = null) {
    const totalText = total != null ? `${Number(total).toFixed(2)} GiB` : t("settings.common.unknown");
    if (free == null) {
        return totalText;
    }
    return `${totalText} / ${Number(free).toFixed(2)} GiB`;
}


function renderInfoList(container, rows) {
    if (!container) {
        return;
    }

    container.innerHTML = rows.map((row) => {
        return `<div><dt>${row.label}</dt><dd>${row.value}</dd></div>`;
    }).join("");
}


function renderSystemInfoPanels(data) {
    const project = data?.project || {};
    const system = data?.system || {};
    const cpu = system.cpu || {};
    const memory = system.memory || {};
    const storage = system.storage || {};
    const network = system.network || {};
    const interfaces = Array.isArray(network.interfaces) ? network.interfaces : [];
    const networkText = interfaces.length > 0
        ? interfaces.map((item) => `${item.interface}: ${item.ip} (${item.cidr})`).join(" | ")
        : t("settings.common.unknown");
    const gatewayText = network.gateway || t("settings.common.unknown");

    renderInfoList(projectInfoList, [
        { label: t("settings.system.projectName"), value: safeText(project.name) },
        { label: t("settings.system.shortName"), value: safeText(project.short_name) },
        { label: t("settings.system.version"), value: safeText(project.version) },
        { label: t("settings.system.vendor"), value: safeText(project.vendor) },
        { label: t("settings.system.repoRoot"), value: safeText(project.repository_root) },
    ]);

    renderInfoList(hostInfoList, [
        { label: t("settings.system.hostname"), value: safeText(system.hostname) },
        { label: t("settings.system.os"), value: safeText(system.os) },
        { label: t("settings.system.osDetail"), value: safeText(system.os_detail) },
        { label: t("settings.system.python"), value: safeText(system.python_version) },
        { label: t("settings.system.gateway"), value: gatewayText },
        { label: t("settings.system.network"), value: networkText },
    ]);

    renderInfoList(resourceInfoList, [
        { label: t("settings.system.cpu"), value: safeText(cpu.name) },
        { label: t("settings.system.cores"), value: safeText(cpu.logical_cores) },
        { label: t("settings.system.arch"), value: safeText(cpu.architecture) },
        { label: t("settings.system.ram"), value: formatGiB(memory.total_gib, memory.available_gib) },
        { label: t("settings.system.storage"), value: formatGiB(storage.total_gib, storage.free_gib) },
    ]);
}


async function loadSystemInfo(force = false) {
    if (systemInfoCache && !force) {
        renderSystemInfoPanels(systemInfoCache);
        return;
    }

    systemInfoCache = await apiRequest("/settings/system-info", { cache: "no-store" });
    renderSystemInfoPanels(systemInfoCache);
}


function syncCreateRolesWithAdmin() {
    const roleInputs = newUserRoles.querySelectorAll('input[type="checkbox"]');
    if (newIsAdmin.checked) {
        roleInputs.forEach((item) => {
            item.checked = true;
            item.disabled = true;
        });
    } else {
        roleInputs.forEach((item) => {
            item.disabled = false;
        });
    }
}


function resetEditForm() {
    if (!editUserForm || !createUserForm) {
        return;
    }

    editUserForm.hidden = true;
    createUserForm.hidden = false;
    editUserForm.reset();
    if (editUserRoles) {
        editUserRoles.innerHTML = "";
    }
}


function openEditForm(user) {
    const canManage = canManageUser(user);

    createUserForm.hidden = true;
    editUserForm.hidden = false;
    editUserId.value = user.id;
    editUsername.value = user.username || "";
    editFullName.value = user.full_name || "";
    editJobTitle.value = user.job_title || "";
    editPhone.value = user.phone || "";
    editIsAdmin.checked = Boolean(user.is_admin);
    editIsActive.checked = Boolean(user.is_active);
    editNewPassword.value = "";
    editNewPasswordConfirm.value = "";

    editUsername.disabled = !canManage;
    editFullName.disabled = !canManage;
    editJobTitle.disabled = !canManage;
    editPhone.disabled = !canManage;
    editIsActive.disabled = !canManage;
    editIsAdmin.disabled = !currentUser?.is_admin || !canManage;

    renderRolesCheckboxes(editUserRoles, user.roles || [], !canManage || (user.is_admin && !currentUser?.is_admin));
}


function renderUsersTable() {
    if (!users.length) {
        usersTbody.innerHTML = `<tr><td colspan="6">${t("settings.users.empty")}</td></tr>`;
        return;
    }

    usersTbody.innerHTML = users
        .map((item) => {
            const canManage = canManageUser(item);
            const isSelf = Number(item.id) === Number(currentUser?.id);
            return `
                <tr>
                    <td>${item.username || ""}</td>
                    <td>${item.full_name || "-"}</td>
                    <td>${item.is_admin ? t("settings.common.yes") : t("settings.common.no")}</td>
                    <td>${item.is_active ? t("settings.common.active") : t("settings.common.inactive")}</td>
                    <td>${(item.roles || []).join(", ") || "-"}</td>
                    <td>
                        <div class="actions">
                            <button data-action="edit" data-user-id="${item.id}"${canManage ? "" : " disabled"}>${t("settings.common.edit")}</button>
                            <button data-action="delete" data-user-id="${item.id}"${canManage && !isSelf ? "" : " disabled"}>${t("settings.common.delete")}</button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}


function renderRoleManagementTable() {
    if (!hasTab("roles")) {
        return;
    }

    rolesTbody.innerHTML = users
        .map((item) => {
            const rolesDisabled = item.is_admin ? " disabled" : "";
            const roleControls = validRoles.map((roleName) => {
                const checked = (item.roles || []).includes(roleName) ? " checked" : "";
                return `<label class="chip"><input type="checkbox" data-role="${roleName}"${checked}${rolesDisabled}><span>${roleName}</span></label>`;
            }).join("");

            const adminChecked = item.is_admin ? " checked" : "";
            const adminDisabled = !currentUser?.is_admin ? " disabled" : "";

            return `
                <tr>
                    <td>${item.username}</td>
                    <td><label class="chip"><input type="checkbox" data-admin="1"${adminChecked}${adminDisabled}><span>${t("settings.common.admin")}</span></label></td>
                    <td><div class="roles-grid">${roleControls}</div></td>
                    <td><button data-action="save-roles" data-user-id="${item.id}">${t("settings.table.save")}</button></td>
                </tr>
            `;
        })
        .join("");
}


function syncRoleRowWithAdmin(row) {
    if (!row) {
        return;
    }

    const adminInput = row.querySelector('input[data-admin]');
    if (!adminInput) {
        return;
    }

    const roleInputs = row.querySelectorAll('input[data-role]');
    if (adminInput.checked) {
        roleInputs.forEach((input) => {
            input.checked = true;
            input.disabled = true;
        });
    } else {
        roleInputs.forEach((input) => {
            input.disabled = false;
        });
    }
}


async function loadUsersAndRoles() {
    const [rolesData, usersData] = await Promise.all([
        apiRequest("/roles", { cache: "no-store" }),
        apiRequest("/users", { cache: "no-store" }),
    ]);

    validRoles = rolesData.roles || [];
    users = usersData.items || [];

    renderRolesCheckboxes(newUserRoles, []);
    newIsAdmin.disabled = !Boolean(currentUser?.is_admin);
    syncCreateRolesWithAdmin();
    renderUsersTable();
    renderRoleManagementTable();
}


async function loadSettingsConfig() {
    settingsConfig = await apiRequest("/settings/config", { cache: "no-store" });
}


async function loadAiModels() {
    const data = await apiRequest("/settings/ai-models", { cache: "no-store" });
    const models = data.models || [];

    aiModelSelect.innerHTML = models.map((name) => `<option value="${name}">${name}</option>`).join("");

    const active = data.active_model || settingsConfig?.ai?.model_name || "";
    if (active) {
        if (!models.includes(active)) {
            const opt = document.createElement("option");
            opt.value = active;
            opt.textContent = `${active} (${t("settings.common.activeModel")})`;
            aiModelSelect.appendChild(opt);
        }
        aiModelSelect.value = active;
        aiModelManual.value = active;
    }
}


function renderWorkflowStepsTable() {
    if (!workflowStepsTbody) {
        return;
    }

    if (!workflowSteps.length) {
        workflowStepsTbody.innerHTML = "<tr><td colspan='7'>Step bulunamadı.</td></tr>";
        return;
    }

    workflowStepsTbody.innerHTML = workflowSteps.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.step_key}</td>
                <td>${item.step_name}</td>
                <td>${item.role_required}</td>
                <td>${item.sort_order}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td><button data-action="toggle-step" data-step-id="${item.id}">${item.is_active ? "Pasifleştir" : "Aktifleştir"}</button></td>
            </tr>
        `;
    }).join("");
}


async function loadWorkflowSteps() {
    const data = await apiRequest("/settings/workflow-steps", { cache: "no-store" });
    workflowSteps = Array.isArray(data.items) ? data.items : [];
    renderWorkflowStepsTable();
}


function renderToolsTable() {
    if (!toolsTbody) {
        return;
    }

    if (!registryTools.length) {
        toolsTbody.innerHTML = "<tr><td colspan='8'>Tool bulunamadı.</td></tr>";
        return;
    }

    toolsTbody.innerHTML = registryTools.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.action_key}</td>
                <td>${item.tool_name}</td>
                <td>${item.risk_level}</td>
                <td>${item.timeout_sec}</td>
                <td>${item.requires_approval ? "yes" : "no"}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <button data-action="load-params" data-tool-id="${item.id}">Parametreler</button>
                    <button data-action="toggle-tool" data-tool-id="${item.id}">${item.is_active ? "Pasifleştir" : "Aktifleştir"}</button>
                </td>
            </tr>
        `;
    }).join("");
}


function renderToolParametersTable() {
    if (!toolParametersTbody) {
        return;
    }

    if (!registryParameters.length) {
        toolParametersTbody.innerHTML = "<tr><td colspan='5'>Parametre bulunamadı.</td></tr>";
        return;
    }

    toolParametersTbody.innerHTML = registryParameters.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.tool_id}</td>
                <td>${item.param_key}</td>
                <td>${item.param_type}</td>
                <td>${String(item.default_value || "")}</td>
            </tr>
        `;
    }).join("");
}


async function loadTools() {
    const data = await apiRequest("/settings/tool-registry", { cache: "no-store" });
    registryTools = Array.isArray(data.items) ? data.items : [];
    renderToolsTable();
}


async function loadToolParameters(toolId) {
    const data = await apiRequest(`/settings/tool-registry/${toolId}/parameters`, { cache: "no-store" });
    registryParameters = Array.isArray(data.items) ? data.items : [];
    renderToolParametersTable();
}


function hydrateAdminSettingsForms() {
    if (!settingsConfig) {
        return;
    }

    if (settingsConfig.ai) {
        aiTimeout.value = settingsConfig.ai.timeout_sec || 240;
        aiUrl.value = settingsConfig.ai.ollama_url || "http://localhost:11434/api/chat";
        aiFakeResponse.checked = Boolean(settingsConfig.ai.use_fake_response);
        aiModelManual.value = settingsConfig.ai.model_name || "";
    }

    if (settingsConfig.scan) {
        nmapTimeout.value = settingsConfig.scan.nmap_timeout_sec || 600;
        masscanTimeout.value = settingsConfig.scan.masscan_timeout_sec || 600;
        netdiscoverTimeout.value = settingsConfig.scan.netdiscover_timeout_sec || 180;
    }
}


async function initializeAccess() {
    const access = await apiRequest("/settings/access", { cache: "no-store" });
    currentUser = access.user;
    const availableTabSet = new Set(tabButtons.map((button) => button.dataset.tab));
    accessTabs = (access.tabs || []).filter((tabName) => availableTabSet.has(tabName));
    if (!accessTabs.length) {
        accessTabs = ["system"];
    }
    validRoles = access.valid_roles || [];

    settingsInfo.innerText = `${t("activeUser")}: ${currentUser.username}`;

    applyThemeAndLanguage(currentUser.ui_theme, currentUser.ui_language);

    if (settingsMenuToggle) {
        const username = currentUser?.username || "U";
        settingsMenuToggle.innerText = String(username).slice(0, 1).toUpperCase();
        settingsMenuToggle.setAttribute("title", username);
    }

    if (settingsMenuPanel) {
        settingsMenuPanel.style.display = currentUser?.is_admin ? "block" : "none";
    }

    tabButtons.forEach((button) => {
        const allowed = accessTabs.includes(button.dataset.tab);
        button.hidden = !allowed;
    });

    const requested = String(window.location.hash || "").replace("#", "").trim();
    const firstTab = accessTabs.includes(requested) ? requested : (accessTabs[0] || "system");
    activateTab(firstTab);

    if (hasTab("users") || hasTab("roles")) {
        await loadUsersAndRoles();
    }

    if (hasTab("ai") || hasTab("scan")) {
        await loadSettingsConfig();
        hydrateAdminSettingsForms();
    }

    if (hasTab("workflow")) {
        await loadWorkflowSteps();
    }

    if (hasTab("tools")) {
        await loadTools();
    }

    if (hasTab("ai")) {
        await loadAiModels();
    }

    if (hasTab("system")) {
        await loadSystemInfo();
    }
}


tabButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        const tab = button.dataset.tab;
        activateTab(tab);

        if ((tab === "users" || tab === "roles") && hasTab("users")) {
            await loadUsersAndRoles();
            if (tab === "users") {
                resetEditForm();
            }
        }

        if ((tab === "ai" || tab === "scan") && hasTab("ai")) {
            await loadSettingsConfig();
            hydrateAdminSettingsForms();
            if (tab === "ai") {
                await loadAiModels();
            }
        }

        if (tab === "system" && hasTab("system")) {
            await loadSystemInfo(true);
        }

        if (tab === "workflow" && hasTab("workflow")) {
            await loadWorkflowSteps();
        }

        if (tab === "tools" && hasTab("tools")) {
            await loadTools();
        }
    });
});


if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener("click", async () => {
        try {
            await apiRequest("/auth/logout", { method: "POST" });
        } catch (_) {
            // no-op
        }
        window.location.href = "/";
    });
}

if (settingsMenuToggle && settingsMenuPopover) {
    settingsMenuToggle.addEventListener("click", (event) => {
        event.stopPropagation();
        settingsMenuPopover.hidden = !settingsMenuPopover.hidden;
    });

    document.addEventListener("click", (event) => {
        if (!settingsMenuWrap?.contains(event.target)) {
            settingsMenuPopover.hidden = true;
        }
    });
}

if (settingsMenuProfile) {
    settingsMenuProfile.addEventListener("click", () => {
        settingsMenuPopover.hidden = true;
        window.location.href = "/panel#profile";
    });
}

if (settingsMenuSystem) {
    settingsMenuSystem.addEventListener("click", () => {
        settingsMenuPopover.hidden = true;
        activateTab("system");
    });
}

if (settingsMenuPanel) {
    settingsMenuPanel.addEventListener("click", () => {
        settingsMenuPopover.hidden = true;
        window.location.href = "/panel";
    });
}

if (settingsMenuApp) {
    settingsMenuApp.addEventListener("click", () => {
        settingsMenuPopover.hidden = true;
        window.location.href = "/app";
    });
}


if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = await apiRequest("/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: profileUsername.value.trim(),
                    full_name: profileFullName.value.trim(),
                    job_title: profileJobTitle.value.trim(),
                    phone: profilePhone.value.trim(),
                }),
            });

            currentUser = payload.item;
            settingsInfo.innerText = `${t("activeUser")}: ${currentUser.username}`;
            setFeedback(t("profileSaved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.profileUpdate"), true);
        }
    });
}


if (profilePasswordForm) {
    profilePasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = profileCurrentPassword.value;
        const newPasswordValue = profileNewPassword.value;
        const confirmPassword = profileNewPasswordConfirm.value;

        if (newPasswordValue !== confirmPassword) {
            setFeedback(t("passMismatch"), true);
            return;
        }

        try {
            await apiRequest("/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPasswordValue,
                }),
            });

            profilePasswordForm.reset();
            setFeedback(t("passwordSaved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.passwordChange"), true);
        }
    });
}


if (createUserForm) {
    createUserForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!hasTab("users")) {
            return;
        }

        if (newPassword.value !== newPasswordConfirm.value) {
            setFeedback(t("passMismatch"), true);
            return;
        }

        try {
            const isAdmin = newIsAdmin.checked;
            const roles = isAdmin ? [...validRoles] : selectedRolesFrom(newUserRoles);

            await apiRequest("/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: newUsername.value.trim(),
                    full_name: newFullName.value.trim(),
                    job_title: newJobTitle.value.trim(),
                    phone: newPhone.value.trim(),
                    password: newPassword.value,
                    is_admin: isAdmin,
                    roles,
                }),
            });

            createUserForm.reset();
            renderRolesCheckboxes(newUserRoles, []);
            syncCreateRolesWithAdmin();
            await loadUsersAndRoles();
            setFeedback(t("userCreated"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.userCreate"), true);
        }
    });
}


if (newIsAdmin) {
    newIsAdmin.addEventListener("change", syncCreateRolesWithAdmin);
}


if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener("click", async () => {
        try {
            await loadUsersAndRoles();
            setFeedback(t("usersLoaded"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.userList"), true);
        }
    });
}


if (usersTbody) {
    usersTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const userId = Number(button.dataset.userId || "0");
        const user = users.find((item) => Number(item.id) === userId);
        if (!user) {
            return;
        }

        const action = button.dataset.action;
        if (action === "edit") {
            openEditForm(user);
            return;
        }

        if (action === "delete") {
            const confirmed = window.confirm(t("settings.users.deleteConfirm").replace("{username}", user.username));
            if (!confirmed) {
                return;
            }

            try {
                await apiRequest(`/users/${userId}`, { method: "DELETE" });
                await loadUsersAndRoles();
                resetEditForm();
                setFeedback(t("userDeleted"));
            } catch (error) {
                setFeedback(error.message || t("settings.error.userDelete"), true);
            }
        }
    });
}


if (editUserForm) {
    editUserForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const userId = Number(editUserId.value || "0");
        const newPass = editNewPassword.value;
        const newPassConfirm = editNewPasswordConfirm.value;

        if (newPass || newPassConfirm) {
            if (newPass !== newPassConfirm) {
                setFeedback(t("passMismatch"), true);
                return;
            }
        }

        try {
            await apiRequest(`/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: editUsername.value.trim(),
                    full_name: editFullName.value.trim(),
                    job_title: editJobTitle.value.trim(),
                    phone: editPhone.value.trim(),
                    is_admin: editIsAdmin.checked,
                    is_active: editIsActive.checked,
                    roles: selectedRolesFrom(editUserRoles),
                    new_password: newPass || null,
                    new_password_confirm: newPassConfirm || null,
                }),
            });

            await loadUsersAndRoles();
            resetEditForm();
            setFeedback(t("userUpdated"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.userUpdate"), true);
        }
    });
}


if (cancelEditUserBtn) {
    cancelEditUserBtn.addEventListener("click", () => {
        resetEditForm();
    });
}


if (rolesTbody) {
    rolesTbody.addEventListener("change", (event) => {
        const adminInput = event.target.closest('input[data-admin]');
        if (!adminInput) {
            return;
        }

        syncRoleRowWithAdmin(adminInput.closest("tr"));
    });
}


if (rolesTbody) {
    rolesTbody.addEventListener("click", async (event) => {
        const button = event.target.closest('button[data-action="save-roles"]');
        if (!button) {
            return;
        }

        const userId = Number(button.dataset.userId || "0");
        const row = button.closest("tr");
        const target = users.find((item) => Number(item.id) === userId);
        if (!row || !target) {
            return;
        }

        const roles = Array.from(row.querySelectorAll('input[data-role]:checked')).map((item) => item.dataset.role);
        const isAdminChecked = Boolean(row.querySelector('input[data-admin]:checked'));

        try {
            await apiRequest(`/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: target.username,
                    full_name: target.full_name || "",
                    job_title: target.job_title || "",
                    phone: target.phone || "",
                    is_active: target.is_active,
                    is_admin: isAdminChecked,
                    roles,
                }),
            });

            await loadUsersAndRoles();
            setFeedback(t("rolesUpdated"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.rolesUpdate"), true);
        }
    });
}


if (aiModelSelect && aiModelManual) {
    aiModelSelect.addEventListener("change", () => {
        aiModelManual.value = aiModelSelect.value || "";
    });
}


if (aiSettingsForm) {
    aiSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!hasTab("ai")) {
            return;
        }

        const modelName = (aiModelManual.value || aiModelSelect.value || "").trim();
        if (!modelName) {
            setFeedback(t("settings.error.modelRequired"), true);
            return;
        }

        try {
            await apiRequest("/settings/ai", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model_name: modelName,
                    timeout_sec: Number(aiTimeout.value || 240),
                    use_fake_response: Boolean(aiFakeResponse.checked),
                    ollama_url: aiUrl.value.trim(),
                }),
            });

            setFeedback(t("aiSaved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.aiSave"), true);
        }
    });
}


if (scanSettingsForm) {
    scanSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!hasTab("scan")) {
            return;
        }

        try {
            await apiRequest("/settings/scan", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nmap_timeout_sec: Number(nmapTimeout.value || 600),
                    masscan_timeout_sec: Number(masscanTimeout.value || 600),
                    netdiscover_timeout_sec: Number(netdiscoverTimeout.value || 180),
                }),
            });

            setFeedback(t("scanSaved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.scanSave"), true);
        }
    });
}


if (appearanceForm) {
    appearanceForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const nextTheme = appearanceTheme?.value === "light" ? "light" : "dark";
        const nextLang = appearanceLanguage?.value === "en" ? "en" : "tr";

        try {
            const payload = await apiRequest("/settings/appearance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ui_theme: nextTheme,
                    ui_language: nextLang,
                }),
            });

            currentUser = payload.item || currentUser;
            applyThemeAndLanguage(currentUser?.ui_theme, currentUser?.ui_language);
            setFeedback(t("settings.appearance.saved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.operationFailed"), true);
        }
    });
}


if (refreshWorkflowStepsBtn) {
    refreshWorkflowStepsBtn.addEventListener("click", async () => {
        try {
            await loadWorkflowSteps();
            setFeedback("Workflow step listesi güncellendi.");
        } catch (error) {
            setFeedback(error.message || "Workflow step listesi alınamadı.", true);
        }
    });
}


if (workflowStepForm) {
    workflowStepForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            await apiRequest("/settings/workflow-steps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    step_key: workflowStepKey.value.trim(),
                    step_name: workflowStepName.value.trim(),
                    description: workflowStepDescription.value.trim(),
                    sort_order: Number(workflowStepOrder.value || 100),
                    role_required: workflowStepRole.value.trim() || "test",
                    ai_prompt_hint: workflowStepHint.value.trim(),
                    is_active: Boolean(workflowStepActive.checked),
                }),
            });

            workflowStepForm.reset();
            workflowStepOrder.value = "100";
            workflowStepActive.checked = true;
            await loadWorkflowSteps();
            setFeedback("Workflow step eklendi.");
        } catch (error) {
            setFeedback(error.message || "Workflow step eklenemedi.", true);
        }
    });
}


if (workflowStepsTbody) {
    workflowStepsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action='toggle-step']");
        if (!button) {
            return;
        }

        const stepId = Number(button.dataset.stepId || "0");
        const target = workflowSteps.find((item) => Number(item.id) === stepId);
        if (!target) {
            return;
        }

        try {
            await apiRequest(`/settings/workflow-steps/${stepId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !target.is_active }),
            });
            await loadWorkflowSteps();
            setFeedback("Workflow step güncellendi.");
        } catch (error) {
            setFeedback(error.message || "Workflow step güncellenemedi.", true);
        }
    });
}


if (refreshToolsBtn) {
    refreshToolsBtn.addEventListener("click", async () => {
        try {
            await loadTools();
            setFeedback("Tool registry güncellendi.");
        } catch (error) {
            setFeedback(error.message || "Tool registry alınamadı.", true);
        }
    });
}


if (toolRegistryForm) {
    toolRegistryForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            await apiRequest("/settings/tool-registry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action_key: toolActionKey.value.trim(),
                    display_name: toolDisplayName.value.trim(),
                    tool_name: toolName.value.trim(),
                    tool_type: "scanner",
                    module_path: "",
                    executable_path: "",
                    base_command: toolBaseCommand.value.trim(),
                    risk_level: toolRiskLevel.value,
                    timeout_sec: Number(toolTimeout.value || 300),
                    requires_approval: Boolean(toolRequiresApproval.checked),
                    wordlist_path: "",
                    payload_path: "",
                    template_path: "",
                    is_active: Boolean(toolActive.checked),
                }),
            });

            toolRegistryForm.reset();
            toolRiskLevel.value = "low";
            toolTimeout.value = "300";
            toolRequiresApproval.checked = true;
            toolActive.checked = true;
            await loadTools();
            setFeedback("Tool registry kaydı eklendi.");
        } catch (error) {
            setFeedback(error.message || "Tool registry kaydı eklenemedi.", true);
        }
    });
}


if (toolsTbody) {
    toolsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const toolId = Number(button.dataset.toolId || "0");
        const target = registryTools.find((item) => Number(item.id) === toolId);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "load-params") {
            parameterToolId.value = String(toolId);
            await loadToolParameters(toolId);
            return;
        }

        if (action === "toggle-tool") {
            try {
                await apiRequest(`/settings/tool-registry/${toolId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: !target.is_active }),
                });
                await loadTools();
                setFeedback("Tool kaydı güncellendi.");
            } catch (error) {
                setFeedback(error.message || "Tool kaydı güncellenemedi.", true);
            }
        }
    });
}


if (toolParameterForm) {
    toolParameterForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const toolId = Number(parameterToolId.value || "0");
        if (!toolId) {
            setFeedback("Önce geçerli bir Tool ID girin.", true);
            return;
        }

        let optionsJson = {};
        let defaultValue = parameterDefault.value.trim();
        if (parameterType.value === "list" || parameterType.value === "json") {
            try {
                const parsed = defaultValue ? JSON.parse(defaultValue) : (parameterType.value === "list" ? [] : {});
                defaultValue = JSON.stringify(parsed);
                optionsJson = parameterType.value === "list" ? parsed : {};
            } catch (_) {
                setFeedback("Default value JSON formatında olmalı.", true);
                return;
            }
        }

        try {
            await apiRequest(`/settings/tool-registry/${toolId}/parameters`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    param_key: parameterKey.value.trim(),
                    label: parameterLabel.value.trim(),
                    param_type: parameterType.value,
                    default_value: defaultValue,
                    is_required: false,
                    is_editable: true,
                    options_json: optionsJson,
                    sort_order: 100,
                }),
            });

            toolParameterForm.reset();
            parameterType.value = "string";
            parameterToolId.value = String(toolId);
            await loadToolParameters(toolId);
            setFeedback("Tool parameter eklendi.");
        } catch (error) {
            setFeedback(error.message || "Tool parameter eklenemedi.", true);
        }
    });
}


(async function bootstrap() {
    try {
        applyThemeAndLanguage();
        await initializeAccess();
        resetEditForm();
    } catch (error) {
        setFeedback(error.message || t("settings.error.pageLoad"), true);
        if (error && Number(error.status) === 401) {
            window.location.href = "/?login=1";
        }
    }
})();
