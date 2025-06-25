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
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "Git Branch Viewer";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      const uri = editor.document.uri;
      if (uri.scheme === "readonly") {
        const branchName = uri.path.split(":")[0];
        const fileName = path.basename(uri.path);
        statusBarItem.text = `Branch: ${branchName} | File: ${fileName}`;
      } else {
        statusBarItem.text = "Git Branch Viewer";
      }
    }
  });

  // View File in Branch
  const viewFileInBranch = vscode.commands.registerCommand(
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

  context.subscriptions.push(viewFileInBranch);

  // Compare File Across Branches
  const compareFileAcrossBranches = vscode.commands.registerCommand(
    "extension.compareFileAcrossBranches",
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
          placeHolder: "Select a branch to compare the file with",
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

        const leftUri = activeEditor.document.uri;
        const rightUri = vscode.Uri.parse(`readonly:${normalizedFilePath}`);
        const contentProvider =
          vscode.workspace.registerTextDocumentContentProvider("readonly", {
            provideTextDocumentContent: (uri) => {
              return fileContent;
            },
          });

        context.subscriptions.push(contentProvider);

        await vscode.commands.executeCommand(
          "vscode.diff",
          leftUri,
          rightUri,
          `Compare: Current Branch ↔ ${selectedBranch}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    }
  );

  context.subscriptions.push(compareFileAcrossBranches);

  // Search for Files Across Branches
  const searchFilesAcrossBranches = vscode.commands.registerCommand(
    "extension.searchFilesAcrossBranches",
    async () => {
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
          placeHolder: "Select a branch to search files in",
        });

        if (!selectedBranch) {
          return;
        }

        const filesOutput = await runGitCommand(
          `git ls-tree -r --name-only ${selectedBranch}`,
          repoPath
        );
        const files = filesOutput.split("\n");

        const selectedFile = await vscode.window.showQuickPick(files, {
          placeHolder: "Select a file to open",
        });

        if (!selectedFile) {
          return;
        }

        const fileContent = await runGitCommand(
          `git show ${selectedBranch}:${selectedFile}`,
          repoPath
        );

        const uri = vscode.Uri.parse(`readonly:${selectedFile}`);
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

  context.subscriptions.push(searchFilesAcrossBranches);

  // Open File from a Specific Commit
  const openFileFromCommit = vscode.commands.registerCommand(
    "extension.openFileFromCommit",
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
        const relativeFilePath = path.relative(repoPath, filePath);
        const normalizedFilePath = relativeFilePath.replace(/\\/g, "/");

        const logOutput = await runGitCommand(
          `git log --pretty=format:"%h %s" -- ${normalizedFilePath}`,
          repoPath
        );
        const commits = logOutput.split("\n");

        const selectedCommit = await vscode.window.showQuickPick(commits, {
          placeHolder: "Select a commit to open the file from",
        });

        if (!selectedCommit) {
          return;
        }

        const commitHash = selectedCommit.split(" ")[0];
        const fileContent = await runGitCommand(
          `git show ${commitHash}:${normalizedFilePath}`,
          repoPath
        );

        const uri = vscode.Uri.parse(
          `readonly:${commitHash}:${normalizedFilePath}`
        );
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

  context.subscriptions.push(openFileFromCommit);
}

// This method is called when your extension is deactivated
export function deactivate() {}
