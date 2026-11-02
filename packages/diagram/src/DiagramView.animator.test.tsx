import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { type Animator } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { DiagramView } from './DiagramView';
import { diagramScene } from './fromData';

afterEach(() => { cleanup(); });

const SPECS = diagramScene({ nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }], edges: [{ from: 'a', to: 'b' }] });

describe('DiagramView animator', () => {
  it("hands its canvas the animator, which repaints on the animator's trim overrides", async () => {
    let animator: Animator | undefined;
    let subscribe: MockInstance<Animator['trimOverrides']['subscribe']> | undefined;
    function Host() {
      const a = useAnimator();
      if (animator !== a) {
        animator = a;
        subscribe = vi.spyOn(a.trimOverrides, 'subscribe');
      }
      return <DiagramView specs={SPECS} width={300} height={200} animator={a} />;
    }
    await act(async () => { render(<Host />); });
    expect(subscribe).toHaveBeenCalled();
  });
});
