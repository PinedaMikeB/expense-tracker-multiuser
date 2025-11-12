# 🧪 Customer System Quick Test

## Test 1: Manual Customer Add
1. Open app → Log in
2. Click **Customers** tab
3. Click **+ Add Customer**
4. Fill in:
   - Company ID: TEST001
   - Company Name: Test Company Inc
   - Branch: Main Office
   - Contact Person: John Doe
   - Email: john@test.com
5. Click **Save Customer**
6. ✅ Should see customer in table

## Test 2: CSV Import (Your Marga Data)
1. Click **Import CSV** button
2. Select `Marga_Customers.csv`
3. Review preview (should show 5 rows)
4. Click **Import Customers**
5. Wait for results
6. ✅ Should show: "Successfully imported X customers"
7. ✅ Check customer count updates

## Test 3: Search Function
1. In search box, type "A-Z"
2. ✅ Should filter to A-Z ASIA customers only
3. Clear search
4. ✅ All customers return

## Test 4: Edit Customer
1. Find any customer
2. Click **Edit** (pencil icon)
3. Change contact number (since it's empty)
4. Click **Save**
5. ✅ Change should persist

## Test 5: Export
1. Click **Export CSV**
2. ✅ File should download
3. Open in Excel
4. ✅ Verify all data present

## Test 6: Multi-Tenant Isolation
1. Log out
2. Log in as different email
3. ✅ Should see EMPTY customer list (different user)
4. Import same CSV
5. ✅ Creates separate customer database
6. Log back to first account
7. ✅ Original customers still there

---

## Expected Results After Import

From your CSV (Marga_Customers.csv):
- **Total Rows:** ~20 rows visible in preview
- **Unique Companies:** Multiple (A-Z Asia, 1 Pentagon, 101 New York, etc.)
- **NULL Machines:** Will become empty strings ""
- **Complex Addresses:** Will be preserved with commas
- **Contact Numbers:** All empty (for manual entry)

---

## Console Check

Open browser DevTools (F12) → Console tab:

Should see:
```
🔧 Initializing Customer Manager...
✅ Loaded X customers
✅ Parsed X rows from CSV
✅ Customer and Billing Management modules loaded
```

---

## Quick Fixes

**If import fails:**
1. Check you're logged in (top right)
2. Try smaller test CSV first
3. Check console for errors

**If customers don't show:**
1. Refresh page
2. Check Firebase rules are set
3. Verify user authentication

**If NULL still visible:**
1. Re-import CSV (new code cleans them)
2. Or manually edit to clear

---

## Production Checklist

Before going live:
- [ ] Import Marga_Customers.csv successfully
- [ ] Verify all customer data displays
- [ ] Test search functionality
- [ ] Add contact numbers to key customers
- [ ] Export backup CSV
- [ ] Test with second user account
- [ ] Confirm data isolation works

✅ **Ready for production use!**
