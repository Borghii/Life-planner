import { api } from './client'
import type {
  AdaptPlanPayload,
  TareasHoyPayload,
  WeatherPayload,
  Recordatorio,
  TaskCompletionResult,
} from './types'

export const getTareasHoy = (fecha: string) =>
  api<TareasHoyPayload>(`/api/tareas-hoy?fecha=${fecha}`)

export const toggleTarea = (plan_dia_id: string, completada: boolean) =>
  api<TaskCompletionResult>('/api/tarea-completada', {
    method: 'POST',
    body: JSON.stringify({ plan_dia_id, completada }),
  })

export const getClima = () => api<WeatherPayload>('/api/clima')

export const getAdaptarPlan = (fecha: string, apply = false) =>
  api<AdaptPlanPayload>(`/api/adaptar-plan?fecha=${fecha}&apply=${apply ? 1 : 0}`)

export const getRecordatorios = (month: string) =>
  api<Recordatorio[]>(`/api/recordatorios?month=${month}`)

export const createRecordatorio = (fecha: string, texto: string) =>
  api<Recordatorio>('/api/recordatorios', {
    method: 'POST',
    body: JSON.stringify({ fecha, texto }),
  })

export const deleteRecordatorio = (id: number) =>
  api(`/api/recordatorios/${id}`, { method: 'DELETE' })

export const getMonthDots = (month: string) =>
  api<{ days: { fecha: string; total: number; done: number }[] }>(
    `/api/plan?month=${month}`
  )
