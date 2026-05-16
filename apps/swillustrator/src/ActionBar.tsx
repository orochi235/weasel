/** Top action bar for Swillustrator — buttons that aren't tools.
 *
 *  Hosts undo/redo, delete/duplicate, group/ungroup, align/distribute/flip,
 *  boolean ops, and reorder. Buttons are stateless — every action is an
 *  imperative trigger supplied by the parent (see App.tsx wiring). Visual
 *  grouping is done via `.swill-actionbar-group` separators, not inline
 *  styles. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  AlignEdge,
  DistributeAxis,
  FlipAxis,
  BooleansAdapter,
  UseBooleansReturn,
} from '@orochi235/weasel';
import { PathfinderPanel } from './ui';

/** Paper-size keys mirrored from App.tsx's `PAPER_PRESETS` map. Kept as a
 *  bare string union here so this component stays decoupled from the
 *  preset table (the parent picks the dimensions per key). */
export type PaperSizeKey = 'letter' | 'a4' | 'legal';
import {
  AlignLeftIcon,
  AlignCenterXIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignCenterYIcon,
  AlignBottomIcon,
  DistributeXIcon,
  DistributeYIcon,
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
import type { Recording } from './recorder';

export interface ActionBarProps {
  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  // Selection ops
  hasSelection: boolean;
  hasMultiSelection: boolean;
  selectionSize: number;
  onDelete(): void;
  onDuplicate(): void;
  onCopy(): void;
  onCut(): void;
  onPaste(): void;
  clipboardEmpty: boolean;
  // Z-order
  onBringForward(): void;
  onSendBackward(): void;
  onBringToFront(): void;
  onSendToBack(): void;
  /** True when at least one selected item isn't already at the front of its
   *  siblings — drives both Bring forward and Bring to front. */
  canMoveForward: boolean;
  /** True when at least one selected item isn't already at the back of its
   *  siblings — drives both Send backward and Send to back. */
  canMoveBackward: boolean;
  // Group
  onGroup(): void;
  onUngroup(): void;
  /** True when at least one selected id is itself a group. */
  canUngroup: boolean;
  // Align
  onAlign(edge: AlignEdge): void;
  // Distribute
  onDistribute(axis: DistributeAxis): void;
  // Flip
  onFlip(axis: FlipAxis): void;
  // Booleans — wired directly to PathfinderPanel; adapter drives its
  // disabled state (uniform <2 valid paths), actions fire the ops.
  booleansAdapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'>;
  booleansActions: UseBooleansReturn;
  // File I/O — SVG round-trip via @orochi235/weasel-svg.
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
      className={active ? 'swill-actionbar-button swill-actionbar-button-active' : 'swill-actionbar-button'}
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
    <div ref={wrapRef} className="swill-actionbar-menu">
      <button
        className="swill-actionbar-button"
        type="button"
        title="New document"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        New <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="swill-actionbar-popover" role="menu">
          {(Object.keys(PAPER_LABELS) as PaperSizeKey[]).map((key) => (
            <button
              key={key}
              role="menuitem"
              className="swill-actionbar-menuitem"
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

export function ActionBar(p: ActionBarProps) {
  const none = !p.hasSelection;
  const lt2 = p.selectionSize < 2;
  const lt3 = p.selectionSize < 3;
  return (
    <div className="swill-actionbar" role="toolbar" aria-label="Actions">
      <div className="swill-actionbar-group">
        <NewMenu onNew={p.onNew} />
        <Button onClick={p.onOpenSvg} title="Open SVG…">Open</Button>
        <Button onClick={p.onSaveSvg} title="Save as SVG">Save</Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Cmd-Z)"><UndoIcon /></Button>
        <Button onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Cmd-Shift-Z)"><RedoIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={p.onCut} disabled={none} title="Cut (Cmd-X)"><CutIcon /></Button>
        <Button onClick={p.onCopy} disabled={none} title="Copy (Cmd-C)"><CopyIcon /></Button>
        <Button onClick={p.onPaste} disabled={p.clipboardEmpty} title="Paste (Cmd-V)"><PasteIcon /></Button>
        <Button onClick={p.onDuplicate} disabled={none} title="Duplicate (Cmd-D)"><DuplicateIcon /></Button>
        <Button onClick={p.onDelete} disabled={none} title="Delete (Del)"><DeleteIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={p.onSendToBack} disabled={!p.canMoveBackward} title="Send to back (Cmd-Shift-[)"><SendToBackIcon /></Button>
        <Button onClick={p.onSendBackward} disabled={!p.canMoveBackward} title="Send backward (Cmd-[)"><SendBackwardIcon /></Button>
        <Button onClick={p.onBringForward} disabled={!p.canMoveForward} title="Bring forward (Cmd-])"><BringForwardIcon /></Button>
        <Button onClick={p.onBringToFront} disabled={!p.canMoveForward} title="Bring to front (Cmd-Shift-])"><BringToFrontIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={p.onGroup} disabled={lt2} title="Group (Cmd-G)"><GroupIcon /></Button>
        <Button onClick={p.onUngroup} disabled={!p.canUngroup} title="Ungroup (Cmd-Shift-G)"><UngroupIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onAlign('left')} disabled={lt2} title="Align left"><AlignLeftIcon /></Button>
        <Button onClick={() => p.onAlign('center-x')} disabled={lt2} title="Align center X"><AlignCenterXIcon /></Button>
        <Button onClick={() => p.onAlign('right')} disabled={lt2} title="Align right"><AlignRightIcon /></Button>
        <Button onClick={() => p.onAlign('top')} disabled={lt2} title="Align top"><AlignTopIcon /></Button>
        <Button onClick={() => p.onAlign('center-y')} disabled={lt2} title="Align center Y"><AlignCenterYIcon /></Button>
        <Button onClick={() => p.onAlign('bottom')} disabled={lt2} title="Align bottom"><AlignBottomIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onDistribute('x')} disabled={lt3} title="Distribute X"><DistributeXIcon /></Button>
        <Button onClick={() => p.onDistribute('y')} disabled={lt3} title="Distribute Y"><DistributeYIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onFlip('x')} disabled={none} title="Flip H (Shift-H)"><FlipXIcon /></Button>
        <Button onClick={() => p.onFlip('y')} disabled={none} title="Flip V (Shift-V)"><FlipYIcon /></Button>
      </div>
      <div className="swill-actionbar-group">
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
      <PathfinderPanel adapter={p.booleansAdapter} actions={p.booleansActions} />
      <div className="swill-actionbar-group">
        <Button
          onClick={p.onReleaseCompound}
          disabled={!p.canReleaseCompound}
          title="Release compound path (Shift-|)"
        >
          <ReleaseCompoundIcon />
        </Button>
      </div>
      <div className="swill-actionbar-spacer" />
      <div className="swill-actionbar-group">
        <Button
          onClick={p.onToggleRecord}
          title={p.recording ? 'Stop recording (F9)' : 'Record input (F9)'}
          active={p.recording}
        >
          <RecordIcon active={p.recording} />
        </Button>
        <PlayButton onPlay={p.onPlay} />
        <DebugMenu />
      </div>
      <div className="swill-actionbar-group">
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
    <div ref={wrapRef} className="swill-actionbar-menu">
      <button
        className="swill-actionbar-button"
        type="button"
        title="Debug surfaces"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Debug <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="swill-actionbar-popover" role="menu">
          {DEBUG_ROUTES.map((r) => (
            <button
              key={r.hash}
              role="menuitem"
              className="swill-actionbar-menuitem"
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
        accept=".json,application/json"
        className="swill-hidden-input"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // Always clear so selecting the same file twice retriggers change.
          e.target.value = '';
          if (!file) return;
          try {
            const text = await file.text();
            const rec = JSON.parse(text) as Recording;
            onPlay(rec);
          } catch {
            // Silent — bad JSON / file read error. The user can re-pick.
          }
        }}
      />
    </>
  );
}
