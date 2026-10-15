export interface TimedSession<T> {
  data: T;
  updatedAt: number;
}

const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000; // 15 دقيقة

export class SessionManager<T> {
  private store = new Map<string, TimedSession<T>>();
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_SESSION_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  public get(phone: string): T | undefined {
    const entry = this.store.get(phone);
    if (!entry) return undefined;

    if (Date.now() - entry.updatedAt > this.ttlMs) {
      this.store.delete(phone);
      return undefined;
    }

    return entry.data;
  }

  public set(phone: string, data: T): void {
    this.store.set(phone, {
      data,
      updatedAt: Date.now(),
    });
  }

  public delete(phone: string): void {
    this.store.delete(phone);
  }

  public has(phone: string): boolean {
    return this.get(phone) !== undefined;
  }
}

/**
 * فحص ما إذا كانت رسالة الموظف تطلب إلغاء العملية الحالية والعودة للقائمة الرئيسية
 */
export function isCancelOrResetCommand(text?: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return [
    'إلغاء',
    'الغاء',
    'خروج',
    'قائمة',
    'القائمة',
    'البداية',
    'cancel',
    'exit',
    'menu',
    'start',
    '0',
  ].includes(normalized);
}
