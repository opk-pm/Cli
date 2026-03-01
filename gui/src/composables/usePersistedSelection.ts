import { ref, watch } from 'vue'

export function usePersistedSelection(storageKey: string) {
  const initialValue =
    typeof window === 'undefined'
      ? null
      : window.localStorage.getItem(storageKey)
  const selectedPath = ref<string | null>(initialValue)

  watch(selectedPath, value => {
    if (typeof window === 'undefined') return
    if (!value) {
      window.localStorage.removeItem(storageKey)
      return
    }
    window.localStorage.setItem(storageKey, value)
  })

  return selectedPath
}
