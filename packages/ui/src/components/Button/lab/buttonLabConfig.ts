import type { CSSProperties } from 'react';
import { DEG_TO_RAD } from '@weasel-js/geom';
import { getOwn } from '@weasel-js/registry';

/** The weights the lab offers. */
export const BUTTON_LAB_WEIGHTS = ['200', '300', '350', '400', '500', '600'] as const;

/** The knobs the button lab reads. */
export interface ButtonLabConfig {
  target: 'segmented' | 'button';
  variant: 'confirm' | 'solid' | 'ghost';
  label: string;
  /** The theme's accent, previewed under the glass; never exported. */
  accent: string;
  /** `radius` is a percentage of the height. */
  shape: { radius: number; height: number; padx: number; fontsize: number; fontweight: (typeof BUTTON_LAB_WEIGHTS)[number] };
  body: { topAlpha: number; upperAlpha: number; equator: number; equatorSpread: number; equatorTint: number; baseTint: number; blur: number; saturate: number };
  gloss: { top: number; mid: number; bottom: number };
  depth: {
    rim: number; dropNear: number; dropFar: number; insetHi: number; insetLo: number;
    textShadow: number; textInset: number; textInsetAngle: number; textInsetDist: number;
  };
  view: { zoom: number; backdrop: 'panel' | 'glass' | 'gradient' | 'photo' | 'grid' };
}

/** Every knob at the button that ships in the default theme: what the story's schema starts from, and what an export
 *  is measured against. */
export const BUTTON_LAB_DEFAULTS: ButtonLabConfig = {
  target: 'segmented',
  variant: 'confirm',
  label: 'Continue',
  accent: '#5b63c9',
  shape: { radius: 10, height: 28, padx: 12, fontsize: 15, fontweight: '350' },
  body: { topAlpha: 45, upperAlpha: 70, equator: 52, equatorSpread: 12, equatorTint: 95, baseTint: 70, blur: 6, saturate: 1.3 },
  gloss: { top: 0.42, mid: 0.12, bottom: 50 },
  depth: {
    rim: 0.22, dropNear: 0.3, dropFar: 0.18, insetHi: 0.42, insetLo: 0.3,
    textShadow: 0.35, textInset: 0.55, textInsetAngle: 180, textInsetDist: 1,
  },
  view: { zoom: 2, backdrop: 'photo' },
};

/** Set for the preview only: the theme owns them, so pasting one into the stylesheet would override it. */
const PREVIEW_ONLY = new Set(['--wzl-accent', '--wzl-gloss']);

// `+ 0` turns a rounded -0 into 0, which `toFixed` would write as `-0.00`.
const px2 = (n: number) => `${(Math.round(n * 100) / 100 + 0).toFixed(2)}px`;

/** The custom properties `Button.module.css` reads, as the lab's knobs set them. The shape goes through the button's
 *  theme hooks, which the `.size_*` rules read, rather than the `--btn-*` values those rules set. */
export function buttonVarsOf(c: ButtonLabConfig): Record<string, string> {
  const { shape, body, gloss, depth } = c;
  // Compass angle: 0° up, 90° right, 180° down, as a CSS gradient reads one.
  const angle = depth.textInsetAngle * DEG_TO_RAD;
  return {
    '--wzl-accent': c.accent,
    // The lab tunes the glass, which the default theme leaves off.
    '--wzl-gloss': '1',
    '--wzl-button-radius': `calc(var(--btn-height) * ${shape.radius / 100})`,
    '--wzl-button-h': `${shape.height}px`,
    '--wzl-button-pad-x': `${shape.padx}px`,
    '--wzl-field-font-size': `${shape.fontsize}px`,
    '--wzl-button-font-weight': shape.fontweight,
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
    '--btn-text-inset-x': px2(Math.sin(angle) * depth.textInsetDist),
    '--btn-text-inset-y': px2(-Math.cos(angle) * depth.textInsetDist),
  };
}

/** Where a shape hook's tuned value ships. Set on `.button`, the hook would size every button at the md size the lab
 *  tunes and override the theme's own hook, so it ships as md's `--btn-*` value with the hook still read first. */
const SHIPS_AS: Record<string, { rule: '.button' | '.size_md'; prop: string; hooked: boolean }> = {
  '--wzl-button-radius': { rule: '.button', prop: '--btn-radius', hooked: true },
  '--wzl-button-font-weight': { rule: '.button', prop: '--btn-fontweight', hooked: true },
  '--wzl-button-h': { rule: '.size_md', prop: '--btn-height', hooked: true },
  '--wzl-button-pad-x': { rule: '.size_md', prop: '--btn-padx', hooked: true },
  '--wzl-field-font-size': { rule: '.size_md', prop: '--btn-fontsize', hooked: false },
};

/** The declarations to change in `Button.module.css` to ship the tuned look: each property that differs from what
 *  ships, under the rule it goes in, replacing the declaration of that name there. The accent is the theme's,
 *  previewed but not exported. */
export function exportDeltas(c: ButtonLabConfig): string {
  const now = buttonVarsOf(c);
  const was = buttonVarsOf(BUTTON_LAB_DEFAULTS);
  const rules: Record<'.button' | '.size_md', string[]> = { '.button': [], '.size_md': [] };
  for (const k of Object.keys(now)) {
    if (PREVIEW_ONLY.has(k) || now[k] === getOwn(was, k)) continue;
    const to = getOwn(SHIPS_AS, k);
    const value = to?.hooked ? `var(${k}, ${now[k]})` : now[k];
    rules[to?.rule ?? '.button'].push(`  ${to?.prop ?? k}: ${value};`);
  }
  const blocks = Object.entries(rules).filter(([, lines]) => lines.length > 0)
    .map(([rule, lines]) => `${rule} {\n${lines.sort().join('\n')}\n}`);
  return blocks.length === 0 ? '/* No deltas: every knob is at what ships. */' : blocks.join('\n');
}

/** The vars as a style: they are knob values, which no class can hold. */
export const asStyle = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;
