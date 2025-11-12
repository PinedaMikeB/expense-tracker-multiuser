#!/bin/bash
# ============================================
# CUSTOMER SYSTEM - QUICK TEST SCRIPT
# ============================================

echo "🎯 Customer Management System - Test Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Not in expense-tracker directory"
    echo "📍 Please run: cd /Users/mike/Documents/Github/expense-tracker"
    exit 1
fi

echo "✅ In correct directory"
echo ""

# Check for required files
echo "📁 Checking files..."
files=("index.html" "script.js" "styles.css")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file MISSING"
        exit 1
    fi
done
echo ""

# Count lines in key files
echo "📊 File sizes:"
echo "  index.html: $(wc -l < index.html) lines"
echo "  script.js: $(wc -l < script.js) lines"
echo "  styles.css: $(wc -l < styles.css) lines"
echo ""

# Check for duplicate customer tabs
echo "🔍 Checking for duplicates..."
customer_tabs=$(grep -c "id=\"customers-tab\"" index.html)
if [ "$customer_tabs" -eq 1 ]; then
    echo "  ✅ Single customer tab found (duplicate removed)"
elif [ "$customer_tabs" -gt 1 ]; then
    echo "  ⚠️  WARNING: $customer_tabs customer tabs found (should be 1)"
else
    echo "  ❌ ERROR: No customer tab found"
fi
echo ""

# Check for customerManager in script.js
echo "🔍 Checking JavaScript..."
if grep -q "const customerManager" script.js; then
    echo "  ✅ customerManager object found"
else
    echo "  ❌ customerManager object missing"
fi

if grep -q "executeImport" script.js; then
    echo "  ✅ CSV import function found"
else
    echo "  ❌ CSV import function missing"
fi
echo ""

# Check if customer modal exists
echo "🔍 Checking modals..."
if grep -q "id=\"customer-modal\"" index.html; then
    echo "  ✅ Customer modal found"
else
    echo "  ❌ Customer modal missing"
fi

if grep -q "id=\"import-modal\"" index.html; then
    echo "  ✅ Import modal found"
else
    echo "  ❌ Import modal missing"
fi
echo ""

# Git status
echo "📦 Git status:"
git status --short
echo ""

echo "✅ Pre-deployment checks complete!"
echo ""
echo "🚀 Next steps:"
echo "  1. Open index.html in browser"
echo "  2. Login as pinedamikeb@yahoo.com"
echo "  3. Go to Customers tab"
echo "  4. Click 'Import CSV'"
echo "  5. Select Marga_Customers.csv"
echo "  6. Review preview and import"
echo ""
echo "📝 To deploy to Netlify:"
echo "  git add ."
echo "  git commit -m 'Fix: Remove duplicate customer tab'"
echo "  git push origin main"
echo ""
