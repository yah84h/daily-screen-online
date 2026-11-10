param(
    [Parameter(Mandatory=$true)][ValidateSet('Validate','Convert')][string]$Mode,
    [Parameter(Mandatory=$true)][string]$InputPath,
    [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = $null
try {
    $archive = [IO.Compression.ZipFile]::OpenRead($InputPath)
    $entries = @($archive.Entries)
    $total = ($entries | Measure-Object -Property Length -Sum).Sum
    $slides = @($entries | Where-Object { $_.FullName -match '^ppt/slides/slide[0-9]+\.xml$' })
    if ($entries.Count -ge 10000 -or $total -ge 500MB -or $slides.Count -lt 1 -or $slides.Count -gt 200) { throw 'PPTX must contain 1-200 slides within the size limit.' }
    if (-not ($entries | Where-Object { $_.FullName -eq '[Content_Types].xml' })) { throw 'Not a PPTX file.' }
    foreach ($entry in $entries) {
        if ($entry.FullName -match '(?i)vbaProject\.bin$') { throw 'Macros are not supported.' }
        if ($entry.FullName.EndsWith('.rels')) {
            if ($entry.Length -ge 1MB) { throw 'Relationships are too large.' }
            $stream = $entry.Open()
            $settings = New-Object System.Xml.XmlReaderSettings
            $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
            $settings.XmlResolver = $null
            $reader = [Xml.XmlReader]::Create($stream, $settings)
            try {
                while ($reader.Read()) {
                    if ($reader.NodeType -eq [Xml.XmlNodeType]::Element -and $reader.GetAttribute('TargetMode') -eq 'External' -and -not $reader.GetAttribute('Type').EndsWith('/hyperlink')) { throw 'External media are not supported.' }
                }
            } finally { $reader.Dispose(); $stream.Dispose() }
        }
    }
} finally { if ($archive) { $archive.Dispose() } }
if ($Mode -eq 'Validate') { Write-Output 'PPTX validation passed'; exit 0 }
if (-not $OutputDirectory) { throw 'OutputDirectory is required.' }
$app = $null; $deck = $null; $ownsApp = $false; $oldSecurity = $null; $oldAlerts = $null
try {
    $ownsApp = @(Get-Process POWERPNT -ErrorAction SilentlyContinue).Count -eq 0
    try { $app = New-Object -ComObject PowerPoint.Application } catch { throw 'Desktop Microsoft PowerPoint must be installed and activated on this Windows PC. Open it once, then retry.' }
    $oldSecurity = $app.AutomationSecurity; $oldAlerts = $app.DisplayAlerts
    $app.AutomationSecurity = 3
    $app.DisplayAlerts = 1
    $deck = $app.Presentations.Open($InputPath, -1, 0, 0)
    [IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null
    $scale = 1920 / [Math]::Max($deck.PageSetup.SlideWidth, $deck.PageSetup.SlideHeight)
    $width = [Math]::Max(1, [int][Math]::Round($deck.PageSetup.SlideWidth * $scale))
    $height = [Math]::Max(1, [int][Math]::Round($deck.PageSetup.SlideHeight * $scale))
    $count = 0
    for ($i = 1; $i -le $deck.Slides.Count; $i++) {
        $slide = $deck.Slides.Item($i)
        try {
            if ($slide.SlideShowTransition.Hidden -eq -1) { continue }
            $count++
            $slide.Export([IO.Path]::Combine($OutputDirectory, ('slide-{0}.jpg' -f $count)), 'JPG', $width, $height)
        } finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($slide) | Out-Null }
    }
    if ($count -eq 0) { throw 'The presentation contains no visible slides.' }
    Write-Output ('Converted {0} slides' -f $count)
} finally {
    if ($deck) { try { $deck.Close() } finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($deck) | Out-Null } }
    if ($app) {
        try {
            if ($null -ne $oldSecurity) { $app.AutomationSecurity = $oldSecurity }
            if ($null -ne $oldAlerts) { $app.DisplayAlerts = $oldAlerts }
            if ($ownsApp -and $app.Presentations.Count -eq 0) { $app.Quit() }
        } finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) | Out-Null }
    }
}
