import {
	App,
	Component,
	MarkdownRenderer,
	Modal,
	Notice,
	Platform,
	Plugin,
	TFile,
} from 'obsidian';

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Collect CSS text from all loaded stylesheets so the exported HTML file
 * carries the current theme styles without external dependencies.
 */
function collectPageCSS(): string {
	const parts: string[] = [];
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			const rules = Array.from(sheet.cssRules ?? []);
			for (const rule of rules) {
				parts.push(rule.cssText);
			}
		} catch {
			// Cross-origin stylesheet -- skip silently
		}
	}
	return parts.join('\n');
}

/** For "Save as HTML": embeds Obsidian theme CSS so it looks like the app */
function buildHTMLDocument(title: string, bodyEl: HTMLElement): string {
	const css = collectPageCSS();
	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${css}
    /* ---- Export overrides ---- */
    body {
      background: #fff !important;
      color: #000 !important;
      padding: 24px 40px;
      max-width: 820px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 0; }
      @page { margin: 20mm; }
    }
    pre, code { background: #f4f4f4 !important; color: #222 !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; }
    th { background: #f0f0f0; }
    img { max-width: 100%; }
    blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1em; color: #555; }
  </style>
</head>
<body class="theme-light markdown-preview-view markdown-rendered">
  ${bodyEl.innerHTML}
</body>
</html>`;
}

/** For PDF export: uses minimal standalone CSS -- avoids Obsidian app:// conflicts in BrowserWindow */
function buildPDFDocument(title: string, bodyEl: HTMLElement): string {
	return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #111;
      background: #fff;
      padding: 32px 40px;
      max-width: 820px;
      margin: 0 auto;
    }
    @page { margin: 20mm; }
    h1 { font-size: 2em;   margin: 0.8em 0 0.4em; }
    h2 { font-size: 1.5em; margin: 0.8em 0 0.4em; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    h3 { font-size: 1.2em; margin: 0.7em 0 0.3em; }
    h4, h5, h6 { font-size: 1em; margin: 0.6em 0 0.3em; }
    p  { margin: 0.6em 0; }
    ul, ol { margin: 0.6em 0 0.6em 1.5em; }
    li { margin: 0.2em 0; }
    a  { color: #1a1aff; }
    strong { font-weight: 700; }
    em { font-style: italic; }
    code {
      font-family: 'SF Mono', Consolas, 'Courier New', monospace;
      font-size: 0.875em;
      background: #f4f4f4;
      padding: 1px 5px;
      border-radius: 3px;
    }
    pre {
      background: #f4f4f4;
      padding: 12px 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0.8em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #ccc;
      padding-left: 1em;
      color: #555;
      margin: 0.8em 0;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1.2em 0; }
  </style>
</head>
<body>
  ${bodyEl.innerHTML}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Preview Modal
// ---------------------------------------------------------------------------

class PDFPreviewModal extends Modal {
	private markdown: string;
	private file: TFile;
	private plugin: MDtoPDFPlugin;
	private previewEl!: HTMLElement;
	private component: Component;

	constructor(app: App, markdown: string, file: TFile, plugin: MDtoPDFPlugin) {
		super(app);
		this.markdown = markdown;
		this.file = file;
		this.plugin = plugin;
		this.component = new Component();
	}

	async onOpen(): Promise<void> {
		const { contentEl, modalEl } = this;
		modalEl.addClass('md-to-pdf-modal');
		contentEl.empty();

		// Header
		const header = contentEl.createDiv({ cls: 'md-to-pdf-header' });
		header.createEl('span', { cls: 'md-to-pdf-title', text: this.file.basename });

		const btnRow = header.createDiv({ cls: 'md-to-pdf-btnrow' });

		const printBtn = btnRow.createEl('button', {
			cls: 'mod-cta md-to-pdf-btn',
			text: 'Print / Save as PDF',
		});
		printBtn.addEventListener('click', () => { this.doPrint(); });

		const htmlBtn = btnRow.createEl('button', {
			cls: 'md-to-pdf-btn',
			text: 'Save as HTML',
		});
		htmlBtn.addEventListener('click', () => { void this.doSaveHTML(); });

		const closeBtn = btnRow.createEl('button', {
			cls: 'md-to-pdf-btn',
			text: 'Close',
		});
		closeBtn.addEventListener('click', () => { this.close(); });

		// Preview area
		this.previewEl = contentEl.createDiv({
			cls: 'md-to-pdf-preview markdown-preview-view markdown-rendered',
		});

		this.component.load();
		await MarkdownRenderer.render(
			this.app,
			this.markdown,
			this.previewEl,
			this.file.path,
			this.component
		);

		// Disable internal link navigation inside the modal
		this.previewEl.querySelectorAll<HTMLAnchorElement>('a.internal-link').forEach((a) => {
			a.addEventListener('click', (e) => { e.preventDefault(); });
		});
	}

	/** Method 1: print to PDF
	 *  - Desktop: save HTML to vault, open in default browser, user prints from there
	 *  - Mobile:  open a new window and call print() directly
	 */
	doPrint(): void {
		if (Platform.isDesktop) {
			void this.doPrintDesktop();
		} else {
			this.doPrintMobile();
		}
	}

	private async doPrintDesktop(): Promise<void> {
		const html = buildPDFDocument(this.file.basename, this.previewEl);
		new Notice('Generating PDF...', 2000);

		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
			const path = require('path') as typeof import('path');
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const fs = require('fs') as typeof import('fs');
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const os = require('os') as typeof import('os');
			// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
			const { BrowserWindow } = require('@electron/remote') as any;

			// Write HTML to a temp file so BrowserWindow can load it cleanly
			const tmpPath = path.join(os.tmpdir(), `md-to-pdf-${Date.now()}.html`);
			fs.writeFileSync(tmpPath, html, 'utf8');

			// Hidden window to render and export
			const win = new BrowserWindow({ show: false });
			await win.loadFile(tmpPath);

			const pdfBuffer: Buffer = await win.webContents.printToPDF({
				printBackground: true,
				pageSize: 'A4',
			});

			win.close();
			fs.unlinkSync(tmpPath);

			// Save PDF next to the source note
			const basePath = (this.app.vault.adapter as any).basePath as string;
			const outputRelative = this.file.path.replace(/\.md$/, '.pdf');
			const outputAbsolute = path.join(basePath, outputRelative);
			fs.writeFileSync(outputAbsolute, pdfBuffer);

			new Notice(`PDF saved: ${outputRelative}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice('PDF export failed: ' + message);
			console.error('[md-to-pdf]', err);
		}
	}

	private doPrintMobile(): void {
		const html = buildHTMLDocument(this.file.basename, this.previewEl);
		const printWindow = window.open('', '_blank');
		if (!printWindow) {
			new Notice('Pop-up blocked. Use "Save as HTML" instead.');
			return;
		}
		printWindow.document.write(html);
		printWindow.document.close();
		printWindow.focus();
		setTimeout(() => {
			printWindow.print();
			printWindow.close();
		}, 600);
	}

	/** Method 2: write self-contained HTML file to vault */
	async doSaveHTML(): Promise<void> {
		const html = buildHTMLDocument(this.file.basename, this.previewEl);
		const outputPath = this.file.path.replace(/\.md$/, '.html');

		try {
			const existing = this.app.vault.getAbstractFileByPath(outputPath);
			if (existing instanceof TFile) {
				await this.app.vault.modify(existing, html);
			} else {
				await this.app.vault.create(outputPath, html);
			}
			new Notice(`Saved: ${outputPath}\nOpen in Chrome -> menu -> Print -> Save as PDF`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice('Export failed: ' + message);
			console.error('[md-to-pdf]', err);
		}
	}

	onClose(): void {
		this.component.unload();
		this.contentEl.empty();
	}
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class MDtoPDFPlugin extends Plugin {
	async onload(): Promise<void> {
		this.addRibbonIcon('file-down', 'Export to PDF', () => { void this.exportActive(); });

		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note',
			callback: () => { void this.exportActive(); },
		});

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				menu.addItem((item) => {
					item
						.setTitle('Export to PDF / HTML')
						.setIcon('file-down')
						.onClick(() => { void this.openExportModal(file); });
				});
			})
		);
	}

	async exportActive(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== 'md') {
			new Notice('No active markdown note.');
			return;
		}
		await this.openExportModal(file);
	}

	async openExportModal(file: TFile): Promise<void> {
		try {
			const markdown = await this.app.vault.read(file);
			new PDFPreviewModal(this.app, markdown, file, this).open();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			new Notice('Could not read file: ' + message);
		}
	}
}
