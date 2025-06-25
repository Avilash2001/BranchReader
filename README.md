# View File in Branch

This VS Code extension allows you to view the current file in a different Git branch without switching branches.

## Features

- View the current file in any branch without stashing or switching branches.
- Open the file in a new tab for easy comparison.

## Usage

1. Open a file in your workspace.
2. Run the command `View File in Branch` from the Command Palette (`Ctrl+Shift+P`).
3. Select a branch from the dropdown.
4. The file from the selected branch will open in a new tab.

## Requirements

- Git must be installed and available in your system's PATH.
- The workspace must be a Git repository.

## Known Issues

- Large files may take longer to load.
- Files that don't exist in the selected branch will throw an error.

## Release Notes

### 0.0.1

- Initial release.