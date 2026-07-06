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
const pathBreadcrumb = document.getElementById('pathBreadcrumb');

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
        breadcrumb: {
            root: 'ana', panel: 'panel',
            profile: 'profil', users: 'kullanıcılar', roles: 'roller', offers: 'teklifler',
            tools: 'adım listesi', 'progress-categories': 'kategoriler', 'op-tester': 'operasyon test',
            'osint-files': 'ön bellek', 'pentest-records': 'pentest kayıtları',
        },
        ui: {
            'panel.header.title': 'Yönetim Paneli',
            'panel.menu.profile': 'Profil', 'panel.menu.settings': 'Ayarlar', 'panel.menu.panel': 'Panel',
            'panel.menu.app': 'Pentest', 'panel.menu.logout': 'Çıkış Yap',
            'panel.tab.profile': 'Profil', 'panel.tab.pentest-records': 'Pentest Kayıtları',
            'panel.tab.users': 'Kullanıcı Yönetimi', 'panel.tab.roles': 'Rol Yönetimi',
            'panel.tab.progress-categories': 'İlerleme Kategorileri', 'panel.tab.tools': 'Adım Listesi',
            'panel.tab.op-tester': 'Operasyon Test', 'panel.tab.osint-files': 'Ön Bellek',
            'panel.tab.offers': 'Teklifler',
            'panel.profile.title': 'Profil Düzenle', 'panel.profile.save': 'Profili Kaydet', 'panel.profile.changePassword': 'Şifreyi Güncelle',
            'panel.field.username': 'Kullanıcı Adı', 'panel.field.fullName': 'Ad Soyad', 'panel.field.jobTitle': 'İş / Ünvan',
            'panel.field.phone': 'Telefon', 'panel.field.currentPassword': 'Mevcut Şifre', 'panel.field.newPassword': 'Yeni Şifre',
            'panel.field.newPasswordConfirm': 'Yeni Şifre (Doğrula)', 'panel.field.password': 'Şifre', 'panel.field.passwordConfirm': 'Şifre (Doğrula)',
            'panel.field.admin': 'Yönetici', 'panel.field.active': 'Aktif', 'panel.field.roles': 'Roller', 'panel.field.newPasswordOptional': 'Yeni Şifre (opsiyonel)',
            'panel.offers.title': 'Teklif Başvuruları',
            'panel.common.refresh': 'Yenile', 'panel.common.save': 'Kaydet', 'panel.common.saveChanges': 'Değişiklikleri Kaydet', 'panel.common.cancel': 'İptal',
            'panel.col.id': 'ID', 'panel.col.date': 'Tarih', 'panel.col.email': 'E-posta', 'panel.col.company': 'Şirket',
            'panel.col.message': 'Mesaj', 'panel.col.status': 'Durum', 'panel.col.user': 'Kullanıcı', 'panel.col.actions': 'İşlemler',
            'panel.users.title': 'Kullanıcı Yönetimi', 'panel.users.add': 'Kullanıcı Ekle', 'panel.users.edit': 'Kullanıcı Düzenle', 'panel.users.listTitle': 'Kullanıcılar',
            'panel.roles.title': 'Rol Yönetimi', 'panel.roles.note': 'Yönetici, bu sekmede kullanıcı rollerini toplu olarak düzenleyebilir.',
            'panel.common.new': 'Yeni', 'panel.common.backArrow': '← Geri',
            'panel.steps.title': 'Adım Listesi', 'panel.steps.new': 'Yeni Adım', 'panel.categories.title': 'İlerleme Kategorileri',
            'panel.optest.title': 'Operasyon Test', 'panel.optest.note': 'YZO ve 3YM operasyonlarını tek başına seçip, parametreleriyle çalıştırıp test edin. İlerleme ve sonuç sağda görünür.',
            'panel.optest.flow': '1. Akış', 'panel.optest.select': 'Seçiniz…', 'panel.optest.flowYzo': 'YZO — Yapay Zeka Orkestratörü', 'panel.optest.flow3ym': '3YM — Manuel',
            'panel.optest.stage': '2. İlerleme Yönü', 'panel.optest.category': '3. Kategori', 'panel.optest.step': '4. Adım', 'panel.optest.operation': 'Operasyon',
            'panel.optest.target': 'Hedef', 'panel.optest.run': 'Operasyonu Başlat', 'panel.optest.progress': 'İşlem Takibi', 'panel.optest.result': 'Sonuç',
            'panel.optest.resultHint': 'Operasyon çalıştırıldığında sonuç burada görünür.',
            'panel.cache.title': 'Ön Bellek', 'panel.cache.deleteSelected': 'Seçilenleri Sil',
            'panel.cache.note': 'AI OSINT operasyonlarında kullanılan "taranacak" ve "hariç tutulacak" sayfa listeleri (.xml/.txt) burada önbelleğe alınır. Dosyalar yalnızca operasyon formundaki dosya alanından yüklenir; buradan indirebilir veya silebilirsiniz.',
            'panel.col.name': 'Ad', 'panel.col.size': 'Boyut', 'panel.col.op': 'İşlem', 'panel.col.target': 'Hedef', 'panel.col.stages': 'Aşamalar',
            'panel.col.operation': 'Operasyon', 'panel.col.risk': 'Risk', 'panel.col.runBy': 'Çalıştıran(lar)', 'panel.col.lastRun': 'Son Çalıştırma', 'panel.col.file': 'Dosya',
            'panel.records.title': 'Pentest Kayıtları', 'panel.records.detailPrefix': 'Pentest', 'panel.records.pdf': 'PDF İndir', 'panel.records.print': 'Yazdır', 'panel.records.word': 'Word İndir',
            'panel.records.deleteAll': 'Bu Pentest Kaydını Sil', 'panel.records.producedFiles': 'Üretilen Dosyalar', 'panel.records.noFiles': 'Bu pentest sırasında indirilebilir dosya üretilmedi.',
            'panel.records.opsAndReport': 'Operasyonlar & Rapor',
            'panel.records.note': 'Yapılan pentestler hedefe göre listelenir. Bir kayda tıklayınca o hedefte çalıştırılan tüm operasyonların raporu, sonuçları ve üretilen dosyaları görünür. Bir kaydı silmek, o hedefe ait tüm operasyon kayıtlarını ve üretilen dosyaları birlikte siler.',
            'panel.dyn.edit': 'Düzenle', 'panel.dyn.delete': 'Sil', 'panel.dyn.yes': 'Evet', 'panel.dyn.no': 'Hayır',
            'panel.dyn.active': 'Aktif', 'panel.dyn.passive': 'Pasif',
            'panel.dyn.noUsers': 'Kullanıcı bulunamadı.', 'panel.dyn.noOffers': 'Henüz teklif yok.',
            'panel.msg.opFailed': 'İşlem başarısız.', 'panel.msg.listUpdated': 'Liste güncellendi.', 'panel.msg.offersLoadFail': 'Teklifler yüklenemedi.',
            'panel.msg.profileUpdated': 'Profil güncellendi.', 'panel.msg.profileUpdateFail': 'Profil güncellenemedi.',
            'panel.msg.passwordMismatch': 'Şifre alanları aynı olmalı.', 'panel.msg.passwordUpdated': 'Şifre güncellendi.', 'panel.msg.passwordUpdateFail': 'Şifre güncellenemedi.',
            'panel.msg.userCreated': 'Kullanıcı oluşturuldu.', 'panel.msg.userCreateFail': 'Kullanıcı oluşturulamadı.',
            'panel.msg.usersUpdated': 'Kullanıcı listesi güncellendi.', 'panel.msg.listLoadFail': 'Liste yüklenemedi.',
            'panel.msg.userDeleted': 'Kullanıcı silindi.', 'panel.msg.userDeleteFail': 'Kullanıcı silinemedi.',
            'panel.msg.userUpdated': 'Kullanıcı güncellendi.', 'panel.msg.userUpdateFail': 'Kullanıcı güncellenemedi.',
            'panel.msg.rolesUpdated': 'Roller güncellendi.', 'panel.msg.rolesUpdateFail': 'Roller güncellenemedi.',
            'panel.msg.panelLoadFail': 'Panel verileri yüklenemedi.',
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
        breadcrumb: {
            root: 'home', panel: 'panel',
            profile: 'profile', users: 'users', roles: 'roles', offers: 'offers',
            tools: 'steps', 'progress-categories': 'categories', 'op-tester': 'op test',
            'osint-files': 'cache', 'pentest-records': 'pentest records',
        },
        ui: {
            'panel.header.title': 'Management Panel',
            'panel.menu.profile': 'Profile', 'panel.menu.settings': 'Settings', 'panel.menu.panel': 'Panel',
            'panel.menu.app': 'Pentest', 'panel.menu.logout': 'Log out',
            'panel.tab.profile': 'Profile', 'panel.tab.pentest-records': 'Pentest Records',
            'panel.tab.users': 'User Management', 'panel.tab.roles': 'Role Management',
            'panel.tab.progress-categories': 'Progress Categories', 'panel.tab.tools': 'Step List',
            'panel.tab.op-tester': 'Operation Test', 'panel.tab.osint-files': 'Cache',
            'panel.tab.offers': 'Offers',
            'panel.profile.title': 'Edit Profile', 'panel.profile.save': 'Save Profile', 'panel.profile.changePassword': 'Change Password',
            'panel.field.username': 'Username', 'panel.field.fullName': 'Full Name', 'panel.field.jobTitle': 'Job / Title',
            'panel.field.phone': 'Phone', 'panel.field.currentPassword': 'Current Password', 'panel.field.newPassword': 'New Password',
            'panel.field.newPasswordConfirm': 'New Password (confirm)', 'panel.field.password': 'Password', 'panel.field.passwordConfirm': 'Password (confirm)',
            'panel.field.admin': 'Admin', 'panel.field.active': 'Active', 'panel.field.roles': 'Roles', 'panel.field.newPasswordOptional': 'New Password (optional)',
            'panel.offers.title': 'Offer Applications',
            'panel.common.refresh': 'Refresh', 'panel.common.save': 'Save', 'panel.common.saveChanges': 'Save Changes', 'panel.common.cancel': 'Cancel',
            'panel.col.id': 'ID', 'panel.col.date': 'Date', 'panel.col.email': 'Email', 'panel.col.company': 'Company',
            'panel.col.message': 'Message', 'panel.col.status': 'Status', 'panel.col.user': 'User', 'panel.col.actions': 'Actions',
            'panel.users.title': 'User Management', 'panel.users.add': 'Add User', 'panel.users.edit': 'Edit User', 'panel.users.listTitle': 'Users',
            'panel.roles.title': 'Role Management', 'panel.roles.note': 'As an admin, you can bulk-edit user roles on this tab.',
            'panel.common.new': 'New', 'panel.common.backArrow': '← Back',
            'panel.steps.title': 'Step List', 'panel.steps.new': 'New Step', 'panel.categories.title': 'Progress Categories',
            'panel.optest.title': 'Operation Test', 'panel.optest.note': 'Select a single YZO/3YM operation, fill its parameters and run it to test. Progress and result appear on the right.',
            'panel.optest.flow': '1. Flow', 'panel.optest.select': 'Select…', 'panel.optest.flowYzo': 'YZO — AI Orchestrator', 'panel.optest.flow3ym': '3YM — Manual',
            'panel.optest.stage': '2. Stage', 'panel.optest.category': '3. Category', 'panel.optest.step': '4. Step', 'panel.optest.operation': 'Operation',
            'panel.optest.target': 'Target', 'panel.optest.run': 'Run Operation', 'panel.optest.progress': 'Progress', 'panel.optest.result': 'Result',
            'panel.optest.resultHint': 'The result appears here when the operation runs.',
            'panel.cache.title': 'Cache', 'panel.cache.deleteSelected': 'Delete Selected',
            'panel.cache.note': 'The "scan" and "exclude" page lists (.xml/.txt) used by AI OSINT operations are cached here. Files are only uploaded from the file field of the operation form; you can download or delete them here.',
            'panel.col.name': 'Name', 'panel.col.size': 'Size', 'panel.col.op': 'Action', 'panel.col.target': 'Target', 'panel.col.stages': 'Stages',
            'panel.col.operation': 'Operation', 'panel.col.risk': 'Risk', 'panel.col.runBy': 'Run by', 'panel.col.lastRun': 'Last Run', 'panel.col.file': 'File',
            'panel.records.title': 'Pentest Records', 'panel.records.detailPrefix': 'Pentest', 'panel.records.pdf': 'Download PDF', 'panel.records.print': 'Print', 'panel.records.word': 'Download Word',
            'panel.records.deleteAll': 'Delete This Pentest Record', 'panel.records.producedFiles': 'Produced Files', 'panel.records.noFiles': 'No downloadable files were produced during this pentest.',
            'panel.records.opsAndReport': 'Operations & Report',
            'panel.records.note': 'Pentests are listed per target. Click a record to see the report, results and produced files of every operation run against that target. Deleting a record removes all operation records and produced files for that target.',
            'panel.dyn.edit': 'Edit', 'panel.dyn.delete': 'Delete', 'panel.dyn.yes': 'Yes', 'panel.dyn.no': 'No',
            'panel.dyn.active': 'Active', 'panel.dyn.passive': 'Passive',
            'panel.dyn.noUsers': 'No users found.', 'panel.dyn.noOffers': 'No offers yet.',
            'panel.msg.opFailed': 'Operation failed', 'panel.msg.listUpdated': 'List updated.', 'panel.msg.offersLoadFail': 'Could not load offers.',
            'panel.msg.profileUpdated': 'Profile updated.', 'panel.msg.profileUpdateFail': 'Could not update profile.',
            'panel.msg.passwordMismatch': 'Password fields must match.', 'panel.msg.passwordUpdated': 'Password updated.', 'panel.msg.passwordUpdateFail': 'Could not update password.',
            'panel.msg.userCreated': 'User created.', 'panel.msg.userCreateFail': 'Could not create user.',
            'panel.msg.usersUpdated': 'User list updated.', 'panel.msg.listLoadFail': 'Could not load list.',
            'panel.msg.userDeleted': 'User deleted.', 'panel.msg.userDeleteFail': 'Could not delete user.',
            'panel.msg.userUpdated': 'User updated.', 'panel.msg.userUpdateFail': 'Could not update user.',
            'panel.msg.rolesUpdated': 'Roles updated.', 'panel.msg.rolesUpdateFail': 'Could not update roles.',
            'panel.msg.panelLoadFail': 'Could not load panel data.',
        },
    },
};

