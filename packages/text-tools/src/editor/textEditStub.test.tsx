import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useTextEditDepSource } from './textEditStub';
import type { Scene, NodeId } from '@weasel-js/core';

function makeScene(text: boolean): Scene<unknown, string, unknown> {
  const node = { id: 'n', kind: 'mark' as const, pose: {}, data: text ? { text: 'hi' } : { kind: 'rect' } };
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => ['n'] as NodeId[],
    get: () => node as never,
  } as unknown as Scene<unknown, string, unknown>;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useTextEditDepSource', () => {
  it('registers a `textEdit` dep with stub startEdit, and an isTextNode that knows a text node by its string `text`', () => {
    let reg!: DepRegistry;
    function Wire() {
      useTextEditDepSource(makeScene(true));
      return null;
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('textEdit');
    expect(dep).toBeDefined();
    expect(dep.isTextNode('n')).toBe(true);
    dep.startEdit('n');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('isTextNode returns false for non-text nodes', () => {
    let reg!: DepRegistry;
    function Wire() {
      useTextEditDepSource(makeScene(false));
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('textEdit');
    expect(dep.isTextNode('n')).toBe(false);
  });
});

describe('useTextEditDepSource after an abandoned render', () => {
  afterEach(() => { cleanup(); });

  it('reads the committed scene', () => {
    const sceneWith = (data: unknown) => ({ layers: [{ id: 'default' }], get: () => ({ data }) }) as unknown as Scene<unknown, string, unknown>;
    let reg!: DepRegistry;
    function Wire({ s }: { s: Scene<unknown, string, unknown> }) {
      useTextEditDepSource(s);
      return null;
    }
    renderThenAbandon(sceneWith({ text: 'hi' }), sceneWith({}), (s) => (
      <DepRegistryProvider>
        <Wire s={s} />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>
    ));
    expect((reg.get as any)('textEdit').isTextNode('n')).toBe(true);
  });
});
