import { useSyncExternalStore } from 'react'
import { EMPTY_FORM_VALUES } from './fixtures'
import type {
  DemoBoardCard,
  DemoMatch,
  DemoOffer,
  DemoSupplier,
  DemoWish,
  WishFormValues,
} from './types'

export const DEMO_STORAGE_KEY = 'mopro.synthetic-demo.v1'

export interface DemoStoreState {
  form: WishFormValues
  wish: DemoWish | null
  supplier: DemoSupplier | null
  offer: DemoOffer | null
  match: DemoMatch | null
  boardCard: DemoBoardCard | null
}

const EMPTY_STATE: DemoStoreState = {
  form: EMPTY_FORM_VALUES,
  wish: null,
  supplier: null,
  offer: null,
  match: null,
  boardCard: null,
}

type Listener = () => void

let memoryState: DemoStoreState = EMPTY_STATE
const listeners = new Set<Listener>()

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

function readPersisted(): DemoStoreState {
  if (!canUseSessionStorage()) return memoryState
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY)
    if (!raw) return { ...EMPTY_STATE, form: { ...EMPTY_FORM_VALUES } }
    const parsed = JSON.parse(raw) as Partial<DemoStoreState>
    return {
      form: { ...EMPTY_FORM_VALUES, ...parsed.form },
      wish: parsed.wish ?? null,
      supplier: parsed.supplier ?? null,
      offer: parsed.offer ?? null,
      match: parsed.match ?? null,
      boardCard: parsed.boardCard ?? null,
    }
  } catch {
    return { ...EMPTY_STATE, form: { ...EMPTY_FORM_VALUES } }
  }
}

function persist(state: DemoStoreState): void {
  memoryState = state
  if (canUseSessionStorage()) {
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
    } catch {
      // quota / private mode — keep memory only
    }
  }
  listeners.forEach((l) => l())
}

function getSnapshot(): DemoStoreState {
  return memoryState
}

function getServerSnapshot(): DemoStoreState {
  return EMPTY_STATE
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Hydrate from sessionStorage once on module load (browser only). */
export function hydrateDemoStore(): void {
  memoryState = readPersisted()
}

if (typeof window !== 'undefined') {
  hydrateDemoStore()
}

export const demoStore = {
  getState(): DemoStoreState {
    return memoryState
  },
  setForm(form: WishFormValues): void {
    persist({ ...memoryState, form })
  },
  setWish(wish: DemoWish | null): void {
    persist({ ...memoryState, wish })
  },
  setRecords(partial: {
    wish?: DemoWish | null
    supplier?: DemoSupplier | null
    offer?: DemoOffer | null
    match?: DemoMatch | null
    boardCard?: DemoBoardCard | null
  }): void {
    persist({ ...memoryState, ...partial })
  },
  reset(): void {
    memoryState = {
      form: { ...EMPTY_FORM_VALUES },
      wish: null,
      supplier: null,
      offer: null,
      match: null,
      boardCard: null,
    }
    if (canUseSessionStorage()) {
      try {
        sessionStorage.removeItem(DEMO_STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
    listeners.forEach((l) => l())
  },
  _replaceForTests(state: DemoStoreState): void {
    persist(state)
  },
}

export function useDemoStore(): DemoStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
