import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { WishConfirmation } from '../demo/WishConfirmation'

export const Route = createFileRoute('/demo/wish_/$wishId/confirm')({
  component: DemoWishConfirmPage,
})

function DemoWishConfirmPage() {
  const { wishId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <WishConfirmation
      wishId={wishId}
      onConfirmed={(matchId) => {
        void navigate({
          to: '/demo/match/$matchId',
          params: { matchId },
        })
      }}
      onEdit={() => {
        void navigate({ to: '/demo/wish' })
      }}
      onDiscarded={() => {
        void navigate({ to: '/demo/wish' })
      }}
    />
  )
}
