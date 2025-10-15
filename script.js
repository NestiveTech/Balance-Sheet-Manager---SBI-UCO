/**
 * Personal Balance Sheet Manager - Frontend JavaScript
 * Handles all UI interactions and backend communication
 * Web App URL: https://script.google.com/macros/s/AKfycby77OEZxMFC40frarynchg0CnEoj4195cULbW_DwnQn/dev
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://script.google.com/macros/s/AKfycby77OEZxMFC40frarynchg0CnEoj4195cULbW_DwnQn/dev';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentPage = 'dashboard';
let transactions = [];
let dashboardData = {};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('Initializing Personal Balance Sheet Manager...');
    
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Set default date for quick add
    const today = new Date();
    document.getElementById('new-date').valueAsDate = today;
    
    // Event listeners
    setupNavigationListeners();
    setupFormListeners();
    setupButtonListeners();
    
    // Load initial data
    console.log('Loading initial data...');
    loadDashboard();
    loadTransactions();
    loadSettings();
}

// ============================================================================
// NAVIGATION
// ============================================================================

function setupNavigationListeners() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            switchPage(page);
        });
    });
}

function switchPage(pageName) {
    console.log('Switching to page:', pageName);
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    // Update pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`${pageName}-page`).classList.add('active');
    
    currentPage = pageName;
    
    // Load data for the page
    if (pageName === 'dashboard') {
        loadDashboard();
    } else if (pageName === 'transactions') {
        loadTransactions();
    } else if (pageName === 'settings') {
        loadSettings();
    }
}

// ============================================================================
// FORM LISTENERS
// ============================================================================

function setupFormListeners() {
    // Quick add form
    document.getElementById('quick-add-form').addEventListener('submit', handleAddTransaction);
    
    // Settings form
    document.getElementById('settings-form').addEventListener('submit', handleSaveSettings);
    
    // Edit form
    document.getElementById('edit-form').addEventListener('submit', handleEditTransaction);
    document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
}

function setupButtonListeners() {
    // Recalculate button
    document.getElementById('recalculate-btn').addEventListener('click', handleRecalculate);
    
    // Import/Export buttons
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('export-btn').addEventListener('click', handleExport);
}

// ============================================================================
// API COMMUNICATION
// ============================================================================

async function apiCall(action, params = {}) {
    console.log(`API Call: ${action}`, params);
    showLoading();
    
    try {
        const url = `${API_BASE_URL}?action=${action}&timestamp=${Date.now()}`;
        
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log('API Response:', text.substring(0, 200));
        
        // Try to parse as JSON
        try {
            const data = JSON.parse(text);
            hideLoading();
            console.log('Parsed data:', data);
            return data;
        } catch (e) {
            // If HTML returned (auth page), handle appropriately
            if (text.includes('Google')) {
                hideLoading();
                showToast('Authentication required. Please check your Apps Script permissions.', 'error');
                return { success: false, error: 'Authentication required' };
            }
            hideLoading();
            return { success: false, error: 'Invalid response format' };
        }
    } catch (error) {
        hideLoading();
        console.error('API Error:', error);
        showToast('Connection error: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

async function apiCallPost(action, params = {}) {
    console.log(`API POST Call: ${action}`, params);
    showLoading();
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                params: params
            }),
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log('API Response:', text.substring(0, 200));
        
        try {
            const data = JSON.parse(text);
            hideLoading();
            console.log('Parsed data:', data);
            return data;
        } catch (e) {
            hideLoading();
            // For write operations, assume success if no error
            return { success: true, message: 'Operation completed' };
        }
    } catch (error) {
        hideLoading();
        console.error('API Error:', error);
        showToast('Connection error: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

// ============================================================================
// DASHBOARD
// ============================================================================

async function loadDashboard() {
    console.log('Loading dashboard...');
    const result = await apiCall('getDashboard');
    
    if (result.success && result.data) {
        dashboardData = result.data;
        renderDashboard();
        console.log('Dashboard loaded successfully');
    } else {
        showToast('Failed to load dashboard data', 'error');
        console.error('Dashboard load failed:', result);
    }
}

function renderDashboard() {
    document.getElementById('salary-value').textContent = formatCurrency(dashboardData.salary);
    document.getElementById('sbi-gross-value').textContent = formatCurrency(dashboardData.gross_sbi);
    document.getElementById('sbi-net-value').textContent = formatCurrency(dashboardData.net_sbi);
    document.getElementById('uco-gross-value').textContent = formatCurrency(dashboardData.gross_uco);
    document.getElementById('uco-net-value').textContent = formatCurrency(dashboardData.net_uco);
    document.getElementById('combined-gross-value').textContent = formatCurrency(dashboardData.combined_gross);
    document.getElementById('combined-net-value').textContent = formatCurrency(dashboardData.combined_net);
    document.getElementById('last-updated').textContent = formatDateTime(dashboardData.last_updated);
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

async function loadTransactions() {
    console.log('Loading transactions...');
    const result = await apiCall('getTransactions');
    
    if (result.success && result.data) {
        transactions = result.data;
        renderTransactions();
        updateSummaryStrip();
        console.log(`Loaded ${transactions.length} transactions`);
    } else {
        showToast('Failed to load transactions', 'error');
        console.error('Transactions load failed:', result);
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactions-tbody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-light);">No transactions found. Add your first transaction above.</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
        .map((tx, index) => `
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

function updateSummaryStrip() {
    const totalExpenses = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const sbiExpenses = transactions.filter(tx => tx.bank === 'sbi').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const ucoExpenses = transactions.filter(tx => tx.bank === 'uco').reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('sbi-expenses').textContent = formatCurrency(sbiExpenses);
    document.getElementById('uco-expenses').textContent = formatCurrency(ucoExpenses);
}

async function handleAddTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        date: document.getElementById('new-date').value,
        description: document.getElementById('new-description').value,
        amount: parseFloat(document.getElementById('new-amount').value),
        bank: document.getElementById('new-bank').value
    };
    
    console.log('Adding transaction:', transaction);
    
    // Validation
    if (!validateTransaction(transaction)) {
        return;
    }
    
    const result = await apiCallPost('addTransaction', transaction);
    
    if (result.success) {
        showToast('Transaction added successfully! ✅', 'success');
        document.getElementById('quick-add-form').reset();
        document.getElementById('new-date').valueAsDate = new Date();
        
        // Reload data after a short delay
        setTimeout(async () => {
            await loadTransactions();
            await loadDashboard();
        }, 1000);
    } else {
        showToast(result.error || 'Failed to add transaction', 'error');
    }
}

function editTransaction(id) {
    console.log('Editing transaction:', id);
    const tx = transactions.find(t => t.id === id);
    if (!tx) {
        showToast('Transaction not found', 'error');
        return;
    }
    
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
    const transaction = {
        date: document.getElementById('edit-date').value,
        description: document.getElementById('edit-description').value,
        amount: parseFloat(document.getElementById('edit-amount').value),
        bank: document.getElementById('edit-bank').value
    };
    
    console.log('Updating transaction:', id, transaction);
    
    if (!validateTransaction(transaction)) {
        return;
    }
    
    const result = await apiCallPost('updateTransaction', { id, transaction });
    
    if (result.success) {
        showToast('Transaction updated successfully! ✅', 'success');
        closeEditModal();
        
        setTimeout(async () => {
            await loadTransactions();
            await loadDashboard();
        }, 1000);
    } else {
        showToast(result.error || 'Failed to update transaction', 'error');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    console.log('Deleting transaction:', id);
    
    const result = await apiCallPost('deleteTransaction', { id });
    
    if (result.success) {
        showToast('Transaction deleted successfully! 🗑️', 'success');
        
        setTimeout(async () => {
            await loadTransactions();
            await loadDashboard();
        }, 1000);
    } else {
        showToast(result.error || 'Failed to delete transaction', 'error');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

// ============================================================================
// SETTINGS
// ============================================================================

async function loadSettings() {
    console.log('Loading settings...');
    const result = await apiCall('getSettings');
    
    if (result.success && result.data) {
        const settings = result.data;
        document.getElementById('salary-input').value = settings.salary_amount || 0;
        document.getElementById('sbi-opening-input').value = settings.opening_balance_sbi || 0;
        document.getElementById('uco-opening-input').value = settings.opening_balance_uco || 0;
        console.log('Settings loaded successfully');
    } else {
        showToast('Failed to load settings', 'error');
        console.error('Settings load failed:', result);
    }
}

async function handleSaveSettings(e) {
    e.preventDefault();
    
    const settings = {
        salary_amount: parseFloat(document.getElementById('salary-input').value),
        opening_balance_sbi: parseFloat(document.getElementById('sbi-opening-input').value),
        opening_balance_uco: parseFloat(document.getElementById('uco-opening-input').value)
    };
    
    console.log('Saving settings:', settings);
    
    if (isNaN(settings.salary_amount) || settings.salary_amount < 0) {
        showToast('Invalid salary amount', 'error');
        return;
    }
    if (isNaN(settings.opening_balance_sbi) || settings.opening_balance_sbi < 0) {
        showToast('Invalid SBI opening balance', 'error');
        return;
    }
    if (isNaN(settings.opening_balance_uco) || settings.opening_balance_uco < 0) {
        showToast('Invalid UCO opening balance', 'error');
        return;
    }
    
    const result = await apiCallPost('updateSettings', settings);
    
    if (result.success) {
        showToast('Settings saved successfully! ✅', 'success');
        
        setTimeout(async () => {
            await loadDashboard();
        }, 1000);
    } else {
        showToast(result.error || 'Failed to save settings', 'error');
    }
}

async function handleRecalculate() {
    console.log('Recalculating...');
    showToast('Recalculating all balances...', 'info');
    
    await Promise.all([
        loadDashboard(),
        loadTransactions()
    ]);
    
    showToast('Recalculated successfully! ✅', 'success');
}

// ============================================================================
// IMPORT/EXPORT
// ============================================================================

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('Importing file:', file.name);
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
        const text = event.target.result;
        const rows = parseCSV(text);
        
        if (rows.length === 0) {
            showToast('No data found in file', 'error');
            return;
        }
        
        console.log(`Parsed ${rows.length} rows from CSV`);
        
        const result = await apiCallPost('importTransactions', { data: rows });
        
        if (result.success) {
            showToast(`${result.message || 'Import completed'} ✅`, 'success');
            
            setTimeout(async () => {
                await loadTransactions();
                await loadDashboard();
            }, 1500);
        } else {
            showToast(result.error || 'Failed to import data', 'error');
        }
    };
    
    reader.onerror = () => {
        showToast('Failed to read file', 'error');
    };
    
    reader.readAsText(file);
    e.target.value = '';
}

async function handleExport() {
    console.log('Exporting data...');
    const result = await apiCall('exportToCSV');
    
    if (result.success && result.data) {
        const blob = new Blob([result.data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `balance_sheet_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('Export completed successfully! 📤', 'success');
    } else {
        showToast('Failed to export data', 'error');
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateTransaction(tx) {
    if (!tx.date) {
        showToast('Date is required', 'error');
        return false;
    }
    
    if (!tx.description || tx.description.trim() === '') {
        showToast('Description is required', 'error');
        return false;
    }
    
    if (isNaN(tx.amount) || tx.amount <= 0) {
        showToast('Amount must be a positive number', 'error');
        return false;
    }
    
    if (tx.bank !== 'sbi' && tx.bank !== 'uco') {
        showToast('Please select a valid bank (SBI or UCO)', 'error');
        return false;
    }
    
    return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value) {
    const num = parseFloat(value || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(isoString) {
    if (!isoString) return 'Never';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('en-IN', {
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

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
        // Handle quoted fields
        const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
        return values.map(v => v.trim().replace(/^"(.*)"$/, '$1'));
    });
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

// Make functions globally accessible for inline onclick handlers
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;

// Log initialization complete
console.log('Personal Balance Sheet Manager initialized successfully!');
