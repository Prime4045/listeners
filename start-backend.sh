#!/bin/bash

echo "🎵 Starting Listeners Backend Server..."
echo "=================================="

# Navigate to backend directory
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
fi

# Start the backend server
echo "🚀 Starting backend server on port 12001..."