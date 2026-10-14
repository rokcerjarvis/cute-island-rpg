import { BattleManager, type TurnResult } from './BattleManager';
import { CaptureSystem } from './CaptureSystem';
import { PartySystem } from '../systems/PartySystem';
import { awardExperience, battleExperience } from '../systems/ExperienceSystem';
import { SkillLearningSystem } from '../systems/SkillLearningSystem';
import { isCuteDefinition, type BattleEntryPayload } from '../entities/BattleEntity';
import type { RuntimeGameState } from '../state/RuntimeGameState';
import type { RandomSource } from '../systems/EncounterSystem';
import { skills } from '../data/skills';
import { entityDefinitions } from '../data/encounters';
import { EvolutionSystem } from '../systems/EvolutionSystem';
import { CuteEventSystem } from './CuteEventSystem';
import { BossSystem } from '../systems/BossSystem';
import type { TemporaryEffects } from './BattleManager';
import { DexSystem } from '../systems/DexSystem';
import { requestAutoSave } from '../state/StateChanges';
import { invitationItem, type InvitationItemId } from '../data/invitationItems';
export class PartyBattleSession {
  readonly party: PartySystem;
  manager: BattleManager;
  learning?: SkillLearningSystem;
  private awarded = false;
  private leveled = false;
  private persistentEffects: Record<string, Pick<TemporaryEffects, 'attackMultiplier' | 'speedMultiplier'>> = {};
  readonly evolution = new EvolutionSystem(entityDefinitions);
  constructor(readonly state: RuntimeGameState, readonly entry: BattleEntryPayload, rng: RandomSource = Math.random, readonly captureSystem = new CaptureSystem(), cuteEvents = new CuteEventSystem(rng)) {
    this.party = new PartySystem(state);
    if (!state.party.length) throw new Error('Cannot start battle without a party');
    this.party.prepareLeader(); this.party.ensureActive();
    new DexSystem(state.dex, () => { state.isDirty = true; }).seen(entry.enemy.definition.id);
    this.manager = new BattleManager(this.party.toBattleEntity(), entry.enemy, skills, rng, undefined, () => this.party.hasReplacement(), cuteEvents, Boolean(entry.isBoss));
    this.sync();
  }
  attack(skillId: string): TurnResult { return this.complete(this.manager.resolveTurn(skillId)); }
  switchTo(instanceId: string): TurnResult {
    if (this.manager.result) throw new Error('Battle has ended');
    if (!this.party.canSwitch(instanceId)) throw new Error('Member cannot switch in');
    if (!this.manager.needsSwitch) { const skipped = this.manager.skipPlayerActionIfAsleep(); if (skipped) return this.complete(skipped); }
    this.sync();
    const forced = this.manager.needsSwitch;
    this.party.switchTo(instanceId);
    return this.complete(this.manager.replacePlayer(this.party.toBattleEntity(), forced, this.persistentEffects[instanceId]));
  }
  capture(itemId: InvitationItemId = 'CAPTURE_ITEM_001'): TurnResult {
    if (this.manager.result || this.manager.needsSwitch) throw new Error('Cannot capture now');
    const item = invitationItem(itemId);
    if (this.entry.isBoss) return { order: [], messages: ['現在不是交朋友的時候！'] };
    const rejection = this.captureSystem.rejection(this.manager.enemy);
    if (rejection) return { order: [], messages: [rejection.reason === 'BOSS' ? '現在不是交朋友的時候！' : rejection.reason === 'MONSTER' ? '這個傢伙根本不是來交朋友的！' : rejection.reason === 'STORY' ? '牠現在還不願意同行。' : '已昏倒的小可愛不能邀請。'] };
    if (this.state.inventory[itemId] <= 0) return { order: [], messages: [`${item.name}已經用完了。`] };
    const skipped = this.manager.skipPlayerActionIfAsleep(); if (skipped) return this.complete(skipped);
    const result = this.captureSystem.attempt(this.manager.enemy, this.manager.player.level, itemId);
    if (result.outcome === 'REJECTED') throw new Error('Invitation eligibility changed');
    this.state.inventory[itemId]--; this.state.isDirty = true;
    const species = this.manager.enemy.definition.name;
    const messages = item.guaranteed ? ['你拿出了錢。', `${species} 盯著錢看。`] : [`你拿出了${item.name}。`, `${species} 靠近觀察。`];
    if (result.outcome === 'FAILURE') { const turn = this.manager.resolveEnemyAction([...messages, `${species} 還不願意同行。`]); turn.events = [{ type: 'CAPTURE', success: false, item: item.presentation }, ...turn.events ?? []]; return this.complete(turn); }
    const enemy = this.manager.enemy;
    if (!isCuteDefinition(enemy.definition)) throw new Error('Invalid capture species');
    const acquired = this.party.acquire(enemy.definition, enemy.level, enemy.hp);
    const feedback = acquired.destination === 'PARTY' ? `${species}加入隊伍！` : `隊伍滿了，${species} 加入 Reserve！`;
    this.state.worldFeedback = feedback;
    return this.complete({ messages: [...messages, `${species} 願意跟你走了！`, ...(item.guaranteed ? ['金錢建立了深厚的友情。'] : []), feedback], order: [], result: this.manager.captured(), events: [{ type: 'CAPTURE', success: true, item: item.presentation }] });
  }
  skipEscapeIfAsleep(): TurnResult | undefined {
    if (this.manager.result || this.entry.isBoss) return undefined;
    const skipped = this.manager.skipPlayerActionIfAsleep();
    return skipped ? this.complete(skipped) : undefined;
  }
  private sync(): void {
    this.party.syncActive(this.manager.player);
    this.persistentEffects[this.state.activeInstanceId] = { attackMultiplier: this.manager.player.effects.attackMultiplier, speedMultiplier: this.manager.player.effects.speedMultiplier };
    this.state.battle = { activeInstanceId: this.state.activeInstanceId, enemyId: this.manager.enemy.definition.id, enemyLevel: this.manager.enemy.level, enemyHp: this.manager.enemy.hp, enemyMaxHp: this.manager.enemy.maxHp, enemySkills: [...this.manager.enemy.definition.skills], turn: this.manager.turn, outcome: this.manager.result?.outcome, needsSwitch: this.manager.needsSwitch, isBoss: Boolean(this.entry.isBoss), world: { ...this.entry.world } };
  }
  private complete(turn: TurnResult): TurnResult {
    this.sync();
    if (!this.awarded && (turn.result?.outcome === 'VICTORY' || turn.result?.outcome === 'CAPTURED')) {
      this.awarded = true;
      const member = this.party.active;
      const amount = battleExperience(this.manager.enemy.definition.baseExp, this.manager.enemy.level, member.level, turn.result.outcome === 'CAPTURED');
      const progression = awardExperience(member, entityDefinitions[member.creatureId], amount);
      this.state.isDirty = true;
      this.leveled = progression.levels.length > 0;
      if (this.leveled) requestAutoSave(this.state);
      turn.messages = turn.messages.filter(message => message !== '戰鬥勝利！');
      if (this.entry.isBoss && turn.result.outcome === 'VICTORY') turn.messages.push('巨型森林怪倒下了！', '森林好像安靜下來了。');
      turn.messages.push(`${entityDefinitions[member.creatureId].name}獲得了 ${progression.gained} EXP！`);
      for (const level of progression.levels) turn.messages.push(`${entityDefinitions[member.creatureId].name}升到了 Lv.${level}！`);
      this.learning = new SkillLearningSystem(member, progression.newSkills);
      turn.messages.push(...this.advanceLearning());
      this.refreshActive();
      this.queueEvolution();
      if (!this.learning.pending.length && !this.state.pendingEvolution && turn.result.outcome === 'VICTORY') turn.messages.push('戰鬥勝利！');
    }
    return turn;
  }
  advanceLearning(): string[] {
    const learned = this.learning?.advance() ?? [];
    if (this.learning?.pending.length) this.state.pendingLearning = { instanceId: this.party.active.instanceId, skillIds: [...this.learning.pending] };
    else this.state.pendingLearning = undefined;
    return learned.map(id => `${entityDefinitions[this.party.active.creatureId].name}學會了 ${skills[id].name}！`);
  }
  decideLearning(index?: number): string[] {
    if (!this.learning) throw new Error('No learning session');
    const decision = this.learning.decide(index);
    this.state.isDirty = true;
    const name = entityDefinitions[this.party.active.creatureId].name;
    const text = decision.declined ? `${name}放棄學習 ${skills[decision.learned].name}。` : `${name}忘記了 ${skills[decision.forgotten!].name}，學會了 ${skills[decision.learned].name}！`;
    const messages = [text, ...this.advanceLearning()];
    this.refreshActive();
    this.queueEvolution();
    if (!this.learning.pending.length && !this.state.pendingEvolution && this.manager.result?.outcome === 'VICTORY') messages.push('戰鬥勝利！');
    return messages;
  }
  private queueEvolution(): void {
    if (!this.leveled || this.learning?.pending.length) return;
    const target = this.evolution.target(this.party.active);
    if (target) this.state.pendingEvolution = { instanceId: this.party.active.instanceId, beforeId: this.party.active.creatureId, targetId: target.id };
  }
  applyEvolution(): string[] {
    if (!this.state.pendingEvolution || this.learning?.pending.length) throw new Error('No ready evolution');
    const migrated = this.evolution.evolve(this.party.active);
    new DexSystem(this.state.dex).captured(this.party.active.creatureId); requestAutoSave(this.state);
    this.state.pendingEvolution = undefined; this.leveled = false;
    this.refreshActive();
    return [`恭喜！${migrated.before}進化成了 ${migrated.after}！`, ...(this.manager.result?.outcome === 'VICTORY' ? ['戰鬥勝利！'] : [])];
  }
  private refreshActive(): void {
    const entity = this.party.toBattleEntity();
    Object.assign(this.manager.player, entity);
  }
  finishReturn(): void {
    if (this.learning?.pending.length || this.manager.needsSwitch || this.state.pendingEvolution) throw new Error('Pending choices must be completed');
    if (this.entry.isBoss && !this.manager.result) throw new Error('現在好像不是逃跑的時候！');
    this.sync();
    if (!this.manager.result) this.manager.escape();
    if (this.manager.result?.outcome === 'DEFEAT') this.party.healAll();
    if (this.entry.isBoss) new BossSystem().recordResult(this.state, this.manager.result!.outcome);
    this.state.battle = undefined;
    this.state.pendingLearning = undefined;
    this.party.prepareLeader();
  }
}
