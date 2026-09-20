/**
 * The style axis of a font variant, one declaration for the whole stack.
 *
 * Written inline as `'normal' | 'italic'` in half a dozen places before this,
 * across the font/text package line — identical value sets, so nothing could
 * drift until someone added `'oblique'`, and then it would have drifted
 * silently in every place that had not been found.
 */
export type FontStyle = 'normal' | 'italic';
