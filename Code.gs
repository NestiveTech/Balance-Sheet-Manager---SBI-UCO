/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MULTI-USER BALANCE SHEET - AUTO-CREATE MASTER DATABASE
 * Version 4.1 FINAL - Auto Database + User Drive Ownership + Custom Banks
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Master database - will be auto-created if not exists
let MASTER_SHEET_ID = '1QQhy6J4MjRK9dr-2mSzZ1V1VakR1wREIQ20C2O2yG8w';
const USERS_TAB = 'Users';
const MASTER_SHEET_NAME = 'Balance Sheet - MASTER DATABASE';

// ════════════════════════════════════════════════════════════
// AUTO-CREATE MASTER DATABASE IF NOT EXISTS
// ════════════════════════════════════════════════════════════

function getMasterDatabase() {
  try {
    // Try to get from script properties first
    const storedId = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
    if (storedId) {
      MASTER_SHEET_ID = storedId;
    }
    
    // Try to open existing master sheet
    const masterSheet = SpreadsheetApp.openById(MASTER_SHEET_ID);
    return masterSheet;
  } catch (error) {
    // Master sheet doesn't exist or invalid ID, create new one
    Logger.log('⚠️ Master database not found, creating new one...');
    return createMasterDatabase();
  }
}

function createMasterDatabase() {
  try {
    // Create new master spreadsheet
    const newMaster = SpreadsheetApp.create(MASTER_SHEET_NAME);
    const newId = newMaster.getId();
    
    Logger.log('✅ Created new master database: ' + newId);
    
    // Initialize Users tab
    let usersSheet = newMaster.getSheets()[0];
    usersSheet.setName(USERS_TAB);
    usersSheet.getRange('A1:D1').setValues([['Email', 'Spreadsheet ID', 'Created', 'Last Login']]);
    usersSheet.getRange('A1:D1')
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontSize(11);
    usersSheet.setColumnWidths(1, 1, 250); // Email column
    usersSheet.setColumnWidths(2, 1, 300); // Sheet ID column
    usersSheet.setColumnWidths(3, 2, 180); // Date columns
    usersSheet.setFrozenRows(1);
    
    SpreadsheetApp.flush();
    
    // Update the MASTER_SHEET_ID in script properties
    PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', newId);
    MASTER_SHEET_ID = newId;
    
    Logger.log('✅ Master database initialized successfully');
    Logger.log('📋 Master Sheet ID: ' + newId);
    Logger.log('🔗 URL: ' + newMaster.getUrl());
    
    return newMaster;
  } catch (error) {
    Logger.log('❌ Failed to create master database: ' + error);
    throw error;
  }
}

// ════════════════════════════════════════════════════════════
// MAIN API HANDLER
// ════════════════════════════════════════════════════════════

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'ping';
  const callback = params.callback || null;
  const userEmail = params.userEmail || null;
  
  let result = {};
  
  try {
    if (!userEmail && action !== 'ping' && action !== 'getMasterInfo') {
      return createResponse({ success: false, error: 'No user email provided' }, callback);
    }
    
    switch(action) {
      case 'initUser':
        result = initializeUserSpreadsheet(userEmail);
        break;
      case 'getDashboard':
        result = getDashboard(userEmail);
        break;
      case 'getSettings':
        result = getSettings(userEmail);
        break;
      case 'updateSettings':
        result = updateSettings(userEmail, params);
        break;
      case 'getBanks':
        result = getBanks(userEmail);
        break;
      case 'addBank':
        result = addBank(userEmail, params.bankName, params.bankCode, params.bankColor);
        break;
      case 'deleteBank':
        result = deleteBank(userEmail, params.bankCode);
        break;
      case 'getTransactions':
        result = getTransactions(userEmail);
        break;
      case 'addTransaction':
        result = addTransaction(userEmail, {
          date: params.date,
          description: params.description ? decodeURIComponent(params.description) : '',
          amount: params.amount,
          bank: params.bank
        });
        break;
      case 'updateTransaction':
        result = updateTransaction(userEmail, params.id, {
          date: params.date,
          description: params.description ? decodeURIComponent(params.description) : '',
          amount: params.amount,
          bank: params.bank
        });
        break;
      case 'deleteTransaction':
        result = deleteTransaction(userEmail, params.id);
        break;
      case 'rolloverMonth':
        result = rolloverMonth(userEmail);
        break;
      case 'exportToCSV':
        result = exportToCSV(userEmail);
        break;
      case 'getMasterInfo':
        // Special action to get master database info
        const master = getMasterDatabase();
        result = {
          success: true,
          masterId: master.getId(),
          url: master.getUrl()
        };
        break;
      case 'ping':
        result = { 
          status: 'API Active', 
          version: '4.1 FINAL', 
          timestamp: new Date().toISOString(),
          features: ['Auto-Database', 'User-Drive', 'Custom-Banks']
        };
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }
  
  return createResponse(result, callback);
}

