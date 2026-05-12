/** Top action bar for Swillustrator — buttons that aren't tools.
 *
 *  Hosts undo/redo, delete/duplicate, group/ungroup, align/distribute/flip,
 *  boolean ops, and reorder. Buttons are stateless — every action is an
 *  imperative trigger supplied by the parent (see App.tsx wiring). Visual
 *  grouping is done via `.swill-actionbar-group` separators, not inline
 *  styles. */
import type { ReactNode } from 'react';
import type {
  AlignEdge,
  DistributeAxis,
  FlipAxis,
  BooleansAdapter,
  UseBooleansReturn,
} from '@orochi235/weasel';
import { PathfinderPanel } from '@orochi235/weasel-ui';

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

export function ActionBar(p: ActionBarProps) {
  const none = !p.hasSelection;
  const lt2 = p.selectionSize < 2;
  const lt3 = p.selectionSize < 3;
  return (
    <div className="swill-actionbar" role="toolbar" aria-label="Actions">
      <div className="swill-actionbar-group">
        <Button onClick={p.onUndo} disabled={!p.canUndo} title="Undo (Cmd-Z)">Undo</Button>
        <Button onClick={p.onRedo} disabled={!p.canRedo} title="Redo (Cmd-Shift-Z)">Redo</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onCut} disabled={none} title="Cut (Cmd-X)">Cut</Button>
        <Button onClick={p.onCopy} disabled={none} title="Copy (Cmd-C)">Copy</Button>
        <Button onClick={p.onPaste} disabled={p.clipboardEmpty} title="Paste (Cmd-V)">Paste</Button>
        <Button onClick={p.onDuplicate} disabled={none} title="Duplicate (Cmd-D)">Dup</Button>
        <Button onClick={p.onDelete} disabled={none} title="Delete (Del)">Del</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onSendToBack} disabled={none} title="Send to back (Cmd-Shift-[)">⤓⤓</Button>
        <Button onClick={p.onSendBackward} disabled={none} title="Send backward (Cmd-[)">⤓</Button>
        <Button onClick={p.onBringForward} disabled={none} title="Bring forward (Cmd-])">⤒</Button>
        <Button onClick={p.onBringToFront} disabled={none} title="Bring to front (Cmd-Shift-])">⤒⤒</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={p.onGroup} disabled={lt2} title="Group (Cmd-G)">Group</Button>
        <Button onClick={p.onUngroup} disabled={none} title="Ungroup (Cmd-Shift-G)">Ungroup</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onAlign('left')} disabled={lt2} title="Align left">AL</Button>
        <Button onClick={() => p.onAlign('center-x')} disabled={lt2} title="Align center X">ACx</Button>
        <Button onClick={() => p.onAlign('right')} disabled={lt2} title="Align right">AR</Button>
        <Button onClick={() => p.onAlign('top')} disabled={lt2} title="Align top">AT</Button>
        <Button onClick={() => p.onAlign('center-y')} disabled={lt2} title="Align center Y">ACy</Button>
        <Button onClick={() => p.onAlign('bottom')} disabled={lt2} title="Align bottom">AB</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onDistribute('x')} disabled={lt3} title="Distribute X">DX</Button>
        <Button onClick={() => p.onDistribute('y')} disabled={lt3} title="Distribute Y">DY</Button>
      </div>
      <Sep />
      <div className="swill-actionbar-group">
        <Button onClick={() => p.onFlip('x')} disabled={none} title="Flip H (Shift-H)">FH</Button>
        <Button onClick={() => p.onFlip('y')} disabled={none} title="Flip V (Shift-V)">FV</Button>
      </div>
      <Sep />
      <PathfinderPanel adapter={p.booleansAdapter} actions={p.booleansActions} />
    </div>
  );
}
