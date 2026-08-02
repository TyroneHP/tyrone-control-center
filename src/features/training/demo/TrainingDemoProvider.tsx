import {
  useCallback,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { createInitialTrainingDemoState } from './mockTrainingData'
import { trainingDemoReducer } from './trainingDemoReducer'
import type { TrainingDemoAction, TrainingDemoState } from './trainingDemoTypes'
import { TrainingDemoContext } from './useTrainingDemo'

export interface TrainingDemoContextValue {
  state: TrainingDemoState
  dispatch: Dispatch<TrainingDemoAction>
  startFreeSession: () => void
  toggleFavoriteExercise: (exerciseId: string) => void
}

export function TrainingDemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    trainingDemoReducer,
    undefined,
    createInitialTrainingDemoState,
  )
  const toggleFavoriteExercise = useCallback((exerciseId: string) => {
    dispatch({ type: 'favorite/toggle', exerciseId })
  }, [])
  const startFreeSession = useCallback(() => {
    dispatch({ type: 'session/start-free' })
  }, [])
  const value = useMemo(
    () => ({ state, dispatch, startFreeSession, toggleFavoriteExercise }),
    [state, startFreeSession, toggleFavoriteExercise],
  )

  return (
    <TrainingDemoContext.Provider value={value}>
      {children}
    </TrainingDemoContext.Provider>
  )
}
