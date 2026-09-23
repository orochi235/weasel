/** Top action bar for WeaselDraw — buttons that aren't tools.
 *
 *  Every editing command (history, clipboard, reorder, group, align,
 *  distribute, flip, booleans) is a kit action, rendered by the kit's
 *  `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills; this file
 *  only supplies draw's glyphs for the ones the kit ships without. The
 *  buttons built here are the app's own: file, view toggles, recording,
 *  preferences. */
import { useRef, type ReactNode } from 'react';
import {
  ActionBar as KitActionBar,
  Button,
  ButtonBar,
  DeleteIcon,
  GridIcon,
  MenuButton,
  PlayIcon,
  RedoIcon,
  Select,
  SnapIcon,
  ToggleBar,
  UndoIcon,
  formatShortcut,
} from '@weasel-js/ui';

/** Paper-size keys mirrored from App.tsx's `PAPER_PRESETS` map. Kept as a
 *  bare string union here so this component stays decoupled from the
 *  preset table (the parent picks the dimensions per key). */
export type PaperSizeKey = 'letter' | 'a4' | 'legal';
import {
  FlipXIcon,
  FlipYIcon,
  GroupIcon,
  UngroupIcon,
  SendToBackIcon,
  SendBackwardIcon,
  BringForwardIcon,
  BringToFrontIcon,
  CutIcon,
  CopyIcon,
  PasteIcon,
  DuplicateIcon,
  ReleaseCompoundIcon,
  SettingsIcon,
  RecordIcon,
} from './actionIcons';
import type { Recording, RecordingProfile } from './recorder';
import { deserializeRecording } from './recordingIO';

export interface ActionBarProps {
  // File I/O — SVG round-trip via @weasel-js/svg.
  onSaveSvg(): void;
  onOpenSvg(): void;
  /** Start a fresh document at the picked paper size. Clears the scene,
   *  resets undo history, and re-centers the view. */
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
  // Record / Replay — toggles capture of pointer/keyboard input, and
  // loads a previously-recorded JSON file for replay.
  recording: boolean;
  onToggleRecord(): void;
  /** Current sampling profile for the next recording. Changes are
   *  disabled while a recording is in flight. */
  recordingProfile: RecordingProfile;
  onChangeRecordingProfile(p: RecordingProfile): void;
  onPlay(rec: Recording): void;
}

const PAPER_ITEMS: ReadonlyArray<{ value: PaperSizeKey; label: string }> = [
  { value: 'letter', label: 'US Letter' },
  { value: 'a4', label: 'A4' },
  { value: 'legal', label: 'Legal' },
];

/** Draw's glyphs for kit actions that ship without one, keyed by
 *  `ActionItem.key`. Align and distribute use the kit's own. */
const KIT_ICONS: Record<string, ReactNode> = {
  'undo': <UndoIcon />,
  'redo': <RedoIcon />,
  'clipboard.cut': <CutIcon />,
  'clipboard.copy': <CopyIcon />,
  'clipboard.paste': <PasteIcon />,
  'duplicate': <DuplicateIcon />,
  'delete': <DeleteIcon />,
  'reorder.forward:adjacent': <BringForwardIcon />,
  'reorder.forward:extreme': <BringToFrontIcon />,
  'reorder.backward:adjacent': <SendBackwardIcon />,
  'reorder.backward:extreme': <SendToBackIcon />,
  'group': <GroupIcon />,
  'ungroup': <UngroupIcon />,
  'flip:x': <FlipXIcon />,
  'flip:y': <FlipYIcon />,
};

const KIT_GROUPS = [
  'history', 'clipboard', 'edit', 'reorder', 'structure', 'align', 'distribute', 'flip',
] as const;

type ViewToggle = 'grid' | 'snap';

const VIEW_TOGGLES = [
  { value: 'grid', label: <GridIcon />, ariaLabel: 'Show grid', shortcut: formatShortcut({ key: '3', shift: true }) },
  { value: 'snap', label: <SnapIcon />, ariaLabel: 'Snap to grid' },
] as const;

const RECORDING_PROFILES: ReadonlyArray<{ value: RecordingProfile; label: string }> = [
  { value: 'gesture-only', label: 'Gesture-only' },
  { value: 'full', label: 'Full fidelity' },
  { value: 'events-only', label: 'Events-only' },
];

/** The in-repo dev surfaces, hash-routed in main.tsx; each opens in a new tab. */
const DEBUG_ROUTES: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#/dev/toolkits', label: 'Toolkit Builder' },
  { value: '#/dev/registry', label: 'Bundle Inspector' },
];

function openDebugRoute(hash: string) {
  window.open(`${window.location.pathname}${window.location.search}${hash}`, '_blank', 'noopener');
}

export function ActionBar(p: ActionBarProps) {
  const viewValue: ViewToggle[] = [
    ...(p.gridVisible ? ['grid' as const] : []),
    ...(p.snapToGrid ? ['snap' as const] : []),
  ];
  return (
    <div className="wd-actionbar" role="toolbar" aria-label="Actions">
      <div className="wd-actionbar-group">
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
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} icons={KIT_ICONS} />)}
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
      <div className="wd-actionbar-spacer" />
      <div className="wd-actionbar-group">
        <Button
          variant="ghost"
          iconOnly
          ariaLabel="Record input"
          shortcut="F9"
          pressed={p.recording}
          onClick={p.onToggleRecord}
        >
          <RecordIcon active={p.recording} />
        </Button>
        {/* The profile is captured at `start()`, so it can't change mid-recording. */}
        <Select
          aria-label="Recording profile"
          tooltip="Recording profile — how aggressively to sample pointermove"
          width="fit"
          variant="bare"
          options={RECORDING_PROFILES}
          selectedKey={p.recordingProfile}
          onSelectionChange={p.onChangeRecordingProfile}
          isDisabled={p.recording}
        />
        <PlayButton onPlay={p.onPlay} />
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

/** Wraps a hidden `<input type=file>` so clicking the play button opens a
 *  picker and parses the selected JSON into a `Recording`. */
function PlayButton({ onPlay }: { onPlay: (rec: Recording) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        variant="ghost"
        iconOnly
        ariaLabel="Play recording…"
        tooltip="Play recording…"
        onClick={() => inputRef.current?.click()}
      >
        <PlayIcon />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.gz,.json.gz,application/json,application/gzip"
        className="wd-hidden-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // Always clear so selecting the same file twice retriggers change.
          e.target.value = '';
          if (!file) return;
          try {
            // Accepts both raw .json and gzipped .json.gz — magic-byte
            // sniffing in `deserializeRecording` picks the right path.
            const rec = await deserializeRecording(file);
            onPlay(rec);
          } catch {
            // Silent — bad JSON / file read error. The user can re-pick.
          }
        }}
      />
    </>
  );
}
