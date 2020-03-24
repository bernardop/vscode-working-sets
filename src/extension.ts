// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode"
import { WorkingSetsProvider } from "./workingSets"

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const workingSetsProvider = new WorkingSetsProvider(context)
  vscode.window.registerTreeDataProvider("workingSets", workingSetsProvider)

  context.subscriptions.push(
    vscode.commands.registerCommand("workingSets.create", () =>
      workingSetsProvider.create()
    ),
    vscode.commands.registerCommand("workingSets.delete", (workingSet) =>
      workingSetsProvider.delete(workingSet)
    )
  )
}

// this method is called when your extension is deactivated
export function deactivate() {}
