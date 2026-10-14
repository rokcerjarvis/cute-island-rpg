import Phaser from 'phaser';
import { PartySystem } from '../systems/PartySystem';
import { entityDefinitions } from '../data/encounters';
import { DexSystem, creatureRoles, dexDefinitions } from '../systems/DexSystem';
import { formatPlayTime } from '../systems/SaveSystem';
import { creatureVisual, ATTRIBUTE_KEYS, TEXTURES } from '../presentation/AssetManifest';
import { hpView } from '../presentation/ViewModels';
import { AudioManager } from '../presentation/AudioManager';
import { statusView, adjacentMember } from '../presentation/CreatureStatusView';
export const HEAL_POINT = { x: 240, y: 368, radius: 72 } as const;
export class WorldPartyUI {
  private panel?: Phaser.GameObjects.Container;
  private mode?: 'PARTY' | 'PARTY_ACTION' | 'STATUS' | 'HEAL' | 'BOSS' | 'COMPLETION' | 'MENU' | 'DEX' | 'DEX_DETAIL' | 'RETURN' | 'DEBUG';
  private partySelection = 0;
  private partyRows: Phaser.GameObjects.Rectangle[] = [];
  private actions: { item: Phaser.GameObjects.Text; action: () => void }[] = [];
  private selection = 0;
  private readonly handledKeys = new WeakSet<KeyboardEvent>();
  private confirmPrompt?: () => void;
  private readonly toast: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private readonly healPrompt: Phaser.GameObjects.Text;
  private readonly audio: AudioManager;
  constructor(private readonly scene: Phaser.Scene, private readonly party: PartySystem, private readonly stopMovement: () => void, private readonly callbacks?: { save: () => boolean; title: () => void; healed: () => void; debug: boolean }) {
    this.toast = scene.add.text(14, 333, '', { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '13px', color: '#fff0d0', backgroundColor: '#253e31', padding: { x: 8, y: 5 } }).setScrollFactor(0).setDepth(10002).setName('world-feedback');
    this.toast.setVisible(false); this.audio = new AudioManager(scene);
    this.healPrompt = scene.add.text(HEAL_POINT.x, HEAL_POINT.y - 18, 'E / Space · 休息', { fontSize: '12px', color: '#fff0d0', backgroundColor: '#526a47', padding: { x: 4, y: 4 } }).setOrigin(0.5).setName('heal-point');
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.toastTimer?.remove(); this.panel?.destroy(); this.panel = undefined; this.actions = []; this.partyRows = []; this.mode = undefined; this.confirmPrompt = undefined; this.audio.destroy(); });
  }
  update(x: number, y: number): void { this.healPrompt.setVisible(!this.isOpen && Phaser.Math.Distance.Between(x, y, HEAL_POINT.x, HEAL_POINT.y) <= HEAL_POINT.radius); }
  get isOpen(): boolean { return Boolean(this.panel); }
  notify(message: string): void {
    this.toastTimer?.remove(false);
    this.toast.setText(message).setVisible(true);
    this.toastTimer = this.scene.time.delayedCall(3200, () => this.toast.setText('').setVisible(false));
  }
  close(): void { this.panel?.destroy(); this.panel = undefined; this.mode = undefined; this.confirmPrompt = undefined; this.actions = []; this.partyRows = []; this.selection = 0; this.stopMovement(); }
  private options(mode: 'MENU' | 'RETURN' | 'DEBUG' | 'PARTY_ACTION', title: string, options: { label: string; name: string; action: () => void }[]): void {
    this.close(); this.mode = mode;
    const items: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78), this.scene.add.text(35, 45, title, { fontSize: '20px', color: '#fff0d0' })];
    options.forEach((o, i) => {
      const item = this.scene.add.text(mode === 'DEBUG' ? 35 + i % 2 * 305 : 35, mode === 'DEBUG' ? 85 + Math.floor(i / 2) * Math.min(31, 220 / Math.max(1, Math.ceil(options.length / 2) - 1)) : 85 + i * 38, `${i + 1}. ${o.label}`, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: mode === 'DEBUG' ? '12px' : '17px', color: '#fff0d0', backgroundColor: '#476957', padding: { x: 10, y: 4 } }).setName(o.name).setInteractive({ useHandCursor: true });
      item.on('pointerdown', o.action); this.actions.push({ item, action: o.action }); items.push(item);
    });
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0));
    this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0, 0, true).setDepth(10001).setName('world-panel'); this.focus(0);
  }
  debug(title: string, options: { label: string; name: string; action: () => void }[]): void {
    if (!this.callbacks?.debug) return;
    this.options('DEBUG', title, options.map(o => ({ ...o, action: () => { this.close(); o.action(); } })));
  }
  showDex(): void { this.dex(); }
  confirmClearSave(action: () => void): void { this.options('RETURN', '確定刪除唯一冒險紀錄？', [{ label: '確定刪除', name: 'debug-clear-confirm', action: () => { this.close(); action(); } }, { label: '取消', name: 'debug-clear-cancel', action: () => this.close() }]); }
  private focus(i: number): void { if (!this.actions.length) return; this.selection = (i + this.actions.length) % this.actions.length; this.actions.forEach((a, j) => a.item.setColor(j === this.selection ? '#ffe08d' : '#fff0d0')); }
  private menu(): void {
    this.options('MENU', `冒險選單 · ${formatPlayTime(this.party.state.playTimeSeconds)}`, [
      { label: '隊伍', name: 'menu-party', action: () => { this.close(); this.open('PARTY'); } },
      { label: '圖鑑', name: 'menu-dex', action: () => this.dex() },
      { label: '儲存遊戲', name: 'menu-save', action: () => { this.close(); this.callbacks?.save(); } },
      { label: '返回標題', name: 'menu-title', action: () => this.returnTitle() },
      { label: '關閉', name: 'menu-close', action: () => this.close() },
    ]);
  }
  private returnTitle(): void {
    if (!this.party.state.isDirty) { this.close(); this.callbacks?.title(); return; }
    this.options('RETURN', '尚有未儲存的進度。', [
      { label: '儲存並返回', name: 'return-save', action: () => { if (this.callbacks?.save()) { this.close(); this.callbacks?.title(); } } },
      { label: '直接返回', name: 'return-direct', action: () => { this.close(); this.callbacks?.title(); } },
      { label: '取消', name: 'return-cancel', action: () => this.menu() },
    ]);
  }
  private dex(): void {
    this.close(); this.mode = 'DEX';
    const dex = new DexSystem(this.party.state.dex);
    const items: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78), this.scene.add.text(35, 45, `小可愛圖鑑 ${dex.countSeen()} / 7 · 已同行 ${dex.countCaptured()}`, { fontSize: '20px', color: '#fff0d0' })];
    dex.lines().forEach((line, i) => {
      const definition = dexDefinitions[i], status = this.party.state.dex[definition.id];
      const image = this.scene.add.image(48, 99 + i * 29, status === 'UNKNOWN' ? TEXTURES.fallback : creatureVisual(definition.id).portraitKey).setDisplaySize(26, 26).setName(`dex-portrait-${definition.id}`);
      if (status === 'SEEN') image.setTint(0x43564a).setAlpha(0.65); else if (status === 'UNKNOWN') image.setAlpha(0.3);
      items.push(image);
      const item = this.scene.add.text(70, 86 + i * 29, line, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '12px', color: '#fff0d0' }).setName(`dex-entry-${i}`);
      if (status === 'CAPTURED') item.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.dexDetail(definition.id));
      items.push(item);
    });
    const close = this.scene.add.text(35, 303, '返回（Esc / Enter）', { fontSize: '14px', color: '#fff0d0' }).setInteractive({ useHandCursor: true }).setName('dex-close'); close.on('pointerdown', () => this.close()); items.push(close);
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0));
    this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0, 0, true).setDepth(10001).setName('world-panel');
  }
  private dexDetail(id: string): void {
    if (this.party.state.dex[id] !== 'CAPTURED') return;
    this.close(); this.mode = 'DEX_DETAIL'; const d = entityDefinitions[id];
    const items: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78), this.scene.add.image(136, 172, creatureVisual(id).portraitKey).setScale(3), this.scene.add.image(266, 121, ATTRIBUTE_KEYS[d.attribute]).setScale(1.5), this.scene.add.text(288, 73, `${d.name}\n\n${d.attribute}\n${creatureRoles[id]}\n已同行`, { fontSize: '18px', color: '#fff0d0', lineSpacing: 5 })];
    if (d.attribute === 'PURE_CUTE') items.push(this.scene.add.text(55, 251, '這是什麼？上網查一下！', { fontSize: '18px', color: '#edc8be' }));
    const close = this.scene.add.text(55, 297, '返回圖鑑 · Esc / Enter', { fontSize: '14px', color: '#fff0d0' }).setInteractive({ useHandCursor: true }).setName('dex-detail-back'); close.on('pointerdown', () => this.dex()); items.push(close);
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0)); this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0).setDepth(10001).setName('world-panel');
  }
  prompt(title: string, lines: string[], confirm?: () => void): void {
    this.close(); this.stopMovement(); this.mode = confirm ? 'BOSS' : 'COMPLETION'; this.confirmPrompt = confirm;
    const items: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78)];
    items.push(this.scene.add.text(35, 48, title, { fontSize: '22px', color: '#fff0d0' }).setName('progress-title'));
    items.push(this.scene.add.text(35, 95, lines.join('\n'), { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: '17px', color: '#fff0d0', lineSpacing: 10 }).setName('progress-message'));
    const button = this.scene.add.text(35, 285, confirm ? '確認挑戰（Enter / 1）' : '繼續探索（Enter / Esc）', { fontSize: '17px', color: '#fff0d0', backgroundColor: '#476957', padding: { x: 12, y: 5 } }).setInteractive({ useHandCursor: true }).setName('progress-confirm');
    button.on('pointerdown', () => { const callback = this.confirmPrompt; this.close(); callback?.(); }); items.push(button);
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0));
    this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0, 0, true).setDepth(10001).setName('world-panel');
  }
  key(event: KeyboardEvent, x: number, y: number): void {
    // A queued native event may be processed by Phaser more than once before it is flushed.
    if (event.repeat || this.handledKeys.has(event)) return;
    this.handledKeys.add(event);
    if (event.key === 'Escape') { this.audio.playSfx('UI_CANCEL'); if (this.mode === 'STATUS' || this.mode === 'PARTY_ACTION') this.showParty(this.partySelection); else if (this.mode === 'DEX_DETAIL') this.dex(); else if (this.isOpen) this.close(); else this.menu(); return; }
    if (this.isOpen) {
      if (this.mode === 'STATUS') {
        if (event.key === 'ArrowLeft') this.showStatus(adjacentMember(this.partySelection, -1, this.party.state.party.length));
        else if (event.key === 'ArrowRight') this.showStatus(adjacentMember(this.partySelection, 1, this.party.state.party.length));
        else if (event.key.toLowerCase() === 'p') this.close();
        return;
      }
      if (this.mode === 'PARTY') {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') this.focusParty(adjacentMember(this.partySelection, 1, this.party.state.party.length));
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') this.focusParty(adjacentMember(this.partySelection, -1, this.party.state.party.length));
        else if (event.key === 'Enter' || event.code === 'Space') this.memberActions(this.partySelection);
        else if (/^[1-5]$/.test(event.key)) this.memberActions(Number(event.key) - 1);
        else if (event.key.toLowerCase() === 'p') this.close();
        return;
      }
      if (this.mode === 'MENU' || this.mode === 'RETURN' || this.mode === 'DEBUG' || this.mode === 'PARTY_ACTION') {
        if (this.mode === 'PARTY_ACTION' && event.key.toLowerCase() === 'p') { this.close(); return; }
        if (event.key === 'ArrowDown') this.focus(this.selection + (this.mode === 'DEBUG' ? 2 : 1));
        else if (event.key === 'ArrowUp') this.focus(this.selection - (this.mode === 'DEBUG' ? 2 : 1));
        else if (this.mode === 'DEBUG' && event.key === 'ArrowRight') this.focus(this.selection + 1);
        else if (this.mode === 'DEBUG' && event.key === 'ArrowLeft') this.focus(this.selection - 1);
        else if (event.key === 'Enter' || event.code === 'Space') this.actions[this.selection]?.action();
        else if (/^[1-5]$/.test(event.key)) this.actions[Number(event.key) - 1]?.action();
        return;
      }
      if (this.mode === 'DEX' && (event.key === 'Enter' || event.code === 'Space')) { this.close(); return; }
      if (this.mode === 'DEX_DETAIL' && (event.key === 'Enter' || event.code === 'Space')) { this.dex(); return; }
      if ((this.mode === 'BOSS' || this.mode === 'COMPLETION') && (event.key === 'Enter' || event.code === 'Space' || event.key === '1')) { const callback = this.confirmPrompt; this.close(); callback?.(); return; }
      if (this.mode === 'HEAL' && (event.key === 'Enter' || event.code === 'Space' || event.key === '1')) this.confirmHeal();
      if (this.mode === 'HEAL' && event.key === '2') this.close();
      return;
    }
    if (event.key.toLowerCase() === 'p') this.open('PARTY');
    else if ((event.key.toLowerCase() === 'e' || event.code === 'Space') && Phaser.Math.Distance.Between(x, y, HEAL_POINT.x, HEAL_POINT.y) <= HEAL_POINT.radius) this.open('HEAL');
  }
  private confirmHeal(): void { this.party.healAll(); this.audio.playSfx('HEAL'); this.close(); this.notify('小可愛們精神都恢復了！'); this.callbacks?.healed(); }
  private open(mode: 'PARTY' | 'HEAL'): void {
    if (mode === 'PARTY') { this.showParty(); return; }
    this.stopMovement(); this.mode = mode;
    const items: Phaser.GameObjects.GameObject[] = [];
    items.push(this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78));
    const text = (x: number, y: number, value: string, size = 17) => {
      const item = this.scene.add.text(x, y, value, { fontFamily: 'Microsoft JhengHei, sans-serif', fontSize: `${size}px`, color: '#fff0d0' }); items.push(item); return item;
    };
    text(35, 45, '休息一下？');
      text(35, 100, '休息後全隊恢復 HP，昏倒的小可愛也會醒來。', 16);
      const confirm = text(70, 190, '1. 確認恢復（Enter）').setName('heal-confirm').setInteractive({ useHandCursor: true });
      const cancel = text(350, 190, '2. 取消（Esc）').setName('heal-cancel').setInteractive({ useHandCursor: true });
      confirm.on('pointerdown', () => this.confirmHeal()); cancel.on('pointerdown', () => this.close());
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0));
    this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0, 0, true).setDepth(10001).setName('world-panel');
  }
  private mount(items: Phaser.GameObjects.GameObject[]): void {
    items.forEach(item => (item as Phaser.GameObjects.Text).setScrollFactor(0));
    this.panel = this.scene.add.container(0, 0, items).setScrollFactor(0).setDepth(10001).setName('world-panel');
  }
  private showParty(index = 0): void {
    this.close(); this.mode = 'PARTY'; this.partySelection = Math.max(0, Math.min(index, this.party.state.party.length - 1));
    const items: Phaser.GameObjects.GameObject[] = [this.scene.add.rectangle(320, 180, 608, 300, 0x213d35).setStrokeStyle(2, 0x8f9f78)];
    const text = (x: number,y: number,value: string,size = 12) => { const t=this.scene.add.text(x,y,value,{fontFamily:'Microsoft JhengHei, sans-serif',fontSize:`${size}px`,color:'#fff0d0'});items.push(t);return t; };
    text(35,45,`隊伍 ${this.party.state.party.length} / 5 · Reserve ${this.party.state.reserveStorage.length}`,17);
    for(let i=0;i<5;i++){
      const member=this.party.state.party[i],y=83+i*38;
      const row=this.scene.add.rectangle(320,y+16,574,35,0x345448).setStrokeStyle(1,0x759377).setName(`party-slot-${i}`);this.partyRows.push(row);items.push(row);
      if(!member){text(80,y+7,'空位',13);continue;}
      row.setInteractive({useHandCursor:true}).on('pointerover',()=>this.focusParty(i)).on('pointerdown',()=>this.memberActions(i));
      const portrait=this.scene.add.image(54,y+16,creatureVisual(member.creatureId).portraitKey).setDisplaySize(30,30).setName(`party-portrait-${member.instanceId}`);if(!member.currentHp)portrait.setTint(0x607166).setAlpha(.5);items.push(portrait);
      text(80,y+2,`${i===0?'LEAD 隊首 · ':''}${entityDefinitions[member.creatureId].name} Lv.${member.level} HP ${member.currentHp}/${member.maxHp} ${member.attribute}${member.currentHp<=0?' 昏倒':''}`);
      items.push(this.scene.add.image(589,y+17,ATTRIBUTE_KEYS[member.attribute]));const hp=hpView(member.currentHp,member.maxHp);
      items.push(this.scene.add.rectangle(80,y+27,480,4,0x142b26).setOrigin(0,.5),this.scene.add.rectangle(80,y+27,480*hp.ratio,4,hp.color).setOrigin(0,.5));
    }
    text(35,285,`Reserve：${this.party.state.reserveStorage.length} 隻 · ↑↓ 選擇 / Enter 操作 · P / Esc 關閉`,13).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.close()).setName('party-close');
    if(!this.party.state.party.length)text(35,307,'隊伍目前沒有同伴。',12);
    this.mount(items);this.focusParty(this.partySelection);
  }
  private focusParty(index: number): void {
    if(!this.party.state.party[index])return;this.partySelection=index;
    this.partyRows.forEach((row,i)=>row.setStrokeStyle(i===index?2:1,i===index?0xffe08d:0x759377));
  }
  private memberActions(index: number): void {
    const member=this.party.state.party[index];if(!member)return;this.partySelection=index;
    this.options('PARTY_ACTION',`${entityDefinitions[member.creatureId].name} Lv.${member.level}`, [
      {label:index===0?'目前隊首':'設為隊首',name:'party-set-leader',action:()=>{
        const result=this.party.setLeader(member.instanceId);
        if(result==='FAINTED'){this.notify('牠現在沒辦法帶頭出戰。');return;}
        if(result==='CHANGED'){this.notify(`${entityDefinitions[member.creatureId].name}成為隊首！`);this.showParty(0);}
      }},
      {label:'查看狀態',name:'party-view-status',action:()=>this.showStatus(this.party.state.party.findIndex(m=>m.instanceId===member.instanceId))},
      {label:'返回',name:'party-action-back',action:()=>this.showParty(this.partySelection)},
    ]);
    if(index===0)this.actions[0].item.setAlpha(.55);
  }
  private showStatus(index: number): void {
    const member=this.party.state.party[index];if(!member){this.showParty();return;}
    this.close();this.mode='STATUS';this.partySelection=index;const view=statusView(member);
    const items: Phaser.GameObjects.GameObject[]=[this.scene.add.rectangle(320,180,608,300,0x213d35).setStrokeStyle(2,0x8f9f78)];
    const text=(x:number,y:number,value:string,size=13,name?:string)=>{const t=this.scene.add.text(x,y,value,{fontFamily:'Microsoft JhengHei, sans-serif',fontSize:`${size}px`,color:'#fff0d0',lineSpacing:3});if(name)t.setName(name);items.push(t);return t;};
    text(35,45,`${view.name} Lv.${view.level}${index===0?' · 隊首':''}`,20,'status-name');text(535,49,`${index+1} / ${this.party.state.party.length}`,13);
    items.push(this.scene.add.image(110,140,creatureVisual(member.creatureId).portraitKey).setScale(2.5).setName('status-portrait'),this.scene.add.image(216,90,ATTRIBUTE_KEYS[view.attribute]).setName('status-attribute-icon'));
    text(236,79,view.attribute,15,'status-attribute');if(view.pureCute)text(216,105,'這是什麼？上網查一下！',12,'status-pure-cute');
    text(35,192,`HP ${view.currentHp} / ${view.maxHp}\nAttack ${view.attack} · Speed ${view.speed}\n狀態：${view.fainted?'昏倒':'正常'}`,14,'status-stats');
    // Space below stats reserved for future starter identity; no starter flag is inferred.
    text(216,129,`累積 EXP ${view.currentExp}`,13,'status-exp');text(216,148,view.maxLevel?'Lv.50 · 已達最高等級':`升級還需 ${view.neededExp} EXP`,13,'status-exp-next');
    items.push(this.scene.add.rectangle(216,173,370,7,0x142b26).setOrigin(0,.5),this.scene.add.rectangle(216,173,370*view.expRatio,7,0x92b77b).setOrigin(0,.5).setName('status-exp-bar'));
    text(35,268,`進化：${view.evolution}`,13,'status-evolution');text(295,194,'目前技能',14);
    view.skills.forEach((skill,i)=>text(295,215+i*20,skill.label,12,`status-skill-${i}`));
    text(35,305,'◀ 前一位',13,'status-prev').setInteractive({useHandCursor:true}).on('pointerdown',()=>this.showStatus(adjacentMember(index,-1,this.party.state.party.length)));
    text(212,305,'下一位 ▶',13,'status-next').setInteractive({useHandCursor:true}).on('pointerdown',()=>this.showStatus(adjacentMember(index,1,this.party.state.party.length)));
    text(470,305,'返回隊伍 · Esc',13,'status-back').setInteractive({useHandCursor:true}).on('pointerdown',()=>this.showParty(index));
    this.mount(items);
  }
}
