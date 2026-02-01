// Play 娱乐插件配置
import type { PluginConfig } from './types';

// 默认配置
export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  prefix: '',
  enableMeme: true,
  memeApiUrl: 'http://datukuai.top:2233',
  maxFileSize: 10,
  enableMasterProtect: true,
  ownerQQs: '',
  debug: false,
  enableMusic: true,
  musicApiUrl: 'https://a.aa.cab',
  enableDraw: true,
  drawApiUrl: 'https://i.elaina.vin/api/openai',
};

// 数据目录配置
export const DATA_DIR_NAME = 'memes';
export const CACHE_FILES = {
  keyMap: 'keyMap.json',
  infos: 'infos.json',
  renderList: 'render_list.jpg',
};

// 帮助消息
export const HELP_MESSAGE = `【meme列表】查看表情列表
【表情名@人】制作表情（需前缀）
【meme搜索+词】搜索表情
【表情名+详情】查看用法
【设置/删除主人+QQ】管理主人
【点歌+歌名】搜索并点歌
【听+序号】播放搜索到的歌曲
【画+描述】AI绘画
提示：仅表情生成需要前缀`;
