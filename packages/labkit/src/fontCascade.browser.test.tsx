/// <reference types="vite/client" />
import './styles.dev';
import { describeFontCascade, exportedComponents } from '@weasel-js/ui/testing/fontCascade';
import { storyCases } from '@weasel-js/ui/testing/teardown';
import { FIXTURES } from './fontCascade.fixtures';
import * as labkit from './index';
import { LabRoot } from './lab/LabRoot';

const ui = import.meta.glob<Record<string, unknown>>('../../ui/src/components/*/index.ts', {
  eager: true,
});

// Every labkit story inside a container set in a face of its own; see ui's `testing/fontCascade.tsx`. labkit's own
// components only: the ones it re-exports from ui are ui's file's to cover.
describeFontCascade('every labkit story sets its text in its container’s face, or a role’s', {
  // Interstellar is the theme's showcase: its faces are the subject.
  cases: [
    ...(await storyCases(
      import.meta.glob(['./**/*.stories.tsx', '!./theme/Interstellar.stories.tsx']),
    )),
    ...FIXTURES,
  ],
  components: exportedComponents(
    [labkit],
    new Set(Object.values(ui).flatMap((mod) => Object.keys(mod))),
  ),
  alsoKit: exportedComponents(Object.values(ui)),
  // forge's frame draws every labkit story inside one (apps/forge/forge.frame.tsx).
  wrap: LabRoot,
  unmounted: {},
  skip: {
    './canvas/CanvasStack.stories.tsx#Default':
      "calls forge's useArgs, which only forge's frame provides",
    './canvas/CanvasStack.stories.tsx#MultiLayer':
      "calls forge's useArgs, which only forge's frame provides",
    './canvas/CanvasStack.stories.tsx#WithScaleBar':
      "calls forge's useArgs, which only forge's frame provides",
    './clock/ClockFrames.stories.tsx#Frames':
      "reads forge's playhead, which only a story with a timeline has",
  },
});
