interface UploadResult {
  url: string
  publicId: string
}

/**
 * Uploads an image to Cloudinary using unsigned upload preset
 * Hardcoded values for client-side upload
 */
export async function uploadToCloudinary(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", "arreglos")

  const response = await fetch(
    "https://api.cloudinary.com/v1_1/du8riepsi/image/upload",
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
