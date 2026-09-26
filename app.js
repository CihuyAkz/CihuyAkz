const CONFIG = {
    // GitHub repository used for publishing. Only this GitHub account may log in.
    repoOwner: 'CihuyAkz',
    repo: 'CihuyAkz',
    allowedUser: 'CihuyAkz',
    branch: 'main',
    cacheBuster: () => Date.now(),
    localDbCacheVersion: '20260926-tags-search-v1',

    // GitHub Pages URL for this project fork.
    pagesBaseUrl() {
        return `https://${this.repoOwner.toLowerCase()}.github.io/${this.repo}/`;
    }
};

const utils = {
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },
    
    safeBtoa(str) {
        try {
            return btoa(unescape(encodeURIComponent(str)));
        } catch(e) {
            return btoa(str);
        }
    },
    
    safeAtob(str) {
        try {
            return decodeURIComponent(escape(atob(str)));
        } catch(e) {
            return atob(str);
        }
    },

    sanitizeTitle(title) {
        return title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    validateTitle(title) {
        if (!title || title.trim().length === 0) return 'Title is required';
        if (title.length > 100) return 'Title must be less than 100 characters';
        const sanitized = this.sanitizeTitle(title);
        if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
            return 'Invalid title characters';
        }
        const reserved = ['con', 'prn', 'aux', 'nul'];
        if (reserved.includes(sanitized.toLowerCase())) return 'Invalid title';
        return null;
    },

    validateCode(code) {
        if (!code || code.trim().length === 0) return 'Code is required';
        if (code.length > 100000) return 'Code is too large (max 100KB)';
        return null;
    },
    
    formatDisplayTime(isoString, timezone) {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }
};

