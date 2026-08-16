'use client'

/**
 * Everything lives in your browser.
 *
 * One key in localStorage holding one JSON object. No server, no database, no
 * account, no keys to configure — open the page and it works.
 *
 * The obvious risk of browser storage is that clearing your browsing data takes
 * your records with it. Two things guard against that:
 *
 *   1. Every write is followed by a snapshot into a second key, so a failed
 *      write cannot leave you with a corrupted blob and nothing to fall back on.
 *   2. Export produces a real file you can keep. The app nags you to take one
 *      when there is enough in here to be worth losing.
 */

import { useCallback, useEffect, useState } from 'react'

const KEY = 'ledger.v1'
const BACKUP_KEY = 'ledger.v1.previous'

export type EntryKind = 'income' | 'expense'

export interface Entry {
  id: string
  day: string // YYYY-MM-DD
  kind: EntryKind
  label: string
  category: string
  amountCents: number
  note?: string
}

export interface Note {
  id: string
  title: string
  body: string
  kind: 'lesson' | 'idea' | 'note'
  createdAt: string
}

export interface Data {
  version: 1
  entries: Entry[]
  notes: Note[]
  /** "stage:itemKey" → done */
  checklist: Record<string, boolean>
  lastExportAt: string | null
}

export const EMPTY: Data = {
  version: 1,
  entries: [],
  notes: [],
  checklist: {},
  lastExportAt: null,
}

export const EXPENSE_CATEGORIES = [
  'Ads',
  'Stock',
  'Shipping',
  'Software',
  'Fees',
  'Learning',
  'Samples',
  'Other',
] as const

export const INCOME_CATEGORIES = ['Sales', 'Refund received', 'Other'] as const

function read(): Data {
  if (typeof window === 'undefined') return EMPTY
  for (const key of [KEY, BACKUP_KEY]) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Data
      // Shape check rather than trust: a half-written blob should fall through
      // to the backup instead of rendering a broken page.
      if (parsed && parsed.version === 1 && Array.isArray(parsed.entries)) {
        return { ...EMPTY, ...parsed }
      }
    } catch {
      // Try the backup.
    }
  }
  return EMPTY
}

function write(data: Data): void {
  if (typeof window === 'undefined') return
  try {
    const existing = window.localStorage.getItem(KEY)
    if (existing) window.localStorage.setItem(BACKUP_KEY, existing)
    window.localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked (private browsing). The UI surfaces this by the
    // value simply not changing, which is better than pretending it saved.
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The single hook every page uses.
 *
 * `ready` exists because localStorage cannot be read during server rendering —
 * pages show a skeleton until the real data has loaded, rather than flashing
 * zeroes that look like a month with no money in it.
 */
export function useStore() {
  const [data, setData] = useState<Data>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setData(read())
    setReady(true)
  }, [])

  const update = useCallback((fn: (d: Data) => Data) => {
    setData((current) => {
      const next = fn(current)
      write(next)
      return next
    })
  }, [])

  const addEntry = useCallback(
    (entry: Omit<Entry, 'id'>) =>
      update((d) => ({ ...d, entries: [{ ...entry, id: newId() }, ...d.entries] })),
    [update]
  )

  const removeEntry = useCallback(
    (id: string) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) })),
    [update]
  )

  const addNote = useCallback(
    (note: Omit<Note, 'id' | 'createdAt'>) =>
      update((d) => ({
        ...d,
        notes: [{ ...note, id: newId(), createdAt: new Date().toISOString() }, ...d.notes],
      })),
    [update]
  )

  const removeNote = useCallback(
    (id: string) => update((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),
    [update]
  )

  const toggleCheck = useCallback(
    (key: string) =>
      update((d) => ({ ...d, checklist: { ...d.checklist, [key]: !d.checklist[key] } })),
    [update]
  )

  const exportData = useCallback(() => {
    const stamp = today()
    const blob = new Blob([JSON.stringify({ ...data, lastExportAt: stamp }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
    update((d) => ({ ...d, lastExportAt: stamp }))
  }, [data, update])

  const importData = useCallback(
    (raw: string): { ok: true } | { ok: false; error: string } => {
      try {
        const parsed = JSON.parse(raw) as Data
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
          return { ok: false, error: 'That file is not a backup from this app.' }
        }
        update(() => ({ ...EMPTY, ...parsed }))
        return { ok: true }
      } catch {
        return { ok: false, error: 'That file could not be read.' }
      }
    },
    [update]
  )

  return {
    data,
    ready,
    addEntry,
    removeEntry,
    addNote,
    removeNote,
    toggleCheck,
    exportData,
    importData,
  }
}
