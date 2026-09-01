import { useCallback, useRef, useState } from 'react'
import type { ImageAsset } from '../types'

const MAX_HISTORY = 60

export function useImageHistory(initial: ImageAsset[]) {
  const [images, setImagesState] = useState(initial)
  const [revision, setRevision] = useState(0)
  const past = useRef<ImageAsset[][]>([])
  const future = useRef<ImageAsset[][]>([])
  const transientStart = useRef<ImageAsset[] | null>(null)

  const commit = useCallback((next: ImageAsset[] | ((current: ImageAsset[]) => ImageAsset[])) => {
    setImagesState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      if (value === current) return current
      past.current = [...past.current.slice(-(MAX_HISTORY - 1)), current]
      future.current = []
      setRevision((value) => value + 1)
      return value
    })
  }, [])

  const replace = useCallback((next: ImageAsset[]) => {
    setImagesState(next)
    past.current = []
    future.current = []
    transientStart.current = null
    setRevision((value) => value + 1)
  }, [])

  const updateTransient = useCallback(
    (next: ImageAsset[] | ((current: ImageAsset[]) => ImageAsset[])) => {
      setImagesState((current) => {
        if (!transientStart.current) transientStart.current = current
        return typeof next === 'function' ? next(current) : next
      })
    },
    [],
  )

  const finishTransient = useCallback(() => {
    if (!transientStart.current) return
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), transientStart.current]
    future.current = []
    transientStart.current = null
    setRevision((value) => value + 1)
  }, [])

  const undo = useCallback(() => {
    setImagesState((current) => {
      const previous = past.current.at(-1)
      if (!previous) return current
      past.current = past.current.slice(0, -1)
      future.current = [current, ...future.current]
      setRevision((value) => value + 1)
      return previous
    })
  }, [])

  const redo = useCallback(() => {
    setImagesState((current) => {
      const next = future.current[0]
      if (!next) return current
      future.current = future.current.slice(1)
      past.current = [...past.current, current]
      setRevision((value) => value + 1)
      return next
    })
  }, [])

  return {
    images,
    commit,
    replace,
    updateTransient,
    finishTransient,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  }
}

