// ═══════════════════════════════════════════════════════════════════════════
// BALANCE SHEET MANAGER - MOBILE OPTIMIZED (v4.2 FINAL)
// Multi-User | Custom Banks | Hybrid Auth | Mobile Network Fixes
// ═══════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
// CONSOLE CLEANUP - SUPPRESS UNWANTED WARNINGS
// ════════════════════════════════════════════════════════════

(function() {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = function(...args) {
        const msg = args.join(' ');
        if (
            msg.includes('Slow network') ||
            msg.includes('Fallback font') ||
            msg.includes('Cross-Origin-Opener-Policy') ||
            msg.includes('Intervention') ||
            msg.includes('chrome-extension')
        ) {
            return;
        }
        originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
        const msg = args.join(' ');
        if (
            msg.includes('Cross-Origin-Opener-Policy') ||
            msg.includes('postMessage')
        ) {
            return;
        }
        originalError.apply(console, args);
    };
})();

// ════════════════════════════════════════════════════════════
// NETWORK STATUS MONITORING
// ════════════════════════════════════════════════════════════

window.addEventListener('online', () => {
    console.log('✅ Network: Online');
    if (currentUser) {
        showToast('✅ Connection restored', 'success');
    }
});

window.addEventListener('offline', () => {
    console.log('⚠️ Network: Offline');
    showToast('⚠️ No internet connection', 'warning');
});

function isOnline() {
    return navigator.onLine;
}

// REPLACE THIS WITH YOUR APPS SCRIPT DEPLOYMENT URL
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyx_-e021gityKuGttbyH8i-cDfLnmSJM1RgaLyFhVLQC0K2_O-Bt3n_DukMYvxScQyDQ/exec';

let transactions = [];
let dashboardData = {};
let currentUser = null;
let userBanks = [];

// ════════════════════════════════════════════════════════════
// AUTHENTICATION - HYBRID (GOOGLE + EMAIL)
// ════════════════════════════════════════════════════════════