function applyPanelI18n() {
    const dict = PANEL_I18N[currentLanguage]?.ui || PANEL_I18N.tr.ui;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = node.getAttribute('data-i18n');
        const val = dict[key] || PANEL_I18N.tr.ui[key];
        if (val) {
            node.textContent = val;
        }
    });
}

// Translate a dynamic (JS-rendered) panel string by key.
function tp(key) {
    return PANEL_I18N[currentLanguage]?.ui?.[key] || PANEL_I18N.tr.ui[key] || key;
}

function tRole(roleName) {
    return PANEL_I18N[currentLanguage]?.role?.[roleName] || roleName;
}

function tOfferStatus(statusName) {
    return PANEL_I18N[currentLanguage]?.offerStatus?.[statusName] || statusName;
}

function tCrumb(key) {
    const k = String(key || '').trim().toLowerCase();
    return PANEL_I18N[currentLanguage]?.breadcrumb?.[k]
        || PANEL_I18N.tr.breadcrumb[k]
        || k.replace(/[-_]+/g, ' ');
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
        throw new Error(payload.detail || payload.error || tp('panel.msg.opFailed'));
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

    try {
        const nextUrl = `${window.location.pathname}${window.location.search}#${tabName}`;
        window.history.replaceState(null, '', nextUrl);
    } catch (_) {
        // no-op
    }
    renderPathNavigation(tabName);
}


