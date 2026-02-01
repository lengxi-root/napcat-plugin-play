// AI 绘画处理器
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message } from 'napcat-types/napcat-onebot/types/index';
import { pluginState } from '../core/state';
import { sendReply, sendImage, extractImageUrls, getReplyImages, extractAtUsers } from '../utils/message';

const DRAW_MODEL = 'gemini-3-pro-image';

// 提示语缓存
let promptsCache: Record<string, string> = {};
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时

function getAvatarUrl(qq: string | number): string {
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`;
}

// 获取预设提示词列表
export function getPresetNames(): string[] {
  return Object.keys(promptsCache);
}

// 刷新提示语缓存
export async function refreshPromptsCache(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && Object.keys(promptsCache).length > 0) return;

  try {
    const apiUrl = pluginState.config.drawApiUrl;
    if (!apiUrl) return;

    const res = await fetch(`${apiUrl}/image`, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json() as { prompts?: Record<string, string> };
      if (data.prompts) {
        promptsCache = data.prompts;
        lastFetchTime = now;
        pluginState.debug(`[Draw] 提示语缓存已刷新，共 ${Object.keys(promptsCache).length} 个`);
      }
    }
  } catch (e) {
    pluginState.debug(`[Draw] 刷新提示语失败: ${e}`);
  }
}

// 处理绘画命令
export async function handleDrawCommand(event: OB11Message, raw: string, ctx: NapCatPluginContext): Promise<boolean> {
  const text = raw.replace(/\[CQ:[^\]]+\]/g, '').trim();

  // 刷新提示语缓存
  await refreshPromptsCache();

  // 匹配预设提示词查询指令
  if (/^(预设提示词|提示词列表|画图预设)$/.test(text)) {
    const presets = Object.keys(promptsCache);
    if (presets.length === 0) {
      await sendReply(event, '暂无预设提示词', ctx);
    } else {
      const list = presets.map((k, i) => `${i + 1}. ${k}`).join('\n');
      await sendReply(event, `🎨 预设提示词列表：\n${list}\n\n使用方式：\n• ${presets[0]}@某人\n• ${presets[0]}+QQ号\n• 引用图片+${presets[0]}`, ctx);
    }
    return true;
  }

  // 检查是否直接使用预设名（如"手办化@某人"）
  const presetNames = Object.keys(promptsCache);
  for (const presetName of presetNames) {
    // 匹配：预设名 + (@某人 或 QQ号 或 图片)
    const presetMatch = text.match(new RegExp(`^${presetName}\\s*(.*)$`, 'i'));
    if (presetMatch) {
      const extra = presetMatch[1].trim();
      return await handlePresetDraw(event, presetName, promptsCache[presetName], extra, ctx);
    }
  }

  // 匹配绘画命令：画/绘/draw + 提示词
  const match = text.match(/^(?:画|绘|draw)\s*(.+)$/i);
  if (!match) return false;

  let prompt = match[1].trim().replace(/\[CQ:at,[^\]]+\]/g, '').trim();
  if (!prompt) {
    const presetsHint = presetNames.length ? `\n预设: ${presetNames.join('、')}` : '';
    await sendReply(event, `请输入绘画描述，例如：画一只可爱的猫咪\n支持引用图片、附带图片或@某人使用头像${presetsHint}`, ctx);
    return true;
  }

  const apiUrl = pluginState.config.drawApiUrl;
  if (!apiUrl) {
    await sendReply(event, '绘画功能未配置 API 地址', ctx);
    return true;
  }

  // 检查是否使用预设提示语
  const presetPrompt = promptsCache[prompt];
  if (presetPrompt) {
    pluginState.debug(`[Draw] 使用预设提示语: ${prompt}`);
    prompt = presetPrompt;
  }

  // 获取图片
  let imageUrls = await getReplyImages(event, ctx);
  if (!imageUrls.length) imageUrls = extractImageUrls(event.message);
  if (!imageUrls.length) {
    const atUsers = extractAtUsers(event.message);
    if (atUsers.length > 0 && atUsers[0].qq) imageUrls = [getAvatarUrl(atUsers[0].qq)];
  }

  return await executeDrawRequest(event, prompt, imageUrls, ctx);
}

// 处理预设绘画
async function handlePresetDraw(
  event: OB11Message,
  presetName: string,
  prompt: string,
  extra: string,
  ctx: NapCatPluginContext
): Promise<boolean> {
  const apiUrl = pluginState.config.drawApiUrl;
  if (!apiUrl) {
    await sendReply(event, '绘画功能未配置 API 地址', ctx);
    return true;
  }

  let imageUrls: string[] = [];

  // 优先引用消息中的图片
  imageUrls = await getReplyImages(event, ctx);

  // 其次当前消息的图片
  if (!imageUrls.length) imageUrls = extractImageUrls(event.message);

  // 检查 extra 是否是 QQ 号
  if (!imageUrls.length) {
    const qqMatch = extra.match(/(\d{5,11})/);
    if (qqMatch) {
      imageUrls = [getAvatarUrl(qqMatch[1])];
    }
  }

  // 检查是否 @ 了某人
  if (!imageUrls.length) {
    const atUsers = extractAtUsers(event.message);
    if (atUsers.length > 0 && atUsers[0].qq) {
      imageUrls = [getAvatarUrl(atUsers[0].qq)];
    }
  }

  // 如果还没有图片，使用发送者头像
  if (!imageUrls.length) {
    imageUrls = [getAvatarUrl(event.user_id)];
  }

  pluginState.debug(`[Draw] 预设: ${presetName}, 图片: ${imageUrls[0]}`);
  return await executeDrawRequest(event, prompt, imageUrls, ctx);
}

// 获取请求附加信息
async function getRequestMeta(event: OB11Message, ctx: NapCatPluginContext): Promise<{ bot_id?: string; owner_ids?: string[]; user_id: string }> {
  const userId = String(event.user_id);
  const ownerQQs = pluginState.config.ownerQQs;
  const ownerIds = ownerQQs ? ownerQQs.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean) : [];
  let botId: string | undefined;
  try {
    const loginInfo = await ctx.actions?.call('get_login_info', {}, ctx.adapterName, ctx.pluginManager.config) as { user_id?: number | string } | undefined;
    botId = loginInfo?.user_id ? String(loginInfo.user_id) : undefined;
  } catch { /* ignore */ }
  return { bot_id: botId, owner_ids: ownerIds.length ? ownerIds : undefined, user_id: userId };
}

// 执行绘画请求
async function executeDrawRequest(
  event: OB11Message,
  prompt: string,
  imageUrls: string[],
  ctx: NapCatPluginContext
): Promise<boolean> {
  const apiUrl = pluginState.config.drawApiUrl;
  const hasImage = imageUrls.length > 0;

  await sendReply(event, hasImage ? '🎨 正在修改图片，请稍候...' : '🎨 正在绘制中，请稍候...', ctx);

  try {
    const messages = hasImage
      ? [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageUrls[0] } }] }]
      : [{ role: 'user', content: prompt }];

    // 获取请求附加信息
    const meta = await getRequestMeta(event, ctx);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let response: Response;
    try {
      response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: DRAW_MODEL, messages, stream: false, temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, type: 3,
          ...meta,  // 添加 bot_id, owner_ids, user_id
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 500 && hasImage) {
        await sendReply(event, '❌ 图片格式不支持，请使用 PNG/JPG/WEBP 格式（不支持 GIF 动图）', ctx);
      } else {
        await sendReply(event, `${hasImage ? '图片修改' : '绘画'}失败: ${response.status}`, ctx);
      }
      return true;
    }

    const result = await response.json() as {
      choices?: { message?: { content?: string | { type: string; image_url?: { url: string } }[] }; finish_reason?: string }[];
      error?: { message?: string };
    };

    if (result.error) {
      await sendReply(event, `${hasImage ? '图片修改' : '绘画'}失败: ${result.error.message || '未知错误'}`, ctx);
      return true;
    }

    if (result.choices?.[0]?.finish_reason === 'content_filter') {
      await sendReply(event, '⚠️ 内容被安全过滤，请修改描述后重试', ctx);
      return true;
    }

    const content = result.choices?.[0]?.message?.content;
    let imageUrl: string | null = null;

    if (Array.isArray(content)) {
      const imgPart = content.find(c => c.type === 'image_url' || c.type === 'image');
      if (imgPart?.image_url?.url) imageUrl = imgPart.image_url.url;
    } else if (typeof content === 'string') {
      const mdB64Match = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/);
      if (mdB64Match) imageUrl = `base64://${mdB64Match[1].split(',')[1]}`;
      if (!imageUrl) {
        const b64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
        if (b64Match) imageUrl = `base64://${b64Match[1]}`;
      }
      if (!imageUrl) {
        const urlMatch = content.match(/https?:\/\/[^\s"'<>)]+\.(png|jpg|jpeg|gif|webp)/i);
        if (urlMatch) imageUrl = urlMatch[0];
      }
    }

    if (imageUrl) {
      await sendImage(event, imageUrl, ctx);
    } else {
      const errText = typeof content === 'string' && content ? content.slice(0, 500) : 'API 返回内容为空';
      await sendReply(event, `${hasImage ? '图片修改' : '绘画'}失败: ${errText}`, ctx);
    }

    return true;
  } catch (error) {
    const errMsg = error instanceof Error && error.name === 'AbortError' ? '绘画超时，请稍后重试' : `绘画失败: ${String(error)}`;
    await sendReply(event, errMsg, ctx);
    return true;
  }
}
