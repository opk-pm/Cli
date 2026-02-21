export const C = {
  reset: '\x1b[0m',
  pink: '\x1b[38;5;213m',
  purple: '\x1b[38;5;99m',
  lavender: '\x1b[38;5;183m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

export function paint(text: string, color: string): string {
  return `${color}${text}${C.reset}`
}
