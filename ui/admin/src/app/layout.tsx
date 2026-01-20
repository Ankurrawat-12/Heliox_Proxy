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
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Heliox API Gateway Admin Dashboard - Manage API keys, routes, caching policies, and monitor traffic" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Favicons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Open Graph / Social */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Heliox Admin" />
        <meta property="og:description" content="API Gateway Admin Dashboard" />
        
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
              <main className="flex-1 ml-0 lg:ml-64 pt-20 lg:pt-8 p-4 sm:p-6 lg:p-8 min-w-0">
                {children}
              </main>
            </div>
          </ToastProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
