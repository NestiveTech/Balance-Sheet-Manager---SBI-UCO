/**
 * Personal Balance Sheet Manager - Frontend (WORKING)
 */

// ⚠️ REPLACE WITH YOUR /exec URL ⚠️
const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxHOYtvKHeb5z0bJm7w84bal-169HYBgjrkrSSeUFrkA5c3UF7-pTql8tXj2h_KL54wlg/exec';

let transactions = [];
let dashboardData = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 App starting...');
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    document.getElementById('new-date').valueAsDate = new Date();
    
    setupListeners();
    loadDashboard();
    loadTransactions();
    loadSettings();
});

function apiCall(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = 'cb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout'));
        }, 30000);
        
        window[callbackName] = (data) => {
            clearTimeout(timeout);
            cleanup();
            console.log(`✅ Response (${action}):`, data);
            resolve(data);
        };
        
        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        }
        
        const urlParams = new URLSearchParams({
            action: action,
            callback: callbackName,
            _t: Date.now(),
            ...params
        });
        
        script.src = `${API_BASE_URL}?${urlParams.toString()}`;
        script.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error('Script error'));
        };
        
        console.log(`📤 Request: ${action}`, params);
        document.head.appendChild(script);
    });
}

function setupListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });
    
    document.getElementById('quick-add-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    document.getElementById('edit-form').addEventListener('submit', handleEditTransaction);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('recalculate-btn').addEventListener('click', handleRecalculate);
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

async function loadDashboard() {
    showLoading();
    try {
        const result = await apiCall('getDashboard');
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
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Dashboard error: ' + error.message, 'error');
    }
}

async function loadTransactions() {
    showLoading();
    try {
        const result = await apiCall('getTransactions');
        hideLoading();
        
        if (result.success && result.data) {
            transactions = result.data;
            renderTransactions();
            updateSummary();
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Transactions error: ' + error.message, 'error');
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;">No transactions yet. Add one above! 👆</td></tr>';
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
        description: encodeURIComponent(document.getElementById('new-description').value),
        amount: parseFloat(document.getElementById('new-amount').value),
        bank: document.getElementById('new-bank').value
    };
    
    console.log('📝 Adding transaction:', tx);
    
    if (!tx.date) { showToast('❌ Date required', 'error'); return; }
    if (isNaN(tx.amount) || tx.amount <= 0) { showToast('❌ Invalid amount', 'error'); return; }
    if (!tx.bank) { showToast('❌ Select bank', 'error'); return; }
    
    showLoading();
    try {
        const result = await apiCall('addTransaction', tx);
        hideLoading();
        
        console.log('Response:', result);
        
        if (result.success) {
            showToast('✅ Transaction added! ID: ' + result.id, 'success');
            document.getElementById('quick-add-form').reset();
            document.getElementById('new-date').valueAsDate = new Date();
            
            setTimeout(() => {
                loadTransactions();
                loadDashboard();
            }, 500);
        } else {
            showToast('❌ Failed: ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
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
    
    const id = parseInt(document.getElementById('edit-id').value);
    const tx = {
        id: id,
        date: document.getElementById('edit-date').value,
        description: encodeURIComponent(document.getElementById('edit-description').value),
        amount: parseFloat(document.getElementById('edit-amount').value),
        bank: document.getElementById('edit-bank').value
    };
    
    showLoading();
    try {
        const result = await apiCall('updateTransaction', tx);
        hideLoading();
        
        if (result.success) {
            showToast('✅ Updated!', 'success');
            closeEditModal();
            setTimeout(() => {
                loadTransactions();
                loadDashboard();
            }, 500);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Delete this transaction?')) return;
    
    showLoading();
    try {
        const result = await apiCall('deleteTransaction', { id });
        hideLoading();
        
        if (result.success) {
            showToast('✅ Deleted!', 'success');
            setTimeout(() => {
                loadTransactions();
                loadDashboard();
            }, 500);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

async function loadSettings() {
    try {
        const result = await apiCall('getSettings');
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
    
    showLoading();
    try {
        const result = await apiCall('updateSettings', settings);
        hideLoading();
        
        if (result.success) {
            showToast('✅ Settings saved!', 'success');
            setTimeout(() => loadDashboard(), 500);
        } else {
            showToast('❌ ' + result.error, 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
    }
}

async function handleRecalculate() {
    await Promise.all([loadDashboard(), loadTransactions()]);
    showToast('✅ Recalculated!', 'success');
}

async function handleExport() {
    showLoading();
    try {
        const result = await apiCall('exportToCSV');
        hideLoading();
        
        if (result.success && result.data) {
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_sheet_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('✅ Exported!', 'success');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Export failed', 'error');
    }
}

function formatCurrency(val) {
    return `₹${parseFloat(val||0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function formatDateTime(iso) {
    if (!iso) return 'Never';
    try {
        return new Date(iso).toLocaleString('en-IN', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    } catch(e) {
        return iso;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

console.log('✅ App loaded!');
