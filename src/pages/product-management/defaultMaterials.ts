import type { IngredientUnit } from './productManagementData'

/**
 * 김치 제조에 거의 항상 쓰이는 기본 재료.
 * materials 테이블이 비어 있어도 제품을 만들 수 있도록 후보로 띄운다.
 * 고르는 순간 DB(materials)에 실제로 등록되고, 그 뒤로는 카탈로그에서 온다.
 *
 * 단가는 비워 둔다(0). 실제 단가는 수불자료(1단계)가 덮어쓴다.
 */
export type DefaultMaterial = {
  name: string
  unit: IngredientUnit
}

export const DEFAULT_KIMCHI_MATERIALS: DefaultMaterial[] = [
  { name: '배추', unit: 'kg' },
  { name: '무', unit: 'kg' },
  { name: '총각무', unit: 'kg' },
  { name: '열무', unit: 'kg' },
  { name: '고춧가루', unit: 'kg' },
  { name: '마늘', unit: 'kg' },
  { name: '생강', unit: 'kg' },
  { name: '대파', unit: 'kg' },
  { name: '양파', unit: 'kg' },
  { name: '멸치액젓', unit: 'kg' },
  { name: '새우젓', unit: 'kg' },
  { name: '천일염', unit: 'kg' },
  { name: '찹쌀풀', unit: 'kg' },
  { name: '설탕', unit: 'kg' },
]

/** 공백·대소문자를 무시하고 비교한다. importSubul 의 매칭 규칙과 같다 */
export const materialKey = (name: string) =>
  name.replace(/\s/g, '').toLocaleLowerCase('ko-KR')
