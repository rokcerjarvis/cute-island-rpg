export type InvitationItemId = 'CAPTURE_ITEM_001' | 'INVITE_LUXURY' | 'INVITE_BRIBE';
export interface InvitationItemDefinition {
  id: InvitationItemId; name: string; description: string; modifier: number;
  guaranteed: boolean; presentation: 'SNACK' | 'LUXURY' | 'BRIBE';
  acquisition: readonly ('SHOP' | 'QUEST' | 'CHEST' | 'EVENT')[];
  /** Future shop data; no currency or purchasing mechanics in M8. */
  shopPriceTier?: 'HIGH';
}
export const invitationItems: InvitationItemDefinition[] = [
  { id: 'CAPTURE_ITEM_001', name: '小點心包', description: '拿出點心，邀請小可愛同行。', modifier: 1, guaranteed: false, presentation: 'SNACK', acquisition: ['SHOP', 'QUEST', 'CHEST', 'EVENT'] },
  { id: 'INVITE_LUXURY', name: '豪華點心包', description: '更豐盛的點心，邀請成功率提高 1.5 倍。', modifier: 1.5, guaranteed: false, presentation: 'LUXURY', acquisition: ['SHOP', 'QUEST', 'CHEST', 'EVENT'] },
  { id: 'INVITE_BRIBE', name: '拿錢收買小可愛', description: '有些友情需要時間培養。有些不用。', modifier: 1, guaranteed: true, presentation: 'BRIBE', acquisition: ['SHOP', 'QUEST', 'CHEST', 'EVENT'], shopPriceTier: 'HIGH' },
];
export type InvitationInventory = Record<InvitationItemId, number>;
export function defaultInvitationInventory(): InvitationInventory { return { CAPTURE_ITEM_001: 10, INVITE_LUXURY: 3, INVITE_BRIBE: 0 }; }
export function invitationItem(id: InvitationItemId): InvitationItemDefinition {
  const item = invitationItems.find(i => i.id === id);
  if (!item) throw new Error('Unknown invitation item');
  return item;
}
