# CihuyAkz Studio Lite

A lightweight website for storing, browsing, and managing Roblox Studio Lite / Roblox Studio scripts.

## Features

- Red gradient interface.
- Built-in `Example Script`.
- Script creation and editing from `Manage` → `Add New`.
- Optional script thumbnails with a live crop preview.
- Precise thumbnail horizontal and vertical positioning.
- Thumbnail scale control from `1.00×` to `3.00×`.
- Thumbnails appear only while hovering or keyboard-focusing a script card.
- Thumbnail images use a cropped cover frame, so oversized images are clipped instead of creating black bars.
- GitHub-based publishing for script and database changes.
- Login is restricted to the configured GitHub account; a GitHub token is required for Manage/Publish operations.

## Thumbnail Editing

The `Thumbnail` field is optional. Enter an HTTP/HTTPS image URL, then use the live preview to adjust:

- `Scale` — controls image zoom.
- `Horizontal Position` — moves the visible crop left/right.
- `Vertical Position` — moves the visible crop up/down.

The thumbnail viewport always matches the card frame and uses `object-fit: cover` with overflow clipping to keep the presentation filled.
