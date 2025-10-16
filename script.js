/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PERSONAL BALANCE SHEET MANAGER - FRONTEND JAVASCRIPT
 * Version: 2.0 (With Present Balance)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// CONFIGURATION - ⚠️ UPDATE THIS WITH YOUR DEPLOYMENT URL ⚠️
// ============================================================================

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxHOYtvKHeb5z0bJm7w84bal-169HYBgjrkrSSeUFrkA5c3UF7-pTql8tXj2h_KL54wlg/exec';


// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let transactions = [];
let dashboardData = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('🚀 Personal Balance Sheet Manager v2.0');
    console.log('📅 Date:', new Date().toLocaleString());
    console.log('🔗 API URL:', API_BASE_URL);
    console.log('═══════════════════════════════════════════════════');
    
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default date to today
    document.getElementById('new-date').valueAsDate = new Date();
    
    // Setup all event listeners
    setupListeners();
    
    // Load initial data
    loadDashboard();
    loadTransactions();
    loadSettings();
});

// ============================================================================
// API COMMUNICATION (JSONP for cross-origin)
// ============================================================================

function apiCall(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonpCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const script = document.createElement('script');
        
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Request timeout (30s)'));
        }, 30000);
        
        window[callbackName] = (data) => {
            clearTimeout(timeout);
            cleanup();
            console.log(`✅ Response (${action}):`, data);
            resolve(data);
        };
        
        function cleanup() {
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }
        
        // Build URL with parameters
        const url = new URL(API_BASE_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('callback', callbackName);
        url.searchParams.set('_t', Date.now());
        
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });
        
        script.src = url.toString();
        script.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error('Script load error - Check your API_BASE_URL'));
        };
        
        console.log(`📤 Request: ${action}`, params);
        document.head.appendChild(script);
    });
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.getAttribute('data-page')));
    });
    
    // Forms
    document.getElementById('quick-add-form').addEventListener('submit', handleAddTransaction);
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    document.getElementById('edit-form').addEventListener('submit', handleEditTransaction);
    
    // Buttons
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('recalculate-btn').addEventListener('click', handleRecalculate);
    document.getElementById('export-btn').addEventListener('click', handleExport);
}

// ============================================================================
// PAGE NAVIGATION
// ============================================================================

