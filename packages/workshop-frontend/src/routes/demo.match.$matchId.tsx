import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FounderMatch } from '../demo/FounderMatch'

export const Route = createFileRoute('/demo/match/$matchId')({
  component: DemoMatchPage,
})

function DemoMatchPage() {
  const { matchId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <FounderMatch
      matchId={matchId}
      onViewBoard={() => {
        void navigate({ to: '/demo/wanted' })
      }}
      onBackToWish={() => {
        void navigate({
          to: '/demo/wish/$wishId/confirm',
          params: { wishId: 'wish_syn_20260831_001' },
        })
      }}
    />
  )
}
