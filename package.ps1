# ==========================================
# 智能周报生成工具 - 打包脚本
# Weekly Reporter Packaging Script
# ==========================================

param(
    [string]$Version = "1.0.0",
    [string]$OutputDir = "dist",
    [switch]$Clean = $false,
    [switch]$Zip = $true,
    [switch]$Verbose = $false
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = $ScriptDir

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    $Colors = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "Cyan" = [ConsoleColor]::Cyan
        "Magenta" = [ConsoleColor]::Magenta
        "White" = [ConsoleColor]::White
    }
    
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

# 输出Banner
function Show-Banner {
    Write-Host ""
    Write-ColorOutput "===========================================" "Cyan"
    Write-ColorOutput "📊 智能周报生成工具 - 打包脚本" "Green"
    Write-ColorOutput "Weekly Reporter Packaging Script v$Version" "Green"
    Write-ColorOutput "===========================================" "Cyan"
    Write-Host ""
}

# 验证项目文件
function Test-ProjectFiles {
    Write-ColorOutput "🔍 检查项目文件..." "Yellow"
    
    $RequiredFiles = @(
        "index.html",
        "script.js", 
        "styles.css"
    )
    
    $MissingFiles = @()
    
    foreach ($file in $RequiredFiles) {
        $filePath = Join-Path $ProjectRoot $file
        if (-not (Test-Path $filePath)) {
            $MissingFiles += $file
        }
    }
    
    if ($MissingFiles.Count -gt 0) {
        Write-ColorOutput "❌ 缺少必要文件:" "Red"
        foreach ($file in $MissingFiles) {
            Write-ColorOutput "   - $file" "Red"
        }
        throw "项目文件不完整，无法继续打包"
    }
    
    Write-ColorOutput "✅ 项目文件检查完成" "Green"
}

# 清理输出目录
function Clear-OutputDirectory {
    param([string]$Path)
    
    if (Test-Path $Path) {
        Write-ColorOutput "🧹 清理输出目录: $Path" "Yellow"
        Remove-Item $Path -Recurse -Force
    }
}

# 创建输出目录
function New-OutputDirectory {
    param([string]$Path)
    
    Write-ColorOutput "📁 创建输出目录: $Path" "Yellow"
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    
    return (Get-Item $Path).FullName
}

# 复制项目文件
function Copy-ProjectFiles {
    param(
        [string]$SourceDir,
        [string]$DestDir
    )
    
    Write-ColorOutput "📂 复制项目文件..." "Yellow"
    
    # 定义需要包含的文件和目录
    $IncludeFiles = @(
        "index.html",
        "script.js",
        "styles.css"
    )
    
    $IncludeJSFiles = @(
        "AiContentProcessor.js",
        "ConfigExportService.js", 
        "ConfigImportService.js",
        "ConfigurationManager.js",
        "DingTalkClient.js"
    )
    
    # 复制主要文件
    foreach ($file in $IncludeFiles) {
        $sourcePath = Join-Path $SourceDir $file
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $DestDir $file
            Copy-Item $sourcePath $destPath
            if ($Verbose) {
                Write-ColorOutput "   ✓ $file" "Green"
            }
        }
    }
    
    # 复制JavaScript模块文件
    foreach ($file in $IncludeJSFiles) {
        $sourcePath = Join-Path $SourceDir $file
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $DestDir $file
            Copy-Item $sourcePath $destPath
            if ($Verbose) {
                Write-ColorOutput "   ✓ $file" "Green"
            }
        }
    }
    
    # 跳过测试文件和示例文件的复制
    # Test files are excluded from packaging
    
    Write-ColorOutput "✅ 项目文件复制完成" "Green"
}

# 生成版本信息文件
function New-VersionFile {
    param(
        [string]$DestDir,
        [string]$Version
    )
    
    Write-ColorOutput "📝 生成版本信息..." "Yellow"
    
    $versionInfo = @{
        version = $Version
        buildDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        buildMachine = $env:COMPUTERNAME
        buildUser = $env:USERNAME
        gitCommit = ""
    }
    
    # 尝试获取Git提交信息
    try {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $gitCommit = git rev-parse --short HEAD 2>$null
            if ($gitCommit) {
                $versionInfo.gitCommit = $gitCommit.Trim()
            }
        }
    }
    catch {
        # Git不可用，跳过
    }
    
    $versionJson = $versionInfo | ConvertTo-Json -Depth 2
    $versionPath = Join-Path $DestDir "version.json"
    $versionJson | Out-File -FilePath $versionPath -Encoding UTF8
    
    Write-ColorOutput "✅ 版本信息生成完成" "Green"
}

