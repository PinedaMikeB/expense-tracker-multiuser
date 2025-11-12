# 📋 Customer Management System - Complete Guide

## 🎯 Overview

The Customer Management System is now fully integrated into your Expense Tracker app. This system allows you to:

- ✅ Manage customer database for copier rental business
- ✅ Import customers from CSV (handles NULL values)
- ✅ Multi-tenant isolation (separate data per user account)
- ✅ Link customers to billing records
- ✅ Search, filter, and export customer data
- ✅ Manual data entry for missing contact numbers

---

## 📊 Your Customer Data

**File**: `Marga_Customers.csv`
- **Total Records**: 2,920 customer entries
- **Companies**: Multiple entries per company (different branches/departments)
- **Missing Data**: Contact Numbers (all NULL - to be filled manually)

### User Account Mapping:
- `michael.marga@gmail.com` → Personal Files
- `pinedamikeb@yahoo.com` → Marga Enterprises (Copier Rental)

---

## 🚀 Quick Start

### Option 1: Import via UI (Recommended)

1. **Open the app**: Navigate to http://localhost or your deployed URL
2. **Login**: Use `pinedamikeb@yahoo.com` for Marga Enterprises
3. **Go to Customers Tab**: Click the "Customers" button in navigation
4. **Click "Import CSV"**: Select your `Marga_Customers.csv` file
5. **Review Preview**: Check the first 5 records
6. **Click "Import"**: Wait for completion (takes ~30 seconds for 2900+ records)
7. **Done!**: All customers are now loaded

### Option 2: Import via Console (For Bulk Import)

```javascript
// 1. Log in to the app
// 2. Open browser console (F12)
// 3. Paste this code:

const input = document.createElement('input');
input.type = 'file';
input.accept = '.csv';
input.onchange = async (e) => {
    const file = e.target.files[0];
    const csvText = await customerImporter.loadFromFile(file);
    await customerImporter.importFromCSV(csvText);
};
input.click();

// 4. Select your Marga_Customers.csv file
// 5. Wait for import to complete (progress shown in console)
```

---

## 📁 Database Structure

### Firebase Firestore Structure:
```
expense-tracker/
├── customers/
│   ├── {userId}/                    ← User's UID
│   │   ├── customerList/            ← Customer collection
│   │   │   ├── {customerId}/        ← Auto-generated ID
│   │   │   │   ├── companyId: "1100"
│   │   │   │   ├── companyName: "A-Z Asia LTD Philippines Inc"
│   │   │   │   ├── address: "7 Flr, Pacific Star Bldg..."
│   │   │   │   ├── contactPerson: "Maria Theresa Malihan"
│   │   │   │   ├── contactNumber: ""  ← NULL, to be filled
│   │   │   │   ├── email: "mmalihan@hmi.net.ph"
│   │   │   │   ├── branchDepartment: "A-Z Asia LTD Philippines Inc"
│   │   │   │   ├── machines: "Brother MFC-2540 (E73801H1N932023)"
│   │   │   │   ├── status: "active"
│   │   │   │   ├── createdAt: timestamp
│   │   │   │   └── updatedAt: timestamp
```

---

## 🔧 Features

### 1. Customer CRUD Operations

**Add Customer**
- Click "+ Add Customer" button
- Fill in the form
- Contact Number can be left blank (filled manually later)
- Click "Save Customer"

**Edit Customer**
- Click edit icon in customer row
- Modify fields
- Click "Save Customer"

**Delete Customer**
- Click delete icon
- Confirm deletion
- Customer is permanently removed (consider soft delete in production)

### 2. Search & Filter

**Search Box**
- Real-time search across:
  - Company Name
  - Company ID
  - Contact Person
  - Email
  - Branch/Department

**Status Filter**
- All Customers
- Active Only
- Inactive Only

### 3. CSV Import

**Supported Format**:
```csv
Company ID,Company Name,Address,Contact Person,Email,Branch/Department,Machines
1100,ABC Corporation,"123 Main St, Manila",Juan Cruz,juan@abc.com,Main Office,"Canon iR2520, Xerox WC5855"
```

**Import Features**:
- ✅ Handles NULL values automatically
- ✅ Handles empty fields
- ✅ Handles quoted commas in addresses
- ✅ Batch processing for large files
- ✅ Progress tracking
- ✅ Error reporting for failed records
- ✅ Contact Numbers left blank for manual entry

### 4. CSV Export

- Click "Export CSV" button
- Downloads current customer list
- File format: `customers_YYYY-MM-DD.csv`
- Includes all fields

---

## 🔗 Customer-Billing Integration

### Setup Instructions:

1. **Add Customer Selector to Billing Form**

```html
<!-- Add this to your billing tab HTML in index.html -->
<div class="form-group">
    <label for="bill-customer-select">Customer (Optional)</label>
    <select id="bill-customer-select">
        <option value="">-- Select Customer --</option>
    </select>
</div>
```

2. **Load the Integration Script**

Add to your `index.html` before closing `</body>` tag:

```html
<script src="import-customers.js"></script>
<script src="customer-billing-integration.js"></script>
```

3. **Initialize Integration**

Already configured in your `script.js`:

```javascript
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        setTimeout(() => {
            customerManager.init();
            billingManager.init();
            billingCustomerIntegration.initCustomerDropdown();
        }, 1000);
    }
});
```

