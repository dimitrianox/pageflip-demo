Clear-Host

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "      ATLAS BUILDER v1"
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

$city = Read-Host "Ciudad"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$cityFolder = Join-Path $root "cities\$city"
$mediaFolder = Join-Path $cityFolder "media"

$exiftool = Join-Path $PSScriptRoot "exiftool.exe"

if(!(Test-Path $exiftool))
{
    Write-Host ""
    Write-Host "No encuentro exiftool.exe" -ForegroundColor Red
    Pause
    Exit
}

if(!(Test-Path $mediaFolder))
{
    Write-Host ""
    Write-Host "No existe la carpeta:" -ForegroundColor Red
    Write-Host $mediaFolder
    Pause
    Exit
}

Write-Host ""
Write-Host "Buscando archivos..." -ForegroundColor Yellow
Write-Host ""

$extensions = @(
    "*.jpg",
    "*.jpeg",
    "*.png",
    "*.webp",
    "*.mp4",
    "*.mov",
    "*.m4v"
)

$files = @()

foreach($ext in $extensions)
{
    $files += Get-ChildItem $mediaFolder -Filter $ext -File
}

Write-Host "Archivos encontrados:" $files.Count
Write-Host ""

$result = @()
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

    $result += [PSCustomObject]@{

        type = $tipo
        file = $file.Name
        date = $fecha

    }

}
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

$cityData = [PSCustomObject]@{

    city = $city

    generated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

    total = $result.Count

    items = $result

}
$jsonPath = Join-Path $cityFolder "city.json"

$cityData |
    ConvertTo-Json -Depth 10 |
    Set-Content $jsonPath -Encoding UTF8

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "      CITY.JSON GENERADO"
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

Write-Host "Ciudad :" $city
Write-Host "Elementos :" $result.Count
Write-Host "Archivo :" $jsonPath
Write-Host ""

Pause