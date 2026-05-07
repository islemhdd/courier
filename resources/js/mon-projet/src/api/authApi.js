import api, { API_ORIGIN } from './api'

async function csrfCookie() {
  return api.get(`${API_ORIGIN}/sanctum/csrf-cookie`)
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
