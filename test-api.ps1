# Backend API Test Script
# URL: https://backendenson.onrender.com

$baseUrl = "https://backendenson.onrender.com"
$results = @()

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   BACKEND API E2E TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# TEST 1: Health Check
Write-Host "[1/9] Health Check..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -Method GET -TimeoutSec 90
    $sw.Stop()
    Write-Host "  Status: $($health.status)" -ForegroundColor Green
    Write-Host "  DB: $($health.services.database)" -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $results += @{Test="Health"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds; Details=$health.status}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Health"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 2: User Registration (New)
Write-Host "`n[2/9] User Registration (New User)..." -ForegroundColor Yellow
$deviceId = "QA-TEST-DEVICE-$(Get-Random -Maximum 9999999)"
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $body = @{ deviceId = $deviceId } | ConvertTo-Json
    $user = Invoke-RestMethod -Uri "$baseUrl/api/users/register" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
    $sw.Stop()
    Write-Host "  User ID: $($user.data.id)" -ForegroundColor Green
    Write-Host "  isNew: $($user.data.isNew)" -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $global:userId = $user.data.id
    $global:deviceId = $deviceId
    $results += @{Test="User Registration"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds; Details="isNew=$($user.data.isNew)"}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="User Registration"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 3: Duplicate User Check
Write-Host "`n[3/9] Duplicate User Check..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $body = @{ deviceId = $global:deviceId } | ConvertTo-Json
    $dupUser = Invoke-RestMethod -Uri "$baseUrl/api/users/register" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 60
    $sw.Stop()
    if ($dupUser.data.isNew -eq $false) {
        Write-Host "  Correctly returned existing user (isNew=false)" -ForegroundColor Green
        $results += @{Test="Duplicate Check"; Status="PASS"; Details="isNew=false"}
    } else {
        Write-Host "  WARNING: Created duplicate user!" -ForegroundColor Red
        $results += @{Test="Duplicate Check"; Status="FAIL"; Details="Duplicate created"}
    }
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Duplicate Check"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 4: Account Creation
Write-Host "`n[4/9] Account Creation..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $body = @{ name = "Ana Hesap" } | ConvertTo-Json
    $account = Invoke-RestMethod -Uri "$baseUrl/api/accounts" -Method POST -Body $body -ContentType "application/json" -Headers @{"x-device-id"=$global:deviceId} -TimeoutSec 60
    $sw.Stop()
    Write-Host "  Account ID: $($account.data.id)" -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $global:accountId = $account.data.id
    $results += @{Test="Account Creation"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Account Creation"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 5: Asset Creation (GOLD)
Write-Host "`n[5/9] Asset Creation (GOLD)..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $body = @{
        accountId = $global:accountId
        type = "GOLD"
        symbol = "XAU"
        quantity = 10
        buyPrice = 2500
    } | ConvertTo-Json
    $asset = Invoke-RestMethod -Uri "$baseUrl/api/assets" -Method POST -Body $body -ContentType "application/json" -Headers @{"x-device-id"=$global:deviceId} -TimeoutSec 60
    $sw.Stop()
    Write-Host "  Asset ID: $($asset.data.id)" -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $global:assetId = $asset.data.id
    $results += @{Test="Asset Creation"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Asset Creation"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 6: Get Assets with Prices
Write-Host "`n[6/9] Get Assets with Live Prices..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $assets = Invoke-RestMethod -Uri "$baseUrl/api/assets" -Method GET -Headers @{"x-device-id"=$global:deviceId} -TimeoutSec 60
    $sw.Stop()
    Write-Host "  Total Assets: $($assets.data.Count)" -ForegroundColor Green
    if ($assets.data.Count -gt 0) {
        Write-Host "  Current Price: $($assets.data[0].currentPrice)" -ForegroundColor Green
        Write-Host "  Profit/Loss: $($assets.data[0].profitLoss)" -ForegroundColor Green
    }
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $results += @{Test="Get Assets"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Get Assets"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 7: Portfolio Summary
Write-Host "`n[7/9] Portfolio Summary..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $portfolio = Invoke-RestMethod -Uri "$baseUrl/api/portfolio/summary" -Method GET -Headers @{"x-device-id"=$global:deviceId} -TimeoutSec 60
    $sw.Stop()
    Write-Host "  Total Value: $($portfolio.data.totalValue)" -ForegroundColor Green
    Write-Host "  P/L: $($portfolio.data.totalProfitLoss)" -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $results += @{Test="Portfolio"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="Portfolio"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 8: AI Analysis
Write-Host "`n[8/9] AI Portfolio Analysis..." -ForegroundColor Yellow
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $body = @{ userId = $global:userId } | ConvertTo-Json
    $ai = Invoke-RestMethod -Uri "$baseUrl/api/ai/portfolio-analysis" -Method POST -Body $body -ContentType "application/json" -Headers @{"x-device-id"=$global:deviceId} -TimeoutSec 120
    $sw.Stop()
    Write-Host "  Risk Score: $($ai.data.riskScore)" -ForegroundColor Green
    Write-Host "  Summary: $($ai.data.summary.Substring(0, [Math]::Min(50, $ai.data.summary.Length)))..." -ForegroundColor Green
    Write-Host "  Time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Gray
    $results += @{Test="AI Analysis"; Status="PASS"; Time=$sw.Elapsed.TotalSeconds}
} catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
    $results += @{Test="AI Analysis"; Status="FAIL"; Details=$_.Exception.Message}
}

# TEST 9: Error Handling
Write-Host "`n[9/9] Error Handling Test..." -ForegroundColor Yellow
try {
    $body = @{} | ConvertTo-Json  # Empty body
    $err = Invoke-RestMethod -Uri "$baseUrl/api/users/register" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 30
    Write-Host "  WARNING: Empty body accepted (should fail)" -ForegroundColor Yellow
    $results += @{Test="Error Handling"; Status="WARN"; Details="Empty body not rejected"}
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 400) {
        Write-Host "  Correctly returned 400 for empty body" -ForegroundColor Green
        $results += @{Test="Error Handling"; Status="PASS"; Details="400 Bad Request"}
    } else {
        Write-Host "  Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
        $results += @{Test="Error Handling"; Status="PASS"; Details="Error returned"}
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$passed = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failed = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$warned = ($results | Where-Object { $_.Status -eq "WARN" }).Count
Write-Host "PASSED: $passed" -ForegroundColor Green
Write-Host "FAILED: $failed" -ForegroundColor Red
Write-Host "WARNED: $warned" -ForegroundColor Yellow
