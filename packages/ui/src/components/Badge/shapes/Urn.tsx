import type { ShapeModule } from '../types';

const d = 'M 35 0 L 30 12 Q 15 30 15 55 Q 15 75 30 90 L 30 100 L 70 100 L 70 90 Q 85 75 85 55 Q 85 30 70 12 L 65 0 Z';

const Urn: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.05) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 4, right: 12, bottom: 4, left: 12 },
  stretches: true,
};

export default Urn;
