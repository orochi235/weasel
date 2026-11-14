/** A rail part's own class, then the consumer's. */
export const railClass = (part: string, className: string | undefined): string =>
  className === undefined ? part : `${part} ${className}`;
