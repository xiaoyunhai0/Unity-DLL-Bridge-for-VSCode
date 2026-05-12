# Unity DLL Bridge

Build, validate, and sync external C# DLL outputs into Unity projects without putting source code inside the Unity project.

This extension is designed for teams that keep gameplay or business C# code in a separate Visual Studio / C# project, compile it into DLLs, and only reference those DLLs from Unity.

```text
External C# Project
↓
DLL / PDB / XML output
↓
Unity DLL Bridge
↓
Unity Assets/Plugins
```

## Highlights

- Offline-friendly VSIX distribution.
- No runtime npm dependencies.
- Activity Bar `DLL Bridge` view with one-click actions.
- Status bar entry for common actions.
- `dllbridge.json` template generation.
- Debug / Release configuration switching.
- `Sync Only` for DLLs already built by Visual Studio or internal tools.
- `Build DLL Only` for building DLL outputs in VSCode without syncing to Unity.
- `Build & Sync` for `dotnet`, `msbuild`, or custom build commands.
- Manifest generation with SHA256 hashes.
- Local sync logs under `.dllbridge/logs/`.
- Source isolation guard: `.cs`, `.csproj`, `.sln`, `.props`, `.targets` are never copied.

## Workflow

1. Open the external C# project workspace in VSCode.
2. Open the `DLL Bridge` icon in the Activity Bar, or run `Unity DLL Bridge: Create Config Template`.
3. Edit `dllbridge.json`.
4. Select `Debug` or `Release`.
5. Run `Validate Configuration`.
6. Run `Build DLL Only`, `Sync Only`, or `Build & Sync`.
7. Open Unity and refresh assets, or use the optional Unity Editor plugin.

## Commands

| Command | Purpose |
|---|---|
| `Unity DLL Bridge: Create Config Template` | Create `dllbridge.json` in the current workspace. |
| `Unity DLL Bridge: Select Configuration` | Select Debug / Release or another configured build configuration. |
| `Unity DLL Bridge: Validate Configuration` | Validate paths, target Unity project, output DLLs, and safety settings. |
| `Unity DLL Bridge: Build DLL Only` | Run the configured build command without copying files into Unity. |
| `Unity DLL Bridge: Sync Only` | Copy existing DLL/PDB/XML/dependency outputs into Unity. |
| `Unity DLL Bridge: Build & Sync` | Run the configured build command, then sync outputs. |
| `Unity DLL Bridge: Open Sync Log` | Open `.dllbridge/logs/latest.log`. |
| `Unity DLL Bridge: Open Manifest` | Open the generated Unity-side `manifest.json`. |

The extension adds an Activity Bar `DLL Bridge` view and a `DLL Bridge` status bar entry with quick actions.
If no `dllbridge.json` exists yet, use the Activity Bar view or the command palette to create one.

## Configuration

The extension looks for:

```text
workspace/dllbridge.json
workspace/.dllbridge/dllbridge.json
```

Minimal example:

```json
{
  "version": 1,
  "name": "MyUnityGame",
  "unityProject": "../UnityClient",
  "defaultConfiguration": "Debug",
  "build": {
    "mode": "syncOnly",
    "timeoutSeconds": 120
  },
  "privacy": {
    "hideAbsolutePathsInManifest": true
  },
  "projects": [
    {
      "id": "game-logic",
      "name": "GameLogic",
      "assemblyName": "GameLogic",
      "sourceProject": "../GameLogic/GameLogic.csproj",
      "targetPluginPath": "../UnityClient/Assets/Plugins/GameLogic/Runtime",
      "allowSourceCopy": false,
      "configurations": {
        "Debug": {
          "outputDir": "../GameLogic/bin/Debug/netstandard2.1",
          "copyPdb": true,
          "copyXml": true,
          "backupBeforeOverwrite": true,
          "dependencies": []
        },
        "Release": {
          "outputDir": "../GameLogic/bin/Release/netstandard2.1",
          "copyPdb": false,
          "copyXml": false,
          "backupBeforeOverwrite": true,
          "dependencies": []
        }
      }
    }
  ]
}
```

## Build Modes

`syncOnly`:

```json
{
  "build": {
    "mode": "syncOnly"
  }
}
```

`dotnet`:

```json
{
  "build": {
    "mode": "dotnet",
    "projectPath": "../GameLogic/GameLogic.csproj",
    "timeoutSeconds": 120
  }
}
```

With `dotnet`, `Build DLL Only` and `Build & Sync` run a command like:

```text
dotnet build ../GameLogic/GameLogic.csproj -c Debug
```

`msbuild`:

```json
{
  "build": {
    "mode": "msbuild",
    "solutionPath": "../GameLogic/GameLogic.sln",
    "msbuildPath": "auto",
    "timeoutSeconds": 120
  }
}
```

`custom`:

```json
{
  "build": {
    "mode": "custom",
    "command": "./scripts/build-game-logic.sh",
    "args": ["{configuration}"],
    "timeoutSeconds": 120
  }
}
```

`{configuration}` is replaced with the active configuration selected in VSCode.

## Generated Files

Sync writes:

```text
Unity target folder/
├─ GameLogic.dll
├─ GameLogic.pdb
├─ GameLogic.xml
├─ manifest.json
└─ .dllbridge-backup/
```

Logs are written to:

```text
.dllbridge/logs/latest.log
.dllbridge/logs/<timestamp>.log
```

## Offline Use

Runtime dependencies are intentionally kept at zero for offline-friendly VSIX distribution. End users install the packaged `.vsix`; they do not need to run `npm install`.

Release packages usually include:

```text
UnityDllBridge-VSCode-<version>.vsix
UnityDllBridge-Templates-<version>.zip
UnityDllBridge-UnityPlugin-<version>.zip
README-offline-install.md
checksums.txt
```

`<version>` is the published release version shown on GitHub Releases.

## Safety

The tool is designed for source-code isolation.

Allowed output types:

```text
.dll
.pdb
.xml
.json
```

Blocked source/project files:

```text
.cs
.csproj
.sln
.props
.targets
```

If `allowSourceCopy` is set to `true`, validation fails.

## Troubleshooting

`dllbridge.json not found`:

- Open the folder that contains `dllbridge.json`, or create one with `Create Config Template`.

`Main DLL not found`:

- Build the external C# project first, or use `Build & Sync`.
- Use `Build DLL Only` when you want VSCode to build the DLL but do not want to copy it into Unity yet.
- Check `assemblyName` and `outputDir`.

`targetPluginPath must be inside Assets`:

- Set `targetPluginPath` under the Unity project's `Assets` folder.

`Build command failed`:

- Open `Unity DLL Bridge: Open Sync Log`.
- Check whether `dotnet`, `MSBuild.exe`, or your custom command exists on the machine.

See the repository README and `docs/offline-install.md` for the full workflow.
