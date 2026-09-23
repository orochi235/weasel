/** Top action bar for WeaselDraw — buttons that aren't tools.
 *
 *  Every editing command (history, clipboard, reorder, group, align,
 *  distribute, flip, booleans) is a kit action, rendered by the kit's
 *  `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills; this file
 *  only supplies draw's glyphs for the ones the kit ships without. The
 *  buttons built here are the app's own: file, view toggles, recording,
 *  preferences. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionBar as KitActionBar } from '@weasel-js/ui';

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
  UndoIcon,
  RedoIcon,
  CutIcon,
  CopyIcon,
  PasteIcon,
  DuplicateIcon,
  DeleteIcon,
  GridIcon,
  SnapToGridIcon,
  ReleaseCompoundIcon,
  SettingsIcon,
  RecordIcon,
  PlayIcon,
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

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  active?: boolean;
  children: ReactNode;
}

function Button({ onClick, disabled, title, active, children }: ButtonProps) {
  return (
    <button
      className={active ? 'wd-actionbar-button wd-actionbar-button-active' : 'wd-actionbar-button'}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

const PAPER_LABELS: Record<PaperSizeKey, string> = {
  letter: 'US Letter',
  a4: 'A4',
  legal: 'Legal',
};

/** "New ▾" button with a paper-size submenu. Closes on outside click,
 *  on selection, or on Escape. */
function NewMenu({ onNew }: { onNew: (size: PaperSizeKey) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrapRef} className="wd-actionbar-menu">
      <button
        className="wd-actionbar-button"
        type="button"
        title="New document"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        New <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="wd-actionbar-popover" role="menu">
          {(Object.keys(PAPER_LABELS) as PaperSizeKey[]).map((key) => (
            <button
              key={key}
              role="menuitem"
              className="wd-actionbar-menuitem"
              type="button"
              onClick={() => { onNew(key); setOpen(false); }}
            >
              {PAPER_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

export function ActionBar(p: ActionBarProps) {
  return (
    <div className="wd-actionbar" role="toolbar" aria-label="Actions">
      <div className="wd-actionbar-group">
        <NewMenu onNew={p.onNew} />
        <Button onClick={p.onOpenSvg} title="Open SVG…">Open</Button>
        <Button onClick={p.onSaveSvg} title="Save as SVG">Save</Button>
      </div>
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} icons={KIT_ICONS} />)}
      <div className="wd-actionbar-group">
        <Button
          onClick={p.onToggleGrid}
          title={p.gridVisible ? 'Hide grid (Shift-3)' : 'Show grid (Shift-3)'}
          active={p.gridVisible}
        >
          <GridIcon />
        </Button>
        <Button
          onClick={p.onToggleSnap}
          title={p.snapToGrid ? 'Disable snap to grid' : 'Snap to grid'}
          active={p.snapToGrid}
        >
          <SnapToGridIcon />
        </Button>
      </div>
      <KitActionBar group="pathfinder" />
      <div className="wd-actionbar-group">
        <Button
          onClick={p.onReleaseCompound}
          disabled={!p.canReleaseCompound}
          title="Release compound path (Shift-|)"
        >
          <ReleaseCompoundIcon />
        </Button>
      </div>
      <div className="wd-actionbar-spacer" />
      <div className="wd-actionbar-group">
        <Button
          onClick={p.onToggleRecord}
          title={p.recording ? 'Stop recording (F9)' : 'Record input (F9)'}
          active={p.recording}
        >
          <RecordIcon active={p.recording} />
        </Button>
        <RecordingProfileSelect
          value={p.recordingProfile}
          onChange={p.onChangeRecordingProfile}
          disabled={p.recording}
        />
        <PlayButton onPlay={p.onPlay} />
        <DebugMenu />
      </div>
      <div className="wd-actionbar-group">
        <Button onClick={p.onOpenPrefs} title="Preferences (Cmd-,)"><SettingsIcon /></Button>
      </div>
    </div>
  );
}

/** Debug menu — opens the in-repo dev surfaces (hash-routed in main.tsx) in
 *  a new tab. Self-contained: no props, since each entry is just a
 *  `window.open` to a hash route on the current origin. */
const DEBUG_ROUTES: ReadonlyArray<{ label: string; hash: string }> = [
  { label: 'Toolkit Builder', hash: '#/dev/toolkits' },
  { label: 'Bundle Inspector', hash: '#/dev/registry' },
];

function DebugMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={wrapRef} className="wd-actionbar-menu">
      <button
        className="wd-actionbar-button"
        type="button"
        title="Debug surfaces"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Debug <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="wd-actionbar-popover" role="menu">
          {DEBUG_ROUTES.map((r) => (
            <button
              key={r.hash}
              role="menuitem"
              className="wd-actionbar-menuitem"
              type="button"
              onClick={() => {
                const url = `${window.location.pathname}${window.location.search}${r.hash}`;
                window.open(url, '_blank', 'noopener');
                setOpen(false);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dropdown selector for `RecordingProfile`. Disabled while a recording
 *  is in flight — the profile is captured at `start()` and can't be
 *  changed mid-stream. */
function RecordingProfileSelect({
  value,
  onChange,
  disabled,
}: {
  value: RecordingProfile;
  onChange: (p: RecordingProfile) => void;
  disabled: boolean;
}) {
  return (
    <select
      className="wd-actionbar-select"
      value={value}
      onChange={(e) => onChange(e.target.value as RecordingProfile)}
      disabled={disabled}
      title="Recording profile — how aggressively to sample pointermove"
      aria-label="Recording profile"
    >
      <option value="gesture-only">Gesture-only</option>
      <option value="full">Full fidelity</option>
      <option value="events-only">Events-only</option>
    </select>
  );
}

/** Wraps a hidden `<input type=file>` so clicking the play button opens a
 *  picker and parses the selected JSON into a `Recording`. The input is
 *  re-created per click via React so the same file can be replayed twice
 *  in a row (otherwise the `change` event wouldn't refire). */
function PlayButton({ onPlay }: { onPlay: (rec: Recording) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        onClick={() => inputRef.current?.click()}
        title="Play recording…"
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
