import { creatures } from '../data/creatures';
import { evolutionTargets } from '../data/evolutions';
export const dexDefinitions = [...creatures, ...evolutionTargets];
export type DexStatus = 'UNKNOWN' | 'SEEN' | 'CAPTURED';
export type DexData = Record<string, DexStatus>;
export const creatureRoles: Record<string, string> = { CUTE_001: '平衡型', CUTE_002: '速度型', CUTE_003: '高攻型', CUTE_004: '耐久型', CUTE_005: '單純可愛', EVO_001: '平衡成長型', EVO_002: '單純可愛' };
export function createDex(): DexData { return Object.fromEntries(dexDefinitions.map(d => [d.id, 'UNKNOWN'])); }
export class DexSystem {
  constructor(readonly data: DexData, private readonly changed: () => void = () => {}) {}
  private mark(id: string, status: DexStatus): void {
    if (!dexDefinitions.some(d => d.id === id)) return;
    if (this.data[id] === 'CAPTURED' || this.data[id] === status) return;
    this.data[id] = status; this.changed();
  }
  seen(id: string): void { this.mark(id, 'SEEN'); }
  captured(id: string): void { this.mark(id, 'CAPTURED'); }
  countSeen(): number { return dexDefinitions.filter(d => this.data[d.id] !== 'UNKNOWN').length; }
  countCaptured(): number { return dexDefinitions.filter(d => this.data[d.id] === 'CAPTURED').length; }
  lines(): string[] {
    return dexDefinitions.map(d => {
      const status = this.data[d.id];
      if (status === 'UNKNOWN') return '？？？ · UNKNOWN';
      const attribute = d.attribute === 'PURE_CUTE' ? '單純可愛' : d.attribute;
      return `${d.name} · ${attribute} · ${status === 'CAPTURED' ? '已同行' : status}${status === 'CAPTURED' ? ` · ${creatureRoles[d.id]}` : ' · 資料未收集'}${d.attribute === 'PURE_CUTE' ? '\n  這是什麼？上網查一下！' : ''}`;
    });
  }
}
