import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinanceOS',
  description: 'Your personal finance operating system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/*
          Production readiness fix: sonner's <Toaster /> was never mounted
          anywhere in the app despite 28 components already calling
          toast()/toast.success()/toast.error() — every one of those calls
          was silently producing no visible UI. Themed to match the app's
          existing dark CSS variables (globals.css) rather than sonner's
          default light styling.
        */}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
            },
          }}
        />
      </body>
    </html>
  )
}