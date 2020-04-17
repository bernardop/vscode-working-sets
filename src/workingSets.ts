import * as vscode from "vscode"
import { basename } from "path"
import { randomBytes } from "crypto"
import {
  WorkingSet,
  WorkingSetItem,
  WorkingSetsNode,
  WorkspaceWorkingSets,
  StringifyableWorkspaceWorkingSets,
  CreateWorkingSetOptions,
} from "./types"

export class WorkingSetsProvider
  implements vscode.TreeDataProvider<WorkingSetsNode> {
  private static readonly WORKING_SETS_KEY = "workingSets"

  private _onDidChangeTreeData: vscode.EventEmitter<
    WorkingSetsNode | undefined
  > = new vscode.EventEmitter<WorkingSetsNode | undefined>()
  readonly onDidChangeTreeData: vscode.Event<WorkingSetsNode | undefined> = this
    ._onDidChangeTreeData.event

  private workspaceWorkingSets: WorkspaceWorkingSets = new Map()

  private get workingSetsNames(): string[] {
    return this.workingSets.map(({ label }) => label)
  }

  private get workingSets(): WorkingSet[] {
    const result = []

    for (const workingSet of this.workspaceWorkingSets.values()) {
      result.push(workingSet)
    }

    return result
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    const storedWorkingSets:
      | StringifyableWorkspaceWorkingSets
      | undefined = context.workspaceState.get(
      WorkingSetsProvider.WORKING_SETS_KEY
    )

    if (storedWorkingSets) {
      this.workspaceWorkingSets = this.getWorkspaceWorkingSetsFromJSONStringifyableObject(
        storedWorkingSets
      )
    } else {
      context.workspaceState
        .update(WorkingSetsProvider.WORKING_SETS_KEY, [])
        .then(
          () => {
            this.workspaceWorkingSets = new Map()
          },
          () => {
            vscode.window.showErrorMessage(
              "There was a problem initializing the extension"
            )
          }
        )
    }
  }

  getParent(
    workingSetsNode: WorkingSetsNode
  ): vscode.ProviderResult<WorkingSetsNode> {
    if (workingSetsNode instanceof WorkingSetItem) {
      return this.workspaceWorkingSets.get(workingSetsNode.parentId)
    }

    return null
  }

  getTreeItem(workingSetsNode: WorkingSetsNode): WorkingSetsNode {
    return workingSetsNode
  }

  getChildren(workingSet?: WorkingSet): WorkingSetsNode[] {
    return workingSet ? workingSet.getItems() : this.workingSets
  }

  async create(options?: CreateWorkingSetOptions) {
    const name = await vscode.window.showInputBox({
      prompt: "New working set name",
    })
    const withOpenEditors = options?.withOpenEditors
    const initialWorkingSetItemFilePath = options?.initialWorkingSetItemFilePath

    if (name) {
      if (this.workingSetExists(name)) {
        vscode.window.showInformationMessage(
          "A working set with that name already exists"
        )
      } else {
        const uniqueId = randomBytes(16).toString("hex")
        let workingSetItems: WorkingSetItem[]

        if (withOpenEditors) {
          workingSetItems = (await this.getOpenTextEditorsPaths()).map(
            (filePath) =>
              new WorkingSetItem(vscode.Uri.file(filePath), uniqueId)
          )
        } else if (initialWorkingSetItemFilePath) {
          workingSetItems = [
            new WorkingSetItem(
              vscode.Uri.file(initialWorkingSetItemFilePath),
              uniqueId
            ),
          ]
        } else {
          workingSetItems = []
        }

        const workingSet = new WorkingSet(
          uniqueId,
          name,
          withOpenEditors || initialWorkingSetItemFilePath
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed,
          workingSetItems
        )

        this.workspaceWorkingSets.set(uniqueId, workingSet)
        vscode.workspace.getConfiguration("workingSets").showNotifications &&
          vscode.window.showInformationMessage(
            `"${name}" working set successfully created`
          )
        if (withOpenEditors || initialWorkingSetItemFilePath) {
          await vscode.commands.executeCommand("workingSets.expand", workingSet)
        }
        this.updateWorkspaceState()
      }
    }
  }

  async delete(workingSet?: WorkingSet) {
    if (workingSet) {
      this.deleteWorkingSet(workingSet.label)
    } else if (this.workingSets.length > 0) {
      const name = await vscode.window.showQuickPick(this.workingSetsNames, {
        placeHolder: "Which working set do you want to delete?",
      })
      name && this.deleteWorkingSet(name)
    } else {
      vscode.window.showInformationMessage(
        "There are no working sets to delete"
      )
    }
  }

  async addOpenEditors() {
    if (this.workingSets.length > 0) {
      const workingSetNameOrNew = await vscode.window.showQuickPick([
        "New...",
        ...this.workingSetsNames,
      ])

      if (workingSetNameOrNew) {
        if (workingSetNameOrNew === "New...") {
          this.create({ withOpenEditors: true })
        } else {
          const workingSet = this.workspaceWorkingSets.get(
            this.getWorkingSetIDByName(workingSetNameOrNew)
          )

          workingSet?.setItems(
            ...(await this.getOpenTextEditorsPaths()).map(
              (fileName) => fileName
            )
          )
          this.updateWorkspaceState()
        }
      }
    } else {
      this.create({ withOpenEditors: true })
    }
  }

  async addActiveEditor(workingSet?: WorkingSet) {
    const activeEditorFilePath =
      vscode.window.activeTextEditor?.document.fileName

    if (activeEditorFilePath) {
      if (workingSet) {
        this.addFilePathToWorkingSet(workingSet, activeEditorFilePath)
      } else if (this.workingSets.length > 0) {
        const workingSetNameOrNew = await vscode.window.showQuickPick([
          "New...",
          ...this.workingSetsNames,
        ])

        if (workingSetNameOrNew) {
          if (workingSetNameOrNew === "New...") {
            this.create({ initialWorkingSetItemFilePath: activeEditorFilePath })
          } else {
            const workingSet = this.workspaceWorkingSets.get(
              this.getWorkingSetIDByName(workingSetNameOrNew)
            )

            workingSet?.setItems(activeEditorFilePath)
            this.updateWorkspaceState()
          }
        }
      } else {
        this.create({ initialWorkingSetItemFilePath: activeEditorFilePath })
      }
    } else {
      vscode.window.showInformationMessage("No Active Editor available")
    }
  }

  async addFile({ scheme, fsPath }: vscode.Uri) {
    console.log(scheme, fsPath)
    if (scheme === "file") {
      if (this.workingSets.length > 0) {
        const workingSetNameOrNew = await vscode.window.showQuickPick([
          "New...",
          ...this.workingSetsNames,
        ])

        if (workingSetNameOrNew) {
          if (workingSetNameOrNew === "New...") {
            this.create({ initialWorkingSetItemFilePath: fsPath })
          } else {
            const workingSet = this.workspaceWorkingSets.get(
              this.getWorkingSetIDByName(workingSetNameOrNew)
            )

            workingSet?.setItems(fsPath)
            this.updateWorkspaceState()
          }
        }
      } else {
        this.create({ initialWorkingSetItemFilePath: fsPath })
      }
    } else {
      vscode.window.showInformationMessage(
        "You are trying to add a resource that is not a file. Please try again."
      )
    }
  }

  async removeFile(workingSetItem?: WorkingSetItem) {
    if (workingSetItem) {
      const workingSet = this.workspaceWorkingSets.get(workingSetItem.parentId)

      workingSet?.removeItem(workingSetItem.resourceUri.fsPath)
      this.updateWorkspaceState()
    } else if (this.workingSets.length > 0) {
      const workingSetName = await vscode.window.showQuickPick(
        this.workingSetsNames,
        {
          placeHolder: "Which working set do you want to remove a file from?",
        }
      )

      if (workingSetName) {
        const workingSet = this.workspaceWorkingSets.get(
          this.getWorkingSetIDByName(workingSetName)
        )

        if (workingSet) {
          const filePath = await vscode.window.showQuickPick(
            this.getWorkingSetItemsQuickPickItems(workingSet),
            {
              placeHolder: `Which file do you want to remove from "${workingSetName}"?`,
              matchOnDetail: true,
            }
          )

          if (filePath) {
            workingSet.removeItem(filePath.detail)
            this.updateWorkspaceState()
          }
        }
      }
    } else {
      vscode.window.showInformationMessage(
        "There are no working sets to remove files from"
      )
    }
  }

  async openAllItems(workingSet: WorkingSet) {
    if (workingSet) {
      this.openWorkingSetItems(workingSet)
    } else {
      const workingSetName = await vscode.window.showQuickPick(
        this.workingSetsNames,
        {
          placeHolder: "Which working set do you want to open?",
        }
      )

      if (workingSetName) {
        const workingSet = this.workspaceWorkingSets.get(
          this.getWorkingSetIDByName(workingSetName)
        )
        workingSet && this.openWorkingSetItems(workingSet)
      }
    }
  }

  private refresh() {
    this._onDidChangeTreeData.fire()
  }

  private getJSONStringifyableWorkspaceWorkingSets(): StringifyableWorkspaceWorkingSets {
    const result = []

    for (const workspaceWorkingSet of this.workspaceWorkingSets.entries()) {
      const [id, workingSet] = workspaceWorkingSet
      result.push({
        id,
        label: workingSet.label,
        collapsibleState: workingSet.collapsibleState,
        filePaths: workingSet
          .getItems()
          .map(({ resourceUri: { fsPath } }) => fsPath),
      })
    }

    return result
  }

  private getWorkspaceWorkingSetsFromJSONStringifyableObject(
    data: StringifyableWorkspaceWorkingSets
  ): WorkspaceWorkingSets {
    const result: WorkspaceWorkingSets = new Map()

    for (const { id, label, collapsibleState, filePaths } of data) {
      result.set(
        id,
        new WorkingSet(
          id,
          label,
          collapsibleState,
          filePaths.map(
            (filePath) => new WorkingSetItem(vscode.Uri.file(filePath), id)
          )
        )
      )
    }

    return result
  }

  private workingSetExists(name: string): boolean {
    return this.workspaceWorkingSets.has(this.getWorkingSetIDByName(name))
  }

  private async deleteWorkingSet(name: string) {
    const performDelete = () => {
      this.workspaceWorkingSets.delete(this.getWorkingSetIDByName(name))
      vscode.workspace.getConfiguration("workingSets").showNotifications &&
        vscode.window.showInformationMessage(
          `"${name}" working set successfully deleted`
        )
      this.updateWorkspaceState()
    }

    if (vscode.workspace.getConfiguration("workingSets").confirmOnDelete) {
      const confirmation = await vscode.window.showInformationMessage(
        `Are you sure you want to delete "${name}"?`,
        { modal: true },
        "Yes"
      )
      if (confirmation === "Yes") {
        performDelete()
      }
    } else {
      performDelete()
    }
  }

  private async addFilePathToWorkingSet(
    workingSet: WorkingSet,
    filePath: string
  ) {
    this.workspaceWorkingSets.get(workingSet.id)?.setItems(filePath)

    await vscode.commands.executeCommand("workingSets.expand", workingSet)
    this.updateWorkspaceState()
  }

  private async updateWorkspaceState() {
    await this.context.workspaceState.update(
      WorkingSetsProvider.WORKING_SETS_KEY,
      this.getJSONStringifyableWorkspaceWorkingSets()
    )
    this.refresh()
  }

  private getWorkingSetIDByName(name: string): string {
    return this.workingSets.find(({ label }) => name === label)?.id || ""
  }

  private getWorkingSetItemsQuickPickItems(workingSet: WorkingSet) {
    return workingSet.getItems().map(({ label, resourceUri: { fsPath } }) => ({
      label: label || basename(fsPath),
      detail: fsPath,
    }))
  }

  private async getOpenTextEditorsPaths(): Promise<string[]> {
    const openEditors: string[] = []
    let activeEditor = vscode.window.activeTextEditor

    while (activeEditor?.document) {
      openEditors.push(activeEditor?.document.fileName || "")
      await vscode.commands.executeCommand("workbench.action.nextEditor")
      activeEditor = vscode.window.activeTextEditor

      if (
        openEditors.some(
          (filePath) => filePath === activeEditor?.document.fileName
        )
      ) {
        break
      }
    }

    return openEditors
  }

  private async openWorkingSetItems(workingSet: WorkingSet) {
    const workingSetItems = workingSet.getItems()
    if (workingSetItems.length > 0) {
      await vscode.commands.executeCommand("workbench.action.closeAllEditors")

      for (const { resourceUri } of workingSetItems) {
        await vscode.commands.executeCommand("vscode.open", resourceUri, {
          preview: false,
        })
      }
    } else {
      vscode.window.showInformationMessage(
        `"${workingSet.label}" does not have any items to open`
      )
    }
  }
}

