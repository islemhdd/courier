import api from './api'

export const adminApi = {
  getStructures(params = {}) {
    return api.get('/admin/structures', { params })
  },

  createStructure(data) {
    return api.post('/admin/structures', data)
  },

  updateStructure(id, data) {
    return api.patch(`/admin/structures/${id}`, data)
  },

  deleteStructure(id) {
    return api.delete(`/admin/structures/${id}`)
  },

  assignStructureChef(structureId, data) {
    return api.patch(`/admin/structures/${structureId}/chef`, data)
  },

  getServices(params = {}) {
    return api.get('/admin/services', { params })
  },

  createService(data) {
    return api.post('/admin/services', data)
  },

  updateService(id, data) {
    return api.patch(`/admin/services/${id}`, data)
  },

  deleteService(id) {
    return api.delete(`/admin/services/${id}`)
  },

  assignServiceChef(serviceId, data) {
    return api.patch(`/admin/services/${serviceId}/chef`, data)
  },
}
