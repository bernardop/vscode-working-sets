import * as vscode from "vscode"
import { basename } from "path"
import { existsSync } from "fs"
import { threadId } from "worker_threads"

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

    vscode.workspace.getConfiguration("workingSets").showNotifications &&
      newFilePaths.length &&
      vscode.window.showInformationMessage(`File(s) added to "${this.label}"`)
  }

  removeItem(filePath: string) {
    if (this.hasItem(filePath)) {
      this.items = this.items.filter(
        ({ resourceUri: { fsPath } }) => fsPath !== filePath
      )
      vscode.workspace.getConfiguration("workingSets").showNotifications &&
        vscode.window.showInformationMessage(
          `"${basename(filePath)}" removed from "${this.label}"`
        )
    }
  }

  sort(sortType: SortType) {
    this.items.sort((itemA, itemB) => {
      const itemAFileName = basename(itemA.resourceUri.fsPath)
      const itemBFileName = basename(itemB.resourceUri.fsPath)

      return sortType === SortType.ASCENDING
        ? itemAFileName.localeCompare(itemBFileName)
        : itemBFileName.localeCompare(itemAFileName)
    })
  }

  moveItem(filePath: string, direction: MoveDirection) {
    const index = this.items.findIndex(
      ({ resourceUri: { fsPath } }) => fsPath === filePath
    )
    if (direction === MoveDirection.UP && index > 0) {
      ;[this.items[index - 1], this.items[index]] = [
        this.items[index],
        this.items[index - 1],
      ]
    } else if (
      direction === MoveDirection.DOWN &&
      index !== -1 &&
      index < this.items.length - 1
    ) {
      ;[this.items[index + 1], this.items[index]] = [
        this.items[index],
        this.items[index + 1],
      ]
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

export enum SortType {
  ASCENDING,
  DESCENDING,
}

export enum MoveDirection {
  UP,
  DOWN,
}
