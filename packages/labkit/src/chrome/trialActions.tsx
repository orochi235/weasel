import { copyText } from '@weasel-js/react';
import { withOverValues } from '../config/over';
import { icon } from '../icons.gen';
import type { TrialChromeContext, TrialContribution } from './types';

/** The chord that saves a snapshot of the focused trial, as the trial's keys match it and its button shows it. */
export const SNAPSHOT_SHORTCUT = { key: 's', mod: true } as const;

/** What the settings panel reads: the trial's config, and the lab's values for a schema it is drawn over. */
export function settingsConfig(ctx: TrialChromeContext): Record<string, unknown> {
  const own = ctx.config as Record<string, unknown>;
  return ctx.configSchema.over && ctx.overValues ? withOverValues(own, ctx.overValues) : own;
}

/** The snapshot loader, once there is a snapshot to load, and the title bar's actions on the trial itself. */
export function trialActions(ctx: TrialChromeContext): TrialContribution[] {
  const out: TrialContribution[] = [];
  if (ctx.savedSnapshots.length > 0) {
    out.push({
      id: 'snapshot-load',
      region: 'toolbar',
      group: 'trial',
      end: true,
      item: {
        kind: 'menu',
        label: 'Load snapshot',
        entries: (c) =>
          c.savedSnapshots.map((sn) => ({
            kind: 'item',
            key: sn.id,
            label: sn.name,
            run: () => c.loadSnapshot(sn.id),
          })),
      },
    });
  }
  if (ctx.canExpand) {
    out.push({
      id: 'expand',
      region: 'titlebar',
      end: true,
      item: {
        icon: icon('ui:fullscreen'),
        label: 'Expand trial',
        pressed: ctx.expanded,
        onActivate: ctx.toggleExpanded,
      },
    });
  }
  out.push({
    id: 'clone',
    region: 'titlebar',
    end: true,
    item: { icon: icon('ui:clone'), label: 'Clone trial', onActivate: ctx.clone },
  });
  out.push({
    id: 'reset',
    region: 'titlebar',
    end: true,
    item: { icon: icon('ui:reset'), label: 'Reset trial', onActivate: ctx.reset },
  });
  if (Object.keys(ctx.configSchema.group.children).length > 0) {
    out.push({
      id: 'copy-settings',
      region: 'titlebar',
      end: true,
      item: {
        icon: icon('core:copy'),
        label: 'Copy settings as JSON',
        onActivate: () => void copyText(JSON.stringify(settingsConfig(ctx), null, 2)),
      },
    });
  }
  out.push({
    id: 'snapshot',
    region: 'titlebar',
    end: true,
    item: {
      icon: icon('ui:snapshot'),
      label: 'Save snapshot',
      shortcut: SNAPSHOT_SHORTCUT,
      onActivate: () => ctx.saveSnapshot(),
    },
  });
  out.push({
    id: 'close',
    region: 'titlebar',
    end: true,
    item: {
      icon: icon('ui:close'),
      label: 'Close trial',
      danger: true,
      disabled: ctx.isLastTrial,
      disabledReason: 'It is the last trial',
      onActivate: ctx.close,
    },
  });
  return out;
}
