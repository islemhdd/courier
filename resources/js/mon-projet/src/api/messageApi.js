import api from './axios'

export const messageApi = {
  getAll(type = 'recu') {
    return api.get('/messages', {
      params: { type },
    })
  },

  getOne(id) {
    return api.get(`/messages/${id}`)
  },

  send(data) {
    return api.post('/messages', data)
  },

  markAsRead(id) {
    return api.patch(`/messages/${id}/read`)
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