function renderPathNavigation(activeTab = 'profile') {
    if (!pathBreadcrumb) {
        return;
    }

    const safeTab = String(activeTab || 'profile').trim().toLowerCase() || 'profile';
    const crumbs = [
        { label: tCrumb('root'), href: '/' },
        { label: tCrumb('panel'), href: '/panel' },
        { label: tCrumb(safeTab), href: `/panel#${safeTab}` },
    ];

    pathBreadcrumb.innerHTML = crumbs
        .map((item, index) => {
            const separator = index > 0 ? '<span>/</span>' : '';
            return `${separator}<a href="${item.href}" data-href="${item.href}">${item.label}</a>`;
        })
        .join('');
}


function navigatePanelPath(pathValue) {
    const raw = String(pathValue || '').trim();
    if (!raw) {
        return;
    }

    if (raw === '/panel') {
        const activeTab = tabButtons.find((button) => button.classList.contains('active'))?.dataset?.tab || 'profile';
        renderPathNavigation(activeTab);
        return;
    }

    if (raw.startsWith('/panel#')) {
        const tab = raw.slice('/panel#'.length).trim().toLowerCase();
        if (tab) {
            activateTab(tab);
        }
        return;
    }

    if (raw.startsWith('/')) {
        window.location.href = raw;
    }
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
        usersTbody.innerHTML = '<tr><td colspan="6">' + tp('panel.dyn.noUsers') + '</td></tr>';
        return;
    }

    usersTbody.innerHTML = users.map((item) => {
        const canManage = canManageUser(item);
        const isSelf = Number(item.id) === Number(currentUser?.id);
        return `
            <tr>
                <td>${item.username || ''}</td>
                <td>${item.full_name || '-'}</td>
                <td>${item.is_admin ? tp('panel.dyn.yes') : tp('panel.dyn.no')}</td>
                <td>${item.is_active ? tp('panel.dyn.active') : tp('panel.dyn.passive')}</td>
                <td>${(item.roles || []).map((roleName) => tRole(roleName)).join(', ') || '-'}</td>
                <td>
                    <div class="actions">
                        <button class="btn" data-action="edit" data-user-id="${item.id}"${canManage ? '' : ' disabled'}>${tp('panel.dyn.edit')}</button>
                        <button class="btn" data-action="delete" data-user-id="${item.id}"${canManage && !isSelf ? '' : ' disabled'}>${tp('panel.dyn.delete')}</button>
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
                <td><button class="btn" data-action="save-roles" data-user-id="${item.id}">${tp('panel.common.save')}</button></td>
            </tr>
        `;
    }).join('');
}

