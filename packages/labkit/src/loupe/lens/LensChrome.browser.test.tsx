import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { type Action, ActionsProvider, useActionsRegistry } from '@weasel-js/core';
import { sweepAcross } from '@weasel-js/ui/testing/sweep';
import { useEffect } from 'react';
import { afterEach, expect, test } from 'vitest';
import { LensChrome } from './LensChrome';
import type { LensSources } from './lensSource';
import { LENS_DEFAULTS, type LensIds } from './lensTypes';

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

test('a drag across the readout toggles fires the toggle of each readout it reaches, once', () => {
  const ran: string[] = [];
  function Spy() {
    const registry = useActionsRegistry();
    useEffect(() => {
      const offs = ['token', 'contrast', 'grid'].map((r) =>
        registry?.register({
          id: `loupe.readout.${r}`,
          label: `Readout: ${r}`,
          invoker: {
            timing: 'immediate',
            run: () => {
              ran.push(r);
            },
          },
        } satisfies Action),
      );
      return () => {
        for (const off of offs) off?.();
      };
    }, [registry]);
    return null;
  }
  render(
    <ActionsProvider>
      <Spy />
      <LensChrome
        lens={{ lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' } as LensIds}
        settings={{ ...LENS_DEFAULTS, readouts: [] }}
        sources={{ live }}
        reticle={{ x: 10, y: 20 }}
        size={{ width: 160, height: 160 }}
        describe={(c: string) => `vs ${c}`}
      />
    </ActionsProvider>,
  );
  sweepAcross(['Token', 'Contrast'].map((name) => screen.getByRole('button', { name })));
  expect(ran).toEqual(['token', 'contrast']);
});
