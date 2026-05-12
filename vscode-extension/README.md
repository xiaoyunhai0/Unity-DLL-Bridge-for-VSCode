# Unity DLL Bridge

VSCode extension for validating and syncing external C# DLL outputs into Unity projects.

## MVP

The first vertical slice implements:

- `Unity DLL Bridge: Validate Configuration`
- `dllbridge.json` lookup
- shape and path validation
- clear error and warning messages
- `Unity DLL Bridge: Sync Only`
- manifest and sync log generation
- status bar quick actions
- `Unity DLL Bridge: Create Config Template`
- `Unity DLL Bridge: Select Configuration`

Runtime dependencies are intentionally kept at zero for offline-friendly VSIX distribution.