const app = {
    db: null,
    dbSha: null,
    token: null,
    currentUser: null,
    currentFilter: 'all',
    currentSort: 'newest',
    actionInProgress: false,
    currentEditingId: null,
    originalTitle: null,
    originalPageId: null,
    currentBotId: null,
    cmEditors: {},
    scriptDraftCounter: 0,
    isLoading: false,
    searchQuery: '',
    currentTag: '',
    scheduledTimers: {},
    
    async init() {
        this.prepareLocalDatabaseCache();
        const sessionValid = await this.loadSession();
        await this.loadDatabase();
        this.handleRouting();
        window.addEventListener('hashchange', () => this.handleRouting());
        
        this.debouncedRender = utils.debounce(() => this.renderList(), 300);
        this.initEventListeners();
        
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (location.hash === '#admin') {
                    const activeTab = document.querySelector('.tab-btn.active')?.dataset.adminTab;
                    if (activeTab === 'create') {
                        this.savePage();
                    } else if (activeTab === 'bots' || activeTab === 'create-bot') {
                        this.saveBot();
                    }
                }
            }
        });

        this.startSessionRefresh();
        this.startBotScheduler();
    },

    startSessionRefresh() {
        setInterval(() => {
            if (this.token && this.currentUser) {
                const expiry = localStorage.getItem('gh_token_expiry');
                if (expiry && Date.now() >= parseInt(expiry)) {
                    this.logout(true);
                }
            }
        }, 60000);
    },
    
    startBotScheduler() {
        setTimeout(() => this.checkScheduledBots(), 1000);
        setInterval(() => this.checkScheduledBots(), 30000);
    },
    
    initEventListeners() {
        const searchInput = document.getElementById('search');
        const searchWrapper = document.getElementById('search-wrapper');
        const searchCancel = document.getElementById('search-cancel');

        const setSearchActive = (active) => {
            searchWrapper?.classList.toggle('is-active', active);
        };

        if (searchInput) {
            searchInput.addEventListener('focus', () => setSearchActive(true));
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                setSearchActive(true);
                this.debouncedRender();
            });
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    searchCancel?.click();
                }
            });
            searchInput.addEventListener('blur', () => {
                if (!searchInput.value.trim()) setSearchActive(false);
            });
        }

        searchCancel?.addEventListener('click', () => {
            if (!searchInput) return;
            searchInput.value = '';
            this.searchQuery = '';
            this.currentTag = '';
            document.querySelectorAll('.tag-filter').forEach(tag => tag.classList.remove('active'));
            document.querySelector('.tag-filter[data-tag=""]')?.classList.add('active');
            searchWrapper?.classList.remove('is-active');
            searchInput.blur();
            this.renderList();
        });

        const tagsInput = document.getElementById('edit-tags');
        if (tagsInput) {
            tagsInput.addEventListener('input', () => this.renderTagPreview(tagsInput.value));
        }
    },
    
    initCodeMirror() {
        if (typeof CodeMirror === 'undefined') return;
        document.querySelectorAll('#script-builder .script-code-textarea').forEach(textarea => {
            const entryId = textarea.closest('.script-entry')?.dataset.entryId;
            if (!entryId || this.cmEditors[entryId]) return;
            const editor = CodeMirror.fromTextArea(textarea, {
                mode: 'lua',
                theme: 'monokai',
                lineNumbers: true,
                lineWrapping: true,
                matchBrackets: true,
                indentUnit: 4,
                tabSize: 4,
                viewportMargin: Infinity
            });
            this.cmEditors[entryId] = editor;
            editor.on('change', () => {
                const entry = document.querySelector(`.script-entry[data-entry-id="${CSS.escape(entryId)}"]`);
                if (entry) {
                    const size = entry.querySelector('.script-size-label');
                    if (size) size.textContent = `${editor.getValue().length.toLocaleString()} characters`;
                }
            });
        });
        Object.values(this.cmEditors).forEach(editor => editor.refresh());
    },

    destroyCodeMirrorEditors() {
        Object.values(this.cmEditors || {}).forEach(editor => {
            try { editor.toTextArea(); } catch (_) {}
        });
        this.cmEditors = {};
    },

    async ensureDatabaseSha() {
        if (!this.dbSha) this.dbSha = await this.getRemoteDatabaseSha();
        return this.dbSha;
    },

    async loadSession() {
        try {
            const storedToken = localStorage.getItem('gh_token');
            const storedUser = localStorage.getItem('gh_user');
            const tokenExpiry = localStorage.getItem('gh_token_expiry');
            
            if (storedToken && storedUser && tokenExpiry) {
                const now = Date.now();
                if (now < parseInt(tokenExpiry)) {
                    this.token = storedToken;
                    this.currentUser = JSON.parse(storedUser);
                    
                    if (this.currentUser.login.toLowerCase() !== CONFIG.allowedUser.toLowerCase()) {
                        this.logout(true);
                        return false;
                    }
                    
                    this.updateUIForLoggedInUser();
                    return true;
                } else {
                    this.logout(true);
                }
            }
        } catch(e) {
            console.error('Session load error:', e);
        }
        return false;
    },

    updateUIForLoggedInUser() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'flex';
        const privateFilter = document.getElementById('private-filter');
        const unlistedFilter = document.getElementById('unlisted-filter');
        if (privateFilter) privateFilter.style.display = 'block';
        if (unlistedFilter) unlistedFilter.style.display = 'block';
    },

    prepareLocalDatabaseCache() {
        try {
            const versionKey = 'cihuyakz_local_db_version';
            const currentVersion = localStorage.getItem(versionKey);
            if (currentVersion !== CONFIG.localDbCacheVersion) {
                localStorage.removeItem('cihuyakz_local_db_v2');
                localStorage.setItem(versionKey, CONFIG.localDbCacheVersion);
            }
        } catch (e) {
            console.warn('Could not prepare local database cache:', e);
        }
    },

    normalizeDatabase(database) {
        const db = (database && typeof database === 'object') ? database : {};
        if (!db.bots || typeof db.bots !== 'object') db.bots = {};
        if (!db.pages || typeof db.pages !== 'object') db.pages = {};

        // Backward compatibility: turn legacy one-script records into one page each.
        if (db.scripts && typeof db.scripts === 'object' && Object.keys(db.scripts).length) {
            Object.entries(db.scripts).forEach(([legacyTitle, legacy]) => {
                const pageId = utils.sanitizeTitle(legacy.displayTitle || legacy.title || legacyTitle) || `page-${Date.now()}`;
                if (db.pages[pageId]) return;
                const scriptId = utils.sanitizeTitle(legacy.title || legacyTitle) || `script-${Date.now()}`;
                db.pages[pageId] = {
                    id: pageId,
                    title: legacy.displayTitle || legacy.title || legacyTitle,
                    displayTitle: legacy.displayTitle || legacy.title || legacyTitle,
                    visibility: legacy.visibility || 'PUBLIC',
                    description: legacy.description || '',
                    tags: this.normalizeTags(legacy.tags || []),
                    filename: legacy.filename || `${scriptId}.lua`,
                    created: legacy.created || new Date().toISOString(),
                    updated: legacy.updated || legacy.created || new Date().toISOString(),
                    scripts: {
                        [scriptId]: {
                            id: scriptId,
                            name: legacy.displayTitle || legacy.title || legacyTitle,
                            displayName: legacy.displayTitle || legacy.title || legacyTitle,
                            filename: legacy.filename || `${scriptId}.lua`,
                            size: legacy.size || 0,
                            created: legacy.created || new Date().toISOString(),
                            updated: legacy.updated || legacy.created || new Date().toISOString()
                        }
                    }
                };
            });
            delete db.scripts;
        }

        Object.entries(db.pages).forEach(([pageId, page]) => {
            if (!page || typeof page !== 'object') {
                delete db.pages[pageId];
                return;
            }
            page.id = pageId;
            page.title = page.title || page.displayTitle || pageId;
            page.displayTitle = page.displayTitle || page.title;
            page.visibility = page.visibility || 'PUBLIC';
            page.description = page.description || '';
            page.tags = this.normalizeTags(page.tags || []);
            page.created = page.created || new Date().toISOString();
            page.updated = page.updated || page.created;
            if (!page.scripts || typeof page.scripts !== 'object') page.scripts = {};
            Object.entries(page.scripts).forEach(([scriptId, script]) => {
                if (!script || typeof script !== 'object') {
                    delete page.scripts[scriptId];
                    return;
                }
                script.id = scriptId;
                script.name = script.name || script.displayName || script.title || scriptId;
                script.displayName = script.displayName || script.name;
                script.filename = script.filename || `${scriptId}.lua`;
                script.size = Number(script.size || 0);
                script.created = script.created || page.created;
                script.updated = script.updated || page.updated;
            });
        });

        // Remove empty legacy helper for new writes.
        if (db.scripts) delete db.scripts;
        return db;
    },

    saveSession() {
        if (this.token && this.currentUser) {
            try {
                const expiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
                localStorage.setItem('gh_token', this.token);
                localStorage.setItem('gh_user', JSON.stringify(this.currentUser));
                localStorage.setItem('gh_token_expiry', expiry.toString());
            } catch(e) {
                console.error('Session save error:', e);
                this.showToast('Failed to save session', 'error');
            }
        }
    },

    toggleLoginModal() {
        const modal = document.getElementById('login-modal');
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        document.getElementById('login-error').style.display = 'none';
        if (modal.style.display === 'flex') {
            document.getElementById('auth-token').focus();
        }
    },

    async login() {
        if (this.actionInProgress) return;
        this.actionInProgress = true;
        
        try {
            const token = document.getElementById('auth-token').value.trim();
            if (!token) {
                this.showLoginError('Token is required');
                return;
            }
            
            this.token = token;
            const success = await this.verifyToken(false);
            if (success) {
                this.saveSession();
                this.toggleLoginModal();
                document.getElementById('auth-token').value = '';
                await this.loadDatabase();
                this.renderList();
                this.showToast('Logged in successfully!', 'success');
            }
        } finally {
            this.actionInProgress = false;
        }
    },

    showLoginError(message) {
        const err = document.getElementById('login-error');
        err.textContent = message;
        err.style.display = 'block';
        this.actionInProgress = false;
    },
    
    showToast(message, type = 'success') {
        if (typeof Toastify !== 'undefined') {
            const toast = Toastify({
                text: message,
                duration: 3000,
                gravity: 'top',
                position: window.matchMedia('(max-width: 560px)').matches ? 'center' : 'right',
                offset: { x: 12, y: 74 },
                close: true,
                closeOnClick: true,
                stopOnFocus: false,
                className: `cihuy-toast cihuy-toast-${type}`,
                style: {
                    background: type === 'success'
                        ? 'linear-gradient(135deg,#22c55e,#15803d)'
                        : type === 'error'
                            ? 'linear-gradient(135deg,#ef4444,#b91c1c)'
                            : 'linear-gradient(135deg,#f59e0b,#b45309)'
                },
                onClick: () => toast.hideToast()
            });
            toast.showToast();
            const node = toast.toastElement;
            if (node) {
                const dismiss = () => toast.hideToast();
                node.addEventListener('click', dismiss, { passive: true });
                node.addEventListener('touchend', dismiss, { passive: true });
            }
        } else {
            alert(message);
        }
    },

    logout(silent = false) {
        if (!silent && !confirm('Are you sure you want to logout?')) {
            return;
        }
        
        try {
            localStorage.removeItem('gh_token');
            localStorage.removeItem('gh_user');
            localStorage.removeItem('gh_token_expiry');
        } catch(e) {}
        
        this.token = null;
        this.currentUser = null;
        this.db = null;
        this.dbSha = null;
        
        Object.values(this.scheduledTimers).forEach(timer => clearTimeout(timer));
        this.scheduledTimers = {};
        
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('user-section').style.display = 'none';
        const privateFilter = document.getElementById('private-filter');
        const unlistedFilter = document.getElementById('unlisted-filter');
        if (privateFilter) privateFilter.style.display = 'none';
        if (unlistedFilter) unlistedFilter.style.display = 'none';
        
        location.href = '#';
        
        if (!silent) {
            this.showToast('Logged out successfully', 'success');
            setTimeout(() => location.reload(), 1000);
        }
    },

    async verifyToken(silent) {
        try {
            const res = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${this.token}` }
            });
            
            if (!res.ok) throw new Error('Invalid token');
            
            const user = await res.json();
            if (user.login.toLowerCase() !== CONFIG.allowedUser.toLowerCase()) {
                throw new Error(`Access is restricted to the GitHub account ${CONFIG.allowedUser}. This token belongs to ${user.login}.`);
            }
            
            this.currentUser = user;
            this.updateUIForLoggedInUser();
            return true;
        } catch (e) {
            if (!silent) this.showLoginError(e.message);
            this.token = null;
            try {
                localStorage.removeItem('gh_token');
                localStorage.removeItem('gh_user');
                localStorage.removeItem('gh_token_expiry');
            } catch(err) {}
            return false;
        }
    },

    async loadDatabase() {
        try {
            this.isLoading = true;
            const list = document.getElementById('admin-list');
            if (list) {
                list.innerHTML = `<div style="text-align:center;padding:20px"><div class="spinner"></div><p>Loading...</p></div>`;
            }

            // Public/library view is intentionally local-first. The original project
            // fetched the old GitHub database on every page load, which made deleted
            // scripts reappear even though the bundled database was cleaned.
            const localSaved = localStorage.getItem('cihuyakz_local_db_v2');
            if (localSaved) {
                this.db = this.normalizeDatabase(JSON.parse(localSaved));
                this.renderList();
                this.renderAdminList();
                this.renderAdminStats();
                this.scheduleLoadedBots();
                return;
            }

            const localRes = await fetch(`database.json?t=${CONFIG.cacheBuster()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!localRes.ok) throw new Error(`Failed to load bundled database: ${localRes.status}`);

            this.db = this.normalizeDatabase(await localRes.json());
            try {
                localStorage.setItem('cihuyakz_local_db_v2', JSON.stringify(this.db));
            } catch (storageError) {
                console.warn('Local database cache unavailable:', storageError);
            }

            this.scheduleLoadedBots();

            this.renderList();
            this.renderAdminList();
            this.renderAdminStats();
        } catch (e) {
            console.error('DB Error', e);
            const list = document.getElementById('admin-list');
            if (list) {
                list.innerHTML = `<div class="empty-admin-state">
                    <p style="color:var(--color-danger)">Error: ${e.message}</p>
                    <button class="btn btn-sm" onclick="app.loadDatabase()" style="margin-top:10px">Retry</button>
                </div>`;
            }
            this.showToast(`Error: ${e.message}`, 'error');
        } finally {
            this.isLoading = false;
        }
    },

    scheduleLoadedBots() {
        Object.keys(this.scheduledTimers).forEach(id => clearTimeout(this.scheduledTimers[id]));
        this.scheduledTimers = {};
        Object.entries(this.db?.bots || {}).forEach(([botId, bot]) => {
            if (bot.scheduled && bot.scheduledTime && !bot.sent && !bot.cancelled) {
                this.scheduleBotTimer(botId, bot);
            }
        });
    },

    renderAdminStats() {
        const pages = Object.values(this.db?.pages || {});
        const scripts = pages.reduce((sum, page) => sum + Object.keys(page.scripts || {}).length, 0);
        const bots = Object.keys(this.db?.bots || {}).length;
        const pageCount = document.getElementById('admin-page-count');
        const scriptCount = document.getElementById('admin-script-count');
        const botCount = document.getElementById('admin-bot-count');
        if (pageCount) pageCount.textContent = pages.length;
        if (scriptCount) scriptCount.textContent = scripts;
        if (botCount) botCount.textContent = bots;
    },

    scheduleBotTimer(botId, bot) {
        if (this.scheduledTimers[botId]) {
            clearTimeout(this.scheduledTimers[botId]);
            delete this.scheduledTimers[botId];
        }

        if (bot.sent || bot.cancelled || bot.isProcessing || !bot.scheduled) return;

        const scheduledDate = new Date(bot.scheduledTime);
        const delay = scheduledDate.getTime() - Date.now();

        if (delay <= 0) {
            if (delay > -300000) this.triggerScheduledBot(botId);
            return;
        }

        const MAX_BROWSER_DELAY = 2147483647;
        if (delay > MAX_BROWSER_DELAY) return;

        this.scheduledTimers[botId] = setTimeout(() => {
            this.triggerScheduledBot(botId);
            delete this.scheduledTimers[botId];
        }, delay);
    },

    async triggerScheduledBot(botId) {
        try {
            const bot = this.db.bots[botId];
            if (!bot || bot.sent || bot.cancelled || bot.isProcessing) return;

            bot.isProcessing = true;
            
            const workflowResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/actions/workflows/discord-bot.yml/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ref: 'main',
                        inputs: {
                            botId: botId,
                            title: bot.title,
                            message: bot.message,
                            scheduled: 'true'
                        }
                    })
                }
            );

            if (workflowResponse.status === 204) {
                bot.status = 'processing';
                bot.lastTriggered = new Date().toISOString();
                bot.isProcessing = false;
                setTimeout(() => this.loadDatabase(), 5000);
            } else {
                const errorText = await workflowResponse.text();
                bot.isProcessing = false;
                bot.lastError = `Workflow trigger failed: ${workflowResponse.status}`;
            }
        } catch (error) {
            if (this.db.bots[botId]) {
                this.db.bots[botId].isProcessing = false;
                this.db.bots[botId].lastError = error.message;
            }
        }
    },

    checkScheduledBots() {
        if (!this.currentUser || !this.db) return;
        const now = Date.now();
        Object.entries(this.db.bots || {}).forEach(([botId, bot]) => {
            if (bot.scheduled && bot.scheduledTime && !bot.sent && !bot.cancelled && !bot.isProcessing) {
                const scheduledTime = new Date(bot.scheduledTime).getTime();
                const timeDiff = scheduledTime - now;
                if (timeDiff > 0 && timeDiff <= 300000) {
                    if (!this.scheduledTimers[botId]) this.scheduleBotTimer(botId, bot);
                } else if (timeDiff <= 0 && timeDiff > -300000 && !this.scheduledTimers[botId]) {
                    this.triggerScheduledBot(botId);
                }
            }
        });
    },

    async sendBotNow(botId) {
        if (!this.currentUser || !this.db || !this.db.bots[botId]) return false;
        const bot = this.db.bots[botId];
        if (bot.isProcessing || bot.sent) return false;

        bot.isProcessing = true;

        try {
            const workflowResponse = await fetch(
                `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/actions/workflows/discord-bot.yml/dispatches`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ ref: 'main', inputs: { botId: botId } })
                }
            );

            if (workflowResponse.status === 204) {
                bot.status = 'processing';
                bot.isProcessing = false;
                
                const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Trigger bot: ${bot.title}`,
                        content: utils.safeBtoa(JSON.stringify(this.db, null, 2)),
                        sha: this.dbSha
                    })
                });

                if (dbRes.ok) {
                    const newDbData = await dbRes.json();
                    this.dbSha = newDbData.content.sha;
                    this.showToast('Triggered! Checking GitHub...', 'success');
                    return true;
                }
            } else {
                throw new Error(`GitHub Error: ${workflowResponse.status}`);
            }
            return false;
        } catch (error) {
            bot.isProcessing = false;
            this.showToast(`Error: ${error.message}`, 'error');
            return false;
        }
    },

    async saveBot() {
        const titleInput = document.getElementById('bot-title');
        const messageInput = document.getElementById('bot-message');
        const scheduleInput = document.getElementById('bot-schedule');
        const scheduleTimeInput = document.getElementById('bot-schedule-time');
        const timezoneInput = document.getElementById('bot-timezone');
        const saveBtn = document.querySelector('.bot-actions .btn:last-child');
        
        if (!titleInput || !messageInput || !saveBtn) return;
        
        const title = titleInput.value.trim();
        const message = messageInput.value.trim();
        const schedule = scheduleInput ? scheduleInput.checked : false;
        const scheduleTime = scheduleTimeInput ? scheduleTimeInput.value : '';
        const timezone = timezoneInput ? timezoneInput.value : Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        if (!title || !message) {
            this.showToast('Title and message are required', 'error');
            return;
        }
        
        if (this.actionInProgress) return;
        this.actionInProgress = true;
        saveBtn.disabled = true;
        if (typeof NProgress !== 'undefined') NProgress.start();
        
        try {
            const botId = this.currentBotId || `bot_${Date.now()}`;
            const now = new Date().toISOString();
            let scheduledTimeUTC = null;

            if (schedule && scheduleTime) {
                const localDate = new Date(scheduleTime);
                if (localDate < new Date()) {
                    this.showToast('Time cannot be in the past', 'error');
                    this.actionInProgress = false;
                    saveBtn.disabled = false;
                    return;
                }
                scheduledTimeUTC = localDate.toISOString();
            }

            const botData = {
                id: botId,
                title: title,
                message: message,
                scheduled: schedule,
                scheduledTime: scheduledTimeUTC,
                timezone: timezone,
                created: now,
                sent: false,
                status: schedule ? 'scheduled' : 'pending',
                sentTime: null,
                cancelled: false,
                isProcessing: false
            };

            this.db.bots[botId] = botData;

            const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Update bot: ${title}`,
                    content: utils.safeBtoa(JSON.stringify(this.db, null, 2)),
                    sha: this.dbSha
                })
            });

            if (!dbRes.ok) throw new Error('Database update failed');

            const newDbData = await dbRes.json();
            this.dbSha = newDbData.content.sha;

            if (schedule) {
                this.showToast(`Scheduled successfully`, 'success');
                await this.loadDatabase();
            } else {
                await this.sendBotNow(botId);
            }

        } catch(e) {
            this.showToast(`Error: ${e.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    normalizeTags(input) {
        const values = Array.isArray(input) ? input : String(input || '').split(',');
        const seen = new Set();
        return values
            .map(tag => String(tag || '').trim().replace(/\s+/g, ' '))
            .filter(Boolean)
            .map(tag => tag.slice(0, 24))
            .filter(tag => {
                const key = tag.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 8);
    },

    renderTagPreview(value) {
        const preview = document.getElementById('edit-tags-preview');
        if (!preview) return;
        const tags = this.normalizeTags(value);
        preview.innerHTML = tags.length
            ? tags.map(tag => `<span class="tag-pill tag-pill-preview">#${utils.escapeHtml(tag)}</span>`).join('')
            : '<span class="tag-preview-empty">Tags will appear here</span>';
    },

    renderTagFilters(pages) {
        const container = document.getElementById('tag-filters');
        if (!container) return;
        const tags = [...new Map(
            pages.flatMap(page => this.normalizeTags(page.tags || [])).map(tag => [tag.toLowerCase(), tag])
        ).values()].sort((a, b) => a.localeCompare(b));
        const active = this.currentTag.toLowerCase();
        const all = `<button type="button" class="tag-filter ${active ? '' : 'active'}" data-tag="" onclick="app.filterTag('')">All tags</button>`;
        if (!tags.length) {
            container.innerHTML = all + '<span class="tag-filter-empty">Add tags to your pages to filter them here.</span>';
            return;
        }
        container.innerHTML = all + tags.map(tag => {
            const isActive = tag.toLowerCase() === active;
            return `<button type="button" class="tag-filter ${isActive ? 'active' : ''}" data-tag="${utils.escapeHtml(tag.toLowerCase())}" onclick="app.filterTag(this.dataset.tag)">#${utils.escapeHtml(tag)}</button>`;
        }).join('');
    },

    filterTag(tag) {
        this.currentTag = String(tag || '');
        const input = document.getElementById('search');
        if (this.currentTag) {
            input?.focus();
            const currentQuery = this.searchQuery.trim();
            if (!currentQuery) {
                this.searchQuery = '';
            }
        }
        this.renderList();
    },

    renderList() {
        const list = document.getElementById('script-list');
        if (!list || !this.db) return;

        const pages = Object.entries(this.db.pages || {}).map(([id, data]) => ({ ...data, id }));
        this.renderTagFilters(pages.filter(page => page.visibility === 'PUBLIC' || this.currentUser));
        const filtered = this.filterLogic(pages);
        const sorted = this.sortLogic(filtered);

        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-state">
                <h2>No pages found</h2>
                <p>Try adjusting your search or filter.</p>
            </div>`;
            return;
        }

        list.innerHTML = sorted.map(page => {
            const scripts = Object.values(page.scripts || {});
            const scriptNames = scripts.slice(0, 3).map(script => utils.escapeHtml(script.name)).join(', ');
            const moreCount = scripts.length > 3 ? ` +${scripts.length - 3} more` : '';
            const pageId = page.id || utils.sanitizeTitle(page.title);
            const pageTags = this.normalizeTags(page.tags || []);
            const tagsMarkup = pageTags.length ? `<div class="page-card-tags">${pageTags.map(tag => `<button type=\"button\" class=\"tag-pill\" data-tag=\"${utils.escapeHtml(tag)}\" onclick=\"event.stopPropagation(); app.filterTag(this.dataset.tag)\">#${utils.escapeHtml(tag)}</button>`).join('')}</div>` : '';
            return `<div class="script-card page-card" onclick="window.location.href='scripts/${encodeURIComponent(pageId)}/index.html'">
                <div class="card-content">
                    <div class="card-header-section">
                        <h3 class="script-title">${utils.escapeHtml(page.title)}</h3>
                        ${page.visibility !== 'PUBLIC' ? `<span class="badge badge-${page.visibility.toLowerCase()}">${page.visibility}</span>` : ''}
                    </div>
                    <div class="page-card-count">${scripts.length} ${scripts.length === 1 ? 'script' : 'scripts'}</div>
                    ${page.description ? `<p class="page-card-description">${utils.escapeHtml(page.description.substring(0, 160))}${page.description.length > 160 ? '...' : ''}</p>` : ''}
                    ${tagsMarkup}
                    ${scriptNames ? `<div class="page-card-scripts">${scriptNames}${utils.escapeHtml(moreCount)}</div>` : ''}
                    <div class="card-meta">
                        <span>${new Date(page.created).toLocaleDateString('en-US')}</span>
                        ${page.updated && page.updated !== page.created ? `<span title="Updated">Updated ${new Date(page.updated).toLocaleDateString('en-US')}</span>` : ''}
                    </div>
                </div>
                <div class="page-card-arrow" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>
                </div>
            </div>`;
        }).join('');
    },

    filterLogic(pages) {
        const query = this.searchQuery.trim().toLowerCase();
        const tagQuery = this.currentTag.trim().toLowerCase();
        return pages.filter(page => {
            const pageTags = this.normalizeTags(page.tags || []);
            const matchesSearch = !query || page.title.toLowerCase().includes(query) ||
                (page.description || '').toLowerCase().includes(query) ||
                pageTags.some(tag => tag.toLowerCase().includes(query)) ||
                Object.values(page.scripts || {}).some(script => (script.name || '').toLowerCase().includes(query));
            if (!matchesSearch) return false;
            if (tagQuery && !pageTags.some(tag => tag.toLowerCase() === tagQuery)) return false;
            if (page.visibility === 'PRIVATE' && !this.currentUser) return false;
            if (page.visibility === 'UNLISTED' && !this.currentUser) return false;
            if (this.currentFilter === 'private' && page.visibility !== 'PRIVATE') return false;
            if (this.currentFilter === 'public' && page.visibility !== 'PUBLIC') return false;
            if (this.currentFilter === 'unlisted' && page.visibility !== 'UNLISTED') return false;
            return true;
        });
    },

    sortLogic(pages) {
        return pages.sort((a, b) => {
            if (this.currentSort === 'newest') return new Date(b.created || 0) - new Date(a.created || 0);
            if (this.currentSort === 'oldest') return new Date(a.created || 0) - new Date(b.created || 0);
            if (this.currentSort === 'alpha') return a.title.localeCompare(b.title);
            if (this.currentSort === 'updated') return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
            return 0;
        });
    },

    filterCategory(cat, e) {
        if (e) {
            e.preventDefault();
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            const link = e.currentTarget || e.target.closest('.sidebar-link');
            if (link) link.classList.add('active');
        }
        this.currentFilter = cat;
        this.renderList();
    },

    setSort(val) {
        this.currentSort = val;
        this.renderList();
    },

    switchAdminTab(tab, options = {}) {
        if (!this.currentUser) {
            location.hash = '';
            return;
        }

        document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const navTab = tab === 'create-bot' ? 'bots' : (tab === 'edit' ? 'create' : tab);
        document.querySelector(`[data-admin-tab="${CSS.escape(navTab)}"]`)?.classList.add('active');

        if (tab === 'list') {
            document.getElementById('admin-tab-list').style.display = 'block';
            this.renderAdminList();
        } else if (tab === 'bots') {
            document.getElementById('admin-tab-bots').style.display = 'block';
            this.renderBotsList();
        } else if (tab === 'create-bot') {
            document.getElementById('admin-tab-bot-editor').style.display = 'block';
            if (!options.preserveEditor) this.resetBotEditor();
        } else {
            document.getElementById('admin-tab-editor').style.display = 'block';
            if (tab === 'create' && !options.preserveEditor) this.resetEditor();
            setTimeout(() => this.initCodeMirror(), 50);
        }
    },

    async renderAdminList() {
        if (!this.currentUser || !this.db) return;
        const list = document.getElementById('admin-list');
        const pages = Object.entries(this.db.pages || {}).map(([id, data]) => ({ ...data, id }));
        const sorted = pages.sort((a, b) => new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0));
        const scriptTotal = sorted.reduce((sum, page) => sum + Object.keys(page.scripts || {}).length, 0);

        document.getElementById('total-stats').textContent = `${sorted.length} ${sorted.length === 1 ? 'Page' : 'Pages'} · ${scriptTotal} ${scriptTotal === 1 ? 'Script' : 'Scripts'}`;
        this.renderAdminStats();

        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-admin-state modern-empty">
                <div class="empty-icon">+</div>
                <h3>No pages yet</h3>
                <p>Create a page and add one or more named scripts to start building your library.</p>
                <button class="btn btn-sm" onclick="app.switchAdminTab('create')">Create First Page</button>
            </div>`;
            return;
        }

        list.innerHTML = sorted.map(page => {
            const scripts = Object.values(page.scripts || {});
            const updated = page.updated ? new Date(page.updated).toLocaleDateString('en-US') : new Date(page.created).toLocaleDateString('en-US');
            const names = scripts.slice(0, 4).map(script => `<span class="script-chip">${utils.escapeHtml(script.name)}</span>`).join('');
            const extra = scripts.length > 4 ? `<span class="script-chip script-chip-muted">+${scripts.length - 4}</span>` : '';
            const pageTags = this.normalizeTags(page.tags || []);
            const tagChips = pageTags.map(tag => `<span class="script-chip tag-chip">#${utils.escapeHtml(tag)}</span>`).join('');

            return `<div class="admin-item modern-admin-item" data-page-title="${utils.escapeHtml(page.title)}" data-page-id="${utils.escapeHtml(page.id)}" onclick="app.populateEditor('${String(page.id).replace(/'/g, "\'")}')">
                <div class="admin-item-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path>
                        <path d="M4 5.5v16"></path>
                    </svg>
                </div>
                <div class="admin-item-left">
                    <div class="admin-item-title-row">
                        <strong>${utils.escapeHtml(page.title)}</strong>
                        <span class="badge badge-sm badge-${(page.visibility || 'PUBLIC').toLowerCase()}">${page.visibility || 'PUBLIC'}</span>
                    </div>
                    ${page.description ? `<p class="admin-description">${utils.escapeHtml(page.description.substring(0, 150))}${page.description.length > 150 ? '...' : ''}</p>` : ''}
                    <div class="admin-script-chips">${names}${extra}${tagChips}</div>
                    <div class="admin-meta">
                        <span>${scripts.length} ${scripts.length === 1 ? 'script' : 'scripts'}</span>
                        <span class="text-muted">Updated ${updated}</span>
                    </div>
                </div>
                <div class="admin-item-actions">
                    <button type="button" class="admin-delete-btn" title="Delete page" aria-label="Delete page" onclick="event.stopPropagation(); app.deletePageConfirmation('${String(page.id)}')">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16"></path><path d="M10 11v6M14 11v6"></path><path d="M6 7l1 13h10l1-13"></path><path d="M9 7V4h6v3"></path></svg>
                    </button>
                    <span class="admin-item-arrow" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                </div>
            </div>`;
        }).join('');

    },

    renderBotsList() {
        if (!this.currentUser || !this.db) return;
        const list = document.getElementById('bots-list');
        const bots = Object.entries(this.db.bots || {}).map(([id, data]) => ({ ...data, id }));
        const sorted = bots.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));

        const botCount = document.getElementById('admin-bot-count');
        if (botCount) botCount.textContent = sorted.length;

        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-admin-state modern-empty"><h3>No bot posts yet</h3><p>Create a Discord post or schedule one for later.</p><button class="btn btn-sm" onclick="app.switchAdminTab('create-bot')">Create Bot Post</button></div>`;
            return;
        }

        list.innerHTML = sorted.map(b => {
            let status = 'Pending', statusClass = 'status-pending', timeInfo = 'Pending';
            if (b.cancelled) { status = 'Cancelled'; statusClass = 'status-cancelled'; }
            else if (b.sent) { status = 'Sent'; statusClass = 'status-sent'; timeInfo = `Sent: ${new Date(b.sentTime).toLocaleString('en-US')}`; }
            else if (b.scheduled) { status = 'Scheduled'; statusClass = 'status-scheduled'; timeInfo = `Scheduled: ${utils.formatDisplayTime(b.scheduledTime, b.timezone)}`; }

            return `<div class="admin-item modern-admin-item" data-bot-id="${utils.escapeHtml(b.id)}" onclick="app.populateBotEditor('${String(b.id).replace(/'/g, "\'")}')">
                <div class="admin-item-icon bot-icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
                        <rect x="4" y="7" width="16" height="12" rx="3"></rect>
                        <path d="M8 7V4M16 7V4M12 4v-2M8 13h.01M16 13h.01M9 16h6"></path>
                    </svg>
                </div>
                <div class="admin-item-left">
                    <div class="admin-item-title-row">
                        <strong>${utils.escapeHtml(b.title)}</strong>
                        <span class="bot-status ${statusClass}">${status}</span>
                    </div>
                    <p class="admin-description">${utils.escapeHtml((b.message || '').substring(0, 150))}${(b.message || '').length > 150 ? '...' : ''}</p>
                    <div class="admin-meta"><span>${timeInfo}</span></div>
                </div>
                <div class="admin-item-actions">
                    <button type="button" class="admin-delete-btn" title="Cancel bot" aria-label="Cancel bot" onclick="event.stopPropagation(); app.deleteBotConfirmation('${String(b.id)}')">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"></path></svg>
                    </button>
                    <span class="admin-item-arrow" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </span>
                </div>
            </div>`;
        }).join('');
    },

    initSwipeToDelete() {
        const adminItems = document.querySelectorAll('.admin-item');
        adminItems.forEach(item => {
            let startX = 0, isSwiping = false;
            
            item.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isSwiping = false;
                item.style.transition = 'none';
                item.classList.add('swiping');
            }, { passive: true });
            
            item.addEventListener('touchmove', (e) => {
                if (!startX) return;
                const currentX = e.touches[0].clientX, diff = currentX - startX;
                if (Math.abs(diff) > 30) {
                    isSwiping = true;
                    e.preventDefault();
                    if (diff > 0) {
                        item.style.transform = `translateX(${Math.min(diff, 100)}px)`;
                        item.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }
                }
            }, { passive: false });
            
            item.addEventListener('touchend', (e) => {
                if (!startX || !isSwiping) return;
                const endX = e.changedTouches[0].clientX, diff = endX - startX;
                item.style.transition = 'transform 0.3s ease, background-color 0.3s ease, opacity 0.3s ease';
                item.classList.remove('swiping');
                
                if (diff > 100) {
                    item.style.transform = 'translateX(300px)';
                    item.style.opacity = '0';
                    item.classList.add('swipe-delete');
                    
                    setTimeout(() => {
                        const pageId = item.getAttribute('data-page-id');
                        const botId = item.getAttribute('data-bot-id');
                        if (pageId) this.deletePageConfirmation(pageId);
                        else if (botId) this.deleteBotConfirmation(botId);
                    }, 300);
                } else {
                    item.style.transform = 'translateX(0)';
                    item.style.backgroundColor = '';
                }
                startX = 0;
                isSwiping = false;
            });
            
            item.addEventListener('click', (e) => {
                if (isSwiping) { e.preventDefault(); e.stopPropagation(); }
            });
        });
    },

    async deletePageConfirmation(pageId) {
        const pageKeys = Object.keys(this.db?.pages || {});
        const resolvedPageId = pageKeys.includes(pageId)
            ? pageId
            : pageKeys.find(key => this.db.pages[key]?.id === pageId);

        if (!resolvedPageId) {
            this.showToast('Page not found. Refreshing the workspace.', 'error');
            await this.loadDatabase();
            return;
        }

        const page = this.db.pages[resolvedPageId];
        let shouldDelete = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Delete Page',
                text: `Delete "${page.title}" and all ${Object.keys(page.scripts || {}).length} script files?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Delete Page',
                cancelButtonText: 'Keep Page',
                confirmButtonColor: '#ef4444'
            });
            shouldDelete = result.isConfirmed;
        } else {
            shouldDelete = confirm(`Delete "${page.title}" and all of its scripts?`);
        }

        if (shouldDelete) await this.deletePageLogic(resolvedPageId);
        else await this.loadDatabase();
    },

    async deleteBotConfirmation(botId) {
        if (!botId || !this.db.bots[botId]) return;

        const bot = this.db.bots[botId];
        let shouldDelete = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Cancel Bot',
                text: `Are you sure you want to cancel "${bot.title}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Cancel Bot',
                cancelButtonText: 'Keep',
                confirmButtonColor: '#ef4444'
            });
            shouldDelete = result.isConfirmed;
        } else {
            shouldDelete = confirm(`Cancel bot "${bot.title}"?`);
        }

        if (shouldDelete) await this.deleteBotLogic(botId);
        else await this.loadDatabase();
    },

    async deletePageLogic(pageId) {
        if (this.actionInProgress) return;
        this.actionInProgress = true;

        try {
            if (typeof NProgress !== 'undefined') NProgress.start();
            const page = this.db.pages[pageId];
            if (!page) throw new Error('Page not found');

            this.dbSha = await this.getRemoteDatabaseSha();

            const nextDb = JSON.parse(JSON.stringify(this.db));
            delete nextDb.pages[pageId];

            const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Remove page ${page.title}`,
                    content: utils.safeBtoa(JSON.stringify(nextDb, null, 2)),
                    sha: this.dbSha,
                    branch: CONFIG.branch
                })
            });

            if (!dbRes.ok) {
                let detail = `HTTP ${dbRes.status}`;
                try {
                    const body = await dbRes.json();
                    if (body?.message) detail += `: ${body.message}`;
                } catch (_) {}
                throw new Error(`Failed to update database — ${detail}`);
            }

            const newDbData = await dbRes.json();
            this.db = this.normalizeDatabase(nextDb);
            this.dbSha = newDbData.content.sha;

            try {
                localStorage.setItem('cihuyakz_local_db_v2', JSON.stringify(this.db));
            } catch (storageError) {
                console.warn('Could not persist local database cache:', storageError);
            }

            let cleanupWarning = false;
            try {
                await this.deletePageFiles(pageId, page);
            } catch (cleanupError) {
                cleanupWarning = true;
                console.warn('Page file cleanup failed after database deletion:', cleanupError);
            }

            if (this.currentEditingId === pageId) {
                this.currentEditingId = null;
                this.originalPageId = null;
                this.originalTitle = null;
            }

            this.showToast(cleanupWarning ? 'Page deleted. Some old files could not be removed automatically.' : 'Page deleted.', cleanupWarning ? 'warning' : 'success');
            this.renderAdminStats();
            this.switchAdminTab('list');
            this.renderList();
        } catch (e) {
            console.error('Delete page error:', e);
            this.showToast(`Error: ${e.message}`, 'error');
            await this.loadDatabase();
        } finally {
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    async deletePageFiles(pageId, pageData) {
        const filesToDelete = [`scripts/${pageId}/index.html`];
        Object.values(pageData?.scripts || {}).forEach(script => {
            filesToDelete.push(`scripts/${pageId}/raw/${script.filename || `${script.id}.lua`}`);
        });

        for (const path of [...new Set(filesToDelete)]) {
            const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/${path}`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10'
                }
            });

            if (res.status === 404) continue;
            if (!res.ok) {
                let detail = `HTTP ${res.status}`;
                try {
                    const body = await res.json();
                    if (body?.message) detail += `: ${body.message}`;
                } catch (_) {}
                throw new Error(`Cannot read ${path} — ${detail}`);
            }

            const fileData = await res.json();
            const deleteRes = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Delete page file: ${path}`,
                    sha: fileData.sha,
                    branch: CONFIG.branch
                })
            });

            if (!deleteRes.ok) {
                let detail = `HTTP ${deleteRes.status}`;
                try {
                    const body = await deleteRes.json();
                    if (body?.message) detail += `: ${body.message}`;
                } catch (_) {}
                throw new Error(`Cannot delete ${path} — ${detail}`);
            }
        }
    },

    async deleteObsoleteScriptFiles(pageId, oldPage, newPage) {
        const newFilenames = new Set(Object.values(newPage?.scripts || {}).map(s => s.filename || `${s.id}.lua`));
        const obsolete = Object.values(oldPage?.scripts || {}).filter(s => !newFilenames.has(s.filename || `${s.id}.lua`));

        for (const script of obsolete) {
            const path = `scripts/${pageId}/raw/${script.filename || `${script.id}.lua`}`;
            const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/${path}`;
            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10'
                }
            });
            if (res.status === 404) continue;
            if (!res.ok) continue;
            const fileData = await res.json();
            await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Remove obsolete script file: ${path}`,
                    sha: fileData.sha,
                    branch: CONFIG.branch
                })
            });
        }
    },

    async deleteBotLogic(botId) {
        if (this.actionInProgress) return;
        this.actionInProgress = true;
        
        try {
            if (typeof NProgress !== 'undefined') NProgress.start();
            if (this.scheduledTimers[botId]) {
                clearTimeout(this.scheduledTimers[botId]);
                delete this.scheduledTimers[botId];
            }
            
            if (this.db.bots[botId]) {
                this.db.bots[botId].cancelled = true;
                this.db.bots[botId].status = 'cancelled';
                
                const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `token ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Cancel bot: ${this.db.bots[botId].title}`,
                        content: utils.safeBtoa(JSON.stringify(this.db, null, 2)),
                        sha: this.dbSha
                    })
                });
                
                if (dbRes.ok) {
                    const newDbData = await dbRes.json();
                    this.dbSha = newDbData.content.sha;
                    this.showToast('Bot cancelled', 'success');
                    await this.loadDatabase();
                } else throw new Error('Failed to update database');
            }
        } catch(e) {
            this.showToast(`Error: ${e.message}`, 'error');
            await this.loadDatabase();
        } finally {
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    resetEditor() {
        this.destroyCodeMirrorEditors();
        this.currentEditingId = null;
        this.originalTitle = null;
        this.originalPageId = null;
        const heading = document.getElementById('editor-heading');
        if (heading) heading.textContent = 'Create New Page';
        const title = document.getElementById('edit-page-title');
        if (title) title.value = '';
        const visibility = document.getElementById('edit-visibility');
        if (visibility) visibility.value = 'PUBLIC';
        const desc = document.getElementById('edit-desc');
        if (desc) desc.value = '';
        const tags = document.getElementById('edit-tags');
        if (tags) tags.value = '';
        this.renderTagPreview('');

        const builder = document.getElementById('script-builder');
        if (builder) builder.innerHTML = '';
        this.scriptDraftCounter = 0;
        this.addScriptBlock({ name: '', code: '' });

        const saveBtn = document.querySelector('.editor-footer .btn-primary');
        if (saveBtn) saveBtn.textContent = 'Publish Page';
        this.updateScriptCountLabel();
    },

    createScriptEntryId() {
        this.scriptDraftCounter += 1;
        return `draft-${Date.now()}-${this.scriptDraftCounter}`;
    },

    addScriptBlock(data = {}) {
        const builder = document.getElementById('script-builder');
        if (!builder) return;
        const entryId = data.id || this.createScriptEntryId();
        const safeEntryId = utils.escapeHtml(entryId);
        const safeName = utils.escapeHtml(data.name || '');
        builder.insertAdjacentHTML('beforeend', `
            <section class="script-entry" data-entry-id="${safeEntryId}">
                <div class="script-entry-header">
                    <div class="script-entry-index">
                        <span class="script-index-number">${builder.children.length + 1}</span>
                        <div>
                            <span class="section-kicker">Script</span>
                            <strong>Named source block</strong>
                        </div>
                    </div>
                    <div class="script-entry-actions">
                        <span class="script-size-label">${(data.code || '').length.toLocaleString()} characters</span>
                        <button type="button" class="icon-btn" title="Remove script" aria-label="Remove script" onclick="app.removeScriptBlock('${safeEntryId}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <path d="M5 7h14M10 11v6M14 11v6M9 7V4h6v3M7 7l1 13h8l1-13"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="script-entry-name-row">
                    <div class="form-group">
                        <label>Script Name</label>
                        <input type="text" class="input-field script-name-input" placeholder="e.g. ESP System" value="${safeName}" maxlength="100">
                        <small class="field-hint">This name identifies the script inside the page.</small>
                    </div>
                    <div class="script-file-preview">
                        <span>Raw file</span>
                        <code class="script-filename-preview">${utils.escapeHtml((utils.sanitizeTitle(data.name || 'script') || 'script') + '.lua')}</code>
                    </div>
                </div>
                <div class="form-group script-code-group">
                    <div class="script-code-label-row">
                        <label>Lua Source</label>
                        <span>Lua</span>
                    </div>
                    <textarea class="input-field code-textarea script-code-textarea" aria-label="Lua source">${utils.escapeHtml(data.code || '')}</textarea>
                </div>
            </section>
        `);

        const nameInput = builder.lastElementChild.querySelector('.script-name-input');
        nameInput.addEventListener('input', () => {
            const preview = builder.lastElementChild?.querySelector('.script-filename-preview');
            if (preview) preview.textContent = `${utils.sanitizeTitle(nameInput.value.trim()) || 'script'}.lua`;
        });

        setTimeout(() => this.initCodeMirror(), 20);
        this.updateScriptCountLabel();
    },

    removeScriptBlock(entryId) {
        const builder = document.getElementById('script-builder');
        const entry = builder?.querySelector(`.script-entry[data-entry-id="${CSS.escape(entryId)}"]`);
        if (!builder || !entry) return;
        if (builder.children.length <= 1) {
            this.showToast('A page must contain at least one script.', 'error');
            return;
        }
        const editor = this.cmEditors[entryId];
        if (editor) {
            try { editor.toTextArea(); } catch (_) {}
            delete this.cmEditors[entryId];
        }
        entry.remove();
        this.renumberScriptEntries();
        this.updateScriptCountLabel();
    },

    duplicateScriptBlock(entryId) {
        const entry = document.querySelector(`.script-entry[data-entry-id="${CSS.escape(entryId)}"]`);
        if (!entry) return;
        const name = entry.querySelector('.script-name-input')?.value || '';
        const editor = this.cmEditors[entryId];
        const code = editor ? editor.getValue() : (entry.querySelector('.script-code-textarea')?.value || '');
        this.addScriptBlock({ name: `${name} Copy`, code });
    },

    renumberScriptEntries() {
        document.querySelectorAll('#script-builder .script-entry').forEach((entry, index) => {
            const badge = entry.querySelector('.script-index-number');
            if (badge) badge.textContent = index + 1;
        });
    },

    updateScriptCountLabel() {
        const count = document.querySelectorAll('#script-builder .script-entry').length;
        const label = document.getElementById('script-count-label');
        if (label) label.textContent = `${count} ${count === 1 ? 'script' : 'scripts'}`;
    },

    collectPageScripts() {
        return [...document.querySelectorAll('#script-builder .script-entry')].map(entry => {
            const entryId = entry.dataset.entryId;
            const name = entry.querySelector('.script-name-input')?.value.trim() || '';
            const editor = this.cmEditors[entryId];
            const code = editor ? editor.getValue() : (entry.querySelector('.script-code-textarea')?.value || '');
            return {
                entryId,
                name,
                code
            };
        });
    },

    async populateEditor(pageId) {
        if (!this.currentUser || !this.db?.pages?.[pageId]) return;
        const page = this.db.pages[pageId];

        this.destroyCodeMirrorEditors();
        this.currentEditingId = pageId;
        this.originalTitle = page.title;
        this.originalPageId = pageId;

        document.getElementById('editor-heading').textContent = `Edit: ${page.title}`;
        document.getElementById('edit-page-title').value = page.displayTitle || page.title;
        document.getElementById('edit-visibility').value = page.visibility || 'PUBLIC';
        document.getElementById('edit-desc').value = page.description || '';
        const tagsInput = document.getElementById('edit-tags');
        if (tagsInput) tagsInput.value = this.normalizeTags(page.tags || []).join(', ');
        this.renderTagPreview(tagsInput?.value || '');

        const builder = document.getElementById('script-builder');
        if (builder) builder.innerHTML = '';
        this.scriptDraftCounter = 0;

        const scripts = Object.values(page.scripts || {});
        if (!scripts.length) {
            this.addScriptBlock({ name: '', code: '' });
        } else {
            scripts.forEach(script => this.addScriptBlock({
                id: script.id,
                name: script.displayName || script.name,
                code: ''
            }));
        }

        this.switchAdminTab('edit', { preserveEditor: true });

        if (typeof NProgress !== 'undefined') NProgress.start();
        try {
            await Promise.all(Object.values(page.scripts || {}).map(async script => {
                const rawUrl = `${CONFIG.pagesBaseUrl()}scripts/${encodeURIComponent(page.id)}/raw/${encodeURIComponent(script.filename || `${script.id}.lua`)}`;
                const res = await fetch(rawUrl, { cache: 'no-store' });
                if (!res.ok) return;
                const code = await res.text();
                const editor = this.cmEditors[script.id];
                if (editor) editor.setValue(code);
                else {
                    const entry = document.querySelector(`.script-entry[data-entry-id="${CSS.escape(script.id)}"]`);
                    const textarea = entry?.querySelector('.script-code-textarea');
                    if (textarea) textarea.value = code;
                }
            }));
        } catch (e) {
            console.error('Load error:', e);
            this.showToast('Some script sources could not be loaded.', 'warning');
        } finally {
            if (typeof NProgress !== 'undefined') NProgress.done();
            this.updateScriptCountLabel();
            setTimeout(() => this.initCodeMirror(), 50);
        }

        const saveBtn = document.querySelector('.editor-footer .btn-primary');
        if (saveBtn) saveBtn.textContent = 'Update Page';
    },

    async populateBotEditor(botId) {
        if (!this.currentUser || !this.db || !this.db.bots[botId]) return;
        const bot = this.db.bots[botId];
        
        if (bot.sent) {
            this.showToast('Cannot edit sent posts', 'error');
            this.switchAdminTab('bots');
            return;
        }
        
        this.currentBotId = botId;
        this.switchAdminTab('create-bot');
        
        document.getElementById('bot-editor-heading').textContent = `Edit Bot: ${bot.title}`;
        document.getElementById('bot-title').value = bot.title;
        document.getElementById('bot-message').value = bot.message;
        document.getElementById('bot-schedule').checked = bot.scheduled || false;
        
        if (bot.scheduledTime) {
            const localDateTime = new Date(bot.scheduledTime).toISOString().slice(0, 16);
            document.getElementById('bot-schedule-time').value = localDateTime;
        }
        
        document.getElementById('bot-timezone').value = bot.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const saveBtn = document.querySelector('.bot-actions .btn:last-child');
        if (saveBtn) saveBtn.textContent = bot.scheduled ? 'Update Schedule' : 'Send Now';
        this.toggleScheduleFields();
    },

    async getRemoteDatabaseSha() {
        const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json?ref=${encodeURIComponent(CONFIG.branch)}&t=${CONFIG.cacheBuster()}`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2026-03-10'
            },
            cache: 'no-store'
        });
        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const body = await res.json();
                if (body?.message) detail += `: ${body.message}`;
            } catch (_) {}
            throw new Error(`Failed to access remote database — ${detail}`);
        }
        const file = await res.json();
        return file.sha;
    },

    async savePage() {
        if (!this.currentUser || !this.db) {
            this.showToast('Please log in first.', 'error');
            return;
        }
        if (this.actionInProgress) return;

        this.actionInProgress = true;
        const titleInput = document.getElementById('edit-page-title');
        const visibilityInput = document.getElementById('edit-visibility');
        const descInput = document.getElementById('edit-desc');
        const tagsInput = document.getElementById('edit-tags');
        const saveBtn = document.querySelector('.editor-footer .btn-primary');

        const title = titleInput?.value.trim() || '';
        const visibility = visibilityInput?.value || 'PUBLIC';
        const description = descInput?.value.trim() || '';
        const tags = this.normalizeTags(tagsInput?.value || '');
        const scriptEntries = this.collectPageScripts();
        const originalBtnText = saveBtn?.textContent || 'Publish Page';

        const titleError = utils.validateTitle(title);
        if (titleError) {
            this.showToast(titleError, 'error');
            this.actionInProgress = false;
            return;
        }
        if (!scriptEntries.length) {
            this.showToast('Add at least one script to the page.', 'error');
            this.actionInProgress = false;
            return;
        }

        const usedIds = new Set();
        for (const entry of scriptEntries) {
            if (!entry.name) {
                this.showToast('Every script needs a Script Name.', 'error');
                this.actionInProgress = false;
                return;
            }
            if (entry.name.length > 100) {
                this.showToast('Script names must be less than 100 characters.', 'error');
                this.actionInProgress = false;
                return;
            }
            const codeError = utils.validateCode(entry.code);
            if (codeError) {
                this.showToast(`${entry.name}: ${codeError}`, 'error');
                this.actionInProgress = false;
                return;
            }
            const scriptId = utils.sanitizeTitle(entry.name);
            if (!scriptId) {
                this.showToast(`"${entry.name}" cannot be used as a file name.`, 'error');
                this.actionInProgress = false;
                return;
            }
            if (usedIds.has(scriptId)) {
                this.showToast(`Script names must be unique on this page: "${entry.name}".`, 'error');
                this.actionInProgress = false;
                return;
            }
            usedIds.add(scriptId);
        }

        const isEditing = !!this.currentEditingId;
        const pageId = utils.sanitizeTitle(title);
        const oldPage = isEditing ? this.db.pages[this.currentEditingId] : null;
        if (!pageId) {
            this.showToast('Page Title cannot be converted into a valid URL.', 'error');
            this.actionInProgress = false;
            return;
        }
        if (!isEditing && this.db.pages[pageId]) {
            this.showToast('A page with that title already exists.', 'error');
            this.actionInProgress = false;
            return;
        }
        if (isEditing && pageId !== this.currentEditingId && this.db.pages[pageId]) {
            this.showToast('Another page already uses that title.', 'error');
            this.actionInProgress = false;
            return;
        }

        const created = oldPage?.created || new Date().toISOString();
        const now = new Date().toISOString();
        const scripts = {};
        scriptEntries.forEach(entry => {
            const scriptId = utils.sanitizeTitle(entry.name);
            const oldScript = oldPage?.scripts?.[entry.entryId] || oldPage?.scripts?.[scriptId];
            scripts[scriptId] = {
                id: scriptId,
                name: entry.name,
                displayName: entry.name,
                filename: `${scriptId}.lua`,
                size: entry.code.length,
                created: oldScript?.created || now,
                updated: now,
                previousId: oldScript && oldScript.id !== scriptId ? oldScript.id : undefined
            };
        });

        const pageData = {
            id: pageId,
            title,
            displayTitle: title,
            visibility,
            description,
            tags,
            created,
            updated: now,
            scripts
        };
        pageData.filename = 'index.html';

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = isEditing ? 'Updating Page...' : 'Publishing Page...';
        }
        if (typeof NProgress !== 'undefined') NProgress.start();

        try {
            await this.createPageFiles(pageId, pageData, scriptEntries);

            this.dbSha = await this.ensureDatabaseSha();
            const nextDb = this.normalizeDatabase(JSON.parse(JSON.stringify(this.db)));
            if (isEditing) delete nextDb.pages[this.currentEditingId];
            nextDb.pages[pageId] = pageData;
            nextDb.bots = nextDb.bots || {};

            const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `${isEditing ? 'Update' : 'Add'} page ${title}`,
                    content: utils.safeBtoa(JSON.stringify(nextDb, null, 2)),
                    sha: this.dbSha,
                    branch: CONFIG.branch
                })
            });

            if (!dbRes.ok) {
                let detail = `HTTP ${dbRes.status}`;
                try {
                    const body = await dbRes.json();
                    if (body?.message) detail += `: ${body.message}`;
                } catch (_) {}
                throw new Error(`Failed to update database — ${detail}`);
            }

            const newDbData = await dbRes.json();
            this.db = nextDb;
            this.dbSha = newDbData.content.sha;

            try {
                localStorage.setItem('cihuyakz_local_db_v2', JSON.stringify(this.db));
            } catch (storageError) {
                console.warn('Could not persist local database cache:', storageError);
            }

            // Clean up files that are no longer referenced.
            if (isEditing && this.currentEditingId === pageId && oldPage) {
                await this.deleteObsoleteScriptFiles(pageId, oldPage, pageData);
            } else if (isEditing && this.currentEditingId !== pageId && oldPage) {
                try { await this.deletePageFiles(this.currentEditingId, oldPage); } catch (cleanupError) {
                    console.warn('Old page cleanup failed:', cleanupError);
                }
            }

            this.currentEditingId = pageId;
            this.originalTitle = title;
            this.originalPageId = pageId;

            document.getElementById('editor-heading').textContent = `Edit: ${title}`;
            if (saveBtn) saveBtn.textContent = 'Update Page';

            this.showToast(`${isEditing ? 'Page updated' : 'Page published'} successfully.`, 'success');
            this.renderList();
            this.renderAdminList();
            this.renderAdminStats();
        } catch (e) {
            console.error('Save page error:', e);
            this.showToast(`Error: ${e.message}`, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = isEditing ? 'Update Page' : originalBtnText;
            }
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    // Backward-compatible alias for integrations using the old method name.
    async saveScript() {
        return this.savePage();
    },

    async createPageFiles(pageId, pageData, scriptEntries) {
        const scriptDir = `scripts/${pageId}`;
        const indexPath = `${scriptDir}/index.html`;
        const scriptManifest = Object.values(pageData.scripts || {}).map(script => ({
            id: script.id,
            name: script.name,
            filename: script.filename
        }));
        const manifestJson = JSON.stringify(scriptManifest).replace(/</g, '\\u003c');
        const pageTitleJson = JSON.stringify(pageData.title).replace(/</g, '\\u003c');
        const descriptionJson = JSON.stringify(pageData.description || '').replace(/</g, '\\u003c');
        const pageTagsJson = JSON.stringify(this.normalizeTags(pageData.tags || [])).replace(/</g, '\\u003c');

        const scriptViewerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${utils.escapeHtml(pageData.title)} - CihuyAkz Studio Lite</title>
    <link rel="icon" type="image/png" href="../../assets/favicon.ico">
    <link rel="stylesheet" href="../../style.css?v=20260926-tags-search-v1">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { background: #100306; }
        .page-shell { max-width: 1440px; margin: 96px auto 48px; padding: 0 28px; }
        .page-hero { padding: 30px 0 22px; }
        .page-hero .eyebrow { color:#ff8f8f; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.16em; }
        .page-hero h1 { margin:8px 0 8px; font-size: clamp(28px,4vw,44px); letter-spacing:-1.5px; }
        .page-hero p { max-width: 760px; color:#d4aeb2; font-size:14px; }
        .page-hero-tags { display:flex; flex-wrap:wrap; gap:7px; margin-top:14px; }
        .page-hero-tag { display:inline-flex; align-items:center; padding:5px 9px; border-radius:999px; border:1px solid rgba(255,84,84,.20); background:rgba(255,59,59,.08); color:#ffb3b3; font-size:11px; font-weight:700; }
        .page-layout { display:grid; grid-template-columns:280px minmax(0,1fr); gap:18px; align-items:start; }
        .script-nav { position:sticky; top:88px; padding:12px; border:1px solid rgba(255,84,84,.18); border-radius:18px; background:rgba(25,5,10,.88); box-shadow:0 18px 45px rgba(72,0,14,.22); }
        .script-nav-title { padding:10px 10px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:#c99ca3; font-weight:800; }
        .script-nav button { display:flex; align-items:center; width:100%; gap:10px; border:1px solid transparent; background:transparent; color:#e6cfd1; padding:12px 11px; border-radius:12px; text-align:left; cursor:pointer; font-weight:600; }
        .script-nav button:hover { background:rgba(255,59,59,.08); color:#fff; }
        .script-nav button.active { border-color:rgba(255,84,84,.25); background:linear-gradient(90deg,rgba(255,59,59,.16),rgba(155,18,55,.08)); color:#fff; }
        .script-nav .nav-index { width:24px; height:24px; border-radius:7px; display:grid; place-items:center; background:rgba(255,255,255,.06); color:#ff8f8f; font-size:11px; flex:0 0 24px; }
        .viewer-card { min-width:0; border:1px solid rgba(255,84,84,.18); border-radius:18px; overflow:hidden; background:rgba(17,4,8,.88); box-shadow:0 18px 45px rgba(72,0,14,.22); }
        .viewer-header { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:16px 18px; border-bottom:1px solid rgba(255,84,84,.16); background:linear-gradient(90deg,rgba(62,7,15,.92),rgba(22,4,8,.96)); }
        .viewer-file { min-width:0; }
        .viewer-file strong { display:block; font-size:15px; color:#fff; }
        .viewer-file span { display:block; margin-top:3px; color:#b78c92; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .viewer-actions { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .viewer-code { margin:0; min-height:60vh; max-height:75vh; overflow:auto; padding:20px; background:#120307; }
        .viewer-code code { font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; }
        .viewer-empty { padding:60px 24px; text-align:center; color:#b78c92; }
        @media (max-width: 850px) {
            .page-layout { grid-template-columns:1fr; }
            .script-nav { position:static; display:flex; gap:6px; overflow:auto; }
            .script-nav-title { display:none; }
            .script-nav button { min-width:170px; }
            .viewer-header { align-items:flex-start; flex-direction:column; }
            .viewer-actions { justify-content:flex-start; }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-content">
            <div class="nav-left">
                <a href="../../index.html" class="brand" style="text-decoration:none;color:inherit;">
                    <img src="../../assets/cihuyakz-icon.png" class="nav-icon" alt="CihuyAkz Studio Lite">
                    <span class="nav-title">CihuyAkz Studio Lite</span>
                </a>
            </div>
            <div class="nav-right">
                <a href="../../index.html" class="btn btn-secondary btn-sm">Back to Library</a>
            </div>
        </div>
    </nav>

    <main class="page-shell">
        <header class="page-hero">
            <span class="eyebrow">Script Page</span>
            <h1 id="page-title"></h1>
            <p id="page-description"></p>
            <div id="page-tags" class="page-hero-tags" aria-label="Page tags"></div>
        </header>

        <div class="page-layout">
            <aside class="script-nav">
                <div class="script-nav-title">Scripts on this page</div>
                <div id="script-nav-items"></div>
            </aside>

            <section class="viewer-card">
                <div class="viewer-header">
                    <div class="viewer-file">
                        <strong id="active-script-name">Loading...</strong>
                        <span id="active-script-file"></span>
                    </div>
                    <div class="viewer-actions">
                        <button class="btn btn-sm" id="copy-button" type="button">Copy</button>
                        <button class="btn btn-sm" id="download-button" type="button">Download</button>
                        <a class="btn btn-secondary btn-sm" id="raw-button" target="_blank" rel="noopener">Raw</a>
                    </div>
                </div>
                <pre class="viewer-code"><code id="code-display" class="language-lua">Loading...</code></pre>
            </section>
        </div>
    </main>

    <script>
        const pageTitle = ${pageTitleJson};
        const pageDescription = ${descriptionJson};
        const pageTags = ${pageTagsJson};
        const scripts = ${manifestJson};

        let activeScript = scripts[0] || null;

        document.getElementById('page-title').textContent = pageTitle;
        document.getElementById('page-description').textContent = pageDescription;
        const pageTagsEl = document.getElementById('page-tags');
        pageTags.forEach(function(tag) {
            const tagEl = document.createElement('span');
            tagEl.className = 'page-hero-tag';
            tagEl.textContent = '#' + tag;
            pageTagsEl.appendChild(tagEl);
        });

        function renderScriptNav() {
            const nav = document.getElementById('script-nav-items');
            nav.innerHTML = scripts.map((script, index) => \`
                <button type="button" class="\${activeScript && activeScript.id === script.id ? 'active' : ''}" data-script-id="\${script.id}">
                    <span class="nav-index">\${String(index + 1).padStart(2,'0')}</span>
                    <span>\${script.name}</span>
                </button>
            \`).join('');
            nav.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', () => {
                    const script = scripts.find(item => item.id === button.dataset.scriptId);
                    if (script) selectScript(script);
                });
            });
        }

        async function selectScript(script) {
            activeScript = script;
            renderScriptNav();
            const name = document.getElementById('active-script-name');
            const file = document.getElementById('active-script-file');
            const code = document.getElementById('code-display');
            const rawButton = document.getElementById('raw-button');
            name.textContent = script.name;
            file.textContent = 'raw/' + script.filename;
            rawButton.href = 'raw/' + encodeURIComponent(script.filename);
            code.textContent = 'Loading...';

            try {
                const res = await fetch('raw/' + encodeURIComponent(script.filename), { cache: 'no-store' });
                if (!res.ok) throw new Error('Failed to load script');
                code.textContent = await res.text();
                if (window.Prism) Prism.highlightElement(code);
            } catch (error) {
                code.textContent = '-- Unable to load this script source.';
            }
        }

        document.getElementById('copy-button').addEventListener('click', async () => {
            const code = document.getElementById('code-display').textContent;
            try {
                await navigator.clipboard.writeText(code);
                const button = document.getElementById('copy-button');
                const original = button.textContent;
                button.textContent = 'Copied';
                setTimeout(() => button.textContent = original, 1500);
            } catch (_) {}
        });

        document.getElementById('download-button').addEventListener('click', () => {
            if (!activeScript) return;
            const code = document.getElementById('code-display').textContent;
            const element = document.createElement('a');
            element.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(code);
            element.download = activeScript.filename;
            document.body.appendChild(element);
            element.click();
            element.remove();
        });

        renderScriptNav();
        if (activeScript) selectScript(activeScript);
        else document.getElementById('code-display').textContent = '-- No scripts published on this page.';
    </script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-lua.min.js"></script>
</body>
</html>`;

        await this.createOrUpdateFile(indexPath, scriptViewerHTML, 'text/html');

        for (const entry of scriptEntries) {
            const scriptId = utils.sanitizeTitle(entry.name);
            const rawPath = `${scriptDir}/raw/${scriptId}.lua`;
            await this.createOrUpdateFile(rawPath, entry.code, 'text/plain');
        }
    },

    async createOrUpdateFile(path, content, contentType) {
        const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/${path}`;
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${this.token}` } });
        
        let sha = null;
        if (getRes.ok) {
            const existingFile = await getRes.json();
            sha = existingFile.sha;
        }
        
        const body = {
            message: `Create/update ${path}`,
            content: utils.safeBtoa(content),
            branch: CONFIG.branch
        };
        if (sha) body.sha = sha;
        
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (!putRes.ok) {
            let detail = `HTTP ${putRes.status}`;
            try {
                const errorBody = await putRes.json();
                if (errorBody?.message) detail += `: ${errorBody.message}`;
                if (errorBody?.documentation_url) detail += ` (${errorBody.documentation_url})`;
            } catch (_) {}
            throw new Error(`Failed to create/update file ${path} — ${detail}`);
        }
    },

    handleRouting() {
        const hash = location.hash.slice(1);
        document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
        window.scrollTo(0, 0);
        
        if (hash === 'admin') {
            if (!this.currentUser) {
                this.toggleLoginModal();
                location.hash = '';
                return;
            }
            document.getElementById('view-admin').style.display = 'block';
            this.switchAdminTab('list');
        } else {
            document.getElementById('view-home').style.display = 'block';
        }
    }
};

function navigate(path) {
    if (path === 'admin' && !app.currentUser) {
        app.toggleLoginModal();
        return;
    }
    location.hash = path;
}

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    if (typeof NProgress !== 'undefined') {
        NProgress.configure({ showSpinner: false, speed: 400, trickleSpeed: 200 });
    }
});

window.app = app;
window.navigate = navigate;
