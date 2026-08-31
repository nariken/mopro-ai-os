import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FIXTURE_IDS } from '../demo/fixtures'
import { WantedBoard } from '../demo/WantedBoard'

export const Route = createFileRoute('/demo/wanted')({
  component: DemoWantedPage,
})

function DemoWantedPage() {
  const navigate = useNavigate()

  return (
    <WantedBoard
      onStartOver={() => {
        void navigate({ to: '/demo/wish' })
      }}
      onViewMatch={() => {
        void navigate({
          to: '/demo/match/$matchId',
          params: { matchId: FIXTURE_IDS.match },
        })
      }}
      onCreateWish={() => {
        void navigate({ to: '/demo/wish' })
      }}
    />
  )
}
