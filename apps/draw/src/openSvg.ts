import type { NodeId, Scene } from '@weasel-js/core';
import { parseSvg, type ParseResult } from '@weasel-js/svg';
import { DEFAULT_BG_COLOR } from './docPersistence';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import type { PaperSizeKey } from './paperSizes';
import { leafOfObj } from './svgImport';
import { parsedToDoc, pickSvgFileNamed, type SceneDraft, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';

type DrawScene = Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
type OnWarn = (warning: ParseResult['warnings'][number]) => void;

/** The document-level state an opened file sets, beside the scene it filled. */
export interface OpenedSvg {
  filename: string;
  /** Absent when the file declares no size draw knows; the caller keeps its own. */
  paperSize?: PaperSizeKey;
  backgroundColor: string;
}

function parseDrafts(text: string, onWarn: OnWarn): { parsed: ParseResult; drafts: SceneDraft[] } {
  const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
  for (const w of parsed.warnings) onWarn(w);
  let seq = 0;
  return { parsed, drafts: svgNodesToSceneDrafts(parsed, () => `svg-${++seq}`) };
}

/** Call inside a batch. Drafts arrive parent-before-child, so a draft's parent is already mapped. */
function addDrafts(scene: DrawScene, drafts: readonly SceneDraft[]): void {
  const sceneIdOf = new Map<string, NodeId>();
  for (const draft of drafts) {
    const parent = draft.parentId != null ? sceneIdOf.get(draft.parentId) : undefined;
    const node = draft.kind === 'container'
      ? { kind: 'container' as const, pose: draft.pose, data: draft.data }
      : { kind: 'leaf' as const, ...leafOfObj(draft.obj) };
    sceneIdOf.set(draft.id, scene.add({ ...node, layer: 'default', ...(parent != null ? { parent } : {}) }));
  }
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
  onWarn: OnWarn = () => {},
): OpenedSvg {
  const { parsed, drafts } = parseDrafts(text, onWarn);
  const doc = parsedToDoc(parsed);
  scene.batch('Open', () => {
    scene.removeMany([...scene.renderOrder()]);
    addDrafts(scene, drafts);
  });
  return {
    filename: fileName,
    ...(doc.paperSize ? { paperSize: doc.paperSize } : {}),
    backgroundColor: doc.backgroundColor ?? DEFAULT_BG_COLOR,
  };
}

/**
 * Add an SVG file's nodes on top of the document's own, in one undo entry.
 * The document keeps its name, paper size, and background.
 */
export function importSvgText(scene: DrawScene, text: string, onWarn: OnWarn = () => {}): void {
  const { drafts } = parseDrafts(text, onWarn);
  scene.batch('Import SVG', () => addDrafts(scene, drafts));
}

/** Where an opened file lands: the scene, and the document state beside it. */
export interface OpenSvgTarget {
  scene: DrawScene;
  setFilename(name: string): void;
  setPaperSize(size: PaperSizeKey): void;
  setBackgroundColor(color: string): void;
  /** Journals cached for the old document's nodes must not outlive it. */
  onClearJournalCache(): void;
}

/** Pick an SVG file and open it as the document. A canceled picker changes nothing. */
export async function openSvgFile(target: OpenSvgTarget, onWarn?: OnWarn): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked === null) return;
  target.onClearJournalCache();
  const opened = openSvgText(target.scene, picked.text, picked.name, onWarn);
  target.setFilename(opened.filename);
  if (opened.paperSize) target.setPaperSize(opened.paperSize);
  target.setBackgroundColor(opened.backgroundColor);
}

/** Pick an SVG file and add it to the document. A canceled picker changes nothing. */
export async function importSvgFile(scene: DrawScene, onWarn?: OnWarn): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked !== null) importSvgText(scene, picked.text, onWarn);
}
