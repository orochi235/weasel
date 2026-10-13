import { render } from '@testing-library/react';
import type { RecordCache } from '@weasel-js/storage';
import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import { useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { LabStoreContext, LabStoreProvider, TrialIdContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import { createLabStore } from '../state/store';
import { interstellarTheme } from '../theme/interstellar';
import { LabBoundary } from './LabBoundary';
import { LabContext, type LabContextValue } from './LabContext';
import { LabRoot } from './LabRoot';

function Probe() {
  const lab = useContext(LabContext);
  const store = useContext(LabStoreContext);
  const trial = useContext(TrialIdContext);
  const records = useContext(PersistenceContext);
  const theme = useThemeOptional();
  return (
    <output>
      {JSON.stringify({
        lab: lab !== null,
        store: store !== null,
        trial,
        records: records !== null,
        theme: theme !== null,
      })}
    </output>
  );
}

const fakeLab = { trials: [], instruments: [] } as unknown as LabContextValue;

describe('LabBoundary', () => {
  it('hides the enclosing lab, trial, records and theme from its children', () => {
    const { container } = render(
      <ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>
        <LabStoreProvider store={createLabStore({})}>
          <PersistenceContext.Provider value={{} as RecordCache}>
            <LabContext.Provider value={fakeLab}>
              <TrialIdContext.Provider value="t1">
                <Probe />
                <LabBoundary>
                  <Probe />
                </LabBoundary>
              </TrialIdContext.Provider>
            </LabContext.Provider>
          </PersistenceContext.Provider>
        </LabStoreProvider>
      </ThemeProvider>,
    );
    const [outside, inside] = Array.from(container.querySelectorAll('output')).map((el) =>
      JSON.parse(el.textContent ?? ''),
    );
    expect(outside).toEqual({ lab: true, store: true, trial: 't1', records: true, theme: true });
    expect(inside).toEqual({ lab: false, store: false, trial: null, records: false, theme: false });
  });

  it('lets a LabRoot under it apply its own theme instead of deferring to the one above', () => {
    const { container } = render(
      <ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>
        <LabBoundary>
          <LabRoot mode="light">x</LabRoot>
        </LabBoundary>
      </ThemeProvider>,
    );
    const themed = container.querySelectorAll('[data-wzl-theme]');
    expect(themed).toHaveLength(2);
    expect(themed[1]?.getAttribute('data-wzl-mode')).toBe('light');
  });
});
