// 娱乐菜单处理器
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message } from 'napcat-types/napcat-onebot/types/index';
import { pluginState } from '../core/state';
import { sendForwardMsg } from '../utils/message';

// 处理菜单命令
export async function handleMenuCommand (event: OB11Message, raw: string, ctx: NapCatPluginContext): Promise<boolean> {
  const prefix = pluginState.config.prefix ?? '';
  const cleaned = raw.replace(/\[CQ:[^\]]+\]/g, '').trim();
  if (prefix && !cleaned.startsWith(prefix)) return false;
  const content = prefix ? cleaned.slice(prefix.length).trim() : cleaned;

  // 匹配菜单命令
  if (/^(娱乐|play|功能)(菜单|帮助|menu|help)?$/.test(content)) {
    await showMenu(event, ctx);
    return true;
  }
  return false;
}

// 显示整合菜单
async function showMenu (event: OB11Message, ctx: NapCatPluginContext): Promise<void> {
  const msgList: string[] = [];

  // 标题
  msgList.push('🎮 Play 娱乐插件菜单');

  // 表情包功能
  if (pluginState.config.enableMeme) {
    msgList.push(`📸 表情包功能
• meme列表 - 查看表情列表
• 表情名 - 制作表情（可@人或引用图片）
• 表情名+详情 - 查看表情用法
• meme搜索+关键词 - 搜索表情
• 随机meme - 随机生成表情
• meme更新 - 更新表情数据`);
  }

  // 点歌功能
  if (pluginState.config.enableMusic) {
    msgList.push(`🎵 点歌功能
• 点歌+歌名 - 搜索歌曲
• 听+序号 - 播放搜索到的歌曲
示例：点歌 晴天 → 听1`);
  }

  // 管理功能
  msgList.push(`⚙️ 管理功能
• 设置主人+QQ - 添加主人
• 删除主人+QQ - 移除主人
• 主人列表 - 查看主人列表`);

  // 提示
  const prefix = pluginState.config.prefix;
  if (prefix) {
    msgList.push(`💡 提示：所有指令需加前缀「${prefix}」`);
  } else {
    msgList.push('💡 提示：直接发送指令即可触发');
  }

  await sendForwardMsg(event, msgList, ctx);
}
