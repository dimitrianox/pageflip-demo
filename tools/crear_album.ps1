Clear-Host

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "      ATLAS BUILDER v2"
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# ==========================================================
# ÁLBUM
# ==========================================================

$album = Read-Host "Album"

# ==========================================================
# RUTAS
# ==========================================================

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$albumFolder = Join-Path $root "albums\$album"

$mediaFolder = Join-Path $albumFolder "media"

$exiftool = Join-Path $PSScriptRoot "exiftool.exe"

# ==========================================================
# VALIDACIONES
# ==========================================================

if(!(Test-Path $exiftool))
{

    Write-Host ""
    Write-Host "No encuentro exiftool.exe" -ForegroundColor Red

    Pause

    Exit

}

if(!(Test-Path $albumFolder))
{

    Write-Host ""
    Write-Host "No existe la carpeta del album." -ForegroundColor Red
    Write-Host $albumFolder

    Pause

    Exit

}

if(!(Test-Path $mediaFolder))
{

    Write-Host ""
    Write-Host "No existe la carpeta media." -ForegroundColor Red
    Write-Host $mediaFolder

    Pause

    Exit

}

Write-Host ""
Write-Host "Buscando archivos..." -ForegroundColor Yellow
Write-Host ""

# ==========================================================
# EXTENSIONES
# ==========================================================

$extensions = @(

    "*.jpg",
    "*.jpeg",
    "*.png",
    "*.webp",
    "*.mp4",
    "*.mov",
    "*.m4v"

)

# ==========================================================
# BUSCAR ARCHIVOS
# ==========================================================

$files = [System.Collections.Generic.List[System.IO.FileInfo]]::new()

foreach($ext in $extensions)
{

    Get-ChildItem `
        -Path $mediaFolder `
        -Filter $ext `
        -File |

        ForEach-Object{

            $files.Add($_)

        }

}

Write-Host "Archivos encontrados:" $files.Count

Write-Host ""

# ==========================================================
# LEER METADATOS
# ==========================================================

$result = [System.Collections.Generic.List[object]]::new()

foreach($file in $files)
{

    $json = & $exiftool `
        -json `
        "-DateTimeOriginal" `
        "-CreateDate" `
        "-ModifyDate" `
        "$($file.FullName)"

    $meta = $json | ConvertFrom-Json

    $fecha = $null

    if($meta.DateTimeOriginal)
    {

        $fecha = $meta.DateTimeOriginal

    }
    elseif($meta.CreateDate)
    {

        $fecha = $meta.CreateDate

    }
    elseif($meta.ModifyDate)
    {

        $fecha = $meta.ModifyDate

    }
    else
    {

        $fecha = "1900:01:01 00:00:00"

    }

    if($file.Extension.ToLower() -in @(".mp4",".mov",".m4v"))
    {

        $tipo = "video"

    }
    else
    {

        $tipo = "photo"

    }

    Write-Host "$($file.Name)  -->  $fecha"

    $result.Add(

        [PSCustomObject]@{

            type = $tipo

            file = $file.Name

            date = $fecha

        }

    )

}

# ==========================================================
# ORDENAR POR FECHA
# ==========================================================

Write-Host ""
Write-Host "Ordenando por fecha..." -ForegroundColor Yellow

$result = $result | Sort-Object {

    try{

        [datetime]::ParseExact(

            $_.date,

            "yyyy:MM:dd HH:mm:ss",

            $null

        )

    }
    catch{

        Get-Date "1900-01-01"

    }

}

Write-Host "OK"

Write-Host ""

# ==========================================================
# CREAR ALBUM.JSON
# ==========================================================

$albumData = [PSCustomObject]@{

    id = $album

    generated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    total = $result.Count

    items = $result

}

$jsonPath = Join-Path $albumFolder "album.json"

# ==========================================================
# GUARDAR ALBUM.JSON
# ==========================================================

$albumData |
    ConvertTo-Json -Depth 10 |
    Set-Content `
        -Path $jsonPath `
        -Encoding UTF8

# ==========================================================
# RESUMEN
# ==========================================================

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "     ALBUM.JSON GENERADO"
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

Write-Host "Album      :" $album
Write-Host "Elementos  :" $result.Count
Write-Host "Archivo    :" $jsonPath

Write-Host ""

Pause
