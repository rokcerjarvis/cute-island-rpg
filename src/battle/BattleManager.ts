import type { BattleEntity, WorldReturnState } from '../entities/BattleEntity';
import type { SkillDefinition } from '../data/skills';
import type { RandomSource } from '../systems/EncounterSystem';
import { BATTLE_CONFIG } from '../config/prototype';
import { calculateDamage, checkAccuracy } from './DamageCalculator';
import { attributeMultiplier } from './AttributeMultiplier';
import { chooseEnemySkill } from './EnemyAI';
import { determineTurnOrder, type BattleSide } from './TurnOrder';
import { CuteEventSystem } from './CuteEventSystem';
import type { VisualEvent } from '../presentation/ViewModels';

export interface TemporaryEffects {
  turnDamageMultiplier: number;
  nextAttackMultiplier: number;
  nextOrderSpeedMultiplier: number;
  skipNextAction: boolean;
  attackMultiplier: number;
  speedMultiplier: number;
}
export interface Combatant extends BattleEntity { effects: TemporaryEffects }
export interface BattleResult { outcome: 'VICTORY' | 'DEFEAT' | 'ESCAPED' | 'CAPTURED'; returnTo: 'ENCOUNTER' | 'CAMP' }
export interface TurnResult { messages: string[]; order: BattleSide[]; result?: BattleResult; events?: VisualEvent[] }
export interface SuccessfulAttackEvent { actor: Combatant; target: Combatant; skill: SkillDefinition; damage: number }
export function battleReturnState(world: WorldReturnState, result: BattleResult, camp: { x: number; y: number }): WorldReturnState {
  return result.returnTo === 'CAMP' ? { ...world, ...camp, zoneId: 'camp' } : { ...world };
}

