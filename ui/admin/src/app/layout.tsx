'use client'

import './globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import MobileHeader from '@/components/MobileHeader'
import { ToastProvider } from '@/components/Toast'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <title>Heliox Admin</title>
      </head>
      <body className="min-h-screen bg-gray-50">
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <div className="flex min-h-screen">
              {/* Mobile Header */}
              <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
              
              {/* Sidebar */}
              <Sidebar 
                isOpen={sidebarOpen} 
                onClose={() => setSidebarOpen(false)} 
              />
              
              {/* Main Content */}
              <main className="flex-1 ml-0 lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 lg:p-8 min-w-0">
                {children}
              </main>
            </div>
          </ToastProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
