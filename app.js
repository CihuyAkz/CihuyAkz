const CONFIG = {
    // GitHub repository used for publishing. Only this GitHub account may log in.
    repoOwner: 'CihuyAkz',
    repo: 'CihuyAkz',
    allowedUser: 'CihuyAkz',
    ownerLogin: 'CihuyAkz',
    branch: 'main',
    cacheBuster: () => Date.now(),

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
    originalScriptId: null,
    currentBotId: null,
    isLoading: false,
    searchQuery: '',
    adminSearchQuery: '',
    pageEditors: {},
    pageEditorCounter: 0,
    currentEditingPageTitle: null,
    originalPageId: null,
    scheduledTimers: {},
    
    async init() {
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
                    const activeTab = document.querySelector('.tab-btn.active')?.textContent?.toLowerCase() || '';
                    if (activeTab.includes('add new') || activeTab.includes('manage')) {
                        if (document.getElementById('admin-tab-editor')?.style.display !== 'none') this.savePage();
                    } else if (activeTab.includes('bots') || activeTab.includes('create bot')) {
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
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.debouncedRender();
            });
        }
    },
    
    initCodeMirror() {
        if (window.cmEditor) return;
        const textarea = document.getElementById('edit-code');
        if (textarea && typeof CodeMirror !== 'undefined') {
            window.cmEditor = CodeMirror.fromTextArea(textarea, {
                mode: 'lua',
                theme: 'monokai',
                lineNumbers: true,
                lineWrapping: true,
                matchBrackets: true,
                indentUnit: 4
            });
        }
    },

    initPageCodeEditor(editorId, textarea) {
        if (!textarea || typeof CodeMirror === 'undefined') return;
        if (this.pageEditors[editorId]) {
            this.pageEditors[editorId].refresh();
            return;
        }
        const cm = CodeMirror.fromTextArea(textarea, {
            mode: 'lua',
            theme: 'monokai',
            lineNumbers: true,
            lineWrapping: true,
            matchBrackets: true,
            indentUnit: 4,
            viewportMargin: 40
        });
        cm.on('change', () => this.updateScriptEditorCount());
        this.pageEditors[editorId] = cm;
        requestAnimationFrame(() => cm.refresh());
    },

    destroyPageEditors() {
        Object.values(this.pageEditors).forEach(editor => {
            try { editor.toTextArea(); } catch (_) {}
        });
        this.pageEditors = {};
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
        if (typeof Toastify === 'undefined') {
            alert(message);
            return;
        }

        const toast = Toastify({
            text: message,
            duration: 3500,
            gravity: 'top',
            position: 'right',
            close: true,
            stopOnFocus: false,
            style: {
                background: type === 'success'
                    ? 'linear-gradient(135deg, #0f766e, #14b8a6)'
                    : type === 'error'
                        ? 'linear-gradient(135deg, #991b1b, #ef4444)'
                        : 'linear-gradient(135deg, #92400e, #f59e0b)'
            }
        });
        toast.showToast();
        requestAnimationFrame(() => {
            const el = toast.toastElement;
            if (!el) return;
            el.style.cursor = 'pointer';
            el.setAttribute('role', 'status');
            el.addEventListener('pointerup', () => toast.hideToast(), { once: true });
        });
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
                throw new Error(`Akses hanya untuk akun GitHub ${CONFIG.allowedUser}. Token ini milik ${user.login}.`);
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
                this.db = JSON.parse(localSaved);
                this.normalizeDatabase();
                this.renderList();
                this.renderAdminList();
                return;
            }

            const localRes = await fetch(`database.json?t=${CONFIG.cacheBuster()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!localRes.ok) throw new Error(`Failed to load bundled database: ${localRes.status}`);

            this.db = await localRes.json();
            this.normalizeDatabase();
            try {
                localStorage.setItem('cihuyakz_local_db_v2', JSON.stringify(this.db));
            } catch (storageError) {
                console.warn('Local database cache unavailable:', storageError);
            }

            Object.keys(this.scheduledTimers).forEach(id => clearTimeout(this.scheduledTimers[id]));
            this.scheduledTimers = {};
            Object.entries(this.db.bots).forEach(([botId, bot]) => {
                if (bot.scheduled && bot.scheduledTime && !bot.sent && !bot.cancelled) {
                    this.scheduleBotTimer(botId, bot);
                }
            });

            this.renderList();
            this.renderAdminList();
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

    normalizeDatabase() {
        if (!this.db || typeof this.db !== 'object') this.db = {};
        if (!this.db.pages || typeof this.db.pages !== 'object') this.db.pages = {};
        if (!this.db.scripts || typeof this.db.scripts !== 'object') this.db.scripts = {};
        if (!this.db.bots || typeof this.db.bots !== 'object') this.db.bots = {};

        // Backward compatibility: convert legacy one-script records into one-script pages.
        for (const [legacyTitle, legacy] of Object.entries(this.db.scripts)) {
            const pageTitle = legacy?.title || legacyTitle;
            if (this.db.pages[pageTitle]) continue;
            const pageId = utils.sanitizeTitle(pageTitle);
            const legacyFilename = legacy?.filename || `${pageId}.lua`;
            this.db.pages[pageTitle] = {
                id: pageId,
                title: pageTitle,
                displayTitle: pageTitle,
                visibility: legacy?.visibility || 'PUBLIC',
                description: legacy?.description || '',
                scripts: [{
                    id: utils.sanitizeTitle(legacyTitle),
                    name: legacy?.displayTitle || legacyTitle,
                    filename: legacyFilename,
                    size: legacy?.size || 0,
                    created: legacy?.created || new Date().toISOString(),
                    updated: legacy?.updated || legacy?.created || new Date().toISOString()
                }],
                created: legacy?.created || new Date().toISOString(),
                updated: legacy?.updated || legacy?.created || new Date().toISOString(),
                legacy: true
            };
        }

        for (const [title, page] of Object.entries(this.db.pages)) {
            page.id = page.id || utils.sanitizeTitle(title);
            page.title = page.title || title;
            page.displayTitle = page.displayTitle || page.title;
            page.visibility = page.visibility || 'PUBLIC';
            page.description = page.description || '';
            page.scripts = Array.isArray(page.scripts) ? page.scripts : [];
        }
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

    renderList() {
        const list = document.getElementById('script-list');
        if (!list || !this.db) return;
        this.normalizeDatabase();

        const pages = Object.entries(this.db.pages || {}).map(([title, data]) => ({ title, ...data }));
        const filtered = this.filterLogic(pages);
        const sorted = this.sortLogic(filtered);

        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-state">
                <div class="empty-state-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h4l2 2h5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"></path></svg></div>
                <h2>No pages found</h2>
                <p>Try adjusting your search or filter</p>
            </div>`;
            return;
        }

        list.innerHTML = sorted.map(page => {
            const pageId = page.id || utils.sanitizeTitle(page.title);
            const scriptsCount = Array.isArray(page.scripts) ? page.scripts.length : 0;
            const scriptNames = (page.scripts || []).slice(0, 3).map(script => utils.escapeHtml(script.name || '')).join(' · ');
            const pagePath = page.legacy ? `scripts/${encodeURIComponent(pageId)}/index.html` : `pages/${encodeURIComponent(pageId)}/index.html`;
            return `<article class="script-card page-card" onclick="window.location.href='${pagePath}'">
                <div class="card-glow"></div>
                <div class="card-content">
                    <div class="card-header-section">
                        <div>
                            <span class="page-kicker">PAGE</span>
                            <h3 class="script-title">${utils.escapeHtml(page.title)}</h3>
                        </div>
                        ${page.visibility !== 'PUBLIC' ? `<span class="badge badge-${page.visibility.toLowerCase()}">${page.visibility}</span>` : ''}
                    </div>
                    ${page.description ? `<p class="page-description">${utils.escapeHtml(page.description.substring(0, 170))}${page.description.length > 170 ? '...' : ''}</p>` : ''}
                    <div class="page-script-preview">${scriptNames || 'No script items yet'}</div>
                    <div class="card-meta">
                        <span>${scriptsCount} script${scriptsCount === 1 ? '' : 's'}</span>
                        <span class="page-open">Open <span>→</span></span>
                    </div>
                </div>
            </article>`;
        }).join('');
    },

    filterLogic(items) {
        const query = this.searchQuery.toLowerCase();
        return items.filter(item => {
            const pageText = `${item.title || ''} ${item.description || ''}`.toLowerCase();
            const scriptText = (item.scripts || []).map(s => s.name || '').join(' ').toLowerCase();
            if (query && !pageText.includes(query) && !scriptText.includes(query)) return false;
            if (item.visibility === 'PRIVATE' && !this.currentUser) return false;
            if (item.visibility === 'UNLISTED' && !this.currentUser) return false;
            if (this.currentFilter === 'private' && item.visibility !== 'PRIVATE') return false;
            if (this.currentFilter === 'public' && item.visibility !== 'PUBLIC') return false;
            if (this.currentFilter === 'unlisted' && item.visibility !== 'UNLISTED') return false;
            return true;
        });
    },

    sortLogic(items) {
        return items.sort((a, b) => {
            if (this.currentSort === 'newest') return new Date(b.created || 0) - new Date(a.created || 0);
            if (this.currentSort === 'oldest') return new Date(a.created || 0) - new Date(b.created || 0);
            if (this.currentSort === 'alpha') return (a.title || '').localeCompare(b.title || '');
            if (this.currentSort === 'updated') return new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0);
            return 0;
        });
    },

    filterCategory(cat, e) {
        if (e) {
            e.preventDefault();
            const target = e.currentTarget || e.target;
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            if (target?.classList?.contains('sidebar-link')) target.classList.add('active');
        }
        this.currentFilter = cat;
        this.renderList();
    },

    setSort(val) {
        this.currentSort = val;
        this.renderList();
    },

    setAdminSearch(value) {
        this.adminSearchQuery = (value || '').trim().toLowerCase();
        this.renderAdminList();
    },

    switchAdminTab(tab) {
        if (tab === 'admin' && !this.currentUser) {
            location.hash = '';
            return;
        }
        document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const activeKey = (tab === 'create-bot' || tab === 'create-edit') ? 'create' : tab;
        const activeTab = document.querySelector(`.tab-btn[data-admin-tab="${activeKey}"]`);

        if (tab === 'list') {
            document.getElementById('admin-tab-list').style.display = 'block';
            activeTab?.classList.add('active');
            this.renderAdminList();
        } else if (tab === 'bots') {
            document.getElementById('admin-tab-bots').style.display = 'block';
            activeTab?.classList.add('active');
            this.renderBotsList();
        } else if (tab === 'create-bot') {
            document.getElementById('admin-tab-bot-editor').style.display = 'block';
            activeTab?.classList.add('active');
            this.resetBotEditor();
        } else {
            document.getElementById('admin-tab-editor').style.display = 'block';
            activeTab?.classList.add('active');
            if (tab === 'create') this.resetEditor();
            setTimeout(() => {
                Object.values(this.pageEditors).forEach(editor => editor.refresh());
            }, 80);
        }
    },

    async renderAdminList() {
        if (!this.currentUser || !this.db) return;
        this.normalizeDatabase();
        const list = document.getElementById('admin-list');
        const pages = Object.entries(this.db.pages || {}).map(([title, data]) => ({ title, ...data }));
        const query = this.adminSearchQuery;
        const filtered = query ? pages.filter(page => {
            const haystack = `${page.title} ${page.description || ''} ${(page.scripts || []).map(s => s.name).join(' ')}`.toLowerCase();
            return haystack.includes(query);
        }) : pages;
        const sorted = filtered.sort((a, b) => new Date(b.updated || b.created || 0) - new Date(a.updated || a.created || 0));
        const botsCount = Object.keys(this.db.bots || {}).length;
        const totalScripts = pages.reduce((sum, page) => sum + (page.scripts || []).length, 0);
        document.getElementById('total-stats').textContent = `${pages.length} Pages · ${totalScripts} Scripts · ${botsCount} Bots`;
        const pageCountEl = document.getElementById('pages-count');
        const scriptCountEl = document.getElementById('scripts-count');
        if (pageCountEl) pageCountEl.textContent = pages.length;
        if (scriptCountEl) scriptCountEl.textContent = totalScripts;
        const publicPagesCountEl = document.getElementById('public-pages-count');
        if (publicPagesCountEl) publicPagesCountEl.textContent = pages.filter(page => page.visibility === 'PUBLIC').length;

        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-admin-state">
                <div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h4l2 2h5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"></path></svg></div>
                <p>${query ? 'Tidak ada page yang cocok dengan pencarian.' : 'Belum ada page. Klik “New Page” untuk membuat page pertama.'}</p>
            </div>`;
            return;
        }

        list.innerHTML = sorted.map(page => {
            const updated = page.updated ? new Date(page.updated).toLocaleDateString('id-ID') : new Date(page.created).toLocaleDateString('id-ID');
            const scriptsCount = (page.scripts || []).length;
            const pagePayload = encodeURIComponent(page.title);
            return `<div class="admin-item page-admin-item" data-page-title="${utils.escapeHtml(page.title)}" onclick="app.populateEditor(decodeURIComponent('${pagePayload}'))">
                <div class="admin-item-main">
                    <div class="admin-item-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h4l2 2h5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"></path></svg></div>
                    <div class="admin-item-left">
                        <strong>${utils.escapeHtml(page.title)}</strong>
                        <div class="admin-meta">
                            <span class="badge badge-sm badge-${(page.visibility || 'PUBLIC').toLowerCase()}">${page.visibility || 'PUBLIC'}</span>
                            <span class="script-count-pill">${scriptsCount} script${scriptsCount === 1 ? '' : 's'}</span>
                            <span class="text-muted">Updated ${updated}</span>
                        </div>
                    </div>
                </div>
                <div class="admin-item-actions">
                    <button class="icon-btn danger" title="Delete page" onclick="event.stopPropagation(); app.deletePageConfirmation(decodeURIComponent('${pagePayload}'))">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>
                    </button>
                    <span class="admin-open-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></span>
                </div>
            </div>`;
        }).join('');
    },


    renderBotsList() {
        if (!this.currentUser || !this.db) return;
        const list = document.getElementById('bots-list');
        const bots = Object.entries(this.db.bots || {}).map(([id, data]) => ({ id, ...data }));
        const sorted = bots.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
        
        if (sorted.length === 0) {
            list.innerHTML = `<div class="empty-admin-state"><p>No bots yet. Click "Create Bot" to add one.</p></div>`;
            return;
        }
        
        list.innerHTML = sorted.map(b => {
            let status = 'Pending', statusClass = 'status-pending', timeInfo = 'Pending';
            if (b.cancelled) { status = 'Cancelled'; statusClass = 'status-cancelled'; } 
            else if (b.sent) { status = 'Sent'; statusClass = 'status-sent'; timeInfo = `Sent: ${new Date(b.sentTime).toLocaleString()}`; } 
            else if (b.scheduled) { status = 'Scheduled'; statusClass = 'status-scheduled'; timeInfo = `Scheduled: ${utils.formatDisplayTime(b.scheduledTime, b.timezone)}`; }
            
            return `<div class="admin-item" data-bot-id="${b.id}" onclick="app.populateBotEditor('${b.id}')">
                <div class="admin-item-left">
                    <strong>${utils.escapeHtml(b.title)}</strong>
                    <div class="admin-meta">
                        <span class="bot-status ${statusClass}">${status}</span>
                        <span class="text-muted">${timeInfo}</span>
                    </div>
                </div>
                <div class="admin-item-right">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                </div>
                <div class="swipe-hint">Swipe to cancel</div>
            </div>`;
        }).join('');
        this.initSwipeToDelete();
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
                        const scriptTitle = item.getAttribute('data-script-title');
                        const botId = item.getAttribute('data-bot-id');
                        if (scriptTitle) this.deleteScriptConfirmation(scriptTitle);
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

    async deleteScriptConfirmation(scriptTitle) {
        if (!scriptTitle || !this.db.scripts[scriptTitle]) {
            this.showToast('Script not found', 'error');
            await this.loadDatabase();
            return;
        }

        let shouldDelete = false;
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Delete Script',
                text: `Are you sure you want to delete "${scriptTitle}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Delete',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#ef4444'
            });
            shouldDelete = result.isConfirmed;
        } else {
            shouldDelete = confirm(`Delete "${scriptTitle}"?`);
        }

        if (shouldDelete) await this.deleteScriptLogic(scriptTitle);
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

    async deleteScriptLogic(scriptTitle) {
        if (this.actionInProgress) return;
        this.actionInProgress = true;

        try {
            if (typeof NProgress !== 'undefined') NProgress.start();

            const script = this.db.scripts[scriptTitle];
            if (!script) throw new Error('Script not found');

            const scriptId = utils.sanitizeTitle(scriptTitle);

            // database.json may have been loaded from local cache, so always
            // fetch the latest remote SHA before updating it.
            this.dbSha = await this.getRemoteDatabaseSha();

            // Delete the generated files first. If one fails, stop before
            // changing database.json so the database does not lie about files.
            await this.deleteScriptFiles(scriptId, script.filename);

            const nextDb = JSON.parse(JSON.stringify(this.db));
            delete nextDb.scripts[scriptTitle];

            const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Remove ${scriptTitle}`,
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

            this.showToast('Script deleted', 'success');
            await this.loadDatabase();

        } catch (e) {
            console.error('Delete error:', e);
            this.showToast(`Error: ${e.message}`, 'error');
            await this.loadDatabase();
        } finally {
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    async deleteScriptFiles(scriptId, filename) {
        const filesToDelete = [
            `scripts/${scriptId}/index.html`,
            `scripts/${scriptId}/raw/${filename}`
        ];

        for (const path of filesToDelete) {
            const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/${path}`;

            const res = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2026-03-10'
                }
            });

            // Missing file is harmless.
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
                    message: `Delete script file: ${path}`,
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
        this.currentEditingPageTitle = null;
        this.originalTitle = null;
        this.originalPageId = null;
        this.destroyPageEditors();
        const heading = document.getElementById('editor-heading');
        const saveBtn = document.querySelector('#admin-tab-editor .editor-actions .btn:last-child');
        if (heading) heading.textContent = 'Create New Page';
        if (saveBtn) saveBtn.textContent = 'Publish Page';
        const status = document.getElementById('page-editor-status');
        if (status) status.textContent = 'Draft';
        const title = document.getElementById('edit-title');
        const visibility = document.getElementById('edit-visibility');
        const desc = document.getElementById('edit-desc');
        if (title) title.value = '';
        if (visibility) visibility.value = 'PUBLIC';
        if (desc) desc.value = '';
        const list = document.getElementById('script-editor-list');
        if (list) list.innerHTML = '';
        this.addScriptEditor();
    },

    updateScriptEditorCount() {
        const list = document.getElementById('script-editor-list');
        const countEl = document.getElementById('script-editor-count');
        const count = list ? list.querySelectorAll('.script-editor-card').length : 0;
        if (countEl) countEl.textContent = `${count} script${count === 1 ? '' : 's'}`;
    },

    addScriptEditor(script = null, code = '') {
        const list = document.getElementById('script-editor-list');
        if (!list) return null;
        this.pageEditorCounter += 1;
        const editorId = `page-editor-${Date.now()}-${this.pageEditorCounter}`;
        const card = document.createElement('div');
        card.className = 'script-editor-card';
        card.dataset.editorId = editorId;
        if (script?.id) card.dataset.scriptId = script.id;
        if (script?.filename) card.dataset.filename = script.filename;
        card.innerHTML = `
            <div class="script-editor-card-head">
                <div class="script-index-badge">SCRIPT</div>
                <div class="script-editor-card-title-wrap">
                    <input type="text" class="input-field script-name-input" placeholder="Nama Script" value="${utils.escapeHtml(script?.name || '')}">
                </div>
                <button class="icon-btn danger remove-script-btn" type="button" title="Hapus script" aria-label="Hapus script">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg>
                </button>
            </div>
            <div class="script-editor-card-body">
                <div class="form-group">
                    <label>Lua Source</label>
                    <textarea class="input-field page-code-textarea" data-editor-id="${editorId}">${utils.escapeHtml(code)}</textarea>
                </div>
            </div>`;
        card.querySelector('.remove-script-btn').addEventListener('click', event => {
            event.stopPropagation();
            if (list.querySelectorAll('.script-editor-card').length <= 1) {
                this.showToast('Satu script minimal harus ada di dalam page.', 'warning');
                return;
            }
            const editor = this.pageEditors[editorId];
            if (editor) {
                try { editor.toTextArea(); } catch (_) {}
                delete this.pageEditors[editorId];
            }
            card.remove();
            this.updateScriptEditorCount();
        });
        list.appendChild(card);
        const textarea = card.querySelector('.page-code-textarea');
        this.initPageCodeEditor(editorId, textarea);
        this.updateScriptEditorCount();
        return editorId;
    },

    async populateEditor(title) {
        if (!this.currentUser || !this.db?.pages?.[title]) {
            this.normalizeDatabase();
        }
        if (!this.db?.pages?.[title]) {
            this.showToast('Page not found', 'error');
            return;
        }
        const page = this.db.pages[title];
        this.currentEditingPageTitle = title;
        this.originalTitle = title;
        this.originalPageId = page.id || utils.sanitizeTitle(title);
        this.destroyPageEditors();
        this.switchAdminTab('create-edit');
        const heading = document.getElementById('editor-heading');
        const saveBtn = document.querySelector('#admin-tab-editor .editor-actions .btn:last-child');
        const status = document.getElementById('page-editor-status');
        if (heading) heading.textContent = `Edit: ${page.title}`;
        if (saveBtn) saveBtn.textContent = 'Update Page';
        if (status) status.textContent = 'Editing';
        document.getElementById('edit-title').value = page.title || '';
        document.getElementById('edit-visibility').value = page.visibility || 'PUBLIC';
        document.getElementById('edit-desc').value = page.description || '';

        const list = document.getElementById('script-editor-list');
        list.innerHTML = '';
        const scripts = Array.isArray(page.scripts) ? page.scripts : [];
        if (!scripts.length) {
            this.addScriptEditor();
            return;
        }
        for (const script of scripts) {
            let code = '';
            try {
                const folder = page.legacy ? 'scripts' : 'pages';
                const path = `${folder}/${encodeURIComponent(page.id || utils.sanitizeTitle(title))}/raw/${encodeURIComponent(script.filename)}`;
                const res = await fetch(path, { cache: 'no-store' });
                if (res.ok) code = await res.text();
            } catch (error) {
                console.warn('Could not load script source:', script.name, error);
            }
            this.addScriptEditor(script, code);
        }
        Object.values(this.pageEditors).forEach(editor => editor.refresh());
    },

    resetBotEditor() {
        document.getElementById('bot-editor-heading').textContent = 'Create New Bot';
        document.getElementById('bot-title').value = '';
        document.getElementById('bot-message').value = '';
        document.getElementById('bot-schedule').checked = false;
        document.getElementById('bot-schedule-time').value = '';
        document.getElementById('bot-timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const saveBtn = document.querySelector('.bot-actions .btn:last-child');
        if (saveBtn) saveBtn.textContent = 'Send Bot';
        this.currentBotId = null;
        this.toggleScheduleFields();
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

    async saveScript() {
        return this.savePage();
    },

    async persistDatabase(message) {
        if (!this.dbSha) this.dbSha = await this.getRemoteDatabaseSha();
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/database.json`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${this.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
            body: JSON.stringify({ message, content: utils.safeBtoa(JSON.stringify(this.db, null, 2)), sha: this.dbSha, branch: CONFIG.branch })
        });
        if (!dbRes.ok) {
            let detail = `HTTP ${dbRes.status}`;
            try { const body = await dbRes.json(); if (body?.message) detail += `: ${body.message}`; } catch (_) {}
            throw new Error(`Failed to update database — ${detail}`);
        }
        const newDbData = await dbRes.json();
        this.dbSha = newDbData?.content?.sha || this.dbSha;
    },

    async savePage() {
        if (!this.currentUser || !this.db) {
            this.showToast('Please login first.', 'error');
            return;
        }
        if (this.actionInProgress) return;
        this.actionInProgress = true;
        const titleInput = document.getElementById('edit-title');
        const visibilityInput = document.getElementById('edit-visibility');
        const descInput = document.getElementById('edit-desc');
        const saveBtn = document.querySelector('#admin-tab-editor .editor-actions .btn:last-child');
        const title = titleInput?.value.trim() || '';
        const visibility = visibilityInput?.value || 'PUBLIC';
        const desc = descInput?.value.trim() || '';
        const scripts = this.collectEditorScripts();
        const isEditing = !!this.currentEditingPageTitle;
        const oldPage = isEditing ? this.db.pages[this.currentEditingPageTitle] : null;
        const oldPageId = this.originalPageId || oldPage?.id || null;
        const pageId = utils.sanitizeTitle(title);
        const titleError = utils.validateTitle(title);

        try {
            if (titleError) throw new Error(titleError);
            if (!pageId) throw new Error('Judul page menghasilkan URL yang tidak valid.');
            const pageExists = Object.entries(this.db.pages).some(([existingTitle, page]) => {
                if (isEditing && existingTitle === this.currentEditingPageTitle) return false;
                return (page.id || utils.sanitizeTitle(existingTitle)) === pageId;
            });
            if (pageExists) throw new Error('Page ID sudah dipakai oleh page lain. Gunakan judul yang berbeda.');
            if (!scripts.length) throw new Error('Tambahkan minimal 1 script ke dalam page.');
            for (const script of scripts) {
                if (!script.name) throw new Error('Semua Script Name wajib diisi.');
                const codeError = utils.validateCode(script.code);
                if (codeError) throw new Error(`Script "${script.name}": ${codeError}`);
            }

            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = isEditing ? 'Updating Page...' : 'Publishing Page...'; }
            if (typeof NProgress !== 'undefined') NProgress.start();

            const now = new Date().toISOString();
            const pageData = {
                id: pageId,
                title,
                displayTitle: title,
                visibility,
                description: desc,
                scripts: scripts.map(script => ({
                    id: script.id,
                    name: script.name,
                    filename: `${script.id}.lua`,
                    size: script.code.length,
                    created: oldPage?.scripts?.find(item => item.id === script.oldId)?.created || now,
                    updated: now
                })),
                created: oldPage?.created || now,
                updated: now
            };

            await this.createPageFiles(pageData, scripts, isEditing ? { ...oldPage, id: oldPageId } : null);
            if (isEditing && this.currentEditingPageTitle !== title) delete this.db.pages[this.currentEditingPageTitle];
            this.db.pages[title] = pageData;
            this.normalizeDatabase();
            try { localStorage.setItem('cihuyakz_local_db_v2', JSON.stringify(this.db)); } catch (storageError) { console.warn('Could not persist local database cache:', storageError); }
            await this.persistDatabase(`${isEditing ? 'Update' : 'Add'} page: ${title}`);

            this.currentEditingPageTitle = title;
            this.originalTitle = title;
            this.originalPageId = pageId;
            this.showToast(`${isEditing ? 'Updated' : 'Published'} page successfully!`, 'success');
            this.renderList();
            this.renderAdminList();
            if (document.getElementById('page-editor-status')) document.getElementById('page-editor-status').textContent = 'Saved';
            if (document.getElementById('editor-heading')) document.getElementById('editor-heading').textContent = `Edit: ${title}`;
            if (saveBtn) saveBtn.textContent = 'Update Page';
        } catch (error) {
            console.error('Page save error:', error);
            this.showToast(`Error: ${error.message}`, 'error');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
            this.actionInProgress = false;
            if (typeof NProgress !== 'undefined') NProgress.done();
        }
    },

    async createPageFiles(page, scripts, oldPage = null) {
        const oldScripts = oldPage?.scripts || [];
        const oldPageId = oldPage?.id || null;

        if (oldPageId && oldPageId === page.id) {
            const currentFiles = new Set((page.scripts || []).map(script => script.filename));
            for (const oldScript of oldScripts) {
                if (!currentFiles.has(oldScript.filename)) {
                    await this.deleteRemoteFile(`pages/${page.id}/raw/${oldScript.filename}`);
                }
            }
        }

        for (const script of scripts) {
            await this.createOrUpdateFile(`pages/${page.id}/raw/${script.id}.lua`, script.code, 'text/plain');
        }
        await this.createOrUpdateFile(`pages/${page.id}/index.html`, this.generatePageViewerHTML(page), 'text/html');

        if (oldPageId && oldPageId !== page.id) {
            await this.deletePageFiles(oldPageId, oldScripts);
        }
    },

    async deleteRemoteFile(path) {
        const url = `https://api.github.com/repos/${CONFIG.repoOwner}/${CONFIG.repo}/contents/${path}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' } });
        if (res.status === 404) return;
        if (!res.ok) throw new Error(`Cannot read ${path} — HTTP ${res.status}`);
        const file = await res.json();
        const del = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10' }, body: JSON.stringify({ message: `Delete file: ${path}`, sha: file.sha, branch: CONFIG.branch }) });
        if (!del.ok) throw new Error(`Cannot delete ${path} — HTTP ${del.status}`);
    },

    safeJsonForScript(value) {
        return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    },

    generatePageViewerHTML(page) {
        const escapedTitle = utils.escapeHtml(page.title);
        const manifest = this.safeJsonForScript((page.scripts || []).map(script => ({ id: script.id, name: script.name, filename: script.filename })));
        const description = page.description ? `<p class="script-description">${utils.escapeHtml(page.description)}</p>` : '';
        const created = new Date(page.created || Date.now()).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

        return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapedTitle} - CihuyAkz Studio Lite</title>
    <link rel="icon" type="image/png" href="../../assets/favicon.ico">
    <link rel="stylesheet" href="../../style.css?v=20260925-page-builder">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body class="script-page-body">
    <nav class="navbar">
        <div class="nav-content">
            <div class="nav-left">
                <a href="../../index.html" class="brand" style="text-decoration:none;color:inherit;">
                    <img src="../../assets/cihuyakz-icon.png" class="nav-icon" alt="Icon">
                    <span class="nav-title">CihuyAkz Studio Lite</span>
                </a>
            </div>
            <div class="nav-right">
                <a href="../../index.html" class="btn btn-secondary btn-sm">Back</a>
            </div>
        </div>
    </nav>

    <main class="container script-page-container">
        <section id="script-content" class="script-page-content">
            <div class="script-header-lg page-hero-header">
                <div>
                    <span class="page-kicker">SCRIPT PAGE</span>
                    <h1>${escapedTitle}</h1>
                    <div class="meta-row">
                        <span class="meta-badge">${(page.scripts || []).length} scripts</span>
                        <span class="meta-badge">Updated ${created}</span>
                    </div>
                </div>
            </div>
            ${description}
            <div id="page-script-tabs" class="page-script-tabs"></div>
            <div id="page-script-panels" class="page-script-panels"></div>
        </section>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-lua.min.js"></script>
    <script>
        const SCRIPTS = ${manifest};

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text == null ? '' : String(text);
            return div.innerHTML;
        }

        const sourceCache = {};
        const tabs = document.getElementById('page-script-tabs');
        const panels = document.getElementById('page-script-panels');

        function renderScripts() {
            tabs.innerHTML = SCRIPTS.map((script, index) => '<button class="page-script-tab' + (index === 0 ? ' active' : '') + '" data-index="' + index + '">' + escapeHtml(script.name) + '</button>').join('');
            panels.innerHTML = SCRIPTS.map((script, index) => '<section class="page-script-panel' + (index === 0 ? ' active' : '') + '" data-panel="' + index + '"><div class="code-box"><div class="toolbar"><div class="file-info">raw/' + escapeHtml(script.filename) + '</div><div class="toolbar-right"><button class="btn btn-sm" type="button" data-copy="' + index + '">Copy</button><button class="btn btn-sm" type="button" data-download="' + index + '">Download</button><a href="raw/' + encodeURIComponent(script.filename) + '" class="btn btn-secondary btn-sm" target="_blank" rel="noopener">Raw</a></div></div><pre><code id="code-' + index + '" class="language-lua">Loading...</code></pre></div></section>').join('');

            tabs.querySelectorAll('.page-script-tab').forEach(tab => tab.addEventListener('click', () => {
                const index = Number(tab.dataset.index);
                tabs.querySelectorAll('.page-script-tab').forEach(item => item.classList.toggle('active', Number(item.dataset.index) === index));
                panels.querySelectorAll('.page-script-panel').forEach(panel => panel.classList.toggle('active', Number(panel.dataset.panel) === index));
            }));
            tabs.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', () => copyScript(Number(btn.dataset.copy), btn)));
            tabs.querySelectorAll('[data-download]').forEach(btn => btn.addEventListener('click', () => downloadScript(Number(btn.dataset.download))));
            loadScriptSources();
        }

        async function loadScriptSources() {
            await Promise.all(SCRIPTS.map(async (script, index) => {
                try {
                    const response = await fetch('raw/' + encodeURIComponent(script.filename), { cache: 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    const code = await response.text();
                    sourceCache[index] = code;
                    const block = document.getElementById('code-' + index);
                    if (block) {
                        block.textContent = code;
                        Prism.highlightElement(block);
                    }
                } catch (_) {
                    const block = document.getElementById('code-' + index);
                    if (block) block.textContent = '-- Error loading source';
                }
            }));
        }

        async function copyScript(index, btn) {
            try {
                const code = sourceCache[index] || '';
                await navigator.clipboard.writeText(code);
                const original = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = original, 1600);
            } catch (_) {}
        }

        function downloadScript(index) {
            const script = SCRIPTS[index];
            const code = sourceCache[index] || '';
            const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = script.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        }

        renderScripts();
    </script>
</body>
</html>`;
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
