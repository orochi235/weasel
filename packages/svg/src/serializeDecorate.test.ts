import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/core';
import { serializeSvg } from './serialize';
import type { SvgNode } from './types';

const path = (extra: Record<string, unknown> = {}): SvgNode => ({
  kind: 'path' as const,
  path: pathFromD('M0 0 L50 0'),
  fill: { kind: 'none' as const },
  stroke: { paint: { kind: 'solid' as const, color: '#000' }, width: 2 },
  ...extra,
} as SvgNode);

describe('serializeSvg decorate', () => {
  it('adds attributes to the element carrying the id', () => {
    const out = serializeSvg([path({ id: 'a' })], { decorate: { attrsOf: () => ({ pathLength: '1' }) } });
    expect(out).toMatch(/<path id="a" [^>]*pathLength="1"/);
  });

  it('writes children inside the element, making it non-empty', () => {
    const out = serializeSvg([path({ id: 'a' })], {
      decorate: { childrenOf: () => '<animate attributeName="opacity"/>' },
    });
    expect(out).toMatch(/<path id="a" [^>]*><animate attributeName="opacity"\/><\/path>/);
  });

  it('writes children after existing children of a group', () => {
    const group = { kind: 'group' as const, id: 'g', children: [path({ id: 'a' })] } as SvgNode;
    const out = serializeSvg([group], { decorate: { childrenOf: (id) => `<x data-for="${id}"/>` } });
    expect(out).toMatch(/<x data-for="g"\/><\/g>/);
  });

  it('puts style in a <style> right after the title, escaping < and &', () => {
    const out = serializeSvg([path()], { title: 'T', decorate: { style: 'a>b{x:1}c<d&e' } });
    expect(out).toContain('<title>T</title><style>a>b{x:1}c&lt;d&amp;e</style>');
  });

  it('escapes attribute values', () => {
    const out = serializeSvg([path({ id: 'a' })], { decorate: { attrsOf: () => ({ 'data-x': 'a"b<c&d' }) } });
    expect(out).toContain('data-x="a&quot;b&lt;c&amp;d"');
  });

  it('never asks about a node with no id', () => {
    const asked: string[] = [];
    const out = serializeSvg([path()], {
      decorate: { attrsOf: (id) => { asked.push(id); return { pathLength: '1' }; }, childrenOf: (id) => { asked.push(id); return '<a/>'; } },
    });
    expect(asked).toEqual([]);
    expect(out).not.toContain('pathLength');
  });

  it('decorates the outermost element of an outlined stroke', () => {
    const outlined = path({ id: 'o', path: pathFromD('M0 0 L50 0 L50 50 Z'), stroke: { paint: { kind: 'solid', color: '#000' }, width: 2, align: 'inner' } });
    const out = serializeSvg([outlined], { decorate: { attrsOf: () => ({ 'data-d': '1' }) } });
    expect(out.match(/data-d="1"/g)).toHaveLength(1);
    expect(out).toMatch(/<path id="o" [^>]*data-d="1"/);
  });

  it('warns once, naming the id, when a decorated node is written as sibling elements', () => {
    const warnings: string[] = [];
    const outlined = path({ id: 'o', path: pathFromD('M0 0 L50 0 L50 50 Z'), stroke: { paint: { kind: 'solid', color: '#000' }, width: 2, align: 'inner' } });
    serializeSvg([outlined], { decorate: { attrsOf: () => ({ 'data-d': '1' }) }, onWarn: (m) => warnings.push(m) });
    const ours = warnings.filter((m) => m.includes('decoration'));
    expect(ours).toHaveLength(1);
    expect(ours[0]).toContain('"o"');
  });

  it('does not warn for a plain path', () => {
    const warnings: string[] = [];
    serializeSvg([path({ id: 'a' })], { decorate: { attrsOf: () => ({ 'data-d': '1' }) }, onWarn: (m) => warnings.push(m) });
    expect(warnings.filter((m) => m.includes('decoration'))).toEqual([]);
  });
});