### Integration Features:

- **Customer Dropdown in Billing**: Select customer when creating bill
- **Auto-fill Bill To**: Automatically fills customer info
- **View Customer Bills**: See all bills for a customer
- **Billing Statistics**: Track total billed, paid, pending per customer

---

## 🔐 Firebase Security Rules

**Update your Firestore Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Customer Rules
    match /customers/{userId}/customerList/{customerId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**How to Update**:
1. Go to Firebase Console
2. Navigate to Firestore Database → Rules
3. Add the customer rules
4. Click "Publish"

---

## 📊 CSV Import Details

### Your CSV Structure:
```
Company ID,Company Name,Address,Contact Person,Email,Branch/Department,Machines,,,
1100,A-Z ASIA LTD PHILIPPINES INC,"7 Flr, Pacific Star...",Maria Theresa Malihan,mmalihan@hmi.net.ph,A-Z Asia LTD Philippines Inc,NULL,,,
```

### Import Handling:
- **NULL values** → Converted to empty string ""
- **Missing Contact Numbers** → Left blank for manual entry
- **Quoted Addresses** → Properly parsed (handles commas in addresses)
- **Multiple Machines** → Stored as single text field
- **Duplicate Company IDs** → Each row creates separate customer record (different branches)

### Import Statistics (Expected):
- Total Records: ~2,920
- Import Time: ~30-60 seconds
- Failed Records: 0 (if CSV is valid)

---

## 🎨 UI Features

### Customer Table Columns:
1. Company ID
2. Company Name
3. Branch/Department
4. Contact Person
5. Email
6. Machines
7. Status (Active/Inactive)
8. Actions (Edit/Delete buttons)

### Status Badges:
- 🟢 **ACTIVE**: Green badge
- 🔴 **INACTIVE**: Red badge

### Empty State:
Shows when no customers are found:
```
📭 No customers found
Add one or import from CSV
```

---

## 📝 Manual Data Entry

### Filling Contact Numbers:

After import, contact numbers will be blank. To fill them:

1. **Edit Each Customer**:
   - Click edit icon
   - Enter contact number
   - Save

2. **Bulk Update** (Future Enhancement):
   - Export to CSV
   - Add contact numbers in Excel
   - Re-import with update logic

### Data Validation:
- Company Name: **Required**
- All other fields: Optional
- Email: Validated format (if provided)
- Contact Number: Any format (e.g., 0912-345-6789)

---

## 🚨 Troubleshooting

### Import Issues:

**Problem**: Import fails
- **Solution**: Check console (F12) for detailed error
- **Common Issues**:
  - Not logged in
  - Firebase rules not updated
  - Network timeout (try smaller batches)

**Problem**: "No user logged in"
- **Solution**: Make sure you're logged in before importing

**Problem**: Some records failed
- **Solution**: Check import summary for failed records and reasons

### Display Issues:

**Problem**: Customers not showing
- **Solution**: Check if you're logged in with correct account
- **Solution**: Clear cache and reload

**Problem**: Search not working
- **Solution**: Check console for errors
- **Solution**: Verify JavaScript is loaded

---

## 📈 Performance Optimization

### Large Dataset Handling:
- Import uses batch processing (450 records per batch)
- Firestore has 500 operations/batch limit
- Total import time: ~30-60 seconds for 2900+ records

### Query Optimization:
- Customers ordered by company name
- Status filter uses indexed field
- Search is client-side for instant results

### Recommended Indexes:
```
Collection: customers/{userId}/customerList
- companyName (Ascending)
- status (Ascending)
- createdAt (Descending)
```

---

## 🔄 Data Migration

### Switching Between Accounts:

Data is isolated per user:
- `michael.marga@gmail.com` sees ONLY their customers
- `pinedamikeb@yahoo.com` sees ONLY their customers

### Export and Transfer:
1. Login to source account
2. Export CSV
3. Logout
4. Login to destination account
5. Import CSV

---

## 📦 Files Created

1. **import-customers.js** - CSV import utility
2. **customer-billing-integration.js** - Links customers to billing
3. **firebase-customer-rules.txt** - Security rules
4. **CUSTOMER-MANAGEMENT-GUIDE.md** - This documentation

---

## 🎯 Next Steps

1. ✅ **Import Your Data**: Use UI or console method
2. ✅ **Update Firebase Rules**: Add customer security rules
3. ✅ **Link Integration**: Add customer selector to billing
4. ✅ **Test Features**: Create, edit, search customers
5. 📝 **Fill Contact Numbers**: Manually add missing data
6. 🔗 **Create Bills**: Link bills to customers

---

## 💡 Tips

- **Regular Backups**: Export CSV regularly
- **Soft Delete**: Consider marking as inactive instead of deleting
- **Batch Operations**: For bulk updates, use export → edit → import
- **Search Shortcuts**: Search by company ID for quick lookup
- **Multi-Tenant**: Each user account is completely isolated

---

## 🆘 Support

For issues or questions:
1. Check console (F12) for detailed errors
2. Review this guide
3. Check Firebase logs
4. Test with small dataset first

---

**Last Updated**: November 12, 2025
**Version**: 1.0.0
**Author**: Expense Tracker Development Team
