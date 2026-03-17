/**
 * Splits an image into top and bottom halves.
 * Useful for flyers with 2 products stacked vertically.
 */

export async function splitImageInHalf(file: File): Promise<[File, File]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Could not get canvas context"))
        return
      }

      const w = img.width
      const h = img.height
      const halfH = Math.floor(h / 2)

      const toBlob = (sx: number, sy: number, sw: number, sh: number, name: string) =>
        new Promise<File>((res, rej) => {
          canvas.width = sw
          canvas.height = sh
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                rej(new Error("Could not create blob"))
                return
              }
              res(new File([blob], name, { type: file.type || "image/jpeg" }))
            },
            file.type || "image/jpeg",
            0.92
          )
        })

      try {
        const [topFile, bottomFile] = await Promise.all([
          toBlob(0, 0, w, halfH, `top-${file.name}`),
          toBlob(0, halfH, w, h - halfH, `bottom-${file.name}`),
        ])
        resolve([topFile, bottomFile])
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not load image"))
    }

    img.src = url
  })
}
