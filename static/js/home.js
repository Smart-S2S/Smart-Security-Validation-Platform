const heroAppBtn = document.getElementById('heroAppBtn');
const langTrLink = document.getElementById('langTrLink');
const langEnLink = document.getElementById('langEnLink');
const homeMenuWrap = document.getElementById('homeMenuWrap');
const homeDirectLoginBtn = document.getElementById('homeDirectLoginBtn');
const homeMenuToggle = document.getElementById('homeMenuToggle');
const homeMenuPopover = document.getElementById('homeMenuPopover');
const homeMenuLogin = document.getElementById('homeMenuLogin');
const homeMenuProfile = document.getElementById('homeMenuProfile');
const homeMenuSettings = document.getElementById('homeMenuSettings');
const homeMenuPanel = document.getElementById('homeMenuPanel');
const homeMenuApp = document.getElementById('homeMenuApp');
const homeMenuLogout = document.getElementById('homeMenuLogout');
const loginModal = document.getElementById('loginModal');
const closeLoginModal = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const loginInfo = document.getElementById('loginInfo');
const offerModal = document.getElementById('offerModal');
const closeOfferModal = document.getElementById('closeOfferModal');
const offerForm = document.getElementById('offerForm');
const offerInfo = document.getElementById('offerInfo');

const HOME_LANGUAGE_STORAGE_KEY = 'ssvp-home-language';
const HOME_I18N_BASE = '/static/i18n/home';

let isAuthenticated = false;
let currentLanguage = 'tr';
let dictionary = {};
let currentUser = null;
const hasServerAuthMenu = Boolean(homeMenuWrap);

if (hasServerAuthMenu) {
    isAuthenticated = true;
}

function pickInitialLanguage() {
    const fromRoute = String(window.__HOME_LANG__ || '').trim().toLowerCase();
    if (fromRoute === 'tr' || fromRoute === 'en') {
        return fromRoute;
    }

    const pathPart = (window.location.pathname.split('/')[1] || '').toLowerCase();
    if (pathPart === 'tr' || pathPart === 'en') {
        return pathPart;
    }

    const stored = (localStorage.getItem(HOME_LANGUAGE_STORAGE_KEY) || '').trim().toLowerCase();
    if (stored === 'tr' || stored === 'en') {
        return stored;
    }

    return 'tr';
}

function t(key, fallback = '') {
    return dictionary[key] || fallback || key;
}

