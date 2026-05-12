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
import { PathfinderPanel } from '@orochi235/weasel-ui';

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
} from './actionIcons';

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
  // Group
  onGroup(): void;
  onUngroup(): void;
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
}

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}

function Button({ onClick, disabled, title, children }: ButtonProps) {
  return (
    <button
      className="swill-actionbar-button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="swill-actionbar-sep" aria-hidden="true" />;
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
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Cmd-Z)"><UndoIcon /></Button>
        <Button onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Cmd-Shift-Z)"><RedoIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onCut} disabled={none} title="Cut (Cmd-X)"><CutIcon /></Button>
        <Button onClick={p.onCopy} disabled={none} title="Copy (Cmd-C)"><CopyIcon /></Button>
        <Button onClick={p.onPaste} disabled={p.clipboardEmpty} title="Paste (Cmd-V)"><PasteIcon /></Button>
        <Button onClick={p.onDuplicate} disabled={none} title="Duplicate (Cmd-D)"><DuplicateIcon /></Button>
        <Button onClick={p.onDelete} disabled={none} title="Delete (Del)"><DeleteIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onSendToBack} disabled={none} title="Send to back (Cmd-Shift-[)"><SendToBackIcon /></Button>
        <Button onClick={p.onSendBackward} disabled={none} title="Send backward (Cmd-[)"><SendBackwardIcon /></Button>
        <Button onClick={p.onBringForward} disabled={none} title="Bring forward (Cmd-])"><BringForwardIcon /></Button>
        <Button onClick={p.onBringToFront} disabled={none} title="Bring to front (Cmd-Shift-])"><BringToFrontIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onGroup} disabled={lt2} title="Group (Cmd-G)"><GroupIcon /></Button>
        <Button onClick={p.onUngroup} disabled={none} title="Ungroup (Cmd-Shift-G)"><UngroupIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onAlign('left')} disabled={lt2} title="Align left"><AlignLeftIcon /></Button>
        <Button onClick={() => p.onAlign('center-x')} disabled={lt2} title="Align center X"><AlignCenterXIcon /></Button>
        <Button onClick={() => p.onAlign('right')} disabled={lt2} title="Align right"><AlignRightIcon /></Button>
        <Button onClick={() => p.onAlign('top')} disabled={lt2} title="Align top"><AlignTopIcon /></Button>
        <Button onClick={() => p.onAlign('center-y')} disabled={lt2} title="Align center Y"><AlignCenterYIcon /></Button>
        <Button onClick={() => p.onAlign('bottom')} disabled={lt2} title="Align bottom"><AlignBottomIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onDistribute('x')} disabled={lt3} title="Distribute X"><DistributeXIcon /></Button>
        <Button onClick={() => p.onDistribute('y')} disabled={lt3} title="Distribute Y"><DistributeYIcon /></Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onFlip('x')} disabled={none} title="Flip H (Shift-H)"><FlipXIcon /></Button>
        <Button onClick={() => p.onFlip('y')} disabled={none} title="Flip V (Shift-V)"><FlipYIcon /></Button>
      </div>
      <Sep />
      <PathfinderPanel adapter={p.booleansAdapter} actions={p.booleansActions} />
    </div>
  );
}
