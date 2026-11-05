@echo off
setlocal

echo Starting KD AI services + tunnels for all listed projects...
echo.

start "social-media-automate" cmd /k "cd /d C:\Users\KR\Desktop\social-media-automate && node kd_aiservices.mjs"
start "KDWPC ONLINE SESSION" cmd /k "cd /d C:\Users\KR\Desktop\KDWPC ONLINE SESSION && node kd_aiservices.mjs"
start "kdbug" cmd /k "cd /d C:\Users\KR\Desktop\kdbug && node kd_aiservices.mjs"
start "KD-JEV-MCP" cmd /k "cd /d C:\Users\KR\Desktop\KD-JEV-MCP && node kd_aiservices.mjs"
start "KDType_BeginnerIDE" cmd /k "cd /d C:\Users\KR\Desktop\KDType_BeginnerIDE && node kd_aiservices.mjs"
start "my-roomIn3D-ctaxnagomi" cmd /k "cd /d C:\Users\KR\Desktop\my-roomIn3D-ctaxnagomi && node kd_aiservices.mjs"
start "govinme" cmd /k "cd /d C:\Users\KR\Desktop\govinme && node kd_aiservices.mjs"
start "modeling-sketch-work" cmd /k "cd /d C:\Users\KR\Desktop\modeling-sketch-work && node kd_aiservices.mjs"
start "KD Agent Runtime" cmd /k "cd /d D:\KD Agent Runtime && node kd_aiservices.mjs"

echo.
echo All launch commands issued. Each opens its own window.
echo by ctaxnagomi
pause
