import pdfd from 'pdfjs-dist'
import { PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist'
import { GenericFile, GenericFileData } from './generic-file.js';
import { TextTools } from '../index.js';
import _ from 'lodash';

const { getDocument, VerbosityLevel } = pdfd;

export class Pdf extends GenericFile {
  // Application/pdf is the "correct" one but some legacy applications
  // that predate RFC 3778 still use x-pdf. Viva la internet.
  public static mimeTypes = ['application/pdf', 'application/x-pdf'];
  public static extensions = ['pdf'];

  async getAll(): Promise<GenericFileData> {
    return this.getBuffer()
      .then(buffer => getDocument({
        data: Uint8Array.from(buffer),
        verbosity: VerbosityLevel.ERRORS,
        disableFontFace: true
      }))
      .then(loader => loader.promise)
      .then(pdf => this.formatPdfDocument(pdf))
  }

  async getMetadata() {
    return this.getAll().then(results => results.metadata );
  }

  async getContent() {
    return this.getAll().then(results => results.content );
  }

  protected async formatPdfDocument(pdf: PDFDocumentProxy, pageDelimiter = "\n"): Promise<GenericFileData> {
    const data = await pdf.getMetadata();
    const formattedMetadata: Record<string, unknown> = {};

    if (data.metadata) {
      for (const [key, value] of Object.entries(data.metadata.getAll())) {
        if (key.includes(':')) {
          _.set(formattedMetadata ?? {}, key.split(':'), value)
        }
      }
    }

    const lines: Promise<string>[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      lines.push(pdf.getPage(p).then(this.renderPage))
    }
    const text = await Promise.all(lines).then(strings => strings.join(pageDelimiter))

    return Promise.resolve({
      metadata: {
        pages: pdf.numPages,
        ...data.info,
        ...formattedMetadata
      },
      content: {
        text,
        readability: TextTools.getReadabilityScore(text)
      }
    })
  }

  protected async renderPage(page: PDFPageProxy): Promise<string> {
    const text: string[] = [];
    const content = await page.getTextContent();

    // It may be useful to us Y-offset to detect newlines.
    // https://github.com/mozilla/pdf.js/issues/8963 
    for (const i of content.items) {
      if ('str' in i && i.str.length > 0) { 
        text.push(i.str);
      }
    }

    const output = text.join(' ')
      .replaceAll(/\s+/g, " ")
      .replaceAll(/\n+/g, "\n")
      .trim();

    page.cleanup();
    return Promise.resolve(output);
  }
}
