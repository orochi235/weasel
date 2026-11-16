import { cleanup, render, screen } from '@testing-library/react';
import { useProvidedAmbient } from '@weasel-js/core';
import { devtoolsOff, lazyDevtools } from '@weasel-js/devtools/mount';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Decorator, StoryContext } from '../story/types';
import type { FrameSetup } from './FrameController';
import { frameDecorators } from './frameDecorators';

afterEach(() => cleanup());

function Taken() {
  const entry = useProvidedAmbient().find((e) => e.id === 'devtools');
  return <output aria-label="devtools">{entry === lazyDevtools ? 'on' : entry === devtoolsOff ? 'withheld' : 'none'}</output>;
}

const ctx = {} as StoryContext;
/** The story under every decorator, innermost first, as `StoryHost` applies them. */
function decorated(decorators: readonly Decorator[]): ReactNode {
  let inner: () => ReactNode = () => <Taken />;
  for (const decorate of decorators) {
    const wrapped = inner;
    inner = () => decorate(wrapped, ctx);
  }
  return inner();
}

describe('frameDecorators', () => {
  it("puts devtools outside the setup's own decorators, on in a development build", () => {
    const own: Decorator = (story) => <section aria-label="own">{story()}</section>;
    const setup: FrameSetup = { decorators: [own] };
    const all = frameDecorators(setup);
    expect(all[0]).toBe(own);
    render(<>{decorated(all)}</>);
    expect(screen.getByLabelText('devtools').textContent).toBe('on');
  });

  it('withholds devtools given devtools: false', () => {
    render(<>{decorated(frameDecorators({ devtools: false }))}</>);
    expect(screen.getByLabelText('devtools').textContent).toBe('withheld');
  });

  it('returns one array per setup, so a memoized story body keeps it', () => {
    const setup: FrameSetup = {};
    expect(frameDecorators(setup)).toBe(frameDecorators(setup));
  });
});
