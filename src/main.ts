import {
	App,
	Component,
	MarkdownRenderer,
	Modal,
	Notice,
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

	/** Method 1: system print dialog -> user selects "Save as PDF" */
	doPrint(): void {
		const STYLE_ID = 'md-to-pdf-print-style';
		let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
		if (!style) {
			style = document.createElement('style');
			style.id = STYLE_ID;
			document.head.appendChild(style);
		}

		// Hide everything except our preview when printing
		style.textContent = `
@media print {
  body > *                  { display: none !important; }
  .modal-container          { display: block !important; }
  .modal-container > *      { display: none !important; }
  .md-to-pdf-modal          { display: block !important; box-shadow: none !important; border: none !important; position: static !important; }
  .md-to-pdf-modal > * { display: none !important; }
  .md-to-pdf-preview        { display: block !important; padding: 0 !important; overflow: visible !important; }
  .md-to-pdf-header         { display: none !important; }
  @page { margin: 20mm; }
}`;

		window.print();

		// Clean up after print dialog closes
		setTimeout(() => {
			if (style) style.textContent = '';
		}, 3000);
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
