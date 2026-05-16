import type { ShapeModule } from '../types';

const Pill: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" rx="50" ry="50" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="1" y="1" width="98" height="98" rx="49" ry="49" />
      )}
      {focused && (
        <rect className="badge-focus" x="-3" y="-3" width="106" height="106" rx="53" ry="53" />
      )}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export default Pill;
