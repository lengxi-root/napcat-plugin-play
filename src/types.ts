// Play 娱乐插件类型定义
export interface PluginConfig {
  prefix: string; enableMeme: boolean; memeApiUrl: string; maxFileSize: number;
  enableMasterProtect: boolean; ownerQQs: string; debug: boolean;
  enableMusic: boolean; musicApiUrl: string;
  [key: string]: unknown;
}

// 音乐搜索结果
export interface MusicSearchResult {
  song: string; singer: string; url?: string;
}

// 音乐缓存项
export interface MusicCacheItem {
  type: string; songs: MusicSearchResult[]; keyword: string;
}

export interface MemeParamsType {
  min_images: number; max_images: number; min_texts: number; max_texts: number;
  default_texts: string[]; args_type?: MemeArgsType;
}

export interface MemeArgsType {
  args_model: { properties: Record<string, MemeArgProperty>; };
  parser_options?: MemeParserOption[];
}

export interface MemeArgProperty {
  type?: string; enum?: string[]; default?: unknown; description?: string;
  minimum?: number; maximum?: number;
}

export interface MemeParserOption {
  names: string[]; dest?: string; action?: { type: number; value?: string; };
  help_text?: string; args?: { name: string; }[];
}

export interface MemeInfo { key: string; keywords: string[]; params_type: MemeParamsType; }
export interface KeywordMap { [keyword: string]: string; }
export interface MemeInfoMap { [key: string]: MemeInfo; }
export interface UserInfo { qq?: string | number; text?: string; gender?: string; }
export interface MessageSegment { type: string; data: { qq?: string | number; url?: string; file?: string; text?: string;[key: string]: unknown; }; }
export interface GroupMemberInfo { user_id: string | number; nickname: string; card?: string; sex?: string; }
