import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

// forge gives a story controls only when its `render` takes args, so a story whose harness holds state still has to
// pass them through to the instance it draws. Each case sets a class and finds it in the DOM.

type Render = (args: never, ctx: never) => ReactNode;
type Story = { render?: Render; args?: object };

function draw(story: Story, args: object): void {
  if (!story.render) throw new Error('story has no render');
  expect(story.render.length).toBeGreaterThan(0);
  const run = story.render;
  function Host(): ReactElement {
    return <>{run({ ...story.args, ...args } as never, {} as never)}</>;
  }
  render(<Host />);
}

const stories = (mod: unknown) => mod as Record<string, Story>;

describe('a story drawing one stateful instance passes its args to it', { timeout: 60_000 }, () => {
  it.each([
    'Default',
    'Minimal',
    'Sections',
    'CustomControl',
    'Described',
    'Conditional',
    'EnableIf',
    'Nested',
    'Presentation',
    'Inline',
    'SidebarSliders',
    'AliasesIntoAnotherSchema',
  ])('ControlPanel %s', async (name) => {
    draw(stories(await import('./controls/ControlPanel.stories'))[name], { className: 'arg-here' });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });

  it.each(['Default', 'MultiLayer', 'WithScaleIndicator'])('CanvasStack %s', async (name) => {
    draw(stories(await import('./canvas/CanvasStack.stories'))[name], { className: 'arg-here' });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });

  it('TrialOverview Default', async () => {
    draw(stories(await import('./overview/TrialOverview.stories')).Default, {
      className: 'arg-here',
    });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });

  it('Readout ValuesComeAndGo', async () => {
    draw(stories(await import('./primitives/Readout.stories')).ValuesComeAndGo, {
      className: 'arg-here',
    });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });

  it('AutoControls Interactive', async () => {
    draw(stories(await import('./controls/AutoControls.stories')).Interactive, {
      className: 'arg-here',
    });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });
});
