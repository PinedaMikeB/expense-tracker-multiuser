// ============================================
// CUSTOMER-BILLING INTEGRATION
// ============================================
// Add this code to your script.js file to link customers with bills

// ========================================
// STEP 1: UPDATE BILLING DATA STRUCTURE
// ========================================

// Modify billingManager.saveBill() to include customer information
// Add this to the billData object:

/*
const billData = {
    // ... existing fields ...
    customerId: document.getElementById('bill-customer-select').value || null,
    customerName: document.getElementById('bill-customer-select').selectedOptions[0]?.text || '',
    // ... rest of fields ...
};
*/

// ========================================
// STEP 2: ADD CUSTOMER SELECTOR TO BILLING FORM
// ========================================

// Add this to your billing tab HTML after the billTo field:

/*
<div class="form-group">
    <label for="bill-customer-select">Customer (Optional)</label>
    <select id="bill-customer-select">
        <option value="">-- Select Customer --</option>
        <!-- Populated dynamically -->
    </select>
</div>
*/

// ========================================
// STEP 3: POPULATE CUSTOMER DROPDOWN
// ========================================

const billingCustomerIntegration = {
    // Initialize customer dropdown in billing form
    initCustomerDropdown() {
        const customerSelect = document.getElementById('bill-customer-select');
        if (!customerSelect) {
            console.warn('Customer select not found in billing form');
            return;
        }

        // Load customers
        this.loadCustomersForDropdown();

        // Auto-fill billTo when customer is selected
        customerSelect.addEventListener('change', (e) => {
            const customerId = e.target.value;
            if (customerId) {
                this.autofillFromCustomer(customerId);
            }
        });
    },

    // Load customers into dropdown
    async loadCustomersForDropdown() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const customerSelect = document.getElementById('bill-customer-select');
        if (!customerSelect) return;

        try {
            const snapshot = await db.collection('customers')
                .doc(user.uid)
                .collection('customerList')
                .where('status', '==', 'active')
                .orderBy('companyName')
                .get();

            // Clear existing options except first
            customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';

            // Add customer options
            snapshot.forEach(doc => {
                const customer = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = customer.companyName;
                option.dataset.address = customer.address || '';
                option.dataset.branch = customer.branchDepartment || '';
                customerSelect.appendChild(option);
            });

            console.log(`✅ Loaded ${snapshot.size} customers for billing dropdown`);
        } catch (error) {
            console.error('Error loading customers for dropdown:', error);
        }
    },

    // Auto-fill billTo field from selected customer
    autofillFromCustomer(customerId) {
        const customerSelect = document.getElementById('bill-customer-select');
        const billToField = document.getElementById('bill-to');

        if (!customerSelect || !billToField) return;

        const selectedOption = customerSelect.selectedOptions[0];
        if (!selectedOption) return;

        const customerName = selectedOption.textContent;
        const address = selectedOption.dataset.address || '';
        const branch = selectedOption.dataset.branch || '';

        // Format billTo field
        let billTo = customerName;
        if (branch) billTo += `\n${branch}`;
        if (address) billTo += `\n${address}`;

        billToField.value = billTo;
    },

    // Get bills for a specific customer
    async getBillsForCustomer(customerId) {
        const user = firebase.auth().currentUser;
        if (!user) return [];

        try {
            const snapshot = await db.collection('billing')
                .doc(user.uid)
                .collection('bills')
                .where('customerId', '==', customerId)
                .orderBy('billDate', 'desc')
                .get();

            const bills = [];
            snapshot.forEach(doc => {
                bills.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return bills;
        } catch (error) {
            console.error('Error loading customer bills:', error);
            return [];
        }
    },

    // Show customer's billing history
    async showCustomerBillingHistory(customerId) {
        const bills = await this.getBillsForCustomer(customerId);
        
        if (bills.length === 0) {
            return '<p>No bills found for this customer.</p>';
        }

        let html = '<div class="customer-bills-history">';
        html += '<h3>Billing History</h3>';
        html += '<table class="bills-table">';
        html += '<thead><tr>';
        html += '<th>Bill #</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th>';
        html += '</tr></thead><tbody>';

        bills.forEach(bill => {
            const date = bill.billDate ? new Date(bill.billDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const amount = bill.totalAmount ? `₱${parseFloat(bill.totalAmount).toFixed(2)}` : 'N/A';
            const status = bill.status || 'pending';

            html += `<tr>`;
            html += `<td>${bill.billNumber || 'N/A'}</td>`;
            html += `<td>${date}</td>`;
            html += `<td><strong>${amount}</strong></td>`;
            html += `<td><span class="status-badge ${status}">${status.toUpperCase()}</span></td>`;
            html += `<td><button class="btn btn-sm" onclick="billingManager.viewBill('${bill.id}')">View</button></td>`;
            html += `</tr>`;
        });

        html += '</tbody></table></div>';
        return html;
    },

    // Add billing stats to customer details
    async getCustomerBillingStats(customerId) {
        const bills = await this.getBillsForCustomer(customerId);

        const stats = {
            totalBills: bills.length,
            totalAmount: 0,
            paidAmount: 0,
            pendingAmount: 0,
            lastBillDate: null
        };

        bills.forEach(bill => {
            const amount = parseFloat(bill.totalAmount) || 0;
            stats.totalAmount += amount;

            if (bill.status === 'paid') {
                stats.paidAmount += amount;
            } else {
                stats.pendingAmount += amount;
            }

            if (bill.billDate && (!stats.lastBillDate || bill.billDate.seconds > stats.lastBillDate.seconds)) {
                stats.lastBillDate = bill.billDate;
            }
        });

        return stats;
    }
};

// ========================================
// STEP 4: UPDATE CUSTOMER DETAILS VIEW
// ========================================

// Modify customerManager.viewCustomerDetails() to include billing info:

/*
async viewCustomerDetails(customerId) {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    // Get billing stats
    const billingStats = await billingCustomerIntegration.getCustomerBillingStats(customerId);
    const billingHistory = await billingCustomerIntegration.showCustomerBillingHistory(customerId);

    // Show in modal
    const modal = document.getElementById('customer-details-modal');
    const content = document.getElementById('customer-details-content');
    
    content.innerHTML = `
        <h2>${customer.companyName}</h2>
        
        <!-- Customer Info -->
        <div class="customer-info-section">
            <p><strong>Company ID:</strong> ${customer.companyId || 'N/A'}</p>
            <p><strong>Branch/Department:</strong> ${customer.branchDepartment || 'N/A'}</p>
            <p><strong>Address:</strong> ${customer.address || 'N/A'}</p>
            <p><strong>Contact Person:</strong> ${customer.contactPerson || 'N/A'}</p>
            <p><strong>Contact Number:</strong> ${customer.contactNumber || 'N/A'}</p>
            <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
            <p><strong>Machines:</strong> ${customer.machines || 'N/A'}</p>
        </div>

        <!-- Billing Stats -->
        <div class="billing-stats-section">
            <h3>Billing Statistics</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${billingStats.totalBills}</div>
                    <div class="stat-label">Total Bills</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₱${billingStats.totalAmount.toFixed(2)}</div>
                    <div class="stat-label">Total Billed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₱${billingStats.paidAmount.toFixed(2)}</div>
                    <div class="stat-label">Paid</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">₱${billingStats.pendingAmount.toFixed(2)}</div>
                    <div class="stat-label">Pending</div>
                </div>
            </div>
        </div>

        <!-- Billing History -->
        ${billingHistory}
    `;
    
    modal.style.display = 'block';
}
*/

// ========================================
// STEP 5: INITIALIZE ON APP LOAD
// ========================================

// Add to your DOMContentLoaded or auth initialization:

/*
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        setTimeout(() => {
            customerManager.init();
            billingManager.init();
            billingCustomerIntegration.initCustomerDropdown(); // ADD THIS LINE
        }, 1000);
    }
});
*/

// Make available globally
window.billingCustomerIntegration = billingCustomerIntegration;

console.log('✅ Customer-Billing integration loaded');
