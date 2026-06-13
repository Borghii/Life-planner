import { api } from './client'
import type { EconomyPayload, Reward, RewardPass } from './types'

export const getEconomy = () => api<EconomyPayload>('/api/economy')

export const createReward = (name: string, duration_minutes = 60) =>
  api<Reward>('/api/rewards', {
    method: 'POST',
    body: JSON.stringify({ name, duration_minutes }),
  })

export const updateReward = (
  id: number,
  payload: { name?: string; duration_minutes?: number; active?: boolean },
) =>
  api<Reward>(`/api/rewards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const archiveReward = (id: number) =>
  api<{ ok: boolean }>(`/api/rewards/${id}`, { method: 'DELETE' })

export const redeemReward = (id: number) =>
  api<{ pass: RewardPass; balance: number }>(`/api/rewards/${id}/redeem`, {
    method: 'POST',
  })

export const cancelRewardPass = (id: number) =>
  api<{ pass: RewardPass; balance: number }>(`/api/reward-passes/${id}/cancel`, {
    method: 'POST',
  })

export const startRewardPass = (id: number) =>
  api<RewardPass>(`/api/reward-passes/${id}/start`, { method: 'POST' })

export const pauseRewardPass = (id: number) =>
  api<RewardPass>(`/api/reward-passes/${id}/pause`, { method: 'POST' })

export const resumeRewardPass = (id: number) =>
  api<RewardPass>(`/api/reward-passes/${id}/resume`, { method: 'POST' })

export const completeRewardPass = (id: number) =>
  api<RewardPass>(`/api/reward-passes/${id}/complete`, { method: 'POST' })
