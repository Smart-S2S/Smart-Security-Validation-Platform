const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const panels = Array.from(document.querySelectorAll('[data-panel]'));
const THEME_STORAGE_KEY = 'ssvp-theme';

const offersTbody = document.getElementById('offersTbody');
const panelFeedback = document.getElementById('panelFeedback');
const refreshOffersBtn = document.getElementById('refreshOffersBtn');

const profileForm = document.getElementById('profileForm');
const profileUsername = document.getElementById('profileUsername');
const profileFullName = document.getElementById('profileFullName');
const profileJobTitle = document.getElementById('profileJobTitle');
const profilePhone = document.getElementById('profilePhone');
const profilePasswordForm = document.getElementById('profilePasswordForm');
const profileCurrentPassword = document.getElementById('profileCurrentPassword');
const profileNewPassword = document.getElementById('profileNewPassword');
const profileNewPasswordConfirm = document.getElementById('profileNewPasswordConfirm');

const createUserForm = document.getElementById('createUserForm');
const newUsername = document.getElementById('newUsername');
const newFullName = document.getElementById('newFullName');
const newJobTitle = document.getElementById('newJobTitle');
const newPhone = document.getElementById('newPhone');
const newPassword = document.getElementById('newPassword');
const newPasswordConfirm = document.getElementById('newPasswordConfirm');
const newIsAdmin = document.getElementById('newIsAdmin');
const newUserRoles = document.getElementById('newUserRoles');
const refreshUsersBtn = document.getElementById('refreshUsersBtn');
const usersTbody = document.getElementById('usersTbody');

const editUserForm = document.getElementById('editUserForm');
const editUserId = document.getElementById('editUserId');
const editUsername = document.getElementById('editUsername');
const editFullName = document.getElementById('editFullName');
const editJobTitle = document.getElementById('editJobTitle');
const editPhone = document.getElementById('editPhone');
const editIsAdmin = document.getElementById('editIsAdmin');
const editIsActive = document.getElementById('editIsActive');
const editUserRoles = document.getElementById('editUserRoles');
const editNewPassword = document.getElementById('editNewPassword');
const editNewPasswordConfirm = document.getElementById('editNewPasswordConfirm');
const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');

const rolesTbody = document.getElementById('rolesTbody');

const panelLogoutBtn = document.getElementById('panelLogoutBtn');
const panelMenuWrap = document.getElementById('panelMenuWrap');
const panelMenuToggle = document.getElementById('panelMenuToggle');
const panelMenuPopover = document.getElementById('panelMenuPopover');
const panelMenuProfile = document.getElementById('panelMenuProfile');
const panelMenuSettings = document.getElementById('panelMenuSettings');
const panelMenuPanel = document.getElementById('panelMenuPanel');
const panelMenuApp = document.getElementById('panelMenuApp');

let currentUser = null;
let validRoles = [];
let users = [];
let currentLanguage = 'tr';

const PANEL_I18N = {
    tr: {
        role: {
            attack: 'Saldırı',
            remediation: 'İyileştirme',
            test: 'Test',
            user_management: 'Kullanıcı Yönetimi',
        },
        offerStatus: {
            new: 'Yeni',
            reviewed: 'İncelendi',
            approved: 'Onaylandi',
            rejected: 'Reddedildi',
        },
    },
    en: {
        role: {
            attack: 'Attack',
            remediation: 'Remediation',
            test: 'Test',
            user_management: 'User Management',
        },
        offerStatus: {
            new: 'New',
            reviewed: 'Reviewed',
            approved: 'Approved',
            rejected: 'Rejected',
        },
    },
};

function tRole(roleName) {
    return PANEL_I18N[currentLanguage]?.role?.[roleName] || roleName;
}

function tOfferStatus(statusName) {
    return PANEL_I18N[currentLanguage]?.offerStatus?.[statusName] || statusName;
}

function normalizeTheme(value) {
    return value === 'light' ? 'light' : 'dark';
}

function applyTheme(themeValue) {
    const normalized = normalizeTheme(themeValue);
    document.body.classList.toggle('light-theme', normalized === 'light');
}

function setFeedback(message, level = 'success') {
    const isError = level === true || level === 'error';
    const normalized = isError ? 'error' : (typeof level === 'string' ? level : 'success');

    if (panelFeedback) {
        panelFeedback.textContent = '';
    }

    if (message && window.SSVPNotify) {
        window.SSVPNotify.show({ message, type: normalized, duration: 10000 });
    }
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Accept-Language': currentLanguage,
            ...(options.headers || {}),
        },
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch (_) {
        payload = {};
    }

    if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'İşlem başarısız');
    }

    return payload;
}

