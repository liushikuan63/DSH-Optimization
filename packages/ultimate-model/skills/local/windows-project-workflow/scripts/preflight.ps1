[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ProjectPath,
    [ValidateRange(0, 3)] [int] $MaxDepth = 2,
    [switch] $IncludeToolVersions,
    [switch] $AsJson
)

$ErrorActionPreference = 'Stop'
$resolvedProjectPath = (Resolve-Path -LiteralPath $ProjectPath).ProviderPath
if (-not (Test-Path -LiteralPath $resolvedProjectPath -PathType Container)) {
    throw 'ProjectPath must refer to an existing directory.'
}

$notes = [System.Collections.Generic.List[string]]::new()
$manifests = [System.Collections.Generic.List[object]]::new()
$ruleFiles = [System.Collections.Generic.List[string]]::new()
$toolInfo = [ordered]@{}
$repositoryCandidates = [System.Collections.Generic.List[string]]::new()
$sourceFileHints = [System.Collections.Generic.List[object]]::new()
$skipDirectoryPattern = '^(\.git|\.svn|node_modules|target|dist|build|out|vendor|\.next|\.cache|\.venv|venv|Library|Temp|temp|library|\.idea|\.vscode)$'
$historyDirectoryPattern = '^(_tmp.*|_dshwork|.*-stale|.*-preview-sync-.*|.*-stack-rebuild-.*)$'
$manifestNames = @('package.json', 'pom.xml', 'Cargo.toml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'Pipfile', 'setup.cfg', 'setup.py')
$lockNames = @('package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb', 'Cargo.lock', 'uv.lock', 'poetry.lock', 'Pipfile.lock')
$runtimeMarkerNames = @('pnpm-workspace.yaml', '.nvmrc', '.node-version', '.python-version', 'rust-toolchain.toml', 'gradlew', 'gradlew.bat')

function Read-NativeSummary {
    param([string] $Executable, [string[]] $NativeArguments)
    $previousNativeErrorAction = $ErrorActionPreference
    try {
        # Java prints normal version information to stderr, including in Windows PowerShell 5.1.
        $ErrorActionPreference = 'Continue'
        $captured = @(& $Executable @NativeArguments 2>&1)
        $nativeExitCode = $LASTEXITCODE
        [pscustomobject]@{
            ExitCode = $nativeExitCode
            Lines = @($captured | ForEach-Object { $_.ToString() })
        }
    } catch {
        [pscustomobject]@{ ExitCode = -1; Lines = @('Unable to read tool output.') }
    } finally {
        $ErrorActionPreference = $previousNativeErrorAction
    }
}

function Read-ManifestDirectory {
    param([string] $DirectoryPath, [int] $Depth)
    if (Test-Path -LiteralPath (Join-Path $DirectoryPath '.git')) { $repositoryCandidates.Add($DirectoryPath) }
    foreach ($sourceGroup in @(Get-ChildItem -LiteralPath $DirectoryPath -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Extension -in @('.py', '.java', '.ts', '.tsx', '.js', '.vue', '.kt', '.c', '.cpp', '.cs', '.go')
    } | Group-Object Extension)) {
        $sourceFileHints.Add([pscustomobject]@{ Directory = $DirectoryPath; Extension = $sourceGroup.Name; Count = $sourceGroup.Count })
    }
    foreach ($manifestName in $manifestNames) {
        $manifestPath = Join-Path $DirectoryPath $manifestName
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }
        $lockFiles = @($lockNames | Where-Object { Test-Path -LiteralPath (Join-Path $DirectoryPath $_) -PathType Leaf })
        $entry = [ordered]@{ Path = $manifestPath; Kind = $manifestName; Locks = $lockFiles }
        $entry.RuntimeMarkers = @($runtimeMarkerNames | Where-Object { Test-Path -LiteralPath (Join-Path $DirectoryPath $_) -PathType Leaf })
        try {
            if ($manifestName -eq 'package.json') {
                $package = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
                $entry.PackageManager = $package.packageManager
                $entry.NodeEngine = $package.engines.node
                $entry.Scripts = @($package.scripts.PSObject.Properties.Name | Where-Object { $_ })
                $entry.Frameworks = @()
                foreach ($dependencyName in @('react', 'vue', 'vuex', 'pinia', 'umi', '@umijs/max', '@vue/cli-service', 'typescript', 'vite', 'webpack', '@tauri-apps/api', '@cocos/creator-types', 'vitest', 'jest', '@playwright/test')) {
                    foreach ($dependencySection in @($package.dependencies, $package.devDependencies)) {
                        if ($dependencySection -and $dependencySection.PSObject.Properties[$dependencyName]) {
                            $entry.Frameworks += [pscustomobject]@{ Name = $dependencyName; Version = $dependencySection.PSObject.Properties[$dependencyName].Value }
                        }
                    }
                }
            } elseif ($manifestName -eq 'pom.xml') {
                $xmlSettings = [System.Xml.XmlReaderSettings]::new()
                $xmlSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
                $xmlSettings.XmlResolver = $null
                $xmlReader = [System.Xml.XmlReader]::Create($manifestPath, $xmlSettings)
                try {
                    $pom = [System.Xml.XmlDocument]::new()
                    $pom.XmlResolver = $null
                    $pom.Load($xmlReader)
                } finally { $xmlReader.Dispose() }
                $entry.JavaProperties = [ordered]@{}
                foreach ($propertyName in @('java.version', 'maven.compiler.release', 'maven.compiler.source', 'maven.compiler.target', 'maven.test.skip', 'skipTests')) {
                    $propertyNode = $pom.SelectSingleNode("/*[local-name()='project']/*[local-name()='properties']/*[local-name()='$propertyName']")
                    if ($propertyNode) { $entry.JavaProperties[$propertyName] = $propertyNode.InnerText }
                }
                $entry.Modules = @($pom.SelectNodes("/*[local-name()='project']/*[local-name()='modules']/*[local-name()='module']") | ForEach-Object { $_.InnerText })
                $entry.MavenWrapper = Test-Path -LiteralPath (Join-Path $DirectoryPath 'mvnw.cmd') -PathType Leaf
                $entry.SpringBootDeclarations = @()
                $parentArtifact = $pom.SelectSingleNode("/*[local-name()='project']/*[local-name()='parent']/*[local-name()='artifactId']")
                if ($parentArtifact -and $parentArtifact.InnerText -match '^spring-boot') {
                    $parentVersion = $pom.SelectSingleNode("/*[local-name()='project']/*[local-name()='parent']/*[local-name()='version']")
                    $entry.SpringBootDeclarations += [pscustomobject]@{ Source = 'parent'; Artifact = $parentArtifact.InnerText; Version = $(if ($parentVersion) { $parentVersion.InnerText } else { $null }) }
                }
                foreach ($bootPropertyName in @('spring-boot.version', 'spring.boot.version')) {
                    $bootProperty = $pom.SelectSingleNode("/*[local-name()='project']/*[local-name()='properties']/*[local-name()='$bootPropertyName']")
                    if ($bootProperty) { $entry.SpringBootDeclarations += [pscustomobject]@{ Source = $bootPropertyName; Version = $bootProperty.InnerText } }
                }
                $entry.PluginTestSkipDeclarations = @($pom.SelectNodes("//*[local-name()='plugin'][*[local-name()='artifactId' and (text()='maven-surefire-plugin' or text()='maven-failsafe-plugin')]]/*[local-name()='configuration']/*[local-name()='skipTests' or local-name()='skip' or local-name()='skipITs']") | ForEach-Object {
                    [pscustomobject]@{ Setting = $_.LocalName; Value = $_.InnerText }
                })
            } elseif ($manifestName -eq 'Cargo.toml') {
                $cargoLines = @(Get-Content -LiteralPath $manifestPath -Encoding utf8)
                $entry.RustVersionHints = @($cargoLines | Where-Object { $_ -match '^\s*(edition|rust-version)\s*=' })
            } elseif ($manifestName -match '\.gradle(\.kts)?$') {
                $gradleText = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8
                $entry.GradleWrapper = Test-Path -LiteralPath (Join-Path $DirectoryPath 'gradlew.bat') -PathType Leaf
                $entry.GradleVersionCatalog = Test-Path -LiteralPath (Join-Path $DirectoryPath 'gradle\libs.versions.toml') -PathType Leaf
                $entry.JavaVersionHints = @([regex]::Matches($gradleText, 'JavaVersion\.VERSION_\d+|jvmToolchain\(\s*\d+\s*\)|jvmTarget\s*=\s*["''][\d.]+["'']') | ForEach-Object { $_.Value } | Sort-Object -Unique)
                $entry.AndroidPluginDeclared = $gradleText -match 'com\.android\.(application|library)'
                $entry.KotlinPluginDeclared = $gradleText -match 'org\.jetbrains\.kotlin|kotlin\('
                $entry.StaticHintsOnly = $true
            } elseif ($manifestName -in @('pyproject.toml', 'Pipfile', 'setup.cfg')) {
                $pythonConfigLines = @(Get-Content -LiteralPath $manifestPath -Encoding utf8)
                $entry.PythonVersionHints = @($pythonConfigLines | Where-Object { $_ -match '^\s*(requires-python|python_requires|python|python_version)\s*=' })
                $entry.PythonToolSections = @($pythonConfigLines | Where-Object { $_ -match '^\[(tool\.(pytest|ruff|poetry|uv)|tool:pytest)' })
                $entry.StaticHintsOnly = $true
            } elseif ($manifestName -match '^requirements.*\.txt$') {
                # Print package names only; index URLs and direct URLs can contain credentials.
                $entry.RequirementNames = @((Get-Content -LiteralPath $manifestPath -Encoding utf8) | ForEach-Object {
                    if ($_ -match '^\s*([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^\]]+\])?\s*(?:[<>=!~@]|$)') { $Matches[1] }
                } | Sort-Object -Unique)
            } elseif ($manifestName -eq 'setup.py') {
                $entry.StaticHintsOnly = $true
                $entry.Note = 'File detected only; no Python build/setup code was executed.'
            }
        } catch {
            $entry.ReadError = 'Manifest could not be parsed; inspect the file directly.'
            $notes.Add("Unreadable manifest: $manifestPath")
        }
        $manifests.Add([pscustomobject]$entry)
    }
    foreach ($ruleName in @('AGENTS.override.md', 'AGENTS.md')) {
        $rulePath = Join-Path $DirectoryPath $ruleName
        if (Test-Path -LiteralPath $rulePath -PathType Leaf) { $ruleFiles.Add($rulePath); break }
    }
    if ($Depth -ge $MaxDepth) { return }
    try {
        $subdirectories = @(Get-ChildItem -LiteralPath $DirectoryPath -Directory -ErrorAction Stop | Where-Object {
            # A date/sandbox-like directory can be a real linked worktree.
            $_.Name -notmatch $skipDirectoryPattern -and ($_.Name -notmatch $historyDirectoryPattern -or (Test-Path -LiteralPath (Join-Path $_.FullName '.git') -PathType Leaf)) -and -not ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
        })
        foreach ($subdirectory in $subdirectories) { Read-ManifestDirectory -DirectoryPath $subdirectory.FullName -Depth ($Depth + 1) }
    } catch { $notes.Add("Directory could not be inspected: $DirectoryPath") }
}

