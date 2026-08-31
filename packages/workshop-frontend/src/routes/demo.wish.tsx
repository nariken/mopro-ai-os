import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { WishForm } from '../demo/WishForm'

type DemoWishSearch = {
  demoFault?: 'structuring'
}

export const Route = createFileRoute('/demo/wish')({
  validateSearch: (search: Record<string, unknown>): DemoWishSearch => {
    if (search.demoFault === 'structuring') {
      return { demoFault: 'structuring' }
    }
    return {}
  },
  component: DemoWishPage,
})

function DemoWishPage() {
  const navigate = useNavigate()
  const { demoFault } = Route.useSearch()

  return (
    <WishForm
      demoFault={demoFault}
      onStructured={(wishId) => {
        void navigate({
          to: '/demo/wish/$wishId/confirm',
          params: { wishId },
        })
      }}
    />
  )
}
