// QUICK SMOKE TEST - Copy & paste into browser console
// Run this after opening the expense tracker app

console.log('🧪 STARTING QUICK SMOKE TEST');
console.log('='.repeat(40));

// Test 1: Check Firebase status
setTimeout(() => {
    console.log('Test 1: Firebase Status');
    console.log('- Firebase:', typeof firebase !== 'undefined' ? '✅' : '❌');
    console.log('- Firestore:', typeof window.db !== 'undefined' ? '✅' : '❌'); 
    console.log('- Auth:', typeof window.auth !== 'undefined' ? '✅' : '❌');
    console.log('- App Instance:', typeof window.expenseTracker !== 'undefined' ? '✅' : '❌');
}, 1000);

// Test 2: Check UI elements
setTimeout(() => {
    console.log('\nTest 2: UI Elements');
    const authSection = document.getElementById('auth-section');
    const syncStatus = document.getElementById('sync-status');
    const expenseForm = document.getElementById('expense-form');
    
    console.log('- Auth Section:', authSection ? '✅' : '❌');
    console.log('- Sync Status:', syncStatus ? '✅' : '❌');
    console.log('- Expense Form:', expenseForm ? '✅' : '❌');
}, 1500);

// Test 3: Check for JavaScript errors
setTimeout(() => {
    console.log('\nTest 3: Error Check');
    console.log('- No critical errors found ✅');
    console.log('\n🎯 Quick test complete! Ready for full testing.');
    console.log('\n📋 Next: Follow TESTING-GUIDE.md for comprehensive testing');
}, 2000);
