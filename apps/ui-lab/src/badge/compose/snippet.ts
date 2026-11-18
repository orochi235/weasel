import { lookAttrs } from '@weasel-js/ui/components/Badge';
import { EFFECT_PARAMS } from '../effectParams';
import { isColor, literal, sentParams } from '../params';
import { type ComposeConfig, composedBaseParams, composedLabelStyle, composedPadding } from './composeConfig';

const entries = (params: Record<string, unknown>, color: (key: string) => boolean): string =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${color(k) ? `cssColorLiteral(${JSON.stringify(v)})` : literal(v)}`)
    .join(', ');

/** `text` as JSX children: as it is, or as a string expression where JSX would read part of it as markup. */
const jsxText = (text: string): string => (/[{}<>&\n]/.test(text) ? `{${JSON.stringify(text)}}` : text);

/** The `<Badge>` JSX that reproduces the lab's badge. */
export function composeSnippet({ shape, look, type, padding }: Pick<ComposeConfig, 'shape' | 'look' | 'type' | 'padding'>): string {
  const lines: string[] = ['<Badge', `  base="${shape.base}"`];
  const baseParams = composedBaseParams(shape);
  if (Object.keys(baseParams).length > 0) lines.push(`  baseParams={{ ${entries(baseParams, () => false)} }}`);
  const effects = shape.effects.filter((e) => e.on);
  if (effects.length > 0) {
    lines.push('  effects={[');
    for (const effect of effects) {
      const shape = EFFECT_PARAMS[effect.type];
      const params = entries(sentParams(shape, effect.params), (k) => isColor(shape, k));
      lines.push(`    { type: ${JSON.stringify(effect.type)}, params: { ${params} } },`);
    }
    lines.push('  ]}');
  }
  const attrs = lookAttrs(look.look, look.tint);
  lines.push(`  ${attrs ? `${attrs} ` : ''}variant="${look.variant}" size="${look.size}"`);
  lines.push(`  padding="${composedPadding(padding)}"`);
  if (look.bloat !== 0) lines.push(`  bloat={${look.bloat}}`);
  if (look.crawl) lines.push(`  crawl={${look.crawlSpeed}}`);
  // The stage's label is an inline block, which its offset needs to move it.
  const style = composedLabelStyle({ look, type });
  const styled = Object.keys(style).length > 0
    ? `<span style={{ ${entries({ ...(style.transform ? { display: 'inline-block' } : {}), ...style }, () => false)} }}>`
    : '';
  lines.push(`>${styled}${jsxText(look.label)}${styled ? '</span>' : ''}</Badge>`);
  return lines.join('\n');
}
