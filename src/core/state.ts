// 插件全局状态管理
import type { ActionMap } from 'napcat-types/napcat-onebot/action/index';
import type { PluginLogger } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { NetworkAdapterConfig } from 'napcat-types/napcat-onebot/config/config';
import type { PluginConfig, KeywordMap, MemeInfoMap } from '../types';
import { DEFAULT_PLUGIN_CONFIG } from '../config';

class PluginState {
  logger: PluginLogger | null = null;
  actions: ActionMap | undefined;
  adapterName: string = '';
  networkConfig: NetworkAdapterConfig | null = null;
  config: PluginConfig = { ...DEFAULT_PLUGIN_CONFIG };
  dataPath: string = '';
  keyMap: KeywordMap = {};
  infos: MemeInfoMap = {};
  initialized: boolean = false;

  log (level: 'info' | 'warn' | 'error', msg: string, ...args: unknown[]): void {
    if (!this.logger) return;
    this.logger[level](`[Play] ${msg}`, ...args);
  }

  debug (msg: string, ...args: unknown[]): void {
    if (this.logger && this.config.debug) this.logger.info(`[Play] [DEBUG] ${msg}`, ...args);
  }

  getMasterQQs (): string[] {
    return this.config.ownerQQs ? this.config.ownerQQs.split(',').map(q => q.trim()).filter(q => q) : [];
  }

  isMaster (userId: string): boolean { return this.getMasterQQs().includes(userId); }
}

export const pluginState = new PluginState();
