import {
  asNodeId,
  buildWeaselClipboardText,
  type ClipboardDep,
  type ClipboardSnapshot,
  type NodeId,
  useClipboardOps,
  useDepSource,
  useOptionalDepRegistry,
  useSceneAdapter,
  type SelectionApi,
  WEASEL_CLIPBOARD_MIME
} from '@weasel-js/core';
import type { CornerControlsSelection } from '@weasel-js/path-tools';
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useState
} from 'react';
import { CommandBar } from './CommandBar';
import type { DrawScene } from './drawDocument';
import { useDebugCommands } from './dev/devRoutes';
import { useFileCommands } from './fileCommands';
import type { PaperSizeKey } from './paperSizes';
import { reportPasteOmissions } from './pasteOmissions';
import { serializeReplacer } from '@editor/index';
import { clipboardSnapshotRootIds, selectionToClipboardSvgString } from './svgExport';

// ─── Right sidebar: LayerList + SelectionPanel ──────────────────────────────

export interface ToolbarProps {
  scene: DrawScene;
  selection: SelectionApi;
  paperSize: PaperSizeKey;
  setPaperSize: (k: PaperSizeKey) => void;
  filename: string;
  setFilename: (name: string) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  /** The open path and its selected anchors, for the Corner shape controls. */
  cornerSelection?: CornerControlsSelection;
  /** The menu bar, drawn first in the row. */
  menus?: ReactNode;
}

export function Toolbar({
  scene, selection,
  paperSize, setPaperSize,
  filename, setFilename, backgroundColor, setBackgroundColor, cornerSelection, menus,
}: ToolbarProps): ReactElement {
  // A paste lands where a draw would: in the entered group, say.
  const deps = useOptionalDepRegistry();
  const pasteInto = useCallback(() => deps?.get('insertInto')?.get() ?? null, [deps]);
  const adapter = useSceneAdapter(scene, { pasteInto });
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
    const svg = selectionToClipboardSvgString(scene, roots, json);
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
    onPasteOmitted: reportPasteOmissions,
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
  useDebugCommands();
  useFileCommands({ scene, filename, paperSize, backgroundColor, setFilename, setPaperSize, setBackgroundColor });

  return (
    <>
      <CommandBar
        menus={menus}
        {...(cornerSelection ? { corners: { scene, selection: cornerSelection } } : {})}
      />
    </>
  );
}
