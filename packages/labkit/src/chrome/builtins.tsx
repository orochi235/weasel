import { copyText } from '@weasel-js/react';
import { getOwn, setOwn } from '@weasel-js/registry';
import { COLOR_MODE_OPTIONS, CycleButton } from '@weasel-js/ui/components/CycleButton';
import { FpsMeter } from '@weasel-js/ui/components/FpsMeter';
import { ScaleBar } from '@weasel-js/ui/components/ScaleBar';
import { ZoomControl } from '@weasel-js/ui/components/ZoomControl';
import { ExportMenu } from '../annotations/ExportMenu';
import { MarkList } from '../annotations/MarkList';
import type { LeafRenderer } from '../config/types';
import { ControlPanel } from '../controls/ControlPanel';
import { icon } from '../icons.gen';
import type { Instrument } from '../instrument/types';
import { undoCapability } from '../instrument/undo';
import type { TrialTool } from '../tools/types';
import { REDO_SHORTCUT, UNDO_SHORTCUT } from '../undo/useUndoKeys';
import { settingsConfig, trialActions } from './trialActions';
import type { TrialChromeContext, TrialContribution } from './types';

const ZOOM_STEP = 1.25;

/** The loupe's toolbar while a lens is mounted: its toggle, the eyedropper's beside it, and the readout they share. */
function loupeContributions(ctx: TrialChromeContext): TrialContribution[] {
  return [
    {
      id: 'loupe',
      region: 'toolbar',
      group: 'view',
      item: {
        icon: icon('ui:loupe'),
        label: 'Loupe',
        pressed: ctx.loupeOn,
        onActivate: ctx.toggleLoupe,
      },
    },
    {
      id: 'eyedropper',
      region: 'toolbar',
      group: 'view',
      item: {
        icon: icon('editing:eyedropper'),
        label: 'Eyedropper',
        pressed: ctx.dropperOn,
        onActivate: ctx.toggleDropper,
      },
    },
    pickedColorReadout(ctx.pickedColor),
  ];
}

/** The color last picked, by the eyedropper or a loupe, as one toolbar item: it reads the hex, and pressing it
 *  copies it. */
function pickedColorReadout(hex: string | null): TrialContribution {
  return {
    id: 'picked-color',
    region: 'toolbar',
    group: 'view',
    item: {
      icon: icon('core:copy'),
      label: hex ?? 'No color picked',
      showLabel: true,
      disabled: hex === null,
      onActivate: () => {
        if (hex) void copyText(hex);
      },
    },
  };
}

/** The property groups inside a contribution are folded under keys prefixed
 *  with that contribution's id, so a group called `marks` cannot fold the
 *  sidebar section of the same name. `ControlPanel` keys by bare label, so the
 *  prefix goes on here and comes off again. */
function groupFolds(
  collapsedSections: Readonly<Record<string, boolean>>,
  id: string,
): Record<string, boolean> {
  const prefix = `${id}/`;
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(collapsedSections)) {
    if (key.startsWith(prefix)) setOwn(out, key.slice(prefix.length), value);
  }
  return out;
}

/** How the Settings panel writes a trial's config: its drafts reach the instrument on every move and keystroke,
 *  and the trial records them with the value they settle on as one undo step. */
function settingsWrites(ctx: TrialChromeContext) {
  return { setConfig: ctx.setConfig, draftConfig: ctx.draftConfig ?? ctx.setConfig };
}

const settingsAuto = (ctx: TrialChromeContext) => ({ auto: ctx.auto, reported: ctx.reported });

/** The key a tool's rail button shows: the one its instrument reports it answers to now, else the one it declares. */
function shownKey(t: TrialTool, ctx: TrialChromeContext): TrialTool['shortcut'] {
  const live = ctx.toolShortcuts && getOwn(ctx.toolShortcuts, t.id);
  return live ? live[0] : t.shortcut;
}

/** Built-in ids contributed only while runtime state says so — the loupe
 *  and eyedropper toggles and the picked color appear once a lens mounts, after
 *  the trial's first render, the snapshot loader once a snapshot is saved, the
 *  expand toggle only inside a lightbox, and the zoom controls, scale and FPS
 *  meter once the trial has a view, which an `initialView` sized to the
 *  viewport does not until the canvas is measured. Marks, export, and the undo
 *  pair marks alone bring come and go with the lab's Marks switch. The
 *  floating sidebar's toggle is there only while the sidebar floats and has a
 *  section to show. */
export const TRANSIENT_BUILTINS: ReadonlySet<string> = new Set([
  'undo',
  'redo',
  'export',
  'marks',
  'loupe',
  'eyedropper',
  'picked-color',
  'snapshot-load',
  'expand',
  'zoom-out',
  'zoom-in',
  'actual-size',
  'zoom-control',
  'scale',
  'fps',
  'panel',
]);

/** The switch for the color mode a trial's content is drawn in, beside Undo and Redo. */
const MODE_SWITCH: TrialContribution = {
  id: 'mode',
  region: 'toolbar',
  group: 'mode',
  render: (c) => (
    <CycleButton
      value={c.colorMode}
      onChange={c.setColorMode}
      options={COLOR_MODE_OPTIONS}
      aria-label="Trial theme"
    />
  ),
};

