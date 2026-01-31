// 点歌功能处理器
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message } from 'napcat-types/napcat-onebot/types/index';
import type { MusicSearchResult, MusicCacheItem } from '../types';
import { pluginState } from '../core/state';
import { sendReply, sendForwardMsg } from '../utils/message';

// LRU缓存实现
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private capacity: number;

  constructor (capacity = 100) {
    this.capacity = capacity;
  }

  get (key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put (key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
  }

  has (key: K): boolean {
    return this.cache.has(key);
  }
}

// 音乐搜索缓存
const musicCache = new LRUCache<string, MusicCacheItem>(100);

// 处理点歌命令（无需前缀）
export async function handleMusicCommand (event: OB11Message, raw: string, ctx: NapCatPluginContext): Promise<boolean> {
  if (!pluginState.config.enableMusic) return false;
  const content = raw.replace(/\[CQ:[^\]]+\]/g, '').trim();
  const userId = String(event.user_id);

  // 点歌搜索
  const searchMatch = content.match(/^点歌\s*(.*)$/);
  if (searchMatch) {
    await searchMusic(event, searchMatch[1].trim(), ctx);
    return true;
  }

  // 听歌
  const playMatch = content.match(/^听(\d+)$/);
  if (playMatch) {
    await playMusic(event, parseInt(playMatch[1]), userId, ctx);
    return true;
  }

  return false;
}

// 搜索音乐
async function searchMusic (event: OB11Message, keyword: string, ctx: NapCatPluginContext): Promise<void> {
  const userId = String(event.user_id);

  if (!keyword) {
    await sendReply(event, '请输入要搜索的歌曲名，如：点歌 晴天', ctx);
    return;
  }

  try {
    const encoded = encodeURIComponent(keyword);
    const apiUrl = pluginState.config.musicApiUrl || 'https://a.aa.cab';
    const res = await fetch(`${apiUrl}/qq.music?msg=${encoded}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);

    if (!res || !res.ok) {
      await sendReply(event, '网络请求超时，请稍后重试', ctx);
      return;
    }

    const data = await res.json().catch(() => null) as { data?: MusicSearchResult[] } | null;
    if (!data || !data.data || !data.data.length) {
      await sendReply(event, '未找到相关歌曲，请尝试其他关键词', ctx);
      return;
    }

    const songs = data.data.slice(0, 10);
    // 缓存搜索结果
    musicCache.put(userId, { type: 'qq', songs, keyword });

    // 构建合并消息展示歌曲列表
    const msgList: string[] = [];
    msgList.push(`🎵 点歌结果：${keyword}\n发送"听+序号"播放，如：听1`);
    songs.forEach((song, idx) => {
      const name = cleanText(song.song || '未知歌名');
      const singer = cleanText(song.singer || '未知歌手');
      msgList.push(`${idx + 1}. ${name} - ${singer}`);
    });
    msgList.push('💡 提示：发送"听1"到"听10"播放对应歌曲');

    await sendForwardMsg(event, msgList, ctx);
  } catch {
    await sendReply(event, '搜索音乐时发生错误，请稍后重试', ctx);
  }
}

// 播放音乐
async function playMusic (event: OB11Message, idx: number, userId: string, ctx: NapCatPluginContext): Promise<void> {
  const cached = musicCache.get(userId);
  if (!cached || !cached.songs?.length) {
    await sendReply(event, '请先使用"点歌+歌名"搜索歌曲', ctx);
    return;
  }

  if (idx < 1 || idx > cached.songs.length) {
    await sendReply(event, `请输入1-${cached.songs.length}之间的序号`, ctx);
    return;
  }

  try {
    const encoded = encodeURIComponent(cached.keyword);
    const apiUrl = pluginState.config.musicApiUrl || 'https://a.aa.cab';
    const res = await fetch(`${apiUrl}/qq.music?msg=${encoded}&n=${idx}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);

    if (!res || !res.ok) {
      await sendReply(event, '网络请求超时，请稍后重试', ctx);
      return;
    }

    const data = await res.json().catch(() => null) as { data?: { music?: string } } | null;
    if (!data?.data?.music) {
      await sendReply(event, '未获取到歌曲链接，请换一首歌尝试', ctx);
      return;
    }

    // 发送语音消息
    await sendVoice(event, data.data.music, ctx);
  } catch {
    await sendReply(event, '播放歌曲时出错，请稍后重试', ctx);
  }
}

// 发送语音消息
async function sendVoice (event: OB11Message, url: string, ctx: NapCatPluginContext): Promise<void> {
  if (!ctx.actions) return;
  try {
    const msg = [{ type: 'record', data: { file: url } }];
    const action = event.message_type === 'group' ? 'send_group_msg' : 'send_private_msg';
    const id = event.message_type === 'group' ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, message: msg } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => { });
  } catch { /* 忽略错误 */ }
}

// 清理文本中的特殊字符
function cleanText (s: string): string {
  return s.replace(/[<>"'&*_~`\[\](){}\\\/]/g, '').trim();
}
