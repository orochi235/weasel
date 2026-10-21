import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KIT_SHAPE_KINDS } from '@weasel-js/core';
import { toIconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { icon } from '../../icons.gen';
import { ToolIcon } from './ToolIcon';

const html = (node: ReactElement) => render(node, { wrapper: withIcons }).container.innerHTML;

describe('ToolIcon', () => {
  it('draws the core glyph named after every kit shape tool', () => {
    for (const tool of [...KIT_SHAPE_KINDS, 'image']) {
      expect(html(<ToolIcon tool={tool} size={16} />), tool).toBe(html(<Icon name={toIconRef(`core:${tool}`)!} size={16} />));
    }
  });

  it('falls back to the unknown glyph for a tool the kit does not ship', () => {
    expect(html(<ToolIcon tool="sprocket" />)).toBe(html(<Icon name={icon('core:unknown')} />));
  });
});
