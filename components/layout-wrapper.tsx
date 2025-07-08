"use client"

import { usePathname } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

interface LayoutWrapperProps {
  children: React.ReactNode
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname()
  
  // Don't wrap login page in protected route or sidebar
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Support and Onboarding pages have their own fixed headers, so don't add the standard header
  if (pathname === '/support' || pathname === '/onboarding') {
    return (
      <ProtectedRoute>
        <SidebarProvider>
          <AppSidebar />
          <main className="flex flex-1 flex-col">
            {children}
          </main>
        </SidebarProvider>
      </ProtectedRoute>
    )
  }

  // For all other pages, use protected route with sidebar and standard header
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </ProtectedRoute>
  )
} 