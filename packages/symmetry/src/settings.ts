import { pref, type PrefValuesOf } from '@weasel-js/prefs-schema';
import { HORIZONTAL_AXIS, VERTICAL_AXIS, type SymmetrySpec } from './kinds';

/** The ways live symmetry can mirror, as its settings name them. */
export type SymmetryAxis = 'vertical' | 'horizontal' | 'both';

/**
 * Live symmetry's settings, as a prefs group to mount in an app's schema: which way the symmetry group drawn into
 * mirrors. Whether drawing goes into one is a mode the app holds for the session, not a setting.
 */
export const symmetrySchema = pref.group('Symmetry', {
  axis: pref.enum<SymmetryAxis>('Symmetry axis', 'vertical', [
    { value: 'vertical', label: 'Vertical (left and right)' },
    { value: 'horizontal', label: 'Horizontal (top and bottom)' },
    { value: 'both', label: 'Both' },
  ], {
    description: 'Which way the symmetry group mirrors: left and right, top and bottom, or into all four quarters.',
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
