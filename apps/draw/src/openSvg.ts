import { type AddNodeSpec, pathEffectNode, registeredPathEffects } from '@weasel-js/core';
import { parseSvg, type ParseResult } from '@weasel-js/svg';
import { DEFAULT_BG_COLOR } from './docPersistence';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { reportSvgWarnings } from './fileNotices';
import type { PaperSizeKey } from './paperSizes';
import { leafOfObj } from './svgImport';
import { parsedToDoc, pickSvgFileNamed, type SceneDraft, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';

type OnWarn = (warning: ParseResult['warnings'][number]) => void;

/** The document-level state an opened file sets, beside the scene it filled. */
export interface OpenedSvg {
  filename: string;
  /** Absent when the file declares no size draw knows; the caller keeps its own. */
  paperSize?: PaperSizeKey;
  backgroundColor: string;
}

function parseDrafts(text: string, onWarn: OnWarn): { parsed: ParseResult; drafts: SceneDraft[] } {
  const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES, keepHidden: true });
  for (const w of parsed.warnings) onWarn(w);
  let seq = 0;
  return { parsed, drafts: svgNodesToSceneDrafts(parsed, () => `svg-${++seq}`) };
}

/**
 * Call inside a batch. Every draft's id is minted first, so an effect can name
 * sources that come after it. An effect whose sources the file does not hold,
 * or that the scene's registry cannot derive, opens as the paths it exported
 * as, and as nothing when it exported none; a live one leaves those paths out.
 */
function addDrafts(scene: DrawScene, drafts: readonly SceneDraft[]): void {
  const sceneIdOf = new Map(drafts.map((d) => [d.id, scene.mintId()]));
  const derivations = registeredPathEffects(scene.registry);
  const leaves = new Set(drafts.filter((d) => d.kind === 'mark').map((d) => d.id));
  const live = (d: SceneDraft) => derivations !== null && d.kind === 'effect' && d.dependsOn.every((s) => leaves.has(s));
  const skipped = new Set<string>();
  const parents = new Set(drafts.map((d) => d.parentId));
  for (const draft of drafts) {
    if (draft.parentId != null && skipped.has(draft.parentId)) {
      skipped.add(draft.id);
      continue;
    }
    const at = {
      id: sceneIdOf.get(draft.id)!,
      ...(draft.parentId != null ? { parent: sceneIdOf.get(draft.parentId)! } : {}),
      ...(draft.hidden ? { hidden: true } : {}),
    };
    if (draft.kind === 'effect' && live(draft)) {
      skipped.add(draft.id);
      const sources = draft.dependsOn.map((s) => sceneIdOf.get(s)!);
      scene.add({ ...pathEffectNode(draft.effect, sources, 'default', derivations!), ...at } as AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>);
      continue;
    }
    if (draft.kind === 'effect' && !parents.has(draft.id)) continue;
    const node = draft.kind === 'mark'
      ? { kind: 'mark' as const, ...leafOfObj(draft.obj) }
      : { kind: 'group' as const, pose: draft.pose, data: draft.data as WeaselDrawData };
    scene.add({ ...node, ...(draft.clip ? { clip: draft.clip } : {}), layer: 'default', ...at });
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
}

/**
 * Pick an SVG file and open it as the document, with a toast for what it
 * could not read. A canceled picker changes nothing.
 */
export async function openSvgFile(target: OpenSvgTarget): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked === null) return;
  const warnings: string[] = [];
  const opened = openSvgText(target.scene, picked.text, picked.name, (w) => warnings.push(w));
  reportSvgWarnings('Opened', warnings);
  target.setFilename(opened.filename);
  if (opened.paperSize) target.setPaperSize(opened.paperSize);
  target.setBackgroundColor(opened.backgroundColor);
}

/**
 * Pick an SVG file and add it to the document, with a toast for what it
 * could not read. A canceled picker changes nothing.
 */
export async function importSvgFile(scene: DrawScene): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked === null) return;
  const warnings: string[] = [];
  importSvgText(scene, picked.text, (w) => warnings.push(w));
  reportSvgWarnings('Imported', warnings);
}
