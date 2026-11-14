import { lookAttrs } from '@weasel-js/ui/components/Badge';
import { EFFECT_PARAMS } from '../effectParams';
import { isColor, literal } from '../params';
import { type ComposeConfig, composedBaseParams } from './composeConfig';

const entries = (params: Record<string, unknown>, color: (key: string) => boolean): string =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${color(k) ? `cssColorLiteral(${JSON.stringify(v)})` : literal(v)}`)
    .join(', ');

/** The `<Badge>` JSX that reproduces the lab's badge. */
export function composeSnippet({ shape, look }: Pick<ComposeConfig, 'shape' | 'look'>): string {
  const lines: string[] = ['<Badge', `  base="${shape.base}"`];
  const baseParams = composedBaseParams(shape);
  if (Object.keys(baseParams).length > 0) lines.push(`  baseParams={{ ${entries(baseParams, () => false)} }}`);
  const effects = shape.effects.filter((e) => e.on);
  if (effects.length > 0) {
    lines.push('  effects={[');
    for (const effect of effects) {
      const params = entries(effect.params, (k) => isColor(EFFECT_PARAMS[effect.type], k));
      lines.push(`    { type: ${JSON.stringify(effect.type)}, params: { ${params} } },`);
    }
    lines.push('  ]}');
  }
  const attrs = lookAttrs(look.look, look.tint);
  lines.push(`  ${attrs ? `${attrs} ` : ''}variant="${look.variant}" size="${look.size}"`);
  if (look.bloat !== 0) lines.push(`  bloat={${look.bloat}}`);
  if (look.crawl) lines.push(`  crawl={${look.crawlSpeed}}`);
  lines.push(`>${look.label}</Badge>`);
  return lines.join('\n');
}
