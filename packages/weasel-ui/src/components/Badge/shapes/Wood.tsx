import type { ShapeModule } from '../types';

const body = 'M 8 30 Q 0 50 8 70 L 92 70 Q 100 50 92 30 Z';

const Wood: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={body} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={body} />}
      {(variant === 'outline' || variant === 'solid') && (
        <>
          {/* Long flowing grain curves */}
          <path className="badge-stroke" d="M 12 38 Q 30 35 50 39 T 88 38" opacity={0.5} fill="none" />
          <path className="badge-stroke" d="M 10 46 Q 36 49 54 45 T 90 47" opacity={0.4} fill="none" />
          <path className="badge-stroke" d="M 12 54 Q 28 51 52 56 T 88 54" opacity={0.55} fill="none" />
          <path className="badge-stroke" d="M 10 62 Q 40 65 58 61 T 90 62" opacity={0.4} fill="none" />
          {/* Knots (concentric ellipses around a darker core) */}
          <ellipse className="badge-stroke" cx="32" cy="50" rx="3.4" ry="2.8" opacity={0.7} fill="none" />
          <ellipse className="badge-stroke" cx="32" cy="50" rx="1.4" ry="1.1" opacity={0.85} fill="none" />
          <ellipse className="badge-stroke" cx="70" cy="42" rx="2.4" ry="2" opacity={0.6} fill="none" />
        </>
      )}
      {focused && (
        <path className="badge-focus" d={body} transform="translate(50 50) scale(1.05) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 10, right: 4, bottom: 10, left: 4 },
  stretches: true,
};

export default Wood;
