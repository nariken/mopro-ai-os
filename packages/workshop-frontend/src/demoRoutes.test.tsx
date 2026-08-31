// @vitest-environment jsdom
/* eslint-disable react/react-in-jsx-scope */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { FounderMatch } from './demo/FounderMatch'
import { WantedBoard } from './demo/WantedBoard'
import { WishConfirmation } from './demo/WishConfirmation'
import { WishForm } from './demo/WishForm'
import { demoStore } from './demo/demoStore'
import {
  FIXTURE_FORM_VALUES,
  PRIMARY_MATCH,
  PRIMARY_OFFER,
  PRIMARY_SUPPLIER,
  PRIMARY_WISH,
} from './demo/fixtures'
import { projectBoardCard } from './demo/boardProjection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
window.scrollTo = () => {}

function makeRouter(initialEntry: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const demoIndex = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo/',
    beforeLoad: () => {
      throw redirect({ to: '/demo/wish' })
    },
  })
  const demoWish = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo/wish',
    validateSearch: (search: Record<string, unknown>) =>
      search.demoFault === 'structuring' ? { demoFault: 'structuring' as const } : {},
    component: () => {
      const { demoFault } = demoWish.useSearch()
      return <WishForm demoFault={demoFault} skipDelay />
    },
  })
  const demoConfirm = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo/wish/$wishId/confirm',
    component: () => {
      const { wishId } = demoConfirm.useParams()
      return <WishConfirmation wishId={wishId} />
    },
  })
  const demoMatch = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo/match/$matchId',
    component: () => {
      const { matchId } = demoMatch.useParams()
      return <FounderMatch matchId={matchId} />
    },
  })
  const demoWanted = createRoute({
    getParentRoute: () => rootRoute,
    path: '/demo/wanted',
    component: () => <WantedBoard />,
  })
  const history = createMemoryHistory({ initialEntries: [initialEntry] })
  return createRouter({
    history,
    routeTree: rootRoute.addChildren([
      demoIndex,
      demoWish,
      demoConfirm,
      demoMatch,
      demoWanted,
    ]),
  })
}

describe('demo routes', () => {
  let container: HTMLDivElement | undefined
  let root: Root | undefined

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    demoStore.reset()
  })

  async function renderAt(initialEntry: string) {
    const router = makeRouter(initialEntry)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root!.render(<RouterProvider router={router} />))
    return { router, container }
  }

  it('redirects /demo/ to /demo/wish', async () => {
    const { router } = await renderAt('/demo/')
    expect(router.state.location.pathname).toBe('/demo/wish')
  })

  it('resolves the four journey routes', async () => {
    demoStore._replaceForTests({
      form: FIXTURE_FORM_VALUES,
      wish: PRIMARY_WISH,
      supplier: PRIMARY_SUPPLIER,
      offer: PRIMARY_OFFER,
      match: PRIMARY_MATCH,
      boardCard: projectBoardCard(PRIMARY_WISH.structured),
    })

    let r = await renderAt('/demo/wish')
    expect(r.container.textContent).toContain('Find a Japanese vintage lens you can trust.')
    await act(async () => root?.unmount())
    container?.remove()

    r = await renderAt(`/demo/wish/${PRIMARY_WISH.id}/confirm`)
    expect(r.container.textContent).toContain('Confirm your structured wish')
    await act(async () => root?.unmount())
    container?.remove()

    r = await renderAt(`/demo/match/${PRIMARY_MATCH.id}`)
    expect(r.container.textContent).toContain('Founder demo offer matched')
    await act(async () => root?.unmount())
    container?.remove()

    r = await renderAt('/demo/wanted')
    expect(r.container.textContent).toContain('Wanted in Japan')
  })

  it('unknown wishId shows empty confirm state', async () => {
    const { container: el } = await renderAt('/demo/wish/wish_unknown/confirm')
    expect(el.textContent).toContain('No structured wish found for this demo ID.')
  })

  it('unknown matchId shows empty match state', async () => {
    const { container: el } = await renderAt('/demo/match/match_unknown')
    expect(el.textContent).toMatch(/No synthetic (offer|match)/)
  })
})
