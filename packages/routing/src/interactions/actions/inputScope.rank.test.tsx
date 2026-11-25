import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DepRank, DepRegistryProvider, useDepRegistry, type DepName, type DepRegistry } from './depRegistry';
import { InputScope } from './inputScope';

describe('<DepRank> above an <InputScope>', () => {
  it('ranks the sources registered inside the scope', () => {
    let inside: DepRegistry | null = null;
    function Probe() {
      inside = useDepRegistry();
      return null;
    }
    render(
      <DepRegistryProvider>
        <DepRank rank={-1}>
          <InputScope><Probe /></InputScope>
        </DepRank>
      </DepRegistryProvider>,
    );
    const name = 'probe' as DepName;
    inside!.register(name, () => 'raised' as never, { rank: 0 });
    inside!.register(name, () => 'default' as never);
    expect(inside!.get(name)).toBe('raised');
  });
});
