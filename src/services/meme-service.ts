// Meme 表情包服务
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { KeywordMap, MemeInfoMap, MemeInfo, UserInfo } from '../types';
import { pluginState } from '../core/state';
import { mkdirs, deleteFile, trimChar } from '../utils/common';
import { DATA_DIR_NAME, CACHE_FILES } from '../config';
import MEME_DATA from '../data/bq.json';

let memeListImageCache: string | null = null;
const getDataDir = () => path.join(pluginState.dataPath, DATA_DIR_NAME);

// 初始化meme数据
export async function initMemeData (): Promise<void> {
  mkdirs(getDataDir());
  loadBuiltinMemeData();
  pluginState.initialized = true;
  pluginState.log('info', `Meme数据加载完成，共 ${Object.keys(pluginState.keyMap).length} 个关键词`);
}

// 加载内置数据
function loadBuiltinMemeData (): void {
  const keyMap: KeywordMap = {}, infos: MemeInfoMap = {};
  for (const [key, data] of Object.entries(MEME_DATA as Record<string, MemeInfo>)) {
    infos[key] = data;
    data.keywords?.forEach(k => keyMap[k] = key);
  }
  pluginState.infos = infos;
  pluginState.keyMap = keyMap;
}

// 更新数据
export async function updateMemeData (): Promise<void> {
  deleteFile(path.join(getDataDir(), CACHE_FILES.renderList));
  loadBuiltinMemeData();
  pluginState.log('info', 'Meme数据已重新加载');
}

// 查找最长匹配关键词
export function findLongestMatchingKey (msg: string): string | null {
  const keys = Object.keys(pluginState.keyMap).filter(k => msg.startsWith(k));
  return keys.length ? keys.sort((a, b) => b.length - a.length)[0] : null;
}

// 获取详情
export function getMemeDetail (code: string): string {
  const d = pluginState.infos[code];
  if (!d) return '未找到该表情信息';
  let ins = `【代码】${d.key}\n【名称】${d.keywords.join('、')}\n【图片】${d.params_type.min_images}-${d.params_type.max_images}\n【文本】${d.params_type.min_texts}-${d.params_type.max_texts}`;
  if (d.params_type.args_type?.parser_options?.length) ins += `\n【参数】支持额外参数`;
  return ins;
}

// 搜索关键词
export function searchMemeKeywords (kw: string): string[] {
  return Object.keys(pluginState.keyMap).filter(k => k.includes(kw));
}

// 获取随机meme
export function getRandomMemeKey (): string | null {
  const keys = Object.keys(pluginState.infos).filter(k => {
    const i = pluginState.infos[k];
    return i.params_type.min_images === 1 && i.params_type.min_texts === 0;
  });
  return keys.length ? pluginState.infos[keys[Math.floor(Math.random() * keys.length)]].keywords[0] : null;
}

// 处理参数
export function handleMemeArgs (key: string, args: string, userInfos: UserInfo[]): string {
  const obj: Record<string, unknown> = {};
  const info = pluginState.infos[key];
  if (info?.params_type?.args_type) {
    const { args_model, parser_options = [] } = info.params_type.args_type;
    for (const prop in args_model.properties) {
      if (prop === 'user_infos') continue;
      const pi = args_model.properties[prop];
      if (pi.enum) {
        const map: Record<string, string> = {};
        parser_options.filter(o => o.dest === prop && o.action?.type === 0 && o.action.value)
          .forEach(o => o.names.forEach(n => map[n.replace(/^--/, '')] = o.action!.value!));
        obj[prop] = map[args.trim()] || pi.default;
      } else if (pi.type === 'integer' || pi.type === 'number') {
        if (/^\d+$/.test(args.trim())) obj[prop] = parseInt(args.trim());
      }
    }
  }
  obj.user_infos = userInfos.map(u => ({ name: trimChar(u.text || '', '@'), gender: u.gender || 'unknown' }));
  return JSON.stringify(obj);
}

// 获取列表图片base64
export function getMemeListImageBase64 (): string | null {
  if (memeListImageCache) return memeListImageCache;
  const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const paths = [path.join(dir, 'meme-list.png'), path.join(process.cwd(), 'plugins', 'napcat-plugin-play', 'meme-list.png')];
  for (const p of paths) {
    if (fs.existsSync(p)) { memeListImageCache = fs.readFileSync(p).toString('base64'); return memeListImageCache; }
  }
  return null;
}

// 生成meme
export async function generateMeme (code: string, images: Buffer[], texts: string[], args?: string): Promise<Buffer | string> {
  const form = new FormData();
  images.forEach((b, i) => form.append('images', new Blob([b], { type: 'image/jpeg' }), `img${i}.jpg`));
  texts.forEach(t => form.append('texts', t));
  if (args) form.set('args', args);
  const res = await fetch(`${pluginState.config.memeApiUrl}/memes/${code}/`, { method: 'POST', body: form }).catch(() => null);
  if (!res || !res.ok) return res ? await res.text() : '请求失败';
  return Buffer.from(await (await res.blob()).arrayBuffer());
}

// 下载图片
export async function downloadImage (url: string): Promise<Buffer | null> {
  const res = await fetch(url).catch(() => null);
  return res?.ok ? Buffer.from(await (await res.blob()).arrayBuffer()) : null;
}