# 生成安装指南
function New-InstallGuide {
    param([string]$DestDir)
    
    Write-ColorOutput "📋 生成安装指南..." "Yellow"
    
    $installGuide = @"
# 智能周报生成工具 - 安装指南

## 📦 文件说明

- \`index.html\` - 主应用文件，直接在浏览器中打开即可使用
- \`script.js\` - 主要的JavaScript逻辑代码
- \`styles.css\` - 样式文件
- \`*.js\` - 模块化的JavaScript组件文件
- \`version.json\` - 版本信息文件

## 🚀 快速开始

1. **解压文件**
   - 将所有文件解压到一个目录中

2. **打开应用**
   - 直接双击 \`index.html\` 文件
   - 或者在浏览器中打开 \`index.html\`

3. **配置API**
   - 设置 Dify API 地址和密钥
   - （可选）配置钉钉周报API

4. **开始使用**
   - 填写工作内容
   - 点击"生成周报"
   - 复制、下载或打印结果

## ⚙️ 系统要求

- **浏览器**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **网络**: 需要连接到Dify API服务
- **存储**: 约20MB磁盘空间

## 🔧 高级用法

- 支持配置导入/导出
- 支持数据保存/加载
- 支持历史记录管理
- 支持钉钉工作汇报集成

## 📞 技术支持

如有问题请参考应用内置的帮助信息。

---
构建时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
版本: $Version
"@

    $guidePath = Join-Path $DestDir "INSTALL.md"
    $installGuide | Out-File -FilePath $guidePath -Encoding UTF8
    
    Write-ColorOutput "✅ 安装指南生成完成" "Green"
}

# 创建启动脚本
function New-LaunchScripts {
    param([string]$DestDir)
    
    Write-ColorOutput "🚀 生成启动脚本..." "Yellow"
    
    # Windows批处理启动脚本
    $batchScript = @"
@echo off
echo 启动智能周报生成工具...
echo.
echo 正在打开浏览器...
start "" "index.html"
echo.
echo 如果浏览器没有自动打开，请手动双击 index.html 文件
pause
"@
    
    $batchPath = Join-Path $DestDir "启动应用.bat"
    $batchScript | Out-File -FilePath $batchPath -Encoding Default
    
    # PowerShell启动脚本
    $psScript = @"
# 智能周报生成工具启动脚本
Write-Host "启动智能周报生成工具..." -ForegroundColor Green
Write-Host ""

`$indexPath = Join-Path `$PSScriptRoot "index.html"

if (Test-Path `$indexPath) {
    Write-Host "正在打开浏览器..." -ForegroundColor Yellow
    Start-Process `$indexPath
    Write-Host "应用已启动！" -ForegroundColor Green
} else {
    Write-Host "错误：找不到 index.html 文件" -ForegroundColor Red
    Write-Host "请确保所有文件都已正确解压到同一目录中" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "按任意键退出..."
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@
    
    $psPath = Join-Path $DestDir "启动应用.ps1"
    $psScript | Out-File -FilePath $psPath -Encoding UTF8
    
    Write-ColorOutput "✅ 启动脚本生成完成" "Green"
}

# 计算文件大小
function Get-DirectorySize {
    param([string]$Path)
    
    $size = (Get-ChildItem -Path $Path -Recurse | Measure-Object -Property Length -Sum).Sum
    return [math]::Round($size / 1MB, 2)
}

# 创建ZIP压缩包
function New-ZipPackage {
    param(
        [string]$SourceDir,
        [string]$ZipPath
    )
    
    Write-ColorOutput "📦 创建ZIP压缩包..." "Yellow"
    
    try {
        # 使用.NET压缩功能
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($SourceDir, $ZipPath)
        
        $zipSize = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
        Write-ColorOutput "✅ ZIP压缩包创建完成: $ZipPath ($zipSize MB)" "Green"
        
        return $zipSize
    }
    catch {
        Write-ColorOutput "❌ ZIP压缩包创建失败: $_" "Red"
        throw
    }
}

# 显示打包摘要
function Show-PackageSummary {
    param(
        [string]$OutputDir,
        [string]$ZipPath,
        [double]$DirSize,
        [double]$ZipSize
    )
    
    Write-Host ""
    Write-ColorOutput "===========================================" "Cyan"
    Write-ColorOutput "📊 打包完成摘要" "Green"
    Write-ColorOutput "===========================================" "Cyan"
    Write-ColorOutput "版本: $Version" "White"
    Write-ColorOutput "输出目录: $OutputDir" "White"
    Write-ColorOutput "目录大小: $DirSize MB" "White"
    
    if ($ZipPath -and (Test-Path $ZipPath)) {
        Write-ColorOutput "ZIP文件: $ZipPath" "White"
        Write-ColorOutput "ZIP大小: $ZipSize MB" "White"
        Write-ColorOutput "压缩率: $([math]::Round((1 - $ZipSize / $DirSize) * 100, 1))%" "White"
    }
    
    Write-ColorOutput "构建时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "White"
    Write-ColorOutput "===========================================" "Cyan"
    Write-Host ""
    Write-ColorOutput "🎉 打包完成！您可以分发打包后的文件了。" "Green"
    Write-Host ""
}

# 主函数
function Main {
    try {
        Show-Banner
        
        # 验证项目文件
        Test-ProjectFiles
        
        # 设置输出路径
        $OutputPath = Join-Path $ProjectRoot $OutputDir
        $PackageName = "weekly-reporter-v$Version"
        $PackageDir = Join-Path $OutputPath $PackageName
        
        # 清理和创建输出目录
        if ($Clean -or (Test-Path $OutputPath)) {
            Clear-OutputDirectory $OutputPath
        }
        $FullOutputPath = New-OutputDirectory $PackageDir
        
        # 复制项目文件
        Copy-ProjectFiles -SourceDir $ProjectRoot -DestDir $FullOutputPath
        
        # 生成额外文件
        New-VersionFile -DestDir $FullOutputPath -Version $Version
        New-InstallGuide -DestDir $FullOutputPath
        New-LaunchScripts -DestDir $FullOutputPath
        
        # 计算目录大小
        $dirSize = Get-DirectorySize $FullOutputPath
        
        # 创建ZIP压缩包
        $zipSize = 0
        $zipPath = ""
        if ($Zip) {
            $zipPath = Join-Path $OutputPath "$PackageName.zip"
            $zipSize = New-ZipPackage -SourceDir $FullOutputPath -ZipPath $zipPath
        }
        
        # 显示摘要
        Show-PackageSummary -OutputDir $FullOutputPath -ZipPath $zipPath -DirSize $dirSize -ZipSize $zipSize
        
    }
    catch {
        Write-ColorOutput "❌ 打包失败: $_" "Red"
        exit 1
    }
}

# 显示帮助信息
function Show-Help {
    Write-Host ""
    Write-ColorOutput "智能周报生成工具 - 打包脚本" "Green"
    Write-Host ""
    Write-ColorOutput "用法:" "Yellow"
    Write-Host "  .\package.ps1 [参数]"
    Write-Host ""
    Write-ColorOutput "参数:" "Yellow"
    Write-Host "  -Version <string>   指定版本号 (默认: 1.0.0)"
    Write-Host "  -OutputDir <string> 指定输出目录 (默认: dist)"
    Write-Host "  -Clean              清理输出目录"
    Write-Host "  -Zip                创建ZIP压缩包 (默认: true)"
    Write-Host "  -Verbose            显示详细输出"
    Write-Host "  -Help               显示此帮助信息"
    Write-Host ""
    Write-ColorOutput "示例:" "Yellow"
    Write-Host "  .\package.ps1 -Version 2.0.0 -Clean -Verbose"
    Write-Host "  .\package.ps1 -OutputDir build -NoZip"
    Write-Host ""
}

# 处理帮助参数
if ($args -contains "-Help" -or $args -contains "--help" -or $args -contains "-h") {
    Show-Help
    exit 0
}

# 运行主函数
Main