@echo off
title Atlas Builder

echo.
echo ==============================
echo       ATLAS BUILDER
echo ==============================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0crear_ciudad.ps1"

pause