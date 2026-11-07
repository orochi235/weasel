export function browserShape(
  cores: number,
  env?: Record<string, string | undefined>,
  options?: { beside?: boolean },
): { chromiums: number; tabs: number };
