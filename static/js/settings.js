// Wrapped in an IIFE so this file can be loaded ALONGSIDE panel.js on the Panel
// page without top-level identifier collisions (both declare apiRequest,
// tabButtons, activateTab, setFeedback, currentUser, …). Nothing external
// references these names (no inline handlers), so scoping them is safe.
(function () {
const THEME_STORAGE_KEY = "ssvp-theme";
const LANGUAGE_STORAGE_KEY = "ssvp-language";

// settings.js is also loaded on the Panel page, where it ONLY provides the
// catalog editors (steps/items/scripts/params + progress categories). On that
// page panel.js owns tabs/theme/access, so settings.js's own bootstrap and the
// global tab handler below are skipped.
const IS_PANEL_PAGE = Boolean(document.getElementById("panelMenuWrap"));

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const panels = Array.from(document.querySelectorAll(".panel"));
const settingsFeedback = document.getElementById("settingsFeedback");
const pathBreadcrumb = document.getElementById("pathBreadcrumb");
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
const appearanceTablePageSize = document.getElementById("appearanceTablePageSize");
const projectInfoList = document.getElementById("projectInfoList");
const hostInfoList = document.getElementById("hostInfoList");
const resourceInfoList = document.getElementById("resourceInfoList");

// User/role/profile management lives on the Panel page (owned by panel.js).
// Those element IDs also exist there; resolve them to null on the Panel page so
// this file's settings-page handlers never double-bind to the Panel's forms.
function settingsOnlyEl(id) {
    return IS_PANEL_PAGE ? null : document.getElementById(id);
}

const profileForm = settingsOnlyEl("profileForm");
const profileUsername = settingsOnlyEl("profileUsername");
const profileFullName = settingsOnlyEl("profileFullName");
const profileJobTitle = settingsOnlyEl("profileJobTitle");
const profilePhone = settingsOnlyEl("profilePhone");
const profilePasswordForm = settingsOnlyEl("profilePasswordForm");
const profileCurrentPassword = settingsOnlyEl("profileCurrentPassword");
const profileNewPassword = settingsOnlyEl("profileNewPassword");
const profileNewPasswordConfirm = settingsOnlyEl("profileNewPasswordConfirm");

const createUserForm = settingsOnlyEl("createUserForm");
const newUsername = settingsOnlyEl("newUsername");
const newFullName = settingsOnlyEl("newFullName");
const newJobTitle = settingsOnlyEl("newJobTitle");
const newPhone = settingsOnlyEl("newPhone");
const newPassword = settingsOnlyEl("newPassword");
const newPasswordConfirm = settingsOnlyEl("newPasswordConfirm");
const newIsAdmin = settingsOnlyEl("newIsAdmin");
const newUserRoles = settingsOnlyEl("newUserRoles");
const refreshUsersBtn = settingsOnlyEl("refreshUsersBtn");
const usersTbody = settingsOnlyEl("usersTbody");

const editUserForm = settingsOnlyEl("editUserForm");
const editUserId = settingsOnlyEl("editUserId");
const editUsername = settingsOnlyEl("editUsername");
const editFullName = settingsOnlyEl("editFullName");
const editJobTitle = settingsOnlyEl("editJobTitle");
const editPhone = settingsOnlyEl("editPhone");
const editIsAdmin = settingsOnlyEl("editIsAdmin");
const editIsActive = settingsOnlyEl("editIsActive");
const editUserRoles = settingsOnlyEl("editUserRoles");
const editNewPassword = settingsOnlyEl("editNewPassword");
const editNewPasswordConfirm = settingsOnlyEl("editNewPasswordConfirm");
const cancelEditUserBtn = settingsOnlyEl("cancelEditUserBtn");

const rolesTbody = settingsOnlyEl("rolesTbody");

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
const toolsListView = document.getElementById("toolsListView");
const toolsCreateView = document.getElementById("toolsCreateView");
const toolsEditView = document.getElementById("toolsEditView");
const showCreateToolBtn = document.getElementById("showCreateToolBtn");
const cancelCreateToolBtn = document.getElementById("cancelCreateToolBtn");
const closeEditToolBtn = document.getElementById("closeEditToolBtn");
const toolRegistryForm = document.getElementById("toolRegistryForm");
const toolActionKey = document.getElementById("toolActionKey");
const toolDisplayName = document.getElementById("toolDisplayName");
const toolCategory = document.getElementById("toolCategory");
const toolWorkflowKey = document.getElementById("toolWorkflowKey");
const toolStepId = document.getElementById("toolStepId");
const toolRiskLevel = document.getElementById("toolRiskLevel");
const toolTimeout = document.getElementById("toolTimeout");
const toolBaseCommand = document.getElementById("toolBaseCommand");
const toolRequiresApproval = document.getElementById("toolRequiresApproval");
const toolActive = document.getElementById("toolActive");
const refreshToolsBtn = document.getElementById("refreshToolsBtn");
const toolsTbody = document.getElementById("toolsTbody");
const toolSortButtons = Array.from(document.querySelectorAll(".table-sort-btn"));
const filterToolId = document.getElementById("filterToolId");
const filterToolAction = document.getElementById("filterToolAction");
const filterToolName = document.getElementById("filterToolName");
const filterToolStep = document.getElementById("filterToolStep");
const filterToolCategory = document.getElementById("filterToolCategory");
const filterToolWorkflow = document.getElementById("filterToolWorkflow");
const filterToolRisk = document.getElementById("filterToolRisk");
const filterToolTimeout = document.getElementById("filterToolTimeout");
const filterToolApproval = document.getElementById("filterToolApproval");
const filterToolActive = document.getElementById("filterToolActive");
const toolEditForm = document.getElementById("toolEditForm");
const editToolId = document.getElementById("editToolId");
const editToolActionKey = document.getElementById("editToolActionKey");
const editToolDisplayName = document.getElementById("editToolDisplayName");
const editToolCategory = document.getElementById("editToolCategory");
const editToolWorkflowKey = document.getElementById("editToolWorkflowKey");
const editToolStepId = document.getElementById("editToolStepId");
const editToolRiskLevel = document.getElementById("editToolRiskLevel");
const editToolTimeout = document.getElementById("editToolTimeout");
const editToolBaseCommand = document.getElementById("editToolBaseCommand");
const editToolRequiresApproval = document.getElementById("editToolRequiresApproval");
const editToolActive = document.getElementById("editToolActive");
const toolScriptForm = document.getElementById("toolScriptForm");
const scriptToolId = document.getElementById("scriptToolId");
const scriptId = document.getElementById("scriptId");
const scriptName = document.getElementById("scriptName");
const scriptSortOrder = document.getElementById("scriptSortOrder");
const scriptUpload = document.getElementById("scriptUpload");
const scriptEditorWrap = document.getElementById("scriptEditorWrap");
const toolScriptsTbody = document.getElementById("toolScriptsTbody");
const toolParameterForm = document.getElementById("toolParameterForm");
const parameterToolId = document.getElementById("parameterToolId");
const parameterId = document.getElementById("parameterId");
const parameterRequired = document.getElementById("parameterRequired");
const parameterEditorTitle = document.getElementById("parameterEditorTitle");
const selectedToolHint = document.getElementById("selectedToolHint");
const parameterKey = document.getElementById("parameterKey");
const parameterLabel = document.getElementById("parameterLabel");
const parameterType = document.getElementById("parameterType");
const parameterDefault = document.getElementById("parameterDefault");
const toolParametersTbody = document.getElementById("toolParametersTbody");
const showParameterEditorBtn = document.getElementById("showParameterEditorBtn");
const cancelParameterEditorBtn = document.getElementById("cancelParameterEditorBtn");
const stepToolListArea = document.getElementById("stepToolListArea");
const parameterListArea = document.getElementById("parameterListArea");
const stepToolsTbody = document.getElementById("stepToolsTbody");
const stepContextText = document.getElementById("stepContextText");
const showScriptEditorBtn = document.getElementById("showScriptEditorBtn");
const cancelScriptEditorBtn = document.getElementById("cancelScriptEditorBtn");
const scriptListArea = document.getElementById("scriptListArea");

const refreshProgressCategoriesBtn = document.getElementById("refreshProgressCategoriesBtn");
const showCreateProgressCategoryBtn = document.getElementById("showCreateProgressCategoryBtn");
const progressCategoriesTbody = document.getElementById("progressCategoriesTbody");
const progressCategoryForm = document.getElementById("progressCategoryForm");
const progressCategoryId = document.getElementById("progressCategoryId");
const progressCategoryKey = document.getElementById("progressCategoryKey");
const progressCategoryDisplayName = document.getElementById("progressCategoryDisplayName");
const progressCategoryWorkflow = document.getElementById("progressCategoryWorkflow");
const progressCategoryDescription = document.getElementById("progressCategoryDescription");
const progressCategoryActive = document.getElementById("progressCategoryActive");
const cancelProgressCategoryEditorBtn = document.getElementById("cancelProgressCategoryEditorBtn");
const progressCategoriesListArea = document.getElementById("progressCategoriesListArea");

const refreshStepsBtn = document.getElementById("refreshStepsBtn");
const showCreateStepBtn = document.getElementById("showCreateStepBtn");
const stepsTbody = document.getElementById("stepsTbody");
const stepsListArea = document.getElementById("stepsListArea");
const filterStepId = document.getElementById("filterStepId");
const filterStepKey = document.getElementById("filterStepKey");
const filterStepDisplayName = document.getElementById("filterStepDisplayName");
const filterStepWorkflow = document.getElementById("filterStepWorkflow");
const filterStepCategory = document.getElementById("filterStepCategory");
const filterStepActive = document.getElementById("filterStepActive");
const stepForm = document.getElementById("stepForm");
const stepId = document.getElementById("stepId");
const stepKey = document.getElementById("stepKey");
const stepDisplayName = document.getElementById("stepDisplayName");
const stepWorkflow = document.getElementById("stepWorkflow");
const stepCategory = document.getElementById("stepCategory");
const stepDescription = document.getElementById("stepDescription");
const stepActive = document.getElementById("stepActive");
const cancelStepEditorBtn = document.getElementById("cancelStepEditorBtn");
const stepItemsHint = document.getElementById("stepItemsHint");
const stepItemCreateActions = document.getElementById("stepItemCreateActions");
const showCreateStepItemTaskBtn = document.getElementById("showCreateStepItemTaskBtn");
const showCreateStepItemScriptBtn = document.getElementById("showCreateStepItemScriptBtn");
const backToStepItemsListBtn = document.getElementById("backToStepItemsListBtn");
const stepItemsListArea = document.getElementById("stepItemsListArea");
const stepItemsTbody = document.getElementById("stepItemsTbody");
const stepItemTaskFormWrap = document.getElementById("stepItemTaskFormWrap");
const taskStepItemId = document.getElementById("taskStepItemId");
const taskStepItemDisplayName = document.getElementById("taskStepItemDisplayName");
const taskStepItemDescription = document.getElementById("taskStepItemDescription");
const taskStepItemActive = document.getElementById("taskStepItemActive");
const saveTaskStepItemBtn = document.getElementById("saveTaskStepItemBtn");
const cancelTaskStepItemEditorBtn = document.getElementById("cancelTaskStepItemEditorBtn");

const stepItemScriptFormWrap = document.getElementById("stepItemScriptFormWrap");
const scriptStepItemId = document.getElementById("scriptStepItemId");
const scriptStepItemDisplayName = document.getElementById("scriptStepItemDisplayName");
const scriptStepItemDescription = document.getElementById("scriptStepItemDescription");
const scriptStepItemActive = document.getElementById("scriptStepItemActive");
const stepItemScriptFile = document.getElementById("stepItemScriptFile");
const saveScriptStepItemBtn = document.getElementById("saveScriptStepItemBtn");
const cancelScriptStepItemEditorBtn = document.getElementById("cancelScriptStepItemEditorBtn");

const stepItemParamsCard = document.getElementById("stepItemParamsCard");
const stepItemParamsHint = document.getElementById("stepItemParamsHint");
const stepItemParamsTbody = document.getElementById("stepItemParamsTbody");
const showCreateStepItemParamBtn = document.getElementById("showCreateStepItemParamBtn");
const stepItemParamFormWrap = document.getElementById("stepItemParamFormWrap");
const stepItemParamEditorTitle = document.getElementById("stepItemParamEditorTitle");
const stepItemParamId = document.getElementById("stepItemParamId");
const stepItemParamKey = document.getElementById("stepItemParamKey");
const stepItemParamLabel = document.getElementById("stepItemParamLabel");
const stepItemParamType = document.getElementById("stepItemParamType");
const stepItemParamDefault = document.getElementById("stepItemParamDefault");
const stepItemParamDescription = document.getElementById("stepItemParamDescription");
const stepItemParamOptions = document.getElementById("stepItemParamOptions");
const stepItemParamSortOrder = document.getElementById("stepItemParamSortOrder");
const stepItemParamRequired = document.getElementById("stepItemParamRequired");
const saveStepItemParamBtn = document.getElementById("saveStepItemParamBtn");
const cancelStepItemParamEditorBtn = document.getElementById("cancelStepItemParamEditorBtn");
const detectStepItemParamsBtn = document.getElementById("detectStepItemParamsBtn");
const saveDetectedStepItemParamsBtn = document.getElementById("saveDetectedStepItemParamsBtn");
const stepItemScriptEditorCard = document.getElementById("stepItemScriptEditorCard");
const stepItemScriptEditorTitle = document.getElementById("stepItemScriptEditorTitle");
const stepItemScriptCodeEditorElement = document.getElementById("stepItemScriptCodeEditor");
const saveStepItemScriptContentBtn = document.getElementById("saveStepItemScriptContentBtn");

const scriptCodeEditorElement = document.getElementById("scriptCodeEditor");

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
        "settings.ai.provider": "Kullanılacak AI Sağlayıcısı",
        "settings.ai.providerLocal": "Yerel (Ollama)",
        "settings.ai.providerCloud": "Bulut / Uzak AI",
        "settings.ai.localTitle": "Yerel Model (Ollama)",
        "settings.ai.cloudTitle": "Bulut / Uzak AI",
        "settings.ai.cloudFormat": "API Formatı",
        "settings.ai.cloudUrl": "API Adresi (endpoint)",
        "settings.ai.cloudModel": "Model",
        "settings.ai.cloudKey": "API Anahtarı",
        "settings.ai.test": "Bağlantıyı Doğrula",
        "settings.ai.ollamaStart": "Ollama'yı Başlat",
        "settings.ai.ollamaStop": "Ollama'yı Durdur",
        "settings.ai.ollamaHint": "Bulut AI kullanıyorsanız RAM/CPU boşaltmak için yerel Ollama servisini durdurabilirsiniz.",
        "settings.services.title": "Servisler",
        "settings.services.start": "Başlat",
        "settings.services.stop": "Durdur",
        "settings.services.hint": "Kullanmadığınız servisleri durdurarak RAM/CPU boşaltabilirsiniz.",
        "settings.workflow.title": "İlerleme Modu",
        "settings.workflow.mode": "İşlem penceresi ilerleme modu",
        "settings.workflow.manual": "Manuel (3 ana yön sorulur)",
        "settings.workflow.ai": "Yapay Zeka ile ilerle",
        "settings.workflow.note": "Manuel modda kullanıcı tarama/atak/düzenleme yönlerinden birini seçer. Yapay zeka modunda işlem penceresi doğrudan AI orkestratörü ile ilerler.",
        "settings.workflow.save": "İlerleme Modunu Kaydet",
        "settings.tab.toolsmgmt": "Pentest Araçları",
        "settings.toolsmgmt.title": "Pentest Araçları (Sunucu)",
        "settings.toolsmgmt.note": "Sunucudaki güvenlik araçlarını görüntüle, kur, güncelle veya kaldır. İşlemler yalnızca izinli lab sunucusunda çalışır.",
        "settings.toolsmgmt.refresh": "Listeyi Yenile",
        "settings.toolsmgmt.tool": "Araç",
        "settings.toolsmgmt.status": "Durum",
        "settings.toolsmgmt.version": "Sürüm",
        "settings.toolsmgmt.actions": "İşlemler",
        "settings.toolsmgmt.install": "Kur",
        "settings.toolsmgmt.update": "Güncelle",
        "settings.toolsmgmt.remove": "Kaldır",
        "settings.toolsmgmt.installed": "Kurulu",
        "settings.toolsmgmt.notInstalled": "Kurulu değil",
        "settings.toolsmgmt.check": "Kontrol Et",
        "settings.toolsmgmt.logTitle": "İşlem Kaydı",
        "settings.toolsmgmt.clearLog": "Temizle",
        "settings.tab.wordlists": "Sözlük Yönetimi",
        "settings.tab.database": "Veritabanı ve Yedekleme",
        "settings.tab.security": "Güvenlik Ayarları",
        "breadcrumb.root": "ana",
        "breadcrumb.settings": "ayarlar",
        "breadcrumb.appearance": "görünüm",
        "breadcrumb.ai": "ai model",
        "breadcrumb.system": "sistem",
        "breadcrumb.scan": "tarama",
        "breadcrumb.toolsmgmt": "pentest araçları",
        "breadcrumb.wordlists": "sözlükler",
        "breadcrumb.database": "veritabanı",
        "breadcrumb.security": "güvenlik",
        "breadcrumb.steps": "adım listesi",
        "breadcrumb.progress-categories": "kategoriler",
        "settings.database.title": "Veritabanı ve Yedekleme",
        "settings.database.refresh": "Yenile",
        "settings.database.note": "Veritabanı bağlantı durumu, parola değişimi ve yedekleme. Parola değişimi hizmeti kesmeden uygulanır: değişiklik hem veritabanında hem yapılandırma dosyasında doğrulanamazsa eski parola korunur.",
        "settings.database.statusTitle": "Bağlantı Durumu",
        "settings.network.title": "Ağ Erişimi",
        "settings.network.note": "Servisleri yalnızca yerelde (127.0.0.1) veya internete açık çalıştırın. Güvenlik için varsayılan yereldir; sadece ihtiyaç durumunda genele açın. Genel erişim için ayrıca bulut güvenlik grubunda ilgili portu açmanız gerekir.",
        "settings.network.aiTitle": "Ağ Erişimi",
        "settings.network.aiNote": "Ollama'yı yalnızca yerelde (127.0.0.1) veya internete açık çalıştırın. Varsayılan yereldir.",
        "settings.network.local": "Yalnızca yerel",
        "settings.network.public": "Genel (internete açık)",
        "settings.network.makeLocal": "Yerele al",
        "settings.network.makePublic": "Genele aç",
        "settings.network.confirmPublic": "Bu servis internete açılacak. Emin misiniz? (Bulut güvenlik grubunda da portu açmanız gerekir.)",
        "settings.network.done": "Ağ erişimi güncellendi.",
        "settings.network.fail": "Ağ ayarı değiştirilemedi.",
        "settings.services.networkMoved": "Servis port/ağ erişimi ayarları artık \"Güvenlik Ayarları\" sekmesindedir.",
        "settings.security.title": "Güvenlik Ayarları",
        "settings.security.note": "Servis portlarının internete açık olup olmadığını buradan yönetin. Güvenlik için varsayılan yalnızca yereldir (127.0.0.1); portları yalnızca gerçekten ihtiyaç olduğunda genele açın.",
        "settings.security.exposureTitle": "Port / Ağ Erişimi",
        "settings.security.lockdown": "Tümünü Yerele Al (Kilitle)",
        "settings.security.lockdownConfirm": "İnternete açık tüm servisler yalnızca yerele alınacak. Onaylıyor musunuz?",
        "settings.security.lockdownDone": "Tüm servisler yerele alındı.",
        "settings.security.exposedCount": "⚠ {n} servis internete açık.",
        "settings.security.allLocal": "✓ Tüm servisler yalnızca yerelde çalışıyor.",
        "settings.security.cloudHint": "Not: Bir portu genele açtığınızda, dışarıdan erişim için ayrıca bulut güvenlik grubunda (ör. AWS Security Group) ilgili portu açmanız gerekir. Yerel sunucu güvenlik duvarı (ufw) otomatik güncellenir.",
        "settings.security.hardeningTitle": "Sıkılaştırma İpuçları",
        "settings.security.tip1": "Kullanmadığınız tüm servis portlarını yerelde tutun; en güvenli durum tüm servislerin \"Yalnızca yerel\" olmasıdır.",
        "settings.security.tip2": "Veritabanı parolasını düzenli olarak güçlü bir parola ile değiştirin (Veritabanı ve Yedekleme sekmesi).",
        "settings.security.tip3": "Bir portu genele açmadan önce bulut güvenlik grubunda erişimi güvendiğiniz IP adresleriyle sınırlandırın.",
        "settings.database.host": "Host",
        "settings.database.port": "Port",
        "settings.database.user": "Kullanıcı",
        "settings.database.name": "Veritabanı",
        "settings.database.state": "Durum",
        "settings.database.version": "Sürüm",
        "settings.database.connected": "Bağlı",
        "settings.database.disconnected": "Bağlantı yok",
        "settings.database.pwTitle": "Parola Değiştir",
        "settings.database.pwNote": "Yeni parola en az 8 karakter olmalıdır. Değişiklik anında geçerli olur; başarısız olursa eski parola korunur.",
        "settings.database.newPw": "Yeni Parola",
        "settings.database.newPw2": "Yeni Parola (Tekrar)",
        "settings.database.changePw": "Parolayı Değiştir",
        "settings.database.pwTooShort": "Parola en az 8 karakter olmalı.",
        "settings.database.pwMismatch": "Parolalar eşleşmiyor.",
        "settings.database.pwChanged": "Veritabanı parolası güncellendi.",
        "settings.database.pwFail": "Parola değiştirilemedi; eski parola korundu.",
        "settings.database.backupTitle": "Yedekler",
        "settings.database.createBackup": "Yeni Yedek Al",
        "settings.database.backupName": "Dosya",
        "settings.database.backupSize": "Boyut",
        "settings.database.backupDate": "Tarih",
        "settings.database.actions": "İşlem",
        "settings.database.download": "İndir",
        "settings.database.delete": "Sil",
        "settings.database.noBackup": "Henüz yedek yok.",
        "settings.database.backupDone": "Yedek oluşturuldu",
        "settings.database.backupFail": "Yedekleme başarısız.",
        "settings.database.confirmDelete": "Bu yedek silinsin mi?",
        "settings.database.deleteDone": "Yedek silindi.",
        "settings.database.deleteFail": "Silinemedi.",
        "settings.database.loadFail": "Veritabanı durumu alınamadı.",
        "settings.wordlist.title": "Sözlük Yönetimi",
        "settings.wordlist.scan": "Tara",
        "settings.wordlist.refresh": "Yenile",
        "settings.wordlist.note": "Veritabanında kayıtlı sözlükler. \"Tara\" ile sunucudaki (Ubuntu/araç) sözlükler taranır ve eklenir; \"Yeni Ekle\" ile .txt sözlük yükleyebilirsiniz. Sözlükler operasyon formlarındaki sözlük alanlarında seçilebilir olur.",
        "settings.wordlist.add": "Yeni Ekle",
        "settings.wordlist.name": "Ad",
        "settings.wordlist.path": "Konum",
        "settings.wordlist.size": "Boyut",
        "settings.wordlist.source": "Kaynak",
        "settings.wordlist.actions": "İşlem",
        "settings.wordlist.none": "Kayıtlı sözlük yok. 'Tara' veya 'Yeni Ekle' ile ekleyin.",
        "settings.wordlist.sourceUpload": "Yüklendi",
        "settings.wordlist.sourceScan": "Tarama",
        "settings.wordlist.delete": "Sil",
        "settings.wordlist.loadFail": "Sözlük listesi alınamadı.",
        "settings.wordlist.scanDone": "Tarama tamamlandı.",
        "settings.wordlist.scanFail": "Tarama başarısız.",
        "settings.wordlist.pickFile": "Önce bir .txt dosyası seçin.",
        "settings.wordlist.added": "Sözlük eklendi",
        "settings.wordlist.uploadFail": "Sözlük yüklenemedi.",
        "settings.wordlist.deleted": "Sözlük silindi.",
        "settings.wordlist.deleteFail": "Sözlük silinemedi.",
        "settings.wordlist.install.title": "Hazır Sözlükler İndir",
        "settings.wordlist.install.note": "Sunucuda standart sözlükleri (rockyou, SecLists) indirir ve otomatik olarak kataloğa ekler. İndirme arka planda çalışır.",
        "settings.wordlist.install.download": "İndir",
        "settings.wordlist.install.update": "Güncelle",
        "settings.wordlist.install.running": "indiriliyor…",
        "settings.wordlist.install.done": "indirildi ve kataloğa eklendi",
        "settings.wordlist.install.error": "indirme başarısız",
        "settings.wordlist.install.startFail": "İndirme başlatılamadı.",
        "passMismatch": "Şifreler eşleşmiyor.",
        "profileSaved": "Profil kaydedildi.",
        "passwordSaved": "Şifre güncellendi.",
        "userCreated": "Kullanıcı oluşturuldu.",
        "userUpdated": "Kullanıcı güncellendi.",
        "userDeleted": "Kullanıcı silindi.",
        "usersLoaded": "Kullanıcı listesi yüklendi.",
        "rolesUpdated": "Roller güncellendi.",
        "aiSaved": "AI ayarları kaydedildi.",
        "scanSaved": "Tarama ayarları kaydedildi.",
        "settings.ai.cloudRequired": "Bulut AI için API adresi ve model zorunlu.",
        "settings.ai.testing": "Doğrulanıyor… (kaydedilen ayar test ediliyor)",
        "settings.workflow.saved": "İlerleme modu kaydedildi.",
        "settings.workflow.saveError": "İlerleme modu kaydedilemedi.",
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
        "settings.appearance.tablePageSize": "Tabloda sayfa başına satır",
        "settings.appearance.tablePageSizeAll": "Hepsi",
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
        "settings.ai.provider": "AI Provider to Use",
        "settings.ai.providerLocal": "Local (Ollama)",
        "settings.ai.providerCloud": "Cloud / Remote AI",
        "settings.ai.localTitle": "Local Model (Ollama)",
        "settings.ai.cloudTitle": "Cloud / Remote AI",
        "settings.ai.cloudFormat": "API Format",
        "settings.ai.cloudUrl": "API URL (endpoint)",
        "settings.ai.cloudModel": "Model",
        "settings.ai.cloudKey": "API Key",
        "settings.ai.test": "Verify Connection",
        "settings.ai.ollamaStart": "Start Ollama",
        "settings.ai.ollamaStop": "Stop Ollama",
        "settings.ai.ollamaHint": "If you use cloud AI, you can stop the local Ollama service to free RAM/CPU.",
        "settings.services.title": "Services",
        "settings.services.start": "Start",
        "settings.services.stop": "Stop",
        "settings.services.hint": "Stop services you are not using to free RAM/CPU.",
        "settings.workflow.title": "Progression Mode",
        "settings.workflow.mode": "Operation window progression mode",
        "settings.workflow.manual": "Manual (asks one of 3 directions)",
        "settings.workflow.ai": "Drive with AI",
        "settings.workflow.note": "In manual mode the user picks scan/attack/remediation. In AI mode the operation window is driven directly by the AI orchestrator.",
        "settings.workflow.save": "Save Progression Mode",
        "settings.tab.toolsmgmt": "Pentest Tools",
        "settings.toolsmgmt.title": "Pentest Tools (Server)",
        "settings.toolsmgmt.note": "View, install, update or remove security tools on the server. Actions run only on the authorized lab server.",
        "settings.toolsmgmt.refresh": "Refresh List",
        "settings.toolsmgmt.tool": "Tool",
        "settings.toolsmgmt.status": "Status",
        "settings.toolsmgmt.version": "Version",
        "settings.toolsmgmt.actions": "Actions",
        "settings.toolsmgmt.install": "Install",
        "settings.toolsmgmt.update": "Update",
        "settings.toolsmgmt.remove": "Remove",
        "settings.toolsmgmt.installed": "Installed",
        "settings.toolsmgmt.notInstalled": "Not installed",
        "settings.toolsmgmt.check": "Check",
        "settings.toolsmgmt.logTitle": "Operation Log",
        "settings.toolsmgmt.clearLog": "Clear",
        "settings.tab.wordlists": "Wordlists",
        "settings.tab.database": "Database & Backup",
        "settings.tab.security": "Security Settings",
        "breadcrumb.root": "home",
        "breadcrumb.settings": "settings",
        "breadcrumb.appearance": "appearance",
        "breadcrumb.ai": "ai model",
        "breadcrumb.system": "system",
        "breadcrumb.scan": "scan",
        "breadcrumb.toolsmgmt": "pentest tools",
        "breadcrumb.wordlists": "wordlists",
        "breadcrumb.database": "database",
        "breadcrumb.security": "security",
        "breadcrumb.steps": "steps",
        "breadcrumb.progress-categories": "categories",
        "settings.database.title": "Database & Backup",
        "settings.database.refresh": "Refresh",
        "settings.database.note": "Database connection status, password change and backups. A password change is applied without downtime: if the change cannot be verified in BOTH the database and the config file, the old password is kept.",
        "settings.database.statusTitle": "Connection Status",
        "settings.network.title": "Network Access",
        "settings.network.note": "Run services local-only (127.0.0.1) or exposed to the internet. Default is local for security; open to public only when needed. Public access also requires opening the port in the cloud security group.",
        "settings.network.aiTitle": "Network Access",
        "settings.network.aiNote": "Run Ollama local-only (127.0.0.1) or exposed to the internet. Default is local.",
        "settings.network.local": "Local only",
        "settings.network.public": "Public (internet-exposed)",
        "settings.network.makeLocal": "Make local",
        "settings.network.makePublic": "Make public",
        "settings.network.confirmPublic": "This service will be exposed to the internet. Are you sure? (You must also open the port in the cloud security group.)",
        "settings.network.done": "Network access updated.",
        "settings.network.fail": "Could not change network setting.",
        "settings.services.networkMoved": "Service port / network access settings have moved to the \"Security Settings\" tab.",
        "settings.security.title": "Security Settings",
        "settings.security.note": "Manage whether service ports are exposed to the internet here. For security the default is local-only (127.0.0.1); open ports to the public only when genuinely needed.",
        "settings.security.exposureTitle": "Port / Network Access",
        "settings.security.lockdown": "Lock Down All (Local Only)",
        "settings.security.lockdownConfirm": "All internet-exposed services will be switched to local-only. Continue?",
        "settings.security.lockdownDone": "All services switched to local-only.",
        "settings.security.exposedCount": "⚠ {n} service(s) exposed to the internet.",
        "settings.security.allLocal": "✓ All services are local-only.",
        "settings.security.cloudHint": "Note: after opening a port to the public, external access also requires opening the port in your cloud security group (e.g. AWS Security Group). The local host firewall (ufw) is updated automatically.",
        "settings.security.hardeningTitle": "Hardening Tips",
        "settings.security.tip1": "Keep every unused service port local; the safest state is all services set to \"Local only\".",
        "settings.security.tip2": "Rotate the database password regularly with a strong password (Database & Backup tab).",
        "settings.security.tip3": "Before opening a port to the public, restrict access in the cloud security group to trusted IP addresses.",
        "settings.database.host": "Host",
        "settings.database.port": "Port",
        "settings.database.user": "User",
        "settings.database.name": "Database",
        "settings.database.state": "State",
        "settings.database.version": "Version",
        "settings.database.connected": "Connected",
        "settings.database.disconnected": "Not connected",
        "settings.database.pwTitle": "Change Password",
        "settings.database.pwNote": "New password must be at least 8 characters. The change takes effect immediately; if it fails, the old password is kept.",
        "settings.database.newPw": "New Password",
        "settings.database.newPw2": "New Password (again)",
        "settings.database.changePw": "Change Password",
        "settings.database.pwTooShort": "Password must be at least 8 characters.",
        "settings.database.pwMismatch": "Passwords do not match.",
        "settings.database.pwChanged": "Database password updated.",
        "settings.database.pwFail": "Could not change password; old password kept.",
        "settings.database.backupTitle": "Backups",
        "settings.database.createBackup": "Create Backup",
        "settings.database.backupName": "File",
        "settings.database.backupSize": "Size",
        "settings.database.backupDate": "Date",
        "settings.database.actions": "Action",
        "settings.database.download": "Download",
        "settings.database.delete": "Delete",
        "settings.database.noBackup": "No backups yet.",
        "settings.database.backupDone": "Backup created",
        "settings.database.backupFail": "Backup failed.",
        "settings.database.confirmDelete": "Delete this backup?",
        "settings.database.deleteDone": "Backup deleted.",
        "settings.database.deleteFail": "Could not delete.",
        "settings.database.loadFail": "Could not load database status.",
        "settings.wordlist.title": "Wordlist Management",
        "settings.wordlist.scan": "Scan",
        "settings.wordlist.refresh": "Refresh",
        "settings.wordlist.note": "Wordlists stored in the database. \"Scan\" discovers wordlists on the server (Ubuntu/tools) and adds them; \"Add New\" uploads a .txt wordlist. Wordlists become selectable in the wordlist fields of operation forms.",
        "settings.wordlist.add": "Add New",
        "settings.wordlist.name": "Name",
        "settings.wordlist.path": "Path",
        "settings.wordlist.size": "Size",
        "settings.wordlist.source": "Source",
        "settings.wordlist.actions": "Action",
        "settings.wordlist.none": "No wordlists yet. Use 'Scan' or 'Add New'.",
        "settings.wordlist.sourceUpload": "Uploaded",
        "settings.wordlist.sourceScan": "Scan",
        "settings.wordlist.delete": "Delete",
        "settings.wordlist.loadFail": "Could not load wordlist list.",
        "settings.wordlist.scanDone": "Scan complete.",
        "settings.wordlist.scanFail": "Scan failed.",
        "settings.wordlist.pickFile": "Select a .txt file first.",
        "settings.wordlist.added": "Wordlist added",
        "settings.wordlist.uploadFail": "Could not upload wordlist.",
        "settings.wordlist.deleted": "Wordlist deleted.",
        "settings.wordlist.deleteFail": "Could not delete wordlist.",
        "settings.wordlist.install.title": "Download Ready-Made Wordlists",
        "settings.wordlist.install.note": "Downloads standard wordlists (rockyou, SecLists) onto the server and adds them to the catalog automatically. The download runs in the background.",
        "settings.wordlist.install.download": "Download",
        "settings.wordlist.install.update": "Update",
        "settings.wordlist.install.running": "downloading…",
        "settings.wordlist.install.done": "downloaded and added to the catalog",
        "settings.wordlist.install.error": "download failed",
        "settings.wordlist.install.startFail": "Could not start the download.",
        "passMismatch": "Passwords do not match.",
        "profileSaved": "Profile saved.",
        "passwordSaved": "Password updated.",
        "userCreated": "User created.",
        "userUpdated": "User updated.",
        "userDeleted": "User deleted.",
        "usersLoaded": "Users loaded.",
        "rolesUpdated": "Roles updated.",
        "aiSaved": "AI settings saved.",
        "scanSaved": "Scan settings saved.",
        "settings.ai.cloudRequired": "Cloud AI requires an API URL and model.",
        "settings.ai.testing": "Testing… (validating the saved setting)",
        "settings.workflow.saved": "Workflow mode saved.",
        "settings.workflow.saveError": "Could not save workflow mode.",
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
        "settings.appearance.tablePageSize": "Rows per page in tables",
        "settings.appearance.tablePageSizeAll": "All",
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
let registryTools = [];
let registryParameters = [];
let registryScripts = [];
let progressCategories = [];
let registrySteps = [];
let selectedToolId = 0;
let scriptCodeEditor = null;
let scriptEditorMode = "upload";
let toolSortState = { key: "id", direction: "asc" };
let stepTools = [];
let selectedStepToolId = 0;
let selectedContextStepId = 0;
let selectedContextStepKey = "";
let stepItems = [];
let selectedStepItemId = 0;
let stepItemParameters = [];
let detectedStepItemParameters = [];
let stepItemScriptCodeEditor = null;
let currentActiveTab = "system";
let pathRefreshQueued = false;


function tabToHashSegment(tabName) {
    const token = String(tabName || "").trim().toLowerCase();
    if (token === "tools") {
        return "steps";
    }
    return token;
}


function hashSegmentToTab(hashTab) {
    const token = String(hashTab || "").trim().toLowerCase();
    if (token === "steps") {
        return "tools";
    }
    return token;
}


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


function extractApiErrorMessage(payload, fallbackMessage) {
    const fallback = fallbackMessage || t("settings.error.operationFailed");
    const detail = payload?.detail;
    const errorText = payload?.error;

    if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
    }

    if (Array.isArray(detail)) {
        const combined = detail
            .map((item) => {
                if (typeof item === "string") {
                    return item.trim();
                }
                if (item && typeof item === "object") {
                    const loc = Array.isArray(item.loc) ? item.loc.join(" > ") : "";
                    const msg = typeof item.msg === "string" ? item.msg : "";
                    if (loc && msg) {
                        return `${loc}: ${msg}`;
                    }
                    if (msg) {
                        return msg;
                    }
                }
                return "";
            })
            .filter(Boolean)
            .join(" | ");

        if (combined) {
            return combined;
        }
    }

    if (detail && typeof detail === "object") {
        const msg = typeof detail.msg === "string" ? detail.msg.trim() : "";
        if (msg) {
            return msg;
        }
        try {
            const serialized = JSON.stringify(detail);
            if (serialized && serialized !== "{}") {
                return serialized;
            }
        } catch (_) {
            // no-op
        }
    }

    if (typeof errorText === "string" && errorText.trim()) {
        return errorText.trim();
    }

    return fallback;
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
        const requestError = new Error(extractApiErrorMessage(payload, t("settings.error.operationFailed")));
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
    currentActiveTab = tabName;

    try {
        window.location.hash = tabToHashSegment(tabName);
    } catch (_) {
        // no-op
    }
    refreshPathNavigation();
}


function toPathSegment(value, fallback = "view") {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+|[-_]+$/g, "");
    return normalized || fallback;
}


