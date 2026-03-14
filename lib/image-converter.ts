/**
 * Image format converter utility
 * Handles HEIC/HEIF conversion to JPEG for compatibility
 */

// Check if the file is in HEIC/HEIF format
export function isHeicFormat(file: File): boolean {
  const heicTypes = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
  const heicExtensions = ['.heic', '.heif']
  
  // Check by MIME type
  if (heicTypes.includes(file.type.toLowerCase())) {
    return true
  }
  
  // Check by file extension (some browsers don't report correct MIME type)
  const fileName = file.name.toLowerCase()
  return heicExtensions.some(ext => fileName.endsWith(ext))
}

// Check if browser supports HEIC natively
export function browserSupportsHeic(): boolean {
  // Safari on newer iOS/macOS supports HEIC natively
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  
  // Most browsers don't support HEIC, Safari does on Apple devices
  const userAgent = navigator.userAgent.toLowerCase()
  const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)
  const isAppleDevice = /mac|iphone|ipad|ipod/.test(userAgent)
  
  return isSafari && isAppleDevice
}

// Convert HEIC to JPEG using heic2any library (loaded dynamically)
async function convertHeicToJpeg(file: File): Promise<File> {
  // Dynamically import heic2any to avoid bundling issues
  const heic2any = (await import('heic2any')).default
  
  try {
    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9
    })
    
    // heic2any can return a single blob or array of blobs
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
    
    // Create a new File with .jpg extension
    const newFileName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
    return new File([blob], newFileName, { type: 'image/jpeg' })
  } catch (error) {
    console.error('HEIC conversion failed:', error)
    throw new Error('No se pudo convertir la imagen HEIC. Por favor, intenta con otro formato.')
  }
}

// Main function to process image - converts HEIC if needed
export async function processImageForUpload(file: File): Promise<File> {
  // If it's not HEIC, return as-is
  if (!isHeicFormat(file)) {
    return file
  }
  
  // Convert HEIC to JPEG
  const convertedFile = await convertHeicToJpeg(file)
  return convertedFile
}

// Create a preview URL for an image file (handles HEIC conversion for preview)
export async function createImagePreview(file: File): Promise<string> {
  // If it's HEIC and browser doesn't support it, convert first
  if (isHeicFormat(file) && !browserSupportsHeic()) {
    const convertedFile = await processImageForUpload(file)
    return URL.createObjectURL(convertedFile)
  }
  
  // For supported formats, create URL directly
  return URL.createObjectURL(file)
}
