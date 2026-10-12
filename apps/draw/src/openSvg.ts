import type { NodeId, Scene } from '@weasel-js/core';
import { parseSvg, type ParseResult } from '@weasel-js/svg';
import { DEFAULT_BG_COLOR } from './docPersistence';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import type { PaperSizeKey } from './paperSizes';
import { leafOfObj } from './svgImport';
import { parsedToDoc, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';

type DrawScene = Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

/** The document-level state an opened file sets, beside the scene it filled. */
export interface OpenedSvg {
  filename: string;
  /** Absent when the file declares no size draw knows; the caller keeps its own. */
  paperSize?: PaperSizeKey;
  backgroundColor: string;
}

/**
 * Open an SVG file as the document: the scene's nodes are removed and the
 * file's take their place, in one undo entry. The document takes the file's
 * name and its background, or white when it has none.
 */
export function openSvgText(
  scene: DrawScene,
  text: string,
  fileName: string,
  onWarn: (warning: ParseResult['warnings'][number]) => void = () => {},
): OpenedSvg {
  const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
  for (const w of parsed.warnings) onWarn(w);
  const doc = parsedToDoc(parsed);
  let seq = 0;
  const drafts = svgNodesToSceneDrafts(parsed, () => `svg-${++seq}`);
  scene.batch('Open', () => {
    scene.removeMany([...scene.renderOrder()]);
    // Drafts arrive parent-before-child, so a draft's parent is already mapped.
    const sceneIdOf = new Map<string, NodeId>();
    for (const draft of drafts) {
      const parent = draft.parentId != null ? sceneIdOf.get(draft.parentId) : undefined;
      const node = draft.kind === 'container'
        ? { kind: 'container' as const, pose: draft.pose, data: {} }
        : { kind: 'leaf' as const, ...leafOfObj(draft.obj) };
      sceneIdOf.set(draft.id, scene.add({ ...node, layer: 'default', ...(parent != null ? { parent } : {}) }));
    }
  });
  return {
    filename: fileName,
    ...(doc.paperSize ? { paperSize: doc.paperSize } : {}),
    backgroundColor: doc.backgroundColor ?? DEFAULT_BG_COLOR,
  };
}
