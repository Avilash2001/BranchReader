import * as vscode from "vscode";
import { exec } from "child_process";
import * as path from "path";

function runGitCommand(command: string, repoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: repoPath }, (err, stdout, stderr) => {
      if (err) {
        reject(stderr || err.message);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function fileExistsInBranch(
  branch: string,
  filePath: string,
  repoPath: string
): Promise<boolean> {
  try {
    const result = await runGitCommand(
      `git ls-tree -r ${branch} --name-only`,
      repoPath
    );
    const filesInBranch = result.split("\n");
    return filesInBranch.includes(filePath);
  } catch (error) {
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.viewFileInBranch",
    async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        vscode.window.showErrorMessage("No file is currently open.");
        return;
      }

      const filePath = activeEditor.document.uri.fsPath;
      const repoPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      if (!repoPath) {
        vscode.window.showErrorMessage("No Git repository found.");
        return;
      }

      try {
        const branchesOutput = await runGitCommand(
          "git branch --all",
          repoPath
        );
        const branches = branchesOutput
          .split("\n")
          .map((branch) => branch.replace(/^\*?\s*/, "").trim())
          .filter((branch) => branch);

        const selectedBranch = await vscode.window.showQuickPick(branches, {
          placeHolder: "Select a branch to view the file",
        });

        if (!selectedBranch) {
          return;
        }

        const relativeFilePath = path.relative(repoPath, filePath);
        const normalizedFilePath = relativeFilePath.replace(/\\/g, "/");
        const fileExists = await fileExistsInBranch(
          selectedBranch,
          normalizedFilePath,
          repoPath
        );

        if (!fileExists) {
          vscode.window.showErrorMessage(
            `The file '${normalizedFilePath}' does not exist in branch '${selectedBranch}'.`
          );
          return;
        }

        const fileContent = await runGitCommand(
          `git show ${selectedBranch}:${normalizedFilePath}`,
          repoPath
        );

        const customFileName = `[${selectedBranch}] ${path.basename(
          normalizedFilePath
        )}`;
        const uri = vscode.Uri.parse(`readonly:${customFileName}`);

        const contentProvider =
          vscode.workspace.registerTextDocumentContentProvider("readonly", {
            provideTextDocumentContent: (uri) => {
              return fileContent;
            },
          });

        context.subscriptions.push(contentProvider);

        const virtualDocument = await vscode.workspace.openTextDocument(uri);

        await vscode.window.showTextDocument(virtualDocument, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
