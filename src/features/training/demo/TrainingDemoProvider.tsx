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
  const value = useMemo(
    () => ({ state, dispatch, toggleFavoriteExercise }),
    [state, toggleFavoriteExercise],
  )

  return (
    <TrainingDemoContext.Provider value={value}>
      {children}
    </TrainingDemoContext.Provider>
  )
}
