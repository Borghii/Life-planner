import { api } from './client'
import type { Apartado, Tarea, Accion } from './types'

export const getApartados = () => api<Apartado[]>('/api/apartados')

export const createApartado = (data: Partial<Apartado>) =>
  api<Apartado>('/api/apartados', { method: 'POST', body: JSON.stringify(data) })

export const updateApartado = (id: number, data: Partial<Apartado>) =>
  api<Apartado>(`/api/apartados/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteApartado = (id: number) =>
  api(`/api/apartados/${id}`, { method: 'DELETE' })

export const getTareas = (apartado_id: number) =>
  api<Tarea[]>(`/api/tareas?apartado_id=${apartado_id}`)

export const createTarea = (data: Partial<Tarea>) =>
  api<Tarea>('/api/tareas', { method: 'POST', body: JSON.stringify(data) })

export const updateTarea = (id: number, data: Partial<Tarea>) =>
  api<Tarea>(`/api/tareas/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteTarea = (id: number) =>
  api(`/api/tareas/${id}`, { method: 'DELETE' })

export const getAcciones = (tarea_id: number) =>
  api<Accion[]>(`/api/acciones?tarea_id=${tarea_id}`)

export const createAccion = (data: Partial<Accion>) =>
  api<Accion>('/api/acciones', { method: 'POST', body: JSON.stringify(data) })

export const updateAccion = (id: number, data: Partial<Accion>) =>
  api<Accion>(`/api/acciones/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteAccion = (id: number) =>
  api(`/api/acciones/${id}`, { method: 'DELETE' })

export const ejecutarAccion = (accion_id: number) =>
  api('/api/accion/ejecutar', { method: 'POST', body: JSON.stringify({ accion_id }) })