function renderOffers(items) {
    if (!offersTbody) {
        return;
    }

    if (!Array.isArray(items) || !items.length) {
        offersTbody.innerHTML = '<tr><td colspan="9">' + tp('panel.dyn.noOffers') + '</td></tr>';
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
                <td><button class="btn" data-role="save" data-id="${item.id}">${tp('panel.common.save')}</button></td>
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
    window.__ssvpLang = currentLanguage;  // shared with op_tester.js / pentest_records.js
    applyPanelI18n();
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
            setFeedback(tp('panel.msg.listUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.offersLoadFail'), true);
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
            setFeedback(tp('panel.msg.profileUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.profileUpdateFail'), true);
        }
    });
}

if (profilePasswordForm) {
    profilePasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (profileNewPassword.value !== profileNewPasswordConfirm.value) {
            setFeedback(tp('panel.msg.passwordMismatch'), true);
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
            setFeedback(tp('panel.msg.passwordUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.passwordUpdateFail'), true);
        }
    });
}

if (createUserForm) {
    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (newPassword.value !== newPasswordConfirm.value) {
            setFeedback(tp('panel.msg.passwordMismatch'), true);
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
            setFeedback(tp('panel.msg.userCreated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.userCreateFail'), true);
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
            setFeedback(tp('panel.msg.usersUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.listLoadFail'), true);
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
                setFeedback(tp('panel.msg.userDeleted'));
            } catch (error) {
                setFeedback(error.message || tp('panel.msg.userDeleteFail'), true);
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
                setFeedback(tp('panel.msg.passwordMismatch'), true);
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
            setFeedback(tp('panel.msg.userUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.userUpdateFail'), true);
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
            setFeedback(tp('panel.msg.rolesUpdated'));
        } catch (error) {
            setFeedback(error.message || tp('panel.msg.rolesUpdateFail'), true);
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


if (pathBreadcrumb) {
    pathBreadcrumb.addEventListener('click', (event) => {
        const link = event.target.closest('a[data-href]');
        if (!link) {
            return;
        }
        event.preventDefault();
        navigatePanelPath(link.dataset.href || '');
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
            ? new Set(['profile', 'users', 'roles', 'offers', 'tools', 'progress-categories'])
            : new Set(['profile']);
        // The Pentest Records tab is available to test roles too; only allow it as
        // an initial/deep-linked tab when its button actually rendered.
        if (tabButtons.some((button) => button.dataset.tab === 'pentest-records')) {
            allowedTabs.add('pentest-records');
        }
        const targetTab = allowedTabs.has(requested) ? requested : 'profile';
        // Fire the tab's click handlers (panel.js visibility + settings.js catalog
        // loaders + pentest_records loader) so the initial/deep-linked tab loads
        // its data on first paint — not only when the user clicks it. Previously a
        // plain activateTab() only toggled visibility, leaving those tabs empty on
        // refresh until the user navigated away and back.
        const targetBtn = tabButtons.find((button) => button.dataset.tab === targetTab);
        if (targetBtn) {
            targetBtn.click();
        } else {
            activateTab(targetTab);
        }
        renderPathNavigation(targetTab);
    } catch (error) {
        setFeedback(error.message || tp('panel.msg.panelLoadFail'), true);
    }
})();
