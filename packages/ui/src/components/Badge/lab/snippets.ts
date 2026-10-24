import { ALL_SHAPES } from '../shapes';
import { SHAPE_CONTROLS, defaultParamsFor } from '../shapeControls';
import { lookAttrs } from '../looks';
import type { BadgeShape } from '../types';
import { isColorParam } from './controls';
import type { LabParams, LabSnapshot } from './snapshot';

const literal = (v: number | string): string => (typeof v === 'string' ? JSON.stringify(v) : String(v));

type Composed = Pick<
  LabSnapshot,
  'base' | 'baseParams' | 'labEffects' | 'look' | 'tint' | 'variant' | 'size' | 'bloat' | 'crawlOn' | 'crawlSpeed' | 'label'
>;

/** The `<Badge>` JSX that reproduces the lab's current badge. */
export function composeSnippet(lab: Composed): string {
  const lines: string[] = ['<Badge', `  base="${lab.base}"`];
  if (Object.keys(lab.baseParams).length > 0) {
    const params = Object.entries(lab.baseParams).map(([k, v]) => `${k}: ${literal(v)}`).join(', ');
    lines.push(`  baseParams={{ ${params} }}`);
  }
  if (lab.labEffects.length > 0) {
    lines.push('  effects={[');
    for (const effect of lab.labEffects) {
      const params = Object.entries(effect.params)
        .map(([k, v]) => `${k}: ${isColorParam(effect.type, k) ? `cssColorLiteral(${JSON.stringify(v)})` : literal(v)}`)
        .join(', ');
      lines.push(`    { type: ${JSON.stringify(effect.type)}, params: { ${params} } },`);
    }
    lines.push('  ]}');
  }
  const look = lookAttrs(lab.look, lab.tint);
  lines.push(`  ${look ? `${look} ` : ''}variant="${lab.variant}" size="${lab.size}"`);
  if (lab.bloat !== 0) lines.push(`  bloat={${lab.bloat}}`);
  if (lab.crawlOn) lines.push(`  crawl={${lab.crawlSpeed}}`);
  lines.push(`>${lab.label}</Badge>`);
  return lines.join('\n');
}

export type ShapeParamSets = Record<BadgeShape, LabParams>;

export function defaultShapeParams(): ShapeParamSets {
  return Object.fromEntries(ALL_SHAPES.map((shape) => [shape, defaultParamsFor(shape)])) as ShapeParamSets;
}

/** Each shape's params that differ from its controls' defaults; a shape with none is left out. */
export function changedShapeParams(all: ShapeParamSets): Record<string, LabParams> {
  const diff: Record<string, LabParams> = {};
  for (const shape of ALL_SHAPES) {
    const current = all[shape];
    const controls = SHAPE_CONTROLS[shape] ?? [];
    if (!current || controls.length === 0) continue;
    const changed: LabParams = {};
    for (const c of controls) {
      if (c.kind === 'header') continue;
      if (current[c.key] !== c.default) changed[c.key] = current[c.key];
    }
    if (Object.keys(changed).length > 0) diff[shape] = changed;
  }
  return diff;
}

/** The changed params as source to paste over `SHAPE_CONTROLS` defaults. */
export function shapeParamsSnippet(all: ShapeParamSets): string {
  const diff = changedShapeParams(all);
  if (Object.keys(diff).length === 0) return '// (no changes from defaults)';
  const lines: string[] = ['// Drop into SHAPE_CONTROLS as new defaults:'];
  for (const [shape, params] of Object.entries(diff)) {
    lines.push(`${shape}: {`);
    for (const [k, v] of Object.entries(params)) lines.push(`  ${k}: ${literal(v)},`);
    lines.push('},');
  }
  return lines.join('\n');
}