async function loadDictionary(lang) {
    const response = await fetch(`${HOME_I18N_BASE}.${lang}.json`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load home i18n: ${lang}`);
    }

    return response.json();
}

function applyI18n() {
    document.documentElement.lang = currentLanguage;
    if (langTrLink && langEnLink) {
        langTrLink.classList.toggle('active', currentLanguage === 'tr');
        langEnLink.classList.toggle('active', currentLanguage === 'en');
    }

    document.querySelectorAll('[data-i18n]').forEach((node) => {
        const key = node.getAttribute('data-i18n');
        if (!key) {
            return;
        }

        node.textContent = t(key, node.textContent || '');
    });

    document.title = t('home.meta.title', document.title);
}

async function setLanguage(lang) {
    currentLanguage = lang === 'en' ? 'en' : 'tr';
    dictionary = await loadDictionary(currentLanguage);
    localStorage.setItem(HOME_LANGUAGE_STORAGE_KEY, currentLanguage);
    applyI18n();
}

function setLoginInfo(message, isError = false) {
    if (!loginInfo) {
        if (message && window.SSVPNotify) {
            window.SSVPNotify.show({ message, type: isError ? 'error' : 'info', duration: 10000 });
        }
        return;
    }

    loginInfo.textContent = message;
    loginInfo.style.color = isError ? '#ffb4a5' : '#9eb3ca';

    if (message && window.SSVPNotify) {
        window.SSVPNotify.show({ message, type: isError ? 'error' : 'info', duration: 10000 });
    }
}

function showLoginModal(show) {
    if (!loginModal) {
        return;
    }

    loginModal.hidden = !show;
}

function setOfferInfo(message, isError = false) {
    if (!offerInfo) {
        if (message && window.SSVPNotify) {
            window.SSVPNotify.show({ message, type: isError ? 'error' : 'success', duration: 10000 });
        }
        return;
    }

    offerInfo.textContent = message;
    offerInfo.style.color = isError ? '#b42318' : '#5f7288';

    if (message && window.SSVPNotify) {
        window.SSVPNotify.show({ message, type: isError ? 'error' : 'success', duration: 10000 });
    }
}

function showOfferModal(show) {
    if (!offerModal) {
        return;
    }

    offerModal.hidden = !show;
}

function applyHeroCta() {
    if (!heroAppBtn) {
        return;
    }

    if (isAuthenticated) {
        heroAppBtn.textContent = t('home.hero.appCta', 'Pentest Uygulamasına Geç');
        heroAppBtn.setAttribute('href', '/app');
        return;
    }

    heroAppBtn.textContent = t('home.hero.offerCta', 'Teklif Al');
    heroAppBtn.setAttribute('href', '#offer');
}

function applyAuthState() {
    const showServerMenu = hasServerAuthMenu;
    const showAuthenticatedUi = isAuthenticated || showServerMenu;

    if (homeDirectLoginBtn) {
        homeDirectLoginBtn.hidden = showAuthenticatedUi;
    }
    if (homeMenuWrap) {
        homeMenuWrap.hidden = false;
    }
    if (homeMenuPanel) {
        homeMenuPanel.hidden = !(isAuthenticated && currentUser?.is_admin);
    }

    if (homeMenuToggle) {
        const username = currentUser?.username || 'U';
        homeMenuToggle.textContent = String(username).slice(0, 1).toUpperCase();
        homeMenuToggle.title = username;
    }

    applyHeroCta();
}

async function checkAuth() {
    try {
        const response = await fetch('/auth/me', { headers: { 'Accept-Language': currentLanguage }, cache: 'no-store' });
        isAuthenticated = response.ok;
        if (response.ok) {
            currentUser = await response.json();
        } else {
            currentUser = null;
            if (hasServerAuthMenu) {
                isAuthenticated = true;
            }
        }
    } catch (_) {
        currentUser = null;
        isAuthenticated = hasServerAuthMenu;
    }

    applyAuthState();
}

async function login(username, password) {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Language': currentLanguage,
        },
        body,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.detail || payload.error || t('home.login.error.generic', 'Giris basarisiz'));
    }

    isAuthenticated = true;
    applyAuthState();
}

async function logout() {
    await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Accept-Language': currentLanguage },
    });
    isAuthenticated = false;
    currentUser = null;
    applyAuthState();
}

if (heroAppBtn) {
    heroAppBtn.addEventListener('click', (event) => {
        if (isAuthenticated) {
            return;
        }

        event.preventDefault();
        setOfferInfo(t('home.offer.info', 'Kısa bilgilerinizle teklif talebinizi iletebilirsiniz.'));
        showOfferModal(true);
    });
}

if (homeMenuLogin) {
    homeMenuLogin.addEventListener('click', () => {
        if (homeMenuPopover) {
            homeMenuPopover.hidden = true;
        }
        setLoginInfo(t('home.login.info', 'Pentest paneline gecmek icin oturum acin.'));
        showLoginModal(true);
    });
}

if (homeDirectLoginBtn) {
    homeDirectLoginBtn.addEventListener('click', () => {
        setLoginInfo(t('home.login.info', 'Pentest paneline gecmek icin oturum acin.'));
        showLoginModal(true);
    });
}

if (homeMenuProfile) {
    homeMenuProfile.addEventListener('click', () => {
        window.location.href = '/panel#profile';
    });
}

if (homeMenuSettings) {
    homeMenuSettings.addEventListener('click', () => {
        window.location.href = '/settings';
    });
}

if (homeMenuApp) {
    homeMenuApp.addEventListener('click', () => {
        window.location.href = '/app';
    });
}

if (homeMenuPanel) {
    homeMenuPanel.addEventListener('click', () => {
        window.location.href = '/panel';
    });
}

if (homeMenuToggle && homeMenuPopover) {
    homeMenuToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        homeMenuPopover.hidden = !homeMenuPopover.hidden;
    });

    document.addEventListener('click', (event) => {
        if (!homeMenuWrap?.contains(event.target)) {
            homeMenuPopover.hidden = true;
        }
    });
}

if (closeLoginModal) {
    closeLoginModal.addEventListener('click', () => showLoginModal(false));
}

if (loginModal) {
    loginModal.addEventListener('click', (event) => {
        if (event.target === loginModal) {
            showLoginModal(false);
        }
    });
}

if (closeOfferModal) {
    closeOfferModal.addEventListener('click', () => showOfferModal(false));
}

if (offerModal) {
    offerModal.addEventListener('click', (event) => {
        if (event.target === offerModal) {
            showOfferModal(false);
        }
    });
}

if (homeMenuLogout) {
    homeMenuLogout.addEventListener('click', async () => {
        await logout();
        const homePath = currentLanguage === 'en' ? '/en' : '/tr';
        window.location.href = homePath;
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = (document.getElementById('username')?.value || '').trim();
        const password = document.getElementById('password')?.value || '';

        if (!username || !password) {
            setLoginInfo(t('home.login.error.required', 'Kullanici adi ve sifre gerekli.'), true);
            return;
        }

        try {
            await login(username, password);
            window.location.href = '/app';
        } catch (error) {
            setLoginInfo(error.message || t('home.login.error.generic', 'Giris basarisiz.'), true);
        }
    });
}

if (offerForm) {
    offerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const payload = {
            name: (document.getElementById('offerName')?.value || '').trim(),
            email: (document.getElementById('offerEmail')?.value || '').trim(),
            company: (document.getElementById('offerCompany')?.value || '').trim(),
            phone: (document.getElementById('offerPhone')?.value || '').trim(),
            message: (document.getElementById('offerMessage')?.value || '').trim(),
            language: currentLanguage,
        };

        if (!payload.name || !payload.email || payload.message.length < 10) {
            setOfferInfo(t('home.offer.error.required', 'Lütfen ad, e-posta ve en az 10 karakterlik talep detayı girin.'), true);
            return;
        }

        try {
            const response = await fetch('/offers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Language': currentLanguage,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.detail || data.error || t('home.offer.error.generic', 'Teklif başvurusu alınamadı.'));
            }

            offerForm.reset();
            setOfferInfo(t('home.offer.success', 'Teklif başvurunuz alındı. Ekibimiz sizinle iletişime geçecek.'));
        } catch (error) {
            setOfferInfo(error.message || t('home.offer.error.generic', 'Teklif başvurusu alınamadı.'), true);
        }
    });
}

(async function bootstrap() {
    try {
        await setLanguage(pickInitialLanguage());
    } catch (_) {
        currentLanguage = 'tr';
        dictionary = {};
    }

    await checkAuth();

    const query = new URLSearchParams(window.location.search);
    if (query.get('login') === '1' && !isAuthenticated) {
        setLoginInfo(t('home.login.info', 'Pentest paneline gecmek icin oturum acin.'));
        showLoginModal(true);
    }
})();
