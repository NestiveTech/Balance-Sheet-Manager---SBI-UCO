const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbyx_-e021gityKuGttbyH8i-cDfLnmSJM1RgaLyFhVLQC0K2_O-Bt3n_DukMYvxScQyDQ/exec';
// REPLACE THIS URL WITH YOUR APPS SCRIPT DEPLOYMENT URL
// const API_BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

let transactions = [];
let dashboardData = {};
let currentUserEmail = null;

// ════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    currentUserEmail = localStorage.getItem('userEmail');
    
    if (currentUserEmail) {
        showApp();
    } else {
        showAuthScreen();
    }
});

function showAuthScreen() {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    
    const userName = localStorage.getItem('userName') || 'User';
    document.getElementById('user-name').textContent = userName;
    document.getElementById('user-email').textContent = currentUserEmail;
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    document.getElementById('new-date').valueAsDate = new Date();
    
    setupListeners();
    initializeUser();
}

function handleSimpleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const name = document.getElementById('login-name').value.trim();
    
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email');
        return;
    }
    
    if (!name) {
        alert('Please enter your name');
        return;
    }
    
    currentUserEmail = email;
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', name);
    
    showApp();
}

function handleSignOut() {
    if (confirm('Sign out?')) {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        currentUserEmail = null;
        showAuthScreen();
    }
}

async function initializeUser() {
    showLoading();
    try {
        const r = await apiCall('initUser');
        hideLoading();
        
        if (r.success) {
            if (r.sheetUrl) {
                document.getElementById('sheet-link').href = r.sheetUrl;
                document.getElementById('sheet-link').style.display = 'inline-flex';
            }
            
            loadDashboard();
            loadTransactions();
            loadSettings();
            
            if (r.newUser) {
                showToast('✅ Welcome! Your spreadsheet has been created in your Google Drive!', 'success');
            } else {
                showToast('✅ Welcome back!', 'success');
            }
        } else {
            showToast('⚠️ ' + (r.error || 'Could not initialize'), 'warning');
            loadDashboard();
            loadTransactions();
            loadSettings();
        }
    } catch (e) {
        hideLoading();
        showToast('⚠️ Starting in offline mode', 'warning');
        loadDashboard();
        loadTransactions();
        loadSettings();
    }
}

// ════════════════════════════════════════════════════════════
// API CALLS
// ════════════════════════════════════════════════════════════

