import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import type { IconTable } from '@weasel-js/icons';
import { render } from '@testing-library/react';
import { WeaselProvider } from './WeaselProvider';
import { useActionsRegistry, useSelectionContext } from '@weasel-js/routing/react';
import { IconRegistryProvider, useIconGlyph, useIconRegistry } from './iconRegistry';

/** Reports the registry identities visible at this point in the tree. */
function Probe({ into }: { into: { actions: unknown[]; selection: unknown[] } }) {
  into.actions.push(useActionsRegistry());
  into.selection.push(useSelectionContext());
  return null;
}

describe('WeaselProvider', () => {
  it('defers to a provider already in scope', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <Probe into={seen} />
        <WeaselProvider>
          <Probe into={seen} />
        </WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBeNull();
    expect(seen.actions[1]).not.toBeNull();
    expect(seen.selection[1]).toBe(seen.selection[0]);
    // Deferring means the inner provider is the outer one.
    expect(seen.actions[1]).toBe(seen.actions[0]);
  });

  it('mounts its own scope under `isolate`, ignoring the one in scope', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <Probe into={seen} />
        <WeaselProvider isolate>
          <Probe into={seen} />
        </WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBeNull();
    expect(seen.actions[1]).not.toBeNull();
    expect(seen.actions[1]).not.toBe(seen.actions[0]);
    expect(seen.selection[1]).not.toBe(seen.selection[0]);
  });

  it('gives two isolated siblings a scope each', () => {
    const seen = { actions: [] as unknown[], selection: [] as unknown[] };
    render(
      <WeaselProvider>
        <WeaselProvider isolate><Probe into={seen} /></WeaselProvider>
        <WeaselProvider isolate><Probe into={seen} /></WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen.actions[0]).not.toBe(seen.actions[1]);
  });

  // Icons are settled when the app is built, so an isolated canvas still draws the app's.
  it('keeps the icon registry in scope under `isolate`', () => {
    const seen: unknown[] = [];
    const Icons = () => { seen.push(useIconRegistry()); return null; };
    render(
      <WeaselProvider icons={[]}>
        <Icons />
        <WeaselProvider isolate><Icons /></WeaselProvider>
      </WeaselProvider>,
    );
    expect(seen[0]).not.toBeNull();
    expect(seen[1]).toBe(seen[0]);
  });

  it('keeps its tree mounted when `icons` or `iconVariants` comes or goes', () => {
    const table: IconTable = {
      namespace: 'core', owner: '@weasel-js/core',
      icons: { undo: { body: '<path d="u"/>', group: 'History', tags: [] } },
    };
    let mounts = 0;
    function Child() {
      useEffect(() => { mounts++; }, []);
      return <span>{useIconGlyph('core:undo')?.body ?? 'none'}</span>;
    }
    const tree = (props: { icons?: IconTable; iconVariants?: Record<string, never> }) => (
      <IconRegistryProvider><WeaselProvider {...props}><Child /></WeaselProvider></IconRegistryProvider>
    );
    const { rerender, container } = render(tree({}));
    expect(container.textContent).toBe('none');
    rerender(tree({ icons: table }));
    expect(container.textContent).toBe('<path d="u"/>');
    rerender(tree({}));
    expect(container.textContent).toBe('none');
    rerender(tree({ iconVariants: {} }));
    rerender(tree({}));
    expect(mounts).toBe(1);
  });
});
