export function pathLeaf(
  path: string | null | undefined,
  fallback: string
): string {
  if (!path) return fallback
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? fallback
}
