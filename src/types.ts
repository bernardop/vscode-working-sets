import * as vscode from "vscode"
import { basename } from "path"
import { existsSync } from "fs"

export type WorkspaceWorkingSets = Map<string, WorkingSet>

type StringifyableWorkspaceWorkingSet = {
  id: string
  label: string
  collapsibleState: number
  filePaths: string[]
}

export type StringifyableWorkspaceWorkingSets = StringifyableWorkspaceWorkingSet[]

export type WorkingSetsNode = WorkingSet | WorkingSetItem

export type CreateWorkingSetOptions = {
  withOpenEditors?: boolean
  initialWorkingSetItemFilePath?: string
}

export class WorkingSet extends vscode.TreeItem {
  constructor(
    public id: string,
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    private items: WorkingSetItem[] = []
  ) {
    super(label, collapsibleState)
  }

  contextValue = "workingSet"

  getItems() {
    return this.items.filter(({ existsInFileSystem }) => existsInFileSystem)
  }

  setItems(...filePaths: string[]) {
    const newFilePaths = filePaths.filter((filePath) => !this.hasItem(filePath))

    this.items = [
      ...this.items,
      ...newFilePaths.map(
        (newFilePath) =>
          new WorkingSetItem(vscode.Uri.file(newFilePath), this.id)
      ),
    ]

    newFilePaths.length &&
      vscode.window.showInformationMessage(`File(s) added to "${this.label}"`)
  }

  removeItem(filePath: string) {
    if (this.hasItem(filePath)) {
      this.items = this.items.filter(
        ({ resourceUri: { fsPath } }) => fsPath !== filePath
      )
      vscode.window.showInformationMessage(
        `"${basename(filePath)}" removed from "${this.label}"`
      )
    }
  }

  private hasItem(filePath: string) {
    return this.items.some(({ resourceUri: { fsPath } }) => fsPath === filePath)
  }
}

export class WorkingSetItem extends vscode.TreeItem {
  existsInFileSystem: boolean

  constructor(
    public readonly resourceUri: vscode.Uri,
    public readonly parentId: string
  ) {
    super(resourceUri, vscode.TreeItemCollapsibleState.None)

    this.existsInFileSystem = existsSync(resourceUri.fsPath)
  }

  public readonly command: vscode.Command = {
    title: "",
    command: "vscode.open",
    arguments: [this.resourceUri, { preview: false }],
  }

  contextValue = "workingSetItem"
}
