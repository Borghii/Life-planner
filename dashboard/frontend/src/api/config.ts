import { api } from './client'
import type { Config } from './types'

export const getConfig = () => api<Config>('/api/config')

export const updateConfig = (data: Partial<Config>) =>
  api<Config>('/api/config', { method: 'PUT', body: JSON.stringify(data) })
