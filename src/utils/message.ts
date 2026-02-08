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

// 发送媒体消息（统一图片/语音发送逻辑）
async function sendMedia (event: OB11Message, type: string, file: string, ctx: NapCatPluginContext): Promise<void> {
  if (!ctx.actions || !file) return;
  try {
    const msg = [{ type, data: { file } }];
    const action = event.message_type === 'group' ? 'send_group_msg' : 'send_private_msg';
    const id = event.message_type === 'group' ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, message: msg } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => {});
  } catch { /* 忽略发送错误 */ }
}

// 发送图片（支持 URL 或 base64://）
export const sendImage = (event: OB11Message, file: string, ctx: NapCatPluginContext) => sendMedia(event, 'image', file, ctx);

// 发送图片（base64）
export const sendImageBase64 = (event: OB11Message, base64: string, ctx: NapCatPluginContext) => sendMedia(event, 'image', `base64://${base64}`, ctx);

// 发送语音
export const sendRecord = (event: OB11Message, file: string, ctx: NapCatPluginContext) => sendMedia(event, 'record', file, ctx);

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

// 发送合并转发消息
export async function sendForwardMsg (event: OB11Message, messages: string[], ctx: NapCatPluginContext): Promise<void> {
  if (!ctx.actions || !messages.length) return;
  try {
    // 构建合并转发节点
    const nodes = messages.map(content => ({
      type: 'node',
      data: { name: 'Play助手', uin: String(event.self_id || '10000'), content: [{ type: 'text', data: { text: content } }] }
    }));
    const action = event.message_type === 'group' ? 'send_group_forward_msg' : 'send_private_forward_msg';
    const id = event.message_type === 'group' ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, messages: nodes } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => { });
  } catch { /* 忽略发送错误 */ }
}
