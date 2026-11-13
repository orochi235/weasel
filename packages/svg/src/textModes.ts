/**
 * How `serializeSvg` writes text (`SerializeOptions.text`): as live `<text>`,
 * as its glyph outlines, or as live text whose faces travel with the document
 * in `@font-face` rules.
 */
import {
  fittedTextPose, resolveRunFace, resolveTextStyle, TextOutlinesError, toRuns, type FontStyle,
} from '@weasel-js/core';
import { cachedFontVariant, outlineMetrics, type FaceEmbedding } from '@weasel-js/font';
import { svgTextOutlines } from './textOutlines';
import type { SvgNode, SvgTextMode, SvgTextNode } from './types';
import type { Warn } from './strokeAttrs';

/** A face text is set in: the one its runs resolve to. */
export interface TextFace {
  family: string;
  weight: number;
  style: FontStyle;
}

/** A face the document embeds, and the bytes it embeds. */
export interface EmbeddedFace extends TextFace {
  embedding: FaceEmbedding;
}

const faceKey = (f: TextFace): string => `${f.family}|${f.weight}|${f.style}`;

/** The face each of `node`'s runs is set in, as requested, deduplicated. */
export function requestedFaces(node: SvgTextNode): TextFace[] {
  const style = resolveTextStyle(node.style);
  const out = new Map<string, TextFace>();
  for (const run of toRuns(node.runs && node.runs.length > 0 ? node.runs : node.text)) {
    const f = resolveRunFace(run, style);
    const face = { family: f.fontFamily, weight: f.fontWeight, style: f.fontStyle };
    out.set(faceKey(face), face);
  }
  return [...out.values()];
}

/** The face a requested one renders in, and its embedding once its outlines have loaded. */
function embeddingOf(requested: TextFace): { face: TextFace; embedding: FaceEmbedding | null } {
  const face = cachedFontVariant(requested.family, requested.weight, requested.style).resolved;
  const outline = outlineMetrics(face.family, face.weight, face.style)
    ?? outlineMetrics(requested.family, requested.weight, requested.style);
  return { face, embedding: outline?.embedding?.() ?? null };
}

const faceName = (f: TextFace): string => `"${f.family}" ${f.weight} ${f.style}`;

/**
 * `nodes` with their text written as `mode` asks, and the faces an `'embed'`
 * document carries. A node that shrinks to fit is set at its fitted size in every mode. Under `'outline'` every text node is its outlines; under
 * `'embed'` a node set in a face that cannot be embedded is, and `warn` names
 * the face. A node whose outlines cannot be had stays live text, with a warning.
 */
export function withTextMode(
  nodes: readonly SvgNode[], mode: SvgTextMode, warn: Warn,
): { nodes: SvgNode[]; faces: EmbeddedFace[] } {
  const faces = new Map<string, EmbeddedFace>();

  const outlined = (node: SvgTextNode): SvgNode => {
    try {
      return svgTextOutlines(node);
    } catch (err) {
      if (!(err instanceof TextOutlinesError)) throw err;
      warn(`text set in a face with no outlines loaded is written as live text: ${err.message}`);
      return node;
    }
  };

  const embedded = (node: SvgTextNode): SvgNode => {
    const found = requestedFaces(node).map(embeddingOf);
    const missing = found.find((f) => !f.embedding?.embeddable);
    if (missing) {
      warn(missing.embedding
        ? `the face ${faceName(missing.face)} forbids embedding; text set in it is written as outlines`
        : `the face ${faceName(missing.face)} has no font file to embed; text set in it is written as outlines`);
      return outlined(node);
    }
    for (const { face, embedding } of found) faces.set(faceKey(face), { ...face, embedding: embedding! });
    // A reader sets text with no family in its own default face, never the embedded one.
    return node.style?.fontFamily ? node : { ...node, style: { ...node.style, fontFamily: resolveTextStyle(node.style).fontFamily } };
  };

  // Text written as outlines, which a text frame holding it is no longer one of.
  const lowered = new Set<SvgNode>();
  const walk = (list: readonly SvgNode[]): SvgNode[] => list.map((n): SvgNode => {
    if (n.kind === 'group') {
      const children = walk(n.children);
      if (!children.some((c) => lowered.has(c))) return { ...n, children };
      // Read back, a text frame is one text node; with its text outlined it is a group like any other.
      const { textFrame: _, ...rest } = n;
      const out = { ...rest, children };
      lowered.add(out);
      return out;
    }
    if (n.kind !== 'text') return n;
    const set = settled(n);
    const out = mode === 'outline' ? outlined(set) : mode === 'embed' ? embedded(set) : set;
    if (out.kind !== 'text') lowered.add(out);
    return out;
  });
  return { nodes: walk(nodes), faces: [...faces.values()] };
}

/** `node` with the sizes its `fit` resolves to written out, which `<text>`
 *  needs: a reader sets the text at the size its attributes state. */
function settled(node: SvgTextNode): SvgTextNode {
  if (node.fit !== 'shrink') return node;
  const { fit: _, ...plain } = node;
  const { style, runs } = fittedTextPose(node);
  return { ...plain, style, ...(runs ? { runs } : {}) };
}

/** One `@font-face` rule per face, each carrying its sfnt as a base64 data URL, in a `<style>`; `''` for none. */
export function fontFacesXml(faces: readonly EmbeddedFace[]): string {
  if (faces.length === 0) return '';
  const rules = faces.map((f) => {
    const cff = f.embedding.outlines === 'cff';
    const src = `url(data:font/${cff ? 'otf' : 'ttf'};base64,${base64(f.embedding.sfnt)}) format("${cff ? 'opentype' : 'truetype'}")`;
    return `@font-face{font-family:${cssString(f.family)};font-weight:${f.weight};font-style:${f.style};src:${src}}`;
  });
  return `<style>${rules.join('')}</style>`;
}

/** `s` as a double-quoted CSS string, safe inside XML character data. */
function cssString(s: string): string {
  const escaped = s.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[<&>]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `);
  return `"${escaped}"`;
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
