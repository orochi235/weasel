import { ACCENT_BASE, type StanceSurface, TONE_BASE } from './stanceCss';

/** Build-time only: every surface `npm run gen:stances` writes rules for. */
export const STANCE_SURFACES: readonly StanceSurface[] = [
  {
    id: 'panel',
    file: 'packages/ui/src/components/Properties/Properties.module.css',
    selector: '.panel',
    nests: true,
    fills: true,
    base: {
      surface: 'var(--wzl-panel-surface)',
      'border-color': 'var(--wzl-panel-border-color)',
      'border-style': 'var(--wzl-panel-border-style)',
      'border-width': 'var(--wzl-panel-border-width)',
      radius: 'var(--wzl-panel-radius)',
      // Density outranks the theme's pad; a stance's pad outranks both, so
      // `preview` can sit its content on the edge.
      pad: 'var(--wzl-prop-panel-pad, var(--wzl-panel-pad))',
      blur: 'var(--wzl-panel-blur)',
      'tone-mix': 'var(--wzl-panel-tone-mix)',
      tone: TONE_BASE,
      accent: ACCENT_BASE,
      'title-font': 'var(--wzl-panel-title-font)',
      'title-weight': 'var(--wzl-panel-title-weight)',
      'title-size': 'var(--wzl-panel-title-size)',
      'title-case': 'var(--wzl-panel-title-case)',
      'title-tracking': 'var(--wzl-panel-title-tracking)',
      'title-color': 'var(--wzl-panel-title-color)',
      'title-inset': 'var(--wzl-panel-title-inset)',
    },
    // A stanced panel's title takes the row-label recipe rather than the display title.
    stanced: {
      'title-font': 'var(--wzl-font-display)',
      'title-weight': 'var(--wzl-font-weight-light)',
      'title-size': 'var(--wzl-font-size-sm)',
      'title-case': 'var(--wzl-params-label-case, uppercase)',
      'title-tracking': 'var(--wzl-params-label-tracking, var(--wzl-tracking-wide))',
      'title-color': 'var(--wzl-fg-muted)',
    },
  },
  {
    id: 'group',
    file: 'packages/ui/src/components/Properties/Properties.module.css',
    selector: '.group',
    fills: true,
    base: {
      surface: 'var(--wzl-surface-sunken)',
      // Also the color of the rules flanking the title.
      'border-color': 'var(--wzl-border)',
      'border-style': 'solid',
      'border-width': '0px',
      radius: 'var(--wzl-radius-md)',
      pad: 'var(--wzl-prop-group-pad, 6px 10px 8px)',
      'tone-mix': 'var(--wzl-panel-tone-mix)',
      tone: TONE_BASE,
      accent: ACCENT_BASE,
      'title-font': 'var(--wzl-font-display)',
      'title-weight': 'var(--wzl-font-weight-light)',
      'title-size': 'var(--wzl-font-size-sm)',
      'title-case': 'var(--wzl-params-label-case, uppercase)',
      'title-tracking': 'var(--wzl-params-label-tracking, var(--wzl-tracking-wider))',
      'title-color': 'var(--wzl-fg-subtle)',
    },
  },
  {
    // A heading and a rule, no box: a stance reaches only the title and the rule.
    id: 'subpanel',
    file: 'packages/ui/src/components/Properties/Properties.module.css',
    selector: '.subpanel',
    base: {
      'border-color': 'var(--wzl-line-subtle)',
      accent: ACCENT_BASE,
      'title-font': 'var(--wzl-font-display)',
      'title-weight': 'var(--wzl-font-weight-medium)',
      'title-size': 'var(--wzl-font-size-sm)',
      'title-case': 'var(--wzl-params-label-case, uppercase)',
      'title-tracking': 'var(--wzl-params-label-tracking, var(--wzl-tracking-wider))',
      'title-color': 'var(--wzl-fg)',
    },
  },
  {
    // Cards in a list are peers of one kind: a tone, never a stance.
    id: 'card',
    file: 'packages/ui/src/components/Properties/Properties.module.css',
    selector: '.card',
    stanceless: true,
    base: { accent: ACCENT_BASE },
  },
];
