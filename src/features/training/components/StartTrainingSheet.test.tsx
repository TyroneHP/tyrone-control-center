import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDemoActiveSession,
  createDemoPlans,
} from '../demo/mockTrainingData'
import { StartTrainingSheet } from './StartTrainingSheet'

const [PLAN] = createDemoPlans()

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media: query,
    removeEventListener: vi.fn(),
  }))
})

describe('StartTrainingSheet', () => {
  it('omits the today-plan choice when no plan is assigned today', () => {
    render(
      <StartTrainingSheet
        activeSession={undefined}
        onClose={vi.fn()}
        onContinue={vi.fn()}
        onStartPlan={vi.fn()}
        open
        plans={[PLAN]}
        todayPlan={undefined}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Training starten' })
    expect(dialog).not.toHaveTextContent('Heutigen Plan')
    expect(dialog).toHaveTextContent('Anderen PlanFreies Training')
  })

  it('continues an active session instead of starting a selected plan', async () => {
    const onContinue = vi.fn()
    const onStartPlan = vi.fn()
    const user = userEvent.setup()
    render(
      <StartTrainingSheet
        activeSession={createDemoActiveSession()}
        onClose={vi.fn()}
        onContinue={onContinue}
        onStartPlan={onStartPlan}
        open
        plans={[PLAN]}
        todayPlan={PLAN}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Heutigen Plan' }))

    expect(onContinue).toHaveBeenCalledOnce()
    expect(onStartPlan).not.toHaveBeenCalled()
  })
})
