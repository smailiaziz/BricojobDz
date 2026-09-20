import { appSessionStorage } from './storage';

const STORAGE_KEY = 'bricojob_desktop_bypassed';

export interface IDesktopRestrictionRepository {
  isBypassed(): boolean;
  setBypassed(bypassed: boolean): boolean;
}

export class DesktopRestrictionRepository implements IDesktopRestrictionRepository {
  public isBypassed(): boolean {
    const raw = appSessionStorage.getItem<string | boolean>(STORAGE_KEY, null);
    return raw === 'true' || raw === true;
  }

  public setBypassed(bypassed: boolean): boolean {
    return appSessionStorage.setItem(STORAGE_KEY, bypassed ? 'true' : 'false');
  }
}

export const desktopRestrictionRepository = new DesktopRestrictionRepository();
