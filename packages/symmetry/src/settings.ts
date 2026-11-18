import { pref, type PrefValuesOf } from '@weasel-js/prefs-schema';
import { HORIZONTAL_AXIS, VERTICAL_AXIS, type SymmetrySpec } from './kinds';

/** The ways live symmetry can mirror, as its settings name them. */
export type SymmetryAxis = 'vertical' | 'horizontal' | 'both';

/**
 * Live symmetry's settings, as a prefs group to mount in an app's schema: whether drawing goes into a symmetry group,
 * and which way that group mirrors. The axis is disabled while symmetry is off.
 */
export const symmetrySchema = pref.group('Symmetry', {
  on: pref.boolean('Symmetry', false, {
    description: 'Draw into a symmetry group, whose mirrored copies follow every edit to what is drawn in it, and the anchors you drag on a path that is already its own mirror image. Drag the handles on the axis to move or turn it. Turning it off stops drawing into the group; what is in it stays mirrored.',
  }),
  axis: pref.enum<SymmetryAxis>('Symmetry axis', 'vertical', [
    { value: 'vertical', label: 'Vertical (left and right)' },
    { value: 'horizontal', label: 'Horizontal (top and bottom)' },
    { value: 'both', label: 'Both' },
  ], {
    description: 'Which way the symmetry group mirrors: left and right, top and bottom, or into all four quarters.',
    enableIf: { from: 'group', path: 'on', is: true },
  }),
});

/** Live symmetry's settings: the values a {@link symmetrySchema} group holds. */
export type SymmetrySettings = PrefValuesOf<typeof symmetrySchema>;

const SPECS: Readonly<Record<SymmetryAxis, Pick<SymmetrySpec, 'kind' | 'angle'>>> = {
  vertical: { kind: 'mirror', angle: VERTICAL_AXIS },
  horizontal: { kind: 'mirror', angle: HORIZONTAL_AXIS },
  both: { kind: 'both', angle: HORIZONTAL_AXIS },
};

/** The kind and angle of the symmetry group an axis setting draws into. */
export const symmetrySpecFor = (axis: SymmetryAxis): Pick<SymmetrySpec, 'kind' | 'angle'> => SPECS[axis];
