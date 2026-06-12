import { api } from './client'
import type {
  ManualPlanTaskInput,
  PlanDatePayload,
  WeekPayload,
  Tarea,
  TaskCompletionResult,
} from './types'

export const getWeekPlan = (week_start: string) =>
  api<WeekPayload>(`/api/plan?week_start=${week_start}`)

export const getDayPlan = (date: string) =>
  api<PlanDatePayload>(`/api/plan?date=${date}`)

export const getAllTareas = () => api<Tarea[]>('/api/tareas')

export const addTaskToDay = (tarea_id: number, fecha: string) =>
  api('/api/plan', { method: 'POST', body: JSON.stringify({ tarea_id, fecha }) })

export const addManualTaskToDay = (payload: ManualPlanTaskInput) =>
  api('/api/plan/manual', { method: 'POST', body: JSON.stringify(payload) })

export const removeTaskFromDay = (plan_dia_id: string) =>
  api(`/api/plan/${plan_dia_id}`, { method: 'DELETE' })

export const setPlanTaskDone = (plan_dia_id: string, completada: boolean) =>
  api<TaskCompletionResult>('/api/tarea-completada', {
    method: 'POST',
    body: JSON.stringify({ plan_dia_id, completada }),
  })

export const updateRepeticiones = (plan_dia_id: string, repeticiones: number) =>
  api(`/api/plan/${plan_dia_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ repeticiones }),
  })

export const updatePlanTaskNote = (plan_dia_id: string, note: string) =>
  api(`/api/plan/${plan_dia_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ note }),
  })

export const reorderDay = (_fecha: string, ordered_ids: string[]) =>
  api('/api/plan/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids: ordered_ids }),
  })
