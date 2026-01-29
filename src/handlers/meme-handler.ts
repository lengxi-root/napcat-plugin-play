// Meme 表情包处理器
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin-manger';
import type { OB11Message } from 'napcat-types/napcat-onebot/types/index';
import type { UserInfo, GroupMemberInfo } from '../types';
import { pluginState } from '../core/state';
import { sendReply, sendImageBase64, extractAtUsers, extractImageUrls, getReplyImages } from '../utils/message';
import { getAvatarUrl, trimStart, checkFileSize } from '../utils/common';
import { HELP_MESSAGE, MASTER_PROTECT_LIST } from '../config';
import { initMemeData, updateMemeData, findLongestMatchingKey, getMemeDetail, searchMemeKeywords, getRandomMemeKey, handleMemeArgs, getMemeListImageBase64, generateMeme, downloadImage } from '../services/meme-service';
import fs from 'fs';
import path from 'path';

// 处理meme命令
export async function handleMemeCommand (event: OB11Message, raw: string, ctx: NapCatPluginContext): Promise<boolean> {
  if (!pluginState.initialized) await initMemeData();
  const prefix = pluginState.config.prefix ?? '';
  const userId = String(event.user_id);

  // 先清理 @ 和 CQ 码，保留核心内容
  const cleaned = raw.replace(/\[CQ:at,qq=\d+\]/g, '').replace(/\[CQ:reply,id=-?\d+\]/g, '').trim();
  if (prefix && !cleaned.startsWith(prefix)) return false;
  const content = prefix ? cleaned.slice(prefix.length).trim() : cleaned;

  // 管理命令
  if (prefix && /^设置主人\s*\d+/.test(content)) { await handleAddMaster(event, content, userId, ctx); return true; }
  if (prefix && /^删除主人\s*\d+/.test(content)) { await handleRemoveMaster(event, content, userId, ctx); return true; }
  if (prefix && /^主人列表$/.test(content)) { await handleMasterList(event, ctx); return true; }

  // meme 命令
  if (/^(meme(s)?|表情包)列表$/.test(content)) { await handleMemeList(event, ctx); return true; }
  if (/^随机(meme(s)?|表情包)/.test(content)) { await handleRandomMeme(event, ctx); return true; }
  if (/^(meme(s)?|表情包)帮助/.test(content)) { await sendReply(event, HELP_MESSAGE, ctx); return true; }
  if (/^(meme(s)?|表情包)搜索/.test(content)) { await handleMemeSearch(event, content, ctx); return true; }
  if (/^(meme(s)?|表情包)更新/.test(content)) { await handleMemeUpdate(event, ctx); return true; }

  // 表情生成
  const target = findLongestMatchingKey(content);
  if (target) { await handleMemeGenerate(event, content, target, ctx); return true; }
  return false;
}

// 添加主人
async function handleAddMaster (event: OB11Message, msg: string, userId: string, ctx: NapCatPluginContext): Promise<void> {
  if (!pluginState.isMaster(userId)) { await sendReply(event, '只有主人才能设置', ctx); return; }
  const m = msg.match(/(\d+)/);
  if (!m) { await sendReply(event, '格式：设置主人+QQ', ctx); return; }
  const qq = m[1], list = pluginState.getMasterQQs();
  if (list.includes(qq)) { await sendReply(event, `${qq} 已是主人`, ctx); return; }
  list.push(qq);
  pluginState.config.ownerQQs = list.join(',');
  saveConfig(ctx);
  await sendReply(event, `已添加主人：${qq}`, ctx);
}

