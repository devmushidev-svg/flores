import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { SwRegister } from '@/components/sw-register'
import { SwrProvider } from '@/components/swr-provider'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Se permite hacer zoom (accesibilidad). Los campos usan 16px en móvil,
  // así que iOS no hace zoom automático al escribir.
  themeColor: '#e879a0',
}

export const metadata: Metadata = {
  title: 'Multiplanet Floristería',
  description: 'Sistema de gestión para Multiplanet Floristería: flores, arreglos y pedidos',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Multiplanet',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: '/icons/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        <SwRegister />
        <SwrProvider>{children}</SwrProvider>
        <Toaster position="top-center" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
