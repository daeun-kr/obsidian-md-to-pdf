# MD to PDF Export

Export markdown notes to PDF directly inside Obsidian. Works on **Android**, **iOS**, and **desktop**.

## Features

- One-tap export from ribbon icon, command palette, or file context menu
- Preview rendered note before exporting
- Platform-aware: uses the best available method per device

## Platform behavior

| Platform | "Save as PDF" | "Save as HTML" |
|---|---|---|
| **Desktop (Mac/Windows/Linux)** | Generates `.pdf` file directly via Electron | Saves `.html` file to vault |
| **iOS (16+)** | Opens system print dialog via WKWebView | Saves `.html` file to vault |
| **Android** | Saves `.html` + shows step-by-step instructions | Saves `.html` file to vault |

### Android PDF workflow
After tapping "Save as PDF (via Chrome)":
1. Open the saved `.html` file from your vault
2. Open in Chrome
3. Menu -> Share -> Print
4. Save as PDF

## Usage

Open any markdown note, then use one of:

- **Ribbon icon** -- tap the `file-down` icon in the left sidebar
- **Command palette** -- `Ctrl+P` -> "MD to PDF Export: Export current note"
- **File context menu** -- long-press a file -> "Export to PDF / HTML"

A preview modal opens. Tap **Save as PDF** or **Save as HTML**.

## Manual installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

```
VaultFolder/.obsidian/plugins/md-to-pdf/
```

Then enable the plugin under Settings -> Community plugins.