function createResponse(data, callback) {
  const jsonString = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════
// USER SPREADSHEET MANAGEMENT
// ════════════════════════════════════════════════════════════

function initializeUserSpreadsheet(userEmail) {
  try {
    if (!userEmail) {
      return { success: false, error: 'Email is required' };
    }
    
    const existingSheet = getUserSpreadsheet(userEmail);
    if (existingSheet) {
      return { 
        success: true, 
        sheetId: existingSheet.getId(),
        sheetUrl: existingSheet.getUrl(),
        message: 'Existing spreadsheet found',
        newUser: false
      };
    }
    
    // Create new spreadsheet
    const newSheet = SpreadsheetApp.create('Balance Sheet - ' + userEmail.split('@')[0]);
    const sheetId = newSheet.getId();
    
    // Transfer ownership to user's Drive
    try {
      const file = DriveApp.getFileById(sheetId);
      file.addEditor(userEmail);
      file.setOwner(userEmail);
      Logger.log('✅ Spreadsheet ownership transferred to: ' + userEmail);
    } catch (ownerError) {
      Logger.log('⚠️ Could not transfer ownership: ' + ownerError);
      try {
        DriveApp.getFileById(sheetId).addEditor(userEmail);
        Logger.log('✅ User added as editor: ' + userEmail);
      } catch (e) {
        Logger.log('⚠️ Could not add editor: ' + e);
      }
    }
    
    initializeSheetStructure(sheetId);
    registerUserInMaster(userEmail, sheetId);
    
    return { 
      success: true, 
      sheetId: sheetId,
      sheetUrl: newSheet.getUrl(),
      message: 'New spreadsheet created in your Drive',
      newUser: true
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function getUserSpreadsheet(userEmail) {
  try {
    const masterSheet = getMasterDatabase(); // Auto-creates if needed
    let usersSheet = masterSheet.getSheetByName(USERS_TAB);
    
    if (!usersSheet) {
      usersSheet = masterSheet.insertSheet(USERS_TAB);
      usersSheet.getRange('A1:D1').setValues([['Email', 'Spreadsheet ID', 'Created', 'Last Login']]);
      usersSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      return null;
    }
    
    if (usersSheet.getLastRow() < 2) {
      return null; // No users yet
    }
    
    const data = usersSheet.getRange(2, 1, usersSheet.getLastRow() - 1, 4).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === userEmail && data[i][1]) {
        try {
          const userSheet = SpreadsheetApp.openById(data[i][1]);
          usersSheet.getRange(i + 2, 4).setValue(new Date().toISOString());
          SpreadsheetApp.flush();
          return userSheet;
        } catch (e) {
          Logger.log('⚠️ Could not open user sheet: ' + e);
          return null;
        }
      }
    }
    return null;
  } catch (error) {
    Logger.log('❌ Error in getUserSpreadsheet: ' + error);
    return null;
  }
}

function registerUserInMaster(email, sheetId) {
  try {
    const masterSheet = getMasterDatabase(); // Auto-creates if needed
    let usersSheet = masterSheet.getSheetByName(USERS_TAB);
    
    if (!usersSheet) {
      usersSheet = masterSheet.insertSheet(USERS_TAB);
      usersSheet.getRange('A1:D1').setValues([['Email', 'Spreadsheet ID', 'Created', 'Last Login']]);
      usersSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    }
    
    const now = new Date().toISOString();
    usersSheet.appendRow([email, sheetId, now, now]);
    SpreadsheetApp.flush();
    
    Logger.log('✅ User registered in master: ' + email);
    return { success: true };
  } catch (error) {
    Logger.log('❌ Error registering user: ' + error);
    return { success: false, error: error.toString() };
  }
}

function initializeSheetStructure(sheetId) {
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheets = ss.getSheets();
    
    if (sheets.length > 0 && sheets[0].getName() === 'Sheet1') {
      sheets[0].setName('Settings');
    }
    
    let settingsSheet = ss.getSheetByName('Settings');
    if (!settingsSheet) settingsSheet = ss.insertSheet('Settings');
    settingsSheet.clear();
    settingsSheet.getRange('A1:B2').setValues([
      ['Setting', 'Value'],
      ['salary_amount', 0]
    ]);
    settingsSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    
    let banksSheet = ss.getSheetByName('Banks');
    if (!banksSheet) {
      banksSheet = ss.insertSheet('Banks');
      banksSheet.getRange('A1:D1').setValues([['code', 'name', 'color', 'opening_balance']]);
      banksSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
      banksSheet.appendRow(['sbi', 'SBI Bank', '#00529B', 0]);
      banksSheet.appendRow(['uco', 'UCO Bank', '#ED7D31', 0]);
    }
    
    let transactionsSheet = ss.getSheetByName('Transactions');
    if (!transactionsSheet) {
      transactionsSheet = ss.insertSheet('Transactions');
      transactionsSheet.getRange('A1:E1').setValues([['id', 'date', 'description', 'amount', 'bank']]);
      transactionsSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    }
    
    let summarySheet = ss.getSheetByName('Summary');
    if (!summarySheet) {
      summarySheet = ss.insertSheet('Summary');
      summarySheet.getRange('A1:B1').setValues([['Metric', 'Value']]);
      summarySheet.getRange('A1:B1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
    }
    
    SpreadsheetApp.flush();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ════════════════════════════════════════════════════════════
// BANKS MANAGEMENT
// ════════════════════════════════════════════════════════════

function getBanks(userEmail) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Banks');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };
    
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const banks = data.filter(r => r[0]).map(r => ({
      code: String(r[0]).toLowerCase(),
      name: r[1] || '',
      color: r[2] || '#64748b',
      opening_balance: parseFloat(r[3]) || 0
    }));
    return { success: true, data: banks };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function addBank(userEmail, bankName, bankCode, bankColor) {
  try {
    if (!bankName || !bankCode) return { success: false, error: 'Bank name and code required' };
    
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Banks');
    const code = String(bankCode).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === code) {
        return { success: false, error: 'Bank code already exists' };
      }
    }
    
    sheet.appendRow([code, bankName, bankColor || '#64748b', 0]);
    SpreadsheetApp.flush();
    
    return { success: true, bank: { code, name: bankName, color: bankColor || '#64748b', opening_balance: 0 } };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function deleteBank(userEmail, bankCode) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Banks');
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === String(bankCode).toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) return { success: false, error: 'Bank not found' };
    
    sheet.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════

function getDashboard(userEmail) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const banks = getBanks(userEmail);
    const trans = getTransactions(userEmail);
    const sett = getSettings(userEmail);
    
    if (!banks.success || !trans.success || !sett.success) {
      return { success: false, error: 'Failed to load data' };
    }
    
    const bankData = {};
    let combinedOpening = 0;
    let combinedExpenses = 0;
    let combinedTotal = 0;
    let combinedNet = 0;
    
    banks.data.forEach(bank => {
      const expenses = trans.data.filter(t => t.bank === bank.code).reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const opening = parseFloat(bank.opening_balance) || 0;
      const net = opening - expenses;
      
      bankData[bank.code] = {
        name: bank.name,
        color: bank.color,
        opening_balance: opening,
        expenses: expenses,
        net_balance: net
      };
      
      combinedOpening += opening;
      combinedExpenses += expenses;
      combinedTotal += opening;
      combinedNet += net;
    });
    
    return {
      success: true,
      data: {
        salary: sett.data.salary_amount || 0,
        banks: bankData,
        combined_opening: combinedOpening,
        combined_total: combinedTotal,
        combined_expenses: combinedExpenses,
        combined_net: combinedNet,
        last_updated: new Date().toISOString(),
        sheetUrl: userSheet.getUrl()
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════

function getSettings(userEmail) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Settings');
    if (!sheet || sheet.getLastRow() < 2) {
      return { success: true, data: { salary_amount: 0 } };
    }
    
    const data = sheet.getRange('A2:B2').getValues();
    return { 
      success: true, 
      data: {
        salary_amount: data[0][1] || 0
      }
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateSettings(userEmail, params) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const settingsSheet = userSheet.getSheetByName('Settings');
    settingsSheet.getRange('B2').setValue(parseFloat(params.salary_amount) || 0);
    
    const banksSheet = userSheet.getSheetByName('Banks');
    const bankData = banksSheet.getDataRange().getValues();
    
    for (let i = 1; i < bankData.length; i++) {
      const bankCode = String(bankData[i][0]).toLowerCase();
      const paramKey = 'opening_balance_' + bankCode;
      if (params[paramKey] !== undefined) {
        banksSheet.getRange(i + 1, 4).setValue(parseFloat(params[paramKey]) || 0);
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ════════════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════════════

function getTransactions(userEmail) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Transactions');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, data: [] };
    
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    const transactions = data.filter(r => r[0]).map(r => ({
      id: r[0],
      date: formatDate(r[1]),
      description: r[2] || '',
      amount: parseFloat(r[3]) || 0,
      bank: String(r[4]).toLowerCase()
    }));
    return { success: true, data: transactions };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function addTransaction(userEmail, tx) {
  try {
    if (!tx.date) return { success: false, error: 'Date required' };
    const amt = parseFloat(tx.amount);
    if (isNaN(amt) || amt <= 0) return { success: false, error: 'Invalid amount' };
    
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Transactions');
    const lastRow = sheet.getLastRow();
    const newId = lastRow > 1 ? Math.max(...sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat()) + 1 : 1;
    
    sheet.appendRow([newId, new Date(tx.date), String(tx.description || ''), amt, String(tx.bank).toLowerCase()]);
    SpreadsheetApp.flush();
    
    return { success: true, id: newId };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function updateTransaction(userEmail, id, tx) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Transactions');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, error: 'No transactions found' };
    
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) { rowIndex = i + 2; break; }
    }
    if (rowIndex === -1) return { success: false, error: 'Transaction not found' };
    
    sheet.getRange(rowIndex, 2, 1, 4).setValues([[
      new Date(tx.date), 
      String(tx.description || ''), 
      parseFloat(tx.amount), 
      String(tx.bank).toLowerCase()
    ]]);
    SpreadsheetApp.flush();
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function deleteTransaction(userEmail, id) {
  try {
    const userSheet = getUserSpreadsheet(userEmail);
    if (!userSheet) return { success: false, error: 'Spreadsheet not found' };
    
    const sheet = userSheet.getSheetByName('Transactions');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, error: 'No transactions found' };
    
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == id) { rowIndex = i + 2; break; }
    }
    if (rowIndex === -1) return { success: false, error: 'Transaction not found' };
    
    sheet.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════

function rolloverMonth(userEmail) {
  try {
    const dashboard = getDashboard(userEmail);
    if (!dashboard.success) return { success: false, error: 'Failed to get dashboard' };
    
    const userSheet = getUserSpreadsheet(userEmail);
    const banksSheet = userSheet.getSheetByName('Banks');
    const bankData = banksSheet.getDataRange().getValues();
    
    const results = {};
    for (let i = 1; i < bankData.length; i++) {
      const bankCode = String(bankData[i][0]).toLowerCase();
      if (dashboard.data.banks[bankCode]) {
        const netBalance = dashboard.data.banks[bankCode].net_balance;
        banksSheet.getRange(i + 1, 4).setValue(netBalance);
        results[bankCode] = netBalance;
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true, newBalances: results };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function exportToCSV(userEmail) {
  try {
    const d = getDashboard(userEmail);
    const t = getTransactions(userEmail);
    if (!d.success || !t.success) return { success: false, error: 'Failed to load' };
    
    let csv = 'Balance Sheet Export\n\n';
    csv += 'SUMMARY\nMetric,Value\n';
    csv += `Salary,${d.data.salary}\n`;
    
    Object.keys(d.data.banks).forEach(code => {
      const bank = d.data.banks[code];
      csv += `${bank.name} Opening,${bank.opening_balance}\n`;
      csv += `${bank.name} Expenses,${bank.expenses}\n`;
      csv += `${bank.name} Net,${bank.net_balance}\n`;
    });
    
    csv += '\nTRANSACTIONS\nID,Date,Description,Amount,Bank\n';
    t.data.forEach(tx => {
      csv += `${tx.id},${tx.date},"${tx.description}",${tx.amount},${tx.bank}\n`;
    });
    return { success: true, data: csv };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}
