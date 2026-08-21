import assert from 'node:assert/strict'
import { thumbnailUrl } from './thumbnail.ts'

// 위키미디어 원본 → 320px 썸네일
assert.equal(
  thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/a/a3/Gimchi.jpg'),
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Gimchi.jpg/320px-Gimchi.jpg',
)
// 이미 thumb 경로면 폭만 교체
assert.equal(
  thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Gimchi.jpg/800px-Gimchi.jpg', 320),
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Gimchi.jpg/320px-Gimchi.jpg',
)
// 폭 인자 반영
assert.equal(
  thumbnailUrl('https://upload.wikimedia.org/wikipedia/commons/9/9d/Korean_cuisine-Kimchi-08.jpg', 640),
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Korean_cuisine-Kimchi-08.jpg/640px-Korean_cuisine-Kimchi-08.jpg',
)
// 위키미디어 아닌 URL·로컬 경로·data URL·undefined 는 원본 유지
assert.equal(thumbnailUrl('/products/chonggak.jpg'), '/products/chonggak.jpg')
assert.equal(thumbnailUrl('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA')
assert.equal(thumbnailUrl(undefined), undefined)

console.log('ok')
