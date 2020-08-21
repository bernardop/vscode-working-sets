# Change Log

All notable changes to the "working-sets" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.3.1] - 08/21/2020

### Added

- "Move Files" section to README
- `lint-staged` to project so it runs `eslint` and `prettier` on `pre-commit`

### Fixed

- When choosing "Move File Up" and "Move File Down" commands from the Command Palette, an error was shown so they have been removed from showing up there.

### Updated

- Dependencies to latest versions.

## [1.3.0] - 08/04/2020

### Added

- Ability to manually order files within a working set by moving them up or down ([#9](https://github.com/bernardop/vscode-working-sets/pull/9)). Thanks [Maciej Dems (@macdems)](https://github.com/macdems)

### Changed

- Updated activity bar icon to be more consistent with VS Code's icon language ([#9](https://github.com/bernardop/vscode-working-sets/pull/9)). Thanks [Maciej Dems (@macdems)](https://github.com/macdems)

## [1.2.0] - 06/11/2020

### Added

- Ability to sort working sets as well as files within a working set.

## [1.1.0] - 04/28/2020

### Added

- Reload command and reload button in view's title bar - The extension could get into a situation where a file exists in a working set but not in the file system (e.g. switching between git branches). This command allows the user to reload so the tree view is up to date.

## [1.0.0] - 04/20/2020

- Initial release
