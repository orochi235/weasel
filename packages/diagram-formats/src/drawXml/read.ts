/**
 * Reading draw-style XML: a file of `<diagram>` pages, each a graph model
 * written out or compressed, or one bare graph model.
 */
import type { DocumentPage, ImportResult } from '../document';
import { readPage, type IdSpace } from './readPage';

const childElements = (el: Element): Element[] => Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

function parseXml(text: string, what: string): Element {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error !== undefined) throw new Error(`${what} is not well-formed XML: ${(error.textContent ?? '').trim().split('\n')[0]}`);
  return doc.documentElement;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes as unknown as BufferSource).then(() => writer.close()).catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** A compressed page: base64 of raw deflate of the URI-encoded graph model. */
async function unpacked(content: string): Promise<string> {
  const binary = atob(content.replace(/\s+/g, ''));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const text = new TextDecoder().decode(await inflateRaw(bytes));
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** A `<diagram>` element's graph model, written out or compressed inside it. */
async function modelOf(diagram: Element, label: string): Promise<Element> {
  const model = childElements(diagram).find((c) => c.tagName === 'mxGraphModel');
  if (model !== undefined) return model;
  const content = (diagram.textContent ?? '').trim();
  if (content === '') throw new Error(`Page ${label} holds no graph model`);
  let xml: string;
  try {
    xml = await unpacked(content);
  } catch {
    throw new Error(`Page ${label} holds compressed content that does not inflate`);
  }
  const root = parseXml(xml, `The compressed content of page ${label}`);
  if (root.tagName !== 'mxGraphModel') throw new Error(`Page ${label} holds compressed content that is not a graph model`);
  return root;
}

const sizeOf = (model: Element, name: 'pageWidth' | 'pageHeight'): number | undefined => {
  const n = Number(model.getAttribute(name) ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function pageOf(model: Element, id: string, name: string | undefined, ids: IdSpace, warn: (m: string) => void): DocumentPage {
  const width = sizeOf(model, 'pageWidth');
  const height = sizeOf(model, 'pageHeight');
  return readPage(model, {
    id, ...(name !== undefined ? { name } : {}), ...(width !== undefined ? { width } : {}), ...(height !== undefined ? { height } : {}),
  }, ids, warn);
}

/**
 * Reads draw-style XML into a document: a page per `<diagram>`, or one for a
 * bare graph model. A page named `Page N` in the place N is read as unnamed,
 * since that is the name it is written with. Throws on text that is not
 * well-formed XML, on another root element, and on a page that holds no graph
 * model.
 */
export async function readDrawXml(text: string): Promise<ImportResult> {
  const root = parseXml(text, 'The file');
  const warnings = new Set<string>();
  const warn = (message: string): void => { warnings.add(message); };
  const ids: IdSpace = new Set();
  const pageIds: IdSpace = new Set();
  const pageId = (want: string | null, index: number): string => {
    let id = want ?? `page-${index + 1}`;
    for (let n = 2; pageIds.has(id); n++) id = `${want ?? 'page'}-${n}`;
    pageIds.add(id);
    return id;
  };
  const pages: DocumentPage[] = [];
  if (root.tagName === 'mxGraphModel') {
    pages.push(pageOf(root, pageId(null, 0), undefined, ids, warn));
  } else if (root.tagName === 'mxfile') {
    const diagrams = childElements(root).filter((c) => c.tagName === 'diagram');
    if (diagrams.length === 0) throw new Error('The file has no pages');
    for (const [i, diagram] of diagrams.entries()) {
      const given = diagram.getAttribute('name');
      const name = given === null || given === `Page ${i + 1}` ? undefined : given;
      const model = await modelOf(diagram, `"${given ?? i + 1}"`);
      pages.push(pageOf(model, pageId(diagram.getAttribute('id'), i), name, ids, warn));
    }
  } else {
    throw new Error(`A draw-style XML file has an mxfile or mxGraphModel root element, not <${root.tagName}>`);
  }
  return { document: { pages }, warnings: [...warnings] };
}
