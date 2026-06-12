import { create } from 'zustand'
import { getConfig, updateConfig } from '../api/config'
import type { Config } from '../api/types'

interface ConfigStore {
  config: Config | null
  loading: boolean
  fetch: () => Promise<void>
  update: (data: Partial<Config>) => Promise<void>
}

export const useConfigStore = create<ConfigStore>((set) => ({
  config: null,
  loading: false,
  fetch: async () => {
    set({ loading: true })
    try {
      const config = await getConfig()
      set({ config, loading: false })
    } catch {
      set({ loading: false })
    }
  },
  update: async (data) => {
    const config = await updateConfig(data)
    set({ config })
  },
}))
