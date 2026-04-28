import axios from 'axios'

export const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
).replace(/\/$/, '')

export const API_ORIGIN = API_URL.replace(/\/api$/, '')

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    return Promise.reject(error)
  },
)

export default api