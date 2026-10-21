import { DIAGRAM_THEMES } from './themes';
import type { DiagramTheme } from './types';

/**
 * A theme matching its host's chrome, built from resolved `--wzl-*` values:
 * `read` answers a custom property's value, as `getComputedStyle(el)
 * .getPropertyValue` does. A token that reads empty takes `paper`'s color.
 */
export function diagramThemeFromTokens(
  read: (token: string) => string,
  opts: { id?: string; name?: string } = {},
): DiagramTheme {
  const paper = DIAGRAM_THEMES.paper!;
  const t = (name: string, fallback: string): string => read(`--wzl-${name}`).trim() || fallback;
  const fg = t('fg', paper.roles.default!.text);
  const muted = t('fg-muted', paper.roles.muted!.text);
  const raised = t('surface-raised', paper.roles.default!.fill);
  const sunken = t('surface-sunken', paper.roles.muted!.fill);
  const border = t('border-strong', t('border', paper.roles.default!.stroke));
  const accent = t('accent', paper.roles.accent!.stroke);
  const success = t('success', paper.roles.positive!.stroke);
  const warning = t('warning', paper.roles.warning!.stroke);
  const danger = t('danger', paper.roles.negative!.stroke);
  const size = Number.parseFloat(read('--wzl-font-size'));
  const shape = (stroke: string) => ({ fill: raised, stroke, text: fg });
  return {
    id: opts.id ?? 'tokens',
    name: opts.name ?? 'Match chrome',
    roles: {
      default: shape(border),
      accent: { fill: t('accent-soft', raised), stroke: accent, text: fg },
      muted: { fill: sunken, stroke: border, text: muted },
      positive: shape(success),
      warning: shape(warning),
      negative: shape(danger),
    },
    defaultRole: 'default',
    edge: { ...paper.edge, stroke: muted },
    label: { fill: fg },
    container: { ...paper.container, fill: sunken, stroke: border, text: muted },
    lane: {
      header: { fill: sunken, stroke: border, text: fg, strokeWidth: 1 },
      bodies: [
        { fill: t('surface', paper.page), stroke: border, text: fg, strokeWidth: 1 },
        { fill: raised, stroke: border, text: fg, strokeWidth: 1 },
      ],
    },
    page: t('surface', paper.page),
    font: { family: t('font-ui', paper.font.family), size: Number.isFinite(size) && size > 0 ? size : paper.font.size },
    series: [accent, success, warning, danger, t('accent-strong', accent), muted],
  };
}
