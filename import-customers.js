// ============================================
// CUSTOMER CSV IMPORT UTILITY
// ============================================
// Run this script in the browser console after logging in
// to bulk import customers from Marga_Customers.csv

const customerImporter = {
    // Import customers from CSV text
    async importFromCSV(csvText) {
        console.log('🚀 Starting customer import...');
        
        const user = firebase.auth().currentUser;
        if (!user) {
            console.error('❌ No user logged in. Please log in first.');
            return;
        }

        console.log(`✅ Importing for user: ${user.email}`);

        try {
            // Parse CSV
            const customers = this.parseCSV(csvText);
            console.log(`📊 Parsed ${customers.length} customer records`);

            // Import in batches (Firestore has 500 operations per batch limit)
            const batchSize = 450; // Safe batch size
            let totalImported = 0;
            let totalFailed = 0;
            const failed = [];

            for (let i = 0; i < customers.length; i += batchSize) {
                const batch = customers.slice(i, i + batchSize);
                console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(customers.length/batchSize)}...`);
                
                const result = await this.importBatch(batch, user.uid);
                totalImported += result.imported;
                totalFailed += result.failed.length;
                failed.push(...result.failed);

                console.log(`   ✅ Imported: ${result.imported}, ❌ Failed: ${result.failed.length}`);
            }

            // Show results
            console.log('\n' + '='.repeat(60));
            console.log('📊 IMPORT COMPLETE');
            console.log('='.repeat(60));
            console.log(`✅ Successfully imported: ${totalImported} customers`);
            console.log(`❌ Failed: ${totalFailed} customers`);
            console.log(`📝 Total processed: ${customers.length} records`);
            
            if (failed.length > 0 && failed.length < 50) {
                console.log('\n❌ Failed Records:');
                failed.forEach((item, idx) => {
                    console.log(`   ${idx + 1}. ${item.companyName}: ${item.reason}`);
                });
            }

            return {
                total: customers.length,
                imported: totalImported,
                failed: totalFailed,
                failedRecords: failed
            };

        } catch (error) {
            console.error('❌ Import error:', error);
            throw error;
        }
    },

    // Parse CSV content
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        // Parse header
        const headers = this.parseCSVLine(lines[0]);
        console.log('📋 CSV Headers:', headers);

        // Parse data rows
        const customers = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = this.cleanValue(values[index]);
            });

            // Convert to customer object
            const customer = {
                companyId: row['Company ID'] || '',
                companyName: row['Company Name'] || '',
                address: row['Address'] || '',
                contactPerson: row['Contact Person'] || '',
                contactNumber: '', // NULL in CSV, will be filled manually
                email: row['Email'] || '',
                branchDepartment: row['Branch/Department'] || '',
                machines: row['Machines'] || '',
                status: 'active'
            };

            // Only add if company name exists
            if (customer.companyName && customer.companyName !== '') {
                customers.push(customer);
            }
        }

        return customers;
    },

    // Parse CSV line (handles quoted commas)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
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
        if (!value || 
            value === 'null' || 
            value === 'NULL' || 
            value === 'undefined' ||
            value === 'N/A' ||
            value.trim() === '') {
            return '';
        }
        return value.trim();
    },

    // Import a batch of customers
    async importBatch(customers, userId) {
        const batch = db.batch();
        const customerRef = db.collection('customers').doc(userId).collection('customerList');
        
        let imported = 0;
        const failed = [];

        for (const customerData of customers) {
            try {
                if (!customerData.companyName) {
                    failed.push({ 
                        companyName: 'Unknown', 
                        reason: 'Missing company name' 
                    });
                    continue;
                }

                // Add timestamps
                customerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                customerData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

                const newDocRef = customerRef.doc();
                batch.set(newDocRef, customerData);
                imported++;

            } catch (error) {
                failed.push({ 
                    companyName: customerData.companyName || 'Unknown', 
                    reason: error.message 
                });
            }
        }

        try {
            await batch.commit();
            return { imported, failed };
        } catch (error) {
            console.error('Batch commit error:', error);
            // If batch fails, mark all as failed
            return { 
                imported: 0, 
                failed: customers.map(c => ({ 
                    companyName: c.companyName, 
                    reason: 'Batch commit failed' 
                }))
            };
        }
    },

    // Helper: Load CSV from file input
    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file.name.endsWith('.csv')) {
                reject(new Error('Please select a CSV file'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
};

// Make available globally
window.customerImporter = customerImporter;

// ============================================
// USAGE INSTRUCTIONS
// ============================================
console.log(`
╔════════════════════════════════════════════════════════════╗
║         CUSTOMER CSV IMPORT UTILITY                        ║
╚════════════════════════════════════════════════════════════╝

📥 HOW TO IMPORT YOUR CUSTOMERS:

Option 1: Use the UI (RECOMMENDED)
-----------------------------------
1. Open the app and log in
2. Go to the "Customers" tab
3. Click "Import CSV"
4. Select your Marga_Customers.csv file
5. Review preview and click "Import"

Option 2: Use Console (For Bulk Import)
----------------------------------------
1. Log in to the expense tracker
2. Open browser console (F12)
3. Paste this command:

   const input = document.createElement('input');
   input.type = 'file';
   input.accept = '.csv';
   input.onchange = async (e) => {
       const file = e.target.files[0];
       const csvText = await customerImporter.loadFromFile(file);
       await customerImporter.importFromCSV(csvText);
   };
   input.click();

4. Select your Marga_Customers.csv file
5. Wait for import to complete (progress shown in console)

📝 NOTES:
- Import handles NULL values automatically
- Contact Numbers are left blank (to be filled manually)
- Duplicate records will be created (no de-duplication)
- Import is batched for large datasets (2900+ records)
- Multi-tenant: Data is isolated per user account

🔐 USER ACCOUNTS:
- michael.marga@gmail.com → Personal files
- pinedamikeb@yahoo.com → Marga Enterprises

═══════════════════════════════════════════════════════════
`);
