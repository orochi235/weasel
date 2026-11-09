import {
  type AddNodeSpec, type BooleanShapeOp, booleanGroupFields, localizeWorldPoses,
  addOnPages, pathEffectNode, registeredPathEffects,
} from '@weasel-js/core';
import { parseSvg, type ParseResult } from '@weasel-js/svg';
import { setBackground } from './docBackground';
import { DEFAULT_BG_COLOR } from './docPersistence';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { reportSvgUnreadable, reportSvgWarnings } from './fileNotices';
import { firstPageSize, onePage, replacePages } from './pages/drawPages';
import { leafOfObj } from './svgImport';
import type { Obj } from './svgObj';
import { parsedToDoc, pickSvgFileNamed, type SceneDraft, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';

type OnWarn = (warning: ParseResult['warnings'][number]) => void;

/** The document-level state an opened file sets outside the scene's history. */
export interface OpenedSvg {
  filename: string;
}

/** Thrown by Open and Import for text that is not an SVG document, before the scene is touched. */
export class UnreadableSvgError extends Error {}

function parseDrafts(text: string, onWarn: OnWarn): { parsed: ParseResult; drafts: SceneDraft[] } {
  const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES, keepHidden: true });
  if (parsed.error !== undefined) throw new UnreadableSvgError(parsed.error);
  for (const w of parsed.warnings) onWarn(w);
  let seq = 0;
  return { parsed, drafts: svgNodesToSceneDrafts(parsed, () => `svg-${++seq}`) };
}

/** A boolean group read back: the paint it was written in, its path left to the derivation. */
function booleanOfObj(obj: Obj, op: BooleanShapeOp) {
  const { pose, data: { path: _path, ...data } } = leafOfObj(obj);
  return { ...booleanGroupFields<WeaselDrawPose>(), pose, data: { ...data, boolean: op } };
}

/**
 * Call inside a batch. Every draft's id is minted first, so an effect can name
 * sources that come after it. Each root lands where the file put it in the
 * world (`addOnPages`): with `keepPages`, on the page the file saved it in,
 * and otherwise, or where the file names none, on the page holding it. An effect whose sources the
 * file does not hold, or that the scene's registry cannot derive, opens as
 * the paths it exported as, and as nothing when it exported none; a live one
 * leaves those paths out.
 */
function addDrafts(scene: DrawScene, drafts: readonly SceneDraft[], keepPages: boolean): void {
  type Spec = AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
  const sceneIdOf = new Map(drafts.map((d) => [d.id, scene.mintId()]));
  const derivations = registeredPathEffects(scene.registry);
  const leaves = new Set(drafts.filter((d) => d.kind === 'mark').map((d) => d.id));
  const live = (d: SceneDraft) => derivations !== null && d.kind === 'effect' && d.dependsOn.every((s) => leaves.has(s));
  const skipped = new Set<string>();
  const parents = new Set(drafts.map((d) => d.parentId));
  const specs: Spec[] = [];
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
      specs.push({ ...pathEffectNode(draft.effect, sources, 'default', derivations!), ...at } as Spec);
      continue;
    }
    if (draft.kind === 'effect' && !parents.has(draft.id)) continue;
    const node = draft.kind === 'mark'
      ? { kind: 'mark' as const, ...(draft.boolean ? booleanOfObj(draft.obj, draft.boolean) : leafOfObj(draft.obj)) }
      : { kind: 'group' as const, pose: draft.pose, data: draft.data as WeaselDrawData };
    specs.push({ ...node, ...(draft.clip ? { clip: draft.clip } : {}), layer: 'default', ...at });
  }
  const pageOf = new Map(keepPages ? drafts.flatMap((d) => (d.page === undefined ? [] : [[sceneIdOf.get(d.id)!, d.page]])) : []);
  // A file's geometry is world; each pose is stored in its container's frame.
  addOnPages(scene, localizeWorldPoses(specs, scene.composition), { pageOf: (id) => pageOf.get(id) });
}

/**
 * Open an SVG file as the document: the scene's nodes are removed and the
 * file's take their place, and the background becomes the file's, or white
 * when it has none, in one undo entry. The document takes the file's
 * name, which undo leaves, and the pages it
 * lists; a file listing none is one page of the paper size it declares, or of
 * the document's first page's size when it declares none. `beforeReplace` runs
 * once the file has been read, just before the document is replaced. Text that
 * is not an SVG document throws `UnreadableSvgError` with the document untouched.
 */
export function openSvgText(
  scene: DrawScene,
  text: string,
  fileName: string,
  onWarn: OnWarn = () => {},
  beforeReplace: () => void = () => {},
): OpenedSvg {
  const { parsed, drafts } = parseDrafts(text, onWarn);
  const doc = parsedToDoc(parsed);
  const pages = doc.pages ? { pages: doc.pages } : onePage(firstPageSize(scene));
  beforeReplace();
  scene.batch('Open', () => {
    replacePages(scene, pages);
    addDrafts(scene, drafts, true);
    setBackground(scene, doc.backgroundColor ?? DEFAULT_BG_COLOR);
  });
  return { filename: fileName };
}

/**
 * Add an SVG file's nodes on top of the document's own, in one undo entry.
 * The document keeps its name, pages, and background. Text that is not an SVG
 * document throws `UnreadableSvgError` and adds nothing.
 */
export function importSvgText(scene: DrawScene, text: string, onWarn: OnWarn = () => {}): void {
  const { drafts } = parseDrafts(text, onWarn);
  scene.batch('Import SVG', () => addDrafts(scene, drafts, false));
}

/** Where an opened file lands: the scene, and the document state beside it. */
export interface OpenSvgTarget {
  scene: DrawScene;
  setFilename(name: string): void;
  /** Fit the view to the document's first page, once it has been replaced. */
  showFirstPage(): void;
  /** Leave the open mode before the document is replaced, so its session closes on the old one. */
  leaveMode(): void;
}

/** Whether `read` read the file `name`; when it was not an SVG document, a toast says so. */
function readOrReport(did: 'opened' | 'imported', name: string, read: () => void): boolean {
  try {
    read();
    return true;
  } catch (err) {
    if (!(err instanceof UnreadableSvgError)) throw err;
    reportSvgUnreadable(did, name, err.message);
    return false;
  }
}

/**
 * Pick an SVG file and open it as the document, with a toast for what it
 * could not read. A canceled picker, or a file that is not an SVG document, changes nothing.
 */
export async function openSvgFile(target: OpenSvgTarget): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked === null) return;
  const warnings: string[] = [];
  const read = readOrReport('opened', picked.name, () => {
    openSvgText(target.scene, picked.text, picked.name, (w) => warnings.push(w), () => target.leaveMode());
  });
  if (!read) return;
  reportSvgWarnings('Opened', warnings);
  target.setFilename(picked.name);
  target.showFirstPage();
}

/**
 * Pick an SVG file and add it to the document, with a toast for what it
 * could not read. A canceled picker, or a file that is not an SVG document, changes nothing.
 */
export async function importSvgFile(scene: DrawScene): Promise<void> {
  const picked = await pickSvgFileNamed();
  if (picked === null) return;
  const warnings: string[] = [];
  if (!readOrReport('imported', picked.name, () => importSvgText(scene, picked.text, (w) => warnings.push(w)))) return;
  reportSvgWarnings('Imported', warnings);
}
