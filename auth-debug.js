// AUTHENTICATION TROUBLESHOOTING SCRIPT
// Copy and paste this into browser console to diagnose the issue

console.log('🔍 AUTHENTICATION DIAGNOSTIC');
console.log('='.repeat(50));

// Check current authentication state
console.log('Current Auth State:');
const currentUser = window.auth.currentUser;
if (currentUser) {
    console.log('✅ Signed in as:', currentUser.email);
    console.log('User ID:', currentUser.uid);
} else {
    console.log('❌ No user currently signed in');
}

// Check what's in localStorage (old data cache)
console.log('\nLocal Storage Check:');
const localExpenses = localStorage.getItem('expenses');
const localIncome = localStorage.getItem('income');
if (localExpenses || localIncome) {
    console.log('⚠️  Old local data found in browser storage');
    console.log('- Expenses:', localExpenses ? 'Present' : 'None');
    console.log('- Income:', localIncome ? 'Present' : 'None');
} else {
    console.log('✅ No conflicting local data');
}

// Check what the app thinks is loaded
console.log('\nApp Data State:');
if (window.expenseTracker) {
    console.log('- Expenses loaded:', window.expenseTracker.expenses.length);
    console.log('- Income loaded:', window.expenseTracker.income.length);
    console.log('- Current user in app:', window.expenseTracker.currentUser?.email || 'None');
}

// Show sync status
const syncStatus = document.getElementById('sync-status');
console.log('\nSync Status:', syncStatus?.textContent || 'Not found');

console.log('\n📋 RECOMMENDED ACTIONS:');
console.log('1. Sign out completely');
console.log('2. Clear browser cache/storage');  
console.log('3. Sign in with new email');
console.log('4. Verify fresh data');