function resolveStepContextSegment() {
    const rawId = Number(stepId?.value || "0");
    const stepKeyText = (stepKey?.value || "").trim();
    const stepNameText = (stepDisplayName?.value || "").trim();
    const label = stepNameText || stepKeyText || (rawId > 0 ? `step-${rawId}` : "step");

    const keyForSegment = rawId > 0
        ? `step-${rawId}`
        : (stepKeyText || stepNameText || "step");

    return {
        label: `step:${label}`,
        segment: toPathSegment(keyForSegment, "step"),
    };
}


function resolveStepItemContextSegment() {
    let itemType = "";
    let itemName = "";
    let itemId = 0;

    if (stepItemTaskFormWrap?.style.display !== "none") {
        itemType = "task";
        itemId = Number(taskStepItemId?.value || "0");
        itemName = (taskStepItemDisplayName?.value || "").trim();
    } else if (stepItemScriptFormWrap?.style.display !== "none") {
        itemType = "script";
        itemId = Number(scriptStepItemId?.value || "0");
        itemName = (scriptStepItemDisplayName?.value || "").trim();
    } else if (selectedStepItemId) {
        const selected = stepItems.find((row) => Number(row.id) === Number(selectedStepItemId));
        if (selected) {
            itemType = String(selected.item_type || "task").toLowerCase();
            itemId = Number(selected.id || 0);
            itemName = String(selected.display_name || selected.item_key || "").trim();
        }
    }

    if (!itemType) {
        return null;
    }

    const labelName = itemName || (itemId > 0 ? `${itemType}-${itemId}` : itemType);
    const keyForSegment = itemId > 0
        ? `${itemType}-${itemId}`
        : `${itemType}-${itemName || "item"}`;

    return {
        label: `${itemType}:${labelName}`,
        segment: toPathSegment(keyForSegment, itemType),
    };
}


function crumbLabel(key) {
    const k = String(key || "").trim().toLowerCase();
    const val = t("breadcrumb." + k);
    return val && val !== "breadcrumb." + k ? val : k.replace(/[-_]+/g, " ");
}

function renderPathNavigation(activeTab = "system", segments = []) {
    const safeTab = String(activeTab || "system").trim() || "system";
    const hashTab = tabToHashSegment(safeTab) || "system";
    const safeSegments = Array.isArray(segments)
        ? segments
            .map((item) => {
                if (item && typeof item === "object") {
                    const labelText = String(item.label || item.segment || "").trim();
                    const segmentText = toPathSegment(item.segment || item.label || "", "view");
                    if (!labelText || !segmentText) {
                        return null;
                    }
                    return { label: labelText, segment: segmentText };
                }
                const raw = String(item || "").trim();
                if (!raw) {
                    return null;
                }
                return { label: raw, segment: toPathSegment(raw, "view") };
            })
            .filter(Boolean)
        : [];

    let hashPath = hashTab;
    const crumbs = [
        { label: crumbLabel("root"), href: "/" },
        { label: crumbLabel("settings"), href: "/settings" },
        { label: crumbLabel(hashTab), href: `/settings#${hashTab}` },
    ];
    safeSegments.forEach((entry) => {
        hashPath = `${hashPath}/${entry.segment}`;
        crumbs.push({ label: entry.label, href: `/settings#${hashPath}` });
    });

    try {
        const nextHash = `#${hashPath}`;
        if (window.location.hash !== nextHash) {
            const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
            window.history.replaceState(null, "", nextUrl);
        }
    } catch (_) {
        // no-op
    }

    if (pathBreadcrumb) {
        pathBreadcrumb.innerHTML = crumbs
            .map((item, index) => {
                const separator = index > 0 ? "<span>/</span>" : "";
                return `${separator}<a href="${item.href}" data-href="${item.href}">${item.label}</a>`;
            })
            .join("");
    }
}


