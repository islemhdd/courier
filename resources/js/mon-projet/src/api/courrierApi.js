import api from './api'

export const courrierApi = {
  getAll(params = {}) {
    return api.get('/courriers', { params })
  },

  getReceived(params = {}) {
    return api.get('/courriers/recus', { params })
  },

  getSent(params = {}) {
    return api.get('/courriers/envoyes', { params })
  },

  getArchived(params = {}) {
    return api.get('/courriers/archives', { params })
  },

  getValidationQueue(params = {}) {
    return api.get('/courriers/validation', { params })
  },

  getCreateData() {
    return api.get('/courriers/create')
  },

  show(id) {
    return api.get(`/courriers/${id}`)
  },

  create(data) {
    return api.post('/courriers', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  update(id, data) {
    return api.post(`/courriers/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  delete(id) {
    return api.delete(`/courriers/${id}`)
  },

  archive(id) {
    return api.patch(`/courriers/${id}/archiver`)
  },

  validate(id) {
    return api.patch(`/courriers/${id}/valider`)
  },
}
