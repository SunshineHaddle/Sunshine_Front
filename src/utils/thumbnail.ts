/**
 * 큰 원본 이미지를 작은 썸네일 URL 로 바꿔 로딩을 빠르게 한다.
 * 지금은 위키미디어(commons)만 리사이즈 URL 을 지원한다.
 * 그 외 URL 은 원본을 그대로 돌려준다 (호출부에서 loading="lazy" 로 완화).
 */
export function thumbnailUrl(url: string | undefined, width = 320): string | undefined {
  if (!url) return url

  // 위키미디어 원본:  .../commons/a/a3/Gimchi.jpg
  //        썸네일:    .../commons/thumb/a/a3/Gimchi.jpg/320px-Gimchi.jpg
  // 이미 thumb 경로면 폭만 교체한다.
  const m = url.match(/^(https?:\/\/upload\.wikimedia\.org\/wikipedia\/commons)(\/thumb)?\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+?)(?:\/\d+px-[^/]+)?$/i)
  if (m) {
    const [, base, , d1, d2, file] = m
    return `${base}/thumb/${d1}/${d2}/${file}/${width}px-${file}`
  }

  return url
}

/**
 * 업로드 전에 사진을 최대 변(邊) maxSize 로 줄여 용량을 낮춘다.
 * 폰으로 찍은 수 MB 원본이 108px 썸네일에 그대로 로드되던 걸 막는다.
 * 브라우저 canvas 만 쓰고 새 의존성은 없다. 실패하면 원본을 그대로 돌려준다.
 */
/**
 * 업로드 허용 원본 용량. 폰 사진은 10MB 를 넘기도 한다.
 *
 * 저장되는 건 shrinkImage 로 512px 까지 줄인 결과(보통 100KB 안팎)라
 * 원본이 커도 DB·Storage 에 부담이 없다. 이 값은 '읽어서 줄이는 동안'
 * 브라우저 메모리를 얼마나 쓸지의 상한에 가깝다.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** 줄인 결과가 이보다 크면 저장하지 않는다 (아래 주석 참고) */
export const MAX_STORED_IMAGE_BYTES = 1.5 * 1024 * 1024

export async function shrinkImage(file: File, maxSize = 512, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  // 이미 작은 이미지는 다시 인코딩하지 않는다
  if (scale === 1) { bitmap.close?.(); return file }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close?.(); return file }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) return file

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}
