import api from './api'

export const structureApi = {
  getAll(params = {}) {
    return api.get('/structures', { params })
  },

  create(data) {
    return api.post('/structures', data)
  },

  update(id, data) {
    return api.patch(`/structures/${id}`, data)
  },

  delete(id) {
    return api.delete(`/structures/${id}`)
  }
}
