/**
 * The ingest side of `svgNodesToKitDrafts`: parse dropped or pasted SVG files
 * and insert their node trees into a scene.
 */
import { parseSvg } from './parse';
import { scaleRuns, scaleStroke, scaleTextStyle } from './metricScale';
import { svgNodesToKitDrafts } from './unpack';
import {
  createInsertOp,
  dwarn,
  unionAABB,
  type IngestCtx,
  type Op,
  type Stroke,
  type StyledRun,
  type TextStyle,
} from '@weasel-js/core';
import type { SvgDraftPose } from './draftPose';

const CASCADE_OFFSET_PX = 24;
const VIEWPORT_FIT = 0.9;

/** `File.text()` via FileReader: jsdom ships `FileReader` but not `Blob.text`. */
function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Apply the fit-clamp scale to the lengths a leaf holds in data rather than
 * in its pose, which `place` does not reach: stroke width and dashes on any
 * leaf, and a text leaf's font size and letter spacing.
 */
function scaleLeafData(
  data: Record<string, unknown>,
  scale: number,
): Record<string, unknown> {
  if (scale === 1) return data;
  const out = { ...data };
  if (out.stroke) out.stroke = scaleStroke(out.stroke as Stroke, scale);
  if (typeof out.text === 'string') {
    out.style = scaleTextStyle(out.style as TextStyle | undefined, scale);
    if (out.runs) out.runs = scaleRuns(out.runs as StyledRun[], scale);
  }
  return out;
}

/**
 * Parse each file and insert its node tree, one undo step per file. Pass it
 * as `<SceneCanvas ingestion={{ svg: { unpack: unpackSvgFiles } }}>`.
 *
 * Each file is fit-clamped to 90% of the visible viewport and centered on the
 * drop point (or the viewport center), with later files cascading by a fixed
 * offset. A multi-root file is wrapped in one container so it arrives as a
 * single selectable unit. Content the file hides arrives hidden
 * (`SceneNode.hidden`) rather than being left out. A file that fails to parse, or parses to nothing,
 * is skipped with a `console.warn`.
 */
export async function unpackSvgFiles(files: File[], ctx: IngestCtx): Promise<void> {
  const layer = ((ctx.scene.layers[0]?.id as string | undefined) ?? 'default');
  let index = 0;
  for (const file of files) {
    try {
      const text = await readFileText(file);
      const parsed = parseSvg(text, { keepHidden: true });
      for (const w of parsed.warnings) dwarn('ingest', `svg "${file.name}":`, w);
      let drafts = svgNodesToKitDrafts(parsed, () => ctx.scene.mintId());
      if (drafts.length === 0) {
        console.warn(`weasel ingest: svg "${file.name}" parsed to no drawable nodes`);
        continue;
      }

      const roots = drafts.filter((d) => d.parentId === null);
      if (roots.length > 1) {
        const wrapperId = ctx.scene.mintId();
        const union = unionAABB(roots.map((d) => d.pose))!;
        drafts = [
          { kind: 'group' as const, id: wrapperId, parentId: null, pose: union, data: {} },
          ...drafts.map((d) => (d.parentId === null ? { ...d, parentId: wrapperId } : d)),
        ];
      }

      // Fit-clamp and center. Pose-only: the painter rebases stored geometry
      // into the pose box.

      const union = unionAABB(drafts.filter((d) => d.parentId === null).map((d) => d.pose))!;
      const view = ctx.viewportWorldRect();
      const scale = Math.min(
        1,
        union.width > 0 ? (view.width * VIEWPORT_FIT) / union.width : 1,
        union.height > 0 ? (view.height * VIEWPORT_FIT) / union.height : 1,
      );
      const target = ctx.point ?? {
        x: view.x + view.width / 2,
        y: view.y + view.height / 2,
      };
      const offset = index * CASCADE_OFFSET_PX;
      const cx = union.x + union.width / 2;
      const cy = union.y + union.height / 2;
      const place = (p: SvgDraftPose): SvgDraftPose => ({
        ...p,
        x: target.x + (p.x - cx) * scale + offset,
        y: target.y + (p.y - cy) * scale + offset,
        width: p.width * scale,
        height: p.height * scale,
      });

      const ops: Op[] = drafts.map((d) =>
        createInsertOp({
          node: {
            id: d.id,
            kind: d.kind,
            layer,
            pose: place(d.pose),
            data: d.kind === 'mark' ? scaleLeafData(d.data, scale) : d.data,
            parent: d.parentId,
            ...(d.clip ? { clip: d.clip } : {}),
            ...(d.hidden ? { hidden: true } : {}),
          } as unknown as { id: string },
          label: 'Insert SVG',
        }),
      );
      ctx.applyOps(ops, 'Insert SVG');
      index++;
    } catch (err) {
      console.warn(`weasel ingest: svg "${file.name}" failed to parse`, err);
    }
  }
}