$ancestor = [System.IO.Directory]::GetParent($resolvedProjectPath)
while ($null -ne $ancestor) {
    foreach ($ruleName in @('AGENTS.override.md', 'AGENTS.md')) {
        $rulePath = Join-Path $ancestor.FullName $ruleName
        if (Test-Path -LiteralPath $rulePath -PathType Leaf) { $ruleFiles.Add($rulePath); break }
    }
    $ancestor = $ancestor.Parent
}
Read-ManifestDirectory -DirectoryPath $resolvedProjectPath -Depth 0

$gitInfo = [ordered]@{ Available = $false; IsRepository = $false }
$gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
if ($gitCommand) {
    $gitInfo.Available = $true
    $previousOptionalLocks = $env:GIT_OPTIONAL_LOCKS
    try {
        $env:GIT_OPTIONAL_LOCKS = '0'
        $rootResult = Read-NativeSummary -Executable $gitCommand.Source -NativeArguments @('-C', $resolvedProjectPath, 'rev-parse', '--show-toplevel')
        if ($rootResult.ExitCode -eq 0) {
            $gitInfo.IsRepository = $true
            $gitInfo.Root = $rootResult.Lines[0]
            $gitInfo.IsLinkedWorktree = Test-Path -LiteralPath (Join-Path $gitInfo.Root '.git') -PathType Leaf
            $gitDirResult = Read-NativeSummary -Executable $gitCommand.Source -NativeArguments @('-C', $resolvedProjectPath, 'rev-parse', '--absolute-git-dir')
            $commonDirResult = Read-NativeSummary -Executable $gitCommand.Source -NativeArguments @('-C', $resolvedProjectPath, 'rev-parse', '--git-common-dir')
            if ($gitDirResult.ExitCode -eq 0) { $gitInfo.GitDirectory = $gitDirResult.Lines[0] }
            if ($commonDirResult.ExitCode -eq 0) { $gitInfo.CommonGitDirectory = $commonDirResult.Lines[0] }
            $branchResult = Read-NativeSummary -Executable $gitCommand.Source -NativeArguments @('-C', $resolvedProjectPath, 'rev-parse', '--abbrev-ref', 'HEAD')
            $statusResult = Read-NativeSummary -Executable $gitCommand.Source -NativeArguments @('-C', $resolvedProjectPath, 'status', '--porcelain=v1', '--untracked-files=normal')
            $gitInfo.Branch = $branchResult.Lines[0]
            $gitInfo.StatusExitCode = $statusResult.ExitCode
            if ($statusResult.ExitCode -eq 0) {
                $statusLines = @($statusResult.Lines | Where-Object { $_ })
                $gitInfo.StatusEntries = $statusLines.Count
                $gitInfo.HasExistingChanges = $statusLines.Count -gt 0
            } else { $notes.Add('Git status was not available; inspect the repository directly.') }
        } else { $notes.Add('Selected directory is not a Git checkout; locate the intended child repository.') }
    } finally {
        if ($null -eq $previousOptionalLocks) { Remove-Item Env:\GIT_OPTIONAL_LOCKS -ErrorAction SilentlyContinue } else { $env:GIT_OPTIONAL_LOCKS = $previousOptionalLocks }
    }
}

