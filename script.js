
// REPLACE THIS WITH YOUR APPS SCRIPT DEPLOYMENT URL


// ═══════════════════════════════════════════════════════════════════════════
// BALANCE SHEET MANAGER - MOBILE FIX (Fetch API)
// Version 4.3 FINAL - Mobile Network Error Fixed
// ═══════════════════════════════════════════════════════════════════════════

// Console cleanup
(function() {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('Slow network') || msg.includes('Fallback font') || 
            msg.includes('Cross-Origin') || msg.includes('Intervention') || 
            msg.includes('chrome-extension')) return;
        originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
        const msg = args.join(' ');
        if (msg.includes('Cross-Origin') || msg.includes('postMessage')) return;
        originalError.apply(console, args);
    };
})();

// Network monitoring
window.addEventListener('online', () => {
    console.log('✅ Network: Online');
    if (currentUser) showToast('✅ Connection restored', 'success');
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
// AUTHENTICATION
// ════════════════════════════════════════════════════════════

function handleCredentialResponse(response) {
    const credential = response.credential;
    const payload = parseJwt(credential);
    
    currentUser = {
        email: payload.email,
        name: payload.name,
        picture: payload.picture
    };
    
    console.log('%c✅ User signed in', 'color: #16a34a; font-weight: bold;', currentUser.email);
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
    
    console.log('%c✅ User logged in', 'color: #16a34a; font-weight: bold;', currentUser.email);
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
    if (!isOnline()) {
        hideLoading();
        showToast('⚠️ No internet connection', 'warning');
        return;
    }
    
    console.log('📡 API URL:', API_BASE_URL);
    console.log('👤 User:', currentUser.email);
    
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
            
            showToast(r.newUser ? '✅ Welcome! Spreadsheet created in your Drive!' : '✅ Welcome back!', 'success');
        } else {
            showToast('⚠️ ' + (r.error || 'Could not initialize'), 'warning');
        }
    } catch (e) {
        hideLoading();
        console.error('❌ Init error:', e);
        showToast('❌ ' + e.message + '\n\nCheck your deployment URL in script.js', 'error');
    }
}

// ════════════════════════════════════════════════════════════
// API CALLS - FETCH API (MOBILE FRIENDLY)
// ════════════════════════════════════════════════════════════

async function apiCall(action, params = {}) {
    if (!isOnline()) {
        throw new Error('No internet connection');
    }
    
    const url = new URL(API_BASE_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    
    if (currentUser) {
        url.searchParams.set('userEmail', currentUser.email);
    }
    
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
    
    console.log(`📡 Calling: ${action}`);
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ Response: ${action}`, data);
        return data;
        
    } catch (error) {
        console.error(`❌ API Error (${action}):`, error);
        throw new Error(`Network error: ${error.message}`);
    }
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
// BANKS
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
            showToast('✅ Bank added!', 'success');
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
    if (!confirm(`Delete bank "${bankCode}"?`)) return;
    
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
            showToast('⚠️ ' + (r.error || 'Failed to load'), 'warning');
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
        <p>Opening - Expenses = Net</p>
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
        showToast('❌ Fill all fields', 'error');
        return;
    }
    
    showLoading();
    try {
        const r = await apiCall('addTransaction', tx);
        hideLoading();
        
        if (r.success) {
            showToast(`✅ Added! ID: ${r.id}`, 'success');
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
            showToast('✅ Updated!', 'success');
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
    if (!confirm('Delete?')) return;
    
    showLoading();
    try {
        const r = await apiCall('deleteTransaction', {id});
        hideLoading();
        
        if (r.success) {
            showToast('✅ Deleted', 'success');
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
                <button class="btn btn-danger" onclick="deleteBank('${bank.code}')" style="float: right; font-size: 0.8rem; padding: 0.4rem 0.8rem;">Delete</button>
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
        const params = { salary_amount: document.getElementById('salary-input').value };
        
        userBanks.forEach(bank => {
            const input = document.getElementById(`opening-${bank.code}`);
            if (input) params[`opening_balance_${bank.code}`] = input.value;
        });
        
        const r = await apiCall('updateSettings', params);
        hideLoading();
        
        if (r.success) {
            showToast('✅ Saved!', 'success');
            setTimeout(() => loadDashboard(), 500);
        } else {
            showToast('❌ ' + r.error, 'error');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
}

async function handleRollover() {
    if (!confirm('📅 Rollover to next month?')) return;
    
    showLoading();
    try {
        const r = await apiCall('rolloverMonth');
        hideLoading();
        
        if (r.success) {
            let msg = '✅ Rolled over!\n\n';
            Object.keys(r.newBalances).forEach(code => {
                const bank = userBanks.find(b => b.code === code);
                if (bank) msg += `${bank.name}: ₹${r.newBalances[code].toFixed(2)}\n`;
            });
            showToast(msg, 'success');
            setTimeout(() => { loadSettings(); loadDashboard(); }, 1000);
        } else {
            showToast('❌ ' + r.error, 'error');
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
            showToast('✅ Exported!', 'success');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ Failed', 'error');
    }
}

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════

function formatCurrency(v) { 
    return `₹${parseFloat(v||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`; 
}

function formatDateTime(iso) { 
    try { return new Date(iso).toLocaleString('en-IN'); } 
    catch(e) { return iso; } 
}

function escapeHtml(t) { 
    const d = document.createElement('div'); 
    d.textContent = t; 
    return d.innerHTML; 
}

function showLoading() { 
    document.getElementById('loading-overlay').classList.add('active'); 
}

function hideLoading() { 
    document.getElementById('loading-overlay').classList.remove('active'); 
}

function showToast(m, t='info') { 
    const toast = document.getElementById('toast'); 
    toast.textContent = m; 
    toast.className = `toast ${t} active`; 
    setTimeout(() => toast.classList.remove('active'), 5000);
}

// ════════════════════════════════════════════════════════════
// GLOBAL FUNCTIONS
// ════════════════════════════════════════════════════════════

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.deleteBank = deleteBank;
window.handleCredentialResponse = handleCredentialResponse;
window.handleSimpleLogin = handleSimpleLogin;

console.log('%c💰 Balance Sheet v4.3', 'color: #2563eb; font-size: 18px; font-weight: bold;');
console.log('%c✅ Mobile Fix | Fetch API', 'color: #16a34a; font-weight: bold;');
