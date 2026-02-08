"use client"

import { useRef, useCallback } from "react"

const MAX_UNDO_HISTORY = 20

export function useUndoHistory() {
  const historyRef = useRef<Map<number, string[]>>(new Map())

  const push = useCallback((pageIndex: number, state: string | null) => {
    const history = historyRef.current.get(pageIndex) || []
    history.push(state ?? "")
    if (history.length > MAX_UNDO_HISTORY) {
      history.splice(0, history.length - MAX_UNDO_HISTORY)
    }
    historyRef.current.set(pageIndex, history)
  }, [])

  const pop = useCallback((pageIndex: number): string | null => {
    const history = historyRef.current.get(pageIndex)
    if (!history || history.length === 0) return null

    const previousState = history.pop()!
    historyRef.current.set(pageIndex, history)
    return previousState === "" ? null : previousState
  }, [])

  const canUndo = useCallback((pageIndex: number): boolean => {
    const history = historyRef.current.get(pageIndex)
    return !!history && history.length > 0
  }, [])

  const rebuild = useCallback((oldToNewIndexMap: Map<number, number>) => {
    const oldHistory = historyRef.current
    const newHistory = new Map<number, string[]>()

    for (const [oldIdx, newIdx] of oldToNewIndexMap.entries()) {
      const hist = oldHistory.get(oldIdx)
      if (hist && hist.length > 0) {
        newHistory.set(newIdx, [...hist])
      }
    }

    historyRef.current = newHistory
  }, [])

  const clear = useCallback(() => {
    historyRef.current.clear()
  }, [])

  return {
    push,
    pop,
    canUndo,
    rebuild,
    clear,
  }
}
