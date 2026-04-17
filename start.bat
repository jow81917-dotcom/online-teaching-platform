@echo off
setlocal

set MYSQL=d:\xampp\mysql\bin\mysql.exe
set MYSQLADMIN=d:\xampp\mysql\bin\mysqladmin.exe
set MYSQLD=d:\xampp\mysql\bin\mysqld.exe
set MYINI=d:\xampp\mysql\bin\my.ini
set ROOT=d:\xampp\htdocs\online-teaching-platform

echo ============================================
echo  Starting XAMPP MySQL...
echo ============================================

:: Start MySQL if not already running
%MYSQLADMIN% -u root --connect-timeout=3 status >nul 2>&1
if %errorlevel% neq 0 (
    start "XAMPP MySQL" %MYSQLD% --defaults-file="%MYINI%"
    echo Waiting for MySQL to start...
    timeout /t 5 /nobreak >nul
    %MYSQLADMIN% -u root --connect-timeout=10 status >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: MySQL failed to start. Please start it from XAMPP Control Panel.
        pause
        exit /b 1
    )
)
echo MySQL is running.

echo.
echo ============================================
echo  Importing database schema...
echo ============================================
%MYSQL% -u root < "%ROOT%\database\schema.sql" 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Schema import had errors (may already exist - continuing)
) else (
    echo Schema imported successfully.
)

echo.
echo ============================================
echo  Installing backend dependencies...
echo ============================================
cd /d "%ROOT%\backend"
call npm install

echo.
echo ============================================
echo  Installing webrtc-signaling-server deps...
echo ============================================
cd /d "%ROOT%\webrtc-signaling-server"
call npm install

echo.
echo ============================================
echo  Installing frontend dependencies...
echo ============================================
cd /d "%ROOT%\frontend"
call npm install

echo.
echo ============================================
echo  Starting all servers...
echo ============================================

start "Backend API" cmd /k "cd /d %ROOT%\backend && npm run dev"
timeout /t 2 /nobreak >nul

start "WebRTC Signaling" cmd /k "cd /d %ROOT%\webrtc-signaling-server && npm start"
timeout /t 2 /nobreak >nul

start "Frontend" cmd /k "cd /d %ROOT%\frontend && npm run dev"

echo.
echo All servers started in separate windows:
echo   Backend API      -^> http://localhost:5000
echo   WebRTC Signaling -^> http://localhost:5001
echo   Frontend         -^> http://localhost:5173
echo.
pause
