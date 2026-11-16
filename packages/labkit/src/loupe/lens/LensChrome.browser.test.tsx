import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { type Action, ActionsProvider, useActionsRegistry } from '@weasel-js/core';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { useEffect, useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { LensChrome } from './LensChrome';
import type { LensSources } from './lensSource';
import { LENS_DEFAULTS, type LensIds, type LensReadout } from './lensTypes';

// Which readout toggles a drag crosses is a hit test against the laid-out strip.

afterEach(cleanup);

const live: LensSources<string>['live'] = {
  kind: 'live',
  produces: 'dom',
  label: () => 'Live',
  status: () => true,
  subscribe: () => () => {},
  attach: () => ({ update: () => {}, detach: () => {} }),
};

test('a drag across the readout toggles fires the toggle of each readout it reaches, once, and an Alt-drag solos', () => {
  const ran: string[] = [];
  // A lens whose toggle actions flip the readouts it draws, as a lab's do.
  function Lens() {
    const registry = useActionsRegistry();
    const [readouts, setReadouts] = useState<readonly LensReadout[]>([]);
    useEffect(() => {
      const offs = (['token', 'contrast', 'grid'] as const).map((r) =>
        registry?.register({
          id: `loupe.readout.${r}`,
          label: `Readout: ${r}`,
          invoker: {
            timing: 'immediate',
            run: () => {
              ran.push(r);
              setReadouts((now) => (now.includes(r) ? now.filter((x) => x !== r) : [...now, r]));
            },
          },
        } satisfies Action),
      );
      return () => {
        for (const off of offs) off?.();
      };
    }, [registry]);
    return (
      <LensChrome
        lens={{ lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds}
        settings={{ ...LENS_DEFAULTS, readouts }}
        sources={{ live }}
        reticle={{ x: 10, y: 20 }}
        size={{ width: 160, height: 160 }}
        describe={(c: string) => `vs ${c}`}
      />
    );
  }
  render(
    <ActionsProvider>
      <Lens />
    </ActionsProvider>,
  );
  const toggles = ['Token', 'Contrast', 'Grid'].map((name) => screen.getByRole('button', { name }));
  sweepAcross(toggles.slice(0, 2));
  expect(ran).toEqual(['token', 'contrast']);
  ran.length = 0;
  sweepAcross(toggles.slice(1), { altKey: true });
  expect([...ran].sort()).toEqual(['grid', 'token']);
  expect(toggles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'true']);
});
