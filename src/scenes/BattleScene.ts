import Phaser from 'phaser';
import type { BattleEntryPayload } from '../entities/BattleEntity';
import { BattleManager, battleReturnState, type TurnResult } from '../battle/BattleManager';
import { PartyBattleSession } from '../battle/PartyBattleSession';
import { CaptureSystem } from '../battle/CaptureSystem';
import { skills } from '../data/skills';
import { entityDefinitions } from '../data/encounters';
import { createWorldMap } from '../data/world';
import type { RuntimeGameState } from '../state/RuntimeGameState';
import { CuteEventSystem, debugCuteEvent, type CuteEvent } from '../battle/CuteEventSystem';
import { advancePlayTime } from '../systems/PlayTimeSystem';
import { BattlePresentation } from '../presentation/BattlePresentation';
import { MessageQueue } from '../presentation/MessageQueue';
import { moveFocus, skillView, THEME, PresentationLock } from '../presentation/ViewModels';
import { AudioManager } from '../presentation/AudioManager';
import { invitationItems } from '../data/invitationItems';
type Panel = 'MAIN' | 'SKILLS' | 'ITEMS' | 'PARTY' | 'LEARN' | 'REPLACE';
export class BattleScene extends Phaser.Scene {
  private entry!: BattleEntryPayload;
  private session!: PartyBattleSession;
  private exiting = false;
  private readonly inputLock = new PresentationLock();
  private get resolving(): boolean { return this.inputLock.locked; }
  private set resolving(value: boolean) { if (value) this.inputLock.begin(); else this.inputLock.end(); }
  private hasPresented = false;
  private panel: Panel = 'MAIN';
  private controls: { button: Phaser.GameObjects.Text; action: () => void; detail?: string }[] = [];
  private menuButtons: Phaser.GameObjects.Text[] = [];
  private logText!: Phaser.GameObjects.Text;
  private dialogue!: Phaser.GameObjects.Text;
  private detail!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private encounterText!: Phaser.GameObjects.Text;
  private returnButton!: Phaser.GameObjects.Text;
  private presentation!: BattlePresentation;
  private queue!: MessageQueue;
  private audio!: AudioManager;
  private selection = 0;
  private pureConfirm?: () => void;
  private introReady = false;
  get manager(): BattleManager { return this.session?.manager; }
  set manager(manager: BattleManager) { this.session.manager = manager; }
  constructor() { super('BattleScene'); }
  update(_time: number, delta: number): void { if (this.session) advancePlayTime(this.session.state, delta, !this.exiting && !document.hidden); }
  init(entry: BattleEntryPayload): void {
    this.entry = entry;
    const params = new URLSearchParams(window.location.search), debug = import.meta.env.DEV && params.get('debugEncounters') === '1';
    const captureMode = debug ? this.registry.get('debug-capture') ?? params.get('invite') ?? params.get('capture') : null;
    this.registry.remove('debug-capture');
    const capture = new CaptureSystem(captureMode === 'success' ? () => 0 : captureMode === 'failure' || captureMode === 'fail' ? () => 0.99999 : undefined);
    const cuteEvents = new CuteEventSystem();
    if (debug && params.get('forceCuteEvent') === '1') cuteEvents.forceNext(debugCuteEvent(params.get('cuteEvent')) ?? 'SLEEP');
    if (debug && this.registry.has('debug-cute-event')) { cuteEvents.forceNext(this.registry.get('debug-cute-event')); this.registry.remove('debug-cute-event'); }
    this.session = new PartyBattleSession(this.registry.get('game-state') as RuntimeGameState, entry, undefined, capture, cuteEvents);
    if (debug && params.get('item') === 'bribe' && this.session.state.inventory.INVITE_BRIBE === 0) { this.session.state.inventory.INVITE_BRIBE = 1; this.session.state.isDirty = true; }
    this.exiting = this.resolving = this.hasPresented = false; this.pureConfirm = undefined;
    this.introReady = false;
    this.controls = []; this.menuButtons = []; this.panel = 'MAIN'; this.selection = 0;
  }
  create(): void {
    const text = (x: number, y: number, value: string, size = 14) => this.add.text(x, y, value, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: `${size}px`, color: THEME.text }).setDepth(12);
    this.audio = new AudioManager(this); this.audio.playMusic(this.entry.isBoss ? 'BOSS_THEME' : 'BATTLE_THEME');
    this.presentation = new BattlePresentation(this, this.manager, this.audio); this.queue = new MessageQueue(this);
    // Keep one reusable history object, while the visible dialogue shows the current message.
    this.logText = text(24, 228, '', 12).setName('battle-log').setVisible(false);
    this.encounterText = text(24, 228, this.entry.messages.join('\n'), 14).setName('encounter-message').setVisible(false);
    this.dialogue = text(27, 230, this.entry.isBoss ? '巨型森林怪擋住了去路！' : this.entry.messages.at(-1)!, 15).setWordWrapWidth(580).setName('dialogue-text');
    this.detail = text(342, 288, '方向鍵選擇\nEnter / Space 確認', 12).setWordWrapWidth(268).setName('skill-detail');
    this.status = text(24, 346, '準備進場……', 10).setName('battle-status');
    ['戰鬥', '道具', '隊伍', '逃跑'].forEach((label, index) => {
      const button = text(24 + index % 2 * 154, 284 + Math.floor(index / 2) * 28, label, 16).setBackgroundColor('#476957').setPadding(10, 3).setFixedSize(144, 25).setInteractive({ useHandCursor: true }).setName(`battle-option-${index}`);
      button.on('pointerdown', () => this.menu(index)); button.on('pointerover', () => this.focus(index)); this.menuButtons.push(button);
    });
    this.returnButton = text(482, 300, '返回', 18).setBackgroundColor('#476957').setPadding(12, 6).setInteractive({ useHandCursor: true }).setVisible(false).setName('battle-return');
    this.returnButton.on('pointerdown', () => this.leave());
    const handledKeys = new WeakSet<KeyboardEvent>();
    const key = (event: KeyboardEvent) => {
      if (this.exiting || event.repeat || handledKeys.has(event)) return; handledKeys.add(event);
      if (event.key === 'Enter' || event.code === 'Space') {
        if (this.pureConfirm) { this.pureConfirm(); return; }
        if (this.resolving) { this.queue.advance(); return; }
        if (this.returnButton.visible) { this.leave(); return; }
        if (this.panel === 'MAIN') this.menu(this.selection); else this.controls[this.selection]?.action(); return;
      }
      if (this.resolving) return;
      if (event.key === 'F3' && import.meta.env.DEV && new URLSearchParams(window.location.search).get('debugEncounters') === '1') {
        const selected = debugCuteEvent(new URLSearchParams(window.location.search).get('cuteEvent'));
        const events: CuteEvent[] = ['SLEEP', 'CHARM', 'FART', 'CUTE_POSE'];
        const chosen = selected ?? events[this.registry.get('debug-cute-index') ?? 0];
        this.registry.set('debug-cute-index', ((this.registry.get('debug-cute-index') ?? 0) + 1) % 4);
        this.manager.cuteEvents.forceNext(chosen); this.status.setText(`DEBUG：下一次有效可愛攻擊觸發 ${chosen}。`); return;
      }
      if (event.key.startsWith('Arrow')) this.focus(moveFocus(this.selection, event.key, this.panel === 'MAIN' ? 4 : this.controls.length, this.panel === 'PARTY' ? 1 : 2));
      else if (event.key === 'Escape') {
        if (this.session.learning?.pending.length) { if (this.panel === 'REPLACE') this.showPanel('LEARN'); return; }
        if (this.manager.needsSwitch) return;
        if (this.panel !== 'MAIN') this.showPanel('MAIN'); else this.leave();
      } else if (/^[1-5]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (this.panel === 'MAIN' && !this.manager.result) this.menu(index); else this.controls[index]?.action();
      }
    };
    this.input.keyboard!.on('keydown', key);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard?.off('keydown', key); this.queue.destroy(); this.presentation.destroy(); this.time.removeAllEvents(); this.pureConfirm = undefined; });
    this.resolving = true; this.menuButtons.forEach(b => b.setVisible(false)); this.detail.setVisible(false);
    const intro = () => this.presentation.intro(() => { this.introReady = true; this.resolving = false; this.showPanel('MAIN'); });
    if (this.manager.enemy.definition.attribute === 'PURE_CUTE') {
      this.presentation.sprites.forEach(s => s.setVisible(false));
      const shade = this.add.rectangle(320, 180, 640, 360, THEME.ink).setAlpha(0.97).setDepth(30);
      const label = text(320, 146, '這是什麼？上網查一下！', 22).setOrigin(0.5).setDepth(31);
      const confirm = text(320, 210, '確認 · Enter / Space', 16).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true }).setName('pure-confirm');
      this.pureConfirm = () => { if (!this.pureConfirm) return; this.pureConfirm = undefined; shade.destroy(); label.destroy(); confirm.destroy(); this.audio.playSfx('UI_CONFIRM'); this.presentation.sprites.forEach(s => s.setVisible(true)); intro(); };
      confirm.on('pointerdown', () => this.pureConfirm?.());
    } else intro();
  }
  private focus(index: number): void {
    this.selection = index;
    const buttons = this.panel === 'MAIN' ? this.menuButtons : this.controls.map(c => c.button);
    buttons.forEach((b, i) => b.setColor(i === index ? '#ffe08d' : THEME.text));
    if (this.panel === 'SKILLS' || this.panel === 'ITEMS') this.dialogue.setText(this.controls[index]?.detail ?? '選擇行動。');
  }
  private clearControls(): void { this.controls.forEach(c => c.button.destroy()); this.controls = []; }
  private button(x: number, y: number, label: string, name: string, action: () => void, width = 282, detail?: string): void {
    const button = this.add.text(x, y, label, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '12px', color: THEME.text, backgroundColor: '#476957', padding: { x: 9, y: 2 }, fixedWidth: width }).setDepth(13).setInteractive({ useHandCursor: true }).setName(name);
    const guarded = () => { if (!this.resolving && !this.exiting) { this.audio.playSfx('UI_CONFIRM'); action(); } };
    const index = this.controls.length; button.on('pointerdown', guarded); button.on('pointerover', () => this.focus(index)); this.controls.push({ button, action: guarded, detail });
  }
  private menu(index: number): void {
    if (this.resolving || this.manager.result || this.manager.needsSwitch) return;
    if (index === 3) this.leave(); else if (index < 3) this.showPanel((['SKILLS', 'ITEMS', 'PARTY'] as const)[index]);
  }
  private showLog(value: string): void { this.logText.setText(value); this.dialogue.setText(value.split('\n').slice(-2).join('\n')); }
  private showPanel(panel: Panel): void {
    this.clearControls(); this.panel = panel; this.selection = 0;
    this.menuButtons.forEach(b => b.setVisible(panel === 'MAIN')); this.detail.setVisible(panel === 'MAIN');
    this.dialogue.setVisible(true);
    if (panel === 'MAIN') { this.status.setText('選擇行動；方向鍵 / Enter / Space · 1～4 / Esc 逃跑。'); this.focus(0); return; }
    if (panel === 'SKILLS') {
      this.manager.player.definition.skills.slice(0, 4).forEach((id, index) => {
        const view = skillView(skills[id]); this.button(24 + index % 2 * 306, 284 + Math.floor(index / 2) * 30, `${view.name}  ${view.category} · P${view.power} / ${view.accuracy}%`, `skill-${id}`, () => this.present(this.session.attack(id)), 282, view.detail);
      }); this.status.setText('請選擇技能。');
    } else if (panel === 'ITEMS') {
      invitationItems.forEach((item, index) => this.button(24 + index % 2 * 306, 284 + Math.floor(index / 2) * 30, `${item.name} ×${this.session.state.inventory[item.id]}`, index === 0 ? 'capture-item' : `invite-${item.presentation.toLowerCase()}`, () => this.present(this.session.capture(item.id), true), 282, item.description));
      this.dialogue.setText('拿出點心，邀請小可愛同行。'); this.status.setText('選擇道具；成功加入隊伍或 Reserve，失敗敵人會行動。');
    } else if (panel === 'PARTY') {
      this.dialogue.setVisible(false);
      // A compact overlay covers the command area; the combat scene underneath is preserved.
      this.session.state.party.forEach((member, index) => {
        const d = entityDefinitions[member.creatureId], marker = member.instanceId === this.session.state.activeInstanceId ? '[出戰]' : member.currentHp <= 0 ? '[昏倒]' : '';
        this.button(24, 232 + index * 22, `${index + 1}. ${marker}${d.name} Lv.${member.level} HP ${member.currentHp}/${member.maxHp} ${d.attribute}`, `party-${member.instanceId}`, () => { if (!this.session.party.canSwitch(member.instanceId)) { this.status.setText('這隻小可愛目前不能換上。'); return; } this.presentation.sprites[0].setAlpha(1); this.present(this.session.switchTo(member.instanceId)); }, 592);
      }); this.status.setText(this.manager.needsSwitch ? '請選擇下一隻小可愛。' : '換人消耗一回合，敵人會行動；Esc 返回。');
    } else {
      const next = this.session.learning!.pending[0]; this.showLog(`${this.manager.player.definition.name}想學會 ${skills[next].name}！\n但是已經會四個技能了。`);
      if (panel === 'LEARN') { this.button(24, 290, '忘記一個技能', 'learn-forget', () => this.showPanel('REPLACE')); this.button(330, 290, '放棄學習', 'learn-decline', () => this.presentLearning()); }
      else this.session.party.active.knownSkills.forEach((id, index) => this.button(24 + index % 2 * 306, 284 + Math.floor(index / 2) * 30, skills[id].name, `forget-${index}`, () => this.presentLearning(index)));
      this.status.setText(panel === 'LEARN' ? '請決定學習方式；1 / 2 選擇。' : '選一招替換；Esc 返回學習選項。');
    }
    this.focus(0);
  }
  private refreshHP(): void { this.presentation.sync(this.manager); }
  private presentLearning(index?: number): void { this.present({ messages: this.session.decideLearning(index), order: [], result: this.manager.result }); }
  private present(turn: TurnResult, _capture = false): void {
    if (this.resolving || this.exiting) return;
    this.resolving = true; this.clearControls(); this.panel = 'MAIN'; this.hasPresented = true;
    this.dialogue.setVisible(true); this.menuButtons.forEach(b => b.setVisible(false)); this.detail.setVisible(false); this.status.setText('回合進行中…… Enter / Space 加快文字');
    this.dialogue.setText(turn.messages[0] ?? '……');
    this.presentation.play(turn.events ?? [], this.manager, () => this.queue.play(turn.messages, shown => this.showLog(shown.join('\n')), () => {
      this.resolving = false; this.refreshHP();
      if (turn.messages.some(m => m.includes('升到了'))) this.audio.playSfx('LEVEL_UP');
      if (this.session.learning?.pending.length) this.showPanel('LEARN');
      else if (this.session.state.pendingEvolution) this.presentEvolution();
      else if (this.manager.needsSwitch) this.showPanel('PARTY');
      else if (this.manager.result) {
        if (this.entry.isBoss && this.manager.result.outcome === 'VICTORY') this.showLog(['巨型森林怪倒下了！', '森林好像安靜下來了。', ...turn.messages.slice(-3)].join('\n'));
        this.returnButton.setVisible(true); this.status.setText(this.manager.result.outcome === 'DEFEAT' ? '你被送回營地了。按返回。' : '結算完成，按返回繼續探索。');
      } else { this.showPanel('MAIN'); this.status.setText('請選擇下一回合的行動。'); }
    }));
  }
  private presentEvolution(): void {
    this.resolving = true; this.clearControls(); this.menuButtons.forEach(b => b.setVisible(false));
    const pending = this.session.state.pendingEvolution!; this.showLog(`咦……？\n${this.manager.player.definition.name}的樣子好像怪怪的！`); this.status.setText('進化中……');
    let messages: string[] = [];
    this.presentation.evolution(pending.beforeId, pending.targetId, () => { messages = this.session.applyEvolution(); this.refreshHP(); this.showLog(messages.join('\n')); }, () => this.queue.play(messages, shown => this.showLog(shown.join('\n')), () => { this.resolving = false; this.returnButton.setVisible(true); this.status.setText('進化與結算完成，按返回。'); }));
  }
  private leave(): void {
    if (this.exiting || this.resolving || this.manager.needsSwitch || this.session.learning?.pending.length || this.session.state.pendingEvolution) return;
    if (this.entry.isBoss && !this.manager.result) { this.status.setText('現在好像不是逃跑的時候！'); return; }
    const skipped = this.session.skipEscapeIfAsleep(); if (skipped) { this.present(skipped); return; }
    this.exiting = true; this.session.finishReturn();
    this.scene.wake('WorldScene', battleReturnState(this.entry.world, this.manager.result!, createWorldMap().spawn)); this.scene.stop();
  }
}
