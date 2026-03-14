const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

interface UploadResult {
  url: string
  publicId: string
}

/**
 * Compresses an image file before upload
 * Target: max 800px width, 80% quality JPEG
 */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      // Max dimensions
      const MAX_WIDTH = 800
      const MAX_HEIGHT = 800
      
      let { width, height } = img
      
      // Calculate new dimensions maintaining aspect ratio
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width
        width = MAX_WIDTH
      }
      if (height > MAX_HEIGHT) {
        width = (width * MAX_HEIGHT) / height
        height = MAX_HEIGHT
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error("Could not compress image"))
          }
        },
        "image/jpeg",
        0.8 // 80% quality
      )
    }
    
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Uploads an image to Cloudinary with compression
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error("Cloudinary configuration missing. Please add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.")
  }

  // Compress the image before upload
  const compressedBlob = await compressImage(file)
  
  const formData = new FormData()
  formData.append("file", compressedBlob, file.name.replace(/\.[^.]+$/, ".jpg"))
  formData.append("upload_preset", UPLOAD_PRESET)
  formData.append("folder", "floreria/arreglos")
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || "Upload failed")
  }

  const data = await response.json()
  
  return {
    url: data.secure_url,
    publicId: data.public_id,
  }
}

/**
 * Returns an optimized Cloudinary URL with transformations
 * Adds automatic format and quality optimization
 */
export function getOptimizedUrl(url: string, options?: { width?: number; height?: number }): string {
  if (!url.includes("cloudinary.com")) {
    return url // Not a Cloudinary URL, return as-is
  }
  
  const transforms = ["f_auto", "q_auto"]
  
  if (options?.width) {
    transforms.push(`w_${options.width}`)
  }
  if (options?.height) {
    transforms.push(`h_${options.height}`)
  }
  
  // Insert transformations into Cloudinary URL
  return url.replace("/upload/", `/upload/${transforms.join(",")}/`)
}
