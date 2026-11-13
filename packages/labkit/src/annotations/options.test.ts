import { createToolOptionValues, setToolOption } from '@weasel-js/routing';
import { createMemoryAdapter, openRecords } from '@weasel-js/storage';
import { describe, expect, it, vi } from 'vitest';
import {
  labToolOptionValues,
  MARK_LINE_OPTIONS,
  MARK_TEXT_OPTIONS,
  markStyleFrom,
} from './options';
import { MARK_COLOR, MARK_TEXT_SIZE, MARK_WIDTH } from './paint';

describe('markStyleFrom', () => {
  it('reads the defaults with nothing set', () => {
    const values = createToolOptionValues();
    expect(markStyleFrom('rect', MARK_LINE_OPTIONS, values)).toEqual({
      width: MARK_WIDTH,
      color: MARK_COLOR,
    });
    expect(markStyleFrom('text', MARK_TEXT_OPTIONS, values)).toEqual({
      fontSize: MARK_TEXT_SIZE,
      color: MARK_COLOR,
    });
  });

  it('shares one width and one color across the drawing tools, and the color with text', () => {
    const values = createToolOptionValues();
    setToolOption('rect', MARK_LINE_OPTIONS, values, 'width', 8);
    setToolOption('line', MARK_LINE_OPTIONS, values, 'color', '#0090ff');
    expect(markStyleFrom('stroke', MARK_LINE_OPTIONS, values)).toEqual({
      width: 8,
      color: '#0090ff',
    });
    expect(markStyleFrom('text', MARK_TEXT_OPTIONS, values).color).toBe('#0090ff');
  });

  it('reads nothing for a tool with no options', () => {
    expect(markStyleFrom('select', undefined, createToolOptionValues())).toEqual({});
  });
});

describe('labToolOptionValues', () => {
  it('keeps values in the records, notifies, and is one store per record cache', async () => {
    const records = await openRecords({ storage: createMemoryAdapter(), prefix: 'lab:' });
    const values = labToolOptionValues(records);
    expect(labToolOptionValues(records)).toBe(values);
    const heard = vi.fn();
    values.subscribe(heard);
    setToolOption('rect', MARK_LINE_OPTIONS, values, 'width', 5);
    expect(heard).toHaveBeenCalled();
    expect(markStyleFrom('ellipse', MARK_LINE_OPTIONS, values).width).toBe(5);
    expect(records.entries().some(([, v]) => JSON.stringify(v).includes('"markWidth":5'))).toBe(
      true,
    );
  });
});
