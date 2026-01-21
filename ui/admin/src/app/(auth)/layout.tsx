import '../globals.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Heliox Admin Panel - Secure Login" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Admin Login - Heliox</title>
      </head>
      <body className="min-h-screen bg-[#0a0a0f]">
        {children}
      </body>
    </html>
  )
}
