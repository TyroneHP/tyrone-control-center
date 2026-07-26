import type { TrainingState } from '../model/trainingTypes'

export interface TrainingRepository {
  load(profileId: string): Promise<TrainingState>
  save(profileId: string, state: TrainingState): Promise<void>
  saveImage(profileId: string, imageId: string, blob: Blob): Promise<void>
  loadImage(profileId: string, imageId: string): Promise<Blob | undefined>
  deleteImage(profileId: string, imageId: string): Promise<void>
  exportRaw(profileId: string): Promise<string>
  reset(profileId: string): Promise<void>
}
