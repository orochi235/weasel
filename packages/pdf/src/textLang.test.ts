// @vitest-environment node
/** A text's language, written as `/Lang` on the catalog and on the marked content around its text. */
import { loadFontOutlines, registerFontOutlines } from '@weasel-js/font';
import { _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import type { TextDrawCommand } from '@weasel-js/renderer';
import type { ResolvedRun } from '@weasel-js/text';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registryFontSource } from './fonts/fontSource';
import { latin1 } from './latin1';
import { type PdfPage, writePdf } from './writePdf';

const INTER = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

beforeEach(async () => {
  const buf = readFileSync(INTER);
  // Built in this test's realm: the registry's `instanceof ArrayBuffer` rejects Node's.
  const bytes = new ArrayBuffer(buf.byteLength);
  new Uint8Array(bytes).set(buf);
  registerFontOutlines('sans-serif', {}, bytes);
  await loadFontOutlines('sans-serif', {});
});
afterEach(() => {
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

function run(text: string, lang?: string): ResolvedRun {
  return {
    text, fontFamily: 'sans-serif', fontSize: 20, fontWeight: 400, fontStyle: 'normal',
    fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
    ...(lang ? { lang } : {}),
  };
}

function page(...runs: ResolvedRun[][]): PdfPage {
  const commands = runs.map((r, i): TextDrawCommand => ({
    kind: 'text', x: 10, y: 30 + 30 * i, runs: r, style: { fontFamily: 'sans-serif', fontSize: 20 },
  }));
  return { width: 300, height: 200, commands };
}

async function render(pages: PdfPage[], lang?: string) {
  const { bytes } = await writePdf(pages, { fonts: registryFontSource, compress: false, ...(lang ? { lang } : {}) });
  const s = latin1(bytes);
  const contents = [...s.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((m) => m[1]).filter((c) => c.includes(' cm\n'));
  return { bytes, s, contents };
}

/** What pdf.js reads: the catalog's language, and each page's text with the marked content around it. */
async function read(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const doc = await task.promise;
    const { info } = await doc.getMetadata();
    const items = (await (await doc.getPage(1)).getTextContent({ includeMarkedContent: true })).items;
    const flow = items.map((i) => ('str' in i ? i.str : i.type === 'endMarkedContent' ? ']' : `${i.tag}[`)).join('');
    return { lang: (info as { Language?: string | null }).Language ?? null, flow };
  } finally {
    await task.destroy();
  }
}

describe('writePdf and a text’s lang', () => {
  it('writes the language it is given on the catalog, and marks only the text in another', async () => {
    const { bytes, contents } = await render([page([run('Hello', 'en'), run('Zdravo', 'sr-Latn')], [run('Bye')])], 'en');
    expect(contents[0].match(/BDC/g)).toHaveLength(1);
    expect(contents[0]).toMatch(/^\/Span <<\/Lang \(sr-Latn\)>> BDC$/m);
    expect(await read(bytes)).toEqual({ lang: 'en', flow: 'HelloSpan[Zdravo]Bye' });
  });

  it('matches a run’s language to the document’s whatever their case', async () => {
    const { contents } = await render([page([run('Hello', 'EN-us')])], 'en-US');
    expect(contents[0]).not.toContain('BDC');
  });

  it('takes the document’s language from its text when every run on every page shares one', async () => {
    const { bytes, contents } = await render([page([run('Zdravo', 'sr')]), page([run('Doviđenja', 'sr')])]);
    expect((await read(bytes)).lang).toBe('sr');
    for (const c of contents) expect(c).toMatch(/^\/Span <<\/Lang \(sr\)>> BDC$/m);
  });

  it('writes no catalog language when the text has none, or more than one', async () => {
    const untagged = await render([page([run('Zdravo', 'sr')], [run('Hello')])]);
    expect(untagged.s).not.toMatch(/\/Type \/Catalog[^\n]*\/Lang/);
    expect(untagged.contents[0].match(/BDC/g)).toHaveLength(1);
    expect((await read(untagged.bytes)).lang).toBeNull();
    const mixed = await render([page([run('Zdravo', 'sr'), run('Hallo', 'de')])]);
    expect((await read(mixed.bytes)).lang).toBeNull();
    expect(mixed.contents[0].match(/BDC/g)).toHaveLength(2);
  });

  it('closes the span after the text it marks', async () => {
    const { contents } = await render([page([run('ab', 'de')])], 'en');
    expect(contents[0]).toMatch(/\/Lang \(de\)>> BDC\n[\s\S]*BT[\s\S]*ET\nQ\nEMC\s*$/);
  });
});
