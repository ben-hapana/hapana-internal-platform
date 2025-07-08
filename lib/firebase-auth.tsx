"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth'
import { auth } from '@/firebase/firebase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {}
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasRedirected, setHasRedirected] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
      
      // Redirect to support page after successful login
      if (user && !hasRedirected) {
        setHasRedirected(true)
        // If user is on login page, redirect to support
        if (pathname === '/login') {
          router.push('/support')
        }
        // If user navigated directly to a protected page, they'll stay there
        // (the ProtectedRoute will handle showing the content)
      }
    })

    return unsubscribe
  }, [router, hasRedirected, pathname])

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      // Add custom scopes if needed
      provider.addScope('email')
      provider.addScope('profile')
      
      await signInWithPopup(auth, provider)
      // The redirect will be handled by the onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  const logout = async () => {
    try {
      setHasRedirected(false) // Reset redirect flag for next login
      await signOut(auth)
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 