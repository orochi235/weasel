/** What a headless render or an export draws short of what it was asked for, and why. */
import type { DrawCommand } from '@weasel-js/renderer';
import { getProgramSource, imageStatus, isPaintKindKnown } from '@weasel-js/renderer';
import { renderNeeds } from './renderNeeds';

/**
 * What a render lost: a picture that did not load (`image`), a face that did
 * not (`font`), a paint kind nothing registered or that failed to load
 * (`paint-kind`), a shader program with no source the target draws
 * (`shader`), or anything else a format cannot hold (`unsupported`).
 */
export type RenderDiagnosticKind = 'image' | 'font' | 'paint-kind' | 'shader' | 'unsupported';

/** One thing a render drew without, or drew in part. */
export interface RenderDiagnostic {
  readonly kind: RenderDiagnosticKind;
  /** What it names: the picture's source, the font family, the paint kind's or program's id, or what a format could not hold. */
  readonly subject: string;
  /** A sentence saying what was left out, for a person to read. */
  readonly message: string;
}

/** Hears each {@link RenderDiagnostic} as it is found. */
export type RenderDiagnosticSink = (diagnostic: RenderDiagnostic) => void;

/** The diagnostic for a picture at `src` that did not load. */
export const imageDiagnostic = (src: string): RenderDiagnostic =>
  ({ kind: 'image', subject: src, message: `the picture ${src} did not load; it is drawn as a placeholder` });

/**
 * Report what `commands` will draw without when a WebGL2 renderer draws them:
 * each paint kind nothing registered or loads, each image pattern and each of
 * `images`, the pictures building them asked for, that failed to load, and
 * each shader program with no GLSL source.
 */
export function reportCommandLosses(commands: readonly DrawCommand[], images: readonly string[], report: RenderDiagnosticSink): void {
  const needs = renderNeeds(commands);
  for (const kind of needs.paintKinds) {
    if (!isPaintKindKnown(kind)) {
      report({ kind: 'paint-kind', subject: kind, message: `no paint kind "${kind}" is registered; what it paints is left out` });
    }
  }
  for (const src of new Set([...(needs.images ?? []), ...images])) {
    if (imageStatus(src) === 'error') report(imageDiagnostic(src));
  }
  for (const id of shaderPrograms(commands)) {
    if (!getProgramSource(id)?.glsl) {
      report({ kind: 'shader', subject: id, message: `the shader program "${id}" has no GLSL source; what it draws is left out` });
    }
  }
}

function shaderPrograms(commands: readonly DrawCommand[], out = new Set<string>()): Set<string> {
  for (const c of commands) {
    if (c.kind === 'group') shaderPrograms(c.children, out);
    else if (c.kind === 'shader') out.add(c.program.id);
  }
  return out;
}

/** Wait for each of `loads`, reporting the ones that fail through `diagnose` rather than failing. */
export async function settleReporting<T>(
  items: readonly T[], load: (item: T) => Promise<unknown>, diagnose: (item: T, err: unknown) => RenderDiagnostic, report: RenderDiagnosticSink,
): Promise<void> {
  const results = await Promise.allSettled(items.map(load));
  results.forEach((r, i) => { if (r.status === 'rejected') report(diagnose(items[i]!, r.reason)); });
}