export class WorkingSetsExplorer {
  private workingSetsViewer: vscode.TreeView<WorkingSetsNode>

  constructor(context: vscode.ExtensionContext) {
    const workingSetsProvider = new WorkingSetsProvider(context)
    this.workingSetsViewer = vscode.window.createTreeView("workingSets", {
      treeDataProvider: workingSetsProvider,
      showCollapseAll: true,
    })

    vscode.commands.registerCommand("workingSets.create", () =>
      workingSetsProvider.create()
    )
    vscode.commands.registerCommand("workingSets.delete", (workingSet) =>
      workingSetsProvider.delete(workingSet)
    )
    vscode.commands.registerCommand("workingSets.addOpenEditors", () =>
      workingSetsProvider.addOpenEditors()
    )
    vscode.commands.registerCommand(
      "workingSets.addActiveEditor",
      (workingSet) => workingSetsProvider.addActiveEditor(workingSet)
    )
    vscode.commands.registerCommand("workingSets.openAll", (workingSet) =>
      workingSetsProvider.openAllItems(workingSet)
    )
    vscode.commands.registerCommand("workingSets.addFile", (fileUri) =>
      workingSetsProvider.addFile(fileUri)
    )
    vscode.commands.registerCommand(
      "workingSets.removeFile",
      (workingSetItem) => workingSetsProvider.removeFile(workingSetItem)
    )
    vscode.commands.registerCommand("workingSets.expand", (workingSet) =>
      this.reveal(workingSet)
    )
  }

  private reveal(workingSet: WorkingSet) {
    this.workingSetsViewer.reveal(workingSet, { expand: true })
  }
}
