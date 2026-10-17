import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as uiIcons } from '../icons.table';
import { icon } from '../icons.gen';
import { Icon } from './Icon';

afterEach(cleanup);

describe('<Icon> from the registry', () => {
  it('draws the glyph the registry holds', async () => {
    const screen = render(<IconRegistryProvider icons={uiIcons}><Icon name={icon('close')} label="Close" /></IconRegistryProvider>);
    const svg = screen.getByRole('img', { name: 'Close' }) as unknown as SVGSVGElement;
    // Parsed the same way, so the comparison ignores how the browser serializes a self-closed element.
    const expected = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expected.innerHTML = uiIcons.icons.close!.body;
    expect(svg.innerHTML).toBe(expected.innerHTML);
    expect(svg.getBBox().width).toBeGreaterThan(0);
  });

  it('draws the placeholder for a name the registry lacks, warning once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const screen = render(
      <IconRegistryProvider icons={uiIcons}>
        <Icon name={'ui:nope' as never} label="A" />
        <Icon name={'ui:nope' as never} label="B" />
      </IconRegistryProvider>,
    );
    const svg = screen.getByRole('img', { name: 'A' }) as unknown as SVGSVGElement;
    expect(svg.querySelector('circle')).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/ui:nope/);
    warn.mockRestore();
  });

  it('composes a mark from the registry', async () => {
    const screen = render(<IconRegistryProvider icons={uiIcons}><Icon name={icon('close')} mark={icon('add')} label="M" /></IconRegistryProvider>);
    expect((screen.getByRole('img', { name: 'M' }) as unknown as SVGSVGElement).querySelector('mask')).not.toBeNull();
  });
});
