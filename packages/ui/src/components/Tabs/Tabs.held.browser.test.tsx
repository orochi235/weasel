import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Tabs, TabList, Tab, TabPanel } from '@weasel-js/ui/components/Tabs';

afterEach(cleanup);

test('a real keyboard lands on a disabled tab, shows why, and leaves the chosen panel up', async () => {
  render(
    <Tabs>
      <TabList aria-label="Sections">
        <Tab id="a">A</Tab>
        <Tab id="b" disabled disabledReason="Add a layer first">B</Tab>
        <Tab id="c">C</Tab>
      </TabList>
      <TabPanel id="a">panel-a</TabPanel>
      <TabPanel id="b">panel-b</TabPanel>
      <TabPanel id="c">panel-c</TabPanel>
    </Tabs>,
  );
  await userEvent.click(screen.getByRole('tab', { name: 'A' }));
  await userEvent.keyboard('{ArrowRight}');
  const b = screen.getByRole('tab', { name: 'B' });
  expect(document.activeElement).toBe(b);
  expect(b.getAttribute('aria-disabled')).toBe('true');
  expect((await screen.findByRole('tooltip')).textContent).toContain('Add a layer first');
  expect(screen.getByText('panel-a')).toBeTruthy();
  expect(screen.queryByText('panel-b')).toBeNull();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByText('panel-c')).toBeTruthy();
});