function collectTabSegmentsFromUi(tabName) {
    const tab = String(tabName || "").trim().toLowerCase();

    if (tab === "tools") {
        const segments = [];
        const stepEditorOpen = Boolean(stepForm && stepForm.style.display !== "none");
        if (!stepEditorOpen) {
            return [{ label: "step-list", segment: "step-list" }];
        }

        segments.push({ label: "step-editor", segment: "step-editor" });
        segments.push(resolveStepContextSegment());

        const itemContext = resolveStepItemContextSegment();
        if (itemContext) {
            segments.push(itemContext);
        }

        if (stepItemTaskFormWrap?.style.display !== "none") {
            segments.push({ label: "task-editor", segment: "task-editor" });
            return segments;
        }
        if (stepItemScriptFormWrap?.style.display !== "none") {
            segments.push({ label: "script-editor", segment: "script-editor" });
            return segments;
        }
        if (stepItemScriptEditorCard?.style.display !== "none") {
            segments.push({ label: "script-code", segment: "script-code" });
            return segments;
        }
        if (stepItemParamFormWrap?.style.display !== "none") {
            segments.push({ label: "step-item-params", segment: "step-item-params" });
            segments.push({ label: "param-editor", segment: "param-editor" });
            return segments;
        }
        if (stepItemParamsCard?.style.display !== "none") {
            segments.push({ label: "step-item-params", segment: "step-item-params" });
            return segments;
        }
        return [...segments, { label: "step-items", segment: "step-items" }];
    }

    if (tab === "progress-categories") {
        if (progressCategoryForm?.style.display !== "none") {
            const isEdit = Boolean(progressCategoryId?.value);
            return [isEdit ? "category-edit" : "category-new"];
        }
        return ["category-list"];
    }

    if (tab === "users") {
        if (editUserId?.value) {
            return ["user-edit"];
        }
        return ["user-list"];
    }

    return [];
}


function refreshPathNavigation(force = false) {
    if (!force) {
        if (pathRefreshQueued) {
            return;
        }
        pathRefreshQueued = true;
        queueMicrotask(() => {
            pathRefreshQueued = false;
            refreshPathNavigation(true);
        });
        return;
    }

    const activeButton = tabButtons.find((button) => button.classList.contains("active"));
    const activeTab = activeButton?.dataset?.tab || currentActiveTab || "system";
    currentActiveTab = activeTab;
    renderPathNavigation(activeTab, collectTabSegmentsFromUi(activeTab));
}


function parseNumericPathSegment(segments, prefix) {
    const safePrefix = String(prefix || "").trim().toLowerCase();
    for (const raw of Array.isArray(segments) ? segments : []) {
        const token = String(raw || "").trim().toLowerCase();
        const match = token.match(new RegExp(`^${safePrefix}-(\\d+)$`));
        if (match) {
            const idValue = Number(match[1]);
            if (Number.isFinite(idValue) && idValue > 0) {
                return idValue;
            }
        }
    }
    return 0;
}


async function applyInTabNavigationFromPath(tabName, segments) {
    const tab = String(tabName || "").trim().toLowerCase();
    const segs = Array.isArray(segments)
        ? segments.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
        : [];

    if (tab === "tools") {
        const stepIdFromPath = parseNumericPathSegment(segs, "step");
        const taskItemIdFromPath = parseNumericPathSegment(segs, "task");
        const scriptItemIdFromPath = parseNumericPathSegment(segs, "script");
        const itemIdFromPath = scriptItemIdFromPath || taskItemIdFromPath;

        const hasStepEditor = segs.includes("step-editor");
        if (!hasStepEditor) {
            closeStepEditor();
            return;
        }

        if (stepIdFromPath > 0) {
            if (!registrySteps.length) {
                await loadSteps();
            }
            const targetStep = registrySteps.find((item) => Number(item.id) === Number(stepIdFromPath));
            if (targetStep) {
                openStepEditor(targetStep);
                await loadStepItems(stepIdFromPath);
            } else if (stepForm?.style.display === "none") {
                openStepEditor(null);
            }
        } else if (stepForm?.style.display === "none") {
            openStepEditor(null);
        }

        const currentStepId = Number(stepId?.value || "0");
        if (currentStepId > 0 && !stepItems.length) {
            await loadStepItems(currentStepId);
        }

        const focusTokens = new Set([
            "task-editor",
            "script-editor",
            "script-code",
            "param-editor",
            "step-item-params",
            "step-items",
        ]);
        const focus = [...segs].reverse().find((token) => focusTokens.has(token)) || "step-items";
        const selectedItemFromPath = itemIdFromPath > 0
            ? stepItems.find((item) => Number(item.id) === Number(itemIdFromPath))
            : null;

        if (selectedItemFromPath) {
            selectedStepItemId = Number(selectedItemFromPath.id);
            renderStepItemsTable();
        }

        if (focus === "task-editor") {
            if (selectedItemFromPath && selectedItemFromPath.item_type === "task") {
                openTaskStepItemEditor(selectedItemFromPath);
            } else {
                openTaskStepItemEditor(null);
            }
            return;
        }
        if (focus === "script-editor") {
            if (selectedItemFromPath && selectedItemFromPath.item_type === "script") {
                openScriptStepItemEditor(selectedItemFromPath);
            } else {
                openScriptStepItemEditor(null);
            }
            return;
        }
        if (focus === "script-code") {
            if (selectedItemFromPath && selectedItemFromPath.item_type === "script") {
                await pickStepItem(Number(selectedItemFromPath.id));
            } else if (selectedStepItemId) {
                const selectedItem = stepItems.find((item) => Number(item.id) === Number(selectedStepItemId));
                if (selectedItem?.item_type === "script") {
                    await pickStepItem(Number(selectedItem.id));
                }
            }
            return;
        }
        if (focus === "param-editor") {
            if (selectedItemFromPath) {
                await pickStepItem(Number(selectedItemFromPath.id));
                setStepItemParamEditorVisible(true);
            }
            return;
        }
        if (focus === "step-item-params") {
            if (selectedItemFromPath) {
                await pickStepItem(Number(selectedItemFromPath.id));
                setStepItemParamEditorVisible(false);
            }
            return;
        }

        setStepItemTaskEditorVisible(false);
        setStepItemScriptEditorVisible(false);
        setStepItemScriptCodeEditorVisible(false);
        setStepItemParamEditorVisible(false);
        setStepItemListVisible(true);
        if (stepItemParamsCard) stepItemParamsCard.style.display = "none";
        if (selectedItemFromPath) {
            selectedStepItemId = Number(selectedItemFromPath.id);
            renderStepItemsTable();
        }
        return;
    }

    if (tab === "progress-categories") {
        const focus = segs[segs.length - 1] || "category-list";
        if (focus === "category-new") {
            openProgressCategoryEditor(null);
            return;
        }
        if (focus === "category-edit") {
            if (progressCategoryForm?.style.display === "none") {
                openProgressCategoryEditor(null);
            }
            return;
        }
        closeProgressCategoryEditor();
    }
}


