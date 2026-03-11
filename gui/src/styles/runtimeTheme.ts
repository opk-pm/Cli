function getRootStyle(): CSSStyleDeclaration | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null
  }
  return window.getComputedStyle(document.documentElement)
}

export function readThemeColor(variable: string, fallback: string): string {
  const style = getRootStyle()
  if (!style) return fallback
  const value = style.getPropertyValue(variable).trim()
  return value || fallback
}

export function readThemeColorList(
  variables: readonly string[],
  fallback: readonly string[]
): string[] {
  return variables.map((variable, index) =>
    readThemeColor(
      variable,
      fallback[index] ?? fallback[fallback.length - 1] ?? 'currentColor'
    )
  )
}
