import { create } from 'zustand'
import {
  getApartados, createApartado, updateApartado, deleteApartado,
  getTareas, createTarea, updateTarea, deleteTarea,
  getAcciones, createAccion, updateAccion, deleteAccion,
} from '../api/library'
import type { Apartado, Tarea, Accion } from '../api/types'

interface LibraryStore {
  apartados: Apartado[]
  selectedId: number | null
  tareas: Record<number, Tarea[]>
  acciones: Record<number, Accion[]>
  loadingApartados: boolean
  loadingTareas: boolean

  fetchApartados: () => Promise<void>
  createApartado: (data: Partial<Apartado>) => Promise<Apartado>
  updateApartado: (id: number, data: Partial<Apartado>) => Promise<void>
  deleteApartado: (id: number) => Promise<void>

  selectApartado: (id: number | null) => void
  fetchTareas: (apartado_id: number) => Promise<void>
  createTarea: (data: Partial<Tarea>) => Promise<void>
  updateTarea: (id: number, data: Partial<Tarea>) => Promise<void>
  deleteTarea: (id: number) => Promise<void>

  fetchAcciones: (tarea_id: number) => Promise<void>
  createAccion: (data: Partial<Accion>) => Promise<void>
  updateAccion: (id: number, data: Partial<Accion>) => Promise<void>
  deleteAccion: (id: number) => Promise<void>
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  apartados: [],
  selectedId: null,
  tareas: {},
  acciones: {},
  loadingApartados: false,
  loadingTareas: false,

  fetchApartados: async () => {
    set({ loadingApartados: true })
    const apartados = await getApartados()
    set({ apartados, loadingApartados: false })
  },

  createApartado: async (data) => {
    const a = await createApartado(data)
    set((s) => ({ apartados: [...s.apartados, a] }))
    return a
  },

  updateApartado: async (id, data) => {
    const a = await updateApartado(id, data)
    set((s) => ({ apartados: s.apartados.map((x) => (x.id === id ? a : x)) }))
  },

  deleteApartado: async (id) => {
    await deleteApartado(id)
    set((s) => ({
      apartados: s.apartados.filter((x) => x.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }))
  },

  selectApartado: (id) => {
    set({ selectedId: id })
    if (id !== null && !get().tareas[id]) get().fetchTareas(id)
  },

  fetchTareas: async (apartado_id) => {
    set({ loadingTareas: true })
    const tareas = await getTareas(apartado_id)
    set((s) => ({ tareas: { ...s.tareas, [apartado_id]: tareas }, loadingTareas: false }))
  },

  createTarea: async (data) => {
    const t = await createTarea(data)
    const aid = t.apartado_id
    set((s) => ({
      tareas: { ...s.tareas, [aid]: [...(s.tareas[aid] ?? []), t] },
    }))
  },

  updateTarea: async (id, data) => {
    const t = await updateTarea(id, data)
    const aid = t.apartado_id
    set((s) => ({
      tareas: {
        ...s.tareas,
        [aid]: (s.tareas[aid] ?? []).map((x) => (x.id === id ? t : x)),
      },
    }))
  },

  deleteTarea: async (id) => {
    const { tareas } = get()
    const aid = Object.keys(tareas).find((k) =>
      tareas[+k]?.some((t) => t.id === id)
    )
    await deleteTarea(id)
    if (aid) {
      set((s) => ({
        tareas: {
          ...s.tareas,
          [+aid]: s.tareas[+aid].filter((t) => t.id !== id),
        },
      }))
    }
  },

  fetchAcciones: async (tarea_id) => {
    const acciones = await getAcciones(tarea_id)
    set((s) => ({ acciones: { ...s.acciones, [tarea_id]: acciones } }))
  },

  createAccion: async (data) => {
    const a = await createAccion(data)
    const tid = a.tarea_id
    set((s) => ({
      acciones: { ...s.acciones, [tid]: [...(s.acciones[tid] ?? []), a] },
    }))
  },

  updateAccion: async (id, data) => {
    const a = await updateAccion(id, data)
    const tid = a.tarea_id
    set((s) => ({
      acciones: {
        ...s.acciones,
        [tid]: (s.acciones[tid] ?? []).map((x) => (x.id === id ? a : x)),
      },
    }))
  },

  deleteAccion: async (id) => {
    const { acciones } = get()
    const tid = Object.keys(acciones).find((k) =>
      acciones[+k]?.some((a) => a.id === id)
    )
    await deleteAccion(id)
    if (tid) {
      set((s) => ({
        acciones: {
          ...s.acciones,
          [+tid]: s.acciones[+tid].filter((a) => a.id !== id),
        },
      }))
    }
  },
}))
