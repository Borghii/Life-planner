import { api } from './client'
import type { YearPayload, PlanDay, TaskCompletionResult } from './types'

export const getYearData = (year: number) =>
  api<YearPayload>(`/api/plan?year=${year}`)

export const getDayDetail = (date: string) =>
  api<PlanDay>(`/api/plan?date=${date}`)

export const setHistoryTaskDone = (plan_dia_id: string, completada: boolean) =>
  api<TaskCompletionResult>('/api/tarea-completada', {
    method: 'POST',
    body: JSON.stringify({ plan_dia_id, completada }),
  })
