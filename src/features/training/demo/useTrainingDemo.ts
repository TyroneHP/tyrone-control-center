import { createContext, useContext } from 'react'
import type { TrainingDemoContextValue } from './TrainingDemoProvider'

export type { TrainingDemoContextValue } from './TrainingDemoProvider'

export const TrainingDemoContext =
  createContext<TrainingDemoContextValue | null>(null)

export function useTrainingDemo(): TrainingDemoContextValue {
  const trainingDemo = useContext(TrainingDemoContext)
  if (!trainingDemo) {
    throw new Error(
      'useTrainingDemo muss innerhalb eines TrainingDemoProvider verwendet werden.',
    )
  }
  return trainingDemo
}