export class BattleManager {
  player: Combatant;
  readonly enemy: Combatant;
  result?: BattleResult;
  turn = 0;
  private resolving = false;
  needsSwitch = false;
  constructor(player: BattleEntity, enemy: BattleEntity, private readonly skills: Record<string, SkillDefinition>, private readonly rng: RandomSource = Math.random,
    private readonly onSuccessfulDamagingAttack?: (event: SuccessfulAttackEvent) => void,
    private readonly hasReplacement: () => boolean = () => false,
    readonly cuteEvents = new CuteEventSystem(rng), readonly isBoss = false) {
    const state = (entity: BattleEntity): Combatant => ({ ...entity, stats: { ...entity.stats }, effects: { turnDamageMultiplier: 1, nextAttackMultiplier: 1, nextOrderSpeedMultiplier: 1, skipNextAction: false, attackMultiplier: 1, speedMultiplier: 1 } });
    this.player = state(player); this.enemy = state(enemy);
  }
  resolveTurn(playerSkillId: string): TurnResult {
    if (this.result || this.resolving || this.needsSwitch) throw new Error('Battle cannot accept another turn');
    const playerSkill = this.skills[playerSkillId];
    if (!playerSkill || !this.player.definition.skills.includes(playerSkillId)) throw new Error('Player skill is not available');
    this.resolving = true;
    try {
      const enemySkill = chooseEnemySkill(this.enemy, this.skills, this.rng);
      const order = determineTurnOrder(playerSkill, enemySkill,
        this.player.stats.speed * this.player.effects.speedMultiplier * this.player.effects.nextOrderSpeedMultiplier,
        this.enemy.stats.speed * this.enemy.effects.speedMultiplier * this.enemy.effects.nextOrderSpeedMultiplier, this.rng);
      // Consume prior speed debuffs at this order check. Newly applied ones survive to next turn.
      this.player.effects.nextOrderSpeedMultiplier = this.enemy.effects.nextOrderSpeedMultiplier = 1;
      const messages: string[] = [];
      const events: VisualEvent[] = [];
      this.turn++;
      for (const side of order) {
        if (this.player.hp <= 0 || this.enemy.hp <= 0) break;
        this.act(side, side === 'player' ? playerSkill : enemySkill, messages, events);
      }
      this.finishTurn(messages);
      return { messages, order, result: this.result, events };
    } finally { this.resolving = false; }
  }
  escape(): BattleResult {
    if (this.isBoss && !this.result) throw new Error('現在好像不是逃跑的時候！');
    if (this.resolving || this.needsSwitch) throw new Error('Turn or forced switch is still pending');
    if (!this.result && this.player.effects.skipNextAction) throw new Error('Sleeping action must resolve before escaping');
    return this.result ??= { outcome: 'ESCAPED', returnTo: 'ENCOUNTER' };
  }
  private finishTurn(messages: string[]): void {
    if (this.enemy.hp <= 0) { this.result = { outcome: 'VICTORY', returnTo: 'ENCOUNTER' }; messages.push('戰鬥勝利！'); }
    else if (this.player.hp <= 0) {
      if (this.hasReplacement()) { this.needsSwitch = true; messages.push('請選擇下一隻小可愛。'); }
      else { this.result = { outcome: 'DEFEAT', returnTo: 'CAMP' }; messages.push('你被送回營地了。'); }
    }
    this.player.effects.turnDamageMultiplier = this.enemy.effects.turnDamageMultiplier = 1;
  }
  replacePlayer(entity: BattleEntity, forced: boolean, persistent?: Pick<TemporaryEffects, 'attackMultiplier' | 'speedMultiplier'>): TurnResult {
    if (this.result || entity.hp <= 0 || forced !== this.needsSwitch) throw new Error('Invalid switch');
    this.player = { ...entity, stats: { ...entity.stats }, effects: { turnDamageMultiplier: 1, nextAttackMultiplier: 1, nextOrderSpeedMultiplier: 1, skipNextAction: false, attackMultiplier: persistent?.attackMultiplier ?? 1, speedMultiplier: persistent?.speedMultiplier ?? 1 } };
    this.needsSwitch = false;
    const messages = [`換上了 ${entity.definition.name}！`];
    return forced ? { messages, order: [] } : this.resolveEnemyAction(messages);
  }
  skipPlayerActionIfAsleep(): TurnResult | undefined {
    if (!this.player.effects.skipNextAction) return undefined;
    this.player.effects.skipNextAction = false;
    return this.resolveEnemyAction([`${this.player.definition.name}還在睡覺……`], [{ type: 'SLEEP', side: 'player' }]);
  }
  resolveEnemyAction(messages: string[] = [], events: VisualEvent[] = []): TurnResult {
    if (this.result || this.resolving || this.needsSwitch) throw new Error('Cannot resolve enemy action');
    this.resolving = true;
    try {
      this.turn++;
      this.enemy.effects.nextOrderSpeedMultiplier = 1;
      this.act('enemy', chooseEnemySkill(this.enemy, this.skills, this.rng), messages, events);
      this.finishTurn(messages);
      return { messages, order: ['enemy'], result: this.result, events };
    } finally { this.resolving = false; }
  }
  captured(): BattleResult {
    if (this.result || this.enemy.hp <= 0) throw new Error('Cannot capture ended battle');
    this.turn++;
    return this.result = { outcome: 'CAPTURED', returnTo: 'ENCOUNTER' };
  }
  private act(side: BattleSide, skill: SkillDefinition, log: string[], events: VisualEvent[]): void {
    const actor = side === 'player' ? this.player : this.enemy;
    const target = side === 'player' ? this.enemy : this.player;
    const label = (entity: Combatant) => entity === this.player ? entity.definition.name : `${entity.definition.kind === 'MONSTER' ? '怪物' : '野生的'}${entity.definition.name}`;
    if (actor.effects.skipNextAction) { actor.effects.skipNextAction = false; log.push(`${label(actor)}還在睡覺……`); events.push({ type: 'SLEEP', side }); return; }
    const action: Extract<VisualEvent, { type: 'ACTION' }> = { type: 'ACTION', side, skillId: skill.id, hit: false, actorHp: actor.hp, targetHp: target.hp, actorAfterHp: actor.hp, targetAfterHp: target.hp }; events.push(action);
    log.push(`${label(actor)}使出了 ${skill.name}！`);
    if (!checkAccuracy(skill.accuracy, this.rng)) { log.push('但是沒有打中！'); return; }
    action.hit = true;
    if (skill.power > 0) {
      const baseDamage = calculateDamage(skill.power, actor.stats.attack * actor.effects.attackMultiplier, actor.definition.attribute, target.definition.attribute, this.rng, actor.level);
      const damage = Math.max(1, Math.floor(baseDamage * actor.effects.nextAttackMultiplier * target.effects.turnDamageMultiplier));
      actor.effects.nextAttackMultiplier = 1;
      const dealt = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - damage);
      action.targetAfterHp = target.hp;
      log.push(`造成 ${dealt} 點傷害！`);
      const multiplier = attributeMultiplier(actor.definition.attribute, target.definition.attribute);
      if (multiplier > 1) log.push('效果很好！');
      else if (multiplier < 1) log.push('效果不太好……');
      this.onSuccessfulDamagingAttack?.({ actor, target, skill, damage: dealt });
      const cute = this.cuteEvents.process({ actor, target, skill, damage: dealt }, log);
      if (cute) events.push({ type: 'CUTE', side, event: cute, hp: actor.hp });
      if (target.hp === 0) log.push(`${label(target)}昏倒了！`);
      return;
    }
    switch (skill.effect) {
      case 'HEAL_20_PERCENT': {
        const before = actor.hp;
        actor.hp = Math.min(actor.maxHp, actor.hp + Math.floor(actor.maxHp * BATTLE_CONFIG.healFraction));
        log.push(`回復了 ${actor.hp - before} 點 HP！`); break;
      }
      case 'DAMAGE_REDUCTION_50': actor.effects.turnDamageMultiplier = BATTLE_CONFIG.braceMultiplier; log.push('縮成一小團，這回合受到的傷害減半！'); break;
      case 'DAMAGE_REDUCTION_70': actor.effects.turnDamageMultiplier = BATTLE_CONFIG.feignMultiplier; log.push('躺得非常認真，這回合受到的傷害減少 70%！'); break;
      case 'NEXT_ATTACK_DAMAGE_REDUCTION_20': target.effects.nextAttackMultiplier = BATTLE_CONFIG.nextAttackMultiplier; log.push('對方下一次命中的傷害攻擊減少 20%！'); break;
      case 'NEXT_ACTION_SPEED_REDUCTION_30': target.effects.nextOrderSpeedMultiplier = BATTLE_CONFIG.nextSpeedMultiplier; log.push('對方下一次出手判定時速度減少 30%！'); break;
      case 'NONE': break;
    }
    action.actorAfterHp = actor.hp;
  }
}
