import * as vscode from "vscode"
import { basename } from "path"

type WorkingSetsNode = WorkingSet | WorkingSetItem
export class WorkingSetsProvider
  implements vscode.TreeDataProvider<WorkingSetsNode> {
  private static readonly WORKING_SETS_KEY = "workingSets"

  private _onDidChangeTreeData: vscode.EventEmitter<
    WorkingSetsNode | undefined
  > = new vscode.EventEmitter<WorkingSetsNode | undefined>()
  readonly onDidChangeTreeData: vscode.Event<WorkingSetsNode | undefined> = this
    ._onDidChangeTreeData.event

  private workspaceWorkingSets: Record<string, string[]> = {}

  private get workspaceWorkingSetsNames(): string[] {
    return Object.keys(this.workspaceWorkingSets)
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    const storedWorkingSets:
      | Record<string, string[]>
      | undefined = context.workspaceState.get(
      WorkingSetsProvider.WORKING_SETS_KEY
    )

    if (storedWorkingSets) {
      this.workspaceWorkingSets = storedWorkingSets
    } else {
      context.workspaceState
        .update(WorkingSetsProvider.WORKING_SETS_KEY, {})
        .then(
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

  getParent(element: WorkingSetsNode): vscode.ProviderResult<WorkingSetsNode> {
    console.log("called getParent", element)
    if (element instanceof WorkingSetItem) {
      return element.workingSet
    }

    return null
  }

  getTreeItem(element: WorkingSetsNode): WorkingSetsNode {
    return element
  }

  getChildren(workingSet?: WorkingSet): WorkingSetsNode[] {
    if (workingSet) {
      return this.workspaceWorkingSets[workingSet.label].map(
        (filePath) => new WorkingSetItem(vscode.Uri.file(filePath), workingSet)
      )
    }

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
        await this.updateWorkspaceState()
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

  addFile(workingSet: WorkingSet | undefined) {
    if (workingSet) {
      this.addActiveEditorToWorkingSet(workingSet)
    }
  }

  private workingSetExists(name: string): boolean {
    return this.workspaceWorkingSetsNames.includes(name)
  }

  private async deleteWorkingSet(name: string) {
    delete this.workspaceWorkingSets[name]
    vscode.window.showInformationMessage(
      `"${name}" working set successfully deleted`
    )
    await this.updateWorkspaceState()
    this._onDidChangeTreeData.fire()
  }

  private async addActiveEditorToWorkingSet(workingSet: WorkingSet) {
    const activeEditorDocument = vscode.window.activeTextEditor?.document
    const activeEditorFilePath = activeEditorDocument?.fileName
    if (activeEditorFilePath) {
      // TODO: make sure we only add files that don't exist in the set already
      this.workspaceWorkingSets[workingSet.label].push(activeEditorFilePath)
      vscode.window.showInformationMessage(
        `"${basename(activeEditorFilePath)}" added to ${workingSet.label}`
      )
      await this.updateWorkspaceState()
      // TODO: Maybe find a way to expand working set if it's collapsed
      vscode.commands.executeCommand("workingSets.expand", workingSet)
      this._onDidChangeTreeData.fire()
    }
  }

  private updateWorkspaceState() {
    return this.context.workspaceState.update(
      WorkingSetsProvider.WORKING_SETS_KEY,
      this.workspaceWorkingSets
    )
  }
}

class WorkingSet extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState)
  }

  contextValue = "workingSet"
}

class WorkingSetItem extends vscode.TreeItem {
  constructor(
    public readonly resourceUri: vscode.Uri,
    public readonly workingSet: WorkingSet
  ) {
    super(resourceUri, vscode.TreeItemCollapsibleState.None)
  }

  public readonly command: vscode.Command = {
    title: "",
    command: "vscode.open",
    arguments: [this.resourceUri, { preview: false }],
  }
}

export class WorkingSetsExplorer {
  private workingSetsViewer: vscode.TreeView<WorkingSetsNode>

  constructor(context: vscode.ExtensionContext) {
    const workingSetsProvider = new WorkingSetsProvider(context)
    this.workingSetsViewer = vscode.window.createTreeView("workingSets", {
      treeDataProvider: workingSetsProvider,
    })

    vscode.commands.registerCommand("workingSets.create", () =>
      workingSetsProvider.create()
    )
    vscode.commands.registerCommand("workingSets.delete", (workingSet) =>
      workingSetsProvider.delete(workingSet)
    )
    vscode.commands.registerCommand("workingSets.addFile", (workingSet) =>
      workingSetsProvider.addFile(workingSet)
    )
    vscode.commands.registerCommand("workingSets.expand", (workingSet) =>
      this.reveal(workingSet)
    )
  }

  private reveal(workingSet: WorkingSet) {
    console.log("workingSet label", workingSet.label)
    this.workingSetsViewer.reveal(workingSet, { expand: true }).then(
      () => {
        console.log("success")
      },
      (error) => {
        console.log(error)
      }
    )
  }
}