function activateTab(tabName) {
    tabButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.tab === tabName);
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
    container.innerHTML = validRoles.map((roleName) => {
        const checked = selectedSet.has(roleName) ? ' checked' : '';
        const disabledAttr = disabled ? ' disabled' : '';
        return `<label><input type="checkbox" value="${roleName}"${checked}${disabledAttr}><span>${tRole(roleName)}</span></label>`;
    }).join('');
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
    editUserRoles.innerHTML = '';
}

function openEditForm(user) {
    const canManage = canManageUser(user);
    createUserForm.hidden = true;
    editUserForm.hidden = false;

    editUserId.value = user.id;
    editUsername.value = user.username || '';
    editFullName.value = user.full_name || '';
    editJobTitle.value = user.job_title || '';
    editPhone.value = user.phone || '';
    editIsAdmin.checked = Boolean(user.is_admin);
    editIsActive.checked = Boolean(user.is_active);
    editNewPassword.value = '';
    editNewPasswordConfirm.value = '';

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
        usersTbody.innerHTML = '<tr><td colspan="6">Kullanıcı bulunamadı.</td></tr>';
        return;
    }

    usersTbody.innerHTML = users.map((item) => {
        const canManage = canManageUser(item);
        const isSelf = Number(item.id) === Number(currentUser?.id);
        return `
            <tr>
                <td>${item.username || ''}</td>
                <td>${item.full_name || '-'}</td>
                <td>${item.is_admin ? 'Evet' : 'Hayır'}</td>
                <td>${item.is_active ? 'Aktif' : 'Pasif'}</td>
                <td>${(item.roles || []).map((roleName) => tRole(roleName)).join(', ') || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn" data-action="edit" data-user-id="${item.id}"${canManage ? '' : ' disabled'}>Düzenle</button>
                        <button class="btn" data-action="delete" data-user-id="${item.id}"${canManage && !isSelf ? '' : ' disabled'}>Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function syncRoleRowWithAdmin(row) {
    const adminInput = row?.querySelector('input[data-admin]');
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

function renderRoleManagementTable() {
    rolesTbody.innerHTML = users.map((item) => {
        const rolesDisabled = item.is_admin ? ' disabled' : '';
        const roleControls = validRoles.map((roleName) => {
            const checked = (item.roles || []).includes(roleName) ? ' checked' : '';
            return `<label><input type="checkbox" data-role="${roleName}"${checked}${rolesDisabled}><span>${tRole(roleName)}</span></label>`;
        }).join('');
        const adminChecked = item.is_admin ? ' checked' : '';
        return `
            <tr>
                <td>${item.username}</td>
                <td><label><input type="checkbox" data-admin="1"${adminChecked}><span>Admin</span></label></td>
                <td><div class="roles-grid">${roleControls}</div></td>
                <td><button class="btn" data-action="save-roles" data-user-id="${item.id}">Kaydet</button></td>
            </tr>
        `;
    }).join('');
}

function renderOffers(items) {
    if (!offersTbody) {
        return;
    }

    if (!Array.isArray(items) || !items.length) {
        offersTbody.innerHTML = '<tr><td colspan="9">Henüz teklif yok.</td></tr>';
        return;
    }

    offersTbody.innerHTML = items.map((item) => {
        const safeMessage = String(item.message || '').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        return `
            <tr>
                <td>${item.id || ''}</td>
                <td>${item.created_at || ''}</td>
                <td>${item.name || ''}</td>
                <td>${item.email || ''}</td>
                <td>${item.company || ''}</td>
                <td>${item.phone || ''}</td>
                <td><textarea class="offer-message" readonly>${safeMessage}</textarea></td>
                <td>
                    <select class="status-select" data-role="status" data-id="${item.id}">
                        <option value="new" ${item.status === 'new' ? 'selected' : ''}>${tOfferStatus('new')}</option>
                        <option value="reviewed" ${item.status === 'reviewed' ? 'selected' : ''}>${tOfferStatus('reviewed')}</option>
                        <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>${tOfferStatus('approved')}</option>
                        <option value="rejected" ${item.status === 'rejected' ? 'selected' : ''}>${tOfferStatus('rejected')}</option>
                    </select>
                </td>
                <td><button class="btn" data-role="save" data-id="${item.id}">Kaydet</button></td>
            </tr>
        `;
    }).join('');
}

async function loadOffers() {
    const data = await apiRequest('/panel/offers', { cache: 'no-store' });
    renderOffers(data.items || []);
}

async function loadCurrentUser() {
    currentUser = await apiRequest('/auth/me', { cache: 'no-store' });
    currentLanguage = currentUser?.ui_language === 'en' ? 'en' : 'tr';
    const preferredTheme = currentUser?.ui_theme || localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    applyTheme(preferredTheme);
    localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(preferredTheme));

    if (panelMenuToggle) {
        const username = currentUser?.username || 'U';
        panelMenuToggle.textContent = String(username).slice(0, 1).toUpperCase();
        panelMenuToggle.title = username;
    }

    if (panelMenuPanel) {
        panelMenuPanel.style.display = currentUser?.is_admin ? 'block' : 'none';
    }
}

async function initializePanelData() {
    profileUsername.value = currentUser?.username || '';
    profileFullName.value = currentUser?.full_name || '';
    profileJobTitle.value = currentUser?.job_title || '';
    profilePhone.value = currentUser?.phone || '';

    if (!currentUser?.is_admin) {
        return;
    }

    const access = await apiRequest('/settings/access', { cache: 'no-store' });
    validRoles = access.valid_roles || [];

    const [rolesData, usersData] = await Promise.all([
        apiRequest('/roles', { cache: 'no-store' }),
        apiRequest('/users', { cache: 'no-store' }),
    ]);
    validRoles = rolesData.roles || validRoles;
    users = usersData.items || [];
    renderRolesCheckboxes(newUserRoles, []);
    syncCreateRolesWithAdmin();
    renderUsersTable();
    renderRoleManagementTable();
    resetEditForm();
}

tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
        activateTab(button.dataset.tab);
    });
});

if (refreshOffersBtn) {
    refreshOffersBtn.addEventListener('click', async () => {
        try {
            await loadOffers();
            setFeedback('Liste güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Teklifler yüklenemedi.', true);
        }
    });
}

if (offersTbody) {
    offersTbody.addEventListener('click', async (event) => {
        const saveBtn = event.target.closest('button[data-role="save"]');
        if (!saveBtn) {
            return;
        }
        const offerId = Number(saveBtn.dataset.id || '0');
        const statusSelect = offersTbody.querySelector(`select[data-role="status"][data-id="${offerId}"]`);
        const status = statusSelect?.value || 'new';
        try {
            await apiRequest(`/panel/offers/${offerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            setFeedback('Teklif durumu kaydedildi.');
        } catch (error) {
            setFeedback(error.message || 'Durum kaydedilemedi.', true);
        }
    });
}

