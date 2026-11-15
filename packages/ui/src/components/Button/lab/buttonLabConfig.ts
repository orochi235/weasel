import type { CSSProperties } from 'react';
import { DEG_TO_RAD } from '@weasel-js/geom';

/** The knobs the button lab reads. */
export interface ButtonLabConfig {
  target: 'segmented' | 'button';
  variant: 'confirm' | 'solid' | 'ghost';
  label: string;
  accent: string;
  shape: { radius: number; height: number; padx: number; fontsize: number; fontweight: '200' | '300' | '400' };
  body: { topAlpha: number; upperAlpha: number; equator: number; equatorSpread: number; equatorTint: number; baseTint: number; blur: number; saturate: number };
  gloss: { top: number; mid: number; bottom: number };
  depth: {
    rim: number; dropNear: number; dropFar: number; insetHi: number; insetLo: number;
    textShadow: number; textInset: number; textInsetAngle: number; textInsetDist: number;
  };
  view: { zoom: number; backdrop: 'panel' | 'glass' | 'gradient' | 'photo' | 'grid' };
}

/** Every knob at the look the lab was tuned to: what the story's schema starts from, and what an export is measured against. */
export const BUTTON_LAB_DEFAULTS: ButtonLabConfig = {
  target: 'segmented',
  variant: 'confirm',
  label: 'Continue',
  accent: '#2e1f7a',
  shape: { radius: 999, height: 28, padx: 16, fontsize: 14, fontweight: '400' },
  body: { topAlpha: 45, upperAlpha: 70, equator: 52, equatorSpread: 12, equatorTint: 95, baseTint: 70, blur: 6, saturate: 1.3 },
  gloss: { top: 0.7, mid: 0.18, bottom: 50 },
  depth: {
    rim: 0.22, dropNear: 0.3, dropFar: 0.18, insetHi: 0.7, insetLo: 0.3,
    textShadow: 0.35, textInset: 0.55, textInsetAngle: 180, textInsetDist: 1,
  },
  view: { zoom: 2, backdrop: 'photo' },
};

/** The custom properties `Button.module.css` reads, as the lab's knobs set them. */
export function buttonVarsOf(c: ButtonLabConfig): Record<string, string> {
  const { shape, body, gloss, depth } = c;
  // Compass angle: 0° up, 90° right, 180° down, as a CSS gradient reads one.
  const angle = depth.textInsetAngle * DEG_TO_RAD;
  return {
    '--wzl-accent': c.accent,
    // The lab tunes the glass, which the default theme leaves off.
    '--wzl-gloss': '1',
    '--btn-radius': `${shape.radius}px`,
    '--btn-height': `${shape.height}px`,
    '--btn-padx': `${shape.padx}px`,
    '--btn-fontsize': `${shape.fontsize}px`,
    '--btn-fontweight': shape.fontweight,
    '--btn-top-alpha': `${body.topAlpha}%`,
    '--btn-upper-alpha': `${body.upperAlpha}%`,
    '--btn-equator': `${body.equator}%`,
    '--btn-equator-spread': `${body.equatorSpread}%`,
    '--btn-equator-tint': `${body.equatorTint}%`,
    '--btn-base-tint': `${body.baseTint}%`,
    '--btn-blur': `${body.blur}px`,
    '--btn-saturate': String(body.saturate),
    '--btn-gloss-top': String(gloss.top),
    '--btn-gloss-mid': String(gloss.mid),
    '--btn-gloss-bottom': `${gloss.bottom}%`,
    '--btn-rim': String(depth.rim),
    '--btn-drop-near': String(depth.dropNear),
    '--btn-drop-far': String(depth.dropFar),
    '--btn-inset-hi': String(depth.insetHi),
    '--btn-inset-lo': String(depth.insetLo),
    '--btn-text-shadow': String(depth.textShadow),
    '--btn-text-inset': String(depth.textInset),
    '--btn-text-inset-x': `${(Math.sin(angle) * depth.textInsetDist).toFixed(2)}px`,
    '--btn-text-inset-y': `${(-Math.cos(angle) * depth.textInsetDist).toFixed(2)}px`,
  };
}

/** The rule to paste into `Button.module.css` to ship the tuned look: each property that differs from the defaults. */
export function exportDeltas(c: ButtonLabConfig): string {
  const now = buttonVarsOf(c);
  const was = buttonVarsOf(BUTTON_LAB_DEFAULTS);
  const lines = Object.keys(now).sort().filter((k) => now[k] !== was[k]).map((k) => `  ${k}: ${now[k]};`);
  return lines.length === 0 ? '/* No deltas: every knob is at its default. */' : `.button {\n${lines.join('\n')}\n}`;
}

/** The vars as a style: they are knob values, which no class can hold. */
export const asStyle = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;
