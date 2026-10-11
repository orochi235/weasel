/** Top action bar for WeaselDraw — buttons that aren't tools.
 *
 *  Every editing command (history, clipboard, reorder, group, align,
 *  distribute, flip, booleans, create outlines) is a kit action, rendered by
 *  the kit's `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills,
 *  glyphs included. The buttons built here are the app's own: file, view toggles,
 *  preferences. */
import {
  ActionBar as KitActionBar,
  Button,
  ButtonBar,
  GridIcon,
  MenuButton,
  SnapIcon,
  ToggleBar,
  formatShortcut,
} from '@weasel-js/ui';

/** Paper-size keys; `PAPER_PRESETS` in `docPersistence.ts` holds the dimensions. */
export type PaperSizeKey = 'letter' | 'a4' | 'legal';
import {
  ReleaseCompoundIcon,
  SettingsIcon,
} from './actionIcons';

export interface CommandBarProps {
  // File I/O — SVG round-trip via @weasel-js/svg.
  onSaveSvg(): void;
  onOpenSvg(): void;
  /** Start a fresh document at the picked paper size. Removing the old nodes
   *  is one undoable entry; the view refits only when the paper size changes. */
  onNew(size: PaperSizeKey): void;
  // View toggles
  gridVisible: boolean;
  onToggleGrid(): void;
  snapToGrid: boolean;
  onToggleSnap(): void;
  // Release compound path — split a multi-region polygon into its subpaths.
  canReleaseCompound: boolean;
  onReleaseCompound(): void;
  // Preferences modal
  onOpenPrefs(): void;
}

const PAPER_ITEMS: ReadonlyArray<{ value: PaperSizeKey; label: string }> = [
  { value: 'letter', label: 'US Letter' },
  { value: 'a4', label: 'A4' },
  { value: 'legal', label: 'Legal' },
];

const KIT_GROUPS = [
  'history', 'clipboard', 'edit', 'reorder', 'structure', 'align', 'distribute', 'flip',
] as const;

type ViewToggle = 'grid' | 'snap';

const VIEW_TOGGLES = [
  { value: 'grid', label: <GridIcon />, ariaLabel: 'Show grid', shortcut: formatShortcut({ key: '3', shift: true }) },
  { value: 'snap', label: <SnapIcon />, ariaLabel: 'Snap to grid' },
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
  const viewValue: ViewToggle[] = [
    ...(p.gridVisible ? ['grid' as const] : []),
    ...(p.snapToGrid ? ['snap' as const] : []),
  ];
  return (
    <div className="wd-commandbar" role="toolbar" aria-label="Actions">
      <div className="wd-commandbar-group">
        <MenuButton label="New" tooltip="New document" items={PAPER_ITEMS} onAction={p.onNew} />
        <ButtonBar
          ariaLabel="File"
          size="sm"
          variant="minimal"
          items={[
            { value: 'open', label: 'Open', onAction: p.onOpenSvg, tooltip: 'Open SVG…' },
            { value: 'save', label: 'Save', onAction: p.onSaveSvg, tooltip: 'Save as SVG' },
          ]}
        />
      </div>
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} />)}
      <ToggleBar
        mode="multiple"
        ariaLabel="View"
        items={VIEW_TOGGLES}
        value={viewValue}
        onChange={(next) => {
          if (next.includes('grid') !== p.gridVisible) p.onToggleGrid();
          if (next.includes('snap') !== p.snapToGrid) p.onToggleSnap();
        }}
      />
      <KitActionBar group="pathfinder" />
      <KitActionBar group="text" />
      <Button
        variant="ghost"
        iconOnly
        ariaLabel="Release compound path"
        shortcut={formatShortcut({ key: '|', shift: true })}
        onClick={p.onReleaseCompound}
        disabled={!p.canReleaseCompound}
      >
        <ReleaseCompoundIcon />
      </Button>
      <div className="wd-commandbar-spacer" />
      <div className="wd-commandbar-group">
        <MenuButton label="Debug" tooltip="Debug surfaces" items={DEBUG_ROUTES} onAction={openDebugRoute} />
      </div>
      <Button
        variant="ghost"
        iconOnly
        ariaLabel="Preferences"
        shortcut={formatShortcut({ key: ',', mod: true })}
        onClick={p.onOpenPrefs}
      >
        <SettingsIcon />
      </Button>
    </div>
  );
}
