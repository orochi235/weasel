import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// forge gives a story controls only when its `render` takes args, so a story drawing several applies them to each,
// under each cell's own props. Each case sets one arg and looks for it in the DOM.

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

describe('a story drawing several instances applies its args to each', () => {
  it.each(['SeveralAnchors', 'OneAnchor'])('AnchorFields %s', async (name) => {
    const mod = (await import('./inspector/AnchorFields/AnchorFields.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { unit: 'furlongs' });
    expect(screen.getAllByText('furlongs').length).toBeGreaterThan(0);
  });
});
