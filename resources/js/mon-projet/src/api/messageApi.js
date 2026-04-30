import api from './axios'

export const messageApi = {
  getAll(params = {}) {
    return api.get('/messages', {
      params,
    })
  },

  getOne(id) {
    return api.get(`/messages/${id}`)
  },

  send(data) {
    return api.post('/messages', data)
  },

  update(id, data) {
    return api.patch(`/messages/${id}`, data)
  },

  delete(id) {
    return api.delete(`/messages/${id}`)
  },

  markAsRead(id) {
    return api.patch(`/messages/${id}/read`)
  },

  sendDraft(id) {
    return api.patch(`/messages/${id}/send`)
  },

  searchUsers(q) {
    return api.get('/messages/destinataires', {
      params: { q },
    })
  },

  unreadCount() {
    return api.get('/messages/non-lus')
  },
}