if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const payload = await apiRequest('/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: profileUsername.value.trim(),
                    full_name: profileFullName.value.trim(),
                    job_title: profileJobTitle.value.trim(),
                    phone: profilePhone.value.trim(),
                }),
            });
            currentUser = payload.item;
            setFeedback('Profil güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Profil güncellenemedi.', true);
        }
    });
}

if (profilePasswordForm) {
    profilePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (profileNewPassword.value !== profileNewPasswordConfirm.value) {
            setFeedback('Şifre alanları aynı olmalı.', true);
            return;
        }
        try {
            await apiRequest('/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: profileCurrentPassword.value,
                    new_password: profileNewPassword.value,
                }),
            });
            profilePasswordForm.reset();
            setFeedback('Şifre güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Şifre güncellenemedi.', true);
        }
    });
}

if (createUserForm) {
    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (newPassword.value !== newPasswordConfirm.value) {
            setFeedback('Şifre alanları aynı olmalı.', true);
            return;
        }
        try {
            const isAdmin = newIsAdmin.checked;
            const roles = isAdmin ? [...validRoles] : selectedRolesFrom(newUserRoles);
            await apiRequest('/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            await initializePanelData();
            setFeedback('Kullanıcı oluşturuldu.');
        } catch (error) {
            setFeedback(error.message || 'Kullanıcı oluşturulamadı.', true);
        }
    });
}

if (newIsAdmin) {
    newIsAdmin.addEventListener('change', syncCreateRolesWithAdmin);
}

if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener('click', async () => {
        try {
            await initializePanelData();
            setFeedback('Kullanıcı listesi güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Liste yüklenemedi.', true);
        }
    });
}

if (usersTbody) {
    usersTbody.addEventListener('click', async (event) => {
        const actionBtn = event.target.closest('button[data-action]');
        if (!actionBtn) {
            return;
        }
        const userId = Number(actionBtn.dataset.userId || '0');
        const user = users.find((item) => Number(item.id) === userId);
        if (!user) {
            return;
        }
        if (actionBtn.dataset.action === 'edit') {
            openEditForm(user);
            return;
        }
        if (actionBtn.dataset.action === 'delete') {
            const confirmed = window.confirm(`${user.username} kullanıcısını silmek istiyor musunuz?`);
            if (!confirmed) {
                return;
            }
            try {
                await apiRequest(`/users/${userId}`, { method: 'DELETE' });
                await initializePanelData();
                setFeedback('Kullanıcı silindi.');
            } catch (error) {
                setFeedback(error.message || 'Kullanıcı silinemedi.', true);
            }
        }
    });
}