/** Whether a trial's content is the instrument's own DOM, which a theme reaches, rather than a canvas or stage. */
export const drawsDom = (instrument: Instrument): boolean =>
  instrument.canvas == null && instrument.stage == null;

// Zoom acts on the view of the trial, so it is a viewport control. A trial
// holding a non-2D view reports zoom as null and gets none of this.
function zoomContributions(instrument: Instrument, ctx: TrialChromeContext): TrialContribution[] {
  const zoom = ctx.zoom;
  if (drawsDom(instrument) || zoom === null) return [];
  const out: TrialContribution[] = [];
  out.push({
    id: 'zoom-out',
    region: 'viewport',
    group: 'zoom',
    item: {
      icon: icon('ui:zoomOut'),
      label: 'Zoom out',
      onActivate: () => ctx.setZoom(zoom / ZOOM_STEP),
    },
  });
  out.push({
    id: 'zoom-in',
    region: 'viewport',
    group: 'zoom',
    item: {
      icon: icon('ui:zoomIn'),
      label: 'Zoom in',
      onActivate: () => ctx.setZoom(zoom * ZOOM_STEP),
    },
  });
  out.push({
    id: 'actual-size',
    region: 'viewport',
    group: 'zoom',
    item: { icon: icon('ui:fit'), label: 'Actual size', onActivate: () => ctx.setZoom(1) },
  });
  out.push({
    id: 'zoom-control',
    region: 'viewport',
    group: 'zoom',
    render: (c) => (
      <ZoomControl zoom={c.zoom ?? 1} onZoomInput={c.setZoom} onZoomChange={c.setZoom} />
    ),
  });
  out.push({
    id: 'scale',
    region: 'status',
    group: 'view',
    render: (c) => <ScaleBar zoom={c.zoom ?? 1} className="lk-scale-bar" />,
  });
  if (instrument.canvas != null) {
    out.push({
      id: 'fps',
      region: 'status',
      group: 'view',
      end: true,
      render: () => <FpsMeter />,
    });
  }
  return out;
}

/**
 * The contributions a trial gets from what its instrument declared. This is
 * the whole "declaring a capability provides the chrome" rule — it replaces
 * the presence checks that used to be spread across the runtime.
 */
export function builtinContributions(
  instrument: Instrument,
  ctx: TrialChromeContext,
  renderers?: Record<string, LeafRenderer>,
): TrialContribution[] {
  const out: TrialContribution[] = [];

  // Weasel history is the undo authority for marks, so declaring `annotations`
  // gets the buttons even with `undo: false`.
  if (undoCapability(instrument) != null || instrument.annotations != null) {
    out.push({
      id: 'undo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: icon('core:undo'),
        label: 'Undo',
        shortcut: UNDO_SHORTCUT,
        disabled: !ctx.canUndo,
        onActivate: ctx.undo,
      },
    });
    out.push({
      id: 'redo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: icon('core:redo'),
        label: 'Redo',
        shortcut: REDO_SHORTCUT,
        disabled: !ctx.canRedo,
        onActivate: ctx.redo,
      },
    });
  }

  // A canvas or stage paints its own colors, so only a trial drawn in DOM has a mode to switch.
  if (drawsDom(instrument)) out.push(MODE_SWITCH);

  // A tool id shares the contribution namespace, so a tool called `close`
  // collides with the built-in close button and throws. Annotation tools are
  // not here: the lab's rail carries them.
  for (const t of instrument.tools?.tools ?? []) {
    out.push({
      id: t.id,
      region: 'palette',
      group: t.group,
      item: {
        icon: t.icon,
        label: t.label,
        shortcut: shownKey(t, ctx),
        disabled: t.disabled,
        disabledReason: t.disabledReason,
      },
    });
  }

  if (ctx.hasLoupe) out.push(...loupeContributions(ctx));

  out.push(...zoomContributions(instrument, ctx));

  if (instrument.annotations != null) {
    // A panel rather than a menu, so it takes the `render` escape: it reads the
    // marks store through a hook, which the chrome context does not carry, and
    // holds a format and scale across the open and an error after it.
    out.push({
      id: 'export',
      region: 'toolbar',
      group: 'trial',
      end: true,
      render: () => <ExportMenu />,
    });
    out.push({
      id: 'marks',
      region: 'sidebar',
      item: {
        title: 'Marks',
        body: <MarkList meaning={instrument.annotations.meaning} config={ctx.config} />,
      },
    });
  }

  if (Object.keys(ctx.configSchema.group.children).length > 0) {
    out.push({
      id: 'settings',
      region: 'sidebar',
      item: {
        title: 'Settings',
        body: (
          <ControlPanel
            schema={ctx.configSchema}
            config={settingsConfig(ctx)}
            {...settingsAuto(ctx)}
            {...settingsWrites(ctx)}
            renderers={renderers}
            collapsed={groupFolds(ctx.collapsedSections, 'settings')}
            onCollapse={(label, next) => ctx.setSectionCollapsed(`settings/${label}`, next)}
          />
        ),
      },
    });
  }

  out.push(...trialActions(ctx));

  return out;
}
