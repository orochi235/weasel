import { describe, expect, it } from 'vitest';
import {
  isBody, isSelectedBody, isUnselectedBody, isEmpty,
  isResizeHandle, isRotateHandle, isAnchor, isControlHandle, isAnchorOrControl,
} from './predicates';

describe('body predicates', () => {
  it('isBody matches selected or unselected body', () => {
    expect(isBody(null, 'selected-body')).toBe(true);
    expect(isBody(null, 'unselected-body')).toBe(true);
    expect(isBody(null, 'empty')).toBe(false);
    expect(isBody(null, undefined)).toBe(false);
  });
  it('isSelectedBody / isUnselectedBody / isEmpty discriminate', () => {
    expect(isSelectedBody(null, 'selected-body')).toBe(true);
    expect(isSelectedBody(null, 'unselected-body')).toBe(false);
    expect(isUnselectedBody(null, 'unselected-body')).toBe(true);
    expect(isEmpty(null, 'empty')).toBe(true);
  });
});

describe('affordance-kind predicates', () => {
  it('isResizeHandle matches handle:* kinds', () => {
    expect(isResizeHandle({ kind: 'handle:top-left' })).toBe(true);
    expect(isResizeHandle({ kind: 'handle:bottom-right' })).toBe(true);
    expect(isResizeHandle({ kind: 'rotate-handle' })).toBe(false);
    expect(isResizeHandle({ kind: 'anchor:0' })).toBe(false);
    expect(isResizeHandle(null)).toBe(false);
  });
  it('isRotateHandle matches rotate-handle exactly', () => {
    expect(isRotateHandle({ kind: 'rotate-handle' })).toBe(true);
    expect(isRotateHandle({ kind: 'handle:top-left' })).toBe(false);
  });
  it('isAnchor matches anchor:N', () => {
    expect(isAnchor({ kind: 'anchor:0' })).toBe(true);
    expect(isAnchor({ kind: 'anchor:42' })).toBe(true);
    expect(isAnchor({ kind: 'controlIn:0' })).toBe(false);
    expect(isAnchor({ kind: 'anchor:' })).toBe(false);
  });
  it('isControlHandle matches controlIn:N / controlOut:N', () => {
    expect(isControlHandle({ kind: 'controlIn:0' })).toBe(true);
    expect(isControlHandle({ kind: 'controlOut:5' })).toBe(true);
    expect(isControlHandle({ kind: 'anchor:0' })).toBe(false);
  });
  it('isAnchorOrControl matches all three', () => {
    expect(isAnchorOrControl({ kind: 'anchor:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'controlIn:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'controlOut:0' })).toBe(true);
    expect(isAnchorOrControl({ kind: 'handle:top-left' })).toBe(false);
  });
});
