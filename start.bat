@echo off
cd /d "%~dp0"
echo Запуск сервера на http://localhost:8000
echo Остановить: Ctrl + C
python -m http.server 8000
pause