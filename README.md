# CihuyAkz Studio Lite

A lightweight website for storing and managing Roblox Studio Lite / Roblox Studio scripts.

## Features

- Red gradient interface
- Built-in `Example Script`
- `Manage` → `Add New` for creating and publishing scripts
- Optional script thumbnails managed from the editor
- Thumbnail previews appear only while hovering over a script card and disappear when the pointer leaves
- GitHub login restricted to the configured `CihuyAkz` account
- GitHub token required for Manage/Publish operations
- Local `database.json` is loaded first so removed remote scripts do not reappear

## Thumbnail field

`Thumbnail URL (Optional)` accepts an `http://` or `https://` image URL. Leave it empty to disable the thumbnail. The value is stored in `database.json` with the script metadata and is rendered as a hover-only preview in the public script library.

## Publishing

After signing in with the configured GitHub account, `Manage` → `Add New` or editing an existing script publishes script metadata and source files to the configured repository.
