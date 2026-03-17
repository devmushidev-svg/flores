import { processImageForUpload, isHeicFormat } from "./image-converter"

interface UploadResult {
  url: string
  publicId: string
}

/**
 * Uploads an image to Cloudinary using unsigned upload preset
 * Automatically handles HEIC conversion for iOS compatibility
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  // Convert HEIC to JPEG if needed
  let processedFile = file
  if (isHeicFormat(file)) {
    processedFile = await processImageForUpload(file)
  }
  
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "du8riepsi"
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "arreglos"

  const formData = new FormData()
  formData.append("file", processedFile)
  formData.append("upload_preset", uploadPreset)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error("Failed to upload image to Cloudinary")
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