function switchPage(pageName) {
    console.log('📄 Switching to page:', pageName);
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Update page visibility
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    // Load page data
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
        const result = await apiCall('getDashboard');
        hideLoading();
        
        if (result.success && result.data) {
            dashboardData = result.data;
            
            // Update all dashboard tiles
            document.getElementById('salary-value').textContent = formatCurrency(dashboardData.salary);
            
            // SBI
            document.getElementById('sbi-gross-value').textContent = formatCurrency(dashboardData.gross_sbi);
            document.getElementById('sbi-present-value').textContent = formatCurrency(dashboardData.present_sbi);
            document.getElementById('sbi-net-value').textContent = formatCurrency(dashboardData.net_sbi);
            
            // UCO
            document.getElementById('uco-gross-value').textContent = formatCurrency(dashboardData.gross_uco);
            document.getElementById('uco-present-value').textContent = formatCurrency(dashboardData.present_uco);
            document.getElementById('uco-net-value').textContent = formatCurrency(dashboardData.net_uco);
            
            // Combined
            document.getElementById('combined-gross-value').textContent = formatCurrency(dashboardData.combined_gross);
            document.getElementById('combined-present-value').textContent = formatCurrency(dashboardData.combined_present);
            document.getElementById('combined-net-value').textContent = formatCurrency(dashboardData.combined_net);
            
            // Timestamp
            document.getElementById('last-updated').textContent = formatDateTime(dashboardData.last_updated);
            
            console.log('✅ Dashboard loaded successfully');
        } else {
            showToast('❌ Failed to load dashboard', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
        console.error('Dashboard error:', error);
    }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

async function loadTransactions() {
    showLoading();
    try {
        const result = await apiCall('getTransactions');
        hideLoading();
        
        if (result.success && result.data) {
            transactions = result.data;
            renderTransactions();
            updateSummary();
            console.log(`✅ Loaded ${transactions.length} transactions`);
        } else {
            showToast('❌ Failed to load transactions', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
        console.error('Transactions error:', error);
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b;">No transactions yet. Add your first transaction above! 👆</td></tr>';
        return;
    }
    
    // Sort by date descending
    const sortedTransactions = transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sortedTransactions.map((tx, index) => `
        <tr>
            <td>${index + 1}</td>
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
    
    // Validate
    if (!tx.date) { showToast('❌ Date is required', 'error'); return; }
    if (isNaN(tx.amount) || tx.amount <= 0) { showToast('❌ Amount must be positive', 'error'); return; }
    if (!tx.bank) { showToast('❌ Please select a bank', 'error'); return; }
    
    showLoading();
    try {
        const result = await apiCall('addTransaction', tx);
        hideLoading();
        
        if (result.success) {
            showToast(`✅ Transaction added! ID: ${result.id}`, 'success');
            
            // Reset form
            document.getElementById('quick-add-form').reset();
            document.getElementById('new-date').valueAsDate = new Date();
            
            // Reload data
            setTimeout(() => {
                loadTransactions();
                loadDashboard();
            }, 500);
        } else {
            showToast('❌ Failed: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
        console.error('Add transaction error:', error);
    }
}

function editTransaction(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) {
        showToast('❌ Transaction not found', 'error');
        return;
    }
    
    console.log('✏️ Editing transaction:', tx);
    
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
            showToast('✅ Transaction updated successfully!', 'success');
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
    if (!confirm('🗑️ Are you sure you want to delete this transaction?')) {
        return;
    }
    
    console.log('🗑️ Deleting transaction:', id);
    
    showLoading();
    try {
        const result = await apiCall('deleteTransaction', { id });
        hideLoading();
        
        if (result.success) {
            showToast('✅ Transaction deleted successfully!', 'success');
            
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

// ============================================================================
// SETTINGS
// ============================================================================

async function loadSettings() {
    try {
        const result = await apiCall('getSettings');
        
        if (result.success && result.data) {
            const s = result.data;
            
            document.getElementById('salary-input').value = s.salary_amount || 0;
            document.getElementById('sbi-opening-input').value = s.opening_balance_sbi || 0;
            document.getElementById('sbi-present-input').value = s.present_balance_sbi || 0;
            document.getElementById('uco-opening-input').value = s.opening_balance_uco || 0;
            document.getElementById('uco-present-input').value = s.present_balance_uco || 0;
            
            console.log('✅ Settings loaded');
        }
    } catch (error) {
        console.error('Settings load error:', error);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    const settings = {
        salary_amount: parseFloat(document.getElementById('salary-input').value),
        opening_balance_sbi: parseFloat(document.getElementById('sbi-opening-input').value),
        present_balance_sbi: parseFloat(document.getElementById('sbi-present-input').value),
        opening_balance_uco: parseFloat(document.getElementById('uco-opening-input').value),
        present_balance_uco: parseFloat(document.getElementById('uco-present-input').value)
    };
    
    console.log('💾 Saving settings:', settings);
    
    showLoading();
    try {
        const result = await apiCall('updateSettings', settings);
        hideLoading();
        
        if (result.success) {
            showToast('✅ Settings saved successfully!', 'success');
            
            setTimeout(() => {
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

async function handleRecalculate() {
    showToast('🔄 Recalculating all balances...', 'info');
    
    await Promise.all([
        loadDashboard(),
        loadTransactions()
    ]);
    
    showToast('✅ Recalculation complete!', 'success');
}

// ============================================================================
// EXPORT
// ============================================================================

async function handleExport() {
    showLoading();
    try {
        const result = await apiCall('exportToCSV');
        hideLoading();
        
        if (result.success && result.data) {
            const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_sheet_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('✅ Exported successfully!', 'success');
            console.log('✅ CSV exported');
        } else {
            showToast('❌ Export failed', 'error');
        }
    } catch (error) {
        hideLoading();
        showToast('❌ Error: ' + error.message, 'error');
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value) {
    return `₹${parseFloat(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDateTime(isoString) {
    if (!isoString) return 'Never';
    try {
        return new Date(isoString).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} active`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// ============================================================================
// GLOBAL FUNCTIONS (for inline onclick handlers)
// ============================================================================

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;

// ============================================================================
// INITIALIZATION COMPLETE
// ============================================================================

console.log('✅ Personal Balance Sheet Manager initialized successfully!');
console.log('📌 Make sure you updated API_BASE_URL with your /exec URL!');