// 删除主人
async function handleRemoveMaster (event: OB11Message, msg: string, userId: string, ctx: NapCatPluginContext): Promise<void> {
  if (!pluginState.isMaster(userId)) { await sendReply(event, '只有主人才能删除', ctx); return; }
  const m = msg.match(/(\d+)/);
  if (!m) { await sendReply(event, '格式：删除主人+QQ', ctx); return; }
  const qq = m[1], list = pluginState.getMasterQQs();
  if (!list.includes(qq)) { await sendReply(event, `${qq} 不是主人`, ctx); return; }
  if (qq === userId && list.length === 1) { await sendReply(event, '不能删除唯一主人', ctx); return; }
  pluginState.config.ownerQQs = list.filter(q => q !== qq).join(',');
  saveConfig(ctx);
  await sendReply(event, `已删除主人：${qq}`, ctx);
}

// 主人列表
async function handleMasterList (event: OB11Message, ctx: NapCatPluginContext): Promise<void> {
  const list = pluginState.getMasterQQs();
  await sendReply(event, list.length ? `主人列表：\n${list.map((q, i) => `${i + 1}. ${q}`).join('\n')}` : '当前没有设置主人', ctx);
}

// 保存配置
function saveConfig (ctx: NapCatPluginContext): void {
  if (!ctx?.configPath) return;
  const dir = path.dirname(ctx.configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ctx.configPath, JSON.stringify(pluginState.config, null, 2), 'utf-8');
}

// meme列表
async function handleMemeList (event: OB11Message, ctx: NapCatPluginContext): Promise<void> {
  const img = getMemeListImageBase64();
  if (img) { await sendImageBase64(event, img, ctx); return; }
  const kws = Object.keys(pluginState.keyMap).slice(0, 30).map(k => `【${k}】`).join(' ');
  await sendReply(event, `【Meme列表】共 ${Object.keys(pluginState.keyMap).length} 个\n\n${kws} ...\n\n发送【meme搜索+词】搜索更多`, ctx);
}

// 随机meme
async function handleRandomMeme (event: OB11Message, ctx: NapCatPluginContext): Promise<void> {
  const kw = getRandomMemeKey();
  if (!kw) { await sendReply(event, '暂无可用随机meme', ctx); return; }
  await handleMemeGenerate(event, kw, kw, ctx);
}

