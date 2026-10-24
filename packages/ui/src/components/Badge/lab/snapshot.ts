import type { BadgeBase, BadgeEffect } from '@weasel-js/ui/components/Badge';
import { defaultsOf } from '../shapeControls';
import type { BadgeLook } from '../looks';
import type { BadgeVariant } from '../types';
import { BASE_LAB_CONTROLS } from './controls';

export type LabParams = Record<string, number | string>;

export interface LabEffect { id: number; type: BadgeEffect; params: LabParams }

export type LabCaps = 'normal' | 'small-caps' | 'all-small-caps';

/** Everything the compose lab remembers between visits and steps through on undo. */
export interface LabSnapshot {
  base: BadgeBase;
  baseParams: LabParams;
  labEffects: LabEffect[];
  nextId: number;
  look: BadgeLook;
  tint: string;
  variant: BadgeVariant;
  bloat: number;
  label: string;
  size: 'sm' | 'md';
  crawlOn: boolean;
  crawlSpeed: number;
  labelX: number;
  labelY: number;
  zoom: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  fontFamily: string;
  fontSizeDelta: number;
  bold: boolean;
  italic: boolean;
  caps: LabCaps;
  linkPadX: boolean;
  linkPadY: boolean;
}

const STORAGE_KEY = 'weasel-badge-compose-lab-v6';

export function loadLabSnapshot(): Partial<LabSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLabSnapshot(snap: LabSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // Storage is full or unavailable; the lab still works for this visit.
  }
}

/** The lab's opening state: what was saved, over the story's args, over the lab's own defaults. */
export function initialSnapshot(
  saved: Partial<LabSnapshot>,
  args: { look: BadgeLook; variant: BadgeVariant; label: string },
): LabSnapshot {
  const base = saved.base ?? 'rounded-rect';
  return {
    base,
    baseParams: saved.baseParams ?? defaultsOf(BASE_LAB_CONTROLS[base]),
    labEffects: saved.labEffects ?? [],
    nextId: saved.nextId ?? 1,
    look: saved.look ?? args.look,
    tint: saved.tint ?? '#7fb069',
    variant: saved.variant ?? args.variant,
    bloat: saved.bloat ?? 0,
    label: saved.label ?? args.label,
    size: saved.size ?? 'sm',
    crawlOn: saved.crawlOn ?? false,
    crawlSpeed: saved.crawlSpeed ?? 0.2,
    labelX: saved.labelX ?? 0,
    labelY: saved.labelY ?? 0,
    zoom: saved.zoom ?? 2,
    padTop: saved.padTop ?? 1,
    padRight: saved.padRight ?? 6,
    padBottom: saved.padBottom ?? 1,
    padLeft: saved.padLeft ?? 6,
    fontFamily: saved.fontFamily ?? 'inherit',
    fontSizeDelta: saved.fontSizeDelta ?? 0,
    bold: saved.bold ?? false,
    italic: saved.italic ?? false,
    caps: saved.caps ?? 'normal',
    linkPadX: saved.linkPadX ?? true,
    linkPadY: saved.linkPadY ?? true,
  };
}
