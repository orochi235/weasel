import type { ReactNode } from 'react';

export function Cell({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? 'lk-specimen__cell lk-specimen__cell--wide' : 'lk-specimen__cell'}>
      <span className="lk-specimen__label">{label}</span>
      {children}
    </div>
  );
}
