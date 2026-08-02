import { useRef, type PointerEvent, type ReactNode } from 'react'

const SWIPE_THRESHOLD = 72

export interface ActiveExerciseNavigatorProps {
  children: ReactNode
  currentIndex: number
  exerciseCount: number
  onIndexChange: (index: number) => void
}

interface SwipeStart {
  pointerId: number
  x: number
  y: number
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, button, [contenteditable="true"]'))
}

export function ActiveExerciseNavigator({
  children,
  currentIndex,
  exerciseCount,
  onIndexChange,
}: ActiveExerciseNavigatorProps) {
  const swipeStart = useRef<SwipeStart | undefined>(undefined)
  const canMoveBack = currentIndex > 0
  const canMoveForward = currentIndex < exerciseCount - 1

  const move = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(currentIndex + direction, exerciseCount - 1))
    if (nextIndex !== currentIndex) onIndexChange(nextIndex)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    swipeStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = undefined
    if (!start || start.pointerId !== event.pointerId || isEditableTarget(event.target)) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      move(deltaX < 0 ? 1 : -1)
    }
  }

  return (
    <section aria-label="Übungsnavigation" className="active-exercise-navigator">
      <p aria-live="polite">{currentIndex + 1} von {exerciseCount} Übungen</p>
      <div
        className="active-exercise-navigator__content"
        data-testid="active-exercise-content"
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') move(-1)
          if (event.key === 'ArrowRight') move(1)
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        tabIndex={0}
      >
        {children}
      </div>
      <nav aria-label="Übung wechseln" className="active-exercise-navigator__actions">
        <button disabled={!canMoveBack} onClick={() => move(-1)} type="button">
          Vorherige Übung
        </button>
        <button disabled={!canMoveForward} onClick={() => move(1)} type="button">
          Nächste Übung
        </button>
      </nav>
    </section>
  )
}
