#!/bin/bash

echo "🎵 Starting Listeners Application..."
echo "=================================="

# Install frontend dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

# Start the backend in the background
echo "🚀 Starting backend server..."
./start-backend.sh &
BACKEND_PID=$!

# Wait a bit for the backend to start
sleep 3

# Start the frontend
echo "🚀 Starting frontend server on port 12000..."
npm run dev

# If the frontend is stopped, also stop the backend
kill $BACKEND_PID