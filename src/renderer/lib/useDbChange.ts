import { useEffect, useRef } from 'react'

const THROTTLE_MS = 500

export function useDbChange(callback: () => void): void {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const fire = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        cbRef.current()
      }, THROTTLE_MS)
    }

    const unsubscribe = window.electronAPI.onDbChange(fire)
    window.addEventListener('focus', fire)

    return () => {
      unsubscribe()
      window.removeEventListener('focus', fire)
      if (timer) clearTimeout(timer)
    }
  }, [])
}
