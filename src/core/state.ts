// 插件全局状态管理
import type { ActionMap } from 'napcat-types/napcat-onebot/action/index';
import type { PluginLogger } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { NetworkAdapterConfig } from 'napcat-types/napcat-onebot/config/config';
import type { PluginConfig, KeywordMap, MemeInfoMap } from '../types';
import { DEFAULT_PLUGIN_CONFIG } from '../config';

class PluginState {
  logger: PluginLogger | null = null;
  actions: ActionMap | undefined;
  adapterName = '';
  networkConfig: NetworkAdapterConfig | null = null;
  config: PluginConfig = { ...DEFAULT_PLUGIN_CONFIG };
  dataPath = '';
  keyMap: KeywordMap = {};
  infos: MemeInfoMap = {};
  initialized = false;

  // 日志
  log(level: 'info' | 'warn' | 'error', msg: string, ...args: unknown[]): void {
    this.logger?.[level](`[Play] ${msg}`, ...args);
  }

  debug(msg: string, ...args: unknown[]): void {
    if (this.config.debug) this.logger?.info(`[Play] [DEBUG] ${msg}`, ...args);
  }

  // 主人管理
  getMasterQQs(): string[] {
    return this.config.ownerQQs?.split(',').map(q => q.trim()).filter(Boolean) || [];
  }

  isMaster(userId: string): boolean {
    return this.getMasterQQs().includes(userId);
  }
}

export const pluginState = new PluginState();
