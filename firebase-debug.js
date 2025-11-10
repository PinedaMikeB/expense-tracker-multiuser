// Firebase Connection Debugger
// Open browser console and run this to check Firebase status

console.log('🔍 Firebase Debug Check');
console.log('='.repeat(50));

// Check if Firebase is loaded
console.log('Firebase loaded:', typeof firebase !== 'undefined');
console.log('Firestore available:', typeof window.db !== 'undefined');
console.log('Auth available:', typeof window.auth !== 'undefined');

// Check current auth state
window.auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User authenticated:', user.email);
        console.log('User ID:', user.uid);
    } else {
        console.log('❌ No user authenticated');
    }
});

// Check Firestore connection
try {
    window.db.enableNetwork().then(() => {
        console.log('✅ Firestore connected');
    });
} catch (error) {
    console.log('❌ Firestore connection error:', error);
}

// Test data write (if user is signed in)
function testFirestore() {
    const user = window.auth.currentUser;
    if (!user) {
        console.log('❌ Please sign in first to test Firestore');
        return;
    }
    
    window.db.collection('users').doc(user.uid).collection('test').add({
        message: 'Test connection',
        timestamp: new Date()
    }).then(() => {
        console.log('✅ Firestore write test successful');
    }).catch((error) => {
        console.log('❌ Firestore write test failed:', error);
    });
}

console.log('Run testFirestore() after signing in to test database writes');
