import api from './api'

export const serviceApi = {
  getAll(params = {}) {
    return api.get('/services', { params })
  },

  create(data) {
    return api.post('/services', data)
  },

  update(id, data) {
    return api.patch(`/services/${id}`, data)
  },

  delete(id) {
    return api.delete(`/services/${id}`)
  },
}
