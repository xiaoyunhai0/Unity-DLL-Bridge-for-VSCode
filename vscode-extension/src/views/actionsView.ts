import * as vscode from 'vscode';

interface ActionItemDefinition {
  label: string;
  description: string;
  command: string;
  icon: vscode.ThemeIcon;
}

const ACTIONS: ActionItemDefinition[] = [
  {
    label: 'Create Config Template',
    description: '生成 dllbridge.json',
    command: 'unityDllBridge.createConfigTemplate',
    icon: new vscode.ThemeIcon('new-file')
  },
  {
    label: 'Select Configuration',
    description: '选择 Debug / Release',
    command: 'unityDllBridge.selectConfiguration',
    icon: new vscode.ThemeIcon('list-selection')
  },
  {
    label: 'Validate Configuration',
    description: '检查配置和路径',
    command: 'unityDllBridge.validateConfiguration',
    icon: new vscode.ThemeIcon('checklist')
  },
  {
    label: 'Build DLL Only',
    description: '只构建 DLL，不同步',
    command: 'unityDllBridge.buildDllOnly',
    icon: new vscode.ThemeIcon('tools')
  },
  {
    label: 'Build & Sync',
    description: '构建后同步到 Unity',
    command: 'unityDllBridge.buildAndSync',
    icon: new vscode.ThemeIcon('run-all')
  },
  {
    label: 'Sync Only',
    description: '同步已有 DLL',
    command: 'unityDllBridge.syncOnly',
    icon: new vscode.ThemeIcon('cloud-upload')
  },
  {
    label: 'Open Sync Log',
    description: '查看构建/同步日志',
    command: 'unityDllBridge.openSyncLog',
    icon: new vscode.ThemeIcon('output')
  },
  {
    label: 'Open Manifest',
    description: '查看 Unity manifest',
    command: 'unityDllBridge.openManifest',
    icon: new vscode.ThemeIcon('json')
  }
];

export function registerActionsView(context: vscode.ExtensionContext): void {
  const provider = new ActionsTreeDataProvider();
  const treeView = vscode.window.createTreeView('unityDllBridge.actionsView', {
    treeDataProvider: provider
  });

  context.subscriptions.push(treeView);
}

class ActionsTreeDataProvider implements vscode.TreeDataProvider<ActionTreeItem> {
  getTreeItem(element: ActionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ActionTreeItem[] {
    return ACTIONS.map((action) => new ActionTreeItem(action));
  }
}

class ActionTreeItem extends vscode.TreeItem {
  constructor(action: ActionItemDefinition) {
    super(action.label, vscode.TreeItemCollapsibleState.None);

    this.description = action.description;
    this.tooltip = `${action.label}: ${action.description}`;
    this.iconPath = action.icon;
    this.command = {
      command: action.command,
      title: action.label
    };
  }
}