async function navigateToPath(value) {
    const raw = String(value || "").trim();
    if (!raw) {
        return;
    }

    const allowedHashTabs = new Set(tabButtons.map((button) => button.dataset.tab));
    if (raw.startsWith("/settings#")) {
        const hashPath = raw.slice("/settings#".length).trim();
        const [hashTabRaw, ...segments] = hashPath.split("/").map((item) => item.trim()).filter(Boolean);
        const hashTab = hashSegmentToTab(hashTabRaw);
        if (allowedHashTabs.has(hashTab) && hasTab(hashTab)) {
            activateTab(hashTab);
            await applyInTabNavigationFromPath(hashTab, segments);
            refreshPathNavigation();
            return;
        }
    }

    if (raw === "/settings") {
        const requested = String(window.location.hash || "").replace("#", "").trim();
        const target = hasTab(requested.split("/")[0]) ? requested.split("/")[0] : (accessTabs[0] || "system");
        activateTab(target);
        refreshPathNavigation();
        return;
    }

    if (raw.startsWith("/")) {
        window.location.href = raw;
    }
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


function generateStepItemKey(displayName, fallbackPrefix = "item") {
    const raw = String(displayName || "").trim().toLowerCase();
    const normalized = raw
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 120);
    if (normalized) {
        return normalized;
    }
    const ts = Date.now();
    return `${fallbackPrefix}_${ts}`;
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
    refreshPathNavigation();
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
    refreshPathNavigation();
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


function renderToolsTable() {
    if (!toolsTbody) {
        return;
    }

    const items = getVisibleTools();
    if (!items.length) {
        toolsTbody.innerHTML = "<tr><td colspan='11'>Gorev bulunamadi.</td></tr>";
        return;
    }

    toolsTbody.innerHTML = items.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.action_key}</td>
                <td>${item.display_name || item.tool_name}</td>
                <td>${item.step_display_name || item.step_key || item.test_step || "-"}</td>
                <td>${item.test_category || "general"}</td>
                <td>${item.workflow_key || "scan"}</td>
                <td>${item.risk_level}</td>
                <td>${item.timeout_sec}</td>
                <td>${item.requires_approval ? "yes" : "no"}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button data-action="edit-tool" data-tool-id="${item.id}">Düzenle</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


function getToolFilterValues() {
    return {
        id: (filterToolId?.value || "").trim().toLowerCase(),
        action_key: (filterToolAction?.value || "").trim().toLowerCase(),
        tool_name: (filterToolName?.value || "").trim().toLowerCase(),
        step_key: (filterToolStep?.value || "").trim().toLowerCase(),
        test_category: (filterToolCategory?.value || "").trim().toLowerCase(),
        workflow_key: (filterToolWorkflow?.value || "").trim().toLowerCase(),
        risk_level: (filterToolRisk?.value || "").trim().toLowerCase(),
        timeout_sec: (filterToolTimeout?.value || "").trim().toLowerCase(),
        requires_approval: (filterToolApproval?.value || "").trim().toLowerCase(),
        is_active: (filterToolActive?.value || "").trim().toLowerCase(),
    };
}


function getVisibleTools() {
    const filters = getToolFilterValues();
    let items = [...registryTools];

    items = items.filter((item) => {
        if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
        if (filters.action_key && !String(item.action_key || "").toLowerCase().includes(filters.action_key)) return false;
        if (filters.tool_name) {
            const haystack = `${String(item.display_name || "")} ${String(item.tool_name || "")}`.toLowerCase();
            if (!haystack.includes(filters.tool_name)) return false;
        }
        if (filters.step_key) {
            const stepHaystack = `${String(item.step_key || "")} ${String(item.step_display_name || "")}`.toLowerCase();
            if (!stepHaystack.includes(filters.step_key)) return false;
        }
        if (filters.test_category && !String(item.test_category || "").toLowerCase().includes(filters.test_category)) return false;
        if (filters.workflow_key && String(item.workflow_key || "").toLowerCase() !== filters.workflow_key) return false;
        if (filters.risk_level && String(item.risk_level || "").toLowerCase() !== filters.risk_level) return false;
        if (filters.timeout_sec && !String(item.timeout_sec || "").toLowerCase().includes(filters.timeout_sec)) return false;
        if (filters.requires_approval) {
            const approvalText = item.requires_approval ? "yes" : "no";
            if (approvalText !== filters.requires_approval) return false;
        }
        if (filters.is_active) {
            const activeText = item.is_active ? "yes" : "no";
            if (activeText !== filters.is_active) return false;
        }
        return true;
    });

    const sortKey = toolSortState.key;
    const direction = toolSortState.direction === "desc" ? -1 : 1;
    items.sort((a, b) => {
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        if (typeof av === "number" || typeof bv === "number") {
            return (Number(av || 0) - Number(bv || 0)) * direction;
        }
        if (typeof av === "boolean" || typeof bv === "boolean") {
            return (Number(Boolean(av)) - Number(Boolean(bv))) * direction;
        }
        return String(av || "").localeCompare(String(bv || "")) * direction;
    });

    return items;
}


function updateToolSortIndicators() {
    toolSortButtons.forEach((button) => {
        const key = button.dataset.sortKey;
        if (!key) {
            return;
        }
        const label = button.textContent?.replace(/[↑↓]/g, "").trim() || "";
        if (key === toolSortState.key) {
            button.textContent = `${label} ${toolSortState.direction === "asc" ? "↑" : "↓"}`;
        } else {
            button.textContent = label;
        }
    });
}


function setParameterEditorVisible(visible) {
    if (parameterListArea) {
        parameterListArea.style.display = visible ? "none" : "block";
    }
    if (toolParameterForm) {
        toolParameterForm.style.display = visible ? "flex" : "none";
    }
}


function currentStepContext() {
    const baseToolId = Number(editToolId?.value || selectedToolId || "0");
    const baseTool = registryTools.find((item) => Number(item.id) === baseToolId) || null;

    const resolvedStepId = Number(selectedContextStepId || baseTool?.step_id || 0);
    const resolvedStepKey = String(selectedContextStepKey || baseTool?.step_key || "").trim().toLowerCase();

    return {
        stepId: resolvedStepId,
        stepKey: resolvedStepKey,
        workflowKey: (editToolWorkflowKey?.value || "scan").trim().toLowerCase(),
        categoryKey: (editToolCategory?.value || "general").trim().toLowerCase(),
    };
}


function loadStepToolsFromRegistry() {
    const { stepId, stepKey, workflowKey, categoryKey } = currentStepContext();
    if (stepId > 0) {
        stepTools = registryTools.filter((item) => Number(item.step_id || 0) === stepId);
    } else if (stepKey) {
        stepTools = registryTools.filter((item) => String(item.step_key || "").toLowerCase() === stepKey);
    } else {
        stepTools = registryTools.filter((item) => {
            return String(item.workflow_key || "").toLowerCase() === workflowKey
                && String(item.test_category || "").toLowerCase() === categoryKey;
        });
    }

    if (selectedStepToolId && !stepTools.some((item) => Number(item.id) === Number(selectedStepToolId))) {
        selectedStepToolId = 0;
    }

    renderStepToolsTable();
}


function clearParameterSelection() {
    selectedStepToolId = 0;
    if (parameterToolId) {
        parameterToolId.value = "";
    }
    registryParameters = [];
    renderToolParametersTable();
    if (selectedToolHint) {
        selectedToolHint.textContent = "Listeden bir gorev secin.";
    }
    if (toolParameterForm) {
        toolParameterForm.reset();
    }
    if (parameterId) {
        parameterId.value = "";
    }
    if (parameterEditorTitle) {
        parameterEditorTitle.textContent = "Parametre Ekle";
    }
    setParameterEditorVisible(false);
}


function openParameterEditor(item = null) {
    if (!toolParameterForm) {
        return;
    }
    if (!selectedStepToolId) {
        setFeedback("Once adim listesinden bir gorev secin.", true);
        return;
    }

    if (parameterToolId) {
        parameterToolId.value = String(selectedStepToolId);
    }

    if (item) {
        if (parameterId) parameterId.value = String(item.id);
        if (parameterEditorTitle) parameterEditorTitle.textContent = "Parametre Duzenle";
        if (parameterKey) {
            parameterKey.value = item.param_key || "";
            parameterKey.readOnly = true;
        }
        if (parameterLabel) parameterLabel.value = item.label || "";
        if (parameterType) parameterType.value = item.param_type || "string";
        if (parameterDefault) parameterDefault.value = String(item.default_value || "");
        if (parameterRequired) parameterRequired.checked = Boolean(item.is_required);
    } else {
        if (parameterId) parameterId.value = "";
        if (parameterEditorTitle) parameterEditorTitle.textContent = "Parametre Ekle";
        toolParameterForm.reset();
        if (parameterKey) {
            parameterKey.readOnly = false;
        }
        if (parameterType) parameterType.value = "string";
        if (parameterRequired) parameterRequired.checked = false;
    }

    setParameterEditorVisible(true);
}


function renderStepToolsTable() {
    if (!stepToolsTbody) {
        return;
    }
    if (!stepTools.length) {
        stepToolsTbody.innerHTML = "<tr><td colspan='4'>Bu adimda gorev yok.</td></tr>";
        return;
    }

    stepToolsTbody.innerHTML = stepTools.map((item) => {
        const selectedClass = Number(item.id) === Number(selectedStepToolId) ? " class=\"step-tool-selected\"" : "";
        return `
            <tr data-action="pick-step-tool" data-tool-id="${item.id}"${selectedClass}>
                <td>${item.id}</td>
                <td>${item.action_key}</td>
                <td>${item.display_name || "-"}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
            </tr>
        `;
    }).join("");
}


function setScriptEditorVisible(visible) {
    if (scriptListArea) {
        scriptListArea.style.display = visible ? "none" : "block";
    }
    if (toolScriptForm) {
        toolScriptForm.style.display = visible ? "flex" : "none";
    }
}


function ensureScriptEditor() {
    if (scriptCodeEditor || !scriptCodeEditorElement || !window.ace) {
        return;
    }
    scriptCodeEditor = window.ace.edit("scriptCodeEditor");
    scriptCodeEditor.setTheme("ace/theme/monokai");
    scriptCodeEditor.session.setMode("ace/mode/python");
    scriptCodeEditor.session.setUseWrapMode(true);
    scriptCodeEditor.setOption("fontSize", "13px");
}


function setScriptEditorMode(mode) {
    scriptEditorMode = mode === "edit" ? "edit" : "upload";
    if (scriptEditorWrap) {
        scriptEditorWrap.style.display = scriptEditorMode === "edit" ? "block" : "none";
    }
    if (scriptUpload) {
        scriptUpload.required = scriptEditorMode === "upload";
        scriptUpload.value = "";
    }
    if (scriptCodeEditor) {
        if (scriptEditorMode === "upload") {
            scriptCodeEditor.setValue("", -1);
        }
        scriptCodeEditor.resize();
    }
}


function getFilteredProgressCategories(workflowKey) {
    const normalized = (workflowKey || "scan").trim().toLowerCase();
    return progressCategories.filter((item) => item.is_active && String(item.workflow_key || "").toLowerCase() === normalized);
}


function renderCategorySelect(selectElement, workflowKey, selectedCategory = "") {
    if (!selectElement) {
        return;
    }
    const filtered = getFilteredProgressCategories(workflowKey);
    selectElement.innerHTML = filtered
        .map((item) => `<option value="${item.category_key}">${item.display_name} (${item.category_key})</option>`)
        .join("");

    if (!filtered.length) {
        const fallback = document.createElement("option");
        fallback.value = "";
        fallback.textContent = "Kategori yok";
        selectElement.appendChild(fallback);
        selectElement.value = "";
        return;
    }

    const match = filtered.find((item) => item.category_key === selectedCategory);
    selectElement.value = match ? match.category_key : filtered[0].category_key;
}


function renderProgressCategorySelects() {
    renderCategorySelect(toolCategory, toolWorkflowKey?.value || "scan", toolCategory?.value || "");
    renderCategorySelect(editToolCategory, editToolWorkflowKey?.value || "scan", editToolCategory?.value || "");
    renderCategorySelect(stepCategory, stepWorkflow?.value || "scan", stepCategory?.value || "");
}


function renderStepSelect(selectElement, selectedStepId = "") {
    if (!selectElement) {
        return;
    }
    const rows = (registrySteps || []).filter((item) => Boolean(item.is_active));
    selectElement.innerHTML = rows
        .map((item) => `<option value="${item.id}">${item.display_name} (${item.step_key}) - ${item.workflow_key}/${item.category_key}</option>`)
        .join("");

    if (!rows.length) {
        const fallback = document.createElement("option");
        fallback.value = "";
        fallback.textContent = "Adim yok";
        selectElement.appendChild(fallback);
        selectElement.value = "";
        return;
    }

    const matched = rows.find((item) => String(item.id) === String(selectedStepId || ""));
    selectElement.value = matched ? String(matched.id) : String(rows[0].id);
}


function syncTaskCreateStepSelection() {
    const stepIdValue = Number(toolStepId?.value || "0");
    const selected = registrySteps.find((item) => Number(item.id) === stepIdValue);
    if (!selected) {
        return;
    }
    if (toolWorkflowKey) toolWorkflowKey.value = selected.workflow_key || "scan";
    renderCategorySelect(toolCategory, selected.workflow_key || "scan", selected.category_key || "");
    if (toolCategory) toolCategory.value = selected.category_key || toolCategory.value;
}


function syncTaskEditStepSelection() {
    const stepIdValue = Number(editToolStepId?.value || "0");
    const selected = registrySteps.find((item) => Number(item.id) === stepIdValue);
    if (!selected) {
        return;
    }

    selectedContextStepId = Number(selected.id);
    selectedContextStepKey = String(selected.step_key || "").trim().toLowerCase();

    if (editToolWorkflowKey) editToolWorkflowKey.value = selected.workflow_key || "scan";
    renderCategorySelect(editToolCategory, selected.workflow_key || "scan", selected.category_key || "");
    if (editToolCategory) editToolCategory.value = selected.category_key || editToolCategory.value;

    loadStepToolsFromRegistry();
    clearParameterSelection();

    if (stepContextText) {
        stepContextText.textContent = `Adim: ${selected.display_name} (${selected.step_key}) | ${selected.workflow_key} / ${selected.category_key}`;
    }
}


function renderStepsTable() {
    if (!stepsTbody) {
        return;
    }

    const items = getVisibleSteps();
    if (!items.length) {
        stepsTbody.innerHTML = "<tr><td colspan='7'>Adim bulunamadi.</td></tr>";
        return;
    }

    stepsTbody.innerHTML = items.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.step_key}</td>
                <td>${item.display_name}</td>
                <td>${item.workflow_key}</td>
                <td>${item.category_key}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button data-action="edit-step" data-step-id="${item.id}">Duzenle</button>
                        <button data-action="delete-step" data-step-id="${item.id}">Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


function getStepFilterValues() {
    return {
        id: (filterStepId?.value || "").trim().toLowerCase(),
        step_key: (filterStepKey?.value || "").trim().toLowerCase(),
        display_name: (filterStepDisplayName?.value || "").trim().toLowerCase(),
        workflow_key: (filterStepWorkflow?.value || "").trim().toLowerCase(),
        category_key: (filterStepCategory?.value || "").trim().toLowerCase(),
        is_active: (filterStepActive?.value || "").trim().toLowerCase(),
    };
}


function getVisibleSteps() {
    const filters = getStepFilterValues();
    let items = [...registrySteps];

    items = items.filter((item) => {
        if (filters.id && !String(item.id).toLowerCase().includes(filters.id)) return false;
        if (filters.step_key && !String(item.step_key || "").toLowerCase().includes(filters.step_key)) return false;
        if (filters.display_name && !String(item.display_name || "").toLowerCase().includes(filters.display_name)) return false;
        if (filters.workflow_key && String(item.workflow_key || "").toLowerCase() !== filters.workflow_key) return false;
        if (filters.category_key && !String(item.category_key || "").toLowerCase().includes(filters.category_key)) return false;
        if (filters.is_active) {
            const activeText = item.is_active ? "yes" : "no";
            if (activeText !== filters.is_active) return false;
        }
        return true;
    });

    return items;
}


async function loadSteps() {
    const data = await apiRequest("/settings/steps", { cache: "no-store" });
    registrySteps = Array.isArray(data.items) ? data.items : [];
    renderStepsTable();
    renderStepSelect(toolStepId, toolStepId?.value || "");
    renderStepSelect(editToolStepId, editToolStepId?.value || "");
    syncTaskCreateStepSelection();
}


function openStepEditor(item = null) {
    if (!stepForm) {
        return;
    }
    if (stepsListArea) {
        stepsListArea.style.display = "none";
    }
    stepForm.style.display = "grid";

    if (item) {
        if (stepId) stepId.value = String(item.id);
        if (stepKey) {
            stepKey.value = item.step_key || "";
            stepKey.readOnly = true;
        }
        if (stepDisplayName) stepDisplayName.value = item.display_name || "";
        if (stepWorkflow) stepWorkflow.value = item.workflow_key || "scan";
        renderCategorySelect(stepCategory, stepWorkflow?.value || "scan", item.category_key || "");
        if (stepCategory) stepCategory.value = item.category_key || stepCategory.value;
        if (stepDescription) stepDescription.value = item.description || "";
        if (stepActive) stepActive.checked = Boolean(item.is_active);
        if (stepItemsHint) stepItemsHint.textContent = `Adim: ${item.display_name} (${item.step_key})`;
        loadStepItems(item.id);
        setStepItemCreateActionsVisible(true);
    } else {
        stepForm.reset();
        if (stepId) stepId.value = "";
        if (stepKey) {
            stepKey.readOnly = false;
        }
        if (stepWorkflow) stepWorkflow.value = "scan";
        renderCategorySelect(stepCategory, "scan", "");
        if (stepActive) stepActive.checked = true;
        stepItems = [];
        selectedStepItemId = 0;
        stepItemParameters = [];
        renderStepItemsTable();
        renderStepItemParametersTable();
        if (stepItemsHint) stepItemsHint.textContent = "Adimi kaydedince gorev ve script ekleyebilirsin.";
        if (stepItemParamsCard) stepItemParamsCard.style.display = "none";
        setStepItemCreateActionsVisible(false);
    }

    setStepItemTaskEditorVisible(false);
    setStepItemScriptEditorVisible(false);
    setStepItemScriptCodeEditorVisible(false);
    setStepItemListVisible(Boolean(item));
    setStepItemParamEditorVisible(false);
    refreshPathNavigation();
}


function closeStepEditor() {
    if (!stepForm) {
        return;
    }
    stepForm.style.display = "none";
    if (stepsListArea) {
        stepsListArea.style.display = "block";
    }
    stepForm.reset();
    if (stepId) stepId.value = "";
    if (stepKey) {
        stepKey.readOnly = false;
    }
    stepItems = [];
    stepItemParameters = [];
    selectedStepItemId = 0;
    renderStepItemsTable();
    renderStepItemParametersTable();
    setStepItemTaskEditorVisible(false);
    setStepItemScriptEditorVisible(false);
    setStepItemScriptCodeEditorVisible(false);
    setStepItemListVisible(true);
    setStepItemCreateActionsVisible(false);
    setStepItemParamEditorVisible(false);
    if (stepItemParamsCard) stepItemParamsCard.style.display = "none";
    refreshPathNavigation();
}


function setStepItemListVisible(visible) {
    if (!stepItemsListArea) {
        return;
    }
    stepItemsListArea.style.display = visible ? "block" : "none";
    if (backToStepItemsListBtn) {
        backToStepItemsListBtn.style.display = visible ? "none" : "inline-flex";
    }
    refreshPathNavigation();
}


function setStepItemCreateActionsVisible(visible) {
    if (!stepItemCreateActions) {
        return;
    }
    stepItemCreateActions.style.display = visible ? "flex" : "none";
}


function setStepItemTaskEditorVisible(visible) {
    if (!stepItemTaskFormWrap) {
        return;
    }
    stepItemTaskFormWrap.style.display = visible ? "block" : "none";
    refreshPathNavigation();
}


function setStepItemScriptEditorVisible(visible) {
    if (!stepItemScriptFormWrap) {
        return;
    }
    stepItemScriptFormWrap.style.display = visible ? "block" : "none";
    refreshPathNavigation();
}


function setStepItemParamEditorVisible(visible) {
    if (!stepItemParamFormWrap) {
        return;
    }
    stepItemParamFormWrap.style.display = visible ? "block" : "none";
    refreshPathNavigation();
}


function setStepItemScriptCodeEditorVisible(visible) {
    if (!stepItemScriptEditorCard) {
        return;
    }
    stepItemScriptEditorCard.style.display = visible ? "block" : "none";
    if (visible) {
        ensureStepItemScriptCodeEditor();
        stepItemScriptCodeEditor?.resize();
    }
    refreshPathNavigation();
}


function inferAceModeFromFilename(filename) {
    const lower = String(filename || "").toLowerCase();
    if (lower.endsWith(".py")) return "ace/mode/python";
    if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "ace/mode/sh";
    if (lower.endsWith(".ps1")) return "ace/mode/powershell";
    if (lower.endsWith(".js")) return "ace/mode/javascript";
    if (lower.endsWith(".json")) return "ace/mode/json";
    if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "ace/mode/yaml";
    return "ace/mode/text";
}


function ensureStepItemScriptCodeEditor() {
    if (stepItemScriptCodeEditor || !stepItemScriptCodeEditorElement || !window.ace) {
        return;
    }
    stepItemScriptCodeEditor = window.ace.edit("stepItemScriptCodeEditor");
    stepItemScriptCodeEditor.setTheme("ace/theme/monokai");
    stepItemScriptCodeEditor.session.setMode("ace/mode/python");
    stepItemScriptCodeEditor.session.setUseWrapMode(true);
    stepItemScriptCodeEditor.setOption("fontSize", "13px");
    stepItemScriptCodeEditor.setOption("showPrintMargin", false);
}


async function openStepItemScriptCodeEditor(itemIdValue) {
    const scriptItemId = Number(itemIdValue || 0);
    if (!scriptItemId) {
        setFeedback("Script secimi gecersiz.", true);
        return;
    }

    try {
        const data = await apiRequest(`/settings/steps/items/${scriptItemId}/script-content`, { cache: "no-store" });
        const item = data?.item || null;
        const filename = data?.script_filename || "script.py";
        const source = String(data?.script_source || "");

        ensureStepItemScriptCodeEditor();
        if (stepItemScriptCodeEditor) {
            stepItemScriptCodeEditor.session.setMode(inferAceModeFromFilename(filename));
            stepItemScriptCodeEditor.setValue(source, -1);
        }

        if (stepItemScriptEditorTitle) {
            const titleName = item?.display_name || item?.item_key || "Script";
            stepItemScriptEditorTitle.textContent = `${titleName} - ${filename}`;
        }

        setStepItemScriptCodeEditorVisible(true);
    } catch (error) {
        setStepItemScriptCodeEditorVisible(false);
        setStepItemListVisible(true);
        setFeedback(error.message || "Script icerigi yuklenemedi.", true);
    }
}


function resetTaskStepItemEditor() {
    if (taskStepItemId) taskStepItemId.value = "";
    if (taskStepItemDisplayName) taskStepItemDisplayName.value = "";
    if (taskStepItemDescription) taskStepItemDescription.value = "";
    if (taskStepItemActive) taskStepItemActive.checked = true;
}


function resetScriptStepItemEditor() {
    if (scriptStepItemId) scriptStepItemId.value = "";
    if (scriptStepItemDisplayName) scriptStepItemDisplayName.value = "";
    if (scriptStepItemDescription) scriptStepItemDescription.value = "";
    if (scriptStepItemActive) scriptStepItemActive.checked = true;
    if (stepItemScriptFile) stepItemScriptFile.value = "";
}


function renderStepItemsTable() {
    if (!stepItemsTbody) {
        return;
    }
    if (!stepItems.length) {
        stepItemsTbody.innerHTML = "<tr><td colspan='8'>Bu adimda gorev/script yok.</td></tr>";
        return;
    }

    stepItemsTbody.innerHTML = stepItems.map((item) => {
        const selected = Number(item.id) === Number(selectedStepItemId) ? " style='background: rgba(119, 164, 236, 0.2);'" : "";
        const scriptFileName = item.script_path ? String(item.script_path).split("/").pop() : "-";
        return `
            <tr${selected}>
                <td>${item.id}</td>
                <td>${item.item_type}</td>
                <td>${item.display_name || "-"}</td>
                <td>${item.item_key || "-"}</td>
                <td>${item.description || "-"}</td>
                <td>${scriptFileName || "-"}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        <button type="button" data-action="pick-step-item" data-item-id="${item.id}">Sec</button>
                        <button type="button" data-action="edit-step-item" data-item-id="${item.id}">Duzenle</button>
                        <button type="button" data-action="delete-step-item" data-item-id="${item.id}">Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


function renderStepItemParametersTable() {
    if (!stepItemParamsTbody) {
        return;
    }
    if (!stepItemParameters.length) {
        stepItemParamsTbody.innerHTML = "<tr><td colspan='10'>Parametre yok.</td></tr>";
        return;
    }

    stepItemParamsTbody.innerHTML = stepItemParameters.map((item) => {
        const optionsRaw = Array.isArray(item.options_json) || (item.options_json && typeof item.options_json === "object")
            ? JSON.stringify(item.options_json)
            : "[]";
        const isPersisted = Number.isFinite(Number(item.id));
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.param_key}</td>
                <td>${item.label}</td>
                <td>${item.param_type}</td>
                <td>${item.default_value || ""}</td>
                <td>${item.description || ""}</td>
                <td>${escPentest(optionsRaw)}</td>
                <td>${item.is_required ? "yes" : "no"}</td>
                <td>${item.sort_order}</td>
                <td>
                    <div style="display:flex; gap:6px;">
                        ${isPersisted ? `<button type="button" data-action="edit-step-item-param" data-param-id="${item.id}">Duzenle</button>` : ""}
                        ${isPersisted ? `<button type="button" data-action="delete-step-item-param" data-param-id="${item.id}">Sil</button>` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


async function loadStepItems(stepIdValue) {
    if (!stepIdValue) {
        stepItems = [];
        selectedStepItemId = 0;
        stepItemParameters = [];
        detectedStepItemParameters = [];
        if (detectStepItemParamsBtn) detectStepItemParamsBtn.disabled = true;
        if (saveDetectedStepItemParamsBtn) saveDetectedStepItemParamsBtn.disabled = true;
        renderStepItemsTable();
        renderStepItemParametersTable();
        return;
    }

    const data = await apiRequest(`/settings/steps/${stepIdValue}/items`, { cache: "no-store" });
    stepItems = Array.isArray(data.items) ? data.items : [];
    if (!stepItems.some((item) => Number(item.id) === Number(selectedStepItemId))) {
        selectedStepItemId = 0;
        stepItemParameters = [];
        detectedStepItemParameters = [];
        if (detectStepItemParamsBtn) detectStepItemParamsBtn.disabled = true;
        if (saveDetectedStepItemParamsBtn) saveDetectedStepItemParamsBtn.disabled = true;
    }
    renderStepItemsTable();
    renderStepItemParametersTable();
}


async function loadStepItemParameters(itemIdValue) {
    if (!itemIdValue) {
        stepItemParameters = [];
        renderStepItemParametersTable();
        return;
    }

    const data = await apiRequest(`/settings/steps/items/${itemIdValue}/parameters`, { cache: "no-store" });
    stepItemParameters = Array.isArray(data.items) ? data.items : [];
    detectedStepItemParameters = [];
    renderStepItemParametersTable();
}


function openTaskStepItemEditor(item = null) {
    if (!stepId?.value) {
        setFeedback("Once adimi kaydetmelisin.", true);
        return;
    }

    if (item) {
        if (taskStepItemId) taskStepItemId.value = String(item.id);
        if (taskStepItemDisplayName) taskStepItemDisplayName.value = item.display_name || "";
        if (taskStepItemDescription) taskStepItemDescription.value = item.description || "";
        if (taskStepItemActive) taskStepItemActive.checked = Boolean(item.is_active);
    } else {
        resetTaskStepItemEditor();
    }

    setStepItemListVisible(false);
    setStepItemScriptEditorVisible(false);
    setStepItemScriptCodeEditorVisible(false);
    setStepItemTaskEditorVisible(true);
}


function openScriptStepItemEditor(item = null) {
    if (!stepId?.value) {
        setFeedback("Once adimi kaydetmelisin.", true);
        return;
    }

    if (item) {
        if (scriptStepItemId) scriptStepItemId.value = String(item.id);
        if (scriptStepItemDisplayName) scriptStepItemDisplayName.value = item.display_name || "";
        if (scriptStepItemDescription) scriptStepItemDescription.value = item.description || "";
        if (scriptStepItemActive) scriptStepItemActive.checked = Boolean(item.is_active);
    } else {
        resetScriptStepItemEditor();
    }

    setStepItemListVisible(false);
    setStepItemTaskEditorVisible(false);
    setStepItemScriptCodeEditorVisible(false);
    setStepItemScriptEditorVisible(true);
}


function openStepItemParameterEditor(item = null) {
    const selectedItem = stepItems.find((row) => Number(row.id) === Number(selectedStepItemId));
    if (!selectedItem) {
        setFeedback("Once bir kayit secmelisin.", true);
        return;
    }

    if (item) {
        if (stepItemParamId) stepItemParamId.value = String(item.id);
        if (stepItemParamKey) {
            stepItemParamKey.value = item.param_key || "";
            stepItemParamKey.readOnly = true;
        }
        if (stepItemParamLabel) stepItemParamLabel.value = item.label || "";
        if (stepItemParamType) stepItemParamType.value = item.param_type || "string";
        if (stepItemParamDefault) stepItemParamDefault.value = item.default_value || "";
        if (stepItemParamDescription) stepItemParamDescription.value = item.description || "";
        if (stepItemParamOptions) {
            const optionsText = Array.isArray(item.options_json) || (item.options_json && typeof item.options_json === "object")
                ? JSON.stringify(item.options_json, null, 2)
                : "[]";
            stepItemParamOptions.value = optionsText;
        }
        if (stepItemParamRequired) stepItemParamRequired.checked = Boolean(item.is_required);
        if (stepItemParamSortOrder) stepItemParamSortOrder.value = String(item.sort_order || 100);
        if (stepItemParamEditorTitle) stepItemParamEditorTitle.textContent = "Parametre Duzenle";
    } else {
        if (stepItemParamId) stepItemParamId.value = "";
        if (stepItemParamKey) {
            stepItemParamKey.value = "";
            stepItemParamKey.readOnly = false;
        }
        if (stepItemParamLabel) stepItemParamLabel.value = "";
        if (stepItemParamType) stepItemParamType.value = "string";
        if (stepItemParamDefault) stepItemParamDefault.value = "";
        if (stepItemParamDescription) stepItemParamDescription.value = "";
        if (stepItemParamOptions) stepItemParamOptions.value = "[]";
        if (stepItemParamRequired) stepItemParamRequired.checked = false;
        if (stepItemParamSortOrder) stepItemParamSortOrder.value = "100";
        if (stepItemParamEditorTitle) stepItemParamEditorTitle.textContent = "Parametre Ekle";
    }

    setStepItemParamEditorVisible(true);
}


async function pickStepItem(itemIdValue) {
    selectedStepItemId = Number(itemIdValue || 0);
    renderStepItemsTable();
    setStepItemTaskEditorVisible(false);
    setStepItemScriptEditorVisible(false);
    setStepItemParamEditorVisible(false);
    setStepItemListVisible(false);

    const selectedItem = stepItems.find((row) => Number(row.id) === Number(selectedStepItemId));
    if (!selectedItem) {
        stepItemParameters = [];
        renderStepItemParametersTable();
        if (stepItemParamsCard) {
            stepItemParamsCard.style.display = "none";
        }
        return;
    }

    if (stepItemsHint) {
        const itemTypeLabel = selectedItem.item_type === "script" ? "Script" : "Gorev";
        const descriptionText = String(selectedItem.description || "").trim() || "Aciklama yok.";
        stepItemsHint.textContent = `${itemTypeLabel}: ${selectedItem.display_name} - ${descriptionText}`;
    }

    if (stepItemParamsHint) {
        const itemLabel = selectedItem.item_type === "script" ? "Secili script" : "Secili gorev";
        stepItemParamsHint.textContent = `${itemLabel}: ${selectedItem.display_name}`;
    }
    if (showCreateStepItemParamBtn) {
        showCreateStepItemParamBtn.disabled = false;
    }
    if (detectStepItemParamsBtn) {
        detectStepItemParamsBtn.disabled = selectedItem.item_type !== "script";
    }
    if (saveDetectedStepItemParamsBtn) {
        saveDetectedStepItemParamsBtn.disabled = true;
    }

    if (stepItemParamsCard) {
        stepItemParamsCard.style.display = "block";
    }
    await loadStepItemParameters(selectedStepItemId);

    if (selectedItem.item_type === "script") {
        setStepItemParamEditorVisible(false);
        await openStepItemScriptCodeEditor(selectedStepItemId);
    } else {
        setStepItemScriptCodeEditorVisible(false);
    }
}


function renderProgressCategoriesTable() {
    if (!progressCategoriesTbody) {
        return;
    }

    if (!progressCategories.length) {
        progressCategoriesTbody.innerHTML = "<tr><td colspan='7'>Kategori bulunamadi.</td></tr>";
        return;
    }

    progressCategoriesTbody.innerHTML = progressCategories.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.category_key}</td>
                <td>${item.display_name}</td>
                <td>${item.workflow_key}</td>
                <td>${item.description || "-"}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button data-action="edit-category" data-category-id="${item.id}">Düzenle</button>
                        <button data-action="delete-category" data-category-id="${item.id}">Sil</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}


function setToolsView(mode) {
    if (toolsListView) {
        toolsListView.style.display = mode === "list" ? "block" : "none";
    }
    if (toolsCreateView) {
        toolsCreateView.style.display = mode === "create" ? "block" : "none";
    }
    if (toolsEditView) {
        toolsEditView.style.display = mode === "edit" ? "block" : "none";
    }
    refreshPathNavigation();
}


function renderToolScriptsTable() {
    if (!toolScriptsTbody) {
        return;
    }

    if (!registryScripts.length) {
        toolScriptsTbody.innerHTML = "<tr><td colspan='6'>Script bulunamadi.</td></tr>";
        return;
    }

    toolScriptsTbody.innerHTML = registryScripts.map((item) => {
        return `
            <tr>
                <td>${item.id}</td>
                <td>${item.script_name}</td>
                <td>${item.filename || "-"}</td>
                <td>${item.sort_order}</td>
                <td>${item.is_active ? "yes" : "no"}</td>
                <td>
                    <button data-action="load-script" data-script-id="${item.id}">Düzenle</button>
                    <button data-action="toggle-script" data-script-id="${item.id}">${item.is_active ? "Pasif" : "Aktif"}</button>
                    <button data-action="delete-script" data-script-id="${item.id}">Sil</button>
                </td>
            </tr>
        `;
    }).join("");
}


async function loadToolScripts(toolId) {
    const data = await apiRequest(`/settings/tool-registry/${toolId}/scripts`, { cache: "no-store" });
    registryScripts = Array.isArray(data.items) ? data.items : [];
    renderToolScriptsTable();
}


async function openToolEdit(toolId) {
    const target = registryTools.find((item) => Number(item.id) === Number(toolId));
    if (!target) {
        throw new Error("Gorev bulunamadi.");
    }

    selectedToolId = Number(toolId);
    if (editToolId) editToolId.value = String(target.id);
    if (editToolActionKey) editToolActionKey.value = target.action_key || "";
    if (editToolDisplayName) editToolDisplayName.value = target.display_name || "";
    renderStepSelect(editToolStepId, target.step_id || "");
    if (editToolStepId && target.step_id) {
        editToolStepId.value = String(target.step_id);
    }
    syncTaskEditStepSelection();
    if (editToolRiskLevel) editToolRiskLevel.value = target.risk_level || "low";
    if (editToolTimeout) editToolTimeout.value = String(target.timeout_sec || 300);
    if (editToolBaseCommand) editToolBaseCommand.value = target.base_command || "";
    if (editToolRequiresApproval) editToolRequiresApproval.checked = Boolean(target.requires_approval);
    if (editToolActive) editToolActive.checked = Boolean(target.is_active);
    if (parameterToolId) parameterToolId.value = String(target.id);
    if (scriptToolId) scriptToolId.value = String(target.id);

    selectedContextStepId = Number(target.step_id || 0);
    selectedContextStepKey = String(target.step_key || target.test_step || "").trim().toLowerCase();

    await loadToolScripts(target.id);
    loadStepToolsFromRegistry();
    if (stepContextText) {
        const stepLabel = String(target.step_display_name || target.step_key || target.test_step || "-");
        const stepKey = String(target.step_key || target.test_step || "-");
        const workflowKey = String(target.workflow_key || "scan");
        const categoryKey = String(target.test_category || "general");
        stepContextText.textContent = `Adim: ${stepLabel} (${stepKey}) | ${workflowKey} / ${categoryKey}`;
    }
    clearParameterSelection();

    if (toolScriptForm) {
        toolScriptForm.reset();
        if (scriptToolId) scriptToolId.value = String(target.id);
        if (scriptId) scriptId.value = "";
        if (scriptSortOrder) scriptSortOrder.value = "100";
    }

    setParameterEditorVisible(false);
    setScriptEditorVisible(false);
    setScriptEditorMode("upload");

    setToolsView("edit");
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
            <tr data-action="edit-parameter" data-parameter-id="${item.id}">
                <td>${item.id}</td>
                <td>${item.param_key}</td>
                <td>${item.param_type}</td>
                <td>${String(item.default_value || "")}</td>
                <td>${item.is_required ? "yes" : "no"}</td>
            </tr>
        `;
    }).join("");
}


async function loadTools() {
    const data = await apiRequest("/settings/tool-registry", { cache: "no-store" });
    registryTools = Array.isArray(data.items) ? data.items : [];
    updateToolSortIndicators();
    renderToolsTable();
}


async function loadProgressCategories() {
    const data = await apiRequest("/settings/progress-categories", { cache: "no-store" });
    progressCategories = Array.isArray(data.items) ? data.items : [];
    renderProgressCategoriesTable();
    renderProgressCategorySelects();
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

        const providerSelect = document.getElementById("aiProvider");
        if (providerSelect) {
            providerSelect.value = settingsConfig.ai.provider === "cloud" ? "cloud" : "local";
        }
        const cloudFormat = document.getElementById("aiCloudFormat");
        if (cloudFormat) {
            cloudFormat.value = settingsConfig.ai.cloud_format === "anthropic" ? "anthropic" : "openai";
        }
        const cloudUrl = document.getElementById("aiCloudUrl");
        if (cloudUrl) {
            cloudUrl.value = settingsConfig.ai.cloud_api_url || "";
        }
        const cloudModel = document.getElementById("aiCloudModel");
        if (cloudModel) {
            cloudModel.value = settingsConfig.ai.cloud_model || "";
        }
        const keyState = document.getElementById("aiCloudKeyState");
        if (keyState) {
            keyState.innerText = settingsConfig.ai.cloud_api_key_set
                ? "Kayıtlı bir API anahtarı var. Değiştirmek için yenisini girin, aynı kalması için boş bırakın."
                : "Henüz API anahtarı kaydedilmemiş.";
        }
        updateAiProviderVisibility();
    }

    // Scan settings are admin-only, so their inputs don't exist for other users;
    // guard against that (non-admins receive an empty scan object).
    if (settingsConfig.scan && nmapTimeout && masscanTimeout && netdiscoverTimeout) {
        nmapTimeout.value = settingsConfig.scan.nmap_timeout_sec || 600;
        masscanTimeout.value = settingsConfig.scan.masscan_timeout_sec || 600;
        netdiscoverTimeout.value = settingsConfig.scan.netdiscover_timeout_sec || 180;
    }

    const workflowModeSelect = document.getElementById("workflowMode");
    if (workflowModeSelect) {
        const mode = String(settingsConfig.workflow?.mode || "manual").toLowerCase();
        workflowModeSelect.value = mode === "ai" ? "ai" : "manual";
    }
}


