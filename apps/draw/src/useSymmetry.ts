import { createSymmetryStore, symmetryContribution, type SymmetryAxis, useLatest } from '@weasel-js/core';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AppCommands } from './appCommands';
import { usePref } from './prefs';

type Point = { x: number; y: number };

const AXES: readonly SymmetryAxis[] = ['vertical', 'horizontal', 'both'];

/**
 * Live symmetry, driven by the View preferences: the canvas entry that
 * publishes it and draws the axis across the page, and the toggle the command
 * bar fires. The axis starts at the page center; where it is dragged to holds
 * until the page changes size.
 */
export function useSymmetry(page: { width: number; height: number }) {
  const [on, setOn] = usePref('view.symmetry');
  const [axisPref] = usePref('view.symmetryAxis');
  const axis = AXES.find((a) => a === axisPref) ?? 'vertical';
  const [store] = useState(() => createSymmetryStore());
  const pageRef = useLatest(page);
  const dragged = useRef<Point | null>(null);
  const sizedFor = useRef({ width: page.width, height: page.height });

  useLayoutEffect(() => store.subscribe(() => {
    dragged.current = store.get()?.center ?? dragged.current;
  }), [store]);

  const { width, height } = page;
  useLayoutEffect(() => {
    if (sizedFor.current.width !== width || sizedFor.current.height !== height) {
      sizedFor.current = { width, height };
      dragged.current = null;
    }
    const center = dragged.current ?? { x: width / 2, y: height / 2 };
    store.set(on ? { axis, center } : null);
  }, [store, on, axis, width, height]);

  const contribution = useMemo(() => symmetryContribution(store, {
    extent: () => ({ x: 0, y: 0, width: pageRef.current.width, height: pageRef.current.height }),
  }), [store, pageRef]);

  const commands: Pick<AppCommands, 'symmetryOn' | 'toggleSymmetry'> = {
    symmetryOn: on,
    toggleSymmetry: () => setOn(!on),
  };
  return { contribution, commands };
}
