import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '@testing-library/react';
import { useActionsRegistry } from '@weasel-js/core';
import type { RecordCache } from '@weasel-js/storage';
import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import { type Context, createElement, type ReactNode, use, useContext } from 'react';
import { describe, expect, it } from 'vitest';
import { LabStoreContext, LabStoreProvider, TrialIdContext } from '../state/context';
import { PersistenceContext } from '../state/Persistence';
import { createLabStore } from '../state/store';
import { interstellarTheme } from '../theme/interstellar';
import { LabActions } from './LabActions';
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

  it('hides every context labkit defines', async () => {
    const root = resolve(__dirname, '..');
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
      (f) => /\.tsx?$/.test(f) && !/\.(test|stories)\./.test(f),
    );
    const contexts: [string, Context<never>][] = [];
    for (const file of files) {
      const names = [...readFileSync(join(root, file), 'utf8').matchAll(/(\w+) = createContext\b/g)].map(
        (m) => m[1] as string,
      );
      if (names.length === 0) continue;
      const mod = (await import(/* @vite-ignore */ join(root, file))) as Record<string, unknown>;
      for (const name of names) {
        expect(mod[name], `${file} exports ${name}`).toBeDefined();
        contexts.push([`${file}:${name}`, mod[name] as Context<never>]);
      }
    }
    expect(contexts.length).toBeGreaterThan(40);
    const sentinel = { sentinel: true } as never;
    const seen: string[] = [];
    function Read() {
      for (const [name, ctx] of contexts) {
        if (use(ctx) === sentinel) seen.push(name);
      }
      return null;
    }
    const tree = contexts.reduceRight<ReactNode>(
      (inner, [, ctx]) => createElement(ctx.Provider, { value: sentinel }, inner),
      <LabBoundary>
        <Read />
      </LabBoundary>,
    );
    render(tree);
    expect(seen).toEqual([]);
  });

  it('gives its children an actions registry of their own, which the enclosing lab does not run', () => {
    let outer: unknown = null;
    let inner: unknown = null;
    function Outer() {
      outer = useActionsRegistry();
      return null;
    }
    function Inner() {
      inner = useActionsRegistry();
      return null;
    }
    render(
      <LabActions>
        <Outer />
        <LabBoundary>
          <Inner />
        </LabBoundary>
      </LabActions>,
    );
    expect(outer).not.toBeNull();
    expect(inner).not.toBe(outer);
  });
});
