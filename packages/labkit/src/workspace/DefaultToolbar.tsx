import { Toolbar } from '../primitives/Toolbar';
import type { WorkspaceToolbarContext } from './slotTypes';

export interface DefaultToolbarProps {
  ctx: WorkspaceToolbarContext;
}

export function DefaultToolbar({ ctx }: DefaultToolbarProps) {
  return (
    <Toolbar>
      {ctx.hasUndo && (
        <>
          <Toolbar.Button onClick={ctx.undo} disabled={!ctx.canUndo} title="Undo (Cmd/Ctrl+Z)">
            Undo
          </Toolbar.Button>
          <Toolbar.Button
            onClick={ctx.redo}
            disabled={!ctx.canRedo}
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            Redo
          </Toolbar.Button>
          <Toolbar.Spacer />
        </>
      )}

      {ctx.hasCanvas && (
        <>
          <Toolbar.Button onClick={ctx.zoomOut} title="Zoom out">
            −
          </Toolbar.Button>
          <span className="lk-toolbar__zoom-label">{Math.round(ctx.zoom * 100)}%</span>
          <Toolbar.Button onClick={ctx.zoomIn} title="Zoom in">
            +
          </Toolbar.Button>
          <Toolbar.Button onClick={ctx.resetZoom} title="Reset zoom">
            1:1
          </Toolbar.Button>
          <Toolbar.Spacer />
        </>
      )}

      <Toolbar.Button onClick={() => ctx.saveSnapshot()} title="Save snapshot (Cmd/Ctrl+S)">
        Save
      </Toolbar.Button>

      {ctx.savedSnapshots.length > 0 && (
        <select
          className="lk-toolbar__load-select"
          aria-label="Load snapshot"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value;
            if (id) {
              ctx.loadSnapshot(id);
              e.target.value = '';
            }
          }}
        >
          <option value="" disabled>
            Load…
          </option>
          {ctx.savedSnapshots.map((sn) => (
            <option key={sn.id} value={sn.id}>
              {sn.name}
            </option>
          ))}
        </select>
      )}

      <Toolbar.Spacer />

      <Toolbar.Button onClick={ctx.clone} title="Clone workspace">
        Clone
      </Toolbar.Button>
      <Toolbar.Button onClick={ctx.reset} title="Reset workspace">
        Reset
      </Toolbar.Button>
      <Toolbar.Button
        onClick={ctx.close}
        disabled={ctx.isLastWorkspace}
        title={ctx.isLastWorkspace ? 'Cannot close the last workspace' : 'Close workspace'}
      >
        Close
      </Toolbar.Button>
    </Toolbar>
  );
}
