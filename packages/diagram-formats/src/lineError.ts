/** The error a text format's reader throws: the format, the line, and what is wrong there. */
export function lineError(format: string, line: number, message: string): Error {
  return new Error(`${format}, line ${line}: ${message}`);
}
