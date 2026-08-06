@echo off
title Atlas Builder v2

cls

echo.
echo ==================================
echo        ATLAS BUILDER v2
echo ==================================
echo.

set /p album=Album: 

if "%album%"=="" (
    echo.
    echo Debes escribir un nombre de album.
    echo.
    pause
    exit
)

set "ROOT=%~dp0.."
set "ALBUM=%ROOT%\albums\%album%"
set "MEDIA=%ALBUM%\media"

echo.

if exist "%ALBUM%" (

    echo El album ya existe.
    echo.

) else (

    mkdir "%ALBUM%"
    mkdir "%MEDIA%"

    echo {}>"%ALBUM%\metadata.json"

    echo Album creado correctamente.
    echo.

)

echo ==================================
echo.

echo Album:
echo %ALBUM%

echo.

echo Estructura:

echo.

echo %ALBUM%
echo ^|-- media
echo ^|-- metadata.json

echo.

echo Copia ahora tus fotos y videos dentro de:

echo.

echo %MEDIA%

echo.

pause