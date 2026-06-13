import { create } from 'zustand'
import {
  archiveReward,
  cancelRewardPass,
  createReward,
  getEconomy,
  redeemReward,
  updateReward,
} from '../api/economy'
import type {
  EconomyPayload,
  PointMovement,
  Reward,
  RewardPass,
  TaskCompletionResult,
} from '../api/types'

interface EconomyStore {
  balance: number
  pointsPerHour: number
  defaultRewardPrice: number
  defaultRewardDurationMinutes: number
  rewards: Reward[]
  passes: RewardPass[]
  movements: PointMovement[]
  loading: boolean
  initialized: boolean
  error: string | null
  refresh: () => Promise<void>
  syncTaskCompletion: (result: TaskCompletionResult) => void
  createReward: (name: string, durationMinutes: number) => Promise<void>
  updateReward: (id: number, name: string, durationMinutes: number) => Promise<void>
  archiveReward: (id: number) => Promise<void>
  redeemReward: (id: number) => Promise<RewardPass>
  cancelPass: (id: number) => Promise<void>
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo actualizar la economia'
}

function applyPayload(payload: EconomyPayload) {
  return {
    balance: payload.balance,
    pointsPerHour: payload.points_per_hour,
    defaultRewardPrice: payload.default_reward_price,
    defaultRewardDurationMinutes: payload.default_reward_duration_minutes,
    rewards: payload.rewards,
    passes: payload.passes,
    movements: payload.movements,
    initialized: true,
    loading: false,
    error: null,
  }
}

export const useEconomyStore = create<EconomyStore>((set, get) => ({
  balance: 0,
  pointsPerHour: 10,
  defaultRewardPrice: 30,
  defaultRewardDurationMinutes: 60,
  rewards: [],
  passes: [],
  movements: [],
  loading: false,
  initialized: false,
  error: null,

  refresh: async () => {
    if (!get().initialized) set({ loading: true })
    try {
      set(applyPayload(await getEconomy()))
    } catch (error) {
      set({ loading: false, error: message(error) })
    }
  },

  syncTaskCompletion: (result) => {
    set({ balance: result.balance })
    void get().refresh()
  },

  createReward: async (name, durationMinutes) => {
    set({ error: null })
    try {
      await createReward(name, durationMinutes)
      await get().refresh()
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  updateReward: async (id, name, durationMinutes) => {
    set({ error: null })
    try {
      await updateReward(id, { name, duration_minutes: durationMinutes })
      await get().refresh()
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  archiveReward: async (id) => {
    set({ error: null })
    try {
      await archiveReward(id)
      await get().refresh()
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  redeemReward: async (id) => {
    set({ error: null })
    try {
      const result = await redeemReward(id)
      set({ balance: result.balance })
      await get().refresh()
      return result.pass
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },

  cancelPass: async (id) => {
    set({ error: null })
    try {
      const result = await cancelRewardPass(id)
      set({ balance: result.balance })
      await get().refresh()
    } catch (error) {
      set({ error: message(error) })
      throw error
    }
  },
}))