// Single source of truth for "load this tab's data". Called from BOTH the first
// paint (initializeAccess) and tab clicks, so every tab loads identically no
// matter how it is reached (refresh, deep link, or click). Previously this logic
// was duplicated in two places and drifted — new tabs (toolsmgmt/wordlists/
// database) were only wired into the click path, so on refresh their content
// stayed empty until the user clicked away and back.
async function loadTabData(tab, { force = false } = {}) {
    if ((tab === "users" || tab === "roles") && hasTab("users")) {
        await loadUsersAndRoles();
    }
    if ((tab === "ai" || tab === "scan") && hasTab("ai")) {
        await loadSettingsConfig();
        hydrateAdminSettingsForms();
        if (tab === "ai") {
            await loadAiModels();
        }
    }
    if (tab === "system" && hasTab("system")) {
        await loadSystemInfo(force);
    }
    if (tab === "tools" && hasTab("tools")) {
        await Promise.all([loadProgressCategories(), loadSteps()]);
    }
    if (tab === "progress-categories" && hasTab("progress-categories")) {
        await loadProgressCategories();
    }
    if (tab === "toolsmgmt" && hasTab("toolsmgmt")) {
        await loadPentestTools();
    }
    if (tab === "wordlists" && hasTab("wordlists")) {
        await loadWordlists();
        refreshWordlistInstall();
    }
    if (tab === "database" && hasTab("database")) {
        await loadDatabaseTab();
    }
    if (tab === "security" && hasTab("security")) {
        loadNetworkStatus();
    }
    // Service controls are admin-only; only refresh their status when present.
    if (tab === "ai" && hasTab("ai") && document.getElementById("ollamaServiceStatus")) {
        refreshOllamaStatus("status");
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

    // Per-user default rows-per-page for all data tables (Appearance setting).
    const tablePageSize = Number.isFinite(access.table_page_size) ? access.table_page_size : 10;
    window.__ssvpTablePageSize = tablePageSize;
    if (appearanceTablePageSize) appearanceTablePageSize.value = String(tablePageSize);
    if (window.SSVPTable) window.SSVPTable.setDefaultPageSize(tablePageSize);

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
    const requestedTab = hashSegmentToTab(requested.split("/")[0] || "");
    const firstTab = accessTabs.includes(requestedTab) ? requestedTab : (accessTabs[0] || "system");
    activateTab(firstTab);

    // Load the active tab's data on first paint (covers EVERY tab, same as clicks).
    await loadTabData(firstTab);

    if (requested) {
        await navigateToPath(`/settings#${requested}`);
    } else {
        refreshPathNavigation(true);
    }
}


tabButtons.forEach((button) => {
    button.addEventListener("click", async () => {
        if (IS_PANEL_PAGE) {
            return;
        }
        const tab = button.dataset.tab;
        activateTab(tab);
        await loadTabData(tab, { force: true });
        if (tab === "users") {
            resetEditForm();
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


if (pathBreadcrumb) {
    pathBreadcrumb.addEventListener("click", async (event) => {
        const link = event.target.closest("a[data-href]");
        if (!link) {
            return;
        }
        event.preventDefault();
        await navigateToPath(link.dataset.href || "");
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


function updateAiProviderVisibility() {
    const provider = document.getElementById("aiProvider")?.value === "cloud" ? "cloud" : "local";
    const localFields = document.getElementById("aiLocalFields");
    const cloudFields = document.getElementById("aiCloudFields");
    if (localFields) {
        localFields.style.display = provider === "cloud" ? "none" : "grid";
    }
    if (cloudFields) {
        cloudFields.style.display = provider === "cloud" ? "grid" : "none";
    }
}

const aiProviderSelect = document.getElementById("aiProvider");
if (aiProviderSelect) {
    aiProviderSelect.addEventListener("change", updateAiProviderVisibility);
}

// Local Ollama systemd service control (stop it to free RAM/CPU on cloud).
const MANAGED_SERVICES = {
    ollama: { statusId: "ollamaServiceStatus", startId: "ollamaStartBtn", stopId: "ollamaStopBtn", label: "Ollama" },
    "open-webui": { statusId: "openwebuiServiceStatus", startId: "openwebuiStartBtn", stopId: "openwebuiStopBtn", label: "Open WebUI" },
};

// Show only the relevant action: Durdur when running, Başlat when stopped.
// running === null means the status is unknown → show both.
function setServiceButtons(meta, running) {
    const startBtn = document.getElementById(meta.startId);
    const stopBtn = document.getElementById(meta.stopId);
    if (startBtn) {
        startBtn.style.display = running === true ? "none" : "";
    }
    if (stopBtn) {
        stopBtn.style.display = running === false ? "none" : "";
    }
}

async function refreshServiceStatus(service, action = "status") {
    const meta = MANAGED_SERVICES[service];
    if (!meta) {
        return;
    }
    const el = document.getElementById(meta.statusId);
    if (el) {
        el.innerText = "…";
        el.style.color = "";
    }
    try {
        const res = await apiRequest("/settings/service", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service, action }),
        });
        if (el) {
            el.innerText = res.running ? "çalışıyor" : "durduruldu";
            el.style.color = res.running ? "#22c55e" : "#ef4444";
        }
        setServiceButtons(meta, Boolean(res.running));
        if (res.message) {
            setFeedback(res.message, !res.ok);
        }
    } catch (error) {
        if (el) {
            el.innerText = "durum alınamadı";
            el.style.color = "";
        }
        setServiceButtons(meta, null);
    }
}

// Backwards-compatible alias used by the AI-tab open handler.
function refreshOllamaStatus() {
    refreshServiceStatus("ollama", "status");
    refreshServiceStatus("open-webui", "status");
}

function bindServiceButtons(service, startId, stopId) {
    const startBtn = document.getElementById(startId);
    if (startBtn) {
        startBtn.addEventListener("click", async () => {
            startBtn.disabled = true;
            await refreshServiceStatus(service, "start");
            startBtn.disabled = false;
        });
    }
    const stopBtn = document.getElementById(stopId);
    if (stopBtn) {
        stopBtn.addEventListener("click", async () => {
            stopBtn.disabled = true;
            await refreshServiceStatus(service, "stop");
            stopBtn.disabled = false;
        });
    }
}

bindServiceButtons("ollama", "ollamaStartBtn", "ollamaStopBtn");
bindServiceButtons("open-webui", "openwebuiStartBtn", "openwebuiStopBtn");

// --- Network exposure (local-only vs public) toggles ---------------------
const NETWORK_SERVICES = [
    { key: "mysql", label: "MySQL", port: 3306 },
    { key: "phpmyadmin", label: "phpMyAdmin", port: 8081 },
    { key: "ollama", label: "Ollama", port: 11434 },
];

function netExposeRowHtml(svc, mode) {
    const isPublic = mode === "public";
    const badgeText = isPublic
        ? (t("settings.network.public") || "Genel (internete açık)")
        : (t("settings.network.local") || "Yalnızca yerel");
    const badgeColor = isPublic ? "#c62828" : "#1a7f37";
    const nextMode = isPublic ? "local" : "public";
    const btnText = isPublic
        ? (t("settings.network.makeLocal") || "Yerele al")
        : (t("settings.network.makePublic") || "Genele aç");
    const portLabel = svc.port ? `:${svc.port}` : "";
    return `<div class="net-expose-row" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:6px 0;">
        <span style="min-width:160px; font-weight:600;">${escPentest(svc.label)} <span class="muted" style="font-weight:400;">${escPentest(portLabel)}</span></span>
        <span style="color:${badgeColor}; font-weight:600; min-width:150px;">${escPentest(badgeText)}</span>
        <button type="button" class="net-expose-btn" data-service="${escPentest(svc.key)}" data-mode="${nextMode}">${escPentest(btnText)}</button>
    </div>`;
}

function renderNetworkExposure(services) {
    const rows = [];
    let publicCount = 0;
    NETWORK_SERVICES.forEach((svc) => {
        const mode = (services && services[svc.key]) || "local";
        if (mode === "public") publicCount += 1;
        rows.push(netExposeRowHtml(svc, mode));
    });
    const el = document.getElementById("networkExposureSecurity");
    if (el) el.innerHTML = rows.join("");

    const summary = document.getElementById("securityExposureSummary");
    if (summary) {
        if (publicCount > 0) {
            const tpl = t("settings.security.exposedCount") || "⚠ {n} servis internete açık.";
            summary.textContent = tpl.replace("{n}", String(publicCount));
            summary.style.color = "#c62828";
        } else {
            summary.textContent = t("settings.security.allLocal") || "✓ Tüm servisler yalnızca yerelde çalışıyor.";
            summary.style.color = "#1a7f37";
        }
    }
    const lockBtn = document.getElementById("securityLockdownBtn");
    if (lockBtn) lockBtn.disabled = publicCount === 0;
}

async function loadNetworkStatus() {
    if (!document.getElementById("networkExposureSecurity")) {
        return;
    }
    try {
        const data = await apiRequest("/settings/network", { cache: "no-store" });
        renderNetworkExposure(data.services || {});
    } catch (_) {
        renderNetworkExposure({});
    }
}

// Lock down: switch every internet-exposed service back to local in one click.
async function lockdownAllServices() {
    const lockBtn = document.getElementById("securityLockdownBtn");
    if (!window.confirm(t("settings.security.lockdownConfirm") || "İnternete açık tüm servisler yalnızca yerele alınacak. Onaylıyor musunuz?")) {
        return;
    }
    if (lockBtn) lockBtn.disabled = true;
    try {
        const data = await apiRequest("/settings/network", { cache: "no-store" });
        const services = (data && data.services) || {};
        const targets = NETWORK_SERVICES.filter((svc) => services[svc.key] === "public");
        for (const svc of targets) {
            await apiRequest("/settings/network", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ service: svc.key, mode: "local" }),
            });
        }
        await loadNetworkStatus();
        setFeedback(t("settings.security.lockdownDone") || "Tüm servisler yerele alındı.");
    } catch (error) {
        setFeedback(error.message || (t("settings.network.fail") || "Ağ ayarı değiştirilemedi."), true);
        await loadNetworkStatus();
    }
}

document.getElementById("securityLockdownBtn")?.addEventListener("click", lockdownAllServices);

document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.(".net-expose-btn");
    if (!btn) return;
    const service = btn.getAttribute("data-service");
    const mode = btn.getAttribute("data-mode");
    // Warn before opening a service to the internet.
    if (mode === "public" && !window.confirm(t("settings.network.confirmPublic") || "Bu servis internete açılacak. Emin misiniz? (Bulut güvenlik grubunda da portu açmanız gerekir.)")) {
        return;
    }
    btn.disabled = true;
    try {
        const res = await apiRequest("/settings/network", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service, mode }),
        });
        if (res && res.ok === false) {
            setFeedback(res.message || (t("settings.network.fail") || "Ağ ayarı değiştirilemedi."), true);
        } else {
            setFeedback(t("settings.network.done") || "Ağ erişimi güncellendi.");
        }
        renderNetworkExposure((res && res.services) || {});
    } catch (error) {
        btn.disabled = false;
        setFeedback(error.message || (t("settings.network.fail") || "Ağ ayarı değiştirilemedi."), true);
    }
});

if (aiSettingsForm) {
    aiSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!hasTab("ai")) {
            return;
        }

        const provider = document.getElementById("aiProvider")?.value === "cloud" ? "cloud" : "local";
        const cloudUrl = (document.getElementById("aiCloudUrl")?.value || "").trim();
        const cloudModel = (document.getElementById("aiCloudModel")?.value || "").trim();

        // Ollama model stays required for local; for cloud it is not used, so we
        // keep the stored/placeholder value to satisfy the backend's min length.
        let modelName = (aiModelManual.value || aiModelSelect.value || "").trim();
        if (!modelName) {
            if (provider === "local") {
                setFeedback(t("settings.error.modelRequired"), true);
                return;
            }
            modelName = (settingsConfig?.ai?.model_name || "local-model").trim();
        }

        if (provider === "cloud" && (!cloudUrl || !cloudModel)) {
            setFeedback(t("settings.ai.cloudRequired", "Bulut AI icin API adresi ve model zorunlu."), true);
            return;
        }

        try {
            const result = await apiRequest("/settings/ai", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model_name: modelName,
                    timeout_sec: Number(aiTimeout.value || 240),
                    use_fake_response: Boolean(aiFakeResponse.checked),
                    ollama_url: (aiUrl.value || "http://localhost:11434/api/chat").trim(),
                    provider,
                    cloud_api_url: cloudUrl,
                    cloud_model: cloudModel,
                    cloud_format: document.getElementById("aiCloudFormat")?.value || "openai",
                    cloud_api_key: document.getElementById("aiCloudKey")?.value || "",
                }),
            });

            if (settingsConfig && result?.ai) {
                settingsConfig.ai = result.ai;
            }
            const keyField = document.getElementById("aiCloudKey");
            if (keyField) {
                keyField.value = "";
            }
            hydrateAdminSettingsForms();
            setFeedback(t("aiSaved"));
            // "Bağlantıyı Doğrula" only makes sense against SAVED settings, so it
            // is revealed only after a successful save.
            const testBtn = document.getElementById("aiTestBtn");
            if (testBtn) {
                testBtn.hidden = false;
            }
        } catch (error) {
            setFeedback(error.message || t("settings.error.aiSave"), true);
        }
    });

    // Any edit to the AI form invalidates the last save, so hide the test button
    // again until the user saves the new values.
    const hideAiTestBtn = () => {
        const testBtn = document.getElementById("aiTestBtn");
        if (testBtn) {
            testBtn.hidden = true;
        }
        const testResult = document.getElementById("aiTestResult");
        if (testResult) {
            testResult.innerText = "";
        }
    };
    aiSettingsForm.addEventListener("input", hideAiTestBtn);
    aiSettingsForm.addEventListener("change", hideAiTestBtn);
}


const aiTestBtn = document.getElementById("aiTestBtn");
if (aiTestBtn) {
    aiTestBtn.addEventListener("click", async () => {
        if (!hasTab("ai")) {
            return;
        }
        const resultEl = document.getElementById("aiTestResult");
        aiTestBtn.disabled = true;
        if (resultEl) {
            resultEl.style.color = "";
            resultEl.innerText = t("settings.ai.testing", "Doğrulanıyor… (kaydedilen ayar test ediliyor)");
        }
        try {
            const res = await apiRequest("/settings/ai/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (resultEl) {
                const ok = Boolean(res && res.ok);
                resultEl.style.color = ok ? "#4ade80" : "#f87171";
                const parts = [(ok ? "✓ " : "✗ ") + String(res?.message || (ok ? "Başarılı" : "Başarısız"))];
                if (res?.provider) {
                    parts.push(`Sağlayıcı: ${res.provider}${res.model ? " • " + res.model : ""}`);
                }
                if (res?.detail) {
                    parts.push(`Detay: ${res.detail}`);
                }
                if (!ok) {
                    parts.push("Not: doğrulama kaydedilen ayarları test eder; değişiklik yaptıysanız önce kaydedin.");
                }
                resultEl.innerText = parts.join("\n");
            }
        } catch (error) {
            if (resultEl) {
                resultEl.style.color = "#f87171";
                resultEl.innerText = "✗ " + (error.message || "Doğrulama başarısız.");
            }
        } finally {
            aiTestBtn.disabled = false;
        }
    });
}


