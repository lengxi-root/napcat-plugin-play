// 消息处理工具函数
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message, OB11PostSendMsg } from 'napcat-types/napcat-onebot/types/index';
import type { MessageSegment, UserInfo } from '../types';
import { pluginState } from '../core/state';

// 发送文本回复
export async function sendReply (event: OB11Message, content: string, ctx: NapCatPluginContext): Promise<void> {
  if (!ctx.actions || !content) return;
  try {
    const params: OB11PostSendMsg = {
      message: content, message_type: event.message_type,
      ...(event.message_type === 'group' ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) }),
    };
    await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config).catch(() => {});
  } catch { /* 忽略发送错误 */ }
}

// 发送图片（base64）
export async function sendImageBase64 (event: OB11Message, base64: string, ctx: NapCatPluginContext): Promise<void> {
  if (!ctx.actions || !base64) return;
  try {
    const msg = [{ type: 'image', data: { file: `base64://${base64}` } }];
    const action = event.message_type === 'group' ? 'send_group_msg' : 'send_private_msg';
    const id = event.message_type === 'group' ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, message: msg } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => {});
  } catch { /* 忽略发送错误 */ }
}

// 提取@用户
export function extractAtUsers (message: unknown): UserInfo[] {
  if (!Array.isArray(message)) return [];
  return message.filter((s: MessageSegment) => s.type === 'at' && s.data?.qq && s.data.qq !== 'all')
    .map((s: MessageSegment) => ({ qq: s.data.qq, text: (s.data.text as string) || '' }));
}

// 提取图片URL
export function extractImageUrls (message: unknown): string[] {
  if (!Array.isArray(message)) return [];
  return message.filter((s: MessageSegment) => s.type === 'image' && s.data?.url).map((s: MessageSegment) => s.data.url!);
}

// 获取引用消息中的图片
export async function getReplyImages (event: OB11Message, ctx: NapCatPluginContext): Promise<string[]> {
  if (!ctx.actions) return [];
  const match = (event.raw_message || '').match(/\[CQ:reply,id=(-?\d+)\]/);
  if (!match) return [];
  const result = await ctx.actions.call('get_msg', { message_id: match[1] } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => null) as { message?: unknown; } | null;
  return result?.message ? extractImageUrls(result.message) : [];
}
