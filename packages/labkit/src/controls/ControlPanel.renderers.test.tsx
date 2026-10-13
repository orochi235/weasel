import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from './ControlPanel';

describe('<ControlPanel> renderers', () => {
  it('renderers[path] beats renderers[kind]', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#ffffff') }), []);
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => <span>by-kind</span>, tint: () => <span>by-path</span> }}
      />,
    );
    expect(screen.getByText('by-path')).toBeInTheDocument();
    expect(screen.queryByText('by-kind')).not.toBeInTheDocument();
  });

  it("a lab renderer for the path beats the node's own .render", () => {
    const schema = resolveConfigSchema(
      f.schema({ tint: f.color('#ffffff').render(() => <span>by-node</span>) }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ tint: () => <span>by-path</span> }}
      />,
    );
    expect(screen.getByText('by-path')).toBeInTheDocument();
  });

  it("a node's .render beats a lab renderer for the kind", () => {
    const schema = resolveConfigSchema(
      f.schema({ tint: f.color('#ffffff').render(() => <span>by-node</span>) }),
      [],
    );
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => <span>by-kind</span> }}
      />,
    );
    expect(screen.getByText('by-node')).toBeInTheDocument();
  });

  it('supplies a control for a kind labkit does not ship', () => {
    const schema = resolveConfigSchema(f.schema({ offset: f.custom('vector2', { x: 1 }) }), []);
    render(
      <ControlPanel
        schema={schema}
        config={{ offset: { x: 1 } }}
        setConfig={vi.fn()}
        renderers={{ vector2: (ctx) => <span>vec:{String((ctx.value as { x: number }).x)}</span> }}
      />,
    );
    expect(screen.getByText('vec:1')).toBeInTheDocument();
  });

  it('a renderer returning null collapses the row', () => {
    const schema = resolveConfigSchema(f.schema({ tint: f.color('#ffffff') }), []);
    render(
      <ControlPanel
        schema={schema}
        config={{ tint: '#ffffff' }}
        setConfig={vi.fn()}
        renderers={{ color: () => null }}
      />,
    );
    expect(screen.queryByText('Tint')).toBeNull();
  });
});
