// Expense Tracker Application - Firebase Cloud Sync Version
class ExpenseTracker {
    constructor() {
        this.expenses = [];
        this.income = [];
        this.pettyCash = [];
        this.categories = this.getDefaultCategories();
        this.incomeCategories = this.getDefaultIncomeCategories();
        this.selectedForPayment = new Set();
        this.currentUser = null;
        this.isOnline = true;
        
        // Wait for Firebase to initialize before starting the app
        this.waitForFirebase().then(() => {
            this.init();
        });
    }

    async waitForFirebase() {
        // Wait for Firebase to be available
        while (!window.firebase || !window.db || !window.auth) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Set up auth state listener
        window.auth.onAuthStateChanged((user) => {
            this.handleAuthStateChange(user);
        });
        
        console.log('🔥 Firebase ready');
    }

    async handleAuthStateChange(user) {
        this.currentUser = user;
        this.dataOwnerId = null;  // ID of whose data we're accessing
        this.isTeamMemberAccount = false;
        
        const loginForm = document.getElementById('login-form');
        const userInfo = document.getElementById('user-info');
        const userEmail = document.getElementById('user-email');
        const syncStatus = document.getElementById('sync-status');
        
        if (user) {
            // User is signed in
            loginForm.style.display = 'none';
            userInfo.style.display = 'flex';
            userEmail.textContent = user.email;
            syncStatus.textContent = 'Cloud Sync';
            syncStatus.style.color = '#4caf50';
            
            console.log('👤 User signed in:', user.email);
            
            // Check if this user is a team member (belongs to another owner)
            await this.checkTeamMembership();
            
            // Load data from cloud
            this.loadFromCloud();
        } else {
            // User is signed out
            loginForm.style.display = 'flex';
            userInfo.style.display = 'none';
            syncStatus.textContent = 'Local Storage';
            syncStatus.style.color = '#666';
            
            console.log('👤 User signed out');
            
            // Load from localStorage as fallback
            this.loadFromLocalStorage();
            this.updateUI();
        }
    }
    
