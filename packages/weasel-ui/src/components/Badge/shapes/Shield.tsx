import type { ShapeModule } from '../types';

const d = 'M 8 4 Q 8 0 12 0 L 88 0 Q 92 0 92 4 L 92 55 Q 92 86 50 100 Q 8 86 8 55 Z';

const Shield: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.07) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 2, right: 8, bottom: 12, left: 8 },
  stretches: false,
  defaultAspect: 0.85,
};

export default Shield;
