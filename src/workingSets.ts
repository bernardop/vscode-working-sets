import * as vscode from "vscode"

export class WorkingSetsProvider
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined
  > = new vscode.EventEmitter<vscode.TreeItem | undefined>()
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this
    ._onDidChangeTreeData.event

  private workspaceWorkingSets: Record<string, string[]> = {}

  private get workspaceWorkingSetsNames(): string[] {
    return Object.keys(this.workspaceWorkingSets)
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    const storedWorkingSets:
      | Record<string, string[]>
      | undefined = context.workspaceState.get("workingSets")

    if (storedWorkingSets) {
      this.workspaceWorkingSets = storedWorkingSets
    } else {
      context.workspaceState.update("workingSets", {}).then(
        () => {
          this.workspaceWorkingSets = {}
        },
        () => {
          vscode.window.showErrorMessage(
            "There was a problem initializing the extension"
          )
        }
      )
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element
  }

  getChildren(): vscode.TreeItem[] {
    return this.workspaceWorkingSetsNames.map(
      (name) => new WorkingSet(name, vscode.TreeItemCollapsibleState.Collapsed)
    )
  }

  async create() {
    const name = await vscode.window.showInputBox({
      prompt: "New working set name",
    })
    if (name) {
      if (this.workingSetExists(name)) {
        vscode.window.showInformationMessage(
          "A working set with that name already exists"
        )
      } else {
        this.workspaceWorkingSets[name] = []
        vscode.window.showInformationMessage(
          `"${name}" working set successfully created`
        )
        this._onDidChangeTreeData.fire()
      }
    }
  }

  async delete(workingSet: WorkingSet | undefined): Promise<void> {
    if (workingSet) {
      const name = workingSet.label
      this.deleteWorkingSet(name)
    } else if (this.workspaceWorkingSetsNames.length > 0) {
      const name = await vscode.window.showQuickPick(
        this.workspaceWorkingSetsNames
      )
      name && this.deleteWorkingSet(name)
    } else {
      vscode.window.showInformationMessage(
        "There are no working sets to delete"
      )
    }
  }

  private workingSetExists(name: string): boolean {
    return this.workspaceWorkingSetsNames.includes(name)
  }

  private deleteWorkingSet(name: string) {
    delete this.workspaceWorkingSets[name]
    vscode.window.showInformationMessage(
      `"${name}" working set successfully deleted`
    )
    this._onDidChangeTreeData.fire()
  }
}

class WorkingSet extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState)
  }

  contextValue = "workingSet"
}