function apiCall(action, params = {}) {
    return new Promise((resolve, reject) => {
        const cb = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Request timeout')); }, 30000);
        
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
        url.searchParams.set('userEmail', currentUserEmail);
        
        Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
        
        script.src = url.toString();
        script.onerror = () => { 
            clearTimeout(timeout); 
            cleanup(); 
            reject(new Error('Network error')); 
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
}

function switchPage(p) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-page="${p}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.getElementById(`${p}-page`).classList.add('active');
    
    if (p === 'dashboard') loadDashboard();
    else if (p === 'transactions') loadTransactions();
    else if (p === 'settings') loadSettings();
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
            
            document.getElementById('salary-value').textContent = formatCurrency(dashboardData.salary);
            document.getElementById('sbi-present-value').textContent = formatCurrency(dashboardData.opening_balance_sbi);
            document.getElementById('sbi-previous-value').textContent = formatCurrency(dashboardData.previous_balance_sbi);
            document.getElementById('sbi-gross-value').textContent = formatCurrency(dashboardData.total_balance_sbi);
            document.getElementById('sbi-expenses-dash').textContent = formatCurrency(dashboardData.expenses_sbi);
            document.getElementById('sbi-net-value').textContent = formatCurrency(dashboardData.net_balance_sbi);
            
            document.getElementById('uco-present-value').textContent = formatCurrency(dashboardData.opening_balance_uco);
            document.getElementById('uco-previous-value').textContent = formatCurrency(dashboardData.previous_balance_uco);
            document.getElementById('uco-gross-value').textContent = formatCurrency(dashboardData.total_balance_uco);
            document.getElementById('uco-expenses-dash').textContent = formatCurrency(dashboardData.expenses_uco);
            document.getElementById('uco-net-value').textContent = formatCurrency(dashboardData.net_balance_uco);
            
            document.getElementById('combined-present-value').textContent = formatCurrency(dashboardData.combined_opening);
            document.getElementById('combined-gross-value').textContent = formatCurrency(dashboardData.combined_total);
            document.getElementById('combined-expenses-dash').textContent = formatCurrency(dashboardData.combined_expenses);
            document.getElementById('combined-net-value').textContent = formatCurrency(dashboardData.combined_net);
            
            document.getElementById('last-updated').textContent = formatDateTime(dashboardData.last_updated);
        } else {
            showToast('⚠️ ' + (r.error || 'Failed to load dashboard'), 'warning');
        }
    } catch (e) {
        hideLoading();
        showToast('❌ ' + e.message, 'error');
    }
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
    
    tb.innerHTML = transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map((tx,i) => `
        <tr>
            <td>${i+1}</td>
            <td>${tx.date}</td>
            <td>${escapeHtml(tx.description)}</td>
            <td>₹${parseFloat(tx.amount).toFixed(2)}</td>
            <td><span class="bank-badge ${tx.bank}">${tx.bank.toUpperCase()}</span></td>
            <td>
                <button class="btn btn-edit" onclick="editTransaction(${tx.id})">Edit</button>
                <button class="btn btn-danger" onclick="deleteTransaction(${tx.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function updateSummary() {
    const total = transactions.reduce((s,t) => s + parseFloat(t.amount), 0);
    const sbi = transactions.filter(t => t.bank === 'sbi').reduce((s,t) => s + parseFloat(t.amount), 0);
    const uco = transactions.filter(t => t.bank === 'uco').reduce((s,t) => s + parseFloat(t.amount), 0);
    
    document.getElementById('total-expenses').textContent = formatCurrency(total);
    document.getElementById('sbi-expenses').textContent = formatCurrency(sbi);
    document.getElementById('uco-expenses').textContent = formatCurrency(uco);
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
        const r = await apiCall('getSettings');
        
        if (r.success && r.data) {
            document.getElementById('salary-input').value = r.data.salary_amount || 0;
            document.getElementById('sbi-opening-input').value = r.data.opening_balance_sbi || 0;
            document.getElementById('sbi-previous-input').value = r.data.previous_balance_sbi || 0;
            document.getElementById('uco-opening-input').value = r.data.opening_balance_uco || 0;
            document.getElementById('uco-previous-input').value = r.data.previous_balance_uco || 0;
        }
    } catch (e) {
        console.log('Settings load error:', e);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    showLoading();
    
    try {
        const r = await apiCall('updateSettings', {
            salary_amount: document.getElementById('salary-input').value,
            opening_balance_sbi: document.getElementById('sbi-opening-input').value,
            previous_balance_sbi: document.getElementById('sbi-previous-input').value,
            opening_balance_uco: document.getElementById('uco-opening-input').value,
            previous_balance_uco: document.getElementById('uco-previous-input').value
        });
        
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
    if (!confirm('📅 Rollover to next month?\n\nThis will move Net balances to Previous balances.')) return;
    
    showLoading();
    try {
        const r = await apiCall('rolloverMonth');
        hideLoading();
        
        if (r.success) {
            showToast(`✅ Month rolled over!\nSBI Previous: ₹${r.new_previous_sbi.toFixed(2)}\nUCO Previous: ₹${r.new_previous_uco.toFixed(2)}`, 'success');
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
    document.getElementById('loading-overlay').classList.add('active'); 
}

function hideLoading() { 
    document.getElementById('loading-overlay').classList.remove('active'); 
}

function showToast(m, t='info') { 
    const toast = document.getElementById('toast'); 
    toast.textContent = m; 
    toast.className = `toast ${t} active`; 
    setTimeout(() => toast.classList.remove('active'), 3000); 
}

// Global functions for inline onclick handlers
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.handleSimpleLogin = handleSimpleLogin;
