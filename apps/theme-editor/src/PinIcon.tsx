/**
 * A pushpin, drawn head-on: a round head, a collar, and a tapered needle.
 * Sized for chrome — the collar is what keeps it reading as a pin rather than
 * a lollipop once it is down at 10px and the head is three pixels across.
 */
export function PinIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 1.2a2.3 2.3 0 0 1 2.3 2.3c0 .9-.5 1.5-.5 2.2 0 .5.4.8.9 1 .3.1.5.3.5.6H2.8c0-.3.2-.5.5-.6.5-.2.9-.5.9-1 0-.7-.5-1.3-.5-2.2A2.3 2.3 0 0 1 6 1.2Z"
        fill="currentColor"
      />
      <path d="M6 7.6V11" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </svg>
  );
}