// meme搜索
async function handleMemeSearch (event: OB11Message, msg: string, ctx: NapCatPluginContext): Promise<void> {
  const s = msg.replace(/^#?(meme(s)?|表情包)搜索/, '').trim();
  if (!s) { await sendReply(event, '请输入关键词', ctx); return; }
  const hits = searchMemeKeywords(s);
  const txt = hits.length ? hits.slice(0, 20).map((k, i) => `${i + 1}. ${k}`).join('\n') + (hits.length > 20 ? `\n...共${hits.length}个` : '') : '无结果';
  await sendReply(event, `搜索结果：\n${txt}`, ctx);
}

// meme更新
async function handleMemeUpdate (event: OB11Message, ctx: NapCatPluginContext): Promise<void> {
  await sendReply(event, '更新中...', ctx);
  await updateMemeData();
  await sendReply(event, '更新完成', ctx);
}

// 生成meme
async function handleMemeGenerate (event: OB11Message, msg: string, target: string, ctx: NapCatPluginContext): Promise<void> {
  try {
    const code = pluginState.keyMap[target], info = pluginState.infos[code];
    if (!info) { await sendReply(event, '未找到该表情', ctx); return; }

    let text1 = msg.replace(target, '');
    if (text1.trim() === '详情' || text1.trim() === '帮助') { await sendReply(event, getMemeDetail(code), ctx); return; }

    const [text, args = ''] = text1.split('#');
    const userId = String(event.user_id);
    const sender = event.sender as { nickname?: string; card?: string; sex?: string; } | undefined;

    // 收集图片
    let imgs: string[] = [...await getReplyImages(event, ctx).catch(() => []), ...extractImageUrls(event.message)];
    const atUsers = extractAtUsers(event.message);
    if (!imgs.length && atUsers.length) imgs = atUsers.map(a => getAvatarUrl(a.qq as string | number));
    if (!imgs.length && info.params_type.max_images > 0) imgs.push(getAvatarUrl(userId));
    if (imgs.length < info.params_type.min_images && !imgs.includes(getAvatarUrl(userId))) imgs = [getAvatarUrl(userId), ...imgs];

    // 主人保护
    imgs = applyMasterProtection(code, imgs, userId, atUsers);
    imgs = imgs.slice(0, info.params_type.max_images);

    // 处理文本
    let texts: string[] = [];
    if (text && info.params_type.max_texts === 0) return;
    if (!text && info.params_type.min_texts > 0) {
      texts.push(atUsers[0]?.text?.replace('@', '').trim() || sender?.card || sender?.nickname || '用户');
    } else if (text) {
      texts = text.split('/').slice(0, info.params_type.max_texts);
    }
    if (texts.length < info.params_type.min_texts) { await sendReply(event, `需要${info.params_type.min_texts}个文本，用/隔开`, ctx); return; }
    if (info.params_type.max_texts > 0 && !texts.length) texts.push(atUsers[0]?.text?.replace('@', '').trim() || sender?.card || sender?.nickname || '用户');

    // 用户信息
    let userInfos: UserInfo[] = atUsers;
    if (atUsers.length && event.group_id && ctx.actions) {
      const members = await ctx.actions.call('get_group_member_list', { group_id: String(event.group_id) } as never, ctx.adapterName, ctx.pluginManager.config).catch(() => []) as GroupMemberInfo[];
      userInfos = atUsers.map(a => {
        const m = members.find(m => String(m.user_id) === String(a.qq));
        return { qq: a.qq, text: m?.card || m?.nickname || a.text, gender: m?.sex || 'unknown' };
      });
    }
    if (!userInfos.length) userInfos = [{ text: sender?.card || sender?.nickname || '用户', gender: sender?.sex || 'unknown' }];

    // 下载图片并生成
    const buffers: Buffer[] = [];
    for (const url of imgs) { const b = await downloadImage(url).catch(() => null); if (b) buffers.push(b); }
    if (!buffers.length) { await sendReply(event, '图片下载失败', ctx); return; }
    if (checkFileSize(buffers.map(b => ({ size: b.length })), pluginState.config.maxFileSize)) {
      await sendReply(event, `文件超限，最大${pluginState.config.maxFileSize}MB`, ctx); return;
    }

    const result = await generateMeme(code, buffers, texts, handleMemeArgs(code, args, userInfos)).catch(() => '生成失败');
    if (typeof result === 'string') await sendReply(event, result, ctx);
    else await sendImageBase64(event, result.toString('base64'), ctx);
  } catch { await sendReply(event, '表情生成出错', ctx).catch(() => { }); }
}

// 主人保护
function applyMasterProtection (code: string, imgs: string[], senderId: string, atUsers: UserInfo[]): string[] {
  if (!pluginState.config.enableMasterProtect || !MASTER_PROTECT_LIST.includes(code)) return imgs;
  const masters = pluginState.getMasterQQs();
  if (!masters.length || masters.includes(senderId)) return imgs;

  const senderAva = getAvatarUrl(senderId);
  const atMaster = atUsers.find(a => masters.includes(String(a.qq)));

  if (atMaster) {
    if (imgs.length === 1) {
      const qq = imgs[0].match(/nk=(\d+)/)?.[1];
      if (qq && masters.includes(qq)) return [senderAva];
    } else if (imgs.length >= 2) {
      return [getAvatarUrl(atMaster.qq as string | number), senderAva, ...imgs.slice(2)];
    }
  } else {
    for (let i = 0; i < imgs.length; i++) {
      const qq = imgs[i].match(/nk=(\d+)/)?.[1];
      if (qq && masters.includes(qq)) {
        if (imgs.length === 1) return [senderAva];
        const newImgs = [...imgs];
        newImgs[0] = imgs[i];
        newImgs[1] = senderAva;
        return newImgs;
      }
    }
  }
  return imgs;
}
