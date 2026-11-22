import { expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ShortcutSheet } from './ShortcutSheet';

it('renders on the server while closed', () => {
  expect(() => renderToString(<ShortcutSheet open={false} onOpenChange={() => {}} />)).not.toThrow();
});
