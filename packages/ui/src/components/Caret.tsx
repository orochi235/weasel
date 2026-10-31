/** The mark a trigger draws to say it opens a list or a popover. */
export function Caret({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 10" aria-hidden="true" data-caret="">
      <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
