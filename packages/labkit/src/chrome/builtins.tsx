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
import { ControlPanel } from '../controls/ControlPanel';
import type { Instrument } from '../instrument/types';
import { Select } from '../passthrough/weasel-ui';
import { FpsMeter } from '../primitives/FpsMeter';
import { ScaleIndicator } from '../primitives/ScaleIndicator';
import { ZoomControl } from '../primitives/ZoomControl';
import type { TrialChromeContext, TrialContribution } from './types';

const ZOOM_STEP = 1.25;

/**
 * The contributions a trial gets from what its instrument declared. This is
 * the whole "declaring a capability provides the chrome" rule — it replaces
 * the presence checks that used to be spread across the runtime.
 */
export function builtinContributions(
  instrument: Instrument,
  ctx: TrialChromeContext,
): TrialContribution[] {
  const out: TrialContribution[] = [];
  const zoom = ctx.zoom;

  if (instrument.undo != null) {
    out.push({
      id: 'undo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: UndoIcon,
        label: 'Undo',
        shortcut: 'Mod+Z',
        disabled: !ctx.canUndo,
        onActivate: ctx.undo,
      },
    });
    out.push({
      id: 'redo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: RedoIcon,
        label: 'Redo',
        shortcut: 'Mod+Shift+Z',
        disabled: !ctx.canRedo,
        onActivate: ctx.redo,
      },
    });
  }

  // A tool id shares the contribution namespace, so a tool called `close`
  // collides with the built-in close button and throws. Both are contributions
  // to one trial's chrome.
  for (const t of instrument.tools?.tools ?? []) {
    out.push({
      id: t.id,
      region: 'palette',
      group: t.group,
      item: { icon: t.icon, label: t.label, shortcut: t.shortcut },
    });
  }

  // Zoom acts on the view of the trial, so it is a viewport control. A trial
  // holding a non-2D view reports zoom as null and gets none of this.
  if (instrument.canvas != null && zoom !== null) {
    out.push({
      id: 'zoom-out',
      region: 'viewport',
      group: 'zoom',
      item: {
        icon: ZoomOutIcon,
        label: 'Zoom out',
        onActivate: () => ctx.setZoom(zoom / ZOOM_STEP),
      },
    });
    out.push({
      id: 'zoom-in',
      region: 'viewport',
      group: 'zoom',
      item: {
        icon: ZoomInIcon,
        label: 'Zoom in',
        onActivate: () => ctx.setZoom(zoom * ZOOM_STEP),
      },
    });
    out.push({
      id: 'actual-size',
      region: 'viewport',
      group: 'zoom',
      item: { icon: FitIcon, label: 'Actual size', onActivate: () => ctx.setZoom(1) },
    });
    out.push({
      id: 'zoom-control',
      region: 'viewport',
      group: 'zoom',
      render: (c) => <ZoomControl zoom={c.zoom ?? 1} onZoomChange={c.setZoom} />,
    });
    out.push({
      id: 'scale',
      region: 'status',
      group: 'view',
      render: () => <ScaleIndicator />,
    });
    out.push({
      id: 'fps',
      region: 'status',
      group: 'view',
      end: true,
      render: () => <FpsMeter />,
    });
  }

  if (ctx.configFields.length > 0) {
    out.push({
      id: 'settings',
      region: 'sidebar',
      item: {
        title: 'Settings',
        body: (
          <ControlPanel
            fields={ctx.configFields}
            config={ctx.config as Record<string, unknown>}
            setConfig={(key, value) => ctx.setConfig(String(key), value)}
          />
        ),
      },
    });
  }

  out.push({
    id: 'snapshot',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: {
      icon: SnapshotIcon,
      label: 'Save snapshot',
      shortcut: 'Mod+S',
      onActivate: () => ctx.saveSnapshot(),
    },
  });
  if (ctx.savedSnapshots.length > 0) {
    // A picker is not an icon button, so it takes the render escape. Held at
    // `selectedKey={null}` so it stays a "load one" action rather than
    // drifting into a display of what was loaded last.
    out.push({
      id: 'snapshot-load',
      region: 'toolbar',
      group: 'trial',
      end: true,
      render: (c) => (
        <Select
          className="lk-toolbar__load-select"
          aria-label="Load snapshot"
          placeholder="Load…"
          selectedKey={null}
          options={c.savedSnapshots.map((sn) => ({ value: sn.id, label: sn.name }))}
          onSelectionChange={(id) => {
            if (id != null) c.loadSnapshot(String(id));
          }}
        />
      ),
    });
  }
  out.push({
    id: 'clone',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: { icon: CloneIcon, label: 'Clone trial', onActivate: ctx.clone },
  });
  out.push({
    id: 'reset',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: { icon: ResetIcon, label: 'Reset trial', onActivate: ctx.reset },
  });
  out.push({
    id: 'close',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: {
      icon: CloseIcon,
      label: ctx.isLastTrial ? 'Cannot close the last trial' : 'Close trial',
      danger: true,
      disabled: ctx.isLastTrial,
      onActivate: ctx.close,
    },
  });

  return out;
}