// --- Pentest tools management (install/update/remove server tools) ----------
function escPentest(value) {
    return String(value ?? "")
        .split("&").join("&amp;")
        .split("<").join("&lt;")
        .split(">").join("&gt;")
        .split('"').join("&quot;")
        .split("'").join("&#39;");
}

// Persistent, scrollable operation log — entries stay until "Temizle" or reload.
function pentestLog(message, kind = "") {
    const box = document.getElementById("pentestToolsLog");
    if (!box) {
        return;
    }
    const time = new Date().toLocaleTimeString("tr-TR", { hour12: false });
    const line = document.createElement("div");
    if (kind === "ok") {
        line.style.color = "#22c55e";
    } else if (kind === "error") {
        line.style.color = "#ef4444";
    } else if (kind === "run") {
        line.style.color = "#3b82f6";
    }
    line.textContent = `[${time}] ${String(message ?? "")}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

async function loadPentestTools(reconcile = false) {
    const tbody = document.getElementById("pentestToolsTbody");
    if (!tbody) {
        return;
    }
    // Always return to the list view when (re)loading tools.
    showToolList();
    // Only show a loading placeholder on the very first load; on refresh keep the
    // existing rows in place until the new data arrives so the layout doesn't
    // collapse and jump.
    if (!tbody.children.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="muted">…</td></tr>`;
    }
    if (reconcile) {
        pentestLog("Sunucu ile eşitleniyor… (kurulu araçlar taranıyor)", "run");
    }
    try {
        const url = reconcile ? "/settings/pentest-tools?refresh=1" : "/settings/pentest-tools";
        const data = await apiRequest(url, { cache: "no-store" });
        renderPentestToolsTable(Array.isArray(data.items) ? data.items : []);
        pentestLog(reconcile
            ? "Sunucudaki kurulu araçlar tarandı ve veritabanı güncellendi."
            : "Liste veritabanından yüklendi.");
    } catch (error) {
        pentestLog(error.message || "Araç listesi alınamadı.", "error");
    }
}

function renderPentestToolsTable(items) {
    const tbody = document.getElementById("pentestToolsTbody");
    if (!tbody) {
        return;
    }
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="muted">Araç bulunamadı.</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map((tool) => {
        const installed = Boolean(tool.installed);
        const statusText = installed ? t("settings.toolsmgmt.installed") : t("settings.toolsmgmt.notInstalled");
        const statusColor = installed ? "#4ade80" : "#f87171";
        const version = escPentest(tool.installed_version || (tool.candidate_version ? "aday: " + tool.candidate_version : "-"));
        const key = escPentest(tool.key);
        const label = escPentest(tool.label || tool.key);
        const pkg = escPentest(tool.package);
        const updateBadge = tool.update_available ? ` <span style="color:#fbbf24;">• güncelleme var</span>` : "";
        // Actions are a select — choosing an option runs it directly.
        const actions = `
            <div class="pentest-action-cell">
                <select class="pentest-action-select" data-tool="${key}" data-tool-label="${label}">
                    ${pentestActionOptions(tool)}
                </select>
            </div>
        `;
        return `<tr id="pentest-row-${key}">
            <td>${label}<div class="muted" style="font-size:12px;">${pkg}</div></td>
            <td style="color:${statusColor};">${escPentest(statusText)}${updateBadge}</td>
            <td>${version}</td>
            <td>${actions}</td>
        </tr>`;
    }).join("");
}

// Build the <option> list for one tool's action select, based on its state.
function pentestActionOptions(tool) {
    const installed = Boolean(tool.installed);
    const opts = [`<option value="">İşlem seçin…</option>`];
    if (installed) {
        opts.push(`<option value="check">${escPentest(t("settings.toolsmgmt.check"))}</option>`);
        if (tool.update_available) {
            opts.push(`<option value="update">${escPentest(t("settings.toolsmgmt.update"))}</option>`);
        }
        opts.push(`<option value="remove">${escPentest(t("settings.toolsmgmt.remove"))}</option>`);
    } else {
        opts.push(`<option value="install">${escPentest(t("settings.toolsmgmt.install"))}</option>`);
    }
    opts.push(`<option value="operations">Operasyon Özellikleri</option>`);
    return opts.join("");
}

const PENTEST_STAGE_LABELS = { scan: "Tarama", attack: "Atak", remediation: "Düzeltme" };

function renderToolOperationsCards(data) {
    const ops = Array.isArray(data?.operations) ? data.operations : [];
    if (!ops.length) {
        return `<p class="muted">Bu araç için tanımlı YZO operasyonu yok.</p>`;
    }
    return ops.map((op) => {
        const params = Array.isArray(op.parameters) ? op.parameters : [];
        const rows = params.map((p) => {
            const opts = Array.isArray(p.options_json) && p.options_json.length
                ? escPentest(p.options_json.join(" | ")) : "—";
            const req = p.is_required
                ? `<span class="tool-op-required">gerekli</span>`
                : `<span class="muted">—</span>`;
            const def = (p.default_value === "" || p.default_value == null) ? "—" : escPentest(String(p.default_value));
            return `<tr>
                <td><code>${escPentest(p.param_key)}</code></td>
                <td>${escPentest(p.label || "")}</td>
                <td>${escPentest(p.param_type || "string")}</td>
                <td>${req}</td>
                <td>${def}</td>
                <td>${opts}</td>
                <td class="muted">${escPentest(p.description || "")}</td>
            </tr>`;
        }).join("");
        const stageLabel = escPentest(PENTEST_STAGE_LABELS[op.stage] || op.stage);
        return `
            <div class="tool-op-card">
                <div class="tool-op-card-head">
                    <strong>${escPentest(op.display_name || op.operation_key)}</strong>
                    <span class="tool-op-badge stage-${escPentest(op.stage)}">${stageLabel}</span>
                    <span class="muted tool-op-key">${escPentest(op.operation_key)}</span>
                </div>
                ${op.when_to_use ? `<p class="tool-op-hint">${escPentest(op.when_to_use)}</p>` : ""}
                <p class="muted tool-op-path">${escPentest(op.script_path || "")}</p>
                <div class="tool-op-params-wrap">
                    <table class="tool-op-params">
                        <thead><tr>
                            <th>Parametre</th><th>Etiket</th><th>Tip</th><th>Zorunlu</th><th>Varsayılan</th><th>Seçenekler</th><th>Açıklama</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    }).join("");
}

// Drill-in: hide the tool list and show the selected tool's operations, with a
// back button to return to the list.
function showToolList() {
    const listWrap = document.getElementById("pentestListWrap");
    const opsView = document.getElementById("pentestOpsView");
    if (opsView) {
        opsView.hidden = true;
        opsView.innerHTML = "";
    }
    if (listWrap) {
        listWrap.hidden = false;
    }
}

async function showToolOperations(toolKey, toolLabel) {
    const listWrap = document.getElementById("pentestListWrap");
    const opsView = document.getElementById("pentestOpsView");
    if (!opsView) {
        return;
    }
    if (listWrap) {
        listWrap.hidden = true;
    }
    opsView.hidden = false;
    const title = escPentest(toolLabel || toolKey);
    opsView.innerHTML = `
        <div class="tool-op-header">
            <button type="button" class="btn ghost" id="pentestOpsBackBtn">← Araç listesine dön</button>
            <h3 class="tool-op-title">${title} — Operasyon Özellikleri</h3>
        </div>
        <p class="muted tool-op-loading">Operasyonlar yükleniyor…</p>`;
    const backBtn = document.getElementById("pentestOpsBackBtn");
    if (backBtn) {
        backBtn.addEventListener("click", showToolList);
    }
    try {
        const [data, cfg] = await Promise.all([
            apiRequest(`/settings/pentest-tools/${encodeURIComponent(toolKey)}/operations`),
            apiRequest(`/settings/pentest-tools/${encodeURIComponent(toolKey)}/config`).catch(() => null),
            window.SSVPWl ? window.SSVPWl.load() : Promise.resolve(),
        ]);
        const body = opsView.querySelector(".tool-op-loading");
        const cards = renderToolOperationsCards(data);
        const configHtml = cfg ? renderToolConfig(cfg) : "";
        if (body) {
            body.outerHTML = `${configHtml}<div class="tool-op-list">${cards}</div>`;
        }
        if (cfg) {
            bindToolConfig(toolKey);
        }
    } catch (error) {
        const body = opsView.querySelector(".tool-op-loading");
        if (body) {
            body.className = "tool-op-error";
            body.textContent = `Operasyonlar yüklenemedi: ${error.message || "hata"}`;
        }
    }
}

// Wordlist params render as a searchable combobox fed from the DB wordlist
// catalog (Sözlük Yönetimi) via the shared window.SSVPWl helper (notify.js), so
// the same widget/behaviour is used here, in Pentest and in Operation Test.
const TC_WORDLIST_KEYS = (window.SSVPWl && window.SSVPWl.WORDLIST_KEYS)
    || new Set(["wordlist", "wordlists", "userlist", "passlist", "combo_file"]);

// Per-tool config editor (parameter defaults + API keys) shown above the
// read-only operation cards in the "Operasyon Özellikleri" drill-in.
function renderToolConfig(cfg) {
    // 3-per-row grid; each item stacks the parameter name over its input.
    const GRID = 'style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; align-items:end;"';
    const ITEM = 'style="display:flex; flex-direction:column; gap:4px; min-width:0;"';
    const params = Array.isArray(cfg?.params) ? cfg.params : [];
    const paramItems = params.map((p) => {
        const key = escPentest(p.key);
        const label = escPentest(p.label || p.key);
        let field;
        if (TC_WORDLIST_KEYS.has(String(p.key).toLowerCase()) && window.SSVPWl) {
            field = window.SSVPWl.comboHtml(`data-tc-param="${key}"`, p.default || "");
        } else if (Array.isArray(p.choices) && p.choices.length) {
            const opts = p.choices.map((c) =>
                `<option value="${escPentest(c)}"${String(c) === String(p.default) ? " selected" : ""}>${escPentest(c)}</option>`).join("");
            field = `<select data-tc-param="${key}">${opts}</select>`;
        } else if (p.type === "boolean") {
            const on = ["on", "true", "1", "yes"].includes(String(p.default || "").toLowerCase());
            field = `<select data-tc-param="${key}"><option value="on"${on ? " selected" : ""}>on</option><option value="off"${!on ? " selected" : ""}>off</option></select>`;
        } else {
            field = `<input type="text" data-tc-param="${key}" value="${escPentest(p.default || "")}">`;
        }
        return `<div class="tc-item" ${ITEM}><label class="tc-label">${label} <span class="muted">(${key})</span></label>${field}</div>`;
    }).join("");

    let apiHtml = "";
    const fields = Array.isArray(cfg?.api_key_fields) ? cfg.api_key_fields : [];
    if (cfg?.has_api_file && fields.length) {
        const items = fields.map((f) => (f.fields || []).map((fld) => {
            const isSet = f.set && f.set[fld];
            return `<div class="tc-item" ${ITEM}><label class="tc-label">${escPentest(f.source)} <span class="muted">${escPentest(fld)}</span></label>
                <input type="password" autocomplete="off" data-tc-api-source="${escPentest(f.source)}" data-tc-api-field="${escPentest(fld)}" placeholder="${isSet ? "•••• (kayıtlı)" : ""}"></div>`;
        }).join("")).join("");
        apiHtml = `<details class="tc-api" style="margin-top:12px;"><summary>API Anahtarları — api-keys.yaml (${fields.length} kaynak)</summary>
            <p class="muted">Boş bırakılan alanlar mevcut anahtarı korur.</p>
            <div ${GRID}>${items}</div></details>`;
    }

    return `
        <div class="card tool-config" style="margin-bottom:14px;">
            <h4 style="margin-top:0;">Varsayılan Parametreler</h4>
            <p class="muted">Bu araç için operasyon formlarında öntanımlı gelecek değerler.</p>
            <div ${GRID}>${paramItems || '<span class="muted">Parametre bulunamadı.</span>'}</div>
            ${apiHtml}
            <div style="margin-top:12px;"><button type="button" class="btn" id="tcSaveBtn">Yapılandırmayı Kaydet</button></div>
            <p id="tcFeedback" class="muted" style="margin-top:6px;"></p>
        </div>`;
}

function bindToolConfig(toolKey) {
    const btn = document.getElementById("tcSaveBtn");
    if (!btn) {
        return;
    }
    btn.addEventListener("click", async () => {
        const param_defaults = {};
        document.querySelectorAll("[data-tc-param]").forEach((el) => {
            param_defaults[el.getAttribute("data-tc-param")] = el.value;
        });
        const api_keys = {};
        document.querySelectorAll("[data-tc-api-source]").forEach((el) => {
            if (el.value === "") {
                return; // empty = keep the stored key
            }
            const s = el.getAttribute("data-tc-api-source");
            const f = el.getAttribute("data-tc-api-field");
            (api_keys[s] = api_keys[s] || {})[f] = el.value;
        });
        const fb = document.getElementById("tcFeedback");
        btn.disabled = true;
        try {
            const res = await apiRequest(`/settings/pentest-tools/${encodeURIComponent(toolKey)}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ param_defaults, api_keys }),
            });
            if (fb) {
                fb.textContent = `Kaydedildi (${res.applied_params || 0} parametre uygulandı${res.wrote_file ? ", api-keys.yaml güncellendi" : ""}).`;
            }
            document.querySelectorAll("[data-tc-api-source]").forEach((el) => { el.value = ""; });
        } catch (e) {
            if (fb) {
                fb.textContent = "Kaydedilemedi: " + (e.message || "hata");
            }
        } finally {
            btn.disabled = false;
        }
    });
}

const PENTEST_ACTION_LABELS = { install: "Kurulum", update: "Güncelleme", remove: "Kaldırma", check: "Güncelleme kontrolü" };

async function runPentestToolAction(toolKey, action) {
    const label = PENTEST_ACTION_LABELS[action] || action;
    pentestLog(`${label} başladı: ${toolKey}… (uzun sürebilir, lütfen bekleyin)`, "run");
    try {
        const res = await apiRequest("/settings/pentest-tools/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tool: toolKey, action }),
        });
        pentestLog(`${label} (${toolKey}): ${res?.message || (res?.ok ? "tamam" : "başarısız")}`, res && res.ok ? "ok" : "error");
        if (res?.output) {
            String(res.output).split("\n").slice(-40).forEach((ln) => {
                if (ln.trim()) {
                    pentestLog("  " + ln);
                }
            });
        }
        await loadPentestTools();
    } catch (error) {
        pentestLog(`${label} (${toolKey}) hata: ${error.message || "işlem başarısız"}`, "error");
    }
}

const pentestToolsTbody = document.getElementById("pentestToolsTbody");
if (pentestToolsTbody) {
    // Selecting an option in a tool's action dropdown runs it directly.
    pentestToolsTbody.addEventListener("change", async (event) => {
        const select = event.target.closest("select.pentest-action-select");
        if (!select) {
            return;
        }
        const key = select.dataset.tool;
        const action = select.value;
        if (!action) {
            return;
        }
        // "Operasyon Özellikleri" is a drill-in view, not a tool action.
        if (action === "operations") {
            select.value = "";
            await showToolOperations(key, select.dataset.toolLabel);
            return;
        }
        select.disabled = true;
        // runPentestToolAction reloads the table afterwards, which resets the select.
        await runPentestToolAction(key, action);
    });
}

const pentestToolsRefreshBtn = document.getElementById("pentestToolsRefreshBtn");
if (pentestToolsRefreshBtn) {
    pentestToolsRefreshBtn.addEventListener("click", () => loadPentestTools(true));
}

const pentestToolsClearLogBtn = document.getElementById("pentestToolsClearLogBtn");
if (pentestToolsClearLogBtn) {
    pentestToolsClearLogBtn.addEventListener("click", () => {
        const box = document.getElementById("pentestToolsLog");
        if (box) {
            box.innerHTML = "";
        }
    });
}


// ---------------------------------------------------------------------------
// Wordlist (sözlük) management — list DB entries, scan the host, upload .txt.
// ---------------------------------------------------------------------------
function renderWordlistTable(items) {
    const tbody = document.getElementById("wordlistTbody");
    if (!tbody) {
        return;
    }
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">${escPentest(t("settings.wordlist.none") || "Kayıtlı sözlük yok. 'Tara' veya 'Yeni Ekle' ile ekleyin.")}</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map((item) => {
        const name = escPentest(item.name || "-");
        const path = escPentest(item.path || "-");
        const size = escPentest(item.size_h || "-");
        const source = item.source === "upload"
            ? (t("settings.wordlist.sourceUpload") || "Yüklendi")
            : (t("settings.wordlist.sourceScan") || "Tarama");
        const del = t("settings.wordlist.delete") || "Sil";
        return `<tr>
            <td>${name}</td>
            <td><code style="font-size:12px; word-break:break-all;">${path}</code></td>
            <td>${size}</td>
            <td>${escPentest(source)}</td>
            <td><button type="button" class="wordlist-delete-btn" data-id="${escPentest(item.id)}">${escPentest(del)}</button></td>
        </tr>`;
    }).join("");
}

