#!/bin/bash
# GitHub Repository Connection Script
# Run this after creating the repository on GitHub

echo "🔗 Connecting to GitHub repository..."

cd "/Volumes/Wotg Drive Mike/GitHub/Expense-Tracker"

# Replace YOUR_GITHUB_USERNAME with your actual GitHub username
GITHUB_USERNAME="YOUR_GITHUB_USERNAME"
REPO_NAME="expense-tracker-madebread"

echo "Setting up remote origin..."
git remote add origin "https://github.com/$GITHUB_USERNAME/$REPO_NAME.git"

echo "Setting up main branch..."
git branch -M main

echo "Pushing to GitHub..."
git push -u origin main

echo "✅ Repository connected to GitHub!"
echo "🔗 Repository URL: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
