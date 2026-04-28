import { useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../api/authApi'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me()

      setUser(response.data.user)
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error(error)
      }

      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser()
  }, [refreshUser])

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const response = await authApi.login(credentials)

    setUser(response.data.user)

    return response.data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
