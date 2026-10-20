import { describe, expect, it } from 'vitest';
import { parseStyle, shapeOf, styleFlag, styleNumber, writeStyle } from './style';

describe('parseStyle', () => {
  it('reads key=value pairs and bare style names', () => {
    const style = parseStyle('ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;');
    expect(style.names).toEqual(['ellipse']);
    expect(style.values.get('fillColor')).toBe('#dae8fc');
    expect(style.values.get('html')).toBe('1');
  });

  it('reads an empty or missing style as nothing', () => {
    expect(parseStyle(null)).toEqual({ names: [], values: new Map() });
    expect(parseStyle(';;')).toEqual({ names: [], values: new Map() });
  });

  it('keeps everything after the first equals sign in a value', () => {
    expect(parseStyle('image=data:a=b;').values.get('image')).toBe('data:a=b');
  });

  it('lets a later pair win', () => {
    expect(parseStyle('rounded=0;rounded=1').values.get('rounded')).toBe('1');
  });
});

describe('reading values', () => {
  it('reads numbers and flags', () => {
    const style = parseStyle('fontSize=14;rounded=1;dashed=0;arcSize=x');
    expect(styleNumber(style, 'fontSize')).toBe(14);
    expect(styleNumber(style, 'arcSize')).toBeUndefined();
    expect(styleNumber(style, 'missing')).toBeUndefined();
    expect(styleFlag(style, 'rounded')).toBe(true);
    expect(styleFlag(style, 'dashed')).toBe(false);
    expect(styleFlag(style, 'missing')).toBe(false);
  });

  it('finds the shape by its key or by a bare name', () => {
    expect(shapeOf(parseStyle('shape=hexagon;size=0.2'))).toBe('hexagon');
    expect(shapeOf(parseStyle('rhombus;whiteSpace=wrap'))).toBe('rhombus');
    expect(shapeOf(parseStyle('rounded=1'))).toBeUndefined();
  });
});

describe('writeStyle', () => {
  it('writes names, then pairs, each ending in a semicolon', () => {
    expect(writeStyle(['ellipse', ['fillColor', '#fff'], ['fontSize', 12]])).toBe('ellipse;fillColor=#fff;fontSize=12;');
  });

  it('leaves out pairs with no value', () => {
    expect(writeStyle([['fillColor', undefined], ['html', 1]])).toBe('html=1;');
  });

  it('drops the separators a value cannot hold', () => {
    expect(writeStyle([['fontFamily', 'A;B=C']])).toBe('fontFamily=AB=C;');
  });

  it('reads back what it writes', () => {
    const style = parseStyle(writeStyle(['swimlane', ['horizontal', 0], ['startSize', 32]]));
    expect(style.names).toEqual(['swimlane']);
    expect(Object.fromEntries(style.values)).toEqual({ horizontal: '0', startSize: '32' });
  });
});
