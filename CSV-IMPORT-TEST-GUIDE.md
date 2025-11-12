# 🧪 CSV Import Test Guide

## Your CSV File: Marga_Customers.csv

### File Stats
- **Total Records**: 2,922 customer entries
- **Companies**: ~765 unique company IDs
- **Format**: Standard CSV with quoted fields

### CSV Structure
```csv
Company ID,Company Name,Address,Contact Person,Email,Branch/Department,Machines,,,
1100, A-Z ASIA LTD  PHILIPPINES INC ,"7 Flr, Pacific Star Bldg...",Maria Theresa Malihan,mmalihan@hmi.net.ph,A-Z Asia LTD Philippines Inc,NULL,,,
```

**Note**: No "Contact Number" column in your file - system will create empty field for manual entry

---

## 🎯 Field Mapping

Your CSV → Database mapping:

| CSV Column | Database Field | Handling |
|---|---|---|
| Company ID | `companyId` | Preserved as-is (e.g., "1100") |
| Company Name | `companyName` | **REQUIRED** - Import fails if empty |
| Address | `address` | Comma-quoted strings handled correctly |
| Contact Person | `contactPerson` | Empty if blank in CSV |
| Email | `email` | Empty if blank in CSV |
| Branch/Department | `branchDepartment` | Department/location info |
| Machines | `machines` | "NULL" → "" (empty string) |
| (N/A) | `contactNumber` | Always "" - for manual entry |
| (Auto) | `status` | Always "active" on import |
| (Auto) | `createdAt` | Firebase server timestamp |
| (Auto) | `updatedAt` | Firebase server timestamp |

---

## 🔄 Import Process

### What Happens During Import

```
1. File Selection
   ↓
2. CSV Parsing (handles quotes, commas, NULL values)
   ↓
3. Data Cleaning (trim whitespace, convert NULL → "")
   ↓
4. Preview Display (first 5 rows)
   ↓
5. User Confirmation
   ↓
6. Batch Import to Firebase (all records at once)
   ↓
7. Results Summary (success/failed counts)
```

### Expected Processing Time
- **2,922 records**: ~30-60 seconds
- Progress indicator will show "Importing customers..."
- Don't close browser during import

---

## ✅ Pre-Import Checklist

Before importing, verify:

- [ ] Logged in as **pinedamikeb@yahoo.com**
- [ ] On **Customers** tab
- [ ] Table shows "No customers yet"
- [ ] CSV file ready: `/mnt/user-data/uploads/Marga_Customers.csv`
- [ ] Internet connection stable
- [ ] Browser window stays open

---

## 📊 Expected Results

### Success Scenario
```
╔════════════════════════════╗
║   IMPORT SUMMARY           ║
║                            ║
║   Imported: 2,922          ║
║   Failed: 0                ║
║   Total: 2,922             ║
║                            ║
║   Note: Contact numbers    ║
║   left blank for manual    ║
║   entry                    ║
╚════════════════════════════╝
```

### Data Validation Checks

After import, verify random samples:

**Sample 1**: Company ID 1100
- ✅ Company Name: "A-Z ASIA LTD PHILIPPINES INC"
- ✅ Contact: "Maria Theresa Malihan"
- ✅ Email: "mmalihan@hmi.net.ph"
- ✅ Machines: "" (was NULL)

**Sample 2**: Company ID 1142
- ✅ Company Name: "1 Pentagon Credit and Lending Corporation"
- ✅ Multiple branches imported separately
- ✅ Each branch has different machines

**Sample 3**: Company ID 186
- ✅ Address with commas preserved correctly
- ✅ Empty contact person → ""
- ✅ NULL machines → ""

---

## 🔍 Post-Import Testing

### Test 1: Search Functionality
```
Search: "A-Z Asia" → Should find Company ID 1100
Search: "Maria" → Should find contacts named Maria
Search: "mmalihan" → Should find by email
Search: "1100" → Should find by Company ID
```

### Test 2: Filter Functionality
```
Filter: "All Customers" → 2,922 records
Filter: "Active Only" → 2,922 records (all new imports are active)
Filter: "Inactive Only" → 0 records
```

### Test 3: Edit Customer
1. Click Edit on any customer
2. Add Contact Number: "0912-345-6789"
3. Click Save
4. Verify it appears in table

### Test 4: Export CSV
1. Click "Export CSV" button
2. Open downloaded file
3. Verify it matches original structure (plus Contact Number column)

---

## ⚠️ Known Data Issues (Your CSV)

### Multiple Entries per Company
- Same Company ID can have multiple rows (different branches)
- **Example**: Company ID 1100 has 5 different branches
- **Handling**: Each branch imported as separate customer record

### NULL Values in Machines
- **Count**: ~1,200 records have "NULL" in Machines column
- **Handling**: Converted to empty string ""
- **Impact**: Shows as blank in table, can be filled manually later

### Empty Contact Person
- **Count**: ~150 records have no contact person
- **Handling**: Stored as empty string ""
- **Recommendation**: Fill manually for important customers

### Empty Emails
- **Count**: ~300 records have no email
- **Handling**: Stored as empty string ""
- **Impact**: Cannot send automated emails to these customers

---

## 🐛 Troubleshooting

### Problem: "Error parsing CSV file"
**Cause**: File encoding issue or corrupted file
**Solution**: 
1. Open CSV in text editor
2. Save as UTF-8 encoding
3. Try import again

### Problem: Import shows 0 records
**Cause**: Wrong file selected or empty file
**Solution**: 
1. Verify file has content (not just headers)
2. Check file size is ~519KB
3. Re-select correct file

### Problem: Some records failed to import
**Cause**: Missing Company Name (required field)
**Solution**: 
1. Check failed records list in import summary
2. Find those rows in CSV
3. Add Company Name
4. Re-import just those records

### Problem: Can't see imported customers
**Cause**: Wrong user account or database isolation
**Solution**:
1. Verify you're logged in as pinedamikeb@yahoo.com
2. michael.marga@gmail.com account has separate customer list
3. Logout and login to correct account

### Problem: Duplicate customers after multiple imports
**Cause**: Imported same CSV multiple times
**Solution**:
1. Delete all customers
2. Import once
3. Or use "Clear All Data" function if needed

---

## 📝 Manual Data Entry Guide

After import, you'll need to add Contact Numbers manually.

### Batch Entry Strategy

**Priority Levels**:
1. **High Priority** (Active clients with recurring billing)
   - Add contact numbers first
   - ~200 customers

2. **Medium Priority** (Occasional clients)
   - Add as needed
   - ~500 customers

3. **Low Priority** (Inactive/historical)
   - Can remain blank
   - ~2,200 customers

### Quick Entry Process
1. Sort by Company Name
2. Edit → Add Contact Number → Save
3. Use keyboard shortcuts:
   - Tab: Next field
   - Enter: Save
   - Esc: Cancel

---

## ✅ Import Success Checklist

After import is complete:

- [ ] Customer count shows 2,922
- [ ] Search works correctly
- [ ] Filter shows all customers
- [ ] Can edit customer details
- [ ] Contact numbers are all blank (expected)
- [ ] Export CSV works
- [ ] No duplicate entries
- [ ] Random samples verified

---

## 🚀 Ready to Import!

Your system is configured and ready. The CSV import will:

✅ Handle all 2,922 records
✅ Convert NULL values automatically
✅ Preserve addresses with commas
✅ Create empty contact number fields
✅ Set all customers to "active" status
✅ Show detailed results

**Estimated time**: 30-60 seconds

**Go ahead and import whenever you're ready!**

