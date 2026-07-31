import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBar, StatusBarItem, StatusBarSpacer } from './StatusBar';

describe('StatusBar', () => {
  it('labels the bar without making it a live region', () => {
    const { container } = render(
      <StatusBar ariaLabel="Editor status"><StatusBarItem>tool: select</StatusBarItem></StatusBar>,
    );
    const bar = container.querySelector('footer')!;
    expect(bar.getAttribute('aria-label')).toBe('Editor status');
    // Readouts change on every pointer move; announcing them would be noise.
    expect(bar.getAttribute('role')).toBeNull();
    expect(bar.getAttribute('aria-live')).toBeNull();
  });

  it('gives titled items a help cursor affordance', () => {
    const { container } = render(
      <StatusBar>
        <StatusBarItem>plain</StatusBarItem>
        <StatusBarItem title="full detail">short</StatusBarItem>
      </StatusBar>,
    );
    const [plain, titled] = Array.from(container.querySelectorAll<HTMLElement>('span'));
    expect(titled.getAttribute('title')).toBe('full detail');
    expect(titled.className).not.toBe(plain.className);
  });

  it('hides the spacer from assistive tech', () => {
    const { container } = render(<StatusBar><StatusBarSpacer /></StatusBar>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
