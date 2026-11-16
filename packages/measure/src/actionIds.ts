/** The ids of the measure feature's actions. */
export const MEASURE_ACTION_IDS = {
  /** The measure tool's drag, which adds a measurement. */
  measure: 'measure',
  /** The measure tool's click, which picks the measurement under it. */
  pickAt: 'measure.pickAt',
  /** A click on a measurement under any tool, which picks it. */
  pick: 'measure.pick',
  /** A drag on a measurement under any tool: a picked end moves that end, the
   *  rest moves the whole measurement. */
  drag: 'measure.drag',
  moveBy: 'measure.moveBy',
  rotateBy: 'measure.rotateBy',
  delete: 'measure.delete',
  clear: 'measure.clear',
  unpick: 'measure.unpick',
} as const;
