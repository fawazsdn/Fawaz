let counter = 0;

/** Generates a short, readable, collision-safe id for locally-created mock entities. */
export function uid(prefix: string): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rand}${counter}`;
}
