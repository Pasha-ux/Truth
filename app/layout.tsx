import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _playfair = Playfair_Display({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-playfair',
})
const _inter = Inter({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Правда чи Міф - Інтерактивна гра',
  description: 'Інтерактивна вікторина: перевір свої знання!',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="uk">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
