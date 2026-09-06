@echo off
title ЧЕШЕР — Запуск шахматной игры
cd /d "D:\Other\CHESHER"

echo.
echo ==========================================
echo   ЧЕШЕР — Шахматы v0.14
echo ==========================================
echo.

:: Проверяем доступность Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Python обнаружен
    echo Запуск с локальным сервером (рекомендуемый способ)...
    :: Очищаем порт 8000 если занят
    timeout /t 1 /nobreak >nul
    :: Запускаем сервер в фоне
    start "ChesserServer" cmd /c "python -m http.server 8000"
    timeout /t 3 /nobreak >nul
    :: Открываем браузер
    start "" "http://localhost:8000/index.html"
    echo.
    echo Игра должна открыться в браузере по адресу: http://localhost:8000
    echo Нажмите Enter для выхода...
    pause >nul
    exit /b
)

:: Если Python нет — пробуем Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js обнаружен
    echo Запуск через Node.js...
    npx http-server -p 8000 -c-1 >nul 2>&1 &
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:8000/index.html"
    echo.
    echo Игра открывается в браузере...
    echo Нажмите Enter для выхода...
    pause >nul
    exit /b
)

:: Если ничего нет — просто открываем файл
echo ⚠ Python и Node.js не найдены
echo Будем открывать файл напрямую (может быть ограничений браузера)
echo.
echo Продолжить открытие index.html?
msgbox "Игра ЧЕШЕР будет открыта в браузере. Если появятся ошибки связанные с безопасностью, используйте способ 1 (установите Python)."
pause
start "" "index.html"
echo.
echo Если игра не запустится или будут ошибки localStorage:
echo 1. Установите Python с python.org
echo 2. Перезапустите этот файл (launch.bat)
echo 3. Или откройте браузер по адресу: http://localhost:8000
pause