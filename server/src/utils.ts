export function bar(current: number, max: number, width: number): string {
  const filled = Math.max(0, Math.round((current / max) * width));
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
