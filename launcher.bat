@echo off
:: ЧЕШЕР — Запуск игры в браузере
:: Автоматически открывает index.html в默认 браузере

cd /d "D:\Other\CHESHER"

echo.
echo === ЧЕШЕР — Запуск игры ===
echo.

:: Проверяем, есть ли Python (для локального сервера)
python --version 2>nul
if %errorlevel% == 0 (
    echo Python найден — запуск с локальным сервером...
    start "python -m http.server 8000" >nul 2>&1
    timeout /t 3 /nobreak >nul
    start "" "http://localhost:8000/index.html"
    exit /b
)

:: Иначе просто открываем файл в браузере
echo Запуск игры в браузере...
start "" "index.html"
echo.
echo Если игра не открылась, откройте браузер и перейдите по адресу:
echo   file://D:/Other/CHESHER/index.html
pause