function handleCredentialResponse(response) {
    const credential = response.credential;
    const payload = parseJwt(credential);
    
    currentUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };
    
    console.log('%c✅ User signed in with Google', 'color: #16a34a; font-weight: bold;', currentUser.email);
    
    showLoading();
    initializeUser();
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function handleSimpleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const name = document.getElementById('login-name').value.trim();
    
    if (!email || !email.includes('@')) {
        showToast('❌ Please enter a valid email', 'error');
        return;
    }
    
    if (!name) {
        showToast('❌ Please enter your name', 'error');
        return;
    }
    
    currentUser = {
        email: email,
        name: name,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff&size=128`
    };
    
    console.log('%c✅ User logged in with email', 'color: #16a34a; font-weight: bold;', currentUser.email);
    
    showLoading();
    initializeUser();
}

function handleSignOut() {
    if (confirm('Sign out?')) {
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        document.getElementById('app-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        currentUser = null;
        userBanks = [];
        showToast('👋 Signed out successfully', 'success');
    }
}

async function initializeUser() {
    // Check network first
    if (!isOnline()) {
        hideLoading();
        showToast('⚠️ No internet connection. Please check your network.', 'warning');
        return;
    }
    
    console.log('📡 API URL:', API_BASE_URL);
    console.log('👤 User:', currentUser.email);
    console.log('🌐 Online:', navigator.onLine);
    
    try {
        const r = await apiCall('initUser');
        hideLoading();
        
        if (r.success) {
            document.getElementById('user-name').textContent = currentUser.name;
            document.getElementById('user-email').textContent = currentUser.email;
            document.getElementById('user-avatar').src = currentUser.picture;
            
            if (r.sheetUrl) {
                document.getElementById('sheet-link').href = r.sheetUrl;
                document.getElementById('sheet-link').style.display = 'inline-flex';
            }
            
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'block';
            
            document.getElementById('currentYear').textContent = new Date().getFullYear();
            document.getElementById('new-date').valueAsDate = new Date();
            
            setupListeners();
            await loadBanks();
            loadDashboard();
            loadTransactions();
            loadSettings();
            
            if (r.newUser) {
                showToast('✅ Welcome! Your personal spreadsheet has been created in your Drive!', 'success');
            } else {
                showToast('✅ Welcome back!', 'success');
            }
        } else {
            showToast('⚠️ ' + (r.error || 'Could not initialize'), 'warning');
        }
    } catch (e) {
        hideLoading();
        console.error('❌ Initialization error:', e);
        showToast('❌ Connection error: ' + e.message + '\n\nPlease check your internet and try again.', 'error');
    }
}

// ════════════════════════════════════════════════════════════
// API CALLS WITH RETRY LOGIC (MOBILE OPTIMIZED)
// ════════════════════════════════════════════════════════════

function apiCall(action, params = {}, retries = 3) {
    return new Promise((resolve, reject) => {
        if (!isOnline()) {
            reject(new Error('No internet connection'));
            return;
        }
        
        const cb = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        const timeout = setTimeout(() => { 
            cleanup(); 
            if (retries > 0) {
                console.log(`⚠️ Timeout, retrying ${action}... (${retries} attempts left)`);
                resolve(apiCall(action, params, retries - 1));
            } else {
                reject(new Error('Request timeout. Please check your connection and try again.'));
            }
        }, 60000); // 60 seconds for mobile
        
        window[cb] = (data) => { 
            clearTimeout(timeout); 
            cleanup(); 
            resolve(data); 
        };
        
        function cleanup() { 
            delete window[cb]; 
            if (script.parentNode) script.parentNode.removeChild(script); 
        }
        
        const url = new URL(API_BASE_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('callback', cb);
        url.searchParams.set('_t', Date.now());
        
        if (currentUser) {
            url.searchParams.set('userEmail', currentUser.email);
        }
        
        Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
        
        script.src = url.toString();
        script.onerror = () => { 
            clearTimeout(timeout); 
            cleanup(); 
            if (retries > 0) {
                console.log(`⚠️ Network error on ${action}, retrying... (${retries} attempts left)`);
                setTimeout(() => {
                    resolve(apiCall(action, params, retries - 1));
                }, 2000); // Wait 2 seconds before retry
            } else {
                reject(new Error('Network error. Please check your connection.')); 
            }
        };
        document.head.appendChild(script);
    });
}

// ════════════════════════════════════════════════════════════
// SETUP
// ════════════════════════════════════════════════════════════

function setupListeners() {
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.page)));
    document.getElementById('quick-add-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    document.getElementById('edit-form').addEventListener('submit', handleEditTransaction);
    document.getElementById('cancel-edit-btn').addEventListener('click', () => document.getElementById('edit-modal').classList.remove('active'));
    document.getElementById('recalculate-btn').addEventListener('click', () => { loadDashboard(); loadTransactions(); showToast('✅ Recalculated', 'success'); });
    document.getElementById('rollover-btn').addEventListener('click', handleRollover);
    document.getElementById('export-btn').addEventListener('click', handleExport);
    document.getElementById('add-bank-btn').addEventListener('click', () => document.getElementById('add-bank-modal').classList.add('active'));
    document.getElementById('add-bank-form').addEventListener('submit', handleAddBank);
    document.getElementById('cancel-bank-btn').addEventListener('click', () => document.getElementById('add-bank-modal').classList.remove('active'));
}

function switchPage(p) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${p}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById(`${p}-page`).classList.add('active');
    
    if (p === 'dashboard') loadDashboard();
    else if (p === 'transactions') loadTransactions();
    else if (p === 'settings') { loadSettings(); loadBanks(); }
}

// ════════════════════════════════════════════════════════════
// BANKS MANAGEMENT
// ════════════════════════════════════════════════════════════

async function loadBanks() {
    try {
        const r = await apiCall('getBanks');
        if (r.success && r.data) {
            userBanks = r.data;
            updateBankSelects();
            return true;
        }
        return false;
    } catch (e) {
        console.error('Failed to load banks:', e);
        return false;
    }
}

function updateBankSelects() {
    const selects = ['new-bank', 'edit-bank'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Bank</option>';
        userBanks.forEach(bank => {
            const option = document.createElement('option');
            option.value = bank.code;
            option.textContent = bank.name;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    });
}

async function handleAddBank(e) {
    e.preventDefault();
    
    const bankName = document.getElementById('bank-name').value.trim();
    const bankCode = document.getElementById('bank-code').value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const bankColor = document.getElementById('bank-color').value;
    
    if (!bankName || !bankCode) {
        showToast('❌ Bank name and code required', 'error');
        return;
    }
    
    showLoading();
    try {
        const r = await apiCall('addBank', { bankName, bankCode, bankColor });
        hideLoading();
        
        if (r.success) {
            showToast('✅ Bank added successfully!', 'success');
            document.getElementById('add-bank-modal').classList.remove('active');
            document.getElementById('add-bank-form').reset();
            await loadBanks();
            loadSettings();
        } else {
            showToast('❌ ' + r.error, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

async function deleteBank(bankCode) {
    if (!confirm(`Delete bank "${bankCode}"?\n\nWarning: This will NOT delete existing transactions, but they will appear as orphaned.`)) return;
    
    showLoading();
    try {
        const r = await apiCall('deleteBank', { bankCode });
        hideLoading();
        
        if (r.success) {
            showToast('✅ Bank deleted', 'success');
            await loadBanks();
            loadSettings();
            loadDashboard();
        } else {
            showToast('❌ ' + r.error, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════

async function loadDashboard() {
    showLoading();
    try {
        const r = await apiCall('getDashboard');
        hideLoading();
        
        if (r.success && r.data) {
            dashboardData = r.data;
            
            if (r.data.sheetUrl) {
                document.getElementById('sheet-link').href = r.data.sheetUrl;
                document.getElementById('sheet-link').style.display = 'inline-flex';
            }
            
            renderDashboard();
        } else {
            showToast('⚠️ ' + (r.error || 'Failed to load dashboard'), 'warning');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

function renderDashboard() {
    document.getElementById('salary-value').textContent = formatCurrency(dashboardData.salary);
    
    const banksContainer = document.getElementById('banks-container');
    banksContainer.innerHTML = '';
    
    Object.keys(dashboardData.banks).forEach(bankCode => {
        const bank = dashboardData.banks[bankCode];
        const section = createBankSection(bankCode, bank);
        banksContainer.appendChild(section);
    });
    
    document.getElementById('combined-opening').textContent = formatCurrency(dashboardData.combined_opening);
    document.getElementById('combined-total').textContent = formatCurrency(dashboardData.combined_total);
    document.getElementById('combined-expenses').textContent = formatCurrency(dashboardData.combined_expenses);
    document.getElementById('combined-net').textContent = formatCurrency(dashboardData.combined_net);
    
    document.getElementById('last-updated').textContent = formatDateTime(dashboardData.last_updated);
}

function createBankSection(bankCode, bank) {
    const section = document.createElement('div');
    section.className = 'bank-section';
    
    const header = document.createElement('div');
    header.className = 'section-header';
    header.style.background = `linear-gradient(135deg, ${bank.color} 0%, ${adjustColor(bank.color, -30)} 100%)`;
    header.style.color = 'white';
    header.innerHTML = `
        <h2>🏦 ${bank.name.toUpperCase()}</h2>
        <p>Opening Balance - Expenses = Net Balance</p>
    `;
    
    const tiles = document.createElement('div');
    tiles.className = 'dashboard-section';
    tiles.innerHTML = `
        <div class="tile" style="border-left-color: ${bank.color};">
            <div class="tile-icon">🏦</div>
            <div class="tile-content">
                <div class="tile-label">Opening Balance</div>
                <div class="tile-value">${formatCurrency(bank.opening_balance)}</div>
            </div>
        </div>
        <div class="tile" style="border-left-color: ${bank.color};">
            <div class="tile-icon">💸</div>
            <div class="tile-content">
                <div class="tile-label">Expenses</div>
                <div class="tile-value tile-value-danger">${formatCurrency(bank.expenses)}</div>
            </div>
        </div>
        <div class="tile tile-highlight" style="border-color: ${bank.color};">
            <div class="tile-icon">✅</div>
            <div class="tile-content">
                <div class="tile-label">Net Balance</div>
                <div class="tile-value tile-value-success">${formatCurrency(bank.net_balance)}</div>
            </div>
        </div>
    `;
    
    section.appendChild(header);
    section.appendChild(tiles);
    return section;
}

function adjustColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ════════════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════════════

async function loadTransactions() {
    showLoading();
    try {
        const r = await apiCall('getTransactions');
        hideLoading();
        
        if (r.success && r.data) {
            transactions = r.data;
            renderTransactions();
            updateSummary();
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

function renderTransactions() {
    const tb = document.getElementById('transactions-tbody');
    if (transactions.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">No transactions yet</td></tr>';
        return;
    }
    
    tb.innerHTML = transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map((tx,i) => {
        const bank = userBanks.find(b => b.code === tx.bank);
        const bankName = bank ? bank.name : tx.bank.toUpperCase();
        const bankColor = bank ? bank.color : '#64748b';
        
        return `
        <tr>
            <td>${i+1}</td>
            <td>${tx.date}</td>
            <td>${escapeHtml(tx.description)}</td>
            <td>₹${parseFloat(tx.amount).toFixed(2)}</td>
            <td><span class="bank-badge" style="background: ${bankColor}20; color: ${bankColor};">${bankName}</span></td>
            <td>
                <button class="btn btn-edit" onclick="editTransaction(${tx.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteTransaction(${tx.id})">Delete</button>
            </td>
        </tr>
    `}).join('');
}

function updateSummary() {
    const total = transactions.reduce((s,t) => s + parseFloat(t.amount), 0);
    document.getElementById('total-expenses').textContent = formatCurrency(total);
    
    const summaryContainer = document.getElementById('bank-summary');
    summaryContainer.innerHTML = userBanks.map(bank => {
        const expenses = transactions.filter(t => t.bank === bank.code).reduce((s,t) => s + parseFloat(t.amount), 0);
        return `
            <div class="summary-item">
                <span class="summary-label">${bank.name}:</span>
                <span class="summary-value">${formatCurrency(expenses)}</span>
            </div>
        `;
    }).join('');
}

async function handleAddTransaction(e) {
    e.preventDefault();
    
    const tx = {
        date: document.getElementById('new-date').value,
        description: encodeURIComponent(document.getElementById('new-description').value),
        amount: parseFloat(document.getElementById('new-amount').value),
        bank: document.getElementById('new-bank').value
    };
    
    if (!tx.date || isNaN(tx.amount) || tx.amount <= 0 || !tx.bank) {
        showToast('❌ Fill all fields correctly', 'error');
        return;
    }
    
    showLoading();
    try {
        const r = await apiCall('addTransaction', tx);
        hideLoading();
        
        if (r.success) {
            showToast(`✅ Transaction added! ID: ${r.id}`, 'success');
            document.getElementById('quick-add-form').reset();
            document.getElementById('new-date').valueAsDate = new Date();
            setTimeout(() => { loadTransactions(); loadDashboard(); }, 500);
        } else {
            showToast('❌ ' + r.error, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    
    document.getElementById('edit-id').value = tx.id;
    document.getElementById('edit-date').value = tx.date;
    document.getElementById('edit-description').value = tx.description;
    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('edit-bank').value = tx.bank;
    document.getElementById('edit-modal').classList.add('active');
}

async function handleEditTransaction(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const r = await apiCall('updateTransaction', {
            id: document.getElementById('edit-id').value,
            date: document.getElementById('edit-date').value,
            description: encodeURIComponent(document.getElementById('edit-description').value),
            amount: document.getElementById('edit-amount').value,
            bank: document.getElementById('edit-bank').value
        });
        
        hideLoading();
        
        if (r.success) {
            showToast('✅ Transaction updated!', 'success');
            document.getElementById('edit-modal').classList.remove('active');
            setTimeout(() => { loadTransactions(); loadDashboard(); }, 500);
        } else {
            showToast('❌ ' + r.error, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    
    showLoading();
    try {
        const r = await apiCall('deleteTransaction', {id});
        hideLoading();
        
        if (r.success) {
            showToast('✅ Transaction deleted', 'success');
            setTimeout(() => { loadTransactions(); loadDashboard(); }, 500);
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

// ════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════

async function loadSettings() {
    try {
        await loadBanks();
        
        const r = await apiCall('getSettings');
        
        if (r.success && r.data) {
            document.getElementById('salary-input').value = r.data.salary_amount || 0;
        }
        
        renderBankSettings();
    } catch (e) {
        console.log('Settings load error:', e);
    }
}

function renderBankSettings() {
    const container = document.getElementById('banks-settings');
    container.innerHTML = userBanks.map(bank => `
        <div class="bank-settings-group">
            <h3 style="color: ${bank.color}; margin-bottom: 1rem;">
                🏦 ${bank.name}
                <button class="btn btn-danger" onclick="deleteBank('${bank.code}')" style="float: right; font-size: 0.8rem; padding: 0.4rem 0.8rem;">Delete Bank</button>
            </h3>
            <div class="form-group">
                <label for="opening-${bank.code}">Opening Balance</label>
                <input type="number" id="opening-${bank.code}" step="0.01" min="0" value="${bank.opening_balance}" required>
            </div>
        </div>
    `).join('');
}

async function handleSaveSettings(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const params = {
            salary_amount: document.getElementById('salary-input').value
        };
        
        userBanks.forEach(bank => {
            const input = document.getElementById(`opening-${bank.code}`);
            if (input) {
                params[`opening_balance_${bank.code}`] = input.value;
            }
        });
        
        const r = await apiCall('updateSettings', params);
        
        hideLoading();
        
        if (r.success) {
            showToast('✅ Settings saved!', 'success');
            setTimeout(() => loadDashboard(), 500);
        } else {
            showToast('❌ ' + (r.error || 'Failed to save'), 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

async function handleRollover() {
    if (!confirm('📅 Rollover to next month?\n\nThis will set Opening balances to current Net balances.')) return;
    
    showLoading();
    try {
        const r = await apiCall('rolloverMonth');
        hideLoading();
        
        if (r.success) {
            let message = '✅ Month rolled over!\n\n';
            Object.keys(r.newBalances).forEach(code => {
                const bank = userBanks.find(b => b.code === code);
                if (bank) {
                    message += `${bank.name}: ₹${r.newBalances[code].toFixed(2)}\n`;
                }
            });
            showToast(message, 'success');
            setTimeout(() => { loadSettings(); loadDashboard(); }, 1000);
        } else {
            showToast('❌ ' + (r.error || 'Rollover failed'), 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

async function handleExport() {
    showLoading();
    try {
        const r = await apiCall('exportToCSV');
        hideLoading();
        
        if (r.success && r.data) {
            const blob = new Blob([r.data], {type: 'text/csv'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_sheet_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ Exported successfully!', 'success');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ Export failed', 'error');
    }
}

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════

function formatCurrency(v) { 
    return `₹${parseFloat(v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`; 
}

function formatDateTime(iso) { 
    try { 
        return new Date(iso).toLocaleString('en-IN'); 
    } catch(e) { 
        return iso; 
    } 
}

function escapeHtml(t) { 
    const d = document.createElement('div'); 
    d.textContent = t; 
    return d.innerHTML; 
}

function showLoading() { 
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('p');
    if (text) {
        text.textContent = 'Loading... Please wait';
    }
    overlay.classList.add('active'); 
}

function hideLoading() { 
    document.getElementById('loading-overlay').classList.remove('active'); 
}

function showToast(m, t='info') { 
    const toast = document.getElementById('toast'); 
    toast.textContent = m; 
    toast.className = `toast ${t} active`; 
    setTimeout(() => toast.classList.remove('active'), 5000); // 5 seconds for mobile
}

// ════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS & INITIALIZATION
// ════════════════════════════════════════════════════════════

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.deleteBank = deleteBank;
window.handleCredentialResponse = handleCredentialResponse;
window.handleSimpleLogin = handleSimpleLogin;

// Styled console output
console.log(
    '%c💰 Balance Sheet Manager%c v4.2 MOBILE',
    'color: #2563eb; font-size: 20px; font-weight: bold;',
    'color: #64748b; font-size: 12px; font-weight: normal;'
);
console.log(
    '%c✅ System Ready | %c🔐 Auth Enabled | %c📊 Multi-Bank | %c☁️ User Drive | %c📱 Mobile Fix',
    'color: #16a34a; font-weight: bold;',
    'color: #f59e0b; font-weight: bold;',
    'color: #2563eb; font-weight: bold;',
    'color: #7c3aed; font-weight: bold;',
    'color: #ec4899; font-weight: bold;'
);
