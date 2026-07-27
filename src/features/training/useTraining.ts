import { useContext } from 'react'
import {
  TrainingContext,
  type TrainingContextValue,
} from './trainingContext'

export type { TrainingContextValue } from './trainingContext'

export function useTraining(): TrainingContextValue {
  const training = useContext(TrainingContext)
  if (!training) {
    throw new Error(
      'useTraining muss innerhalb eines TrainingProvider verwendet werden.',
    )
  }
  return training
}
