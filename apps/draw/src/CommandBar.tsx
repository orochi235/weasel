/** Top action bar for WeaselDraw — buttons that aren't tools.
 *
 *  Every editing command (history, clipboard, reorder, group, align,
 *  distribute, flip, booleans, create outlines) is a kit action, rendered by
 *  the kit's `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills,
 *  glyphs included. The app's own view toggles, Release compound path, and
 *  Preferences are actions too (`appCommands`), as are Record and Play
 *  (`recording`), so a button's shortcut is the binding that fires it. The buttons built here are the file ones. */
import { ActionBar as KitActionBar, ButtonBar, MenuButton } from '@weasel-js/ui';
import { PAPER_OPTIONS, type PaperSizeKey } from './paperSizes';

export type { PaperSizeKey };

export interface CommandBarProps {
  // File I/O — SVG round-trip via @weasel-js/svg.
  onSaveSvg(): void;
  /** Replace the document with a picked file. */
  onOpenSvg(): void;
  /** Add a picked file to the document. */
  onImportSvg(): void;
  /** Start a fresh document at the picked paper size. Removing the old nodes
   *  is one undoable entry; the view refits only when the paper size changes. */
  onNew(size: PaperSizeKey): void;
}

const KIT_GROUPS = [
  'history', 'clipboard', 'edit', 'reorder', 'structure', 'align', 'distribute', 'flip',
] as const;

/** The in-repo dev surfaces, hash-routed in main.tsx; each opens in a new tab. */
const DEBUG_ROUTES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#/dev/toolkits', label: 'Toolkit Builder' },
  { value: '#/dev/registry', label: 'Bundle Inspector' },
  { value: '#/dev/prefs', label: 'Prefs Schema' },
];

function openDebugRoute(hash: string) {
  window.open(`${window.location.pathname}${window.location.search}${hash}`, '_blank', 'noopener');
}

export function CommandBar(p: CommandBarProps) {
  return (
    <div className="wd-commandbar" role="toolbar" aria-label="Actions">
      <div className="wd-commandbar-group">
        <MenuButton label="New" tooltip="New document" items={PAPER_OPTIONS} onAction={p.onNew} />
        <ButtonBar
          ariaLabel="File"
          size="sm"
          variant="minimal"
          items={[
            { value: 'open', label: 'Open', onAction: p.onOpenSvg, tooltip: 'Open SVG…' },
            { value: 'import', label: 'Import', onAction: p.onImportSvg, tooltip: 'Add an SVG to this document…' },
            { value: 'save', label: 'Save', onAction: p.onSaveSvg, tooltip: 'Save as SVG' },
          ]}
        />
      </div>
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} />)}
      <KitActionBar group="view" />
      <KitActionBar group="pathfinder" />
      <KitActionBar group="text" />
      <KitActionBar group="compound" />
      <div className="wd-commandbar-spacer" />
      <KitActionBar group="record" />
      <div className="wd-commandbar-group">
        <MenuButton label="Debug" tooltip="Debug surfaces" items={DEBUG_ROUTES} onAction={openDebugRoute} />
      </div>
      <KitActionBar group="app" />
    </div>
  );
}
