import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

// forge gives a story controls only when its `render` takes args, so a story whose harness holds state still has to
// pass them through to the instance it draws. Each case sets one arg and looks for it in the DOM.

type Render = (args: never, ctx: never) => ReactNode;
type Story = { render?: Render; args?: object };

function draw(story: Story | undefined, args: object): void {
  if (!story?.render) throw new Error('story has no render');
  expect(story.render.length).toBeGreaterThan(0);
  const run = story.render;
  function Host(): ReactElement {
    return <>{run({ ...story!.args, ...args } as never, {} as never)}</>;
  }
  render(<Host />);
}

describe('a story drawing one stateful instance passes its args to it', { timeout: 30_000 }, () => {
  it.each(['Empty', 'ARowPerKind', 'AnyOf', 'Groups', 'NoneOf', 'Problems', 'OverAnotherSchema'])('PrefConditionEditor %s', async (name) => {
    const mod = (await import('./PrefConditionEditor/PrefConditionEditor.stories')) as unknown as Record<string, Story>;
    draw(mod[name], { 'aria-label': 'Visible when' });
    expect(screen.getAllByLabelText('Visible when').length).toBeGreaterThan(0);
  });

  it('PrefSchemaEditor Default', async () => {
    const mod = (await import('./PrefSchemaEditor/PrefSchemaEditor.stories')) as unknown as Record<string, Story>;
    draw(mod.Default, { className: 'arg-here' });
    expect(document.querySelector('.arg-here')).not.toBeNull();
  });
});
