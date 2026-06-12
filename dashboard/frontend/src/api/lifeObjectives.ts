import { api } from './client'
import type { LifeObjectivesConfig } from './types'

export const getLifeObjectives = () => api<LifeObjectivesConfig>('/api/life-objectives')

export const updateLifeObjectives = (data: LifeObjectivesConfig) =>
  api<LifeObjectivesConfig>('/api/life-objectives', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