async function loadWordlists() {
    const tbody = document.getElementById("wordlistTbody");
    if (!tbody) {
        return;
    }
    if (!tbody.children.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="muted">…</td></tr>`;
    }
    try {
        const data = await apiRequest("/settings/wordlists", { cache: "no-store" });
        renderWordlistTable(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
        setFeedback(error.message || (t("settings.wordlist.loadFail") || "Sözlük listesi alınamadı."), true);
    }
}

const wordlistScanBtn = document.getElementById("wordlistScanBtn");
if (wordlistScanBtn) {
    wordlistScanBtn.addEventListener("click", async () => {
        wordlistScanBtn.disabled = true;
        try {
            const data = await apiRequest("/settings/wordlists/scan", { method: "POST" });
            renderWordlistTable(Array.isArray(data.items) ? data.items : []);
            const s = data.summary || {};
            setFeedback(`${t("settings.wordlist.scanDone")} (+${s.added || 0} / ${s.total || 0})${s.truncated ? " …" : ""}`);
        } catch (error) {
            setFeedback(error.message || (t("settings.wordlist.scanFail") || "Tarama başarısız."), true);
        } finally {
            wordlistScanBtn.disabled = false;
        }
    });
}

const wordlistRefreshBtn = document.getElementById("wordlistRefreshBtn");
if (wordlistRefreshBtn) {
    wordlistRefreshBtn.addEventListener("click", () => loadWordlists());
}

// Downloadable collections (rockyou / SecLists): a button per collection —
// "İndir" when absent, "Güncelle" (diff refresh) when already installed. Starts
// the background job, polls status, and reports completion with a transient
// toast (no persistent "done" line).
let wordlistInstallTimer = null;
const wordlistInstallToasted = new Set();

function renderWordlistInstall(data) {
    const btns = document.getElementById("wordlistInstallBtns");
    const statusEl = document.getElementById("wordlistInstallStatus");
    if (!btns || !statusEl) {
        return;
    }
    const available = Array.isArray(data?.available) ? data.available : [];
    const jobs = data?.jobs || {};

    btns.innerHTML = available.map((c) => {
        const job = jobs[c.name];
        const running = job && job.status === "running";
        const label = c.installed
            ? (t("settings.wordlist.install.update") || "Güncelle")
            : (t("settings.wordlist.install.download") || "İndir");
        const note = c.note ? ` <small class="muted">(${escPentest(c.note)})</small>` : "";
        return `<button type="button" class="wordlist-install-btn" data-name="${escPentest(c.name)}"${running ? " disabled" : ""}>${escPentest(label)} ${escPentest(c.label)}</button>${note}`;
    }).join("");

    // Only running jobs get a persistent line; finished jobs are announced once
    // via a toast and then leave no lingering status text.
    const lines = available.map((c) => {
        const job = jobs[c.name];
        if (!job || job.status !== "running") return "";
        const word = t("settings.wordlist.install.running") || "indiriliyor…";
        return `<div style="color:var(--muted); margin-top:4px;">${escPentest(c.label)}: ${escPentest(word)}</div>`;
    }).filter(Boolean).join("");
    statusEl.innerHTML = lines;

    // Announce freshly-finished jobs once.
    available.forEach((c) => {
        const job = jobs[c.name];
        if (!job || job.status === "running") return;
        const stamp = `${c.name}:${job.finished_at || ""}`;
        if (wordlistInstallToasted.has(stamp)) return;
        wordlistInstallToasted.add(stamp);
        if (job.ok) {
            window.SSVPNotify?.success?.(`${c.label}: ${t("settings.wordlist.install.done") || "indirildi ve kataloğa eklendi"}`);
        } else {
            const tail = job.message ? ` — ${job.message.split("\n").pop()}` : "";
            window.SSVPNotify?.error?.(`${c.label}: ${(t("settings.wordlist.install.error") || "indirme başarısız")}${tail}`);
        }
    });

    const anyRunning = available.some((c) => jobs[c.name] && jobs[c.name].status === "running");
    if (anyRunning) {
        if (!wordlistInstallTimer) {
            wordlistInstallTimer = setInterval(refreshWordlistInstall, 4000);
        }
    } else if (wordlistInstallTimer) {
        clearInterval(wordlistInstallTimer);
        wordlistInstallTimer = null;
        // A finished download may have added rows — refresh the table once.
        loadWordlists();
    }
}

async function refreshWordlistInstall() {
    if (!document.getElementById("wordlistInstallBtns")) {
        return;
    }
    try {
        const data = await apiRequest("/settings/wordlists/install", { cache: "no-store" });
        renderWordlistInstall(data);
    } catch (_) {
        // Non-fatal: leave whatever is on screen.
    }
}

document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.(".wordlist-install-btn");
    if (!btn) {
        return;
    }
    const name = btn.getAttribute("data-name");
    btn.disabled = true;
    try {
        await apiRequest(`/settings/wordlists/install/${encodeURIComponent(name)}`, { method: "POST" });
        refreshWordlistInstall();
    } catch (error) {
        btn.disabled = false;
        setFeedback(error.message || (t("settings.wordlist.install.startFail") || "İndirme başlatılamadı."), true);
    }
});

const wordlistUploadForm = document.getElementById("wordlistUploadForm");
const wordlistFileInput = document.getElementById("wordlistFile");
const wordlistUploadBtn = document.getElementById("wordlistUploadBtn");

// The upload button stays disabled until a file is chosen.
function syncWordlistUploadBtn() {
    if (wordlistUploadBtn) {
        wordlistUploadBtn.disabled = !(wordlistFileInput && wordlistFileInput.files && wordlistFileInput.files.length);
    }
}
if (wordlistFileInput) {
    wordlistFileInput.addEventListener("change", syncWordlistUploadBtn);
    syncWordlistUploadBtn();
}

if (wordlistUploadForm) {
    wordlistUploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const file = wordlistFileInput?.files?.[0];
        if (!file) {
            setFeedback(t("settings.wordlist.pickFile") || "Önce bir .txt dosyası seçin.", true);
            return;
        }
        const formData = new FormData();
        formData.append("file", file);
        if (wordlistUploadBtn) wordlistUploadBtn.disabled = true;
        try {
            const data = await apiRequest("/settings/wordlists/upload", { method: "POST", body: formData });
            renderWordlistTable(Array.isArray(data.items) ? data.items : []);
            const added = data.added || {};
            setFeedback((t("settings.wordlist.added") || "Sözlük eklendi") + `: ${added.name || file.name}`);
            wordlistUploadForm.reset();
        } catch (error) {
            setFeedback(error.message || (t("settings.wordlist.uploadFail") || "Sözlük yüklenemedi."), true);
        } finally {
            // After reset the input is empty → stays disabled; on error the file
            // is still selected → re-enabled.
            syncWordlistUploadBtn();
        }
    });
}

const wordlistTbody = document.getElementById("wordlistTbody");
if (wordlistTbody) {
    wordlistTbody.addEventListener("click", async (event) => {
        const btn = event.target.closest(".wordlist-delete-btn");
        if (!btn) {
            return;
        }
        const id = btn.dataset.id;
        if (!id) {
            return;
        }
        btn.disabled = true;
        try {
            const data = await apiRequest(`/settings/wordlists/${encodeURIComponent(id)}`, { method: "DELETE" });
            renderWordlistTable(Array.isArray(data.items) ? data.items : []);
            setFeedback(t("settings.wordlist.deleted") || "Sözlük silindi.");
        } catch (error) {
            btn.disabled = false;
            setFeedback(error.message || (t("settings.wordlist.deleteFail") || "Sözlük silinemedi."), true);
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


const workflowSettingsForm = document.getElementById("workflowSettingsForm");
if (workflowSettingsForm) {
    workflowSettingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!hasTab("ai")) {
            return;
        }

        const workflowModeSelect = document.getElementById("workflowMode");
        const mode = workflowModeSelect?.value === "ai" ? "ai" : "manual";
        try {
            const result = await apiRequest("/settings/workflow", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
            if (settingsConfig) {
                settingsConfig.workflow = result.workflow;
            }
            setFeedback(t("settings.workflow.saved", "Ilerleme modu kaydedildi."));
        } catch (error) {
            setFeedback(error.message || t("settings.workflow.saveError", "Ilerleme modu kaydedilemedi."), true);
        }
    });
}


if (appearanceForm) {
    appearanceForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const nextTheme = appearanceTheme?.value === "light" ? "light" : "dark";
        const nextLang = appearanceLanguage?.value === "en" ? "en" : "tr";
        const nextPageSize = parseInt(appearanceTablePageSize?.value, 10);
        const pageSize = [0, 10, 25, 50, 100].includes(nextPageSize) ? nextPageSize : 10;

        try {
            const payload = await apiRequest("/settings/appearance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ui_theme: nextTheme,
                    ui_language: nextLang,
                    table_page_size: pageSize,
                }),
            });

            currentUser = payload.item || currentUser;
            const savedSize = Number.isFinite(payload.table_page_size) ? payload.table_page_size : pageSize;
            window.__ssvpTablePageSize = savedSize;
            if (window.SSVPTable) window.SSVPTable.setDefaultPageSize(savedSize);
            applyThemeAndLanguage(currentUser?.ui_theme, currentUser?.ui_language);
            setFeedback(t("settings.appearance.saved"));
        } catch (error) {
            setFeedback(error.message || t("settings.error.operationFailed"), true);
        }
    });
}


if (refreshToolsBtn) {
    refreshToolsBtn.addEventListener("click", async () => {
        try {
            await loadTools();
            setFeedback("Gorev listesi guncellendi.");
        } catch (error) {
            setFeedback(error.message || "Gorev listesi alinamadi.", true);
        }
    });
}


toolSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const key = button.dataset.sortKey;
        if (!key) {
            return;
        }
        if (toolSortState.key === key) {
            toolSortState.direction = toolSortState.direction === "asc" ? "desc" : "asc";
        } else {
            toolSortState = { key, direction: "asc" };
        }
        updateToolSortIndicators();
        renderToolsTable();
    });
});


[filterToolId, filterToolAction, filterToolName, filterToolStep, filterToolCategory, filterToolTimeout].forEach((input) => {
    if (!input) {
        return;
    }
    input.addEventListener("input", () => renderToolsTable());
});


[filterToolWorkflow, filterToolRisk, filterToolApproval, filterToolActive].forEach((input) => {
    if (!input) {
        return;
    }
    input.addEventListener("change", () => renderToolsTable());
});


if (showCreateToolBtn) {
    showCreateToolBtn.addEventListener("click", async () => {
        try {
            await loadProgressCategories();
            await loadSteps();
        } catch (_) {
            // Keep create view usable even if category request fails.
        }
        setToolsView("create");
    });
}


if (cancelCreateToolBtn) {
    cancelCreateToolBtn.addEventListener("click", () => {
        setToolsView("list");
    });
}


if (closeEditToolBtn) {
    closeEditToolBtn.addEventListener("click", () => {
        selectedContextStepId = 0;
        selectedContextStepKey = "";
        selectedStepToolId = 0;
        setToolsView("list");
    });
}


if (toolStepId) {
    toolStepId.addEventListener("change", () => {
        syncTaskCreateStepSelection();
    });
}


if (editToolStepId) {
    editToolStepId.addEventListener("change", () => {
        syncTaskEditStepSelection();
    });
}


if (stepWorkflow) {
    stepWorkflow.addEventListener("change", () => {
        renderCategorySelect(stepCategory, stepWorkflow.value, "");
    });
}


if (showCreateStepItemTaskBtn) {
    showCreateStepItemTaskBtn.addEventListener("click", () => openTaskStepItemEditor(null));
}


if (showCreateStepItemScriptBtn) {
    showCreateStepItemScriptBtn.addEventListener("click", () => openScriptStepItemEditor(null));
}


if (backToStepItemsListBtn) {
    backToStepItemsListBtn.addEventListener("click", () => {
        setStepItemTaskEditorVisible(false);
        setStepItemScriptEditorVisible(false);
        setStepItemParamEditorVisible(false);
        setStepItemScriptCodeEditorVisible(false);
        setStepItemListVisible(true);
        if (stepItemParamsCard) stepItemParamsCard.style.display = "none";
    });
}


if (cancelTaskStepItemEditorBtn) {
    cancelTaskStepItemEditorBtn.addEventListener("click", () => {
        setStepItemTaskEditorVisible(false);
        setStepItemScriptCodeEditorVisible(false);
        setStepItemListVisible(true);
    });
}


if (cancelScriptStepItemEditorBtn) {
    cancelScriptStepItemEditorBtn.addEventListener("click", () => {
        setStepItemScriptEditorVisible(false);
        setStepItemScriptCodeEditorVisible(false);
        setStepItemListVisible(true);
    });
}


if (saveStepItemScriptContentBtn) {
    saveStepItemScriptContentBtn.addEventListener("click", async () => {
        const scriptItemId = Number(selectedStepItemId || 0);
        if (!scriptItemId) {
            setFeedback("Script secimi bulunamadi.", true);
            return;
        }

        const source = stepItemScriptCodeEditor ? stepItemScriptCodeEditor.getValue() : "";
        try {
            await apiRequest(`/settings/steps/items/${scriptItemId}/script-content`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ script_source: source }),
            });
            await loadStepItems(Number(stepId?.value || "0"));
            setFeedback("Script kaydedildi.");
        } catch (error) {
            setFeedback(error.message || "Script kaydedilemedi.", true);
        }
    });
}


if (saveTaskStepItemBtn) {
    saveTaskStepItemBtn.addEventListener("click", async () => {
        const currentStepId = Number(stepId?.value || "0");
        if (!currentStepId) {
            setFeedback("Once adimi kaydetmelisin.", true);
            return;
        }

        const payload = {
            item_type: "task",
            display_name: taskStepItemDisplayName?.value?.trim(),
            description: taskStepItemDescription?.value || "",
            is_active: Boolean(taskStepItemActive?.checked),
        };

        payload.item_key = generateStepItemKey(payload.display_name, "task");

        if (!payload.display_name) {
            setFeedback("Isim zorunludur.", true);
            return;
        }

        const editingItemId = Number(taskStepItemId?.value || "0");
        try {
            if (editingItemId > 0) {
                await apiRequest(`/settings/steps/items/${editingItemId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                await apiRequest(`/settings/steps/${currentStepId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            await loadStepItems(currentStepId);
            setStepItemTaskEditorVisible(false);
            setStepItemListVisible(true);
            setFeedback(editingItemId > 0 ? "Gorev/script guncellendi." : "Gorev/script eklendi.");
        } catch (error) {
            setFeedback(error.message || "Gorev/script kaydedilemedi.", true);
        }
    });
}


if (saveScriptStepItemBtn) {
    saveScriptStepItemBtn.addEventListener("click", async () => {
        const currentStepId = Number(stepId?.value || "0");
        if (!currentStepId) {
            setFeedback("Once adimi kaydetmelisin.", true);
            return;
        }

        const payload = {
            item_type: "script",
            display_name: scriptStepItemDisplayName?.value?.trim(),
            description: scriptStepItemDescription?.value || "",
            is_active: Boolean(scriptStepItemActive?.checked),
        };

        payload.item_key = generateStepItemKey(payload.display_name, "script");

        if (!payload.display_name) {
            setFeedback("Isim zorunludur.", true);
            return;
        }

        const editingItemId = Number(scriptStepItemId?.value || "0");
        try {
            let response;
            if (editingItemId > 0) {
                response = await apiRequest(`/settings/steps/items/${editingItemId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            } else {
                response = await apiRequest(`/settings/steps/${currentStepId}/items`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }

            const item = response?.item || null;
            if (item && stepItemScriptFile?.files?.[0]) {
                const formData = new FormData();
                formData.append("file", stepItemScriptFile.files[0]);
                await apiRequest(`/settings/steps/items/${item.id}/script-upload`, {
                    method: "POST",
                    body: formData,
                });
            }

            await loadStepItems(currentStepId);
            setStepItemScriptEditorVisible(false);
            setStepItemListVisible(true);
            setFeedback(editingItemId > 0 ? "Gorev/script guncellendi." : "Gorev/script eklendi.");
        } catch (error) {
            setFeedback(error.message || "Gorev/script kaydedilemedi.", true);
        }
    });
}


if (stepItemsTbody) {
    stepItemsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const itemId = Number(button.dataset.itemId || "0");
        const target = stepItems.find((item) => Number(item.id) === itemId);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "pick-step-item") {
            await pickStepItem(itemId);
            return;
        }

        if (action === "edit-step-item") {
            if ((target.item_type || "task") === "script") {
                openScriptStepItemEditor(target);
            } else {
                openTaskStepItemEditor(target);
            }
            return;
        }

        if (action === "delete-step-item") {
            if (!window.confirm("Kayit silinsin mi?")) {
                return;
            }
            try {
                await apiRequest(`/settings/steps/items/${itemId}`, { method: "DELETE" });
                await loadStepItems(Number(stepId?.value || "0"));
                if (Number(selectedStepItemId) === itemId) {
                    selectedStepItemId = 0;
                    stepItemParameters = [];
                    renderStepItemParametersTable();
                }
                setFeedback("Gorev/script silindi.");
            } catch (error) {
                setFeedback(error.message || "Gorev/script silinemedi.", true);
            }
        }
    });
}


if (showCreateStepItemParamBtn) {
    showCreateStepItemParamBtn.addEventListener("click", () => {
        openStepItemParameterEditor(null);
    });
}


if (cancelStepItemParamEditorBtn) {
    cancelStepItemParamEditorBtn.addEventListener("click", () => {
        setStepItemParamEditorVisible(false);
    });
}


if (saveStepItemParamBtn) {
    saveStepItemParamBtn.addEventListener("click", async () => {
        if (!selectedStepItemId) {
            setFeedback("Once gorev secmelisin.", true);
            return;
        }

        let optionsJson = [];
        if (stepItemParamOptions && String(stepItemParamOptions.value || "").trim()) {
            try {
                const parsed = JSON.parse(stepItemParamOptions.value);
                optionsJson = (Array.isArray(parsed) || (parsed && typeof parsed === "object")) ? parsed : [];
            } catch (_) {
                setFeedback("Options JSON gecerli olmali.", true);
                return;
            }
        }

        const payload = {
            param_key: stepItemParamKey?.value?.trim(),
            label: stepItemParamLabel?.value?.trim(),
            param_type: (stepItemParamType?.value || "string").trim().toLowerCase(),
            default_value: stepItemParamDefault?.value || "",
            description: stepItemParamDescription?.value?.trim() || "",
            options_json: optionsJson,
            is_required: Boolean(stepItemParamRequired?.checked),
            sort_order: Number(stepItemParamSortOrder?.value || "100"),
        };

        if (!payload.param_key || !payload.label) {
            setFeedback("Parametre key ve label zorunludur.", true);
            return;
        }

        const editingParamId = Number(stepItemParamId?.value || "0");
        try {
            if (editingParamId > 0) {
                await apiRequest(`/settings/steps/parameters/${editingParamId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        label: payload.label,
                        param_type: payload.param_type,
                        default_value: payload.default_value,
                        description: payload.description,
                        options_json: payload.options_json,
                        is_required: payload.is_required,
                        sort_order: payload.sort_order,
                    }),
                });
            } else {
                await apiRequest(`/settings/steps/items/${selectedStepItemId}/parameters`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
            }
            await loadStepItemParameters(selectedStepItemId);
            setStepItemParamEditorVisible(false);
            setFeedback(editingParamId > 0 ? "Parametre guncellendi." : "Parametre eklendi.");
        } catch (error) {
            setFeedback(error.message || "Parametre kaydedilemedi.", true);
        }
    });
}


if (detectStepItemParamsBtn) {
    detectStepItemParamsBtn.addEventListener("click", async () => {
        if (!selectedStepItemId) {
            setFeedback("Once script secmelisin.", true);
            return;
        }

        const selectedItem = stepItems.find((row) => Number(row.id) === Number(selectedStepItemId));
        if (!selectedItem || selectedItem.item_type !== "script") {
            setFeedback("Parametre algilama sadece script icin calisir.", true);
            return;
        }

        try {
            const data = await apiRequest(`/settings/steps/items/${selectedStepItemId}/parameters/detect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            detectedStepItemParameters = Array.isArray(data.items) ? data.items : [];
            if (!detectedStepItemParameters.length) {
                setFeedback("Scriptte parametre bulunamadi.", true);
                if (saveDetectedStepItemParamsBtn) {
                    saveDetectedStepItemParamsBtn.disabled = true;
                }
                return;
            }

            stepItemParameters = detectedStepItemParameters.map((item, idx) => ({
                id: `detected-${idx + 1}`,
                param_key: item.key,
                label: item.label,
                param_type: item.type,
                default_value: typeof item.default === "object" ? JSON.stringify(item.default) : (item.default ?? ""),
                description: item.description || "",
                options_json: item.options_json || [],
                is_required: Boolean(item.required),
                sort_order: Number(item.sort_order || (idx * 10)),
            }));
            renderStepItemParametersTable();

            if (saveDetectedStepItemParamsBtn) {
                saveDetectedStepItemParamsBtn.disabled = false;
            }

            const source = String(data.source || "none").toLowerCase();
            const sourceLabel = source === "metadata" ? "metadata" : (source === "inference" ? "inference" : "none");
            setFeedback(`Parametreler scriptten algilandi. Kaynak: ${sourceLabel}.`);
        } catch (error) {
            setFeedback(error.message || "Parametre algilama basarisiz.", true);
        }
    });
}


if (saveDetectedStepItemParamsBtn) {
    saveDetectedStepItemParamsBtn.addEventListener("click", async () => {
        if (!selectedStepItemId || !detectedStepItemParameters.length) {
            setFeedback("Kaydedilecek algilanan parametre yok.", true);
            return;
        }

        try {
            await apiRequest(`/settings/steps/items/${selectedStepItemId}/parameters/save-detected`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: detectedStepItemParameters }),
            });
            await loadStepItemParameters(selectedStepItemId);
            if (saveDetectedStepItemParamsBtn) {
                saveDetectedStepItemParamsBtn.disabled = true;
            }
            setFeedback("Algilanan parametreler MySQL'e kaydedildi.");
        } catch (error) {
            setFeedback(error.message || "Algilanan parametreler kaydedilemedi.", true);
        }
    });
}


if (stepItemParamsTbody) {
    stepItemParamsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const paramIdValue = Number(button.dataset.paramId || "0");
        const target = stepItemParameters.find((item) => Number(item.id) === paramIdValue);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "edit-step-item-param") {
            openStepItemParameterEditor(target);
            return;
        }

        if (action === "delete-step-item-param") {
            if (!window.confirm("Parametre silinsin mi?")) {
                return;
            }
            try {
                await apiRequest(`/settings/steps/parameters/${paramIdValue}`, { method: "DELETE" });
                await loadStepItemParameters(selectedStepItemId);
                setFeedback("Parametre silindi.");
            } catch (error) {
                setFeedback(error.message || "Parametre silinemedi.", true);
            }
        }
    });
}


if (showParameterEditorBtn) {
    showParameterEditorBtn.addEventListener("click", () => {
        openParameterEditor(null);
    });
}


if (cancelParameterEditorBtn) {
    cancelParameterEditorBtn.addEventListener("click", () => {
        setParameterEditorVisible(false);
    });
}


if (showScriptEditorBtn) {
    showScriptEditorBtn.addEventListener("click", () => {
        if (toolScriptForm) {
            toolScriptForm.reset();
            if (scriptToolId) scriptToolId.value = String(selectedToolId || scriptToolId.value || "");
            if (scriptId) scriptId.value = "";
            if (scriptSortOrder) scriptSortOrder.value = "100";
        }
        setScriptEditorMode("upload");
        setScriptEditorVisible(true);
    });
}


if (cancelScriptEditorBtn) {
    cancelScriptEditorBtn.addEventListener("click", () => {
        setScriptEditorVisible(false);
    });
}


