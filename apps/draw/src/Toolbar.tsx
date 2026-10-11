import {
  asNodeId,
  buildWeaselClipboardText,
  type ClipboardDep,
  type ClipboardSnapshot,
  type NodeId,
  useClipboardOps,
  useDepSource,
  useScene,
  useSceneAdapter,
  useSelection,
  WEASEL_CLIPBOARD_MIME
} from '@weasel-js/core';
import { parseSvg } from '@weasel-js/svg';
import {
  type ReactElement,
  useCallback,
  useMemo,
  useState
} from 'react';
import { CommandBar, type PaperSizeKey } from './CommandBar';
import { DEFAULT_FILENAME, PAPER_PRESETS } from './docPersistence';
import { DRAW_POSE_COMPOSITION, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { serializeReplacer } from './persistence';
import { clipboardSnapshotRootIds, sceneToSvgString, selectionToClipboardSvgString } from './svgExport';
import { leafOfObj } from './svgImport';
import { downloadSvg, parsedToDoc, pickSvgFile, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';

// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────

export interface ToolbarProps {
  scene: ReturnType<typeof useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>>;
  selection: ReturnType<typeof useSelection>;
  paperSize: PaperSizeKey;
  setPaperSize: (k: PaperSizeKey) => void;
  filename: string;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  /** Called at the start of every explicit save/load so stale journal
   *  caches don't survive across document boundaries. */
  onClearJournalCache: () => void;
}

export function Toolbar({
  scene, selection,
  paperSize, setPaperSize,
  filename, backgroundColor, setBackgroundColor,
  onClearJournalCache,
}: ToolbarProps): ReactElement {
  const adapter = useSceneAdapter(scene, {});
  // Only its setter is read: a copy re-renders the bar so Paste re-evaluates.
  const [, setClipboardEmpty] = useState(true);
  // `snapshot.items` are adapter-shaped copies (`sceneAdapter.snapshotSelection`),
  // not live scene nodes — but their `id`s are the ORIGINAL scene ids at copy
  // time, and `produceFlavors` runs synchronously inside `clipboard.copy()`,
  // so walking the live `scene` by those ids here is correct: nothing has
  // had a chance to mutate the scene in between. Only the serialization
  // waits, on paint kinds that load on demand; the walk has already run. (Verified: `sceneToSvgNodes`
  // skips ids it can't resolve — `kindOf`/`objOf` both fall through to
  // "not found" — rather than throwing, so no id-existence filter is needed
  // even in the shouldn't-happen case.)
  const produceFlavors = useCallback((snapshot: ClipboardSnapshot) => {
    const json = buildWeaselClipboardText(snapshot.items, serializeReplacer);
    const roots = clipboardSnapshotRootIds(
      snapshot.items as Array<{ id: string; parent: string | null }>,
    );
    // The SVG flavors carry `json` embedded in <metadata> too: Chromium's
    // DOM paste event exposes ONLY text/plain, so this is what preserves
    // full fidelity (labels, typed data) on a draw→draw paste.
    const svg = selectionToClipboardSvgString(scene, roots, json, DRAW_POSE_COMPOSITION);
    return {
      [WEASEL_CLIPBOARD_MIME]: json,
      'image/svg+xml': svg,
      // External design tools sniff text/plain for SVG markup (<metadata>
      // is legal SVG 1.1, ignored by their parsers); the JSON also rides
      // the custom MIME (and cross-tab clipboardData) for lossless paths.
      'text/plain': svg,
    };
  }, [scene]);
  const clipboard = useClipboardOps(adapter, {
    getSelection: () => selection.current as NodeId[],
    onPaste: (ids) => selection.set(ids.map(asNodeId)),
    produceFlavors,
    jsonReplacer: serializeReplacer,
  });
  // Published as the `clipboard` dep so Cmd+C / Cmd+X reach the same object
  // the buttons do — `copy` is wrapped rather than passed raw so the Paste
  // button's enabled state updates on the keyboard route too.
  const clipboardDep = useMemo<ClipboardDep>(() => ({
    copy: () => {
      clipboard.copy();
      setClipboardEmpty(clipboard.isEmpty());
    },
    paste: clipboard.paste,
    isEmpty: clipboard.isEmpty,
  }), [clipboard]);
  useDepSource('clipboard', () => clipboardDep);

  return (
    <>
      <CommandBar
        onSaveSvg={() => {
          onClearJournalCache();
          const paper = PAPER_PRESETS[paperSize];
          const safe = filename.trim() || DEFAULT_FILENAME;
          void sceneToSvgString(scene, {
            filename,
            paperSize,
            paperWidth: paper.width,
            paperHeight: paper.height,
            backgroundColor,
            onWarn: (w) => console.warn('[svg export]', w),
            poseComposition: DRAW_POSE_COMPOSITION,
          }).then((svg) => downloadSvg(svg, /\.svg$/i.test(safe) ? safe : `${safe}.svg`));
        }}
        onOpenSvg={() => {
          // Pop the file picker, parse the chosen SVG, lower its nodes back
          // into the scene-graph. Leaves become `kind: 'leaf'`; SVG groups
          // become `kind: 'container'` and members are reparented under them
          // (nested groups supported — outer groups process after their
          // inner groups are resolved).
          void (async () => {
            const text = await pickSvgFile();
            if (text === null) return;
            onClearJournalCache();
            const parsed = parseSvg(text, { namespaces: SWILL_NAMESPACES });
            for (const w of parsed.warnings) console.warn('[svg import]', w);
            const docPatch = parsedToDoc(parsed);
            if (docPatch.paperSize) setPaperSize(docPatch.paperSize);
            if (docPatch.backgroundColor) setBackgroundColor(docPatch.backgroundColor);
            let seq = 0;
            const drafts = svgNodesToSceneDrafts(parsed, () => `svg-${++seq}`);
            scene.batch('Import SVG', () => {
              // Drafts arrive parent-before-child, so each draft's `parentId`
              // (when set) has already been inserted and mapped. Map the
              // draft's stable id → minted scene NodeId so children resolve
              // their parent.
              const idMap = new Map<string, ReturnType<typeof asNodeId>>();
              for (const draft of drafts) {
                const parent = draft.parentId != null ? idMap.get(draft.parentId) : undefined;
                if (draft.kind === 'container') {
                  // Container pose = AABB of descendants (computed by the
                  // importer), matching the kit `group` action's convention.
                  const sceneId = scene.add({
                    kind: 'container',
                    layer: 'default',
                    pose: draft.pose,
                    data: {},
                    ...(parent != null ? { parent } : {}),
                  });
                  idMap.set(draft.id, sceneId);
                  continue;
                }
                const sceneId = scene.add({
                  kind: 'leaf',
                  layer: 'default',
                  ...leafOfObj(draft.obj),
                  ...(parent != null ? { parent } : {}),
                });
                idMap.set(draft.id, sceneId);
              }
            });
          })();
        }}
        onNew={(size) => {
          setPaperSize(size);
          // The batch is what names the entry and captures the prior selection.
          scene.batch('New document', () => {
            scene.removeMany([...scene.renderOrder()]);
          });
        }}
      />
    </>
  );
}
