import {
  CloneIcon,
  CloseIcon,
  FitIcon,
  RedoIcon,
  ResetIcon,
  SnapshotIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@weasel-js/ui';
import { Select } from '../passthrough/weasel-ui';
import { Toolbar } from '../primitives/Toolbar';
import { ZoomControl } from '../primitives/ZoomControl';
import type { TrialToolbarContext } from './slotTypes';

/** Props for `<DefaultToolbar>`. */
export interface DefaultToolbarProps {
  ctx: TrialToolbarContext;
}

/** The toolbar a trial renders when no `toolbar` slot is supplied. Only
 *  shows the controls the instrument's declared capabilities support. */
export function DefaultToolbar({ ctx }: DefaultToolbarProps) {
  return (
    <Toolbar>
      {ctx.hasUndo && (
        <Toolbar.Group aria-label="History">
          <Toolbar.Button
            iconOnly
            onClick={ctx.undo}
            disabled={!ctx.canUndo}
            title="Undo (Cmd/Ctrl+Z)"
          >
            <UndoIcon size={16} />
          </Toolbar.Button>
          <Toolbar.Button
            iconOnly
            onClick={ctx.redo}
            disabled={!ctx.canRedo}
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <RedoIcon size={16} />
          </Toolbar.Button>
        </Toolbar.Group>
      )}

      {ctx.hasCanvas && (
        <Toolbar.Group aria-label="Zoom">
          <Toolbar.Button iconOnly onClick={ctx.zoomOut} title="Zoom out">
            <ZoomOutIcon size={16} />
          </Toolbar.Button>
          <ZoomControl zoom={ctx.zoom} onZoomChange={ctx.setZoom} />
          <Toolbar.Button iconOnly onClick={ctx.zoomIn} title="Zoom in">
            <ZoomInIcon size={16} />
          </Toolbar.Button>
          <Toolbar.Button iconOnly onClick={ctx.resetZoom} title="Actual size">
            <FitIcon size={16} />
          </Toolbar.Button>
        </Toolbar.Group>
      )}

      <Toolbar.Group aria-label="Snapshots">
        <Toolbar.Button onClick={() => ctx.saveSnapshot()} title="Save snapshot (Cmd/Ctrl+S)">
          <SnapshotIcon size={16} />
          <span>Save</span>
        </Toolbar.Button>
        {/* selectedKey is held at null so the control stays a "load one" action
            rather than drifting into a display of what was loaded last. */}
        {ctx.savedSnapshots.length > 0 && (
          <Select
            className="lk-toolbar__load-select"
            aria-label="Load snapshot"
            placeholder="Load…"
            selectedKey={null}
            options={ctx.savedSnapshots.map((sn) => ({ value: sn.id, label: sn.name }))}
            onSelectionChange={(id) => {
              if (id != null) ctx.loadSnapshot(String(id));
            }}
          />
        )}
      </Toolbar.Group>

      <Toolbar.Group end aria-label="Trial">
        <Toolbar.Button iconOnly onClick={ctx.clone} title="Clone trial">
          <CloneIcon size={16} />
        </Toolbar.Button>
        <Toolbar.Button iconOnly onClick={ctx.reset} title="Reset trial">
          <ResetIcon size={16} />
        </Toolbar.Button>
        <Toolbar.Button
          iconOnly
          variant="danger"
          onClick={ctx.close}
          disabled={ctx.isLastTrial}
          title={ctx.isLastTrial ? 'Cannot close the last trial' : 'Close trial'}
        >
          <CloseIcon size={16} />
        </Toolbar.Button>
      </Toolbar.Group>
    </Toolbar>
  );
}