if (editUserForm) {
    editUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = Number(editUserId.value || '0');
        if (editNewPassword.value || editNewPasswordConfirm.value) {
            if (editNewPassword.value !== editNewPasswordConfirm.value) {
                setFeedback('Şifre alanları aynı olmalı.', true);
                return;
            }
        }
        try {
            await apiRequest(`/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: editUsername.value.trim(),
                    full_name: editFullName.value.trim(),
                    job_title: editJobTitle.value.trim(),
                    phone: editPhone.value.trim(),
                    is_admin: editIsAdmin.checked,
                    is_active: editIsActive.checked,
                    roles: selectedRolesFrom(editUserRoles),
                    new_password: editNewPassword.value || null,
                    new_password_confirm: editNewPasswordConfirm.value || null,
                }),
            });
            await initializePanelData();
            setFeedback('Kullanıcı güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Kullanıcı güncellenemedi.', true);
        }
    });
}

if (cancelEditUserBtn) {
    cancelEditUserBtn.addEventListener('click', () => {
        resetEditForm();
    });
}

if (rolesTbody) {
    rolesTbody.addEventListener('change', (event) => {
        const adminInput = event.target.closest('input[data-admin]');
        if (!adminInput) {
            return;
        }
        syncRoleRowWithAdmin(adminInput.closest('tr'));
    });

    rolesTbody.addEventListener('click', async (event) => {
        const saveBtn = event.target.closest('button[data-action="save-roles"]');
        if (!saveBtn) {
            return;
        }
        const userId = Number(saveBtn.dataset.userId || '0');
        const row = saveBtn.closest('tr');
        const target = users.find((item) => Number(item.id) === userId);
        if (!row || !target) {
            return;
        }
        const roles = Array.from(row.querySelectorAll('input[data-role]:checked')).map((item) => item.dataset.role);
        const isAdminChecked = Boolean(row.querySelector('input[data-admin]:checked'));
        try {
            await apiRequest(`/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: target.username,
                    full_name: target.full_name || '',
                    job_title: target.job_title || '',
                    phone: target.phone || '',
                    is_active: target.is_active,
                    is_admin: isAdminChecked,
                    roles,
                }),
            });
            await initializePanelData();
            setFeedback('Roller güncellendi.');
        } catch (error) {
            setFeedback(error.message || 'Roller güncellenemedi.', true);
        }
    });
}

if (panelLogoutBtn) {
    panelLogoutBtn.addEventListener('click', async () => {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (_) {
            // no-op
        }
        window.location.href = '/tr';
    });
}

if (panelMenuToggle && panelMenuPopover) {
    panelMenuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        panelMenuPopover.hidden = !panelMenuPopover.hidden;
    });

    document.addEventListener('click', (event) => {
        if (!panelMenuWrap?.contains(event.target)) {
            panelMenuPopover.hidden = true;
        }
    });
}

if (panelMenuProfile) {
    panelMenuProfile.addEventListener('click', () => {
        panelMenuPopover.hidden = true;
        activateTab('profile');
    });
}

if (panelMenuSettings) {
    panelMenuSettings.addEventListener('click', () => {
        panelMenuPopover.hidden = true;
        window.location.href = '/settings';
    });
}

if (panelMenuPanel) {
    panelMenuPanel.addEventListener('click', () => {
        panelMenuPopover.hidden = true;
        activateTab('offers');
    });
}

if (panelMenuApp) {
    panelMenuApp.addEventListener('click', () => {
        panelMenuPopover.hidden = true;
        window.location.href = '/app';
    });
}

(async function bootstrap() {
    try {
        applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'dark');
        await loadCurrentUser();
        await initializePanelData();
        if (currentUser?.is_admin) {
            await loadOffers();
        }

        const requested = String(window.location.hash || '').replace('#', '').trim().toLowerCase();
        const allowedTabs = currentUser?.is_admin
            ? new Set(['profile', 'users', 'roles', 'offers'])
            : new Set(['profile']);
        activateTab(allowedTabs.has(requested) ? requested : 'profile');
    } catch (error) {
        setFeedback(error.message || 'Panel verileri yüklenemedi.', true);
    }
})();
