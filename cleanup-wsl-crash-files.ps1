$ErrorActionPreference = 'Stop'
$expectedRoot = 'C:\Users\tetiana.flora\AppData\Local\Temp\wsl-crashes'
$planPath = Join-Path $PSScriptRoot 'storage-cleanup-plan.local.json'
$reportPath = Join-Path $PSScriptRoot 'storage-cleanup-result.local.json'
$comparison = [System.StringComparison]::OrdinalIgnoreCase
$plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
$resolvedRoot = (Resolve-Path -LiteralPath $expectedRoot).ProviderPath
if (-not [string]::Equals($resolvedRoot, $expectedRoot, $comparison)) {
    throw 'The resolved directory is outside the approved target.'
}
if (-not [string]::Equals([System.IO.Path]::GetFullPath([string]$plan.directory), $resolvedRoot, $comparison)) {
    throw 'The inventory directory does not match the approved target.'
}
$rootItem = Get-Item -LiteralPath $resolvedRoot -Force
if ($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    throw 'The approved directory is a reparse point; deletion stopped.'
}
if ($plan.fileCount -ne 30 -or @($plan.files).Count -ne 30) {
    throw 'The inventory differs from the approved 30 files.'
}

# Validate the complete approved inventory before the first removal.
$candidates = @()
$seenPaths = @{}
foreach ($record in $plan.files) {
    $absolutePath = [System.IO.Path]::GetFullPath([string]$record.path)
    if (-not [System.IO.Path]::IsPathRooted([string]$record.path) -or
        -not [string]::Equals([System.IO.Path]::GetDirectoryName($absolutePath), $resolvedRoot, $comparison)) {
        throw 'A file path is outside the approved directory.'
    }
    if ($seenPaths.ContainsKey($absolutePath)) { throw 'Duplicate inventory path.' }
    $seenPaths[$absolutePath] = $true
    $candidate = Get-Item -LiteralPath $absolutePath -Force
    if ($candidate.PSIsContainer -or
        ($candidate.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -or
        $candidate.Name -notlike 'wsl-crash-*.dmp') {
        throw 'The inventory contains an unapproved file type.'
    }
    if ($candidate.Length -ne [long]$record.bytes) { throw 'An approved file has changed size.' }
    $approvedTime = [System.DateTimeOffset]::Parse([string]$record.modifiedUtc).UtcDateTime
    if ([Math]::Abs(($candidate.LastWriteTimeUtc - $approvedTime).TotalSeconds) -gt 0.01) {
        throw 'An approved file has changed since inspection.'
    }
    $candidates += [pscustomobject]@{ Path = $absolutePath; Bytes = [long]$record.bytes }
}

$diskBefore = [System.IO.DriveInfo]::new('C:\').AvailableFreeSpace
$deleted = @()
$failures = @()
foreach ($candidate in $candidates) {
    try {
        # Native PowerShell, exact literal file path, no recursive removal.
        Remove-Item -LiteralPath $candidate.Path -Force -ErrorAction Stop
        if (Test-Path -LiteralPath $candidate.Path) { throw 'File still exists after removal.' }
        $deleted += $candidate
    } catch {
        $failures += [pscustomobject]@{ Path = $candidate.Path; Error = $_.Exception.GetType().Name }
    }
}
$diskAfter = [System.IO.DriveInfo]::new('C:\').AvailableFreeSpace
$removedBytes = [long](($deleted | Measure-Object -Property Bytes -Sum).Sum)
$remaining = @($candidates | Where-Object { Test-Path -LiteralPath $_.Path }).Count
$report = [ordered]@{
    completedAtUtc = [System.DateTimeOffset]::UtcNow.ToString('o')
    directory = $resolvedRoot
    approvedFiles = 30
    deletedFiles = $deleted.Count
    deletedBytes = $removedBytes
    remainingApprovedFiles = $remaining
    freeBytesBefore = $diskBefore
    freeBytesAfter = $diskAfter
    failures = $failures
}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
[pscustomobject]@{
    deletedFiles = $deleted.Count
    removedGiB = [Math]::Round($removedBytes / 1GB, 2)
    freeGiBBefore = [Math]::Round($diskBefore / 1GB, 2)
    freeGiBAfter = [Math]::Round($diskAfter / 1GB, 2)
    remainingApprovedFiles = $remaining
    failedFiles = $failures.Count
} | ConvertTo-Json -Compress
if ($remaining -ne 0 -or $failures.Count -ne 0) { exit 1 }
