# CihuyAkz Studio Lite

A GitHub-backed admin panel for managing Pages, multiple Lua scripts per Page, reusable Lua snippets, and Discord bots.

## Current version
- Publishing uses the Page Builder and supports multiple Script Names per Page.
- Generated script IDs and filenames are unique, so scripts do not overwrite each other.
- The Lua Library stores reusable snippets that can be inserted directly into any script editor.
- Toast notifications can be dismissed by tapping/clicking them.
- Linkvertise is not used.
- The public site and admin interface use English UI text.
- Generated Page links automatically follow the active GitHub Pages repository path to avoid project-site 404 errors caused by hard-coded repository URLs.

## Publishing
Sign in with a GitHub token that has **Contents: Read and write** permission for the target repository. The branch is `main`.

The repository owner, repository name, and GitHub Pages base URL are detected from the active GitHub Pages address when possible. Fallback values are defined in `app.js` for non-GitHub-Pages use.
