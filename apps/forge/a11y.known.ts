// Text drawn in a theme token that misses 4.5:1 on its surface: a theme decision, recorded in docs/unruled.md.
const TOKENS = 'theme token below 4.5:1 on its surface (docs/unruled.md)';
const contrast = { 'color-contrast': TOKENS };

/**
 * Violations the sweep knows of, by story file under `packages/` and rule, each with why it stands. A known
 * violation is set aside; one that no longer happens fails the sweep, so the list only shrinks.
 */
export const KNOWN: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'labkit/src/annotations/calibration/Calibration.stories.tsx': {
    'scrollable-region-focusable': 'the story scrolls a frame holding only a picture; a lab frame holds controls',
  },
  'labkit/src/chrome/regions/SidebarPanes.stories.tsx': {
    'scrollable-region-focusable': 'the story fills its sections with prose; a lab section holds controls',
  },
  'labkit/src/lab/Lab.stories.tsx': {
    'landmark-unique': 'two trials of one instrument share the name "Trial <instrument>"; which name tells them apart is unruled',
  },
  'labkit/src/controls/AutoControls.stories.tsx': contrast,
  'labkit/src/controls/ControlPanel.stories.tsx': contrast,
  'labkit/src/primitives/JobProgress.stories.tsx': contrast,
  'labkit/src/specimen/Specimen.stories.tsx': contrast,
  'ui/src/components/Badge/Badge.stories.tsx': contrast,
  'ui/src/components/Bar/Bar.stories.tsx': contrast,
  'ui/src/components/Button/Button.stories.tsx': contrast,
  'ui/src/components/Callout/Callout.stories.tsx': contrast,
  'ui/src/components/Code/Code.stories.tsx': contrast,
  'ui/src/components/CodeBlock/CodeBlock.stories.tsx': contrast,
  'ui/src/components/DataGrid/DataGrid.stories.tsx': contrast,
  'ui/src/components/Disabled/Disabled.stories.tsx': contrast,
  'ui/src/components/EffectList/EffectList.stories.tsx': contrast,
  'ui/src/components/Field/Field.stories.tsx': {
    ...contrast,
    'aria-input-field-name': "WithOutput's two Slider thumbs carry no name of their own; the Field label names the slider, not each thumb",
  },
  'ui/src/components/Input/Input.stories.tsx': contrast,
  'ui/src/components/Keycaps/Keycap.stories.tsx': contrast,
  'ui/src/components/Keycaps/KeySequence.stories.tsx': contrast,
  'ui/src/components/MotifFrame/MotifFrame.stories.tsx': contrast,
  'ui/src/components/Prefs/GroupTabs.stories.tsx': contrast,
  'ui/src/components/Prefs/PrefKindBadge.stories.tsx': contrast,
  'ui/src/components/Prefs/PrefMixed.stories.tsx': contrast,
  'ui/src/components/Prefs/Prefs.heading.stories.tsx': contrast,
  'ui/src/components/Prefs/Prefs.kinds.stories.tsx': contrast,
  'ui/src/components/Prefs/Prefs.stories.tsx': contrast,
  'ui/src/components/PrefsBar/PrefsBar.stories.tsx': contrast,
  'ui/src/components/Properties/PropertyAutoReadout.stories.tsx': contrast,
  'ui/src/components/Properties/PropertyField.stories.tsx': contrast,
  'ui/src/components/Properties/PropertyGroup.stories.tsx': contrast,
  'ui/src/components/Properties/PropertyPanel.stories.tsx': contrast,
  'ui/src/components/Properties/PropertyRow.stories.tsx': contrast,
  'ui/src/components/Properties/RowScope.stories.tsx': contrast,
  'ui/src/components/Properties/Subpanel.stories.tsx': contrast,
  'ui/src/components/TextArea/TextArea.stories.tsx': contrast,
  'ui/src/components/Timeline/Timeline.stories.tsx': contrast,
  'ui/src/components/ToggleChips/ToggleChips.stories.tsx': contrast,
};

/**
 * Story files the sweep does not render, by file under `packages/`, each with why. Only for a story that faults before
 * axe can look at it; a violation goes in KNOWN instead.
 */
export const UNSWEPT: Readonly<Record<string, string>> = {
  'labkit/src/clock/ClockFrames.stories.tsx':
    'faults in the browser sweep with "usePlayhead: this story declares no timeline" though it declares one; renders under runStory in jsdom (2026-11-20)',
};

/** Rules the sweep turns off for every story (`OFF` in `a11y.suite.tsx`) that a story file is still judged on, by file under `packages/`. */
export const JUDGED: Readonly<Record<string, readonly string[]>> = {
  'ui/src/components/BandEditor/BandEditor.stories.tsx': ['label-content-name-mismatch'],
};
