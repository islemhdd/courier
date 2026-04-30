import api from './api'

export const userApi = {
  getAll(params = {}) {
    return api.get('/utilisateurs', { params })
  },

  create(data) {
    return api.post('/utilisateurs', data)
  },

  update(id, data) {
    return api.patch(`/utilisateurs/${id}`, data)
  },

  delete(id) {
    return api.delete(`/utilisateurs/${id}`)
  },
}
