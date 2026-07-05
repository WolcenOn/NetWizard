Set-Location $PSScriptRoot
if (Get-Command py -ErrorAction SilentlyContinue) { py -3 -m http.server 8080 } else { python -m http.server 8080 }
