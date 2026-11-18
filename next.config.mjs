/** @type {import('next').NextConfig} */
const nextConfig = {
  // Los errores de TypeScript detienen el build (antes se ignoraban y ocultaron bugs reales)
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
