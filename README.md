# MD to PDF Export

Export markdown notes to PDF directly inside Obsidian. Works on **Android** and desktop.

## How it works

Two export methods are available:

| Method | How |
|---|---|
| **Print / Save as PDF** | Opens the system print dialog. On Android, tap "Save as PDF". On desktop, select your PDF printer. |
| **Save as HTML** | Writes a self-contained `.html` file next to your note. Open it in Chrome and print to PDF from there. |

The HTML export embeds all current theme styles, so the output reflects your active Obsidian theme.

## Usage

Open any markdown note, then use one of:

- **Ribbon icon** -- tap the `file-down` icon in the left sidebar
- **Command palette** -- `Ctrl+P` / tap the command icon -> "MD to PDF Export: Export current note"
- **File menu** -- long-press a file in the explorer -> "Export to PDF / HTML"

A preview modal opens showing the rendered note. Choose **Print / Save as PDF** or **Save as HTML**.

## Android notes

- On Android (tested on Galaxy Tab S10 FE), the recommended method is **Save as HTML**, then open the file in Chrome and use Chrome's print-to-PDF.
- The **Print / Save as PDF** button calls `window.print()`, which may open the Android system print dialog depending on your device and Android version.

## Manual installation

Copy `main.js`, `manifest.json`, and `styles.css` into:

```
VaultFolder/.obsidian/plugins/md-to-pdf/
```

Then enable the plugin under Settings -> Community plugins.
