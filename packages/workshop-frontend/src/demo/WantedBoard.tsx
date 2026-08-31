import { EmptyState } from '../components/EmptyState'
import { WorkshopButton } from '../components/WorkshopControls'
import { BoardCard } from './BoardCard'
import { COPY } from './copy'
import { DemoFrame } from './DemoFrame'
import { demoStore, useDemoStore } from './demoStore'

export type WantedBoardProps = {
  onStartOver?: () => void
  onViewMatch?: () => void
  onCreateWish?: () => void
  /** Force empty state for tests. */
  forceEmpty?: boolean
}

export function WantedBoard({
  onStartOver,
  onViewMatch,
  onCreateWish,
  forceEmpty = false,
}: WantedBoardProps) {
  const store = useDemoStore()
  const card =
    !forceEmpty && store.wish?.status === 'confirmed' && store.boardCard
      ? store.boardCard
      : null

  if (!card) {
    return (
      <DemoFrame badge="privacy" title={COPY.board.h1} wide>
        <EmptyState
          title={COPY.board.empty}
          description="Confirm a synthetic wish to preview a privacy-safe board card."
          actionLabel={COPY.board.createWish}
          onAction={onCreateWish ?? (() => undefined)}
        />
      </DemoFrame>
    )
  }

  return (
    <DemoFrame badge="privacy" title={COPY.board.h1} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BoardCard card={card} />
      </div>
      <p className="mt-4 text-[12px] text-kumo-subtle">{COPY.board.footer}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <WorkshopButton
          tone="primary"
          type="button"
          onClick={() => {
            demoStore.reset()
            onStartOver?.()
          }}
        >
          {COPY.board.primary}
        </WorkshopButton>
        <WorkshopButton type="button" onClick={onViewMatch}>
          {COPY.board.secondary}
        </WorkshopButton>
      </div>
    </DemoFrame>
  )
}