    // Check if current user is a team member of another account
    async checkTeamMembership() {
        if (!this.currentUser) return;
        
        try {
            // Check THIS user's document (not owner's) to see if they're a team member
            const userDoc = await window.db.collection('users').doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                if (userData.isTeamMember && userData.ownerId) {
                    // This user is a team member - load owner's data
                    this.isTeamMemberAccount = true;
                    this.dataOwnerId = userData.ownerId;
                    this.userRole = userData.role || 'member';
                    
                    console.log('👥 Team member detected! Role:', this.userRole, 'Owner:', userData.ownerEmail);
                    
                    // Update UI to show team member status
                    const userEmailEl = document.getElementById('user-email');
                    if (userEmailEl) {
                        userEmailEl.textContent = `${this.currentUser.email} (${this.userRole})`;
                    }
                    
                    this.showNotification(`Logged in as ${this.userRole}. Accessing ${userData.ownerEmail}'s data.`, 'info');
                } else {
                    // This is an owner account
                    this.isTeamMemberAccount = false;
                    this.dataOwnerId = this.currentUser.uid;
                    this.userRole = 'owner';
                }
            } else {
                // No user document - treat as owner
                this.dataOwnerId = this.currentUser.uid;
                this.userRole = 'owner';
            }
        } catch (error) {
            console.error('Error checking team membership:', error);
            this.dataOwnerId = this.currentUser.uid;
            this.userRole = 'owner';
        }
    }

    async init() {
        console.log('ExpenseTracker init() called');
        this.setupEventListeners();
        this.setupModalCloseHandler();
        this.loadCategories();
        this.loadFromLocalStorage();
        
        this.updateSummary();
        this.renderExpenses();
        this.renderIncome();
        this.renderReimbursements();
        this.renderPettyCash();
        this.updatePettyCashSummary();
        this.renderCategories();
        this.renderAnalytics();
        this.setDefaultDate();
        
        console.log('ExpenseTracker init() completed');
    }
    
    // Helper: Get the correct user ID for data operations
    // Team members use owner's ID, owners use their own
    getDataUserId() {
        return this.dataOwnerId || this.currentUser?.uid;
    }

    getDefaultCategories() {
        return [
            { id: 'food', name: 'Food & Dining', color: '#ff6b6b' },
            { id: 'transport', name: 'Transportation', color: '#4ecdc4' },
            { id: 'utilities', name: 'Utilities', color: '#45b7d1' },
            { id: 'healthcare', name: 'Healthcare', color: '#96ceb4' },
            { id: 'entertainment', name: 'Entertainment', color: '#feca57' },
            { id: 'shopping', name: 'Shopping', color: '#ff9ff3' },
            { id: 'business', name: 'Business', color: '#54a0ff' },
            { id: 'petty-cash', name: 'Petty Cash', color: '#fd79a8' },
            { id: 'other', name: 'Other', color: '#5f27cd' }
        ];
    }

    getDefaultIncomeCategories() {
        return [
            { id: 'salary', name: 'Salary', color: '#4caf50' },
            { id: 'freelance', name: 'Freelance', color: '#2196f3' },
            { id: 'business', name: 'Business Income', color: '#ff9800' },
            { id: 'investment', name: 'Investment Returns', color: '#9c27b0' },
            { id: 'bonus', name: 'Bonus', color: '#00bcd4' },
            { id: 'reimbursement', name: 'Reimbursement', color: '#795548' },
            { id: 'gift', name: 'Gift/Award', color: '#e91e63' },
            { id: 'other-income', name: 'Other Income', color: '#607d8b' }
        ];
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        const expenseDate = document.getElementById('expense-date');
        const incomeDate = document.getElementById('income-date');
        const pettyCashDate = document.getElementById('petty-cash-date');
        if (expenseDate) expenseDate.value = today;
        if (incomeDate) incomeDate.value = today;
        if (pettyCashDate) pettyCashDate.value = today;
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        
        const expenseForm = document.getElementById('expense-form');
        const incomeForm = document.getElementById('income-form');
        const categoryForm = document.getElementById('category-form');
        
        if (expenseForm) {
            expenseForm.addEventListener('submit', (e) => {
                console.log('Expense form submitted');
                e.preventDefault();
                this.addExpense();
            });
            console.log('Expense form listener attached');
        } else {
            console.error('Expense form not found!');
        }

        if (incomeForm) {
            incomeForm.addEventListener('submit', (e) => {
                console.log('Income form submitted');
                e.preventDefault();
                this.addIncome();
            });
            console.log('Income form listener attached');
        } else {
            console.error('Income form not found!');
        }

        if (categoryForm) {
            categoryForm.addEventListener('submit', (e) => {
                console.log('Category form submitted');
                e.preventDefault();
                this.addCategory();
            });
            console.log('Category form listener attached');
        } else {
            console.error('Category form not found!');
        }

        const pettyCashForm = document.getElementById('petty-cash-form');
        if (pettyCashForm) {
            pettyCashForm.addEventListener('submit', (e) => {
                console.log('Petty cash form submitted');
                e.preventDefault();
                this.addPettyCashTransaction(e);
            });
            console.log('Petty cash form listener attached');
        } else {
            console.error('Petty cash form not found!');
        }

        // Setup category name autocomplete
        this.setupCategoryAutocomplete();
    }

    // Setup autocomplete for category name input
    setupCategoryAutocomplete() {
        const categoryNameInput = document.getElementById('category-name');
        const suggestionsContainer = document.getElementById('category-suggestions');
        const categoryTypeSelect = document.getElementById('category-type');
        
        if (!categoryNameInput || !suggestionsContainer) {
            console.error('Category autocomplete elements not found');
            return;
        }

        let highlightedIndex = -1;

        // Filter and display suggestions as user types
        categoryNameInput.addEventListener('input', () => {
            const query = categoryNameInput.value.toLowerCase().trim();
            const selectedType = categoryTypeSelect?.value || 'expense';
            
            // Get categories based on selected type
            const allCategories = selectedType === 'expense' 
                ? this.categories.map(c => ({...c, type: 'expense'}))
                : this.incomeCategories.map(c => ({...c, type: 'income'}));
            
            // Also show categories from the other type for reference
            const otherCategories = selectedType === 'expense'
                ? this.incomeCategories.map(c => ({...c, type: 'income'}))
                : this.categories.map(c => ({...c, type: 'expense'}));

            // Combine and filter
            const combinedCategories = [...allCategories, ...otherCategories];
            
            if (query === '') {
                this.renderCategorySuggestions(combinedCategories, suggestionsContainer, categoryNameInput, selectedType);
            } else {
                const filtered = combinedCategories.filter(cat => 
                    cat.name.toLowerCase().includes(query)
                );
                this.renderCategorySuggestions(filtered, suggestionsContainer, categoryNameInput, selectedType, query);
            }
            
            highlightedIndex = -1;
        });

        // Show suggestions on focus
        categoryNameInput.addEventListener('focus', () => {
            const selectedType = categoryTypeSelect?.value || 'expense';
            const allCategories = selectedType === 'expense' 
                ? this.categories.map(c => ({...c, type: 'expense'}))
                : this.incomeCategories.map(c => ({...c, type: 'income'}));
            const otherCategories = selectedType === 'expense'
                ? this.incomeCategories.map(c => ({...c, type: 'income'}))
                : this.categories.map(c => ({...c, type: 'expense'}));
            
            const combinedCategories = [...allCategories, ...otherCategories];
            const query = categoryNameInput.value.toLowerCase().trim();
            
            if (query === '') {
                this.renderCategorySuggestions(combinedCategories, suggestionsContainer, categoryNameInput, selectedType);
            } else {
                const filtered = combinedCategories.filter(cat => 
                    cat.name.toLowerCase().includes(query)
                );
                this.renderCategorySuggestions(filtered, suggestionsContainer, categoryNameInput, selectedType, query);
            }
        });

        // Handle keyboard navigation
        categoryNameInput.addEventListener('keydown', (e) => {
            const items = suggestionsContainer.querySelectorAll('.autocomplete-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                this.updateHighlightedItem(items, highlightedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                this.updateHighlightedItem(items, highlightedIndex);
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                if (items[highlightedIndex]) {
                    items[highlightedIndex].click();
                }
            } else if (e.key === 'Escape') {
                suggestionsContainer.classList.remove('active');
                highlightedIndex = -1;
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!categoryNameInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.remove('active');
                highlightedIndex = -1;
            }
        });

        // Update suggestions when category type changes
        if (categoryTypeSelect) {
            categoryTypeSelect.addEventListener('change', () => {
                categoryNameInput.value = '';
                const selectedType = categoryTypeSelect.value;
                const allCategories = selectedType === 'expense' 
                    ? this.categories.map(c => ({...c, type: 'expense'}))
                    : this.incomeCategories.map(c => ({...c, type: 'income'}));
                const otherCategories = selectedType === 'expense'
                    ? this.incomeCategories.map(c => ({...c, type: 'income'}))
                    : this.categories.map(c => ({...c, type: 'expense'}));
                
                const combinedCategories = [...allCategories, ...otherCategories];
                this.renderCategorySuggestions(combinedCategories, suggestionsContainer, categoryNameInput, selectedType);
            });
        }

        console.log('Category autocomplete setup complete');
    }

    // Render category suggestions
    renderCategorySuggestions(categories, container, input, selectedType, query = '') {
        container.innerHTML = '';
        
        if (categories.length === 0) {
            container.innerHTML = `
                <div class="autocomplete-no-results">
                    No matching categories found. This will create a new one!
                </div>
            `;
            container.classList.add('active');
            return;
        }

        // Group by type - selected type first
        const primaryCategories = categories.filter(c => c.type === selectedType);
        const secondaryCategories = categories.filter(c => c.type !== selectedType);

        // Render primary categories (matching selected type)
        if (primaryCategories.length > 0) {
            primaryCategories.forEach(cat => {
                const item = this.createCategoryItem(cat, input, container, query);
                container.appendChild(item);
            });
        }

        // Render secondary categories from other type (for reference)
        if (secondaryCategories.length > 0) {
            const divider = document.createElement('div');
            divider.className = 'autocomplete-hint';
            divider.innerHTML = `<small>📋 Categories from ${selectedType === 'expense' ? 'Income' : 'Expense'} (for reference)</small>`;
            container.appendChild(divider);

            secondaryCategories.forEach(cat => {
                const item = this.createCategoryItem(cat, input, container, query);
                item.style.opacity = '0.7';
                container.appendChild(item);
            });
        }

        container.classList.add('active');
    }

    // Create a single category suggestion item
    createCategoryItem(category, input, container, query) {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        
        // Highlight matching text
        let displayName = category.name;
        if (query) {
            const regex = new RegExp(`(${query})`, 'gi');
            displayName = category.name.replace(regex, '<span class="match-highlight">$1</span>');
        }
        
        item.innerHTML = `
            <span class="category-dot" style="background-color: ${category.color}"></span>
            <span class="category-text">${displayName}</span>
            <span class="category-type-badge">${category.type}</span>
        `;
        
        item.addEventListener('click', () => {
            input.value = category.name;
            container.classList.remove('active');
            
            // Show warning if category already exists in current type
            const categoryTypeSelect = document.getElementById('category-type');
            const selectedType = categoryTypeSelect?.value || 'expense';
            const targetCategories = selectedType === 'expense' ? this.categories : this.incomeCategories;
            
            if (targetCategories.some(c => c.name.toLowerCase() === category.name.toLowerCase())) {
                this.showNotification(`"${category.name}" already exists in ${selectedType} categories!`, 'warning');
            }
        });
        
        return item;
    }

    // Update highlighted item for keyboard navigation
    updateHighlightedItem(items, index) {
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add('highlighted');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    addExpense() {
        console.log('addExpense() called');
        
        const description = document.getElementById('expense-description').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;
        const isReimbursement = document.getElementById('expense-reimbursement').checked;
        const form = document.getElementById('expense-form');
        const editingId = form.dataset.editingId;

        console.log('Form values:', { description, amount, category, date, isReimbursement, editingId });

        if (!description || !amount || !category || !date) {
            console.log('Validation failed - missing fields');
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (editingId) {
            // Update existing expense
            const expenseIndex = this.expenses.findIndex(exp => String(exp.id) === String(editingId));
            if (expenseIndex !== -1) {
                this.expenses[expenseIndex] = {
                    ...this.expenses[expenseIndex],
                    description,
                    amount,
                    category,
                    date,
                    isReimbursement
                };
                console.log('Updating expense:', this.expenses[expenseIndex]);
                this.showNotification('Expense updated successfully!', 'success');
            }
            
            // Reset form to add mode
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.innerHTML = submitButton.originalText || '<i class="fas fa-plus"></i> Add Expense';
            delete form.dataset.editingId;
            
        } else {
            // Create new expense
            const expense = {
                id: Date.now(),
                description,
                amount,
                category,
                date,
                isReimbursement,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            };

            console.log('Adding new expense:', expense);
            this.expenses.unshift(expense);
            this.showNotification('Expense added successfully!', 'success');
        }

        this.saveExpensesToCloud();
        this.renderExpenses();
        this.renderReimbursements();
        this.updateSummary();
        this.renderAnalytics();
        this.resetForm('expense-form');
        
        console.log('Expense operation completed successfully');
    }

    addIncome() {
        console.log('addIncome() called');
        
        const description = document.getElementById('income-description').value;
        const amount = parseFloat(document.getElementById('income-amount').value);
        const type = document.getElementById('income-type').value;
        const date = document.getElementById('income-date').value;
        const customerId = document.getElementById('income-customer')?.value || null;
        const form = document.getElementById('income-form');
        const editingId = form.dataset.editingId;

        // Get customer details if selected
        let customerName = null;
        if (customerId && window.customerManager && window.customerManager.customers) {
            const customer = window.customerManager.customers.find(c => c.id === customerId);
            if (customer) {
                customerName = customer.companyName || customer.name;
                if (customer.branchDepartment) {
                    customerName += ` - ${customer.branchDepartment}`;
                }
            }
        }

        console.log('Income form values:', { description, amount, type, date, customerId, customerName, editingId });

        if (!description || !amount || !type || !date) {
            console.log('Validation failed - missing fields');
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (editingId) {
            // Update existing income
            const incomeIndex = this.income.findIndex(inc => String(inc.id) === String(editingId));
            if (incomeIndex !== -1) {
                this.income[incomeIndex] = {
                    ...this.income[incomeIndex],
                    description,
                    amount,
                    type,
                    date,
                    customerId,
                    customerName
                };
                console.log('Updating income:', this.income[incomeIndex]);
                this.showNotification('Income updated successfully!', 'success');
            }
            
            // Reset form to add mode
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.innerHTML = submitButton.originalText || '<i class="fas fa-plus"></i> Add Income';
            delete form.dataset.editingId;
            
        } else {
            // Create new income
            const income = {
                id: Date.now(),
                description,
                amount,
                type,
                date,
                customerId,
                customerName,
                timestamp: new Date().toISOString()
            };

            console.log('Adding new income:', income);
            this.income.unshift(income);
            this.showNotification('Income added successfully!', 'success');
        }

        this.saveIncomeToCloud();
        this.renderIncome();
        this.updateSummary();
        this.renderAnalytics();
        this.resetForm('income-form');
        
        console.log('Income operation completed successfully');
    }

    addCategory() {
        console.log('addCategory() called');
        
        const name = document.getElementById('category-name').value;
        const color = document.getElementById('category-color').value;
        const type = document.getElementById('category-type')?.value || 'expense';

        console.log('Category form values:', { name, color, type });

        if (!name || !color) {
            console.log('Validation failed - missing fields');
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        const targetCategories = type === 'expense' ? this.categories : this.incomeCategories;

        // Check if category already exists
        if (targetCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            this.showNotification('Category already exists!', 'error');
            return;
        }

        const category = {
            id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
            name,
            color
        };

        console.log('Adding category:', category);

        if (type === 'expense') {
            this.categories.push(category);
        } else {
            this.incomeCategories.push(category);
        }

        this.saveCategoriesToCloud();
        this.loadCategories();
        this.renderCategories();
        this.resetForm('category-form');
        this.showNotification(`${type} category added successfully!`, 'success');
        
        console.log('Category added successfully');
    }

    saveExpenses() {
        console.log('Saving expenses to localStorage');
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    saveIncome() {
        console.log('Saving income to localStorage');
        localStorage.setItem('income', JSON.stringify(this.income));
    }

    savePettyCash() {
        console.log('Saving petty cash to localStorage');
        localStorage.setItem('pettyCash', JSON.stringify(this.pettyCash));
    }

    saveCategories() {
        console.log('Saving categories to localStorage');
        localStorage.setItem('categories', JSON.stringify(this.categories));
        localStorage.setItem('incomeCategories', JSON.stringify(this.incomeCategories));
    }

    loadCategories() {
        console.log('Loading categories into dropdown');
        
        // Load expense categories
        const categorySelect = document.getElementById('expense-category');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Select Category</option>';
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            console.log('Expense categories loaded:', this.categories.length);
        }

        // Load income categories
        const incomeTypeSelect = document.getElementById('income-type');
        if (incomeTypeSelect) {
            incomeTypeSelect.innerHTML = '<option value="">Select Type</option>';
            this.incomeCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                incomeTypeSelect.appendChild(option);
            });
            console.log('Income categories loaded:', this.incomeCategories.length);
        }

        // Load petty cash categories (same as expense categories, excluding petty-cash itself)
        const pettyCashCategorySelect = document.getElementById('petty-cash-category');
        if (pettyCashCategorySelect) {
            pettyCashCategorySelect.innerHTML = '<option value="">Select Category</option>';
            // Filter out 'petty-cash' category from dropdown to prevent circular allocation
            this.categories.filter(cat => cat.id !== 'petty-cash').forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                pettyCashCategorySelect.appendChild(option);
            });
            console.log('Petty cash categories loaded:', this.categories.length - 1);
        }
    }

    updateSummary() {
        console.log('Updating summary cards');
        
        // Calculate totals (exclude petty cash allocations)
        const totalIncome = this.income.reduce((sum, income) => sum + income.amount, 0);
        const totalExpenses = this.expenses
            .filter(expense => {
                const category = this.categories.find(cat => cat.id === expense.category);
                return category?.name !== 'Petty Cash';
            })
            .reduce((sum, expense) => sum + expense.amount, 0);
        const pendingReimbursements = this.expenses
            .filter(expense => expense.isReimbursement && !expense.isPaid)
            .reduce((sum, expense) => sum + expense.amount, 0);
        const netBalance = totalIncome - totalExpenses;

        // Update DOM elements
        const totalIncomeEl = document.getElementById('total-income');
        const totalExpensesEl = document.getElementById('total-expenses');
        const totalReimbursementsEl = document.getElementById('total-reimbursements');
        const netBalanceEl = document.getElementById('net-balance');

        if (totalIncomeEl) totalIncomeEl.textContent = this.formatCurrency(totalIncome);
        if (totalExpensesEl) totalExpensesEl.textContent = this.formatCurrency(totalExpenses);
        if (totalReimbursementsEl) totalReimbursementsEl.textContent = this.formatCurrency(pendingReimbursements);
        if (netBalanceEl) {
            netBalanceEl.textContent = this.formatCurrency(netBalance);
            netBalanceEl.style.color = netBalance >= 0 ? '#4caf50' : '#f44336';
        }

        console.log('Summary updated:', { totalIncome, totalExpenses, pendingReimbursements, netBalance });
    }

    formatCurrency(amount) {
        return `₱${amount.toLocaleString('en-PH', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }

    // Ensure user document exists in Firestore (creates if missing)
    async ensureUserDocumentExists() {
        if (!this.currentUser) return;
        
        try {
            const userDocRef = window.db.collection('users').doc(this.getDataUserId());
            const userDoc = await userDocRef.get();
            
            if (!userDoc.exists) {
                console.log('📝 Creating new user document for:', this.currentUser.email);
                
                // Create the user document with initial data
                await userDocRef.set({
                    email: this.currentUser.email,
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: window.firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Initialize default categories in settings subcollection
                await userDocRef.collection('settings').doc('categories').set({
                    categories: this.getDefaultCategories(),
                    incomeCategories: this.getDefaultIncomeCategories()
                });
                
                console.log('✅ User document created successfully');
            } else {
                // Update last login time
                await userDocRef.update({
                    lastLogin: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('❌ Error ensuring user document exists:', error);
        }
    }

    loadFromLocalStorage() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.income = JSON.parse(localStorage.getItem('income')) || [];
        this.pettyCash = JSON.parse(localStorage.getItem('pettyCash')) || [];
        this.categories = JSON.parse(localStorage.getItem('categories')) || this.getDefaultCategories();
        this.incomeCategories = JSON.parse(localStorage.getItem('incomeCategories')) || this.getDefaultIncomeCategories();
    }

    async loadFromCloud() {
        if (!this.currentUser) return;
        
        // Use dataOwnerId for team members, or current user for owners
        const dataUserId = this.dataOwnerId || this.currentUser.uid;
        
        try {
            console.log('☁️ Loading data from cloud for:', dataUserId);
            
            // Check if user document exists, if not create it (only for owners)
            if (!this.isTeamMemberAccount) {
                await this.ensureUserDocumentExists();
            }
            
            // Load expenses
            const expensesSnapshot = await window.db
                .collection('users')
                .doc(dataUserId)
                .collection('expenses')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.expenses = expensesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Load income
            const incomeSnapshot = await window.db
                .collection('users')
                .doc(dataUserId)
                .collection('income')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.income = incomeSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load petty cash
            const pettyCashSnapshot = await window.db
                .collection('users')
                .doc(dataUserId)
                .collection('pettyCash')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.pettyCash = pettyCashSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Load categories
            const categoriesDoc = await window.db
                .collection('users')
                .doc(dataUserId)
                .collection('settings')
                .doc('categories')
                .get();
            
            if (categoriesDoc.exists) {
                const data = categoriesDoc.data();
                this.categories = data.categories || this.getDefaultCategories();
                this.incomeCategories = data.incomeCategories || this.getDefaultIncomeCategories();
            } else {
                this.categories = this.getDefaultCategories();
                this.incomeCategories = this.getDefaultIncomeCategories();
                if (!this.isTeamMemberAccount) {
                    await this.saveCategoriesToCloud();
                }
            }
            
            console.log('✅ Data loaded from cloud');
            this.updateUI();
            
            // Initialize team management (sets up event listeners)
            this.initTeamManagement();
            
        } catch (error) {
            console.error('❌ Error loading from cloud:', error);
            this.showNotification('Failed to load data from cloud. Using local data.', 'warning');
            this.loadFromLocalStorage();
            this.updateUI();
        }
    }

    async saveExpensesToCloud() {
        if (!this.currentUser) {
            this.saveExpenses(); // Fallback to localStorage
            return;
        }
        
        try {
            const batch = window.db.batch();
            const userExpensesRef = window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('expenses');
            
            // Clear existing expenses and add new ones
            const existingExpenses = await userExpensesRef.get();
            existingExpenses.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Add current expenses
            this.expenses.forEach(expense => {
                const docRef = userExpensesRef.doc(expense.id.toString());
                batch.set(docRef, expense);
            });
            
            await batch.commit();
            console.log('✅ Expenses saved to cloud');
            
        } catch (error) {
            console.error('❌ Error saving expenses to cloud:', error);
            this.saveExpenses(); // Fallback to localStorage
        }
    }

    async saveIncomeToCloud() {
        if (!this.currentUser) {
            this.saveIncome(); // Fallback to localStorage
            return;
        }
        
        try {
            const batch = window.db.batch();
            const userIncomeRef = window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('income');
            
            // Clear existing income and add new ones
            const existingIncome = await userIncomeRef.get();
            existingIncome.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Add current income
            this.income.forEach(income => {
                const docRef = userIncomeRef.doc(income.id.toString());
                batch.set(docRef, income);
            });
            
            await batch.commit();
            console.log('✅ Income saved to cloud');
            
        } catch (error) {
            console.error('❌ Error saving income to cloud:', error);
            this.saveIncome(); // Fallback to localStorage
        }
    }

    async savePettyCashToCloud() {
        if (!this.currentUser) {
            this.savePettyCash(); // Fallback to localStorage
            return;
        }
        
        try {
            const batch = window.db.batch();
            const userPettyCashRef = window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('pettyCash');
            
            // Clear existing petty cash and add new ones
            const existingPettyCash = await userPettyCashRef.get();
            existingPettyCash.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Add current petty cash
            this.pettyCash.forEach(transaction => {
                const docRef = userPettyCashRef.doc(transaction.id.toString());
                batch.set(docRef, transaction);
            });
            
            await batch.commit();
            console.log('✅ Petty cash saved to cloud');
            
        } catch (error) {
            console.error('❌ Error saving petty cash to cloud:', error);
            this.savePettyCash(); // Fallback to localStorage
        }
    }

    async saveCategoriesToCloud() {
        if (!this.currentUser) {
            this.saveCategories(); // Fallback to localStorage
            return;
        }
        
        try {
            await window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('settings')
                .doc('categories')
                .set({ 
                    categories: this.categories,
                    incomeCategories: this.incomeCategories 
                });
            
            console.log('✅ Categories saved to cloud');
            
        } catch (error) {
            console.error('❌ Error saving categories to cloud:', error);
            this.saveCategories(); // Fallback to localStorage
        }
    }

    updateUI() {
        this.updateSummary();
        this.renderExpenses();
        this.renderIncome();
        this.renderReimbursements();
        this.renderPettyCash();
        this.updatePettyCashSummary();
        this.renderCategories();
        this.renderAnalytics();
        this.loadCategories();
    }

    renderIncome() {
        const tbody = document.getElementById('income-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.income.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">No income recorded yet</td></tr>';
            return;
        }

        this.income.forEach(income => {
            const row = document.createElement('tr');
            const customerDisplay = income.customerName || '-';
            row.innerHTML = `
                <td>${this.formatDate(income.date)}</td>
                <td>${income.description}</td>
                <td>${customerDisplay}</td>
                <td><span class="income-type-badge income-${income.type}">${income.type}</span></td>
                <td>${this.formatCurrency(income.amount)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm" onclick="expenseTracker.editIncome('${income.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="expenseTracker.deleteIncome('${income.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderExpenses() {
        const tbody = document.getElementById('expenses-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        const regularExpenses = this.expenses.filter(expense => {
            if (expense.isReimbursement) return false;
            
            // Check if this is a petty cash allocation by category name
            const category = this.categories.find(cat => cat.id === expense.category);
            const isPettyCashAllocation = category?.name === 'Petty Cash';
            
            return !isPettyCashAllocation;
        });

        if (regularExpenses.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">No expenses recorded yet</td></tr>';
            return;
        }

        regularExpenses.forEach(expense => {
            const category = this.categories.find(cat => cat.id === expense.category);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(expense.date)}</td>
                <td>${expense.description}</td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; background: ${category?.color || '#ccc'}; border-radius: 50%;"></span>
                        ${category?.name || 'Unknown'}
                    </span>
                </td>
                <td>${this.formatCurrency(expense.amount)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm" onclick="expenseTracker.editExpense(${expense.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="expenseTracker.deleteExpense(${expense.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderReimbursements() {
        const tbody = document.getElementById('reimbursements-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        const reimbursements = this.expenses.filter(expense => expense.isReimbursement);

        if (reimbursements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">No reimbursement expenses recorded yet</td></tr>';
            return;
        }

        reimbursements.forEach(expense => {
            const category = this.categories.find(cat => cat.id === expense.category);
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>
                    ${!expense.isPaid ? `<input type="checkbox" class="table-checkbox">` : ''}
                </td>
                <td>${this.formatDate(expense.date)}</td>
                <td>${expense.description}</td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; background: ${category?.color || '#ccc'}; border-radius: 50%;"></span>
                        ${category?.name || 'Unknown'}
                    </span>
                </td>
                <td>${this.formatCurrency(expense.amount)}</td>
                <td>
                    ${expense.paymentDate ? this.formatDate(expense.paymentDate) : '-'}
                </td>
                <td>
                    ${expense.isPaid ? 
                        `<span class="status-badge status-paid">Paid</span>` :
                        `<span class="status-badge status-pending" onclick="expenseTracker.openPaymentModal(${expense.id})">Pending</span>`
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderCategories() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;
        
        grid.innerHTML = '';

        // Expense Categories Section
        const expenseCategoriesSection = document.createElement('div');
        expenseCategoriesSection.innerHTML = '<h3>💸 Expense Categories</h3>';
        expenseCategoriesSection.className = 'category-section';
        
        this.categories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item';
            categoryDiv.innerHTML = `
                <div class="category-info">
                    <div class="category-color" style="background-color: ${category.color}"></div>
                    <span class="category-name">${category.name}</span>
                </div>
                <div class="category-actions">
                    <button class="btn btn-sm btn-primary" onclick="expenseTracker.editCategory('${category.id}', 'expense')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="expenseTracker.deleteCategory('${category.id}', 'expense')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            expenseCategoriesSection.appendChild(categoryDiv);
        });
        
        // Income Categories Section
        const incomeCategoriesSection = document.createElement('div');
        incomeCategoriesSection.innerHTML = '<h3>💰 Income Categories</h3>';
        incomeCategoriesSection.className = 'category-section';
        
        this.incomeCategories.forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-item';
            categoryDiv.innerHTML = `
                <div class="category-info">
                    <div class="category-color" style="background-color: ${category.color}"></div>
                    <span class="category-name">${category.name}</span>
                </div>
                <div class="category-actions">
                    <button class="btn btn-sm btn-primary" onclick="expenseTracker.editCategory('${category.id}', 'income')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="expenseTracker.deleteCategory('${category.id}', 'income')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            incomeCategoriesSection.appendChild(categoryDiv);
        });

        grid.appendChild(expenseCategoriesSection);
        grid.appendChild(incomeCategoriesSection);
    }

    editCategory(categoryId, type) {
        const categories = type === 'expense' ? this.categories : this.incomeCategories;
        const category = categories.find(cat => cat.id === categoryId);
        if (!category) return;

        // Open the edit modal
        const modal = document.getElementById('edit-category-modal');
        const modalTitle = document.getElementById('edit-category-modal-title');
        const nameInput = document.getElementById('edit-category-name');
        const colorInput = document.getElementById('edit-category-color');
        const idInput = document.getElementById('edit-category-id');
        const typeInput = document.getElementById('edit-category-type');
        const colorPreview = document.getElementById('edit-category-color-preview');

        // Populate form with current values
        modalTitle.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Category`;
        nameInput.value = category.name;
        colorInput.value = category.color;
        idInput.value = categoryId;
        typeInput.value = type;
        
        // Update color preview
        if (colorPreview) {
            colorPreview.style.backgroundColor = category.color;
        }

        // Show modal
        modal.style.display = 'flex';

        // Setup color preview update
        colorInput.onchange = () => {
            if (colorPreview) {
                colorPreview.style.backgroundColor = colorInput.value;
            }
        };

        // Setup form submission (remove old listener first)
        const form = document.getElementById('edit-category-form');
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        newForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditCategory();
        });

        // Re-setup color input listener after form clone
        const newColorInput = document.getElementById('edit-category-color');
        const newColorPreview = document.getElementById('edit-category-color-preview');
        newColorInput.onchange = () => {
            if (newColorPreview) {
                newColorPreview.style.backgroundColor = newColorInput.value;
            }
        };
    }

    saveEditCategory() {
        const nameInput = document.getElementById('edit-category-name');
        const colorInput = document.getElementById('edit-category-color');
        const idInput = document.getElementById('edit-category-id');
        const typeInput = document.getElementById('edit-category-type');

        const categoryId = idInput.value;
        const type = typeInput.value;
        const newName = nameInput.value.trim();
        const newColor = colorInput.value;

        if (!newName) {
            this.showNotification('Category name is required', 'error');
            return;
        }

        const categories = type === 'expense' ? this.categories : this.incomeCategories;
        const category = categories.find(cat => cat.id === categoryId);
        
        if (!category) {
            this.showNotification('Category not found', 'error');
            return;
        }

        // Check for duplicate names (excluding current category)
        const isDuplicate = categories.some(cat => 
            cat.id !== categoryId && cat.name.toLowerCase() === newName.toLowerCase()
        );

        if (isDuplicate) {
            this.showNotification(`A ${type} category with this name already exists`, 'error');
            return;
        }

        // Update category
        category.name = newName;
        category.color = newColor;

        // Save and refresh
        this.saveCategoriesToCloud();
        this.renderCategories();
        this.loadCategories();
        this.closeEditCategoryModal();
        this.showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} category updated successfully!`, 'success');
    }

    closeEditCategoryModal() {
        const modal = document.getElementById('edit-category-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    deleteCategory(categoryId, type) {
        if (!confirm(`Are you sure you want to delete this ${type} category?`)) return;

        if (type === 'expense') {
            this.categories = this.categories.filter(cat => cat.id !== categoryId);
        } else {
            this.incomeCategories = this.incomeCategories.filter(cat => cat.id !== categoryId);
        }

        this.saveCategoriesToCloud();
        this.renderCategories();
        this.loadCategories();
        this.showNotification(`${type} category deleted successfully!`, 'success');
    }

    renderAnalytics() {
        console.log('🔍 renderAnalytics called');
        console.log('🔍 Current expenses:', this.expenses);
        console.log('🔍 Current income:', this.income);
        
        // If no data exists, show sample data option
        if (this.expenses.length === 0) {
            console.log('🔍 No expenses found, showing empty analytics');
            this.renderEmptyAnalytics();
            return;
        }
        
        // Enhanced analytics calculations (excluding petty cash allocations AND reimbursements)
        const actualExpenses = this.expenses.filter(expense => {
            const category = this.categories.find(cat => cat.id === expense.category);
            return category?.name !== 'Petty Cash' && !expense.isReimbursement;
        });
        console.log('🔍 actualExpenses for analytics (excluding reimbursements):', actualExpenses.length, actualExpenses);
        
        const totalExpenses = actualExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const totalIncome = this.income.reduce((sum, income) => sum + income.amount, 0);
        const avgDaily = totalExpenses / 30;
        const pendingReimbursements = this.expenses
            .filter(expense => expense.isReimbursement && !expense.isPaid)
            .reduce((sum, expense) => sum + expense.amount, 0);
        const monthlyNet = totalIncome - totalExpenses;

        // Find top expense category (excluding petty cash allocations)
        const categoryTotals = {};
        actualExpenses.forEach(expense => {
            if (!categoryTotals[expense.category]) {
                categoryTotals[expense.category] = 0;
            }
            categoryTotals[expense.category] += expense.amount;
        });

        const topCategoryId = Object.keys(categoryTotals).reduce((a, b) => 
            categoryTotals[a] > categoryTotals[b] ? a : b, Object.keys(categoryTotals)[0]);
        
        const topCategory = this.categories.find(cat => cat.id === topCategoryId);
        const topCategoryName = topCategory ? topCategory.name : '-';

        // Update analytics display
        const monthlySpendingEl = document.getElementById('monthly-spending');
        const avgDailyEl = document.getElementById('avg-daily');
        const pendingReimburseEl = document.getElementById('pending-reimburse');
        const topCategoryEl = document.getElementById('top-category');

        if (monthlySpendingEl) monthlySpendingEl.textContent = this.formatCurrency(monthlyNet);
        if (avgDailyEl) avgDailyEl.textContent = this.formatCurrency(avgDaily);
        if (pendingReimburseEl) pendingReimburseEl.textContent = this.formatCurrency(pendingReimbursements);
        if (topCategoryEl) topCategoryEl.textContent = topCategoryName;

        // Generate smart financial tips
        this.generateFinancialTips(totalIncome, totalExpenses, categoryTotals, monthlyNet);
        
        // Generate category breakdown chart
        this.renderCategoryBreakdown(categoryTotals);
        
        // Generate monthly trend chart
        this.renderMonthlyTrend(actualExpenses);
    }

    renderEmptyAnalytics() {
        console.log('🔍 renderEmptyAnalytics called');
        // Show sample data option when no data exists
        const categoryContainer = document.getElementById('categoryChart');
        const trendContainer = document.getElementById('trendChart');
        
        console.log('🔍 categoryChart element:', categoryContainer);
        console.log('🔍 trendChart element:', trendContainer);
        
        if (categoryContainer) {
            categoryContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666; margin-bottom: 20px; font-size: 16px;">📊 No expenses recorded yet</p>
                    <button onclick="expenseTracker.addSampleData()" class="btn btn-primary" style="
                        background: linear-gradient(145deg, #51cf66, #40c057);
                        color: white;
                        padding: 15px 30px;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        box-shadow: 0 4px 15px rgba(81, 207, 102, 0.3);
                    ">
                        🚀 Add Sample Data to Test Charts
                    </button>
                </div>
            `;
            console.log('🔍 Category chart HTML set');
        } else {
            console.error('🔍 categoryChart element not found!');
        }
        
        if (trendContainer) {
            trendContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #666; font-size: 16px;">📈 Add some expenses to see monthly trends</p>
                </div>
            `;
            console.log('🔍 Trend chart HTML set');
        } else {
            console.error('🔍 trendChart element not found!');
        }
    }

    addSampleData() {
        // Add sample expenses for testing
        const sampleExpenses = [
            {
                id: Date.now() + 1,
                description: 'Groceries at Supermarket',
                amount: 2500,
                category: 'food',
                date: '2024-06-20',
                isReimbursement: false,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 2,
                description: 'Grab Transportation',
                amount: 350,
                category: 'transport',
                date: '2024-06-21',
                isReimbursement: false,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 3,
                description: 'Business Lunch Meeting',
                amount: 1200,
                category: 'business',
                date: '2024-06-22',
                isReimbursement: true,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 4,
                description: 'Movie Tickets',
                amount: 800,
                category: 'entertainment',
                date: '2024-06-23',
                isReimbursement: false,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 5,
                description: 'Electric Bill',
                amount: 3200,
                category: 'utilities',
                date: '2024-06-18',
                isReimbursement: false,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 6,
                description: 'Shopping - Clothes',
                amount: 4500,
                category: 'shopping',
                date: '2024-06-15',
                isReimbursement: false,
                isPaid: false,
                paymentDate: null,
                timestamp: new Date().toISOString()
            }
        ];

        // Add sample income
        const sampleIncome = [
            {
                id: Date.now() + 10,
                description: 'Monthly Salary',
                amount: 50000,
                type: 'salary',
                date: '2024-06-01',
                timestamp: new Date().toISOString()
            },
            {
                id: Date.now() + 11,
                description: 'Freelance Project',
                amount: 15000,
                type: 'freelance',
                date: '2024-06-10',
                timestamp: new Date().toISOString()
            }
        ];

        // Add to arrays
        this.expenses.push(...sampleExpenses);
        this.income.push(...sampleIncome);

        // Save and update UI
        this.saveExpensesToCloud();
        this.saveIncomeToCloud();
        this.updateUI();
        
        this.showNotification('Sample data added! Check out your analytics now.', 'success');
    }

    renderCategoryBreakdown(categoryTotals) {
        console.log('🔍 renderCategoryBreakdown called with:', categoryTotals);
        const container = document.getElementById('categoryChart');
        console.log('🔍 categoryChart container found:', !!container);
        
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        // Create pie chart
        const total = Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0);
        console.log('🔍 Total amount for charts:', total);
        
        if (total === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No actual expenses recorded yet</p>';
            return;
        }

        // Sort categories by amount (descending)
        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a);

        // Detect if browser supports conic-gradient
        const supportsConicGradient = this.supportsConicGradient();
        console.log('🔍 Conic gradient supported:', supportsConicGradient);

        if (supportsConicGradient) {
            // Desktop/modern browser version with conic-gradient
            this.renderDesktopPieChart(sortedCategories, total, container);
        } else {
            // Mobile/iOS fallback version with HTML segments
            this.renderMobilePieChart(sortedCategories, total, container);
        }
    }

    supportsConicGradient() {
        // Check if browser supports conic-gradient
        if (typeof CSS !== 'undefined' && CSS.supports) {
            return CSS.supports('background', 'conic-gradient(red, blue)');
        }
        
        // Fallback detection for older browsers
        const testDiv = document.createElement('div');
        testDiv.style.background = 'conic-gradient(red, blue)';
        return testDiv.style.background.includes('conic-gradient');
    }

    renderDesktopPieChart(sortedCategories, total, container) {
        // Create pie chart using CSS conic-gradient (original desktop version)
        let currentPercent = 0;
        let gradientStops = [];
        let legendHTML = '';

        sortedCategories.forEach(([categoryId, amount], index) => {
            const category = this.categories.find(cat => cat.id === categoryId);
            const percentage = (amount / total) * 100;
            const color = category?.color || `hsl(${index * 45}, 70%, 60%)`;
            
            // Add to gradient stops
            if (gradientStops.length > 0) {
                gradientStops.push(`${color} ${currentPercent}%`);
            } else {
                gradientStops.push(`${color} 0%`);
            }
            currentPercent += percentage;
            gradientStops.push(`${color} ${currentPercent}%`);
            
            // Add to legend with hover effects
            legendHTML += `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px; border-radius: 6px; transition: all 0.3s ease; cursor: pointer;" 
                     onmouseover="this.style.backgroundColor='#f8f9fa'; this.style.transform='translateX(5px)'" 
                     onmouseout="this.style.backgroundColor='transparent'; this.style.transform='translateX(0)'">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 16px; height: 16px; background: ${color}; border-radius: 50%; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                        <span style="font-weight: 500; color: #333;">${category?.name || 'Unknown'}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #333;">${this.formatCurrency(amount)}</div>
                        <div style="font-size: 12px; color: #666;">${percentage.toFixed(1)}%</div>
                    </div>
                </div>
            `;
        });

        // Create responsive layout with conic-gradient
        const pieChartHTML = `
            <div style="display: flex; flex-direction: column; gap: 25px; padding: 20px;">
                <div style="display: flex; flex-wrap: wrap; gap: 25px; align-items: flex-start;">
                    <!-- Desktop Pie Chart -->
                    <div style="flex: 0 0 auto; margin: 0 auto;">
                        <div style="
                            width: 220px; 
                            height: 220px; 
                            border-radius: 50%; 
                            background: conic-gradient(${gradientStops.join(', ')});
                            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                            border: 4px solid white;
                            position: relative;
                            transition: transform 0.3s ease;
                        " 
                        onmouseover="this.style.transform='scale(1.05)'" 
                        onmouseout="this.style.transform='scale(1)'">
                            <!-- Center label -->
                            <div style="
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%);
                                background: white;
                                border-radius: 50%;
                                width: 80px;
                                height: 80px;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                            ">
                                <div style="font-size: 12px; color: #666; font-weight: 500;">TOTAL</div>
                                <div style="font-size: 14px; color: #333; font-weight: 600;">${this.formatCurrency(total)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Legend -->
                    <div style="flex: 1; min-width: 280px;">
                        <h4 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 600;">💸 Spending Breakdown</h4>
                        <div style="max-height: 300px; overflow-y: auto; padding-right: 10px;">
                            ${legendHTML}
                        </div>
                        ${this.generateCategoryStats(sortedCategories, total)}
                    </div>
                </div>
                ${this.generateTopCategories(sortedCategories, total)}
            </div>
        `;
        
        container.innerHTML = pieChartHTML;
    }

    renderMobilePieChart(sortedCategories, total, container) {
        // Mobile-friendly pie chart using HTML segments
        console.log('🔍 Rendering mobile pie chart');
        
        let legendHTML = '';
        let segmentsHTML = '';
        let currentAngle = 0;

        sortedCategories.forEach(([categoryId, amount], index) => {
            const category = this.categories.find(cat => cat.id === categoryId);
            const percentage = (amount / total) * 100;
            const color = category?.color || `hsl(${index * 45}, 70%, 60%)`;
            const angle = (percentage / 100) * 360;
            
            // Create segments using clip-path (better mobile support)
            segmentsHTML += `
                <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: ${color};
                    clip-path: polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos((currentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((currentAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((currentAngle + angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((currentAngle + angle - 90) * Math.PI / 180)}%);
                "></div>
            `;
            
            currentAngle += angle;
            
            // Create legend
            legendHTML += `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px; border-radius: 6px; background: rgba(255,255,255,0.8);">
                    <div style="display: flex; align-items: center;">
                        <div style="width: 16px; height: 16px; background: ${color}; border-radius: 50%; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                        <span style="font-weight: 500; color: #333; font-size: 14px;">${category?.name || 'Unknown'}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #333; font-size: 14px;">${this.formatCurrency(amount)}</div>
                        <div style="font-size: 12px; color: #666;">${percentage.toFixed(1)}%</div>
                    </div>
                </div>
            `;
        });

        // Alternative: Use simple bar chart for better mobile compatibility
        const mobileChartHTML = `
            <div style="padding: 20px;">
                <!-- Mobile Bar Chart -->
                <div style="margin-bottom: 30px;">
                    <h4 style="margin: 0 0 20px 0; color: #333; font-size: 18px; font-weight: 600; text-align: center;">💸 Spending Breakdown</h4>
                    
                    <!-- Total Display -->
                    <div style="text-align: center; margin-bottom: 25px; padding: 15px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 12px; color: white;">
                        <div style="font-size: 14px; opacity: 0.9;">TOTAL EXPENSES</div>
                        <div style="font-size: 24px; font-weight: 600; margin-top: 5px;">${this.formatCurrency(total)}</div>
                    </div>
                    
                    <!-- Category Bars -->
                    <div style="space-y: 15px;">
                        ${sortedCategories.map(([categoryId, amount], index) => {
                            const category = this.categories.find(cat => cat.id === categoryId);
                            const percentage = (amount / total) * 100;
                            const color = category?.color || `hsl(${index * 45}, 70%, 60%)`;
                            
                            return `
                                <div style="margin-bottom: 15px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <div style="display: flex; align-items: center;">
                                            <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 10px;"></div>
                                            <span style="font-weight: 500; color: #333; font-size: 14px;">${category?.name || 'Unknown'}</span>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-weight: 600; color: #333; font-size: 14px;">${this.formatCurrency(amount)}</div>
                                            <div style="font-size: 12px; color: #666;">${percentage.toFixed(1)}%</div>
                                        </div>
                                    </div>
                                    <div style="background: #f0f0f0; border-radius: 10px; height: 8px; overflow: hidden;">
                                        <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 10px; transition: width 0.5s ease;"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                ${this.generateTopCategories(sortedCategories, total)}
            </div>
        `;
        
        container.innerHTML = mobileChartHTML;
    }

    generateCategoryStats(sortedCategories, total) {
        return `
            <!-- Summary Stats -->
            <div style="border-top: 2px solid #eee; padding-top: 15px; margin-top: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                    <div>
                        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Categories</div>
                        <div style="font-size: 20px; font-weight: 600; color: #667eea;">${sortedCategories.length}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Avg per Category</div>
                        <div style="font-size: 20px; font-weight: 600; color: #667eea;">${this.formatCurrency(total / sortedCategories.length)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    generateTopCategories(sortedCategories, total) {
        return `
            <!-- Top 3 Categories Quick Stats -->
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; padding: 20px; margin-top: 20px;">
                <h5 style="margin: 0 0 15px 0; color: #333; font-size: 16px; text-align: center;">🏆 Top 3 Categories</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                    ${sortedCategories.slice(0, 3).map(([categoryId, amount], index) => {
                        const category = this.categories.find(cat => cat.id === categoryId);
                        const percentage = (amount / total) * 100;
                        const medal = ['🥇', '🥈', '🥉'][index];
                        return `
                            <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <div style="font-size: 24px; margin-bottom: 5px;">${medal}</div>
                                <div style="font-size: 12px; font-weight: 600; color: #333; margin-bottom: 5px;">${category?.name || 'Unknown'}</div>
                                <div style="font-size: 15px; font-weight: 700; color: ${category?.color || '#667eea'};">${this.formatCurrency(amount)}</div>
                                <div style="font-size: 11px; color: #666;">${percentage.toFixed(1)}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    renderMonthlyTrend(expenses) {
        console.log('🔍 renderMonthlyTrend called with expenses:', expenses.length);
        const container = document.getElementById('trendChart');
        console.log('🔍 trendChart container found:', !!container);

        if (!container) return;

        // Clear existing content
        container.innerHTML = '';
        
        if (expenses.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No expenses recorded yet</p>';
            return;
        }

        // Group expenses by month
        const monthlyData = {};
        expenses.forEach(expense => {
            const date = new Date(expense.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += expense.amount;
        });

        // Get last 6 months or all available months
        const allMonths = Object.keys(monthlyData).sort();
        const months = allMonths.slice(-6);
        
        if (months.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No monthly data available</p>';
            return;
        }

        const maxAmount = Math.max(...months.map(month => monthlyData[month]));
        const minHeight = 20; // Minimum bar height for visibility
        
        // Check if mobile device
        const isMobile = this.isMobileDevice();
        console.log('🔍 Is mobile device:', isMobile);
        
        let chartHTML = '<div style="padding: 20px;">';
        
        // Chart title and total
        const totalMonthlyExpenses = months.reduce((sum, month) => sum + monthlyData[month], 0);
        const avgMonthly = totalMonthlyExpenses / months.length;
        
        chartHTML += `
            <div style="margin-bottom: 20px; text-align: center;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                    <div style="font-size: 14px; opacity: 0.9;">Average Monthly Spending</div>
                    <div style="font-size: 22px; font-weight: 600; margin-top: 5px;">${this.formatCurrency(avgMonthly)}</div>
                </div>
            </div>
        `;
        
        // Mobile-optimized chart bars
        const barHeight = isMobile ? 120 : 150;
        chartHTML += `<div style="display: flex; align-items: end; justify-content: space-between; min-height: ${barHeight + 30}px; margin-bottom: 15px; padding: 0 ${isMobile ? '5px' : '10px'};">`;
        
        months.forEach((month, index) => {
            const amount = monthlyData[month] || 0;
            const normalizedHeight = Math.max(minHeight, (amount / maxAmount) * barHeight);
            const date = new Date(month + '-01');
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: isMobile ? undefined : '2-digit' });
            
            // Enhanced color system for better mobile visibility
            const intensity = amount / maxAmount;
            const baseHue = 220;
            const color = `hsl(${baseHue + intensity * 40}, 75%, ${55 + intensity * 10}%)`;
            const shadowColor = `hsla(${baseHue + intensity * 40}, 75%, ${35 + intensity * 10}%, 0.3)`;
            
            chartHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; flex: 1; margin: 0 ${isMobile ? '1px' : '2px'};">
                    <div style="
                        width: 100%; 
                        max-width: ${isMobile ? '45px' : '60px'};
                        background: linear-gradient(to top, ${color}, ${color}E6);
                        height: ${normalizedHeight}px; 
                        border-radius: 6px 6px 0 0; 
                        margin-bottom: 8px; 
                        position: relative;
                        box-shadow: 0 4px 12px ${shadowColor};
                        border: 2px solid rgba(255,255,255,0.3);
                        cursor: pointer;
                        transition: all 0.3s ease;
                    " 
                    onclick="this.style.transform='scale(1.1)'; setTimeout(() => this.style.transform='scale(1)', 200)"
                    title="${monthName}: ${this.formatCurrency(amount)}">
                        
                        <!-- Mobile-friendly amount display -->
                        <div style="
                            position: absolute; 
                            bottom: 100%; 
                            left: 50%; 
                            transform: translateX(-50%); 
                            font-size: ${isMobile ? '10px' : '11px'}; 
                            color: #333; 
                            white-space: nowrap; 
                            margin-bottom: 6px;
                            background: rgba(255,255,255,0.95);
                            padding: ${isMobile ? '3px 5px' : '4px 6px'};
                            border-radius: 4px;
                            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
                            font-weight: 600;
                            border: 1px solid rgba(0,0,0,0.1);
                        ">
                            ${isMobile ? this.formatCurrencyShort(amount) : this.formatCurrency(amount)}
                        </div>
                        
                        <!-- Progress indicator for mobile -->
                        ${isMobile ? `
                            <div style="
                                position: absolute;
                                bottom: 5px;
                                left: 50%;
                                transform: translateX(-50%);
                                font-size: 8px;
                                color: white;
                                font-weight: bold;
                                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
                            ">
                                ${Math.round(intensity * 100)}%
                            </div>
                        ` : ''}
                    </div>
                    <span style="font-size: ${isMobile ? '11px' : '12px'}; color: #666; font-weight: 500; text-align: center; line-height: 1.2;">${monthName}</span>
                </div>
            `;
        });
        
        chartHTML += '</div>';
        
        // Enhanced summary stats for mobile
        const currentMonth = months[months.length - 1];
        const previousMonth = months[months.length - 2];
        let trendHTML = '';
        
        if (previousMonth && monthlyData[currentMonth] && monthlyData[previousMonth]) {
            const trend = monthlyData[currentMonth] - monthlyData[previousMonth];
            const trendPercent = (trend / monthlyData[previousMonth]) * 100;
            
            let trendIcon = '➡️';
            let trendColor = '#666';
            let trendText = 'No change from last month';
            
            if (trend > 0) {
                trendIcon = '📈';
                trendColor = '#ff6b6b';
                trendText = `${Math.abs(trendPercent).toFixed(1)}% increase from last month`;
            } else if (trend < 0) {
                trendIcon = '📉';
                trendColor = '#51cf66';
                trendText = `${Math.abs(trendPercent).toFixed(1)}% decrease from last month`;
            }
            
            trendHTML = `
                <div style="
                    text-align: center; 
                    padding: 15px; 
                    margin-top: 15px;
                    background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(248,249,250,0.9));
                    border-radius: 12px;
                    border: 1px solid rgba(0,0,0,0.05);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                ">
                    <div style="font-size: 24px; margin-bottom: 8px;">${trendIcon}</div>
                    <div style="color: ${trendColor}; font-size: ${isMobile ? '13px' : '14px'}; font-weight: 600; line-height: 1.3;">
                        ${trendText}
                    </div>
                    <div style="color: #666; font-size: ${isMobile ? '11px' : '12px'}; margin-top: 5px;">
                        Current: ${this.formatCurrency(monthlyData[currentMonth])} | Previous: ${this.formatCurrency(monthlyData[previousMonth])}
                    </div>
                </div>
            `;
        }
        
        chartHTML += trendHTML;
        chartHTML += '</div>';
        
        container.innerHTML = chartHTML;
    }

    // Helper methods for mobile compatibility
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    formatCurrencyShort(amount) {
        if (amount >= 1000000) {
            return `₱${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `₱${(amount / 1000).toFixed(1)}K`;
        } else {
            return `₱${amount.toFixed(0)}`;
        }
    }

    generateFinancialTips(income, expenses, categoryTotals, netBalance) {
        const tipsContainer = document.getElementById('financial-tips');
        if (!tipsContainer) return;

        const tips = [];
        
        // Income vs Expenses analysis
        if (netBalance > 0) {
            const savingsRate = (netBalance / income) * 100;
            if (savingsRate >= 20) {
                tips.push({
                    icon: '🌟',
                    title: 'Excellent Savings!',
                    message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep up the great work!`
                });
            } else if (savingsRate >= 10) {
                tips.push({
                    icon: '👍',
                    title: 'Good Savings Habit',
                    message: `You're saving ${savingsRate.toFixed(1)}% - try to reach 20% for better financial security.`
                });
            } else {
                tips.push({
                    icon: '📈',
                    title: 'Boost Your Savings',
                    message: `Currently saving ${savingsRate.toFixed(1)}%. Aim for at least 10% of your income.`
                });
            }
        } else {
            tips.push({
                icon: '⚠️',
                title: 'Spending Alert',
                message: `You're spending ${this.formatCurrency(Math.abs(netBalance))} more than you earn. Review your expenses.`
            });
        }

        // Category-specific tips
        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3);

        if (sortedCategories.length > 0) {
            const topCategory = sortedCategories[0];
            const categoryName = this.categories.find(cat => cat.id === topCategory[0])?.name || topCategory[0];
            const percentage = (topCategory[1] / expenses) * 100;
            
            if (percentage > 40) {
                tips.push({
                    icon: '🎯',
                    title: 'Category Focus',
                    message: `${categoryName} takes up ${percentage.toFixed(1)}% of your spending. Consider optimizing this area.`
                });
            }
        }

        // Daily spending tips
        const dailyAvg = expenses / 30;
        if (dailyAvg > 1000) {
            tips.push({
                icon: '💡',
                title: 'Daily Spending Tip',
                message: `Your daily average is ${this.formatCurrency(dailyAvg)}. Try the 24-hour rule before big purchases.`
            });
        }

        // Motivational tips
        const motivationalTips = [
            {
                icon: '🏆',
                title: 'Financial Goal',
                message: 'Set up an emergency fund equal to 6 months of expenses for financial security.'
            },
            {
                icon: '💰',
                title: 'Smart Spending',
                message: 'Track every peso! Small expenses add up quickly over time.'
            },
            {
                icon: '🎯',
                title: 'Budgeting Tip',
                message: 'Follow the 50-30-20 rule: 50% needs, 30% wants, 20% savings.'
            },
            {
                icon: '📊',
                title: 'Review Regularly',
                message: 'Review your expenses weekly to stay on track with your financial goals.'
            }
        ];

        // Add a random motivational tip
        tips.push(motivationalTips[Math.floor(Math.random() * motivationalTips.length)]);

        // Render tips
        tipsContainer.innerHTML = '';
        tips.forEach(tip => {
            const tipDiv = document.createElement('div');
            tipDiv.className = 'tip-card';
            tipDiv.innerHTML = `
                <div class="tip-icon">${tip.icon}</div>
                <div class="tip-content">
                    <h4>${tip.title}</h4>
                    <p>${tip.message}</p>
                </div>
            `;
            tipsContainer.appendChild(tipDiv);
        });
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    resetForm(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            this.setDefaultDate();
        }
    }

    deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveExpensesToCloud();
            this.renderExpenses();
            this.renderReimbursements();
            this.updateSummary();
            this.renderAnalytics();
            this.showNotification('Expense deleted successfully!', 'success');
        }
    }

    editExpense(id) {
        console.log('editExpense called with id:', id);
        const expense = this.expenses.find(exp => String(exp.id) === String(id));
        if (!expense) {
            console.error('Expense not found for id:', id);
            return;
        }

        // Fill the form with existing data
        document.getElementById('expense-description').value = expense.description;
        document.getElementById('expense-amount').value = expense.amount;
        document.getElementById('expense-category').value = expense.category;
        document.getElementById('expense-date').value = expense.date;
        document.getElementById('expense-reimbursement').checked = expense.isReimbursement;

        // Change the form to edit mode
        const form = document.getElementById('expense-form');
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Store the original text and update button
        if (!submitButton.originalText) {
            submitButton.originalText = submitButton.innerHTML;
        }
        submitButton.innerHTML = '<i class="fas fa-save"></i> Update Expense';
        
        // Store the ID being edited
        form.dataset.editingId = id;

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
        this.showNotification('Editing expense - update the fields and click "Update Expense"', 'info');
    }

    editIncome(id) {
        console.log('editIncome called with id:', id, 'type:', typeof id);
        const income = this.income.find(inc => String(inc.id) === String(id));
        if (!income) {
            console.error('Income not found for id:', id);
            return;
        }
        
        console.log('Found income to edit:', income);

        // Fill the form with existing data
        document.getElementById('income-description').value = income.description;
        document.getElementById('income-amount').value = income.amount;
        document.getElementById('income-type').value = income.type;
        document.getElementById('income-date').value = income.date;
        
        // Set customer dropdown value if available
        const customerSelect = document.getElementById('income-customer');
        if (customerSelect) {
            customerSelect.value = income.customerId || '';
        }

        // Change the form to edit mode
        const form = document.getElementById('income-form');
        const submitButton = form.querySelector('button[type="submit"]');
        
        // Store the original text and update button
        if (!submitButton.originalText) {
            submitButton.originalText = submitButton.innerHTML;
        }
        submitButton.innerHTML = '<i class="fas fa-save"></i> Update Income';
        
        // Store the ID being edited
        form.dataset.editingId = id;

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
        this.showNotification('Editing income - update the fields and click "Update Income"', 'info');
    }

    deleteIncome(id) {
        if (confirm('Are you sure you want to delete this income entry?')) {
            this.income = this.income.filter(income => income.id !== id);
            this.saveIncomeToCloud();
            this.renderIncome();
            this.updateSummary();
            this.renderAnalytics();
            this.showNotification('Income deleted successfully!', 'success');
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            ${message}
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    // Cloud sync methods
    async forceSyncToCloud() {
        if (!this.currentUser) {
            this.showNotification('Please sign in to sync to cloud', 'warning');
            return;
        }
        
        try {
            this.showNotification('Syncing to cloud...', 'info');
            
            await Promise.all([
                this.saveExpensesToCloud(),
                this.saveIncomeToCloud(),
                this.savePettyCashToCloud(),
                this.saveCategoriesToCloud()
            ]);
            
            this.showNotification('Successfully synced to cloud!', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('Failed to sync to cloud', 'error');
        }
    }

    async refreshFromCloud() {
        if (!this.currentUser) {
            this.showNotification('Please sign in to refresh from cloud', 'warning');
            return;
        }
        
        try {
            this.showNotification('Refreshing from cloud...', 'info');
            await this.loadFromCloud();
            this.showNotification('Successfully refreshed from cloud!', 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            this.showNotification('Failed to refresh from cloud', 'error');
        }
    }

    // Reimbursement batch payment methods
    processBatchPayments() {
        this.showNotification('Batch payment processing coming soon!', 'info');
    }

    confirmBatchPayments() {
        this.showNotification('Batch payment confirmation coming soon!', 'info');
    }

    cancelBatchPayments() {
        this.showNotification('Batch payment cancelled', 'info');
    }

    // Payment Modal Functions
    openPaymentModal(expenseId) {
        const expense = this.expenses.find(exp => exp.id === expenseId);
        if (!expense || expense.isPaid) {
            this.showNotification('Expense not found or already paid', 'error');
            return;
        }

        // Populate modal with expense data
        document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('payment-amount').value = expense.amount;
        document.getElementById('payment-description').value = expense.description;
        
        // Store the expense ID for processing
        document.getElementById('payment-form').dataset.expenseId = expenseId;
        
        // Show modal
        document.getElementById('payment-modal').style.display = 'block';
        
        // Add form submit handler
        const form = document.getElementById('payment-form');
        form.onsubmit = (e) => this.processPayment(e);
    }

    closePaymentModal() {
        document.getElementById('payment-modal').style.display = 'none';
        document.getElementById('payment-form').reset();
        delete document.getElementById('payment-form').dataset.expenseId;
    }

    processPayment(event) {
        event.preventDefault();
        
        const form = document.getElementById('payment-form');
        const expenseId = parseInt(form.dataset.expenseId);
        const paymentDate = document.getElementById('payment-date').value;
        const paymentAmount = parseFloat(document.getElementById('payment-amount').value);
        
        if (!expenseId || !paymentDate || !paymentAmount) {
            this.showNotification('Please fill in all payment details', 'error');
            return;
        }

        // Find the expense
        const expenseIndex = this.expenses.findIndex(exp => exp.id === expenseId);
        if (expenseIndex === -1) {
            this.showNotification('Expense not found', 'error');
            return;
        }

        const expense = this.expenses[expenseIndex];

        // Update the expense as paid
        this.expenses[expenseIndex] = {
            ...expense,
            isPaid: true,
            paymentDate: paymentDate,
            paidAmount: paymentAmount
        };

        // Add the payment as income with "Reimbursement" category
        const reimbursementIncome = {
            id: Date.now() + Math.random(), // Unique ID
            description: `Reimbursement: ${expense.description}`,
            amount: paymentAmount,
            category: 'reimbursement',
            date: paymentDate,
            timestamp: new Date().toISOString()
        };

        this.income.push(reimbursementIncome);

        // Save to cloud and update UI
        this.saveExpensesToCloud();
        this.saveIncomeToCloud();
        this.updateUI();
        
        this.showNotification('Payment processed successfully! Added to income as reimbursement.', 'success');
        this.closePaymentModal();
    }

    // Close modal when clicking outside
    setupModalCloseHandler() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.onclick = (event) => {
                if (event.target === modal) {
                    this.closePaymentModal();
                }
            };
        }
    }

    // Petty Cash Functions
    addPettyCashTransaction(event) {
        event.preventDefault();
        
        const description = document.getElementById('petty-cash-description').value.trim();
        const amount = parseFloat(document.getElementById('petty-cash-amount').value);
        const category = document.getElementById('petty-cash-category').value;
        const date = document.getElementById('petty-cash-date').value;
        
        if (!description || !amount || !category || !date) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        // Check if there's enough petty cash balance
        const currentBalance = this.getPettyCashBalance();
        if (amount > currentBalance) {
            this.showNotification(`Insufficient petty cash balance. Current balance: ${this.formatCurrency(currentBalance)}`, 'error');
            return;
        }

        // Add petty cash transaction
        const pettyCashTransaction = {
            id: Date.now() + Math.random(),
            description,
            amount,
            category,
            date,
            timestamp: new Date().toISOString()
        };

        this.pettyCash.push(pettyCashTransaction);

        // Also add as regular expense
        const expense = {
            id: Date.now() + Math.random() + 1,
            description: `[Cash] ${description}`,
            amount,
            category,
            date,
            isReimbursement: false,
            isPaid: false,
            paymentDate: null,
            timestamp: new Date().toISOString()
        };

        this.expenses.push(expense);

        // Save and update UI
        this.savePettyCash();
        this.saveExpenses();
        this.saveExpensesToCloud();
        this.savePettyCashToCloud();
        this.updateUI();
        this.resetForm('petty-cash-form');
        this.setDefaultDate();
        
        this.showNotification('Cash transaction recorded successfully!', 'success');
    }

    getPettyCashBalance() {
        // Calculate balance: allocated amount - spent amount
        const allocated = this.expenses
            .filter(expense => {
                const category = this.categories.find(cat => cat.id === expense.category);
                return category?.name === 'Petty Cash';
            })
            .reduce((sum, expense) => sum + expense.amount, 0);
            
        const spent = this.pettyCash
            .reduce((sum, transaction) => sum + transaction.amount, 0);
            
        return allocated - spent;
    }

    getPettyCashAllocated() {
        return this.expenses
            .filter(expense => {
                const category = this.categories.find(cat => cat.id === expense.category);
                return category?.name === 'Petty Cash';
            })
            .reduce((sum, expense) => sum + expense.amount, 0);
    }

    getPettyCashSpent() {
        return this.pettyCash
            .reduce((sum, transaction) => sum + transaction.amount, 0);
    }

    updatePettyCashSummary() {
        const balanceEl = document.getElementById('petty-cash-balance');
        const spentEl = document.getElementById('petty-cash-spent');
        const allocatedEl = document.getElementById('petty-cash-allocated');
        
        if (balanceEl) balanceEl.textContent = this.formatCurrency(this.getPettyCashBalance());
        if (spentEl) spentEl.textContent = this.formatCurrency(this.getPettyCashSpent());
        if (allocatedEl) allocatedEl.textContent = this.formatCurrency(this.getPettyCashAllocated());
    }

    renderPettyCash() {
        const tbody = document.getElementById('petty-cash-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (this.pettyCash.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">No cash transactions recorded yet</td></tr>';
            return;
        }

        // Sort by date (newest first)
        const sortedTransactions = [...this.pettyCash].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedTransactions.forEach(transaction => {
            const category = this.categories.find(cat => cat.id === transaction.category);
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${this.formatDate(transaction.date)}</td>
                <td>${transaction.description}</td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; background: ${category?.color || '#ccc'}; border-radius: 50%;"></span>
                        ${category?.name || 'Unknown'}
                    </span>
                </td>
                <td>${this.formatCurrency(transaction.amount)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-danger btn-sm" onclick="expenseTracker.deletePettyCashTransaction(${transaction.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    deletePettyCashTransaction(id) {
        if (confirm('Are you sure you want to delete this cash transaction?')) {
            // Find the transaction first
            const transaction = this.pettyCash.find(t => t.id === id);
            
            // Remove from petty cash
            this.pettyCash = this.pettyCash.filter(t => t.id !== id);
            
            // Also remove the corresponding expense
            if (transaction) {
                this.expenses = this.expenses.filter(expense => 
                    !(expense.description === `[Cash] ${transaction.description}` && 
                      expense.amount === transaction.amount && 
                      expense.date === transaction.date)
                );
            }
            
            this.savePettyCash();
            this.saveExpenses();
            this.saveExpensesToCloud();
            this.savePettyCashToCloud();
            this.updateUI();
            this.showNotification('Cash transaction deleted successfully!', 'success');
        }
    }
}

// ===== CHECK PRINTING FUNCTIONS =====

// Add these methods to ExpenseTracker class by extending its prototype
ExpenseTracker.prototype.numberToWords = function(num) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const thousands = ['', 'thousand', 'million', 'billion'];

    if (num === 0) return 'zero';
    if (num < 0) return 'negative ' + this.numberToWords(-num);

    const parts = [];
    let thousandIndex = 0;

    while (num > 0) {
        const chunk = num % 1000;
        if (chunk !== 0) {
            parts.unshift(this.convertHundreds(chunk) + (thousands[thousandIndex] ? ' ' + thousands[thousandIndex] : ''));
        }
        num = Math.floor(num / 1000);
        thousandIndex++;
    }

    return parts.join(' ').trim();
};

ExpenseTracker.prototype.convertHundreds = function(num) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
                 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    let result = '';
    
    if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' hundred';
        num %= 100;
        if (num > 0) result += ' ';
    }
    
    if (num >= 20) {
        result += tens[Math.floor(num / 10)];
        if (num % 10 > 0) result += '-' + ones[num % 10];
    } else if (num > 0) {
        result += ones[num];
    }
    
    return result;
};

ExpenseTracker.prototype.formatCheckAmount = function(amount) {
    const dollars = Math.floor(amount);
    const cents = Math.round((amount - dollars) * 100);
    
    const dollarsInWords = this.numberToWords(dollars);
    const centsText = cents === 0 ? 'and 00/100' : `and ${cents.toString().padStart(2, '0')}/100`;
    
    return {
        words: dollarsInWords + ' ' + centsText + ' dollars',
        numerical: `$${amount.toFixed(2)}`
    };
};

ExpenseTracker.prototype.getCurrentCheckNumber = function() {
    const savedNumber = localStorage.getItem('expenseTracker_currentCheckNumber');
    const startingNumber = document.getElementById('check-starting-number')?.value || 1001;
    return savedNumber ? parseInt(savedNumber) : parseInt(startingNumber);
};

ExpenseTracker.prototype.updateCheckNumber = function(newNumber) {
    localStorage.setItem('expenseTracker_currentCheckNumber', newNumber.toString());
};

ExpenseTracker.prototype.renderCheckReimbursements = function() {
    const tbody = document.getElementById('check-reimbursements-tbody');
    if (!tbody) return;

    const pendingReimbursements = this.expenses.filter(expense => 
        expense.forReimbursement && expense.reimbursementStatus === 'pending'
    );

    tbody.innerHTML = pendingReimbursements.map((expense, index) => {
        const checkNumber = expense.checkNumber || '';
        const status = expense.checkStatus || 'pending';
        
        return `
            <tr>
                <td>
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               class="check-select" 
                               data-expense-id="${expense.id}" 
                               ${expense.selectedForCheck ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td>${new Date(expense.date).toLocaleDateString()}</td>
                <td>${expense.payee || 'Employee Reimbursement'}</td>
                <td>${expense.description}</td>
                <td>$${expense.amount.toFixed(2)}</td>
                <td>
                    <span class="check-status ${status}">${status}</span>
                </td>
                <td class="check-number-cell">${checkNumber}</td>
            </tr>
        `;
    }).join('');

    // Add event listeners to checkboxes
    tbody.querySelectorAll('.check-select').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const expenseId = e.target.dataset.expenseId;
            const expense = this.expenses.find(exp => exp.id === expenseId);
            if (expense) {
                expense.selectedForCheck = e.target.checked;
                this.saveToStorage();
            }
        });
    });
};

ExpenseTracker.prototype.toggleAllChecks = function() {
    const selectAllCheckbox = document.getElementById('select-all-checks');
    const checkboxes = document.querySelectorAll('.check-select');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const expenseId = checkbox.dataset.expenseId;
        const expense = this.expenses.find(exp => exp.id === expenseId);
        if (expense) {
            expense.selectedForCheck = checkbox.checked;
        }
    });
    
    this.saveToStorage();
};

ExpenseTracker.prototype.selectAllPendingReimbursements = function() {
    this.expenses.forEach(expense => {
        if (expense.forReimbursement && expense.reimbursementStatus === 'pending') {
            expense.selectedForCheck = true;
        }
    });
    this.saveToStorage();
    this.renderCheckReimbursements();
    
    const selectAllCheckbox = document.getElementById('select-all-checks');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = true;
    }
    
    this.showNotification('All pending reimbursements selected for check printing', 'success');
};

ExpenseTracker.prototype.generateCheckHTML = function(expense, checkNumber, bankInfo) {
    const amount = this.formatCheckAmount(expense.amount);
    const today = new Date().toLocaleDateString();
    
    return `
        <div class="check" data-expense-id="${expense.id}">
            <div class="check-header">
                <div class="check-bank-info">
                    <h3>${bankInfo.bankName}</h3>
                    <p>${bankInfo.bankAddress}</p>
                    <p>Account: ${bankInfo.accountNumber} | Routing: ${bankInfo.routingNumber}</p>
                </div>
                <div class="check-number-date">
                    <div class="check-number">Check #${checkNumber}</div>
                    <div class="check-date">${today}</div>
                </div>
            </div>
            <div class="check-body">
                <div class="check-pay-line">
                    <label>Pay to the order of:</label>
                    <div class="check-payee">${expense.payee || 'Employee Reimbursement'}</div>
                </div>
                <div class="check-amount-section">
                    <div class="check-amount-words">
                        <label>Amount in words:</label>
                        <div class="amount-words-line">${amount.words}</div>
                    </div>
                    <div class="check-amount-box">${amount.numerical}</div>
                </div>
                <div class="check-memo-line">
                    <label>Memo:</label>
                    <div class="check-memo">${expense.description}</div>
                </div>
                <div class="check-signature-area">
                    <div class="check-signature-line">${bankInfo.signatureLine}</div>
                    <div class="check-account-info">
                        <div>${bankInfo.bankName}</div>
                        <div>Account: ${bankInfo.accountNumber}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

ExpenseTracker.prototype.generateSelectedChecks = function() {
    const selectedExpenses = this.expenses.filter(expense => 
        expense.selectedForCheck && 
        expense.forReimbursement && 
        expense.reimbursementStatus === 'pending'
    );

    if (selectedExpenses.length === 0) {
        this.showNotification('Please select reimbursements to print checks for', 'error');
        return;
    }

    this.previewChecks();
};

ExpenseTracker.prototype.previewChecks = function() {
    const selectedExpenses = this.expenses.filter(expense => 
        expense.selectedForCheck && 
        expense.forReimbursement && 
        expense.reimbursementStatus === 'pending'
    );

    if (selectedExpenses.length === 0) {
        this.showNotification('Please select reimbursements to preview checks for', 'error');
        return;
    }

    const bankInfo = {
        bankName: document.getElementById('check-bank-name')?.value || 'Made Bread Business Account',
        bankAddress: document.getElementById('check-bank-address')?.value || 'Taytay, Rizal, Philippines',
        accountNumber: document.getElementById('check-account-number')?.value || '****-****-****-1234',
        routingNumber: document.getElementById('check-routing-number')?.value || '123456789',
        signatureLine: document.getElementById('check-signature-line')?.value || 'Mike B. Pineda, Manager'
    };

    let currentCheckNumber = this.getCurrentCheckNumber();
    const checksHTML = selectedExpenses.map(expense => {
        const checkHTML = this.generateCheckHTML(expense, currentCheckNumber, bankInfo);
        
        expense.checkNumber = currentCheckNumber;
        expense.checkStatus = 'printed';
        expense.checkDate = new Date().toISOString();
        
        currentCheckNumber++;
        return checkHTML;
    }).join('');

    this.updateCheckNumber(currentCheckNumber);

    const checksContainer = document.getElementById('checks-container');
    const modal = document.getElementById('check-preview-modal');
    
    if (checksContainer && modal) {
        checksContainer.innerHTML = checksHTML;
        modal.style.display = 'block';
        
        this.saveToStorage();
        this.renderCheckReimbursements();
        this.renderReimbursements();
    }
};

ExpenseTracker.prototype.printChecks = function() {
    const selectedExpenses = this.expenses.filter(expense => 
        expense.selectedForCheck && 
        expense.checkNumber
    );

    selectedExpenses.forEach(expense => {
        expense.reimbursementStatus = 'paid';
        expense.reimbursementPaidDate = new Date().toISOString();
        expense.selectedForCheck = false;
    });

    this.saveToStorage();
    this.updateSummary();
    this.renderReimbursements();
    this.renderCheckReimbursements();

    window.print();

    this.showNotification(`${selectedExpenses.length} checks printed successfully!`, 'success');
    this.closeCheckPreview();
};

ExpenseTracker.prototype.closeCheckPreview = function() {
    const modal = document.getElementById('check-preview-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Global functions for HTML onclick events
function showTab(tabName) {
    console.log('🔄 Switching to tab:', tabName);
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected tab
    const tabElement = document.getElementById(`${tabName}-tab`);
    if (tabElement) {
        tabElement.style.display = 'block';
        tabElement.classList.add('active');
        console.log('✅ Tab visible:', tabName);
    } else {
        console.error('❌ Tab not found:', tabName + '-tab');
    }
    
    // Add active class to clicked button
    const buttonElement = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (buttonElement) {
        buttonElement.classList.add('active');
    }
    
    // Refresh analytics when analytics tab is shown
    if (tabName === 'analytics' && window.expenseTracker) {
        window.expenseTracker.renderAnalytics();
    }
    
    // Populate income customer dropdown when income tab is shown
    if (tabName === 'income' && window.customerManager) {
        console.log('💰 Income tab activated - populating customer dropdown');
        customerManager.populateIncomeCustomerDropdown();
    }
    
    // Load customers when customers tab is shown
    if (tabName === 'customers' && window.customerManager) {
        console.log('👥 Customers tab activated - loading customers');
        customerManager.loadCustomers();
    }
    
    // Render permissions matrix when permissions tab is shown
    if (tabName === 'permissions' && window.expenseTracker && window.expenseTracker.isOwner()) {
        console.log('🔒 Permissions tab activated - rendering matrix');
        
        // Force show the permissions tab content
        const permissionsTab = document.getElementById('permissions-tab');
        if (permissionsTab) {
            permissionsTab.style.display = 'block';
            permissionsTab.style.visibility = 'visible';
            permissionsTab.style.opacity = '1';
            permissionsTab.style.height = 'auto';
        }
        
        window.expenseTracker.renderPermissionsMatrix();
        window.expenseTracker.renderTeamMembersPermissions();
        
        // Additional CSS fixes
        setTimeout(() => {
            const matrixContainer = document.querySelector('.permissions-matrix-container');
            const teamOverview = document.querySelector('.team-permissions-overview');
            
            if (matrixContainer) {
                matrixContainer.style.display = 'block';
                matrixContainer.style.visibility = 'visible';
            }
            
            if (teamOverview) {
                teamOverview.style.display = 'block';
                teamOverview.style.visibility = 'visible';
            }
        }, 100);
    }
}

// Authentication functions
async function signUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }
    
    try {
        await window.auth.createUserWithEmailAndPassword(email, password);
        console.log('✅ User created successfully');
        
        // Clear form
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        
    } catch (error) {
        console.error('❌ Sign up error:', error);
        alert('Sign up failed: ' + error.message);
    }
}

async function signIn() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) {
        alert('Please enter both email and password');
        return;
    }
    
    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        console.log('✅ User signed in successfully');
        
        // Clear form
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-password').value = '';
        
    } catch (error) {
        console.error('❌ Sign in error:', error);
        alert('Sign in failed: ' + error.message);
    }
}

async function signOut() {
    try {
        await window.auth.signOut();
        console.log('✅ User signed out successfully');
    } catch (error) {
        console.error('❌ Sign out error:', error);
        alert('Sign out failed: ' + error.message);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing Expense Tracker with Firebase');
    try {
        window.expenseTracker = new ExpenseTracker();
        console.log('Expense Tracker with Firebase initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Expense Tracker:', error);
    }
});
// ========================================
// TEAM MANAGEMENT SYSTEM
// ========================================

// Add team-related properties to ExpenseTracker class
ExpenseTracker.prototype.storeInfo = null;
ExpenseTracker.prototype.teamMembers = [];
ExpenseTracker.prototype.pendingInvitations = [];
ExpenseTracker.prototype.userRole = 'owner'; // owner, purchaser, member
ExpenseTracker.prototype.isOwner = function() { return this.userRole === 'owner'; };
ExpenseTracker.prototype.canPrintChecks = function() { return this.userRole === 'owner' || this.userRole === 'purchaser'; };
ExpenseTracker.prototype.canAddExpenses = function() { return this.userRole === 'owner' || this.userRole === 'purchaser' || this.userRole === 'member'; };
ExpenseTracker.prototype.canAddIncome = function() { return this.userRole === 'owner' || this.userRole === 'purchaser' || this.userRole === 'collector'; };
ExpenseTracker.prototype.canManagePettyCash = function() { return this.userRole === 'owner' || this.userRole === 'purchaser' || this.userRole === 'pettycash-manager'; };
ExpenseTracker.prototype.canManageTeam = function() { return this.userRole === 'owner'; };
ExpenseTracker.prototype.canViewAnalytics = function() { return true; }; // All roles can view analytics

// Custom permissions for individual users (new dynamic system)
ExpenseTracker.prototype.customPermissions = {};

// Default permissions template for all roles
ExpenseTracker.prototype.defaultPermissions = {
    'owner': {
        expenses: true,
        income: true, 
        pettycash: true,
        checkprinting: true,
        team: true,
        analytics: true
    },
    'purchaser': {
        expenses: true,
        income: true,
        pettycash: true, 
        checkprinting: true,
        team: false,
        analytics: true
    },
    'collector': {
        expenses: false,
        income: true,
        pettycash: false,
        checkprinting: false,
        team: false,
        analytics: true
    },
    'pettycash-manager': {
        expenses: false,
        income: false,
        pettycash: true,
        checkprinting: false,
        team: false,
        analytics: true
    },
    'member': {
        expenses: true,
        income: false,
        pettycash: false,
        checkprinting: false,
        team: false,
        analytics: true
    }
};

// Enhanced permission checking with custom permissions support
ExpenseTracker.prototype.hasPermission = function(userId, permission) {
    // If no userId provided, check current user
    if (!userId) {
        userId = this.currentUser?.uid;
    }
    
    // Check if we have custom permissions for this user
    if (this.customPermissions[userId]) {
        return this.customPermissions[userId][permission] || false;
    }
    
    // Fall back to role-based permissions
    const userRole = userId === this.currentUser?.uid ? this.userRole : this.getUserRole(userId);
    return this.defaultPermissions[userRole]?.[permission] || false;
};

// Get user role by ID (helper function)
ExpenseTracker.prototype.getUserRole = function(userId) {
    const member = this.teamMembers.find(m => m.id === userId);
    return member?.role || 'member';
};

// Updated permission functions to use custom permissions
ExpenseTracker.prototype.canPrintChecks = function(userId) { 
    return this.hasPermission(userId, 'checkprinting'); 
};
ExpenseTracker.prototype.canAddExpenses = function(userId) { 
    return this.hasPermission(userId, 'expenses'); 
};
ExpenseTracker.prototype.canAddIncome = function(userId) { 
    return this.hasPermission(userId, 'income'); 
};
ExpenseTracker.prototype.canManagePettyCash = function(userId) { 
    return this.hasPermission(userId, 'pettycash'); 
};
ExpenseTracker.prototype.canManageTeam = function(userId) { 
    return this.hasPermission(userId, 'team'); 
};

// Initialize team management
ExpenseTracker.prototype.initTeamManagement = function() {
    console.log('🏪 Initializing team management...');
    
    // Set up event listeners
    this.setupTeamEventListeners();
    
    // Load store info and team data
    this.loadStoreInfo();
    this.loadTeamMembers();
    this.loadPendingInvitations();
    
    // Update UI based on role
    this.updateRoleBasedUI();
    
    // Show permissions tab for owners and load permissions
    this.updatePermissionsTabVisibility();
    if (this.isOwner()) {
        this.loadCustomPermissions();
    }
};

// Setup team-related event listeners
ExpenseTracker.prototype.setupTeamEventListeners = function() {
    // Store info form
    const storeForm = document.getElementById('store-info-form');
    if (storeForm) {
        storeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveStoreInfo();
        });
    }
    
    // Team invitation form
    const inviteForm = document.getElementById('team-invite-form');
    if (inviteForm) {
        inviteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendTeamInvitation();
        });
    }
};

// Store Information Management
ExpenseTracker.prototype.saveStoreInfo = function() {
    if (!this.currentUser) return;
    
    const storeInfo = {
        name: document.getElementById('store-name').value,
        type: document.getElementById('store-type').value,
        location: document.getElementById('store-location').value,
        owner: document.getElementById('store-owner').value,
        updatedAt: new Date()
    };
    
    this.storeInfo = storeInfo;
    
    // Save to cloud if online
    if (this.currentUser) {
        this.saveStoreInfoToCloud(storeInfo);
    }
    
    // Save to localStorage as backup
    localStorage.setItem('storeInfo', JSON.stringify(storeInfo));
    
    this.showNotification('Store information saved successfully!', 'success');
};

ExpenseTracker.prototype.saveStoreInfoToCloud = async function(storeInfo) {
    try {
        await window.db
            .collection('users')
            .doc(this.getDataUserId())
            .collection('settings')
            .doc('storeInfo')
            .set(storeInfo);
        
        console.log('✅ Store info saved to cloud');
    } catch (error) {
        console.error('❌ Failed to save store info to cloud:', error);
    }
};

ExpenseTracker.prototype.loadStoreInfo = async function() {
    // Try to load from cloud first
    if (this.currentUser) {
        try {
            const doc = await window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('settings')
                .doc('storeInfo')
                .get();
            
            if (doc.exists) {
                this.storeInfo = doc.data();
                this.updateStoreInfoForm(this.storeInfo);
                return;
            }
        } catch (error) {
            console.error('Failed to load store info from cloud:', error);
        }
    }
    
    // Fallback to localStorage
    const localStoreInfo = localStorage.getItem('storeInfo');
    if (localStoreInfo) {
        this.storeInfo = JSON.parse(localStoreInfo);
        this.updateStoreInfoForm(this.storeInfo);
    }
};

ExpenseTracker.prototype.updateStoreInfoForm = function(storeInfo) {
    if (storeInfo) {
        document.getElementById('store-name').value = storeInfo.name || 'Made Bread';
        document.getElementById('store-type').value = storeInfo.type || 'Bakery-Café';
        document.getElementById('store-location').value = storeInfo.location || 'Taytay, Rizal';
        document.getElementById('store-owner').value = storeInfo.owner || 'Mike B. Pineda';
    }
};

// Generate random password
ExpenseTracker.prototype.generatePassword = function(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// Add Team Member - Creates account and saves to owner's team
ExpenseTracker.prototype.addTeamMember = async function() {
    console.log('🚀 addTeamMember called');
    console.log('Current user:', this.currentUser?.email);
    console.log('Is owner:', this.isOwner());
    
    if (!this.currentUser || !this.isOwner()) {
        this.showNotification('Only owners can add team members', 'error');
        return;
    }
    
    const email = document.getElementById('invite-email').value.trim().toLowerCase();
    const role = document.getElementById('invite-role').value;
    const name = document.getElementById('invite-name').value.trim();
    
    console.log('Form values:', { email, role, name });
    
    if (!email || !role || !name) {
        this.showNotification('Please fill in all fields', 'error');
        return;
    }
    
    // Check if email is already a member
    if (this.teamMembers.some(member => member.email.toLowerCase() === email)) {
        this.showNotification('This person is already a team member', 'error');
        return;
    }
    
    // Generate password
    const generatedPassword = this.generatePassword(10);
    const ownerId = this.currentUser.uid;
    const ownerEmail = this.currentUser.email;
    
    try {
        this.showNotification('Creating team member account...', 'info');
        
        // Store current owner credentials to re-login after
        const currentOwnerEmail = this.currentUser.email;
        
        // Create the Firebase Auth account for team member
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, generatedPassword);
        const newUserId = userCredential.user.uid;
        
        console.log('✅ Team member auth account created:', newUserId);
        
        // Create team member document with link to owner
        const teamMemberData = {
            id: newUserId,
            email: email,
            name: name,
            role: role,
            ownerId: ownerId,  // Link to owner's data
            ownerEmail: ownerEmail,
            createdAt: new Date().toISOString(),
            isTeamMember: true
        };
        
        // Save to the NEW user's document (so they know who their owner is)
        await window.db.collection('users').doc(newUserId).set({
            email: email,
            name: name,
            role: role,
            ownerId: ownerId,
            ownerEmail: ownerEmail,
            isTeamMember: true,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Also save to owner's team members collection
        await window.db
            .collection('users')
            .doc(ownerId)
            .collection('teamMembers')
            .doc(newUserId)
            .set(teamMemberData);
        
        console.log('✅ Team member data saved to Firestore');
        
        // Sign out the new user and sign back in as owner
        await window.auth.signOut();
        
        // Show password BEFORE re-login (in case re-login fails)
        document.getElementById('created-email').textContent = email;
        document.getElementById('created-password').textContent = generatedPassword;
        document.getElementById('generated-password-display').style.display = 'block';
        
        // Prompt owner to re-login
        this.showNotification('Team member created! Please sign in again with your owner account.', 'success');
        
        // Clear the form
        document.getElementById('team-invite-form').reset();
        
        // Add to local team members array
        this.teamMembers.push(teamMemberData);
        this.renderTeamMembers();
        
    } catch (error) {
        console.error('❌ Failed to create team member:', error);
        if (error.code === 'auth/email-already-in-use') {
            this.showNotification('This email is already registered. Ask them to login and you can link them.', 'error');
        } else {
            this.showNotification('Failed to create team member: ' + error.message, 'error');
        }
    }
};

// Legacy function - redirect to new addTeamMember
ExpenseTracker.prototype.sendTeamInvitation = async function() {
    console.log('📝 sendTeamInvitation called - redirecting to addTeamMember');
    return this.addTeamMember();
};

ExpenseTracker.prototype.isEmailAlreadyInvited = function(email) {
    // Check team members
    if (this.teamMembers.some(member => member.email === email)) {
        return true;
    }
    
    // Check pending invitations
    if (this.pendingInvitations.some(invite => invite.email === email && invite.status === 'pending')) {
        return true;
    }
    
    return false;
};

ExpenseTracker.prototype.sendInvitationEmail = function(invitation) {
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    // For now, we'll simulate with console log
    console.log('📧 Invitation Email Sent:');
    console.log(`To: ${invitation.email}`);
    console.log(`Subject: You're invited to join ${this.storeInfo?.name || 'Made Bread'} team`);
    console.log(`Role: ${invitation.role}`);
    console.log(`Invitation Link: [Would be app URL with invitation token]`);
    
    // Show notification about email sending
    this.showNotification('Invitation email sent! (Check console for simulation)', 'info');
};

ExpenseTracker.prototype.saveInvitationToCloud = async function(invitation) {
    try {
        await window.db
            .collection('users')
            .doc(this.getDataUserId())
            .collection('invitations')
            .doc(invitation.id)
            .set(invitation);
        
        console.log('✅ Invitation saved to cloud');
    } catch (error) {
        console.error('❌ Failed to save invitation to cloud:', error);
    }
};

// Load team members and invitations
ExpenseTracker.prototype.loadTeamMembers = async function() {
    // For now, owner is the only team member
    // In full implementation, this would load from cloud
    this.teamMembers = [
        {
            id: this.currentUser?.uid || 'owner',
            email: this.currentUser?.email || 'owner@madebread.com',
            name: this.storeInfo?.owner || 'Mike B. Pineda',
            role: 'owner',
            joinedAt: new Date()
        }
    ];
    
    this.renderTeamMembers();
};

ExpenseTracker.prototype.loadPendingInvitations = async function() {
    if (!this.currentUser) return;
    
    try {
        const snapshot = await window.db
            .collection('users')
            .doc(this.getDataUserId())
            .collection('invitations')
            .where('status', '==', 'pending')
            .get();
        
        this.pendingInvitations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        this.renderPendingInvitations();
    } catch (error) {
        console.error('Failed to load pending invitations:', error);
        this.pendingInvitations = [];
    }
};

// Render UI components
ExpenseTracker.prototype.renderTeamMembers = function() {
    const container = document.getElementById('team-members-list');
    if (!container) return;
    
    if (this.teamMembers.length === 0) {
        container.innerHTML = '<div class="empty-team">No team members yet. Invite some team members to get started!</div>';
        return;
    }
    
    container.innerHTML = this.teamMembers.map(member => `
        <div class="team-member-card">
            <div class="team-member-header">
                <div>
                    <p class="member-name">${member.name}</p>
                    <p class="member-email">${member.email}</p>
                </div>
                <span class="member-role ${member.role}">${member.role}</span>
            </div>
            ${member.role !== 'owner' ? `
                <div class="member-actions">
                    <button class="btn-remove" onclick="expenseTracker.removeTeamMember('${member.id}')">
                        <i class="fas fa-times"></i> Remove
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
};

ExpenseTracker.prototype.renderPendingInvitations = function() {
    const container = document.getElementById('pending-invitations');
    if (!container) return;
    
    if (this.pendingInvitations.length === 0) {
        container.innerHTML = '<div class="empty-invites">No pending invitations</div>';
        return;
    }
    
    container.innerHTML = this.pendingInvitations.map(invite => `
        <div class="invite-item">
            <div class="invite-info">
                <div class="invite-email">${invite.email}</div>
                <div class="invite-role">Role: ${invite.role}</div>
                <div style="font-size: 0.8rem; color: #666;">Invited: ${new Date(invite.invitedAt?.toDate?.() || invite.invitedAt).toLocaleDateString()}</div>
            </div>
            <div class="invite-actions">
                <button class="btn-resend" onclick="expenseTracker.resendInvitation('${invite.id}')">
                    <i class="fas fa-paper-plane"></i> Resend
                </button>
                <button class="btn-cancel" onclick="expenseTracker.cancelInvitation('${invite.id}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `).join('');
};

// Role-based UI updates
ExpenseTracker.prototype.updateRoleBasedUI = function() {
    // Show/hide Check Printing tab based on role
    const checkPrintingTab = document.querySelector('button[onclick="showTab(\'checkprinting\')"]');
    if (checkPrintingTab) {
        if (this.canPrintChecks()) {
            checkPrintingTab.style.display = 'block';
        } else {
            checkPrintingTab.style.display = 'none';
        }
    }
    
    // Show/hide Expenses tab based on role
    const expensesTab = document.querySelector('button[onclick="showTab(\'expenses\')"]');
    if (expensesTab) {
        if (this.canAddExpenses()) {
            expensesTab.style.display = 'block';
        } else {
            expensesTab.style.display = 'none';
        }
    }
    
    // Show/hide Reimbursements tab based on role  
    const reimbursementsTab = document.querySelector('button[onclick="showTab(\'reimbursements\')"]');
    if (reimbursementsTab) {
        if (this.canAddExpenses()) {
            reimbursementsTab.style.display = 'block';
        } else {
            reimbursementsTab.style.display = 'none';
        }
    }
    
    // Show/hide Petty Cash tab based on role
    const pettyCashTab = document.querySelector('button[onclick="showTab(\'pettycash\')"]');
    if (pettyCashTab) {
        if (this.canManagePettyCash()) {
            pettyCashTab.style.display = 'block';
        } else {
            pettyCashTab.style.display = 'none';
        }
    }
    
    // Income tab - show for owners, purchasers, and collectors
    const incomeTab = document.querySelector('button[onclick="showTab(\'income\')"]');
    if (incomeTab) {
        if (this.canAddIncome()) {
            incomeTab.style.display = 'block';
        } else {
            incomeTab.style.display = 'none';
        }
    }
    
    // Add role badge to user info
    const userInfo = document.getElementById('user-email');
    if (userInfo && this.currentUser) {
        const roleBadge = `<span class="user-role-badge">${this.userRole}</span>`;
        userInfo.innerHTML = this.currentUser.email + roleBadge;
    }
    
    // Show/hide team management sections based on role
    if (!this.canManageTeam()) {
        const inviteSection = document.querySelector('.team-invite-section');
        const pendingSection = document.querySelector('.pending-invites-section');
        if (inviteSection) inviteSection.style.display = 'none';
        if (pendingSection) pendingSection.style.display = 'none';
    }
    
    // Add collector-specific welcome message
    if (this.userRole === 'collector') {
        this.showCollectorWelcome();
    }
    
    // Add petty cash manager-specific welcome message  
    if (this.userRole === 'pettycash-manager') {
        this.showPettyCashManagerWelcome();
    }
};

// Utility functions
ExpenseTracker.prototype.removeTeamMember = async function(memberId) {
    if (!this.isOwner()) {
        this.showNotification('Only owners can remove team members', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to remove this team member?')) {
        // Remove from array
        this.teamMembers = this.teamMembers.filter(member => member.id !== memberId);
        
        // Update cloud (in full implementation)
        // await this.removeTeamMemberFromCloud(memberId);
        
        // Update UI
        this.renderTeamMembers();
        
        this.showNotification('Team member removed', 'success');
    }
};

ExpenseTracker.prototype.cancelInvitation = async function(inviteId) {
    if (!this.isOwner()) return;
    
    if (confirm('Cancel this invitation?')) {
        // Remove from array
        this.pendingInvitations = this.pendingInvitations.filter(invite => invite.id !== inviteId);
        
        // Remove from cloud
        try {
            await window.db
                .collection('users')
                .doc(this.getDataUserId())
                .collection('invitations')
                .doc(inviteId)
                .delete();
        } catch (error) {
            console.error('Failed to cancel invitation:', error);
        }
        
        // Update UI
        this.renderPendingInvitations();
        
        this.showNotification('Invitation cancelled', 'success');
    }
};

ExpenseTracker.prototype.resendInvitation = function(inviteId) {
    const invite = this.pendingInvitations.find(inv => inv.id === inviteId);
    if (invite) {
        this.sendInvitationEmail(invite);
        this.showNotification(`Invitation resent to ${invite.email}`, 'success');
    }
};

// Modify the existing auth handler to initialize team management
const originalHandleAuthStateChange = ExpenseTracker.prototype.handleAuthStateChange;
ExpenseTracker.prototype.handleAuthStateChange = function(user) {
    // Call original handler
    originalHandleAuthStateChange.call(this, user);
    
    // Initialize team management if user is signed in
    if (user) {
        setTimeout(() => {
            this.initTeamManagement();
        }, 1000); // Give time for other initialization
    }
};

console.log('🏪 Team management system loaded');
// Collector role specific functions
ExpenseTracker.prototype.showCollectorWelcome = function() {
    // Show a welcome message specifically for collectors
    const welcomeHtml = `
        <div style="background: linear-gradient(135deg, #9c27b0 0%, #e91e63 100%); 
                    color: white; 
                    padding: 20px; 
                    border-radius: 15px; 
                    margin: 20px 0; 
                    text-align: center;
                    box-shadow: 0 5px 15px rgba(156, 39, 176, 0.3);">
            <h3><i class="fas fa-coins"></i> Welcome, Collector!</h3>
            <p>Your role: Record daily sales, cash collections, and customer payments</p>
            <p><strong>📊 Use the Income tab to add revenue records</strong></p>
        </div>
    `;
    
    // Add to the income tab if it exists
    const incomeTab = document.getElementById('income-tab');
    if (incomeTab) {
        const existingWelcome = incomeTab.querySelector('.collector-welcome');
        if (!existingWelcome) {
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'collector-welcome';
            welcomeDiv.innerHTML = welcomeHtml;
            incomeTab.insertBefore(welcomeDiv, incomeTab.firstChild);
        }
    }
};

// Update the tab initialization to show appropriate tab for each role
ExpenseTracker.prototype.setDefaultTabForRole = function() {
    if (this.userRole === 'collector') {
        // Show income tab by default for collectors
        showTab('income');
    } else if (this.userRole === 'pettycash-manager') {
        // Show petty cash tab by default for petty cash managers
        showTab('pettycash');
    } else if (this.userRole === 'member') {
        // Show expenses tab by default for members
        showTab('expenses');
    } else {
        // Owners and purchasers see expenses by default
        showTab('expenses');
    }
};

// Update the init team management to set default tab
const originalInitTeamManagement = ExpenseTracker.prototype.initTeamManagement;
ExpenseTracker.prototype.initTeamManagement = function() {
    // Call original function
    originalInitTeamManagement.call(this);
    
    // Set default tab based on role
    setTimeout(() => {
        this.setDefaultTabForRole();
    }, 500);
};

console.log('🏪 Collector role functions loaded');
// Petty Cash Manager role specific functions
ExpenseTracker.prototype.showPettyCashManagerWelcome = function() {
    // Show a welcome message specifically for petty cash managers
    const welcomeHtml = `
        <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); 
                    color: white; 
                    padding: 20px; 
                    border-radius: 15px; 
                    margin: 20px 0; 
                    text-align: center;
                    box-shadow: 0 5px 15px rgba(255, 152, 0, 0.3);">
            <h3><i class="fas fa-wallet"></i> Welcome, Petty Cash Manager!</h3>
            <p>Your role: Manage petty cash fund and small cash transactions</p>
            <p><strong>💰 Use this tab to record petty cash withdrawals and deposits</strong></p>
        </div>
    `;
    
    // Add to the petty cash tab if it exists
    const pettyCashTab = document.getElementById('pettycash-tab');
    if (pettyCashTab) {
        const existingWelcome = pettyCashTab.querySelector('.pettycash-manager-welcome');
        if (!existingWelcome) {
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'pettycash-manager-welcome';
            welcomeDiv.innerHTML = welcomeHtml;
            pettyCashTab.insertBefore(welcomeDiv, pettyCashTab.firstChild);
        }
    }
};

console.log('💰 Petty Cash Manager role functions loaded');

// =================================
// PERMISSIONS MATRIX MANAGEMENT
// =================================

// Show/hide permissions tab based on user role
ExpenseTracker.prototype.updatePermissionsTabVisibility = function() {
    const permissionsTabButton = document.getElementById('permissions-tab-button');
    if (permissionsTabButton) {
        if (this.isOwner()) {
            permissionsTabButton.style.display = 'inline-block';
            console.log('🔒 Permissions tab made visible for owner');
            
            // Force immediate render for testing
            setTimeout(() => {
                console.log('🔒 Force rendering permissions matrix...');
                this.renderPermissionsMatrix();
                this.renderTeamMembersPermissions();
            }, 100);
        } else {
            permissionsTabButton.style.display = 'none';
        }
    } else {
        console.error('❌ Permissions tab button not found in DOM');
    }
};

// Load custom permissions from Firebase
ExpenseTracker.prototype.loadCustomPermissions = function() {
    if (!this.currentUser) return;

    const userDocRef = window.db.collection('users').doc(this.getDataUserId());
    
    userDocRef.get().then((doc) => {
        if (doc.exists && doc.data().customPermissions) {
            this.customPermissions = doc.data().customPermissions;
            console.log('📋 Custom permissions loaded:', this.customPermissions);
            
            // Re-render the matrix with loaded permissions
            this.renderPermissionsMatrix();
            this.renderTeamMembersPermissions();
        }
    }).catch((error) => {
        console.error('❌ Error loading custom permissions:', error);
    });
};

// Save custom permissions to Firebase
ExpenseTracker.prototype.saveCustomPermissions = function() {
    if (!this.currentUser || !this.isOwner()) return;

    const userDocRef = window.db.collection('users').doc(this.getDataUserId());
    
    userDocRef.update({
        customPermissions: this.customPermissions,
        lastPermissionUpdate: new Date().toISOString()
    }).then(() => {
        console.log('✅ Custom permissions saved');
        this.showNotification('Permissions saved successfully!', 'success');
        this.addPermissionChangeLog('Permissions updated', 'update');
    }).catch((error) => {
        console.error('❌ Error saving custom permissions:', error);
        this.showNotification('Failed to save permissions', 'error');
    });
};

// Render the permissions matrix table
ExpenseTracker.prototype.renderPermissionsMatrix = function() {
    console.log('🔒 renderPermissionsMatrix called');
    const matrixBody = document.getElementById('permissions-matrix-body');
    if (!matrixBody) {
        console.error('❌ permissions-matrix-body element not found');
        return;
    }
    
    console.log('🔒 Matrix body element found:', matrixBody);

    const permissions = [
        { key: 'expenses', name: 'Add Expenses', icon: 'fas fa-minus-circle' },
        { key: 'income', name: 'Add Income', icon: 'fas fa-plus-circle' },
        { key: 'pettycash', name: 'Manage Petty Cash', icon: 'fas fa-wallet' },
        { key: 'checkprinting', name: 'Print Checks', icon: 'fas fa-print' },
        { key: 'team', name: 'Team Management', icon: 'fas fa-users' },
        { key: 'analytics', name: 'View Analytics', icon: 'fas fa-chart-line' }
    ];

    const roles = ['owner', 'purchaser', 'collector', 'pettycash-manager', 'member'];

    let html = '';
    permissions.forEach(permission => {
        html += `
            <tr>
                <td class="feature-name">
                    <i class="${permission.icon}"></i>
                    ${permission.name}
                </td>`;
        
        roles.forEach(role => {
            const defaultValue = this.defaultPermissions[role][permission.key];
            const isOwner = role === 'owner';
            
            if (isOwner) {
                html += `
                    <td class="owner-permission">
                        <div class="permission-status permission-granted">
                            <i class="fas fa-crown"></i>
                        </div>
                    </td>`;
            } else {
                html += `
                    <td>
                        <div class="permission-checkbox-container">
                            <input type="checkbox" 
                                   class="permission-checkbox" 
                                   data-role="${role}" 
                                   data-permission="${permission.key}"
                                   ${defaultValue ? 'checked' : ''}
                                   onchange="expenseTracker.updateRolePermission('${role}', '${permission.key}', this.checked)">
                        </div>
                    </td>`;
            }
        });
        
        html += '</tr>';
    });

    console.log('🔒 Setting matrix HTML:', html.substring(0, 100) + '...');
    matrixBody.innerHTML = html;
    console.log('🔒 Matrix rendered successfully');
};

// Update a specific role permission
ExpenseTracker.prototype.updateRolePermission = function(role, permission, granted) {
    // Initialize default permissions for role if not exists
    if (!this.customPermissions[role]) {
        this.customPermissions[role] = { ...this.defaultPermissions[role] };
    }
    
    this.customPermissions[role][permission] = granted;
    
    console.log(`🔄 Permission updated: ${role}.${permission} = ${granted}`);
    
    // Update team members permissions display
    this.renderTeamMembersPermissions();
    
    // Add to changelog
    const action = granted ? 'granted' : 'revoked';
    this.addPermissionChangeLog(`${action} ${permission} for ${role}`, action);
};

// Render team members with their permissions
ExpenseTracker.prototype.renderTeamMembersPermissions = function() {
    console.log('🔒 renderTeamMembersPermissions called');
    const container = document.getElementById('team-members-permissions');
    if (!container) {
        console.error('❌ team-members-permissions element not found');
        return;
    }
    
    console.log('🔒 Team members container found:', container);

    // Get all team members including owner (always show owner even if no other members)
    const allMembers = [
        { 
            email: this.currentUser?.email || 'owner@example.com', 
            role: 'owner', 
            name: 'You (Owner)' 
        }
    ];
    
    // Add actual team members if they exist
    if (this.teamMembers && this.teamMembers.length > 0) {
        allMembers.push(...this.teamMembers);
    } else {
        // Show example roles when no team members exist yet
        allMembers.push(
            { email: 'purchaser@example.com', role: 'purchaser', name: 'Purchaser Role', isExample: true },
            { email: 'collector@example.com', role: 'collector', name: 'Collector Role', isExample: true },
            { email: 'manager@example.com', role: 'pettycash-manager', name: 'Petty Cash Manager', isExample: true },
            { email: 'member@example.com', role: 'member', name: 'Member Role', isExample: true }
        );
    }

    let html = '';
    allMembers.forEach(member => {
        const permissions = this.getEffectivePermissions(member.role);
        const grantedCount = Object.values(permissions).filter(p => p).length;
        const totalCount = Object.keys(permissions).length;
        const isExample = member.isExample;
        
        html += `
            <div class="team-member-permission-card ${isExample ? 'example-member' : ''}">
                <div class="member-permission-header">
                    <div class="member-permission-info">
                        <h4>${member.name || member.email} ${isExample ? '(Preview)' : ''}</h4>
                        <small>${isExample ? 'Example role preview' : member.email}</small>
                    </div>
                    <div class="member-permission-role">${member.role.replace('-', ' ')}</div>
                </div>
                <div class="member-permission-stats">
                    <div class="permission-stat">
                        <i class="fas fa-check-circle"></i>
                        <span>${grantedCount}/${totalCount} permissions</span>
                    </div>
                    <div class="permission-stat">
                        <i class="fas fa-calendar"></i>
                        <span>${isExample ? 'Preview' : 'Active'}</span>
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
};

// Get effective permissions for a role (custom or default)
ExpenseTracker.prototype.getEffectivePermissions = function(role) {
    if (this.customPermissions[role]) {
        return this.customPermissions[role];
    }
    return this.defaultPermissions[role] || {};
};

// Save all permissions changes
ExpenseTracker.prototype.saveAllPermissions = function() {
    this.saveCustomPermissions();
};

// Reset permissions to defaults
ExpenseTracker.prototype.resetToDefaultPermissions = function() {
    if (confirm('Are you sure you want to reset all permissions to default values? This cannot be undone.')) {
        this.customPermissions = {};
        this.renderPermissionsMatrix();
        this.renderTeamMembersPermissions();
        this.saveCustomPermissions();
        this.addPermissionChangeLog('Reset all permissions to defaults', 'reset');
    }
};

// Add entry to permission change log
ExpenseTracker.prototype.addPermissionChangeLog = function(description, action) {
    const logContainer = document.getElementById('permissions-changelog');
    if (!logContainer) return;

    const iconMap = {
        'granted': 'fas fa-check-circle',
        'revoked': 'fas fa-times-circle', 
        'update': 'fas fa-edit',
        'reset': 'fas fa-undo'
    };

    const now = new Date();
    const timeString = now.toLocaleString();

    const logEntry = document.createElement('div');
    logEntry.className = 'changelog-item';
    logEntry.innerHTML = `
        <div class="changelog-icon">
            <i class="${iconMap[action] || 'fas fa-info-circle'}"></i>
        </div>
        <div class="changelog-content">
            <div>${description}</div>
            <div class="changelog-time">${timeString}</div>
        </div>
    `;

    // Remove "no changes" message if it exists
    const noChanges = logContainer.querySelector('.no-changes');
    if (noChanges) {
        noChanges.remove();
    }

    // Add new entry at the top
    logContainer.insertBefore(logEntry, logContainer.firstChild);

    // Keep only last 10 entries
    const entries = logContainer.querySelectorAll('.changelog-item');
    if (entries.length > 10) {
        entries[entries.length - 1].remove();
    }
};

console.log('🔒 Permissions matrix system loaded');

// Debug function for testing permissions matrix
ExpenseTracker.prototype.debugPermissionsMatrix = function() {
    console.log('🔍 Debug: Testing permissions matrix...');
    console.log('🔍 Current user role:', this.userRole);
    console.log('🔍 Is owner:', this.isOwner());
    console.log('🔍 Default permissions:', this.defaultPermissions);
    console.log('🔍 Custom permissions:', this.customPermissions);
    
    // Check DOM elements
    console.log('🔍 Permissions tab:', document.getElementById('permissions-tab'));
    console.log('🔍 Matrix body:', document.getElementById('permissions-matrix-body'));
    console.log('🔍 Team container:', document.getElementById('team-members-permissions'));
    
    // Force render the matrix for testing
    this.renderPermissionsMatrix();
    this.renderTeamMembersPermissions();
    
    console.log('🔍 Matrix render complete');
};

// Global debug function 
window.debugPermissions = function() {
    if (window.expenseTracker) {
        window.expenseTracker.debugPermissionsMatrix();
    } else {
        console.error('❌ expenseTracker not found');
    }
};

// Emergency manual fix for blank permissions tab
window.forceShowPermissions = function() {
    console.log('🚨 Emergency fix: Forcing permissions tab to show...');
    
    // 1. Force show permissions tab
    const permTab = document.getElementById('permissions-tab');
    if (permTab) {
        permTab.style.display = 'block';
        permTab.style.visibility = 'visible';
        permTab.style.opacity = '1';
        permTab.style.height = 'auto';
        permTab.classList.add('active');
        console.log('✅ Permissions tab forced visible');
    }
    
    // 2. Force show all containers
    ['.permissions-section', '.permissions-matrix-container', '.team-permissions-overview', '.permissions-actions', '.permissions-log'].forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'block';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
        }
    });
    
    // 3. Force render content
    if (window.expenseTracker) {
        expenseTracker.renderPermissionsMatrix();
        expenseTracker.renderTeamMembersPermissions();
    }
    
    // 4. Manual HTML injection as last resort
    setTimeout(() => {
        const matrixBody = document.getElementById('permissions-matrix-body');
        if (matrixBody && matrixBody.innerHTML.trim() === '') {
            matrixBody.innerHTML = `
                <tr>
                    <td class="feature-name"><i class="fas fa-minus-circle"></i> Add Expenses</td>
                    <td class="owner-permission"><div class="permission-status permission-granted"><i class="fas fa-crown"></i></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" checked class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" checked class="permission-checkbox"></div></td>
                </tr>
                <tr>
                    <td class="feature-name"><i class="fas fa-plus-circle"></i> Add Income</td>
                    <td class="owner-permission"><div class="permission-status permission-granted"><i class="fas fa-crown"></i></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" checked class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" checked class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" class="permission-checkbox"></div></td>
                    <td><div class="permission-checkbox-container"><input type="checkbox" class="permission-checkbox"></div></td>
                </tr>
            `;
            console.log('✅ Emergency matrix HTML injected');
        }
        
        const teamContainer = document.getElementById('team-members-permissions');
        if (teamContainer && teamContainer.innerHTML.trim() === '') {
            teamContainer.innerHTML = `
                <div class="team-member-permission-card">
                    <div class="member-permission-header">
                        <div class="member-permission-info">
                            <h4>You (Owner)</h4>
                            <small>pinedamikeb@yahoo.com</small>
                        </div>
                        <div class="member-permission-role">owner</div>
                    </div>
                    <div class="member-permission-stats">
                        <div class="permission-stat">
                            <i class="fas fa-check-circle"></i>
                            <span>6/6 permissions</span>
                        </div>
                        <div class="permission-stat">
                            <i class="fas fa-calendar"></i>
                            <span>Active</span>
                        </div>
                    </div>
                </div>
            `;
            console.log('✅ Emergency team HTML injected');
        }
    }, 200);
    
    console.log('🚨 Emergency fix complete!');
};


// ============================================
// CUSTOMER MANAGEMENT SYSTEM
// ============================================

const customerManager = {
    customers: [],
    filteredCustomers: [],
    currentCustomerId: null,
    csvData: null,

    // Initialize customer manager
    init() {
        console.log('🔧 Initializing Customer Manager...');
        this.setupEventListeners();
        this.loadCustomers();
    },

    // Setup event listeners
    setupEventListeners() {
        // Customer form submit
        const customerForm = document.getElementById('customer-form');
        if (customerForm) {
            customerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCustomer();
            });
        }

        // CSV file input
        const csvInput = document.getElementById('csv-file-input');
        if (csvInput) {
            csvInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    },

    // Load customers from Firebase
    async loadCustomers() {
        const user = firebase.auth().currentUser;
        if (!user) {
            console.log('No user logged in');
            return;
        }

        try {
            const snapshot = await db.collection('customers')
                .doc(user.uid)
                .collection('customerList')
                .orderBy('companyName')
                .get();

            this.customers = [];
            snapshot.forEach(doc => {
                this.customers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.filteredCustomers = [...this.customers];
            this.displayCustomers();
            this.updateCustomerCount();
            this.populateIncomeCustomerDropdown();  // Populate income dropdown
            console.log(`✅ Loaded ${this.customers.length} customers`);
        } catch (error) {
            console.error('Error loading customers:', error);
            this.showNotification('Error loading customers', 'error');
        }
    },

    // Populate income customer dropdown
    populateIncomeCustomerDropdown() {
        const customerSelect = document.getElementById('income-customer');
        if (!customerSelect) return;
        
        customerSelect.innerHTML = '<option value="">Select Customer (Optional)</option>';
        
        if (!this.customers || this.customers.length === 0) {
            return;
        }
        
        this.customers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            let displayName = customer.companyName || 'Unknown Customer';
            if (customer.branchDepartment) {
                displayName += ` - ${customer.branchDepartment}`;
            }
            option.textContent = displayName;
            customerSelect.appendChild(option);
        });
        
        console.log(`📋 Income customer dropdown populated with ${this.customers.length} customers`);
    },

    // Display customers in table
    displayCustomers() {
        const tbody = document.getElementById('customers-tbody');
        if (!tbody) return;

        if (this.filteredCustomers.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-state">
                    <td colspan="8">
                        <i class="fas fa-inbox"></i>
                        <p>No customers found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredCustomers.map(customer => `
            <tr>
                <td>${this.escapeHtml(customer.companyId || '')}</td>
                <td><strong>${this.escapeHtml(customer.companyName)}</strong></td>
                <td>${this.escapeHtml(customer.branchDepartment || '')}</td>
                <td>${this.escapeHtml(customer.contactPerson || '')}</td>
                <td>${this.escapeHtml(customer.email || '')}</td>
                <td>${this.escapeHtml(customer.machines || 'N/A')}</td>
                <td>
                    <span class="status-badge ${customer.status || 'active'}">
                        ${(customer.status || 'active').toUpperCase()}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="customerManager.editCustomer('${customer.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="customerManager.deleteCustomer('${customer.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    // Show add customer modal
    showAddCustomerModal() {
        this.currentCustomerId = null;
        document.getElementById('customer-modal-title').textContent = 'Add Customer';
        document.getElementById('customer-form').reset();
        document.getElementById('customer-id').value = '';
        document.getElementById('customer-status').value = 'active';
        document.getElementById('customer-modal').style.display = 'block';
    },

    // Edit customer
    async editCustomer(customerId) {
        const customer = this.customers.find(c => c.id === customerId);
        if (!customer) return;

        this.currentCustomerId = customerId;
        document.getElementById('customer-modal-title').textContent = 'Edit Customer';
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('customer-company-id').value = customer.companyId || '';
        document.getElementById('customer-company-name').value = customer.companyName || '';
        document.getElementById('customer-address').value = customer.address || '';
        document.getElementById('customer-contact-person').value = customer.contactPerson || '';
        document.getElementById('customer-contact-number').value = customer.contactNumber || '';
        document.getElementById('customer-email').value = customer.email || '';
        document.getElementById('customer-branch').value = customer.branchDepartment || '';
        document.getElementById('customer-machines').value = customer.machines || '';
        document.getElementById('customer-status').value = customer.status || 'active';
        document.getElementById('customer-modal').style.display = 'block';
    },

    // Save customer (create or update)
    async saveCustomer() {
        const user = firebase.auth().currentUser;
        if (!user) {
            this.showNotification('Please log in first', 'error');
            return;
        }

        const customerData = {
            companyId: document.getElementById('customer-company-id').value.trim(),
            companyName: document.getElementById('customer-company-name').value.trim(),
            address: document.getElementById('customer-address').value.trim(),
            contactPerson: document.getElementById('customer-contact-person').value.trim(),
            contactNumber: document.getElementById('customer-contact-number').value.trim(),
            email: document.getElementById('customer-email').value.trim(),
            branchDepartment: document.getElementById('customer-branch').value.trim(),
            machines: document.getElementById('customer-machines').value.trim(),
            status: document.getElementById('customer-status').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (this.currentCustomerId) {
                // Update existing
                await db.collection('customers')
                    .doc(user.uid)
                    .collection('customerList')
                    .doc(this.currentCustomerId)
                    .update(customerData);
                this.showNotification('Customer updated successfully', 'success');
            } else {
                // Create new
                customerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('customers')
                    .doc(user.uid)
                    .collection('customerList')
                    .add(customerData);
                this.showNotification('Customer added successfully', 'success');
            }

            this.closeCustomerModal();
            this.loadCustomers();
        } catch (error) {
            console.error('Error saving customer:', error);
            this.showNotification('Error saving customer', 'error');
        }
    },

    // Delete customer
    async deleteCustomer(customerId) {
        if (!confirm('Are you sure you want to delete this customer?')) return;

        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            await db.collection('customers')
                .doc(user.uid)
                .collection('customerList')
                .doc(customerId)
                .delete();
            
            this.showNotification('Customer deleted successfully', 'success');
            this.loadCustomers();
        } catch (error) {
            console.error('Error deleting customer:', error);
            this.showNotification('Error deleting customer', 'error');
        }
    },

    // Search customers
    searchCustomers(query) {
        query = query.toLowerCase().trim();
        
        if (!query) {
            this.filteredCustomers = [...this.customers];
        } else {
            this.filteredCustomers = this.customers.filter(customer => 
                (customer.companyName && customer.companyName.toLowerCase().includes(query)) ||
                (customer.companyId && customer.companyId.toLowerCase().includes(query)) ||
                (customer.contactPerson && customer.contactPerson.toLowerCase().includes(query)) ||
                (customer.email && customer.email.toLowerCase().includes(query)) ||
                (customer.branchDepartment && customer.branchDepartment.toLowerCase().includes(query))
            );
        }

        this.displayCustomers();
        this.updateCustomerCount();
    },

    // Filter customers by status
    filterCustomers() {
        const statusFilter = document.getElementById('customer-status-filter').value;
        const searchQuery = document.getElementById('customer-search').value;

        if (statusFilter === 'all') {
            this.filteredCustomers = [...this.customers];
        } else {
            this.filteredCustomers = this.customers.filter(c => c.status === statusFilter);
        }

        // Apply search if exists
        if (searchQuery) {
            this.searchCustomers(searchQuery);
        } else {
            this.displayCustomers();
            this.updateCustomerCount();
        }
    },

    // Update customer count
    updateCustomerCount() {
        const countEl = document.getElementById('customer-count');
        if (countEl) {
            countEl.textContent = this.filteredCustomers.length;
        }
    },

    // Close customer modal
    closeCustomerModal() {
        document.getElementById('customer-modal').style.display = 'none';
    },

    // Show import modal
    showImportModal() {
        document.getElementById('import-modal').style.display = 'block';
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-results').style.display = 'none';
        document.getElementById('file-name-display').textContent = '';
        this.csvData = null;
    },

    // Close import modal
    closeImportModal() {
        document.getElementById('import-modal').style.display = 'none';
    },

    // Handle file select
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            this.showNotification('Please select a CSV file', 'error');
            return;
        }

        document.getElementById('file-name-display').textContent = `Selected: ${file.name}`;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseCSV(e.target.result);
        };
        reader.readAsText(file);
    },

    // Parse CSV content
    parseCSV(csvText) {
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                this.showNotification('CSV file is empty or invalid', 'error');
                return;
            }

            // Parse header
            const headers = this.parseCSVLine(lines[0]);
            
            // Parse data rows
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === 0) continue;
                
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = this.cleanValue(values[index]);
                });
                data.push(row);
            }

            this.csvData = data;
            this.showPreview(data.slice(0, 5));
            console.log(`✅ Parsed ${data.length} rows from CSV`);
        } catch (error) {
            console.error('CSV parsing error:', error);
            this.showNotification('Error parsing CSV file', 'error');
        }
    },

    // Parse CSV line (handles quoted commas)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        
        return result.map(val => val.replace(/^"|"$/g, '').trim());
    },

    // Clean value (handle NULL, null, empty)
    cleanValue(value) {
        if (!value || value === 'null' || value === 'NULL' || value === 'undefined') {
            return '';
        }
        return value.trim();
    },

    // Show preview of CSV data
    showPreview(data) {
        const previewEl = document.getElementById('import-preview');
        const contentEl = document.getElementById('preview-content');
        
        if (!data || data.length === 0) {
            contentEl.innerHTML = '<p>No data to preview</p>';
            return;
        }

        let html = '<table class="preview-table" style="width: 100%; border-collapse: collapse;">';
        html += '<thead><tr>';
        html += '<th style="border: 1px solid #e2e8f0; padding: 8px; background: #f7fafc;">Company ID</th>';
        html += '<th style="border: 1px solid #e2e8f0; padding: 8px; background: #f7fafc;">Company Name</th>';
        html += '<th style="border: 1px solid #e2e8f0; padding: 8px; background: #f7fafc;">Branch/Dept</th>';
        html += '<th style="border: 1px solid #e2e8f0; padding: 8px; background: #f7fafc;">Contact</th>';
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            html += `<td style="border: 1px solid #e2e8f0; padding: 8px;">${this.escapeHtml(row['Company ID'] || '')}</td>`;
            html += `<td style="border: 1px solid #e2e8f0; padding: 8px;"><strong>${this.escapeHtml(row['Company Name'] || '')}</strong></td>`;
            html += `<td style="border: 1px solid #e2e8f0; padding: 8px;">${this.escapeHtml(row['Branch/Department'] || '')}</td>`;
            html += `<td style="border: 1px solid #e2e8f0; padding: 8px;">${this.escapeHtml(row['Contact Person'] || '')}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        contentEl.innerHTML = html;
        previewEl.style.display = 'block';
    },

    // Execute import
    async executeImport() {
        if (!this.csvData || this.csvData.length === 0) {
            this.showNotification('No data to import', 'error');
            return;
        }

        const user = firebase.auth().currentUser;
        if (!user) {
            this.showNotification('Please log in first', 'error');
            return;
        }

        const resultsEl = document.getElementById('import-results');
        const contentEl = document.getElementById('results-content');
        resultsEl.style.display = 'block';
        contentEl.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Importing customers...</p>';

        let imported = 0;
        let failed = [];

        try {
            const batch = db.batch();
            const customerRef = db.collection('customers').doc(user.uid).collection('customerList');

            for (const row of this.csvData) {
                try {
                    const customerData = {
                        companyId: this.cleanValue(row['Company ID']),
                        companyName: this.cleanValue(row['Company Name']),
                        address: this.cleanValue(row['Address']),
                        contactPerson: this.cleanValue(row['Contact Person']),
                        contactNumber: '', // Will be filled manually
                        email: this.cleanValue(row['Email']),
                        branchDepartment: this.cleanValue(row['Branch/Department']),
                        machines: this.cleanValue(row['Machines']),
                        status: 'active',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    if (!customerData.companyName) {
                        failed.push({ row: row['Company Name'] || 'Unknown', reason: 'Missing company name' });
                        continue;
                    }

                    const newDocRef = customerRef.doc();
                    batch.set(newDocRef, customerData);
                    imported++;
                } catch (error) {
                    failed.push({ row: row['Company Name'] || 'Unknown', reason: error.message });
                }
            }

            await batch.commit();
            
            this.showImportResults(imported, failed);
            this.loadCustomers();
        } catch (error) {
            console.error('Import error:', error);
            contentEl.innerHTML = `<p class="error">Import failed: ${error.message}</p>`;
        }
    },

    // Show import results
    showImportResults(imported, failed) {
        const contentEl = document.getElementById('results-content');
        
        let html = '<div class="import-summary">';
        html += '<div class="summary-stat">';
        html += `<div class="number">${imported}</div>`;
        html += '<div class="label">Imported</div>';
        html += '</div>';
        html += '<div class="summary-stat">';
        html += `<div class="number" style="color: #e53e3e;">${failed.length}</div>`;
        html += '<div class="label">Failed</div>';
        html += '</div>';
        html += '<div class="summary-stat">';
        html += `<div class="number">${imported + failed.length}</div>`;
        html += '<div class="label">Total</div>';
        html += '</div>';
        html += '</div>';

        if (failed.length > 0) {
            html += '<h4 style="color: #742a2a; margin-top: 20px;">Failed Imports:</h4>';
            html += '<div class="error-list">';
            failed.forEach(item => {
                html += `<div class="error-item">`;
                html += `<strong>${this.escapeHtml(item.row)}</strong>: ${this.escapeHtml(item.reason)}`;
                html += `</div>`;
            });
            html += '</div>';
        }

        html += `<p style="margin-top: 15px;"><i class="fas fa-info-circle"></i> Note: Contact numbers are left blank for manual entry.</p>`;
        
        contentEl.innerHTML = html;
        this.showNotification(`Successfully imported ${imported} customers`, 'success');
    },

    // Export customers to CSV
    exportCustomers() {
        if (this.customers.length === 0) {
            this.showNotification('No customers to export', 'error');
            return;
        }

        const headers = ['Company ID', 'Company Name', 'Address', 'Contact Person', 'Contact Number', 'Email', 'Branch/Department', 'Machines', 'Status'];
        let csv = headers.join(',') + '\n';

        this.customers.forEach(customer => {
            const row = [
                customer.companyId || '',
                `"${(customer.companyName || '').replace(/"/g, '""')}"`,
                `"${(customer.address || '').replace(/"/g, '""')}"`,
                customer.contactPerson || '',
                customer.contactNumber || '',
                customer.email || '',
                customer.branchDepartment || '',
                `"${(customer.machines || '').replace(/"/g, '""')}"`,
                customer.status || 'active'
            ];
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showNotification('Customers exported successfully', 'success');
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Show notification
    showNotification(message, type = 'info') {
        if (window.expenseTracker && window.expenseTracker.showNotification) {
            window.expenseTracker.showNotification(message, type);
        } else {
            alert(message);
        }
    }
};

// Make customerManager globally available
window.customerManager = customerManager;


// ============================================
// BILLING MANAGEMENT SYSTEM (Basic Structure)
// ============================================

const billingManager = {
    bills: [],

    init() {
        console.log('🔧 Initializing Billing Manager...');
        this.loadBills();
    },

    async loadBills() {
        // Placeholder for billing functionality
        console.log('Billing system ready');
    },

    showAddBillModal() {
        alert('Billing feature coming soon! This will allow you to:\n- Create bills linked to customers\n- Track payment status\n- Generate invoices');
    }
};

// Initialize customer manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait for auth to be ready
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            setTimeout(() => {
                customerManager.init();
                billingManager.init();
            }, 1000);
        }
    });
});

console.log('✅ Customer and Billing Management modules loaded');
