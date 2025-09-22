@echo off
echo Starting YouTube AI Summarizer Microservice...
echo.

echo Installing dependencies...
cd backend
call npm install
echo.

echo Starting backend service on port 8082...
echo Press Ctrl+C to stop the service
echo.
node server.js