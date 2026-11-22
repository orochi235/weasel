import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { Button, Dialog, DialogTrigger, Popover } from 'react-aria-components';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { SpanStrips } from '@weasel-js/ui/components/SpanStrip';

afterEach(cleanup);

// Hit testing is what decides which copy a click reaches, so this needs a real browser.

const menu = (
  <DialogTrigger>
    <Button>Details</Button>
    <Popover><Dialog aria-label="Span details">Inside</Dialog></Popover>
  </DialogTrigger>
);

describe("a control in a span's content", () => {
  it('opens its popover when clicked left of the playhead', async () => {
    render(<SpanStrips window={{ from: 0, to: 10 }} at={8} rows={[{ id: 'a', 'aria-label': 'a', spans: [{ id: 'a1', label: 'a', ms: 10, content: menu }] }]} />);
    const buttons = [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Details');
    expect(buttons.filter((b) => b.closest('[inert]') === null)).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(await screen.findByRole('dialog', { name: 'Span details' })).toBeVisible();
  });
});
