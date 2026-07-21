export type ProcessItem = {
  id: string
  process: string
  owner: string
  standardCost: string
  actualCost: string
  variance: string
  varianceDirection: 'up' | 'down' | 'neutral'
  status: '주의' | '정상'
}

export const processes: ProcessItem[] = []