function openProgressCategoryEditor(item = null) {
    if (!progressCategoryForm) {
        return;
    }
    if (progressCategoriesListArea) {
        progressCategoriesListArea.style.display = "none";
    }
    progressCategoryForm.style.display = "flex";
    if (item) {
        progressCategoryId.value = String(item.id);
        progressCategoryKey.value = item.category_key || "";
        progressCategoryKey.readOnly = true;
        progressCategoryDisplayName.value = item.display_name || "";
        progressCategoryWorkflow.value = item.workflow_key || "scan";
        progressCategoryDescription.value = item.description || "";
        progressCategoryActive.checked = Boolean(item.is_active);
    } else {
        progressCategoryForm.reset();
        progressCategoryId.value = "";
        progressCategoryKey.readOnly = false;
        progressCategoryWorkflow.value = "scan";
        progressCategoryActive.checked = true;
    }
    refreshPathNavigation();
}


function closeProgressCategoryEditor() {
    if (!progressCategoryForm) {
        return;
    }
    progressCategoryForm.style.display = "none";
    if (progressCategoriesListArea) {
        progressCategoriesListArea.style.display = "block";
    }
    progressCategoryForm.reset();
    progressCategoryId.value = "";
    progressCategoryKey.readOnly = false;
    refreshPathNavigation();
}


if (showCreateProgressCategoryBtn) {
    showCreateProgressCategoryBtn.addEventListener("click", () => openProgressCategoryEditor(null));
}


if (cancelProgressCategoryEditorBtn) {
    cancelProgressCategoryEditorBtn.addEventListener("click", () => closeProgressCategoryEditor());
}


if (refreshProgressCategoriesBtn) {
    refreshProgressCategoriesBtn.addEventListener("click", async () => {
        try {
            await loadProgressCategories();
            setFeedback("Ilerleme kategorileri guncellendi.");
        } catch (error) {
            setFeedback(error.message || "Kategoriler alinamadi.", true);
        }
    });
}


if (toolRegistryForm) {
    toolRegistryForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const selectedStep = registrySteps.find((item) => Number(item.id) === Number(toolStepId?.value || "0"));
        if (!selectedStep) {
            setFeedback("Lutfen bir adim secin.", true);
            return;
        }

        try {
            await apiRequest("/settings/tool-registry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    step_id: Number(selectedStep.id),
                    action_key: toolActionKey.value.trim(),
                    display_name: toolDisplayName.value.trim(),
                    tool_name: toolActionKey.value.trim(),
                    test_category: (selectedStep.category_key || "general").trim().toLowerCase(),
                    workflow_key: (selectedStep.workflow_key || "scan").trim().toLowerCase(),
                    step_key: (selectedStep.step_key || "custom_step").trim().toLowerCase(),
                    tool_type: "python_script",
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
            if (toolWorkflowKey) {
                toolWorkflowKey.value = "scan";
            }
            toolRiskLevel.value = "low";
            toolTimeout.value = "300";
            toolRequiresApproval.checked = true;
            toolActive.checked = true;
            await loadTools();
            setFeedback("Gorev eklendi.");
            setToolsView("list");
        } catch (error) {
            setFeedback(error.message || "Gorev eklenemedi.", true);
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
        if (action === "edit-tool") {
            try {
                await openToolEdit(toolId);
                setFeedback("Adim duzenleme acildi.");
            } catch (error) {
                setFeedback(error.message || "Adim duzenleme acilamadi.", true);
            }
            return;
        }
    });
}


if (stepToolsTbody) {
    stepToolsTbody.addEventListener("click", async (event) => {
        const row = event.target.closest("tr[data-action='pick-step-tool']");
        if (!row) {
            return;
        }
        const toolId = Number(row.dataset.toolId || "0");
        if (!toolId) {
            return;
        }

        selectedStepToolId = toolId;
        renderStepToolsTable();
        if (parameterToolId) {
            parameterToolId.value = String(toolId);
        }
        await loadToolParameters(toolId);
        const selectedTool = stepTools.find((item) => Number(item.id) === Number(toolId));
        if (selectedToolHint) {
            selectedToolHint.textContent = `Secili gorev: ${selectedTool?.action_key || toolId}`;
        }
        setParameterEditorVisible(false);
    });
}


if (toolParametersTbody) {
    toolParametersTbody.addEventListener("click", (event) => {
        const row = event.target.closest("tr[data-action='edit-parameter']");
        if (!row) {
            return;
        }
        const parameterIdValue = Number(row.dataset.parameterId || "0");
        if (!parameterIdValue) {
            return;
        }
        const item = registryParameters.find((param) => Number(param.id) === parameterIdValue);
        if (!item) {
            return;
        }
        openParameterEditor(item);
    });
}


if (toolScriptForm) {
    toolScriptForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const toolId = Number(scriptToolId?.value || selectedToolId || "0");
        if (!toolId) {
            setFeedback("Once Tool ID girin.", true);
            return;
        }

        const editingScriptId = Number(scriptId?.value || "0");

        try {
            if (editingScriptId) {
                const code = scriptCodeEditor ? scriptCodeEditor.getValue() : "";
                if (!code.trim()) {
                    setFeedback("Script kodu bos olamaz.", true);
                    return;
                }
                await apiRequest(`/settings/tool-registry/scripts/${editingScriptId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        script_name: (scriptName?.value || "script").trim(),
                        sort_order: Number(scriptSortOrder?.value || 100),
                        script_source: code,
                    }),
                });
                setFeedback("Script guncellendi.");
            } else {
                const file = scriptUpload?.files?.[0] || null;
                if (!file) {
                    setFeedback("Script dosyasi secilmelidir.", true);
                    return;
                }
                const formData = new FormData();
                formData.append("script_name", (scriptName?.value || "script").trim());
                formData.append("is_active", "true");
                formData.append("file", file);
                await apiRequest(`/settings/tool-registry/${toolId}/scripts/upload`, {
                    method: "POST",
                    body: formData,
                });
                setFeedback("Script eklendi.");
            }

            await loadToolScripts(toolId);
            toolScriptForm.reset();
            if (scriptToolId) scriptToolId.value = String(toolId);
            if (scriptId) scriptId.value = "";
            if (scriptSortOrder) scriptSortOrder.value = "100";
            setScriptEditorMode("upload");
            setScriptEditorVisible(false);
        } catch (error) {
            setFeedback(error.message || "Script eklenemedi.", true);
        }
    });
}


if (toolScriptsTbody) {
    toolScriptsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const selectedScriptId = Number(button.dataset.scriptId || "0");
        const target = registryScripts.find((item) => Number(item.id) === selectedScriptId);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "load-script") {
            try {
                const data = await apiRequest(`/settings/tool-registry/scripts/${target.id}/content`, { cache: "no-store" });
                const item = data?.item || {};
                if (scriptToolId) scriptToolId.value = String(target.tool_id);
                if (scriptId) scriptId.value = String(target.id);
                if (scriptName) scriptName.value = target.script_name || "";
                if (scriptSortOrder) scriptSortOrder.value = String(target.sort_order || 100);
                setScriptEditorMode("edit");
                ensureScriptEditor();
                if (scriptCodeEditor) {
                    scriptCodeEditor.setValue(String(item.content || ""), -1);
                }
                setScriptEditorVisible(true);
            } catch (error) {
                setFeedback(error.message || "Script icerigi yuklenemedi.", true);
            }
            return;
        }

        if (action === "toggle-script") {
            try {
                await apiRequest(`/settings/tool-registry/scripts/${selectedScriptId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: !target.is_active }),
                });
                await loadToolScripts(target.tool_id);
                setFeedback("Script durumu guncellendi.");
            } catch (error) {
                setFeedback(error.message || "Script guncellenemedi.", true);
            }
            return;
        }

        if (action === "delete-script") {
            try {
                await apiRequest(`/settings/tool-registry/scripts/${selectedScriptId}`, {
                    method: "DELETE",
                });
                await loadToolScripts(target.tool_id);
                setFeedback("Script silindi.");
            } catch (error) {
                setFeedback(error.message || "Script silinemedi.", true);
            }
        }
    });
}


if (toolEditForm) {
    toolEditForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const toolId = Number(editToolId?.value || selectedToolId || "0");
        if (!toolId) {
            setFeedback("Gorev secimi bulunamadi.", true);
            return;
        }

        const selectedStep = registrySteps.find((item) => Number(item.id) === Number(editToolStepId?.value || "0"));
        if (!selectedStep) {
            setFeedback("Lutfen bir adim secin.", true);
            return;
        }

        try {
            await apiRequest(`/settings/tool-registry/${toolId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    step_id: Number(selectedStep.id),
                    action_key: editToolActionKey?.value?.trim(),
                    display_name: editToolDisplayName?.value?.trim(),
                    test_category: (selectedStep.category_key || "general").trim().toLowerCase(),
                    workflow_key: (selectedStep.workflow_key || "scan").trim().toLowerCase(),
                    step_key: (selectedStep.step_key || "custom_step").trim().toLowerCase(),
                    risk_level: editToolRiskLevel?.value || "low",
                    timeout_sec: Number(editToolTimeout?.value || 300),
                    base_command: editToolBaseCommand?.value || "",
                    requires_approval: Boolean(editToolRequiresApproval?.checked),
                    is_active: Boolean(editToolActive?.checked),
                }),
            });
            await loadTools();
            await openToolEdit(toolId);
            setFeedback("Gorev guncellendi.");
        } catch (error) {
            setFeedback(error.message || "Gorev guncellenemedi.", true);
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

        const editingParameterId = Number(parameterId?.value || "0");

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
            if (editingParameterId) {
                await apiRequest(`/settings/tool-registry/parameters/${editingParameterId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        label: parameterLabel.value.trim(),
                        param_type: parameterType.value,
                        default_value: defaultValue,
                        is_required: Boolean(parameterRequired?.checked),
                        options_json: optionsJson,
                    }),
                });
            } else {
                await apiRequest(`/settings/tool-registry/${toolId}/parameters`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        param_key: parameterKey.value.trim(),
                        label: parameterLabel.value.trim(),
                        param_type: parameterType.value,
                        default_value: defaultValue,
                        is_required: Boolean(parameterRequired?.checked),
                        is_editable: true,
                        options_json: optionsJson,
                        sort_order: 100,
                    }),
                });
            }

            await loadToolParameters(toolId);
            if (toolParameterForm) {
                toolParameterForm.reset();
            }
            if (parameterId) {
                parameterId.value = "";
            }
            if (parameterKey) {
                parameterKey.readOnly = false;
            }
            if (parameterType) {
                parameterType.value = "string";
            }
            if (parameterRequired) {
                parameterRequired.checked = false;
            }
            setFeedback(editingParameterId ? "Tool parametresi guncellendi." : "Tool parametresi eklendi.");
            setParameterEditorVisible(false);
        } catch (error) {
            setFeedback(error.message || "Tool parameter eklenemedi.", true);
        }
    });
}


if (progressCategoryForm) {
    progressCategoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const categoryId = Number(progressCategoryId?.value || "0");
        const payload = {
            category_key: progressCategoryKey?.value?.trim(),
            display_name: progressCategoryDisplayName?.value?.trim(),
            workflow_key: progressCategoryWorkflow?.value || "scan",
            description: progressCategoryDescription?.value || "",
            is_active: Boolean(progressCategoryActive?.checked),
        };

        try {
            if (categoryId > 0) {
                await apiRequest(`/settings/progress-categories/${categoryId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        display_name: payload.display_name,
                        workflow_key: payload.workflow_key,
                        description: payload.description,
                        is_active: payload.is_active,
                    }),
                });
                setFeedback("Kategori guncellendi.");
            } else {
                await apiRequest("/settings/progress-categories", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                setFeedback("Kategori eklendi.");
            }

            await loadProgressCategories();
            closeProgressCategoryEditor();
        } catch (error) {
            setFeedback(error.message || "Kategori kaydedilemedi.", true);
        }
    });
}


if (progressCategoriesTbody) {
    progressCategoriesTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const categoryId = Number(button.dataset.categoryId || "0");
        const target = progressCategories.find((item) => Number(item.id) === categoryId);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "edit-category") {
            openProgressCategoryEditor(target);
            return;
        }

        if (action === "delete-category") {
            const confirmed = window.confirm("Kategori silinsin mi?");
            if (!confirmed) {
                return;
            }
            try {
                await apiRequest(`/settings/progress-categories/${categoryId}`, { method: "DELETE" });
                await loadProgressCategories();
                setFeedback("Kategori silindi.");
            } catch (error) {
                setFeedback(error.message || "Kategori silinemedi.", true);
            }
        }
    });
}


if (showCreateStepBtn) {
    showCreateStepBtn.addEventListener("click", () => openStepEditor(null));
}


if (cancelStepEditorBtn) {
    cancelStepEditorBtn.addEventListener("click", () => closeStepEditor());
}


if (refreshStepsBtn) {
    refreshStepsBtn.addEventListener("click", async () => {
        try {
            await loadProgressCategories();
            await loadSteps();
            setFeedback("Adim listesi guncellendi.");
        } catch (error) {
            setFeedback(error.message || "Adim listesi alinamadi.", true);
        }
    });
}


[filterStepId, filterStepKey, filterStepDisplayName, filterStepCategory].forEach((input) => {
    if (!input) {
        return;
    }
    input.addEventListener("input", () => renderStepsTable());
});


[filterStepWorkflow, filterStepActive].forEach((input) => {
    if (!input) {
        return;
    }
    input.addEventListener("change", () => renderStepsTable());
});


if (stepsTbody) {
    stepsTbody.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const rowStepId = Number(button.dataset.stepId || "0");
        const target = registrySteps.find((item) => Number(item.id) === rowStepId);
        if (!target) {
            return;
        }

        const action = button.dataset.action;
        if (action === "edit-step") {
            openStepEditor(target);
            return;
        }

        if (action === "delete-step") {
            const confirmed = window.confirm("Adim silinsin mi?");
            if (!confirmed) {
                return;
            }
            try {
                await apiRequest(`/settings/steps/${rowStepId}`, { method: "DELETE" });
                await loadSteps();
                setFeedback("Adim silindi.");
            } catch (error) {
                setFeedback(error.message || "Adim silinemedi.", true);
            }
        }
    });
}


if (stepForm) {
    stepForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const rowStepId = Number(stepId?.value || "0");
        const payload = {
            step_key: stepKey?.value?.trim(),
            display_name: stepDisplayName?.value?.trim(),
            workflow_key: stepWorkflow?.value || "scan",
            category_key: stepCategory?.value || "general",
            description: stepDescription?.value || "",
            is_active: Boolean(stepActive?.checked),
        };

        try {
            let savedItem = null;
            if (rowStepId > 0) {
                const response = await apiRequest(`/settings/steps/${rowStepId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        display_name: payload.display_name,
                        description: payload.description,
                        is_active: payload.is_active,
                    }),
                });
                savedItem = response?.item || null;
                setFeedback("Adim guncellendi.");
            } else {
                const response = await apiRequest("/settings/steps", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                savedItem = response?.item || null;
                setFeedback("Adim eklendi.");
            }

            await loadSteps();
            if (savedItem) {
                openStepEditor(savedItem);
            }
        } catch (error) {
            setFeedback(error.message || "Adim kaydedilemedi.", true);
        }
    });
}


(async function bootstrap() {
    try {
        if (IS_PANEL_PAGE) {
            // Panel page: only wire the catalog editors. panel.js owns tabs,
            // theme and access; here we just enable the two catalog tabs and
            // load their data when clicked (panel.js's handler shows the panel).
            ensureScriptEditor();
            accessTabs = ["tools", "progress-categories"];
            tabButtons.forEach((button) => {
                button.addEventListener("click", () => {
                    const tab = button.dataset.tab;
                    if (tab === "tools") {
                        loadProgressCategories();
                        loadSteps();
                    } else if (tab === "progress-categories") {
                        loadProgressCategories();
                    }
                });
            });
            return;
        }
        applyThemeAndLanguage();
        ensureScriptEditor();
        await initializeAccess();
        resetEditForm();
    } catch (error) {
        setFeedback(error.message || t("settings.error.pageLoad"), true);
        if (error && Number(error.status) === 401) {
            window.location.href = "/?login=1";
        }
    }
})();

// --------------------------------------------------------------------------- //
// Veritabanı ve Yedekleme sekmesi
// --------------------------------------------------------------------------- //
function dbHumanSize(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function renderDbBackups(list) {
    const tbody = document.getElementById("dbBackupTbody");
    if (!tbody) return;
    const items = Array.isArray(list) ? list : [];
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="muted">${escPentest(t("settings.database.noBackup") || "Henüz yedek yok.")}</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map((b) => {
        const name = escPentest(b.name || "");
        const date = escPentest((b.created_at || "").replace("T", " ").slice(0, 19));
        const dl = `/settings/database/backup/download?name=${encodeURIComponent(b.name || "")}`;
        return `<tr>
            <td>${name}</td>
            <td>${escPentest(dbHumanSize(b.size))}</td>
            <td>${date}</td>
            <td>
                <a href="${dl}" download>${escPentest(t("settings.database.download") || "İndir")}</a>
                &nbsp;·&nbsp;
                <button type="button" class="db-backup-delete-btn" data-name="${name}">${escPentest(t("settings.database.delete") || "Sil")}</button>
            </td>
        </tr>`;
    }).join("");
}

function renderDbStatus(status) {
    const s = status || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("dbHost", s.host || "—");
    set("dbPort", s.port || "—");
    set("dbUser", s.user || "—");
    set("dbName", s.database || "—");
    const stateEl = document.getElementById("dbState");
    if (stateEl) {
        const okText = t("settings.database.connected") || "Bağlı";
        const failText = t("settings.database.disconnected") || "Bağlantı yok";
        stateEl.textContent = s.connected ? okText : `${failText}${s.error ? " — " + s.error : ""}`;
        stateEl.style.color = s.connected ? "var(--success, #2e7d32)" : "var(--danger, #c62828)";
    }
    set("dbVersion", s.server_version || "—");
}

async function loadDatabaseTab() {
    try {
        const data = await apiRequest("/settings/database", { cache: "no-store" });
        renderDbStatus(data.status || {});
        renderDbBackups(data.backups || []);
    } catch (error) {
        setFeedback(error.message || (t("settings.database.loadFail") || "Veritabanı durumu alınamadı."), true);
    }
}

const dbRefreshBtn = document.getElementById("dbRefreshBtn");
if (dbRefreshBtn) {
    dbRefreshBtn.addEventListener("click", () => loadDatabaseTab());
}

const dbBackupBtn = document.getElementById("dbBackupBtn");
if (dbBackupBtn) {
    dbBackupBtn.addEventListener("click", async () => {
        dbBackupBtn.disabled = true;
        try {
            const data = await apiRequest("/settings/database/backup", { method: "POST" });
            renderDbBackups(data.backups || []);
            setFeedback((t("settings.database.backupDone") || "Yedek oluşturuldu") + `: ${(data.backup || {}).name || ""}`);
        } catch (error) {
            setFeedback(error.message || (t("settings.database.backupFail") || "Yedekleme başarısız."), true);
        } finally {
            dbBackupBtn.disabled = false;
        }
    });
}

const dbBackupTbody = document.getElementById("dbBackupTbody");
if (dbBackupTbody) {
    dbBackupTbody.addEventListener("click", async (event) => {
        const btn = event.target.closest(".db-backup-delete-btn");
        if (!btn) return;
        const name = btn.dataset.name;
        if (!name) return;
        if (!window.confirm((t("settings.database.confirmDelete") || "Bu yedek silinsin mi?") + `\n${name}`)) return;
        btn.disabled = true;
        try {
            const data = await apiRequest("/settings/database/backup/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            renderDbBackups(data.backups || []);
            setFeedback(t("settings.database.deleteDone") || "Yedek silindi.");
        } catch (error) {
            setFeedback(error.message || (t("settings.database.deleteFail") || "Silinemedi."), true);
            btn.disabled = false;
        }
    });
}

const dbPasswordForm = document.getElementById("dbPasswordForm");
if (dbPasswordForm) {
    dbPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const pw1 = document.getElementById("dbNewPassword");
        const pw2 = document.getElementById("dbNewPassword2");
        const v1 = (pw1?.value || "");
        const v2 = (pw2?.value || "");
        if (v1.length < 8) {
            setFeedback(t("settings.database.pwTooShort") || "Parola en az 8 karakter olmalı.", true);
            return;
        }
        if (v1 !== v2) {
            setFeedback(t("settings.database.pwMismatch") || "Parolalar eşleşmiyor.", true);
            return;
        }
        const btn = document.getElementById("dbPasswordBtn");
        if (btn) btn.disabled = true;
        try {
            const data = await apiRequest("/settings/database/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ new_password: v1 }),
            });
            setFeedback(data.message || (t("settings.database.pwChanged") || "Veritabanı parolası güncellendi."));
            dbPasswordForm.reset();
            await loadDatabaseTab();
        } catch (error) {
            setFeedback(error.message || (t("settings.database.pwFail") || "Parola değiştirilemedi; eski parola korundu."), true);
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

})();
