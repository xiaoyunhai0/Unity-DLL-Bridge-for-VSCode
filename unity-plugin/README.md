# Unity DLL Bridge Unity Plugin

Editor-only Unity plugin for the Unity DLL Bridge workflow.

## Install

Copy the `Assets/Editor/DllBridge/` folder into a Unity project, preserving this layout:

```text
Assets/Editor/DllBridge/
```

## Menus

- `Tools/DLL Bridge/Refresh`
- `Tools/DLL Bridge/Show Current DLL Info`
- `Tools/DLL Bridge/Open Plugins Folder`

## Manifest Window

`Show Current DLL Info` opens an Editor window that scans:

```text
Assets/Plugins/**/manifest.json
```

The window shows:

- manifest count, file count, and parse errors
- PDB count and whether the main DLL still exists
- DLL name, configuration, sync time, source project, and target path
- file size and SHA256 short hash
- buttons to open or reveal a manifest file and its folder

The plugin only runs in the Unity Editor. It does not add runtime code to builds.
