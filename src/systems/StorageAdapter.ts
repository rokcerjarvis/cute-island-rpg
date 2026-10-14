export interface StorageAdapter { read(): string | null; write(value: string): void; remove(): void }
export const SAVE_KEY = 'pan-james.save.v1';
export class BrowserLocalStorageAdapter implements StorageAdapter {
  constructor(private readonly key = SAVE_KEY) {}
  read(): string | null { return window.localStorage.getItem(this.key); }
  write(value: string): void { window.localStorage.setItem(this.key, value); }
  remove(): void { window.localStorage.removeItem(this.key); }
}
