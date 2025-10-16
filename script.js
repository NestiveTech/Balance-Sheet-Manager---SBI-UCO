
/**
 * Personal Balance Sheet Manager - Frontend
 * Uses JSONP to bypass CORS restrictions
 */

// REPLACE THIS WITH YOUR /exec URL (NOT /dev)
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxHOYtvKHeb5z0bJm7w84bal-169HYBgjrkrSSeUFrkA5c3UF7-pTql8tXj2h_KL54wlg/exec';

let transactions = [];
let dashboardData = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing...');
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    document.getElementById('new-date').valueAsDate = new Date();
    
    setupListeners();
    loadDashboard();
    loadTransactions();
    loadSettings();
});

// ============================================================================
// API CALLS USING JSONP
// ============================================================================

function apiCallJSONP(action) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Request timeout'));
        }, 30000);
        
        window[callbackName] = (data) => {
            clearTimeout(timeout);
            cleanup();
            resolve(data);
        };
        
        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }
        
        script.src = `${API_BASE_URL}?action=${action}&callback=${callbackName}&_=${Date.now()}`;
        script.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error('Script load error'));
        };
        
        document.head.appendChild(script);
    });
}

function apiCallPOST(action, params = {}) {
    showLoading();
    return fetch(API_BASE_URL, {
        method: 'POST',
        body: JSON.stringify({ action, params }),
        headers: { 'Content-Type': 'text/plain' },
        mode: 'no-cors'
    })
    .then(() => {
        hideLoading();
        return { success: true };
    })
    .catch(err => {
        hideLoading();
        console.error('Error:', err);
        return { success: false, error: err.message };
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });
    
    document.getElementById('quick-add-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    document.getElementById('edit-form').addEventListener('submit', handleEditTransaction);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('recalculate-btn').addEventListener('click', handleRecalculate);
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('export-btn').addEventListener('click', handleExport);
}

function switchPage(pageName) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    if (pageName === 'dashboard') loadDashboard();
    else if (pageName === 'transactions') loadTransactions();
    else if (pageName === 'settings') loadSettings();
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard() {
    showLoading();
    try {
        const result = await apiCallJSONP('getDashboard');
        hideLoading();
        
        if (result.success && result.data) {
            dashboardData = result.data;
            document.getElementById('salary-value').textContent = formatCurrency(dashboardData.salary);
            document.getElementById('sbi-gross-value').textContent = formatCurrency(dashboardData.gross_sbi);
            document.getElementById('sbi-net-value').textContent = formatCurrency(dashboardData.net_sbi);
            document.getElementById('uco-gross-value').textContent = formatCurrency(dashboardData.gross_uco);
            document.getElementById('uco-net-value').textContent = formatCurrency(dashboardData.net_uco);
            document.getElementById('combined-gross-value').textContent = formatCurrency(dashboardData.combined_gross);
            document.getElementById('combined-net-value').textContent = formatCurrency(dashboardData.combined_net);
            document.getElementById('last-updated').textContent = formatDateTime(dashboardData.last_updated);
        } else {
            showToast('Failed to load dashboard', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Error: ' + error.message, 'error');
    }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

async function loadTransactions() {
    showLoading();
    try {
        const result = await apiCallJSONP('getTransactions');
        hideLoading();
        
        if (result.success && result.data) {
            transactions = result.data;
            renderTransactions();
            updateSummary();
        } else {
            showToast('Failed to load transactions', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('Error: ' + error.message, 'error');
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b;">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).map((tx, i) => `
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
    const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const sbi = transactions.filter(tx => tx.bank === 'sbi').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const uco = transactions.filter(tx => tx.bank === 'uco').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    document.getElementById('total-expenses').textContent = formatCurrency(total);
    document.getElementById('sbi-expenses').textContent = formatCurrency(sbi);
    document.getElementById('uco-expenses').textContent = formatCurrency(uco);
}

async function handleAddTransaction(e) {
    e.preventDefault();
    const tx = {
        date: document.getElementById('new-date').value,
        description: document.getElementById('new-description').value,
        amount: parseFloat(document.getElementById('new-amount').value),
        bank: document.getElementById('new-bank').value
    };
    
    if (!validateTransaction(tx)) return;
    
    await apiCallPOST('addTransaction', tx);
    showToast('Added! ✅ Refreshing...', 'success');
    document.getElementById('quick-add-form').reset();
    document.getElementById('new-date').valueAsDate = new Date();
    
    setTimeout(() => {
        loadTransactions();
        loadDashboard();
    }, 1500);
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
    const id = parseInt(document.getElementById('edit-id').value);
    const tx = {
        date: document.getElementById('edit-date').value,
        description: document.getElementById('edit-description').value,
        amount: parseFloat(document.getElementById('edit-amount').value),
        bank: document.getElementById('edit-bank').value
    };
    
    if (!validateTransaction(tx)) return;
    
    await apiCallPOST('updateTransaction', { id, transaction: tx });
    showToast('Updated! ✅ Refreshing...', 'success');
    closeEditModal();
    
    setTimeout(() => {
        loadTransactions();
        loadDashboard();
    }, 1500);
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    await apiCallPOST('deleteTransaction', { id });
    showToast('Deleted! 🗑️ Refreshing...', 'success');
    
    setTimeout(() => {
        loadTransactions();
        loadDashboard();
    }, 1500);
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

// ============================================================================
// SETTINGS
// ============================================================================

async function loadSettings() {
    try {
        const result = await apiCallJSONP('getSettings');
        if (result.success && result.data) {
            document.getElementById('salary-input').value = result.data.salary_amount || 0;
            document.getElementById('sbi-opening-input').value = result.data.opening_balance_sbi || 0;
            document.getElementById('uco-opening-input').value = result.data.opening_balance_uco || 0;
        }
    } catch (error) {
        console.error('Settings error:', error);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const settings = {
        salary_amount: parseFloat(document.getElementById('salary-input').value),
        opening_balance_sbi: parseFloat(document.getElementById('sbi-opening-input').value),
        opening_balance_uco: parseFloat(document.getElementById('uco-opening-input').value)
    };
    
    await apiCallPOST('updateSettings', settings);
    showToast('Settings saved! ✅ Refreshing...', 'success');
    
    setTimeout(() => loadDashboard(), 1500);
}

async function handleRecalculate() {
    showToast('Recalculating...', 'info');
    await Promise.all([loadDashboard(), loadTransactions()]);
    showToast('Done! ✅', 'success');
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const rows = parseCSV(event.target.result);
        if (rows.length === 0) {
            showToast('No data found', 'error');
            return;
        }
        
        await apiCallPOST('importTransactions', { data: rows });
        showToast('Import started! Refreshing...', 'success');
        
        setTimeout(() => {
            loadTransactions();
            loadDashboard();
        }, 2000);
    };
    reader.readAsText(file);
    e.target.value = '';
}

async function handleExport() {
    showLoading();
    try {
        const result = await apiCallJSONP('exportToCSV');
        hideLoading();
        
        if (result.success && result.data) {
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_sheet_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Exported! 📤', 'success');
        }
    } catch (error) {
        hideLoading();
        showToast('Export failed', 'error');
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function validateTransaction(tx) {
    if (!tx.date) { showToast('Date required', 'error'); return false; }
    if (!tx.description.trim()) { showToast('Description required', 'error'); return false; }
    if (isNaN(tx.amount) || tx.amount <= 0) { showToast('Invalid amount', 'error'); return false; }
    if (tx.bank !== 'sbi' && tx.bank !== 'uco') { showToast('Select bank', 'error'); return false; }
    return true;
}

function formatCurrency(val) {
    return `₹${parseFloat(val||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function formatDateTime(iso) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString('en-IN', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseCSV(text) {
    return text.split('\n').filter(l => l.trim()).map(line => {
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        return values.map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    });
}

function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }
function showToast(msg, type='info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} active`;
    setTimeout(() => toast.classList.remove('active'), 3000);
}

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
