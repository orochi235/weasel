import { type ConfigSchema, f } from '@weasel-js/labkit';
import {
  BADGE_LOOKS, BADGE_SHAPES, type BadgeLook, type BadgeShape, type BadgeVariant,
} from '@weasel-js/ui/components/Badge';
import { changedParams, literal, type Params } from '../params';
import { SHAPE_PARAMS } from '../shapeParams';

export interface ShapesConfig {
  look: { variant: BadgeVariant; look: Exclude<BadgeLook, 'tint'>; label: string };
  /** The shape whose params the panel shows. */
  selected: BadgeShape;
  params: Partial<Record<BadgeShape, Params>>;
}

const shaped = BADGE_SHAPES.filter((shape) => SHAPE_PARAMS[shape]);

export const shapesConfig = f.schema({
  look: f.group({
    variant: f.enum<BadgeVariant>('outline', ['outline', 'solid', 'subtle']),
    look: f.enum<Exclude<BadgeLook, 'tint'>>('low', BADGE_LOOKS),
    label: f.string('ZORF'),
  }).section('Appearance'),
  selected: f.enum<BadgeShape>('square', BADGE_SHAPES).label('Shape').section('Params'),
  params: f.group(Object.fromEntries(shaped.map((shape) => [
    shape,
    f.group(SHAPE_PARAMS[shape]!).label(shape).showIf({ path: 'selected', is: shape }),
  ]))).section('Params'),
}) as unknown as ConfigSchema<ShapesConfig>;

/** Each shape's params that differ from its defaults; a shape with none is left out. */
export function changedShapeParams(params: ShapesConfig['params']): Partial<Record<BadgeShape, Params>> {
  const out: Partial<Record<BadgeShape, Params>> = {};
  for (const shape of shaped) {
    const changed = changedParams(SHAPE_PARAMS[shape]!, params[shape] ?? {});
    if (Object.keys(changed).length > 0) out[shape] = changed;
  }
  return out;
}

/** The changed params as source to paste over `SHAPE_PARAMS`'s defaults. */
export function shapeParamsSnippet(params: ShapesConfig['params']): string {
  const diff = changedShapeParams(params);
  if (Object.keys(diff).length === 0) return '// (no changes from defaults)';
  const lines: string[] = ['// New defaults for SHAPE_PARAMS:'];
  for (const [shape, changed] of Object.entries(diff)) {
    lines.push(`${shape}: {`);
    for (const [k, v] of Object.entries(changed)) lines.push(`  ${k}: ${literal(v)},`);
    lines.push('},');
  }
  return lines.join('\n');
}
