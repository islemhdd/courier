import axios from 'axios'
import api, { API_ORIGIN } from './axios'

function csrfCookie() {
  return axios.get(`${API_ORIGIN}/sanctum/csrf-cookie`, {
    withCredentials: true,
    withXSRFToken: true,
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
}

export const authApi = {
  async login(credentials) {
    await csrfCookie()

    return api.post('/login', credentials)
  },

  me() {
    return api.get('/user')
  },

  async logout() {
    await csrfCookie()

    return api.post('/logout')
  },
}