if ($IncludeToolVersions) {
    foreach ($toolName in @('node.exe', 'java.exe', 'javac.exe', 'mvn.cmd', 'cargo.exe', 'rustc.exe', 'python.exe', 'adb.exe')) {
        $toolCommand = Get-Command $toolName -ErrorAction SilentlyContinue
        if ($toolCommand) {
            $versionArgument = if ($toolName -in @('java.exe', 'javac.exe')) { '-version' } elseif ($toolName -eq 'adb.exe') { 'version' } else { '--version' }
            $versionResult = Read-NativeSummary -Executable $toolCommand.Source -NativeArguments @($versionArgument)
            $toolInfo[$toolName] = [pscustomobject]@{
                Path = $toolCommand.Source
                ExitCode = $versionResult.ExitCode
                VersionSummary = @($versionResult.Lines | Select-Object -First 3)
            }
        } else { $toolInfo[$toolName] = [pscustomobject]@{ Available = $false } }
    }
}

$gitBashPath = if ($env:ProgramFiles) { Join-Path $env:ProgramFiles 'Git\bin\bash.exe' } else { $null }
$result = [pscustomobject]@{
    ProjectPath = $resolvedProjectPath
    MaxDepth = $MaxDepth
    Git = [pscustomobject]$gitInfo
    RuleFiles = @($ruleFiles | Sort-Object -Unique)
    RepositoryCandidates = @($repositoryCandidates | Sort-Object -Unique)
    SourceFileTypeHints = @($sourceFileHints.ToArray())
    Manifests = @($manifests.ToArray())
    Tools = [pscustomobject]$toolInfo
    GitBash = [pscustomobject]@{ Path = $gitBashPath; Exists = ($null -ne $gitBashPath -and (Test-Path -LiteralPath $gitBashPath -PathType Leaf)) }
    ElectronRunAsNodeIsSet = -not [string]::IsNullOrEmpty($env:ELECTRON_RUN_AS_NODE)
    Notes = @($notes.ToArray())
}
if ($AsJson) { $result | ConvertTo-Json -Depth 12 } else { $result }
