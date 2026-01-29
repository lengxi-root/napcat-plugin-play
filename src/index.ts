// NapCat Play 娱乐插件 @author 冷曦 @version 1.1.0
import type { PluginModule, NapCatPluginContext, PluginConfigSchema, PluginConfigUIController } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message } from 'napcat-types/napcat-onebot/types/index';
import { EventType } from 'napcat-types/napcat-onebot/event/index';
import fs from 'fs';
import path, { dirname } from 'path';
import type { PluginConfig } from './types';
import { DEFAULT_PLUGIN_CONFIG } from './config';
import { pluginState } from './core/state';
import { handleMemeCommand } from './handlers/meme-handler';
import { initMemeData } from './services/meme-service';

export let plugin_config_ui: PluginConfigSchema = [];

// 插件初始化
const plugin_init: PluginModule['plugin_init'] = async (ctx: NapCatPluginContext) => {
  pluginState.logger = ctx.logger;
  pluginState.actions = ctx.actions;
  pluginState.adapterName = ctx.adapterName;
  pluginState.networkConfig = ctx.pluginManager.config;
  pluginState.log('info', 'Play 娱乐插件正在初始化...');

  plugin_config_ui = ctx.NapCatConfig.combine(
    ctx.NapCatConfig.html('<div style="padding:10px;background:linear-gradient(135deg,rgba(106,17,203,0.1),rgba(37,117,252,0.1));border-radius:8px"><h3>🎮 Play 娱乐插件</h3><p>表情包制作 | 指令：meme列表</p></div>'),
    ctx.NapCatConfig.boolean('enableMeme', '启用表情包', true, '启用meme表情包制作功能', true),
    ctx.NapCatConfig.text('memeApiUrl', 'API地址', 'http://datukuai.top:2233', 'meme API服务地址'),
    ctx.NapCatConfig.select('maxFileSize', '最大文件', [{ label: '5MB', value: 5 }, { label: '10MB', value: 10 }, { label: '20MB', value: 20 }], 10, '图片大小限制'),
    ctx.NapCatConfig.boolean('enableMasterProtect', '主人保护', true, '对主人使用攻击性meme时反向操作', true),
    ctx.NapCatConfig.text('ownerQQs', '主人QQ', '', '多个用逗号分隔'),
    ctx.NapCatConfig.boolean('forceSharp', '强制#触发', false, '强制使用#符号触发'),
    ctx.NapCatConfig.boolean('debug', '调试模式', false, '显示详细日志')
  );

  if (fs.existsSync(ctx.configPath)) {
    const saved = JSON.parse(fs.readFileSync(ctx.configPath, 'utf-8'));
    pluginState.config = { ...DEFAULT_PLUGIN_CONFIG, ...saved };
  }

  pluginState.dataPath = ctx.configPath ? dirname(ctx.configPath) : path.join(process.cwd(), 'data', 'napcat-plugin-play');
  if (pluginState.config.enableMeme) initMemeData().catch(() => { });
  pluginState.log('info', 'Play 娱乐插件初始化完成');
};

// 获取配置
export const plugin_get_config = async (): Promise<PluginConfig> => pluginState.config;

// 保存配置
export const plugin_set_config = async (ctx: NapCatPluginContext, config: PluginConfig): Promise<void> => {
  const old = { ...pluginState.config };
  pluginState.config = config;
  if (config.enableMeme && !old.enableMeme && !pluginState.initialized) initMemeData().catch(() => { });
  if (ctx?.configPath) {
    const dir = path.dirname(ctx.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
};

// 响应式配置控制器
const plugin_config_controller = (_ctx: NapCatPluginContext, ui: PluginConfigUIController, config: Record<string, unknown>): (() => void) | void => {
  const memeOn = config.enableMeme !== false;
  ['memeApiUrl', 'maxFileSize', 'enableMasterProtect', 'ownerQQs'].forEach(k => memeOn ? ui.showField(k) : ui.hideField(k));
  return () => { };
};

// 响应式配置变更
const plugin_on_config_change = (_ctx: NapCatPluginContext, ui: PluginConfigUIController, key: string, _value: unknown, config: Record<string, unknown>): void => {
  if (key === 'enableMeme') {
    const on = config.enableMeme !== false;
    ['memeApiUrl', 'maxFileSize', 'enableMasterProtect', 'ownerQQs'].forEach(k => on ? ui.showField(k) : ui.hideField(k));
  }
};

// 插件清理
const plugin_cleanup: PluginModule['plugin_cleanup'] = async () => pluginState.log('info', 'Play 娱乐插件已卸载');

// 消息处理
const plugin_onmessage: PluginModule['plugin_onmessage'] = async (ctx: NapCatPluginContext, event: OB11Message) => {
  if (event.post_type !== EventType.MESSAGE) return;
  if (pluginState.config.enableMeme) await handleMemeCommand(event, event.raw_message || '', ctx);
};

export { plugin_init, plugin_onmessage, plugin_cleanup, plugin_config_controller, plugin_on_config_change };
