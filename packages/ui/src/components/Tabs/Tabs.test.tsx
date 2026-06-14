import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Tabs, TabList, Tab, TabPanel } from './Tabs';

function Sample() {
  return (
    <Tabs>
      <TabList aria-label="Sections">
        <Tab id="a">A</Tab>
        <Tab id="b">B</Tab>
        <Tab id="c" isDisabled>C</Tab>
      </TabList>
      <TabPanel id="a">panel-a</TabPanel>
      <TabPanel id="b">panel-b</TabPanel>
      <TabPanel id="c">panel-c</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('selects the first tab by default', () => {
    render(<Sample />);
    expect(screen.getByText('panel-a')).toBeTruthy();
    expect(screen.queryByText('panel-b')).toBeNull();
  });

  it('switches panels when a tab is clicked', () => {
    render(<Sample />);
    fireEvent.click(screen.getByText('B'));
    expect(screen.getByText('panel-b')).toBeTruthy();
    expect(screen.queryByText('panel-a')).toBeNull();
  });

  it('does not switch to a disabled tab', () => {
    render(<Sample />);
    fireEvent.click(screen.getByText('C'));
    expect(screen.queryByText('panel-c')).toBeNull();
    expect(screen.getByText('panel-a')).toBeTruthy();
  });

  it('exposes role=tab on tab triggers', () => {
    render(<Sample />);
    expect(screen.getAllByRole('tab').length).toBe(3);
  });
});
