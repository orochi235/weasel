import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { BaseSampler, EffectModule } from '../bases/types';
import type { BadgeVariant } from '../types';
import Aqua from './Aqua';
import Bevel from './Bevel';
import Bevel2 from './Bevel2';
import Metal from './Metal';
import Sheen from './Sheen';
import Woodgrain from './Woodgrain';

const sampler: BaseSampler = {
  bodyPath: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
  perimeterAt: () => ({ x: 0, y: 0, nx: 0, ny: -1 }),
  totalCss: 400,
};

function Harness({ effect, variant }: { effect: EffectModule<any>; variant: BadgeVariant }) {
  const Component = effect.Component!;
  return (
    <svg>
      <Component sampler={sampler} boxW={100} boxH={100} variant={variant} params={{}} phase={0} />
    </svg>
  );
}

// One variant that renders (hooks run) and one that trips the early return
// (hooks skipped) for each effect. Aqua and Metal accept every real
// BadgeVariant, so their trip variant is a value outside that union — a
// value the Component prop can still receive at runtime.
const CASES: { name: string; effect: EffectModule<any>; renders: BadgeVariant; trips: BadgeVariant }[] = [
  { name: 'Aqua', effect: Aqua, renders: 'solid', trips: 'ghost' as BadgeVariant },
  { name: 'Bevel', effect: Bevel, renders: 'solid', trips: 'outline' },
  { name: 'Bevel2', effect: Bevel2, renders: 'solid', trips: 'outline' },
  { name: 'Metal', effect: Metal, renders: 'solid', trips: 'ghost' as BadgeVariant },
  { name: 'Sheen', effect: Sheen, renders: 'solid', trips: 'outline' },
  { name: 'Woodgrain', effect: Woodgrain, renders: 'solid', trips: 'outline' },
];

// A `useId()` called above the early return keeps one hook identity across
// the whole component lifetime, so its id is stable across any sequence of
// re-renders. Called below a return that fires conditionally, React treats
// each post-skip render as a fresh mount (its dispatcher choice is driven by
// whether the previous commit's hook list was empty) — the id churns every
// time the effect's hooks got skipped and then reinstated. That churn is
// this bug's actual observable symptom for a `return null` positioned as the
// very first statement, before any hook: not a thrown "rendered fewer hooks"
// error (React's mount/update dispatcher choice absorbs the fully-skipped
// case without complaint), but a silently unstable clipPath id.
describe('Badge effect hook order across variant toggles', () => {
  for (const { name, effect, renders, trips } of CASES) {
    it(`${name} keeps a stable clipPath id across a variant round trip`, () => {
      const { container, rerender } = render(<Harness effect={effect} variant={renders} />);
      const idBefore = container.querySelector('clipPath')?.id;
      rerender(<Harness effect={effect} variant={trips} />);
      rerender(<Harness effect={effect} variant={renders} />);
      const idAfter = container.querySelector('clipPath')?.id;
      expect(idBefore).toBeTruthy();
      expect(idAfter).toBe(idBefore);
    });
  }
});
