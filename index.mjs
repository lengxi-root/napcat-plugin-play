import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_PLUGIN_CONFIG = {
  prefix: "",
  enableMeme: true,
  memeApiUrl: "http://datukuai.top:2233",
  maxFileSize: 10,
  enableMasterProtect: true,
  ownerQQs: "",
  debug: false,
  enableMusic: true,
  musicApiUrl: "https://a.aa.cab",
  enableDraw: true,
  drawApiUrl: "https://i.elaina.vin/api/openai"
};
const MASTER_PROTECT_LIST = [
  "lash",
  "do",
  "beat_up",
  "little_do",
  "punch",
  "kick",
  "slap",
  "throw",
  "hit",
  "hammer",
  "bite",
  "eat",
  "swallow",
  "jue",
  "rip",
  "tear",
  "scratch",
  "pinch",
  "diss",
  "mock",
  "laugh_at",
  "point",
  "blame",
  "trash",
  "garbage",
  "flush",
  "bury",
  "burn"
];
const DATA_DIR_NAME = "memes";
const CACHE_FILES = {
  renderList: "render_list.jpg"
};
const HELP_MESSAGE = `【meme列表】查看表情列表
【表情名@人】制作表情（需前缀）
【meme搜索+词】搜索表情
【表情名+详情】查看用法
【设置/删除主人+QQ】管理主人
【点歌+歌名】搜索并点歌
【听+序号】播放搜索到的歌曲
【画+描述】AI绘画
提示：仅表情生成需要前缀`;

class PluginState {
  logger = null;
  actions;
  adapterName = "";
  networkConfig = null;
  config = { ...DEFAULT_PLUGIN_CONFIG };
  dataPath = "";
  keyMap = {};
  infos = {};
  initialized = false;
  // 日志
  log(level, msg, ...args) {
    this.logger?.[level](`[Play] ${msg}`, ...args);
  }
  debug(msg, ...args) {
    if (this.config.debug) this.logger?.info(`[Play] [DEBUG] ${msg}`, ...args);
  }
  // 主人管理
  getMasterQQs() {
    return this.config.ownerQQs?.split(",").map((q) => q.trim()).filter(Boolean) || [];
  }
  isMaster(userId) {
    return this.getMasterQQs().includes(userId);
  }
}
const pluginState = new PluginState();

async function sendReply(event, content, ctx) {
  if (!ctx.actions || !content) return;
  try {
    const params = {
      message: content,
      message_type: event.message_type,
      ...event.message_type === "group" ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) }
    };
    await ctx.actions.call("send_msg", params, ctx.adapterName, ctx.pluginManager.config).catch(() => {
    });
  } catch {
  }
}
async function sendImage(event, file, ctx) {
  if (!ctx.actions || !file) return;
  try {
    const msg = [{ type: "image", data: { file } }];
    const action = event.message_type === "group" ? "send_group_msg" : "send_private_msg";
    const id = event.message_type === "group" ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, message: msg }, ctx.adapterName, ctx.pluginManager.config).catch(() => {
    });
  } catch {
  }
}
async function sendImageBase64(event, base64, ctx) {
  await sendImage(event, `base64://${base64}`, ctx);
}
function extractAtUsers(message) {
  if (!Array.isArray(message)) return [];
  return message.filter((s) => s.type === "at" && s.data?.qq && s.data.qq !== "all").map((s) => ({ qq: s.data.qq, text: s.data.text || "" }));
}
function extractImageUrls(message) {
  if (!Array.isArray(message)) return [];
  return message.filter((s) => s.type === "image" && s.data?.url).map((s) => s.data.url);
}
async function getReplyImages(event, ctx) {
  if (!ctx.actions) return [];
  const match = (event.raw_message || "").match(/\[CQ:reply,id=(-?\d+)\]/);
  if (!match) return [];
  const result = await ctx.actions.call("get_msg", { message_id: match[1] }, ctx.adapterName, ctx.pluginManager.config).catch(() => null);
  return result?.message ? extractImageUrls(result.message) : [];
}
async function sendForwardMsg(event, messages, ctx) {
  if (!ctx.actions || !messages.length) return;
  try {
    const nodes = messages.map((content) => ({
      type: "node",
      data: { name: "Play助手", uin: String(event.self_id || "10000"), content: [{ type: "text", data: { text: content } }] }
    }));
    const action = event.message_type === "group" ? "send_group_forward_msg" : "send_private_forward_msg";
    const id = event.message_type === "group" ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, messages: nodes }, ctx.adapterName, ctx.pluginManager.config).catch(() => {
    });
  } catch {
  }
}

function mkdirs(dir) {
  if (fs.existsSync(dir)) return true;
  if (mkdirs(path.dirname(dir))) {
    fs.mkdirSync(dir);
    return true;
  }
  return false;
}
function deleteFile(p) {
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}
function checkFileSize(files, maxMB) {
  const max = maxMB * 1024 * 1024;
  return files.some((f) => (f.size ?? 0) >= max);
}
function trimChar(str, char) {
  return str.replace(new RegExp(`^[${char}]+|[${char}]+$`, "g"), "");
}
function getAvatarUrl$1(userId, size = 160) {
  return `https://q1.qlogo.cn/g?b=qq&s=${size}&nk=${userId}`;
}

const a_jj_play_baseball = {"key":"a_jj_play_baseball","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打棒球"],"shortcuts":[],"tags":[],"date_created":"2025-05-15T00:00:00","date_modified":"2025-05-15T00:00:00"};
const abstinence = {"key":"abstinence","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"time":{"default":"","description":"指定时间","title":"Time","type":"string"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-t","--time"],"args":[{"name":"time","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定时间","compact":false},{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["戒导"],"shortcuts":[],"tags":[],"date_created":"2024-12-13T00:00:00","date_modified":"2024-12-14T00:00:00"};
const acacia_anan_holdsign = {"key":"acacia_anan_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["宝宝求你去看看医生吧\n吾辈没法同时做你的\n心理医生、妈妈\n最好的朋友、性玩具\n最坏的敌人和人生导师"],"args_type":null},"keywords":["安安举牌","夏目安安举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-27T00:00:00","date_modified":"2025-10-28T00:00:00"};
const accelerate = {"key":"accelerate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["加速"],"shortcuts":[],"tags":[],"date_created":"2024-08-21T00:00:00","date_modified":"2024-08-21T00:00:00"};
const ace_attorney_dialog = {"key":"ace_attorney_dialog","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["表情包制作"],"args_type":null},"keywords":["逆转裁判气泡"],"shortcuts":[],"tags":[],"date_created":"2024-05-03T00:00:00","date_modified":"2024-05-03T00:00:00"};
const acg_entrance = {"key":"acg_entrance","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["走，跟我去二次元吧"],"args_type":null},"keywords":["二次元入口"],"shortcuts":[],"tags":[],"date_created":"2023-03-30T00:00:00","date_modified":"2023-03-30T00:00:00"};
const add_chaos = {"key":"add_chaos","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["添乱","给社会添乱"],"shortcuts":[],"tags":[],"date_created":"2023-06-21T00:00:00","date_modified":"2023-06-21T00:00:00"};
const addiction = {"key":"addiction","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["上瘾","毒瘾发作"],"shortcuts":[],"tags":[],"date_created":"2022-08-17T00:00:00","date_modified":"2023-02-14T00:00:00"};
const admission_letter = {"key":"admission_letter","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["Anyliew"],"args_type":null},"keywords":["录取通知书"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-25T00:00:00","date_modified":"2025-08-25T00:00:00"};
const adoption = {"key":"adoption","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["收养"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const ai_ace = {"key":"ai_ace","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["AI高手","ai高手"],"shortcuts":[],"tags":[],"date_created":"2025-07-11T00:00:00","date_modified":"2025-07-11T00:00:00"};
const aichuai = {"key":"aichuai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["挨踹"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const aima_say = {"key":"aima_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["何意味？"],"args_type":null},"keywords":["艾玛说","樱羽艾玛说"],"shortcuts":[],"tags":[],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const alike = {"key":"alike","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["一样"],"shortcuts":[],"tags":[],"date_created":"2022-01-02T00:00:00","date_modified":"2023-02-22T00:00:00"};
const alipay = {"key":"alipay","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"message":{"default":"","description":"二维码内容","title":"Message","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-m","--message"],"args":[{"name":"message","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"二维码内容","compact":false}]}},"keywords":["支付宝支付"],"shortcuts":[],"tags":[],"date_created":"2024-10-30T00:00:00","date_modified":"2024-10-30T00:00:00"};
const all_the_days = {"key":"all_the_days","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["一生一世"],"shortcuts":[],"tags":[],"date_created":"2025-03-14T00:00:00","date_modified":"2025-03-14T00:00:00"};
const allegiance = {"key":"allegiance","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["충성","忠橙","敬礼"],"shortcuts":[],"tags":[],"date_created":"2025-08-16T00:00:00","date_modified":"2025-08-16T00:00:00"};
const always = {"key":"always","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"mode":{"default":"normal","description":"生成模式，包含 normal、loop、circle","enum":["normal","loop","circle"],"title":"Mode","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"mode":"normal"},{"user_infos":[],"mode":"circle"},{"user_infos":[],"mode":"loop"}],"parser_options":[{"names":["--mode"],"args":[{"name":"mode","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"生成模式，包含 normal、loop、circle","compact":false},{"names":["--circle","套娃"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"circle"},"help_text":"套娃模式","compact":false},{"names":["--loop","循环"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"loop"},"help_text":"循环模式","compact":false}]}},"keywords":["一直"],"shortcuts":[{"key":"一直一直","args":["--loop"],"humanized":null}],"tags":[],"date_created":"2021-12-02T00:00:00","date_modified":"2024-08-09T00:00:00"};
const always_like = {"key":"always_like","params_type":{"min_images":1,"max_images":6,"min_texts":0,"max_texts":6,"default_texts":[],"args_type":null},"keywords":["我永远喜欢"],"shortcuts":[],"tags":[],"date_created":"2022-03-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const anan_hs = {"key":"anan_hs","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["何意味"],"args_type":null},"keywords":["安安举牌","夏目安安举牌"],"shortcuts":[],"tags":[],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const andwho = {"key":"andwho","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["原神"],"args_type":null},"keywords":["今天和谁过"],"shortcuts":[],"tags":[],"date_created":"2025-08-29T00:00:00","date_modified":"2025-08-29T00:00:00"};
const anmo = {"key":"anmo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["玩具"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const anti_kidnap = {"key":"anti_kidnap","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["防诱拐"],"shortcuts":[],"tags":[],"date_created":"2022-07-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const anya_suki = {"key":"anya_suki","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["阿尼亚喜欢这个"],"args_type":null},"keywords":["阿尼亚喜欢"],"shortcuts":[],"tags":["间谍过家家","阿尼亚·福杰"],"date_created":"2022-05-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const anyliew_struggling = {"key":"anyliew_struggling","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["挣扎"],"shortcuts":[],"tags":[],"date_created":"2025-05-26T00:00:00","date_modified":"2025-05-26T00:00:00"};
const applaud = {"key":"applaud","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鼓掌"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const arona_throw = {"key":"arona_throw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["阿罗娜扔"],"shortcuts":[],"tags":["蔚蓝档案","阿罗娜","碧蓝档案"],"date_created":"2024-12-10T00:00:00","date_modified":"2024-12-10T00:00:00"};
const ascension = {"key":"ascension","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["学的是机械"],"args_type":null},"keywords":["升天"],"shortcuts":[],"tags":[],"date_created":"2022-10-17T00:00:00","date_modified":"2023-02-14T00:00:00"};
const ask = {"key":"ask","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["问问"],"shortcuts":[],"tags":[],"date_created":"2022-02-23T00:00:00","date_modified":"2023-02-14T00:00:00"};
const atri_finger = {"key":"atri_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["亚托莉指"],"shortcuts":[],"tags":["ATRI","亚托莉","萝卜子"],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const atri_holdsign = {"key":"atri_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["请不要忘记我哦……\n请一直,一直记住我哦\n明天,请把我带到伊甸\n我想看见大家的笑容\n我想看到大家开心的表情\n我想学习喜悦"],"args_type":null},"keywords":["亚托莉举牌"],"shortcuts":[],"tags":["ATRI","亚托莉","萝卜子"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const atri_like = {"key":"atri_like","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["亚托莉喜欢这个"],"args_type":null},"keywords":["亚托莉喜欢"],"shortcuts":[],"tags":["ATRI","亚托莉","萝卜子"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const atri_pillow = {"key":"atri_pillow","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["ATRI"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"mode":{"default":"random","description":"yes or no","enum":["yes","no","random"],"title":"Mode","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"mode":"yes"},{"user_infos":[],"mode":"no"}],"parser_options":[{"names":["-y","--yes"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"yes"},"help_text":null,"compact":false},{"names":["-n","--no"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"no"},"help_text":null,"compact":false}]}},"keywords":["亚托莉枕头"],"shortcuts":[],"tags":["ATRI","亚托莉","萝卜子"],"date_created":"2024-08-12T00:00:00","date_modified":"2024-08-15T00:00:00"};
const ayachi_holdsign = {"key":"ayachi_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我控制不住自己啊"],"args_type":null},"keywords":["宁宁举牌"],"shortcuts":[],"tags":["绫地宁宁","魔女的夜宴","柚子社"],"date_created":"2025-04-28T00:00:00","date_modified":"2025-04-28T00:00:00"};
const azur_lane_cheshire_thumbs_up = {"key":"azur_lane_cheshire_thumbs_up","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["柴郡点赞","柴郡猫点赞"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const ba_say = {"key":"ba_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["那我问你"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"character":{"default":0,"description":"角色编号：1、心奈，2、爱丽丝，3、泉奈，4、key，5、玛丽，6、濑名，7、优香","title":"Character","type":"integer"},"position":{"default":"random","description":"消息框的位置，包含 left、right、random","enum":["left","right","random"],"title":"Position","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"character":1,"position":"right"},{"user_infos":[],"character":2,"position":"right"},{"user_infos":[],"character":3,"position":"right"},{"user_infos":[],"character":4,"position":"right"},{"user_infos":[],"character":5,"position":"right"},{"user_infos":[],"character":6,"position":"right"},{"user_infos":[],"character":7,"position":"right"}],"parser_options":[{"names":["-c","--character"],"args":[{"name":"character","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"角色编号：1、心奈，2、爱丽丝，3、泉奈，4、key，5、玛丽，6、濑名，7、优香","compact":false},{"names":["-p","--position"],"args":[{"name":"position","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"消息框的位置，包含 left、right、random","compact":false},{"names":["--left","左"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--right","右"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false}]}},"keywords":["ba说"],"shortcuts":[{"key":"心奈说","args":["--character","1"],"humanized":null},{"key":"爱丽丝说","args":["--character","2"],"humanized":null},{"key":"泉奈说","args":["--character","3"],"humanized":null},{"key":"key说","args":["--character","4"],"humanized":null},{"key":"玛丽说","args":["--character","5"],"humanized":null},{"key":"濑名说","args":["--character","6"],"humanized":null},{"key":"优香说","args":["--character","7"],"humanized":null}],"tags":["久田泉奈","冰室濑名","伊落玛丽","春原心菜","key","春原心奈","碧蓝档案","忍忍","蔚蓝档案","早濑优香","天童爱丽丝","邮箱"],"date_created":"2024-12-12T00:00:00","date_modified":"2025-01-19T00:00:00"};
const baby = {"key":"baby","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["宝宝","BB","bb","baby","Baby"],"shortcuts":[],"tags":[],"date_created":"2025-06-11T00:00:00","date_modified":"2025-06-11T00:00:00"};
const back_to_work = {"key":"back_to_work","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["继续干活","打工人"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const backflip = {"key":"backflip","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["后空翻"],"shortcuts":[],"tags":[],"date_created":"2025-06-29T00:00:00","date_modified":"2025-06-29T00:00:00"};
const bad_news = {"key":"bad_news","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["喜报"],"args_type":null},"keywords":["悲报"],"shortcuts":[],"tags":[],"date_created":"2022-10-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const baipiaoguai = {"key":"baipiaoguai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["白嫖怪"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const beat_head = {"key":"beat_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["怎么说话的你"],"args_type":null},"keywords":["拍头"],"shortcuts":[],"tags":[],"date_created":"2023-03-08T00:00:00","date_modified":"2023-03-08T00:00:00"};
const beat_up = {"key":"beat_up","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["揍"],"shortcuts":[],"tags":["猫和老鼠","杰瑞","汤姆"],"date_created":"2024-04-09T00:00:00","date_modified":"2024-04-09T00:00:00"};
const beg_foster_care = {"key":"beg_foster_care","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["求包养"],"shortcuts":[],"tags":[],"date_created":"2025-08-18T00:00:00","date_modified":"2025-08-18T00:00:00"};
const begged_me = {"key":"begged_me","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["求我"],"shortcuts":[],"tags":[],"date_created":"2025-03-10T00:00:00","date_modified":"2025-03-10T00:00:00"};
const behead = {"key":"behead","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["砍头","斩首"],"shortcuts":[],"tags":[],"date_created":"2023-07-01T00:00:00","date_modified":"2023-07-01T00:00:00"};
const beloveds = {"key":"beloveds","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["挚爱"],"shortcuts":[],"tags":[],"date_created":"2025-05-26T00:00:00","date_modified":"2025-10-04T00:00:00"};
const big_do = {"key":"big_do","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["大撅"],"shortcuts":[],"tags":[],"date_created":"2025-01-10T00:00:00","date_modified":"2025-01-10T00:00:00"};
const big_eagle_cute_girl = {"key":"big_eagle_cute_girl","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["大屌萌妹","大吊萌妹","大雕萌妹"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const bite = {"key":"bite","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["啃"],"shortcuts":[],"tags":[],"date_created":"2022-02-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const blamed_mahiro = {"key":"blamed_mahiro","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["傻逼"],"args_type":null},"keywords":["真寻挨骂"],"shortcuts":[],"tags":["绪山真寻","别当欧尼酱了"],"date_created":"2024-08-26T00:00:00","date_modified":"2024-08-26T00:00:00"};
const blood_pressure = {"key":"blood_pressure","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["高血压"],"shortcuts":[],"tags":[],"date_created":"2022-08-22T00:00:00","date_modified":"2023-02-14T00:00:00"};
const bluearchive = {"key":"bluearchive","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["Blue","Archive"],"args_type":null},"keywords":["蔚蓝档案标题","batitle"],"shortcuts":[],"tags":["蔚蓝档案","碧蓝档案"],"date_created":"2023-10-14T00:00:00","date_modified":"2024-11-02T00:00:00"};
const bocchi_draft = {"key":"bocchi_draft","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["波奇手稿"],"shortcuts":[],"tags":["后藤一里","孤独摇滚","波奇酱","后藤独"],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const bonfire_dance = {"key":"bonfire_dance","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["篝火舞","圈舞"],"shortcuts":[],"tags":[],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const bronya_holdsign = {"key":"bronya_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["V我50"],"args_type":null},"keywords":["布洛妮娅举牌","大鸭鸭举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2022-10-27T00:00:00","date_modified":"2023-03-30T00:00:00"};
const bubble_tea = {"key":"bubble_tea","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"position":{"default":"right","description":"奶茶的位置，包含 right、left、both","enum":["right","left","both"],"title":"Position","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"position":"right"},{"user_infos":[],"position":"left"},{"user_infos":[],"position":"both"}],"parser_options":[{"names":["-p","--position"],"args":[{"name":"position","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"奶茶的位置，包含 right、left、both","compact":false},{"names":["--right","右手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false},{"names":["--left","左手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--both","双手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"both"},"help_text":null,"compact":false}]}},"keywords":["奶茶"],"shortcuts":[],"tags":[],"date_created":"2022-08-22T00:00:00","date_modified":"2023-03-10T00:00:00"};
const bully_me = {"key":"bully_me","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["我"],"args_type":null},"keywords":["恶语相向"],"shortcuts":[],"tags":[],"date_created":"2025-10-11T00:00:00","date_modified":"2025-10-11T00:00:00"};
const buyaolian = {"key":"buyaolian","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["我就是不要脸\n 你来撕我啊"],"args_type":null},"keywords":["不要脸","撕脸"],"shortcuts":[],"tags":[],"date_created":"2025-05-24T00:00:00","date_modified":"2025-05-24T00:00:00"};
const cairen = {"key":"cairen","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["踩人","被踩"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const call_110 = {"key":"call_110","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["遇到困难请拨打"],"shortcuts":[],"tags":[],"date_created":"2022-08-26T00:00:00","date_modified":"2023-02-14T00:00:00"};
const can_can_need = {"key":"can_can_need","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["看看你的"],"shortcuts":[],"tags":[],"date_created":"2023-03-16T00:00:00","date_modified":"2023-03-16T00:00:00"};
const caosini = {"key":"caosini","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["炒你"],"shortcuts":[],"tags":[],"date_created":"2025-05-20T00:00:00","date_modified":"2025-05-20T00:00:00"};
const capoo_draw = {"key":"capoo_draw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波画"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2023-03-31T00:00:00","date_modified":"2023-04-28T00:00:00"};
const capoo_fished_out = {"key":"capoo_fished_out","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波掏"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-09-04T00:00:00","date_modified":"2025-09-05T00:00:00"};
const capoo_love = {"key":"capoo_love","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波爱心","❤️"],"shortcuts":[],"tags":[],"date_created":"2025-06-06T00:00:00","date_modified":"2025-06-06T00:00:00"};
const capoo_point = {"key":"capoo_point","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波指"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2024-10-24T00:00:00","date_modified":"2024-10-24T00:00:00"};
const capoo_qunou = {"key":"capoo_qunou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波群殴"],"shortcuts":[],"tags":[],"date_created":"2025-06-06T00:00:00","date_modified":"2025-06-06T00:00:00"};
const capoo_rip = {"key":"capoo_rip","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波撕"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2023-04-17T00:00:00","date_modified":"2023-04-28T00:00:00"};
const capoo_rub = {"key":"capoo_rub","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波蹭","咖波贴"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const capoo_say = {"key":"capoo_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":10,"default_texts":["寄"],"args_type":null},"keywords":["咖波说"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-30T00:00:00"};
const capoo_smash_egg = {"key":"capoo_smash_egg","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波砸蛋"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-09-05T00:00:00","date_modified":"2025-09-05T00:00:00"};
const capoo_stew = {"key":"capoo_stew","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波炖"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2024-08-23T00:00:00","date_modified":"2024-08-23T00:00:00"};
const capoo_strike = {"key":"capoo_strike","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波撞","咖波头槌"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const capoo_take_dump = {"key":"capoo_take_dump","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波拉"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const capoo_take_sleep = {"key":"capoo_take_sleep","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波睡觉","睡觉"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const capoo_take_smash = {"key":"capoo_take_smash","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波砸"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-10-03T00:00:00","date_modified":"2025-10-03T00:00:00"};
const capooplay = {"key":"capooplay","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["咖波打"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const capoozhao = {"key":"capoozhao","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["美死了"],"args_type":null},"keywords":["咖波照"],"shortcuts":[],"tags":[],"date_created":"2025-05-19T00:00:00","date_modified":"2025-05-19T00:00:00"};
const captain = {"key":"captain","params_type":{"min_images":2,"max_images":5,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["舰长"],"shortcuts":[],"tags":["崩坏3","休伯利安号","米哈游","舰长"],"date_created":"2022-10-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const cat_lick = {"key":"cat_lick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猫舔","猫猫舔"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const cat_scratch = {"key":"cat_scratch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猫抓","猫猫抓"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-09-04T00:00:00","date_modified":"2025-09-04T00:00:00"};
const caused_by_this = {"key":"caused_by_this","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["心脏病 高血压 心律不齐 心肌梗塞 失眠 脱发 呼吸困难 胸闷气短 缺氧 躁郁 焦虑 脑供血不足 心慌心悸 心脑血管炸裂"],"args_type":null},"keywords":["这个引起的"],"shortcuts":[{"key":"你的(?P<text>.+?)(?:主要)?都?是由?这个引起的","args":["{text}"],"humanized":"你的xx主要都是由这个引起的"}],"tags":[],"date_created":"2024-11-18T00:00:00","date_modified":"2024-11-22T00:00:00"};
const certificate = {"key":"certificate","params_type":{"min_images":0,"max_images":0,"min_texts":3,"max_texts":4,"default_texts":["小王","优秀学生","一年一班"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"time":{"default":"","description":"指定时间","title":"Time","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-t","--time"],"args":[{"name":"time","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定时间","compact":false}]}},"keywords":["奖状","证书"],"shortcuts":[],"tags":[],"date_created":"2023-12-03T00:00:00","date_modified":"2023-12-03T00:00:00"};
const cha = {"key":"cha","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["叉"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const chanshenzi = {"key":"chanshenzi","params_type":{"min_images":0,"max_images":0,"min_texts":3,"max_texts":3,"default_texts":["你那叫喜欢吗？","你那是馋她身子","你下贱！"],"args_type":null},"keywords":["馋身子"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const charpic = {"key":"charpic","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["字符画"],"shortcuts":[],"tags":[],"date_created":"2022-07-21T00:00:00","date_modified":"2024-11-01T00:00:00"};
const chase_train = {"key":"chase_train","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["追列车","追火车"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const chiikawa = {"key":"chiikawa","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["吉伊卡哇"],"shortcuts":[],"tags":[],"date_created":"2025-05-22T00:00:00","date_modified":"2025-05-22T00:00:00"};
const chillet_deer = {"key":"chillet_deer","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["疾风鹿"],"shortcuts":[],"tags":[],"date_created":"2025-08-14T00:00:00","date_modified":"2025-08-14T00:00:00"};
const china_flag = {"key":"china_flag","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["国旗"],"shortcuts":[],"tags":[],"date_created":"2022-03-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const chino_throw = {"key":"chino_throw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["智乃扔","智乃抛"],"shortcuts":[],"tags":["香风智乃"],"date_created":"2025-05-23T00:00:00","date_modified":"2025-05-23T00:00:00"};
const chiwoyichui = {"key":"chiwoyichui","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["吃我一锤"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const chuai = {"key":"chuai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["踹"],"shortcuts":[],"tags":[],"date_created":"2025-07-31T00:00:00","date_modified":"2025-07-31T00:00:00"};
const chuangfei = {"key":"chuangfei","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["创飞"],"shortcuts":[],"tags":[],"date_created":"2025-05-15T00:00:00","date_modified":"2025-05-15T00:00:00"};
const chuanmama = {"key":"chuanmama","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["川妈妈"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const chuini = {"key":"chuini","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捶你"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const chuosini = {"key":"chuosini","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["戳死你","戳"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const cinderella_eat = {"key":"cinderella_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["灰姑娘吃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-07T00:00:00","date_modified":"2025-08-07T00:00:00"};
const clauvio_twist = {"key":"clauvio_twist","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鼠鼠搓"],"shortcuts":[],"tags":[],"date_created":"2024-08-31T00:00:00","date_modified":"2024-08-31T00:00:00"};
const clown = {"key":"clown","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"person":{"default":false,"description":"是否使用爷爷头轮廓","title":"Person","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"person":false},{"user_infos":[],"person":true}],"parser_options":[{"names":["--person","爷"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否使用爷爷头轮廓","compact":false}]}},"keywords":["小丑"],"shortcuts":[],"tags":[],"date_created":"2023-10-14T00:00:00","date_modified":"2023-10-14T00:00:00"};
const clown_mask = {"key":"clown_mask","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"mode":{"default":"front","description":"小丑在前/后，front/behind","enum":["front","behind"],"title":"Mode","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"mode":"front"},{"user_infos":[],"mode":"behind"}],"parser_options":[{"names":["--mode"],"args":[{"name":"mode","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"小丑在前/后，front/behind","compact":false},{"names":["--front","前"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"front"},"help_text":"小丑在前","compact":false},{"names":["--behind","后"],"args":null,"dest":"mode","default":null,"action":{"type":0,"value":"behind"},"help_text":"小丑在后","compact":false}]}},"keywords":["小丑面具"],"shortcuts":[],"tags":[],"date_created":"2024-09-20T00:00:00","date_modified":"2024-09-20T00:00:00"};
const clownish = {"key":"clownish","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["滑稽"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-14T00:00:00","date_modified":"2025-08-14T00:00:00"};
const cockroaches = {"key":"cockroaches","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["蟑螂","小强"],"shortcuts":[],"tags":[],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const confuse = {"key":"confuse","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["迷惑"],"shortcuts":[],"tags":[],"date_created":"2022-09-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const contract = {"key":"contract","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["卖身契","⭐️💢契约","奴隶契约"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-11-03T00:00:00"};
const cooking = {"key":"cooking","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["炒菜"],"shortcuts":[],"tags":[],"date_created":"2025-09-29T00:00:00","date_modified":"2025-09-29T00:00:00"};
const coupon = {"key":"coupon","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["兑换券"],"shortcuts":[],"tags":[],"date_created":"2022-03-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const cover_face = {"key":"cover_face","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捂脸"],"shortcuts":[],"tags":[],"date_created":"2022-03-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const crawl = {"key":"crawl","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~92","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~92","compact":false}]}},"keywords":["爬"],"shortcuts":[],"tags":[],"date_created":"2021-05-05T00:00:00","date_modified":"2023-02-14T00:00:00"};
const cyan = {"key":"cyan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["群青"],"shortcuts":[],"tags":[],"date_created":"2022-03-18T00:00:00","date_modified":"2023-02-14T00:00:00"};
const dafen = {"key":"dafen","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["满分"],"args_type":null},"keywords":["打分"],"shortcuts":[],"tags":[],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const daobao = {"key":"daobao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["导爆"],"shortcuts":[],"tags":[],"date_created":"2025-09-06T00:00:00","date_modified":"2025-09-06T00:00:00"};
const daomaoyan = {"key":"daomaoyan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["导冒烟"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const daqi = {"key":"daqi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打气","炸奶"],"shortcuts":[],"tags":[],"date_created":"2025-11-17T00:00:00","date_modified":"2025-11-17T00:00:00"};
const daxiaojiejiadao = {"key":"daxiaojiejiadao","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["通通闪开，大小姐驾到！"],"args_type":null},"keywords":["大小姐驾到"],"shortcuts":[],"tags":[],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const daynight = {"key":"daynight","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["白天黑夜","白天晚上"],"shortcuts":[],"tags":[],"date_created":"2023-10-03T00:00:00","date_modified":"2023-10-03T00:00:00"};
const decent_kiss = {"key":"decent_kiss","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["像样的亲亲"],"shortcuts":[],"tags":[],"date_created":"2022-04-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const deer_help = {"key":"deer_help","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["帮鹿","帮🦌"],"shortcuts":[],"tags":[],"date_created":"2025-09-28T00:00:00","date_modified":"2025-09-28T00:00:00"};
const deer_plan = {"key":"deer_plan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["鹿管计划"],"shortcuts":[],"tags":[],"date_created":"2025-09-28T00:00:00","date_modified":"2025-09-28T00:00:00"};
const deer_time = {"key":"deer_time","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鹿管时间"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-09-13T00:00:00"};
const dianzhongdian = {"key":"dianzhongdian","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":2,"default_texts":["救命啊"],"args_type":null},"keywords":["入典","典中典","黑白草图"],"shortcuts":[],"tags":[],"date_created":"2022-03-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const dieluohan = {"key":"dieluohan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["叠罗汉"],"shortcuts":[],"tags":[],"date_created":"2025-07-05T00:00:00","date_modified":"2025-07-05T00:00:00"};
const dinosaur = {"key":"dinosaur","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["恐龙","小恐龙"],"shortcuts":[],"tags":[],"date_created":"2023-01-06T00:00:00","date_modified":"2023-02-14T00:00:00"};
const dinosaur_head = {"key":"dinosaur_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["恐龙头"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const distracted = {"key":"distracted","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["注意力涣散"],"shortcuts":[],"tags":["明日方舟"],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const diucat = {"key":"diucat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["丢猫"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const divorce = {"key":"divorce","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["离婚协议","离婚申请"],"shortcuts":[],"tags":[],"date_created":"2023-01-07T00:00:00","date_modified":"2023-02-14T00:00:00"};
const dog_dislike = {"key":"dog_dislike","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"circle":{"default":false,"description":"是否将图片变为圆形","title":"Circle","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"circle":false},{"user_infos":[],"circle":true}],"parser_options":[{"names":["--circle","圆"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为圆形","compact":false}]}},"keywords":["狗都不玩"],"shortcuts":[],"tags":[],"date_created":"2023-11-16T00:00:00","date_modified":"2023-11-16T00:00:00"};
const dog_ear_hat = {"key":"dog_ear_hat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["狗耳帽","狗帽"],"shortcuts":[],"tags":[],"date_created":"2025-08-17T00:00:00","date_modified":"2025-08-17T00:00:00"};
const dog_girl = {"key":"dog_girl","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["狗妹"],"shortcuts":[],"tags":[],"date_created":"2025-08-17T00:00:00","date_modified":"2025-08-17T00:00:00"};
const dog_of_vtb = {"key":"dog_of_vtb","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["管人痴"],"shortcuts":[],"tags":[],"date_created":"2023-04-18T00:00:00","date_modified":"2023-04-18T00:00:00"};
const dont_go_near = {"key":"dont_go_near","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["不要靠近"],"shortcuts":[],"tags":[],"date_created":"2022-01-02T00:00:00","date_modified":"2023-04-20T00:00:00"};
const dont_press = {"key":"dont_press","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["世界毁灭"],"args_type":null},"keywords":["不要按"],"shortcuts":[],"tags":[],"date_created":"2021-05-04T00:00:00","date_modified":"2025-11-26T21:46:16.871656"};
const dont_touch = {"key":"dont_touch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["别碰"],"shortcuts":[],"tags":[],"date_created":"2023-04-27T00:00:00","date_modified":"2023-04-27T00:00:00"};
const doro_contact = {"key":"doro_contact","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["交往","doro交往","Doro交往","DORO交往","桃乐丝交往"],"shortcuts":[],"tags":[],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const doro_dear = {"key":"doro_dear","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["最爱","doro最爱","Doro最爱","DORO最爱","桃乐丝最爱"],"shortcuts":[],"tags":[],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const doro_kiss = {"key":"doro_kiss","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["桃乐丝亲","Doro亲","doro亲"],"shortcuts":[],"tags":[],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const doro_knight = {"key":"doro_knight","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑士","doro骑士","Doro骑士","DORO骑士"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const doro_lick = {"key":"doro_lick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["桃乐丝舔","doro舔","Doro舔","DORO舔"],"shortcuts":[],"tags":[],"date_created":"2025-07-20T00:00:00","date_modified":"2025-07-20T00:00:00"};
const doro_openlight = {"key":"doro_openlight","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["开灯","桃乐丝开灯","doro开灯","Doro开灯","DORO开灯"],"shortcuts":[],"tags":[],"date_created":"2025-09-12T00:00:00","date_modified":"2025-09-12T00:00:00"};
const doro_orange = {"key":"doro_orange","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["欧润吉","润吉","润橘","橘子","橘","🍊"],"shortcuts":[],"tags":[],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const doro_surrounding_photos = {"key":"doro_surrounding_photos","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["周边写真"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const doro_thumbs_up = {"key":"doro_thumbs_up","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["doro点赞","Doro点赞","DORO点赞","桃乐丝点赞"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const doro_trampoline = {"key":"doro_trampoline","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳床","蹦床","doro蹦床","桃乐丝蹦床","doro跳床","桃乐丝跳床"],"shortcuts":[],"tags":[],"date_created":"2025-08-01T00:00:00","date_modified":"2025-08-01T00:00:00"};
const doro_work_for_you = {"key":"doro_work_for_you","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["为你打工"],"shortcuts":[],"tags":[],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const dorochou = {"key":"dorochou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro抽"],"shortcuts":[],"tags":[],"date_created":"2025-06-02T00:00:00","date_modified":"2025-06-02T00:00:00"};
const dorochui = {"key":"dorochui","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro锤"],"shortcuts":[],"tags":[],"date_created":"2025-06-09T00:00:00","date_modified":"2025-06-09T00:00:00"};
const dorojupai = {"key":"dorojupai","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我叫哦润吉"],"args_type":null},"keywords":["doro举牌","桃乐丝举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const doroqi = {"key":"doroqi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro骑"],"shortcuts":[],"tags":[],"date_created":"2025-08-06T00:00:00","date_modified":"2025-08-06T00:00:00"};
const doroti = {"key":"doroti","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro踢"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const dorotuodi = {"key":"dorotuodi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro拖地"],"shortcuts":[],"tags":[],"date_created":"2025-05-19T00:00:00","date_modified":"2025-05-19T00:00:00"};
const dorowaimai = {"key":"dorowaimai","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["doro"],"args_type":null},"keywords":["doro外卖"],"shortcuts":[],"tags":[],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const doroya = {"key":"doroya","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["doro鸭"],"shortcuts":[],"tags":[],"date_created":"2025-05-19T00:00:00","date_modified":"2025-05-19T00:00:00"};
const douyin = {"key":"douyin","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["douyin"],"args_type":null},"keywords":["douyin"],"shortcuts":[],"tags":[],"date_created":"2022-10-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const downban = {"key":"downban","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"time":{"default":"","description":"指定时间","title":"Time","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-t","--time"],"args":[{"name":"time","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定时间","compact":false}]}},"keywords":["下班"],"shortcuts":[],"tags":[],"date_created":"2025-06-13T00:00:00","date_modified":"2025-06-14T00:00:00"};
const drag_trash = {"key":"drag_trash","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拖垃圾人"],"shortcuts":[],"tags":[],"date_created":"2025-01-01T00:00:00","date_modified":"2025-01-01T00:00:00"};
const dragon_hand = {"key":"dragon_hand","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["龙手"],"shortcuts":[],"tags":[],"date_created":"2025-07-14T00:00:00","date_modified":"2025-07-14T00:00:00"};
const drumstick = {"key":"drumstick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["🍗","鸡腿"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const duidi = {"key":"duidi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["怼地","怼"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const durian = {"key":"durian","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["榴莲"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const eat = {"key":"eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["吃"],"shortcuts":[],"tags":[],"date_created":"2022-02-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const electrify_you = {"key":"electrify_you","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["猪头"],"args_type":null},"keywords":["电死你"],"shortcuts":[],"tags":[],"date_created":"2025-05-20T00:00:00","date_modified":"2025-05-20T00:00:00"};
const empathy = {"key":"empathy","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["换位思考"],"shortcuts":[],"tags":[],"date_created":"2023-04-27T00:00:00","date_modified":"2023-04-27T00:00:00"};
const emperor_dragon = {"key":"emperor_dragon","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["皇帝龙图"],"shortcuts":[],"tags":[],"date_created":"2024-10-30T00:00:00","date_modified":"2024-10-30T00:00:00"};
const erciyuan = {"key":"erciyuan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["二次元"],"shortcuts":[],"tags":[],"date_created":"2025-09-05T00:00:00","date_modified":"2025-09-05T00:00:00"};
const erised_mirror = {"key":"erised_mirror","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["意若思镜"],"shortcuts":[],"tags":["哈利·波特"],"date_created":"2024-08-31T00:00:00","date_modified":"2024-08-31T00:00:00"};
const estrous = {"key":"estrous","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["发情"],"shortcuts":[],"tags":[],"date_created":"2025-08-11T00:00:00","date_modified":"2025-08-11T00:00:00"};
const fade_away = {"key":"fade_away","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["灰飞烟灭"],"shortcuts":[],"tags":[],"date_created":"2024-08-20T00:00:00","date_modified":"2024-08-21T00:00:00"};
const family_know = {"key":"family_know","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["家人们谁懂啊"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const fanatic = {"key":"fanatic","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["洛天依"],"args_type":null},"keywords":["狂爱","狂粉"],"shortcuts":[],"tags":[],"date_created":"2021-12-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const fart = {"key":"fart","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["放屁"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const father_work = {"key":"father_work","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["此处添加文字"],"args_type":null},"keywords":["闭嘴","我爸爸"],"shortcuts":[],"tags":[],"date_created":"2024-05-12T00:00:00","date_modified":"2024-05-16T00:00:00"};
const fbi_photo = {"key":"fbi_photo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["fbi","FBI"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const feizhaiking = {"key":"feizhaiking","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["肥猪网络皇帝"],"args_type":null},"keywords":["肥仔网络皇帝","网络皇帝","皇帝"],"shortcuts":[],"tags":[],"date_created":"2025-09-28T00:00:00","date_modified":"2025-10-09T00:00:00"};
const fencing = {"key":"fencing","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["击剑","🤺"],"shortcuts":[],"tags":[],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const fever = {"key":"fever","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["为爱发烧","发烧"],"shortcuts":[],"tags":[],"date_created":"2025-07-17T00:00:00","date_modified":"2025-07-17T00:00:00"};
const fight_with_sunuo = {"key":"fight_with_sunuo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["我打宿傩","我打宿傩吗"],"shortcuts":[],"tags":["两面宿傩","咒术回战"],"date_created":"2024-04-03T00:00:00","date_modified":"2024-05-25T00:00:00"};
const fill_head = {"key":"fill_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["满脑子"],"shortcuts":[{"key":"满脑子都是(?P<name>\\S+)","args":["{name}"],"humanized":"满脑子都是xx"}],"tags":[],"date_created":"2023-06-03T00:00:00","date_modified":"2023-06-03T00:00:00"};
const find_chips = {"key":"find_chips","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["我们要飞向何方","我打算待会去码头整点薯条","我说的是归根结底，活着是为了什么","为了待会去码头整点薯条"],"args_type":null},"keywords":["整点薯条"],"shortcuts":[],"tags":[],"date_created":"2022-10-26T00:00:00","date_modified":"2023-02-14T00:00:00"};
const firefly_holdsign = {"key":"firefly_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我超爱你"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~21","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~21","compact":false}]}},"keywords":["流萤举牌"],"shortcuts":[],"tags":["崩坏：星穹铁道","米哈游","流萤"],"date_created":"2024-05-05T00:00:00","date_modified":"2024-05-06T00:00:00"};
const fireworks_head = {"key":"fireworks_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["烟花头像"],"shortcuts":[],"tags":[],"date_created":"2025-01-28T00:00:00","date_modified":"2025-01-28T00:00:00"};
const fishing = {"key":"fishing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["钓鱼"],"shortcuts":[],"tags":[],"date_created":"2025-08-19T00:00:00","date_modified":"2025-08-19T00:00:00"};
const flash_blind = {"key":"flash_blind","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["闪瞎你们的狗眼"],"args_type":null},"keywords":["闪瞎"],"shortcuts":[],"tags":[],"date_created":"2023-05-05T00:00:00","date_modified":"2023-05-05T00:00:00"};
const fleshlight = {"key":"fleshlight","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["飞机杯"],"shortcuts":[],"tags":[],"date_created":"2023-04-29T00:00:00","date_modified":"2023-04-29T00:00:00"};
const fleshlight_air_play = {"key":"fleshlight_air_play","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["空气玩法"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-10-09T00:00:00"};
const fleshlight_angel = {"key":"fleshlight_angel","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["天使心"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const fleshlight_cleaning_liquid = {"key":"fleshlight_cleaning_liquid","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["清洗液"],"shortcuts":[],"tags":[],"date_created":"2025-03-13T00:00:00","date_modified":"2025-09-05T00:00:00"};
const fleshlight_commemorative_edition_saint_sister = {"key":"fleshlight_commemorative_edition_saint_sister","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["纪念版圣修女"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_hoshino_alice = {"key":"fleshlight_hoshino_alice","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["啦啦队偶像","拉拉队偶像"],"shortcuts":[],"tags":[],"date_created":"2025-03-13T00:00:00","date_modified":"2025-09-05T00:00:00"};
const fleshlight_idol_heartbeat = {"key":"fleshlight_idol_heartbeat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["偶像心跳"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2025-06-13T00:00:00"};
const fleshlight_jissbon = {"key":"fleshlight_jissbon","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["杰士邦"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_kuileishushi = {"key":"fleshlight_kuileishushi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["白丝壁女"],"shortcuts":[],"tags":[],"date_created":"2025-07-20T00:00:00","date_modified":"2025-07-20T00:00:00"};
const fleshlight_limited_edition_saint_sister = {"key":"fleshlight_limited_edition_saint_sister","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["限定版圣修女"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_machinery = {"key":"fleshlight_machinery","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["机械龙女","机械龙女EVA","机械龙女eva"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_mengxin_packs = {"key":"fleshlight_mengxin_packs","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["萌新礼包"],"shortcuts":[],"tags":[],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const fleshlight_miyuko_kamimiya = {"key":"fleshlight_miyuko_kamimiya","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["神宫美优子"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const fleshlight_mizuki_shiranui = {"key":"fleshlight_mizuki_shiranui","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["水城不知火"],"shortcuts":[],"tags":[],"date_created":"2025-07-20T00:00:00","date_modified":"2025-07-20T00:00:00"};
const fleshlight_nrn = {"key":"fleshlight_nrn","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["乳入娘"],"shortcuts":[],"tags":[],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const fleshlight_pure_buttocks = {"key":"fleshlight_pure_buttocks","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["纯洁臀"],"shortcuts":[],"tags":[],"date_created":"2025-03-13T00:00:00","date_modified":"2025-09-05T00:00:00"};
const fleshlight_purple_spirit = {"key":"fleshlight_purple_spirit","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["紫域精灵"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const fleshlight_qiaobenyouxi = {"key":"fleshlight_qiaobenyouxi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["桥本友希"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const fleshlight_random = {"key":"fleshlight_random","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~25","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~25","compact":false}]}},"keywords":["随机杯子"],"shortcuts":[],"tags":[],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const fleshlight_saint_sister = {"key":"fleshlight_saint_sister","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["圣修女"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_saki_haruna = {"key":"fleshlight_saki_haruna","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["春奈纱希"],"shortcuts":[],"tags":[],"date_created":"2025-07-20T00:00:00","date_modified":"2025-07-20T00:00:00"};
const fleshlight_selena = {"key":"fleshlight_selena","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["魔女之森"],"shortcuts":[],"tags":[],"date_created":"2025-03-13T00:00:00","date_modified":"2025-03-13T00:00:00"};
const fleshlight_starter_pack = {"key":"fleshlight_starter_pack","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["新手礼包"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const fleshlight_summer_liuli_zi = {"key":"fleshlight_summer_liuli_zi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["夏日琉璃子"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2025-07-23T00:00:00"};
const fleshlight_taimanin_asgi = {"key":"fleshlight_taimanin_asgi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["对魔忍"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const fleshlight_xingnai = {"key":"fleshlight_xingnai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["杏奈"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const flick = {"key":"flick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["弹","脑瓜崩"],"shortcuts":[],"tags":[],"date_created":"2025-06-22T00:00:00","date_modified":"2025-06-22T00:00:00"};
const flush = {"key":"flush","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["红温"],"shortcuts":[],"tags":[],"date_created":"2024-09-03T00:00:00","date_modified":"2024-09-03T00:00:00"};
const fogging = {"key":"fogging","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["兄弟，回南了"],"args_type":null},"keywords":["回南天","水雾"],"shortcuts":[],"tags":[],"date_created":"2025-03-16T00:00:00","date_modified":"2025-03-16T00:00:00"};
const follow = {"key":"follow","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["关注"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const fontqu_smile = {"key":"fontqu_smile","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你好，世界！"],"args_type":null},"keywords":["手写"],"shortcuts":[],"tags":[],"date_created":"2023-10-01T00:00:00","date_modified":"2023-10-01T00:00:00"};
const forbid = {"key":"forbid","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["禁止","禁"],"shortcuts":[],"tags":[],"date_created":"2023-03-12T00:00:00","date_modified":"2023-03-12T00:00:00"};
const frieren_take = {"key":"frieren_take","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["所谓的男人啊，只要送他们这种东西就会很开心"],"args_type":null},"keywords":["芙莉莲拿"],"shortcuts":[],"tags":["芙莉莲","葬送的芙莉莲"],"date_created":"2024-01-18T00:00:00","date_modified":"2024-08-09T00:00:00"};
const fulilianv50 = {"key":"fulilianv50","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["我是芙蓉王，请v我50"],"args_type":null},"keywords":["芙莉莲v50"],"shortcuts":[],"tags":[],"date_created":"2025-05-22T00:00:00","date_modified":"2025-05-22T00:00:00"};
const funny_mirror = {"key":"funny_mirror","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["哈哈镜"],"shortcuts":[],"tags":[],"date_created":"2022-03-13T00:00:00","date_modified":"2023-02-14T00:00:00"};
const garbage = {"key":"garbage","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["垃圾","垃圾桶"],"shortcuts":[],"tags":[],"date_created":"2022-04-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const gejiji = {"key":"gejiji","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["割鸡鸡","割jj"],"shortcuts":[],"tags":[],"date_created":"2025-09-26T00:00:00","date_modified":"2025-09-26T00:00:00"};
const gemen_hug = {"key":"gemen_hug","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["哥们抱","兄弟抱"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const genshin_eat = {"key":"genshin_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"character":{"default":0,"description":"角色编号：1、八重神子，2、胡桃，3、妮露，4、可莉，5、刻晴，6、钟离","title":"Character","type":"integer"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"character":1},{"user_infos":[],"character":2},{"user_infos":[],"character":3},{"user_infos":[],"character":4},{"user_infos":[],"character":5},{"user_infos":[],"character":6}],"parser_options":[{"names":["-c","--character","角色"],"args":[{"name":"character","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"角色编号：1、八重神子，2、胡桃，3、妮露，4、可莉，5、刻晴，6、钟离","compact":false}]}},"keywords":["原神吃"],"shortcuts":[{"key":"(?:八重神子|神子|八重)吃","args":["--character","1"],"humanized":"八重神子吃"},{"key":"胡桃吃","args":["--character","2"],"humanized":null},{"key":"妮露吃","args":["--character","3"],"humanized":null},{"key":"可莉吃","args":["--character","4"],"humanized":null},{"key":"刻晴吃","args":["--character","5"],"humanized":null},{"key":"钟离吃","args":["--character","6"],"humanized":null}],"tags":["八重神子","原神","钟离","米哈游","刻晴","妮露","胡桃","可莉"],"date_created":"2024-08-06T00:00:00","date_modified":"2024-08-10T00:00:00"};
const genshin_start = {"key":"genshin_start","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["原神，启动！"],"args_type":null},"keywords":["原神启动"],"shortcuts":[{"key":"(?P<text>\\S+启动[!！]?)","args":["{text}"],"humanized":"xx启动"}],"tags":[],"date_created":"2023-07-01T00:00:00","date_modified":"2023-07-01T00:00:00"};
const get_up = {"key":"get_up","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["起床"],"shortcuts":[],"tags":[],"date_created":"2025-05-14T00:00:00","date_modified":"2025-05-14T00:00:00"};
const gong_xi_fa_cai = {"key":"gong_xi_fa_cai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["恭喜发财"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const gongzei = {"key":"gongzei","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["我爱加班"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["工贼"],"shortcuts":[],"tags":[],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const good_news = {"key":"good_news","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["悲报"],"args_type":null},"keywords":["喜报"],"shortcuts":[],"tags":[],"date_created":"2021-12-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const google = {"key":"google","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["Google"],"args_type":null},"keywords":["google"],"shortcuts":[],"tags":[],"date_created":"2022-10-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const google_captcha = {"key":"google_captcha","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["谷歌验证码"],"shortcuts":[],"tags":[],"date_created":"2024-08-15T00:00:00","date_modified":"2024-08-15T00:00:00"};
const gorilla_throw = {"key":"gorilla_throw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猩猩扔"],"shortcuts":[],"tags":[],"date_created":"2024-11-16T00:00:00","date_modified":"2024-11-22T00:00:00"};
const goujiao = {"key":"goujiao","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["不服你也爆"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定文本","compact":false}]}},"keywords":["狗叫"],"shortcuts":[],"tags":[],"date_created":"2025-09-12T00:00:00","date_modified":"2025-09-12T00:00:00"};
const grab = {"key":"grab","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抓"],"shortcuts":[],"tags":[],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const guan_bingxiang = {"key":"guan_bingxiang","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["关冰箱"],"shortcuts":[],"tags":[],"date_created":"2025-01-01T00:00:00","date_modified":"2025-01-01T00:00:00"};
const guichu = {"key":"guichu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"direction":{"default":"left","description":"鬼畜对称方向，包含 left、right、top、bottom","enum":["left","right","top","bottom"],"title":"Direction","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"direction":"left"},{"user_infos":[],"direction":"right"},{"user_infos":[],"direction":"top"},{"user_infos":[],"direction":"bottom"}],"parser_options":[{"names":["-d","--direction"],"args":[{"name":"direction","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"鬼畜对称方向，包含 left、right、top、bottom","compact":false},{"names":["--left","左"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--right","右"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false},{"names":["--top","上"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"top"},"help_text":null,"compact":false},{"names":["--bottom","下"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"bottom"},"help_text":null,"compact":false}]}},"keywords":["鬼畜"],"shortcuts":[],"tags":[],"date_created":"2023-07-19T00:00:00","date_modified":"2023-07-19T00:00:00"};
const gulaojupai = {"key":"gulaojupai","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我叫小萌新"],"args_type":null},"keywords":["故佬举牌","小萌新举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-07-08T00:00:00","date_modified":"2025-07-08T00:00:00"};
const gun = {"key":"gun","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"position":{"default":"left","description":"枪的位置，包含 left、right、both","enum":["left","right","both"],"title":"Position","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"position":"left"},{"user_infos":[],"position":"right"},{"user_infos":[],"position":"both"}],"parser_options":[{"names":["-p","--position"],"args":[{"name":"position","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"枪的位置，包含 left、right、both","compact":false},{"names":["--left","左手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--right","右手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false},{"names":["--both","双手"],"args":null,"dest":"position","default":null,"action":{"type":0,"value":"both"},"help_text":null,"compact":false}]}},"keywords":["手枪"],"shortcuts":[],"tags":[],"date_created":"2022-08-22T00:00:00","date_modified":"2023-02-14T00:00:00"};
const hammer = {"key":"hammer","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["锤"],"shortcuts":[],"tags":[],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const handwriting = {"key":"handwriting","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你好，世界！"],"args_type":null},"keywords":["手写"],"shortcuts":[],"tags":[],"date_created":"2025-06-11T00:00:00","date_modified":"2025-06-11T00:00:00"};
const happy_mid_autumn_festival = {"key":"happy_mid_autumn_festival","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中秋快乐","中秋节快乐"],"shortcuts":[],"tags":[],"date_created":"2025-08-18T00:00:00","date_modified":"2025-08-18T00:00:00"};
const happy_national_day = {"key":"happy_national_day","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["国庆快乐","国庆节快乐"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const happy_new_year = {"key":"happy_new_year","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["新年好"],"shortcuts":[],"tags":[],"date_created":"2025-09-07T00:00:00","date_modified":"2025-09-07T00:00:00"};
const haruhi_raise = {"key":"haruhi_raise","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["凉宫春日举"],"shortcuts":[],"tags":["凉宫春日"],"date_created":"2024-11-13T00:00:00","date_modified":"2024-11-13T00:00:00"};
const heartbeat = {"key":"heartbeat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["心跳"],"shortcuts":[],"tags":[],"date_created":"2025-09-05T00:00:00","date_modified":"2025-09-05T00:00:00"};
const heike = {"key":"heike","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["嘿客"],"args_type":null},"keywords":["嘿壳","黑客","嘿客"],"shortcuts":[],"tags":[],"date_created":"2025-06-27T00:00:00","date_modified":"2025-06-27T00:00:00"};
const hendo = {"key":"hendo","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["狠撅","狠狠撅"],"shortcuts":[],"tags":[],"date_created":"2021-05-04T00:00:00","date_modified":"2025-11-26T21:46:16.871656"};
const henqi = {"key":"henqi","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["狠骑","狠狠骑"],"shortcuts":[],"tags":[],"date_created":"2021-05-04T00:00:00","date_modified":"2025-11-26T21:46:16.871656"};
const high_EQ = {"key":"high_EQ","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["高情商","低情商"],"args_type":null},"keywords":["高低情商","低高情商"],"shortcuts":[{"key":"低情商[\\s:：]*(?P<low>\\S+)\\s*高情商[\\s:：]*(?P<high>\\S+)","args":["{low}","{high}"],"humanized":"低情商xx高情商xx"},{"key":"高情商[\\s:：]*(?P<high>\\S+)\\s*低情商[\\s:：]*(?P<low>\\S+)","args":["{low}","{high}"],"humanized":"高情商xx低情商xx"}],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2024-08-12T00:00:00"};
const hit_screen = {"key":"hit_screen","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打穿","打穿屏幕"],"shortcuts":[],"tags":[],"date_created":"2022-09-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const hitachi_mako_together = {"key":"hitachi_mako_together","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["和她在一起"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const hold_grudge = {"key":"hold_grudge","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["群友不发涩图"],"args_type":null},"keywords":["记仇"],"shortcuts":[],"tags":[],"date_created":"2021-12-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const hold_tight = {"key":"hold_tight","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抱紧"],"shortcuts":[],"tags":[],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const horse_riding = {"key":"horse_riding","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑马"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const houminghao = {"key":"houminghao","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["姐姐不乖哦"],"args_type":null},"keywords":["侯明昊"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-07-11T00:00:00","date_modified":"2025-07-11T00:00:00"};
const huanying = {"key":"huanying","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["欢迎"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const huanying2 = {"key":"huanying2","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["欢迎欢迎","欢迎!","欢迎！"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const huanyingchuo = {"key":"huanyingchuo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["欢迎新人"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const hug = {"key":"hug","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抱","抱抱"],"shortcuts":[],"tags":[],"date_created":"2024-08-06T00:00:00","date_modified":"2024-08-06T00:00:00"};
const hug_leg = {"key":"hug_leg","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抱大腿"],"shortcuts":[],"tags":[],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const huochailu = {"key":"huochailu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["火柴撸"],"shortcuts":[],"tags":["火柴人"],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const hutao_bite = {"key":"hutao_bite","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["胡桃啃"],"shortcuts":[],"tags":["胡桃","原神","米哈游"],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const ice_tea_head = {"key":"ice_tea_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["冰红茶"],"shortcuts":[],"tags":[],"date_created":"2025-03-25T00:00:00","date_modified":"2025-03-25T00:00:00"};
const ignite = {"key":"ignite","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["燃起来了"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const ikun_basketball = {"key":"ikun_basketball","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["篮球","🏀"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const ikun_durian_head = {"key":"ikun_durian_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["榴莲坤头"],"shortcuts":[],"tags":[],"date_created":"2025-03-29T00:00:00","date_modified":"2025-03-29T00:00:00"};
const ikun_head = {"key":"ikun_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["小黑子"],"shortcuts":[],"tags":[],"date_created":"2025-03-25T00:00:00","date_modified":"2025-03-25T00:00:00"};
const ikun_like = {"key":"ikun_like","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["坤坤喜欢这个"],"args_type":null},"keywords":["坤坤喜欢"],"shortcuts":[],"tags":["喜欢","坤坤","ikun","真爱粉"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const ikun_need_tv = {"key":"ikun_need_tv","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["坤坤想要"],"shortcuts":[],"tags":[],"date_created":"2025-09-04T00:00:00","date_modified":"2025-09-04T00:00:00"};
const ikun_why_are_you = {"key":"ikun_why_are_you","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["你干嘛","你干吗"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const imprison = {"key":"imprison","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我发涩图被抓起来了"],"args_type":null},"keywords":["坐牢"],"shortcuts":[],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const incivilization = {"key":"incivilization","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["你刚才说的话不是很礼貌！"],"args_type":null},"keywords":["不文明"],"shortcuts":[],"tags":[],"date_created":"2022-10-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const intel_inside = {"key":"intel_inside","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["intel"],"args_type":null},"keywords":["inside"],"shortcuts":[{"key":"(?P<text>\\S{1,10})\\s+inside","args":["{text}"],"humanized":"xx inside"}],"tags":[],"date_created":"2024-10-29T00:00:00","date_modified":"2024-10-29T00:00:00"};
const interaction = {"key":"interaction","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["互动"],"shortcuts":[],"tags":[],"date_created":"2025-05-12T00:00:00","date_modified":"2025-05-12T00:00:00"};
const interview = {"key":"interview","params_type":{"min_images":1,"max_images":2,"min_texts":0,"max_texts":1,"default_texts":["采访大佬经验"],"args_type":null},"keywords":["采访"],"shortcuts":[],"tags":[],"date_created":"2022-03-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const izumi_sagiri_painting = {"key":"izumi_sagiri_painting","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["和泉纱雾画画"],"shortcuts":[],"tags":[],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const jd_delivery_person = {"key":"jd_delivery_person","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["京东外卖骑手","京东外卖工牌"],"shortcuts":[],"tags":[],"date_created":"2025-03-24T00:00:00","date_modified":"2025-09-25T00:00:00"};
const jd_takeout = {"key":"jd_takeout","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["京东外卖"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const jerk_off = {"key":"jerk_off","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打胶"],"shortcuts":[],"tags":[],"date_created":"2024-08-04T00:00:00","date_modified":"2024-08-04T00:00:00"};
const jerry_stare = {"key":"jerry_stare","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["杰瑞盯"],"shortcuts":[],"tags":["猫和老鼠","杰瑞"],"date_created":"2024-08-09T00:00:00","date_modified":"2024-08-09T00:00:00"};
const jiamianqishi = {"key":"jiamianqishi","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["哦～","（飞扑）","一直想看你这幅表情","这幅嫉妒我的表情"],"args_type":null},"keywords":["假面骑士"],"shortcuts":[],"tags":[],"date_created":"2024-10-30T00:00:00","date_modified":"2024-10-30T00:00:00"};
const jianpanxia = {"key":"jianpanxia","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["来点涩图"],"args_type":null},"keywords":["键盘侠"],"shortcuts":[],"tags":[],"date_created":"2025-09-15T00:00:00","date_modified":"2025-09-15T00:00:00"};
const jibao = {"key":"jibao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["挤爆"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const jiji_king = {"key":"jiji_king","params_type":{"min_images":1,"max_images":11,"min_texts":0,"max_texts":11,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"circle":{"default":false,"description":"是否将图片变为圆形","title":"Circle","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"circle":false},{"user_infos":[],"circle":true}],"parser_options":[{"names":["--circle","圆"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为圆形","compact":false}]}},"keywords":["急急国王"],"shortcuts":[],"tags":[],"date_created":"2022-10-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const jinhsi = {"key":"jinhsi","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["汐汐"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~13","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~13","compact":false}]}},"keywords":["汐汐","今汐"],"shortcuts":[],"tags":["今汐","鸣潮"],"date_created":"2024-12-07T00:00:00","date_modified":"2024-12-07T00:00:00"};
const jiubingfufa = {"key":"jiubingfufa","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["此乃旧病复发也"],"args_type":null},"keywords":["旧病复发"],"shortcuts":[],"tags":[],"date_created":"2025-04-01T00:00:00","date_modified":"2025-04-11T00:00:00"};
const jiujiu = {"key":"jiujiu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["啾啾"],"shortcuts":[],"tags":[],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const jiumi = {"key":"jiumi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["揪咪","掐咪咪揪咪咪"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const jump = {"key":"jump","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳"],"shortcuts":[],"tags":[],"date_created":"2024-07-14T00:00:00","date_modified":"2024-07-14T00:00:00"};
const juwu = {"key":"juwu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["巨物"],"shortcuts":[],"tags":[],"date_created":"2025-03-16T00:00:00","date_modified":"2025-03-16T00:00:00"};
const kaleidoscope = {"key":"kaleidoscope","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"circle":{"default":false,"description":"是否将图片变为圆形","title":"Circle","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"circle":false},{"user_infos":[],"circle":true}],"parser_options":[{"names":["--circle","圆"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为圆形","compact":false}]}},"keywords":["万花筒","万花镜"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const karyl_point = {"key":"karyl_point","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["凯露指"],"shortcuts":[],"tags":["凯露","公主连结"],"date_created":"2022-11-16T00:00:00","date_modified":"2023-02-14T00:00:00"};
const kawa = {"key":"kawa","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["卡哇伊"],"args_type":null},"keywords":["kawa","卡哇伊"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-07-08T00:00:00","date_modified":"2025-07-08T00:00:00"};
const keep_away = {"key":"keep_away","params_type":{"min_images":1,"max_images":8,"min_texts":0,"max_texts":1,"default_texts":["如何提高社交质量 : \n远离以下头像的人"],"args_type":null},"keywords":["远离"],"shortcuts":[],"tags":[],"date_created":"2022-05-31T00:00:00","date_modified":"2023-02-14T00:00:00"};
const keep_your_money = {"key":"keep_your_money","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，1-阿罗娜，2-普拉娜","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，1-阿罗娜，2-普拉娜","compact":false}]}},"keywords":["压岁钱不要交给"],"shortcuts":[],"tags":["普拉娜","蔚蓝档案","阿罗娜","碧蓝档案"],"date_created":"2024-12-29T00:00:00","date_modified":"2024-12-31T00:00:00"};
const keliplay = {"key":"keliplay","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["可莉打"],"shortcuts":[],"tags":[],"date_created":"2025-05-19T00:00:00","date_modified":"2025-05-19T00:00:00"};
const kfc = {"key":"kfc","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["kfc","KFC","肯德基"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const kfc_thursday = {"key":"kfc_thursday","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["星期四","疯狂星期四"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const kick_ball = {"key":"kick_ball","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["踢球"],"shortcuts":[],"tags":[],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const kirby_hammer = {"key":"kirby_hammer","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"circle":{"default":false,"description":"是否将图片变为圆形","title":"Circle","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"circle":false},{"user_infos":[],"circle":true}],"parser_options":[{"names":["--circle","圆"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为圆形","compact":false}]}},"keywords":["卡比锤","卡比重锤"],"shortcuts":[],"tags":["星之卡比"],"date_created":"2022-11-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const kiss = {"key":"kiss","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["亲","亲亲"],"shortcuts":[],"tags":[],"date_created":"2021-06-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const klee_eat = {"key":"klee_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["可莉吃"],"shortcuts":[],"tags":["原神","米哈游","可莉"],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const knock = {"key":"knock","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["敲"],"shortcuts":[],"tags":["鲨鲨","Gawr Gura","噶呜·古拉"],"date_created":"2022-04-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const kokona_seal = {"key":"kokona_seal","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["满分"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~12","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~12","compact":false}]}},"keywords":["心奈印章"],"shortcuts":[],"tags":["蔚蓝档案","春原心奈","春原心菜","碧蓝档案"],"date_created":"2024-11-05T00:00:00","date_modified":"2024-11-22T00:00:00"};
const konata_watch = {"key":"konata_watch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["泉此方看"],"shortcuts":[],"tags":["泉此方","幸运星"],"date_created":"2024-08-18T00:00:00","date_modified":"2024-08-19T00:00:00"};
const kou = {"key":"kou","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["嗦","口"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const kurogames_abby_eat = {"key":"kurogames_abby_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["阿布吃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-14T00:00:00","date_modified":"2025-07-14T00:00:00"};
const kurogames_abby_lift_high = {"key":"kurogames_abby_lift_high","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["举高高"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-03T00:00:00","date_modified":"2025-08-03T00:00:00"};
const kurogames_abby_rub = {"key":"kurogames_abby_rub","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["阿布贴贴"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-03T00:00:00","date_modified":"2025-08-03T00:00:00"};
const kurogames_abby_solace = {"key":"kurogames_abby_solace","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["安慰","阿布安慰"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-03T00:00:00","date_modified":"2025-10-03T00:00:00"};
const kurogames_abby_weeping = {"key":"kurogames_abby_weeping","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抱头痛哭"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-15T00:00:00","date_modified":"2025-07-15T00:00:00"};
const kurogames_abby_write = {"key":"kurogames_abby_write","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["用新鲜的肉烹饪出的沙丁布卡~\n我是比较老派的七丘口味\n这道菜可以添加适量的辣椒\n但不要学拉古那人加奇怪的酸味酱啊！"],"args_type":null},"keywords":["阿布写信"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_camellya_holdsign = {"key":"kurogames_camellya_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["尽情挣扎，别让我无聊！"],"args_type":null},"keywords":["大傻椿举牌","傻椿举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_camellya_photo = {"key":"kurogames_camellya_photo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["大傻椿照片","傻椿照片"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_carlotta_holdsign = {"key":"kurogames_carlotta_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["十连三金"],"args_type":null},"keywords":["珂莱塔举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const kurogames_carlotta_play = {"key":"kurogames_carlotta_play","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["一边玩去吧","一边玩去"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-11T00:00:00","date_modified":"2025-10-11T00:00:00"};
const kurogames_cartethyia_feetup = {"key":"kurogames_cartethyia_feetup","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["卡提希娅抬脚","卡提抬脚"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-12T00:00:00","date_modified":"2025-08-12T00:00:00"};
const kurogames_cartethyia_holdsign = {"key":"kurogames_cartethyia_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["一份青枝月桂沙拉谢谢"],"args_type":null},"keywords":["卡提举牌","卡提希娅举牌","卡提西亚举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const kurogames_cartethyia_say = {"key":"kurogames_cartethyia_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我不再是那个无力迷茫、只能等待你拯救的少女了，现在的我已能和你并肩而战，为你提供助益了。"],"args_type":null},"keywords":["卡提说","卡提希娅说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-13T00:00:00","date_modified":"2025-06-13T00:00:00"};
const kurogames_changli_finger = {"key":"kurogames_changli_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["长离指"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-10T00:00:00","date_modified":"2025-05-10T00:00:00"};
const kurogames_changli_holdsign = {"key":"kurogames_changli_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["弈棋布势之道，如同万物运转"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~5","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~5","compact":false}]}},"keywords":["长离举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-25T00:00:00","date_modified":"2025-08-25T00:00:00"};
const kurogames_chun_holdsign = {"key":"kurogames_chun_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["傻？我不傻"],"args_type":null},"keywords":["椿举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-06-30T00:00:00","date_modified":"2025-06-30T00:00:00"};
const kurogames_good_night = {"key":"kurogames_good_night","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["晚安"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const kurogames_gugu_blowfish_small_classes = {"key":"kurogames_gugu_blowfish_small_classes","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["松伦哥,不要再涩涩了"],"args_type":null},"keywords":["咕咕河豚小课堂","小课堂"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const kurogames_iuno_holdsign = {"key":"kurogames_iuno_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["月相轮转之间，我以我为锚点"],"args_type":null},"keywords":["尤诺举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-03T00:00:00","date_modified":"2025-08-03T00:00:00"};
const kurogames_iuno_hug = {"key":"kurogames_iuno_hug","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["尤诺抱"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-05T00:00:00","date_modified":"2025-08-05T00:00:00"};
const kurogames_iuno_kick = {"key":"kurogames_iuno_kick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["尤诺踢","优诺踢"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-31T00:00:00","date_modified":"2025-08-01T00:00:00"};
const kurogames_iuno_play = {"key":"kurogames_iuno_play","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["尤诺玩","优诺玩"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-30T00:00:00","date_modified":"2025-07-30T00:00:00"};
const kurogames_iuno_say = {"key":"kurogames_iuno_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["月亮游离世间"],"args_type":null},"keywords":["尤诺说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-11T00:00:00","date_modified":"2025-08-11T00:00:00"};
const kurogames_jinhsi_eat = {"key":"kurogames_jinhsi_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["今汐吃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-11T00:00:00","date_modified":"2025-08-11T00:00:00"};
const kurogames_jinhsi_sit = {"key":"kurogames_jinhsi_sit","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["今汐坐"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const kurogames_jinhsi_steamed_buns = {"key":"kurogames_jinhsi_steamed_buns","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["今汐小笼包"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const kurogames_lingyang_holdsign = {"key":"kurogames_lingyang_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我叫凌阳，比起我摘下狮头后的这幅模样，可能大家更习惯的，还是那位梅花桩上的“狮首”吧？希望相处之后，你能记住这个原原本本的我呀。"],"args_type":null},"keywords":["凌阳举牌","雪豹举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-06-16T00:00:00"};
const kurogames_lupa_eat = {"key":"kurogames_lupa_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["露帕吃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-20T00:00:00","date_modified":"2025-07-20T00:00:00"};
const kurogames_lupa_holdsign = {"key":"kurogames_lupa_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["用新鲜的肉烹饪出的沙丁布卡~我是比较老派的七丘口味，这道菜可以添加适量的辣椒，但不要学拉古那人加奇怪的酸味酱啊！"],"args_type":null},"keywords":["露帕举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_lupa_photo = {"key":"kurogames_lupa_photo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["露帕照片"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-04T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_mortefi_holdsign = {"key":"kurogames_mortefi_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["今汐令尹万岁！"],"args_type":null},"keywords":["莫特斐举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-26T00:00:00","date_modified":"2025-05-26T00:00:00"};
const kurogames_mp = {"key":"kurogames_mp","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["鸣批","鸣P","鸣p","鸣潮玩家","鸣潮男"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-03-07T00:00:00","date_modified":"2025-03-07T00:00:00"};
const kurogames_nsfw_verina_holdsign = {"key":"kurogames_nsfw_verina_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["不可以色色"],"args_type":null},"keywords":["瑟瑟维里奈举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const kurogames_orang = {"key":"kurogames_orang","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["飞廉之猩"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const kurogames_phoebe_holdsign = {"key":"kurogames_phoebe_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我是隐海修会的教士，菲比。岁主在上，愿你的旅途永远有爱与光明垂耀。"],"args_type":null},"keywords":["菲比举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-13T00:00:00","date_modified":"2025-06-13T00:00:00"};
const kurogames_phoebe_say = {"key":"kurogames_phoebe_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["嘟嘟嘟说什么呢"],"args_type":null},"keywords":["菲比说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-10T00:00:00","date_modified":"2025-05-10T00:00:00"};
const kurogames_phoebe_score_sheet = {"key":"kurogames_phoebe_score_sheet","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["菲比评分表","评分表"],"shortcuts":[],"tags":[],"date_created":"2025-05-24T00:00:00","date_modified":"2025-05-24T00:00:00"};
const kurogames_phrolova_eat = {"key":"kurogames_phrolova_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["弗洛洛吃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const kurogames_phrolova_holdsign = {"key":"kurogames_phrolova_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我是残星会会监弗洛洛，安静、忧郁，似乎靠近我就会坠入无尽的忧伤之中。在生死之间，我谱写了一篇又一篇曲谱，不断构筑着我心中完美的世界。让我们一起，完成这场万众期待的演奏。"],"args_type":null},"keywords":["弗洛洛举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-04T00:00:00"};
const kurogames_phrolova_say = {"key":"kurogames_phrolova_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["怪鸟在鸣啸，时间到了。"],"args_type":null},"keywords":["弗洛洛说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-13T00:00:00","date_modified":"2025-06-13T00:00:00"};
const kurogames_roccia_holdsign = {"key":"kurogames_roccia_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["佩洛肚皮空空，灵感快来快来"],"args_type":null},"keywords":["洛可可举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-10T00:00:00","date_modified":"2025-08-10T00:00:00"};
const kurogames_rover_cards = {"key":"kurogames_rover_cards","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["荣耀之丘"],"shortcuts":[],"tags":[],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const kurogames_rover_head = {"key":"kurogames_rover_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["漂泊者头像框"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const kurogames_rover_holdsign = {"key":"kurogames_rover_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["不可以色色"],"args_type":null},"keywords":["漂泊者举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const kurogames_rover_lick = {"key":"kurogames_rover_lick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["漂泊者舔"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const kurogames_songlun_dinner = {"key":"kurogames_songlun_dinner","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["松伦晚餐","松伦哥晚餐"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const kurogames_songlun_finger = {"key":"kurogames_songlun_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["松伦指","潮批"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const kurogames_songlun_holdsign = {"key":"kurogames_songlun_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你必歪雪豹"],"args_type":null},"keywords":["李松伦举牌","松伦举牌","松伦哥举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const kurogames_songlun_say = {"key":"kurogames_songlun_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["鸣潮玩家的声音太尖锐了"],"args_type":null},"keywords":["难道说","松伦说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-10T00:00:00","date_modified":"2025-06-10T00:00:00"};
const kurogames_the_shorekeeper_holdsign = {"key":"kurogames_the_shorekeeper_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["松伦狗策划太坏了"],"args_type":null},"keywords":["守岸人举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-05T00:00:00","date_modified":"2025-06-05T00:00:00"};
const kurogames_verina_finger = {"key":"kurogames_verina_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["维里奈指","小维指"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-07-07T00:00:00","date_modified":"2025-07-07T00:00:00"};
const kurogames_verina_group_photo = {"key":"kurogames_verina_group_photo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["和维里奈合影"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const kurogames_verina_holdsign = {"key":"kurogames_verina_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["希望你开心哦"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 1~5","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 1~5","compact":false}]}},"keywords":["小维举牌","维里奈举牌"],"shortcuts":[],"tags":[],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const kurogames_verina_say = {"key":"kurogames_verina_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["希望你开心哦"],"args_type":null},"keywords":["小维说","维里奈说"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const kurogames_yangyang_holdsign = {"key":"kurogames_yangyang_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["祝你鸣潮十连三金~"],"args_type":null},"keywords":["秧秧举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-12T00:00:00","date_modified":"2025-06-12T00:00:00"};
const kurogames_yangyang_lover = {"key":"kurogames_yangyang_lover","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["秧秧老公"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-10T00:00:00","date_modified":"2025-06-10T00:00:00"};
const kurogames_zani_aloft = {"key":"kurogames_zani_aloft","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["赞妮举"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-08-25T00:00:00","date_modified":"2025-08-25T00:00:00"};
const kurogames_zhezhi_draw = {"key":"kurogames_zhezhi_draw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["折枝画画","折枝绘画"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-06-19T00:00:00","date_modified":"2025-06-19T00:00:00"};
const kurogames_zhezhi_holdsign = {"key":"kurogames_zhezhi_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["祝你鸣潮玩的开心"],"args_type":null},"keywords":["折枝举牌"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const lash = {"key":"lash","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鞭笞","鞭打","鞭挞","鞭策"],"shortcuts":[],"tags":[],"date_created":"2024-07-23T00:00:00","date_modified":"2024-07-23T00:00:00"};
const laughing = {"key":"laughing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["笑指"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const laydown_do = {"key":"laydown_do","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["躺撅"],"shortcuts":[],"tags":[],"date_created":"2025-08-21T00:00:00","date_modified":"2025-08-21T00:00:00"};
const learn = {"key":"learn","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["偷学群友数理基础"],"args_type":null},"keywords":["偷学"],"shortcuts":[],"tags":[],"date_created":"2022-12-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const left_right_jump = {"key":"left_right_jump","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"direction":{"default":"left_right","description":"跑动方向，包含 left_right、right_left","enum":["left_right","right_left"],"title":"Direction","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"direction":"left_right"},{"user_infos":[],"direction":"right_left"}],"parser_options":[{"names":["-d","--direction"],"args":[{"name":"direction","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"跑动方向，包含 left_right、right_left","compact":false},{"names":["--left_right","左右"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"left_right"},"help_text":null,"compact":false},{"names":["--right_left","右左"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"right_left"},"help_text":null,"compact":false}]}},"keywords":["左右横跳"],"shortcuts":[],"tags":[],"date_created":"2024-07-14T00:00:00","date_modified":"2024-07-14T00:00:00"};
const lemon = {"key":"lemon","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["柠檬"],"shortcuts":[],"tags":[],"date_created":"2025-07-11T00:00:00","date_modified":"2025-07-11T00:00:00"};
const let_me_in = {"key":"let_me_in","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["让我进去"],"shortcuts":[],"tags":[],"date_created":"2024-07-18T00:00:00","date_modified":"2024-07-18T00:00:00"};
const lick_candy = {"key":"lick_candy","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["舔糖","舔棒棒糖"],"shortcuts":[],"tags":[],"date_created":"2024-08-14T00:00:00","date_modified":"2024-08-14T00:00:00"};
const liedui = {"key":"liedui","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["列队"],"shortcuts":[],"tags":[],"date_created":"2025-06-19T00:00:00","date_modified":"2025-06-19T00:00:00"};
const lim_x_0 = {"key":"lim_x_0","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["等价无穷小"],"shortcuts":[],"tags":[],"date_created":"2023-01-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const listen_music = {"key":"listen_music","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["听音乐"],"shortcuts":[],"tags":[],"date_created":"2022-03-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const little_angel = {"key":"little_angel","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["小天使"],"shortcuts":[],"tags":[],"date_created":"2022-01-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const little_do = {"key":"little_do","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["小撅","轻撅","滑稽撅"],"shortcuts":[],"tags":[],"date_created":"2024-07-12T00:00:00","date_modified":"2024-07-12T00:00:00"};
const liugou = {"key":"liugou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["遛狗"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const llz = {"key":"llz","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["琉璃子","瑠璃子","清凉杯子","水着琉璃子","水着瑠璃子"],"shortcuts":[],"tags":[],"date_created":"2024-12-26T00:00:00","date_modified":"2024-12-26T00:00:00"};
const loading = {"key":"loading","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["加载中"],"shortcuts":[],"tags":[],"date_created":"2021-12-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const lochi_mari_play = {"key":"lochi_mari_play","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["玛丽玩","伊落玛丽玩"],"shortcuts":[],"tags":["蔚蓝档案","碧蓝档案"],"date_created":"2025-08-08T00:00:00","date_modified":"2025-08-08T00:00:00"};
const look_flat = {"key":"look_flat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["可恶...被人看扁了"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"ratio":{"default":2,"description":"图片“压扁”比例，默认为 2","title":"Ratio","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-r","--ratio"],"args":[{"name":"ratio","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片“压扁”比例，默认为 2","compact":false}]}},"keywords":["看扁"],"shortcuts":[],"tags":[],"date_created":"2022-10-06T00:00:00","date_modified":"2023-02-14T00:00:00"};
const look_leg = {"key":"look_leg","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["看看腿"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const look_this_icon = {"key":"look_this_icon","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["朋友\n先看看这个图标再说话"],"args_type":null},"keywords":["看图标"],"shortcuts":[],"tags":[],"date_created":"2022-10-07T00:00:00","date_modified":"2023-02-14T00:00:00"};
const loop = {"key":"loop","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"direction":{"default":"top","description":"循环方向，包含 left、right、top、bottom","enum":["left","right","top","bottom"],"title":"Direction","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"direction":"left"},{"user_infos":[],"direction":"right"},{"user_infos":[],"direction":"top"},{"user_infos":[],"direction":"bottom"}],"parser_options":[{"names":["-d","--direction"],"args":[{"name":"direction","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"循环方向，包含 left、right、top、bottom","compact":false},{"names":["--left","左"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--right","右"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false},{"names":["--top","上"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"top"},"help_text":null,"compact":false},{"names":["--bottom","下"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"bottom"},"help_text":null,"compact":false}]}},"keywords":["循环"],"shortcuts":[],"tags":[],"date_created":"2024-07-14T00:00:00","date_modified":"2024-08-15T00:00:00"};
const lost_dog = {"key":"lost_dog","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["寻狗启事"],"shortcuts":[],"tags":["原神","米哈游","神里绫华"],"date_created":"2024-01-19T00:00:00","date_modified":"2024-01-20T00:00:00"};
const louvre = {"key":"louvre","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["卢浮宫"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-05-29T00:00:00"};
const love_you = {"key":"love_you","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["永远爱你"],"shortcuts":[],"tags":[],"date_created":"2022-03-13T00:00:00","date_modified":"2023-02-14T00:00:00"};
const lulu_feed_pig = {"key":"lulu_feed_pig","params_type":{"min_images":1,"max_images":8,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鲁鲁喂猪","鲁鲁养猪"],"shortcuts":[],"tags":[],"date_created":"2025-11-19T00:00:00","date_modified":"2025-11-19T00:00:00"};
const lulu_qizhu = {"key":"lulu_qizhu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鲁鲁骑猪","骑猪"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const luotianyi_need = {"key":"luotianyi_need","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["洛天依要","天依要"],"shortcuts":[],"tags":["洛天依"],"date_created":"2025-02-11T00:00:00","date_modified":"2025-02-11T00:00:00"};
const luotianyi_say = {"key":"luotianyi_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["好想去海边啊～"],"args_type":null},"keywords":["洛天依说","天依说"],"shortcuts":[],"tags":["洛天依"],"date_created":"2025-01-07T00:00:00","date_modified":"2025-01-07T00:00:00"};
const luoyonghao_say = {"key":"luoyonghao_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["又不是不能用"],"args_type":null},"keywords":["罗永浩说"],"shortcuts":[],"tags":[],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const luxun_say = {"key":"luxun_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我没有说过这句话"],"args_type":null},"keywords":["鲁迅说","鲁迅说过"],"shortcuts":[],"tags":[],"date_created":"2021-12-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const ly01 = {"key":"ly01","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["ly01","ly-1","LY-1"],"shortcuts":[],"tags":[],"date_created":"2025-09-04T00:00:00","date_modified":"2025-09-21T00:00:00"};
const mahiro_fuck = {"key":"mahiro_fuck","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["真寻中指","中指","🖕🏻"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const mahiro_readbook = {"key":"mahiro_readbook","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["真寻看书"],"shortcuts":[],"tags":["绪山真寻","别当欧尼酱了"],"date_created":"2024-08-18T00:00:00","date_modified":"2024-08-18T00:00:00"};
const maikease = {"key":"maikease","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["美国前五星上将麦克阿瑟","曾这样评价道","如果让我去阻止xxx","那么我宁愿去阻止上帝"],"args_type":null},"keywords":["麦克阿瑟说"],"shortcuts":[],"tags":[],"date_created":"2023-07-30T00:00:00","date_modified":"2023-07-30T00:00:00"};
const maimai_awaken = {"key":"maimai_awaken","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["旅行伙伴觉醒"],"shortcuts":[],"tags":["舞萌"],"date_created":"2023-07-19T00:00:00","date_modified":"2023-07-19T00:00:00"};
const maimai_join = {"key":"maimai_join","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["旅行伙伴加入"],"shortcuts":[],"tags":["舞萌"],"date_created":"2023-07-19T00:00:00","date_modified":"2023-07-19T00:00:00"};
const make_friend = {"key":"make_friend","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["交个朋友"],"shortcuts":[],"tags":[],"date_created":"2022-03-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const maodielanqiu = {"key":"maodielanqiu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["耄耋篮球"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const maomaochong = {"key":"maomaochong","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["毛毛虫"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const marriage = {"key":"marriage","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["结婚申请","结婚登记"],"shortcuts":[],"tags":[],"date_created":"2022-05-31T00:00:00","date_modified":"2023-02-14T00:00:00"};
const masturbate = {"key":"masturbate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["导","打飞机"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-06-14T00:00:00"};
const meiyijian = {"key":"meiyijian","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["没意见","我没意见"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const mengbimao = {"key":"mengbimao","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["懵逼猫","猫懵了","猫傻了"],"shortcuts":[],"tags":[],"date_created":"2025-11-11T00:00:00","date_modified":"2025-11-11T00:00:00"};
const mengjue = {"key":"mengjue","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猛撅","速撅","狗狗撅"],"shortcuts":[],"tags":[],"date_created":"2025-11-23T00:00:00","date_modified":"2025-11-23T00:00:00"};
const mengqin = {"key":"mengqin","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猛亲","仓鼠亲","一顿亲"],"shortcuts":[],"tags":[],"date_created":"2025-10-26T00:00:00","date_modified":"2025-10-26T00:00:00"};
const merry_christmas = {"key":"merry_christmas","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["圣诞快乐","圣诞节快乐"],"shortcuts":[],"tags":[],"date_created":"2025-08-18T00:00:00","date_modified":"2025-08-18T00:00:00"};
const meteor = {"key":"meteor","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我要对象"],"args_type":null},"keywords":["流星"],"shortcuts":[],"tags":[],"date_created":"2022-10-21T00:00:00","date_modified":"2023-02-14T00:00:00"};
const mi_leijun_holdsign = {"key":"mi_leijun_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["Are you OK ?"],"args_type":null},"keywords":["雷军举牌"],"shortcuts":[],"tags":[],"date_created":"2025-09-23T00:00:00","date_modified":"2025-09-23T00:00:00"};
const mi_monkey = {"key":"mi_monkey","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["米猴","🐒","🐵"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const mihoyo = {"key":"mihoyo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["米哈游"],"shortcuts":[],"tags":[],"date_created":"2023-05-06T00:00:00","date_modified":"2023-05-06T00:00:00"};
const mihoyo_amber_frame = {"key":"mihoyo_amber_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["安柏相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_bailu_kick = {"key":"mihoyo_bailu_kick","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["白露踢"],"shortcuts":[],"tags":["崩坏：星穹铁道","米哈游"],"date_created":"2025-09-30T00:00:00","date_modified":"2025-09-30T00:00:00"};
const mihoyo_barbara_pegg_frame = {"key":"mihoyo_barbara_pegg_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["芭芭拉相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_barbatos_frame = {"key":"mihoyo_barbatos_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["巴巴托斯","风神相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_caribert_alberich_frame = {"key":"mihoyo_caribert_alberich_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["卡利贝尔相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_chasca_frame = {"key":"mihoyo_chasca_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["恰斯卡相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_citlali_frame = {"key":"mihoyo_citlali_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["茜特菈莉相框","奶奶相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_columbina_jade_feet = {"key":"mihoyo_columbina_jade_feet","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["玉足"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const mihoyo_duantou = {"key":"mihoyo_duantou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["断头","断头台","罪人舞步旋"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-08-17T00:00:00","date_modified":"2025-08-17T00:00:00"};
const mihoyo_editorial_society_frame = {"key":"mihoyo_editorial_society_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["编辑协会相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_elysia_come = {"key":"mihoyo_elysia_come","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["爱莉希雅降临"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const mihoyo_funina_card = {"key":"mihoyo_funina_card","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["曾经我是戴上假面的演员，只想要掩饰真相…"],"args_type":null},"keywords":["芙芙卡片","芙宁娜卡片","芙芙酱卡片"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-26T00:00:00"};
const mihoyo_funina_death_penalty = {"key":"mihoyo_funina_death_penalty","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["死刑"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-03-14T00:00:00","date_modified":"2025-03-14T00:00:00"};
const mihoyo_funina_finger = {"key":"mihoyo_funina_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["芙芙指","芙宁娜指","芙芙酱指"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const mihoyo_funina_holdsign = {"key":"mihoyo_funina_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["当那古老的预言终结、一切落幕之后，我曾经陷入很长时间的消沉。站在舞台上的人受到观众的追捧，同时也承受着更多的注视与期待。但我很清楚，他们期待的并不是我，而是我扮演的那位「神明」...在这个过程中，我真正得到的只有孤独。所以我一度庆恶任何跟表演有关的事，把自己关在房间里，直到再次站上舞台、再次面对观众的时候，我才发现不知不觉我内心的不安已经消失了。现在的我可以坦然承受他们的目光,也许是因为…我终于开始「扮演」我自己了。"],"args_type":null},"keywords":["芙宁娜举牌","芙芙举牌","芙芙酱举牌"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-07-04T00:00:00"};
const mihoyo_funina_round_head = {"key":"mihoyo_funina_round_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["芙芙圆形头像","芙宁娜圆形头像"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-03-29T00:00:00","date_modified":"2025-03-29T00:00:00"};
const mihoyo_funina_square_head = {"key":"mihoyo_funina_square_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["芙芙方形头像","芙宁娜方形头像"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-03-29T00:00:00","date_modified":"2025-03-29T00:00:00"};
const mihoyo_gemini_frame = {"key":"mihoyo_gemini_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["双子相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_genshin_impact_op = {"key":"mihoyo_genshin_impact_op","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["OP","op","Op","oP"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const mihoyo_genshin_impact_players = {"key":"mihoyo_genshin_impact_players","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["原批","原神玩家"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-03-14T00:00:00","date_modified":"2025-03-14T00:00:00"};
const mihoyo_guoba_frame = {"key":"mihoyo_guoba_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["锅巴相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_hilichurl_frame = {"key":"mihoyo_hilichurl_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["丘丘人相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_hutao_frame = {"key":"mihoyo_hutao_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["胡桃相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_hutao_holdsign = {"key":"mihoyo_hutao_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["嗯哼，太阳出来我晒太阳，月亮出来我晒月亮嘞"],"args_type":null},"keywords":["胡桃举牌"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const mihoyo_ineffa_droid = {"key":"mihoyo_ineffa_droid","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["人机"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const mihoyo_kaveh_frame = {"key":"mihoyo_kaveh_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["卡维相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_keqing_pointo = {"key":"mihoyo_keqing_pointo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["刻晴指"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const mihoyo_klee_duduke_frame = {"key":"mihoyo_klee_duduke_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["可莉嘟嘟可相框","嘟嘟可"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_klee_frame = {"key":"mihoyo_klee_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["可莉相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_klee_hat_frame = {"key":"mihoyo_klee_hat_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["可莉帽子相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_kujou_sara_frame = {"key":"mihoyo_kujou_sara_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["九条裟罗相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_kuki_shinobu_frame = {"key":"mihoyo_kuki_shinobu_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["久岐忍相框","阿忍相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_kuki_shinobu_who = {"key":"mihoyo_kuki_shinobu_who","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["此人是谁","是谁","是谁？","是谁？"],"shortcuts":[],"tags":[],"date_created":"2025-09-30T00:00:00","date_modified":"2025-09-30T00:00:00"};
const mihoyo_lce_slime_frame = {"key":"mihoyo_lce_slime_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["冰史莱姆相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_liuwei_dinner = {"key":"mihoyo_liuwei_dinner","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["刘伟晚餐","共进晚餐","大伟哥晚餐"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-09-02T00:00:00","date_modified":"2025-09-02T00:00:00"};
const mihoyo_liuwei_holdsign = {"key":"mihoyo_liuwei_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你的声音太尖锐了"],"args_type":null},"keywords":["刘伟举牌","大伟举牌","大伟哥举牌"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const mihoyo_liuwei_say = {"key":"mihoyo_liuwei_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你的声音太尖锐了"],"args_type":null},"keywords":["刘伟说","大伟说","大伟哥说"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const mihoyo_lynette_holdsign = {"key":"mihoyo_lynette_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["林尼大笨蛋"],"args_type":null},"keywords":["琳妮特举牌"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-05-26T00:00:00","date_modified":"2025-05-26T00:00:00"};
const mihoyo_navia_caspar_persuade = {"key":"mihoyo_navia_caspar_persuade","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["说服"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const mihoyo_outlander_frame = {"key":"mihoyo_outlander_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["异乡人相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_paimon_crown = {"key":"mihoyo_paimon_crown","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["派蒙王冠","派蒙皇冠","👑"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_paimon_emergency_food_frame = {"key":"mihoyo_paimon_emergency_food_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["应急食品相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_paimon_frame = {"key":"mihoyo_paimon_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["派蒙相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_qiqi_suck = {"key":"mihoyo_qiqi_suck","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["七七舔"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const mihoyo_sangonomiya_kokomi_love = {"key":"mihoyo_sangonomiya_kokomi_love","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["心海爱心"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-10-02T00:00:00","date_modified":"2025-10-02T00:00:00"};
const mihoyo_senior_phone = {"key":"mihoyo_senior_phone","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["米学长手机"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const mihoyo_shikanoin_heizou_frame = {"key":"mihoyo_shikanoin_heizou_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鹿野院平藏相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_sigewinne_fingered = {"key":"mihoyo_sigewinne_fingered","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["没救了","希格雯指"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const mihoyo_tartaglia_frame = {"key":"mihoyo_tartaglia_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["达达利亚相框","阿贾克斯相框","公子相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_tepetlisauri_frame = {"key":"mihoyo_tepetlisauri_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["嵴锋龙相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_thunderbolt_slime_frame = {"key":"mihoyo_thunderbolt_slime_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["雷史莱姆相框","雷电史莱姆相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_traveler_frame = {"key":"mihoyo_traveler_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["旅行者相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_wind_slime_frame = {"key":"mihoyo_wind_slime_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["风史莱姆相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_yanfei_frame = {"key":"mihoyo_yanfei_frame","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["烟绯相框"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-06-01T00:00:00","date_modified":"2025-06-01T00:00:00"};
const mihoyo_yelan_phone = {"key":"mihoyo_yelan_phone","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["夜兰手机"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const miss_in_my_sleep = {"key":"miss_in_my_sleep","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["睡梦中想念"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const mix_dog = {"key":"mix_dog","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["小狗"],"shortcuts":[],"tags":[],"date_created":"2025-05-14T00:00:00","date_modified":"2025-05-14T00:00:00"};
const mixue = {"key":"mixue","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["蜜雪冰城"],"shortcuts":[],"tags":[],"date_created":"2025-06-20T00:00:00","date_modified":"2025-06-20T00:00:00"};
const mixue_jasmine_milk_green = {"key":"mixue_jasmine_milk_green","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["茉莉奶绿"],"shortcuts":[],"tags":[],"date_created":"2025-06-20T00:00:00","date_modified":"2025-06-20T00:00:00"};
const mixue_stick_beaten_fresh_orange = {"key":"mixue_stick_beaten_fresh_orange","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["棒打鲜橙"],"shortcuts":[],"tags":[],"date_created":"2025-06-20T00:00:00","date_modified":"2025-06-20T00:00:00"};
const motivate = {"key":"motivate","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["鞭策"],"shortcuts":[],"tags":[],"date_created":"2025-10-30T00:00:00","date_modified":"2025-10-30T00:00:00"};
const mourning = {"key":"mourning","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"black":{"default":false,"description":"是否将图片变为黑白","title":"Black","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"black":false},{"user_infos":[],"black":true}],"parser_options":[{"names":["--black","黑白"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为黑白","compact":false}]}},"keywords":["上香"],"shortcuts":[],"tags":[],"date_created":"2023-07-29T00:00:00","date_modified":"2023-07-29T00:00:00"};
const murmur = {"key":"murmur","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你的假期余额不足"],"args_type":null},"keywords":["低语"],"shortcuts":[],"tags":[],"date_created":"2021-12-31T00:00:00","date_modified":"2023-02-14T00:00:00"};
const my_certificate = {"key":"my_certificate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["牛马"],"args_type":null},"keywords":["我的证"],"shortcuts":[],"tags":[],"date_created":"2025-05-14T00:00:00","date_modified":"2025-05-14T00:00:00"};
const my_friend = {"key":"my_friend","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":10,"default_texts":["让我康康"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["我朋友说"],"shortcuts":[],"tags":[],"date_created":"2022-03-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const my_opinion = {"key":"my_opinion","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["我的意见如下","我的意见是"],"shortcuts":[],"tags":["东方Project"],"date_created":"2024-07-14T00:00:00","date_modified":"2024-07-14T00:00:00"};
const my_wife = {"key":"my_wife","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"pronoun":{"default":"我","description":"人称代词，默认为“我”","title":"Pronoun","type":"string"},"name":{"default":"老婆","description":"称呼，默认为“老婆”","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-p","--pron"],"args":[{"name":"pronoun","value":"str","default":null,"flags":null}],"dest":"pronoun","default":null,"action":null,"help_text":"人称代词，默认为“我”","compact":false},{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":"name","default":null,"action":null,"help_text":"称呼，默认为“老婆”","compact":false}]}},"keywords":["我老婆","这是我老婆"],"shortcuts":[],"tags":[],"date_created":"2022-07-29T00:00:00","date_modified":"2024-08-12T00:00:00"};
const mygo_sakiko_togawa = {"key":"mygo_sakiko_togawa","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["丰川祥子","祥子","豊川祥子"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const myplay = {"key":"myplay","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["笨死了"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["我敲"],"shortcuts":[],"tags":[],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const nahida_bite = {"key":"nahida_bite","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["纳西妲啃","草神啃"],"shortcuts":[],"tags":["原神","草神","纳西妲","米哈游"],"date_created":"2023-06-23T00:00:00","date_modified":"2024-08-10T00:00:00"};
const nakano_lchika = {"key":"nakano_lchika","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中野一花"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const nakano_ltsuki = {"key":"nakano_ltsuki","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中野五月"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const nakano_miku = {"key":"nakano_miku","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中野三玖"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const nakano_nino = {"key":"nakano_nino","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中野二乃"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const nakano_yotsuba = {"key":"nakano_yotsuba","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["中野四叶"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const name_generator = {"key":"name_generator","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["亚文化取名机","亚名"],"shortcuts":[],"tags":[],"date_created":"2023-02-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const nantongjue = {"key":"nantongjue","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["男同撅","猥琐撅"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const naonao_tou = {"key":"naonao_tou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["挠挠头"],"shortcuts":[],"tags":[],"date_created":"2025-01-01T00:00:00","date_modified":"2025-01-01T00:00:00"};
const naruro_resurrection = {"key":"naruro_resurrection","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["复活","立即复活"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-01T00:00:00","date_modified":"2025-07-01T00:00:00"};
const naruro_s_ninja = {"key":"naruro_s_ninja","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["S忍","s忍"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2025-05-25T00:00:00"};
const naruro_uzumaki_naruto_holdsign = {"key":"naruro_uzumaki_naruto_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我才不要在这种时候放弃,即使当不成中忍,我也会通过其他的途径成为火影的,这就是我的忍道 "],"args_type":null},"keywords":["鸣人举牌","漩涡鸣人举牌"],"shortcuts":[],"tags":[],"date_created":"2025-06-14T00:00:00","date_modified":"2025-06-14T00:00:00"};
const national_day_plan = {"key":"national_day_plan","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":0,"description":"图片编号，范围为 0~3，0为随机","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号，范围为 0~3，0为随机","compact":false}]}},"keywords":["国庆计划","国庆节计划"],"shortcuts":[],"tags":[],"date_created":"2025-09-28T00:00:00","date_modified":"2025-09-29T00:00:00"};
const need = {"key":"need","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["需要","你可能需要"],"shortcuts":[],"tags":[],"date_created":"2022-03-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const nekoha_holdsign = {"key":"nekoha_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["V我50"],"args_type":null},"keywords":["猫羽雫举牌","猫猫举牌"],"shortcuts":[],"tags":["猫羽雫"],"date_created":"2023-03-30T00:00:00","date_modified":"2023-03-30T00:00:00"};
const new_goodnews = {"key":"new_goodnews","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":2,"default_texts":["天命之人","喜报传佳讯\n福星高照\n满门庭"],"args_type":null},"keywords":["新喜报"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2025-10-03T00:00:00"};
const nietumao = {"key":"nietumao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捏兔帽","捏粉帽"],"shortcuts":[],"tags":[],"date_created":"2025-11-26T00:00:00","date_modified":"2025-11-26T00:00:00"};
const nihaosaoa = {"key":"nihaosaoa","params_type":{"min_images":0,"max_images":0,"min_texts":3,"max_texts":3,"default_texts":["既然追求刺激","就贯彻到底了","你好骚啊"],"args_type":null},"keywords":["你好骚啊"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const nijika_holdsign = {"key":"nijika_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你可少看点二次元吧"],"args_type":null},"keywords":["伊地知虹夏举牌","虹夏举牌"],"shortcuts":[],"tags":[],"date_created":"2023-06-20T00:00:00","date_modified":"2023-06-20T00:00:00"};
const niuniu_play_ball = {"key":"niuniu_play_ball","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["牛牛打球","打球","牛牛"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const nizaishuo = {"key":"nizaishuo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["你闭嘴！"],"args_type":null},"keywords":["你再说","你闭嘴"],"shortcuts":[],"tags":[],"date_created":"2025-06-16T00:00:00","date_modified":"2025-06-19T00:00:00"};
const no_response = {"key":"no_response","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["无响应"],"shortcuts":[],"tags":[],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const nokia = {"key":"nokia","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["无内鬼，继续交易"],"args_type":null},"keywords":["诺基亚","有内鬼"],"shortcuts":[],"tags":[],"date_created":"2021-12-15T00:00:00","date_modified":"2023-02-14T00:00:00"};
const not_call_me = {"key":"not_call_me","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["开银趴不喊我是吧"],"args_type":null},"keywords":["不喊我"],"shortcuts":[],"tags":[],"date_created":"2022-11-16T00:00:00","date_modified":"2023-02-14T00:00:00"};
const note_for_leave = {"key":"note_for_leave","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["想玩原神"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"time":{"default":"","description":"指定时间","title":"Time","type":"string"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-t","--time"],"args":[{"name":"time","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定时间","compact":false},{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["请假条"],"shortcuts":[],"tags":[],"date_created":"2023-04-27T00:00:00","date_modified":"2023-04-27T00:00:00"};
const nvtongjue = {"key":"nvtongjue","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["女同撅","姐妹撅"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const ok = {"key":"ok","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["ok","OK","Ok"],"shortcuts":[],"tags":[],"date_created":"2025-09-17T00:00:00","date_modified":"2025-09-17T00:00:00"};
const onepunch = {"key":"onepunch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["给你一拳"],"shortcuts":[],"tags":[],"date_created":"2025-05-16T00:00:00","date_modified":"2025-05-16T00:00:00"};
const operator_generator = {"key":"operator_generator","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["合成大干员"],"shortcuts":[],"tags":[],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const oral_sex = {"key":"oral_sex","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["口"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-06-14T00:00:00"};
const orange_head = {"key":"orange_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["橘子头"],"shortcuts":[],"tags":[],"date_created":"2025-05-29T00:00:00","date_modified":"2025-07-07T00:00:00"};
const oshi_no_ko = {"key":"oshi_no_ko","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["网友"],"args_type":null},"keywords":["我推的网友"],"shortcuts":[{"key":"我推的(?P<name>\\S+)","args":["{name}"],"humanized":"我推的xx"}],"tags":["我推的孩子"],"date_created":"2023-06-01T00:00:00","date_modified":"2023-06-23T00:00:00"};
const osu = {"key":"osu","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["hso!"],"args_type":null},"keywords":["osu"],"shortcuts":[],"tags":[],"date_created":"2023-07-27T00:00:00","date_modified":"2023-07-27T00:00:00"};
const out = {"key":"out","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["out"],"shortcuts":[],"tags":[],"date_created":"2024-04-26T00:00:00","date_modified":"2024-04-26T00:00:00"};
const overtime = {"key":"overtime","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["加班"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const p5letter = {"key":"p5letter","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["TAKEYOURHEART"],"args_type":null},"keywords":["女神异闻录5预告信","P5预告信"],"shortcuts":[],"tags":[],"date_created":"2024-11-13T00:00:00","date_modified":"2024-11-13T00:00:00"};
const painitou = {"key":"painitou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拍你头"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const paint = {"key":"paint","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["这像画吗"],"shortcuts":[],"tags":[],"date_created":"2022-03-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const painter = {"key":"painter","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["小画家"],"shortcuts":[],"tags":["崩坏3","格蕾修","米哈游"],"date_created":"2022-06-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const palworld_chillet = {"key":"palworld_chillet","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["疾风鼬"],"shortcuts":[],"tags":[],"date_created":"2025-09-27T00:00:00","date_modified":"2025-09-27T00:00:00"};
const palworld_chillet_god_wealth = {"key":"palworld_chillet_god_wealth","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["财源滚滚","财神到"],"shortcuts":[],"tags":[],"date_created":"2025-09-28T00:00:00","date_modified":"2025-09-28T00:00:00"};
const panda_dragon_figure = {"key":"panda_dragon_figure","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我要玩原神"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","description":"龙图名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"龙图名字","compact":false}]}},"keywords":["熊猫龙图"],"shortcuts":[{"key":"(?P<name>\\S{1,10})龙[\\s:：]+(?P<text>\\S+)","args":["--name","{name}龙","{text}"],"humanized":"xx龙：xx"}],"tags":[],"date_created":"2024-10-30T00:00:00","date_modified":"2024-10-30T00:00:00"};
const pao = {"key":"pao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跑"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const paobujis = {"key":"paobujis","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跑步机"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const pass_the_buck = {"key":"pass_the_buck","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["你写!"],"args_type":null},"keywords":["推锅","甩锅"],"shortcuts":[],"tags":[],"date_created":"2023-03-31T00:00:00","date_modified":"2023-04-18T00:00:00"};
const pat = {"key":"pat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拍"],"shortcuts":[],"tags":[],"date_created":"2021-12-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const pay_to_watch = {"key":"pay_to_watch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["付费观看"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const peas = {"key":"peas","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["我嘞个豆","豆"],"shortcuts":[],"tags":[],"date_created":"2025-07-13T00:00:00","date_modified":"2025-07-13T00:00:00"};
const penshe = {"key":"penshe","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["喷射"],"shortcuts":[],"tags":[],"date_created":"2025-05-31T00:00:00","date_modified":"2025-05-31T00:00:00"};
const penshui = {"key":"penshui","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["龙王"],"args_type":null},"keywords":["喷水"],"shortcuts":[],"tags":[],"date_created":"2025-05-20T00:00:00","date_modified":"2025-05-20T00:00:00"};
const pepe_raise = {"key":"pepe_raise","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["佩佩举"],"shortcuts":[],"tags":["明日方舟"],"date_created":"2024-08-18T00:00:00","date_modified":"2024-08-18T00:00:00"};
const perfect = {"key":"perfect","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["完美"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const petpet = {"key":"petpet","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"circle":{"default":false,"description":"是否将图片变为圆形","title":"Circle","type":"boolean"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"circle":false},{"user_infos":[],"circle":true}],"parser_options":[{"names":["--circle","圆"],"args":null,"dest":null,"default":false,"action":{"type":0,"value":true},"help_text":"是否将图片变为圆形","compact":false}]}},"keywords":["摸","摸摸","摸头","rua"],"shortcuts":[],"tags":[],"date_created":"2021-05-04T00:00:00","date_modified":"2023-02-11T00:00:00"};
const pi = {"key":"pi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["放屁"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const piboss = {"key":"piboss","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["痞老板"],"shortcuts":[],"tags":[],"date_created":"2025-05-30T00:00:00","date_modified":"2025-05-30T00:00:00"};
const picking_flowers = {"key":"picking_flowers","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["摘花"],"shortcuts":[],"tags":[],"date_created":"2025-08-16T00:00:00","date_modified":"2025-08-16T00:00:00"};
const pierrot_plus_head = {"key":"pierrot_plus_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拾又之国"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const pigcar = {"key":"pigcar","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猪猪车"],"shortcuts":[],"tags":[],"date_created":"2025-05-23T00:00:00","date_modified":"2025-05-23T00:00:00"};
const pinailong = {"key":"pinailong","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["劈奶龙"],"shortcuts":[],"tags":[],"date_created":"2025-05-31T00:00:00","date_modified":"2025-05-31T00:00:00"};
const pinch = {"key":"pinch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捏","捏脸"],"shortcuts":[],"tags":[],"date_created":"2023-11-18T00:00:00","date_modified":"2023-11-18T00:00:00"};
const pinch_egg = {"key":"pinch_egg","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捏鸡蛋"],"shortcuts":[],"tags":[],"date_created":"2025-11-16T00:00:00","date_modified":"2025-11-16T00:00:00"};
const pineapple = {"key":"pineapple","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["菠萝","pineapple"],"shortcuts":[],"tags":[],"date_created":"2024-11-10T00:00:00","date_modified":"2024-11-10T00:00:00"};
const pineapples = {"key":"pineapples","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["🍍","菠萝头"],"shortcuts":[],"tags":["原神","米哈游"],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const pingdiguo = {"key":"pingdiguo","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["平底锅","拍死你"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const pixelate = {"key":"pixelate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"number":{"default":10,"description":"像素化大小，默认为 10","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--number"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"像素化大小，默认为 10","compact":false}]}},"keywords":["像素化"],"shortcuts":[],"tags":[],"date_created":"2024-08-12T00:00:00","date_modified":"2024-08-12T00:00:00"};
const pjsk = {"key":"pjsk","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"character":{"default":0,"description":"角色编号：1、爱莉，2、彰人，3、杏，4、梦，5、绘名，6、遥，7、穗波，8、一歌，9、KAITO，10、奏，11、心羽，12、连，13、流歌，14、真冬，15、MEIKO，16、初音未来，17、实乃理，18、瑞希，19、宁宁，20、铃，21、类，22、咲希，23、志步，24、雫，25、冬弥，26、司","title":"Character","type":"integer"},"number":{"default":0,"description":"图片编号","title":"Number","type":"integer"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"character":1,"number":0},{"user_infos":[],"character":2,"number":0},{"user_infos":[],"character":3,"number":0},{"user_infos":[],"character":4,"number":0},{"user_infos":[],"character":5,"number":0},{"user_infos":[],"character":6,"number":0},{"user_infos":[],"character":7,"number":0},{"user_infos":[],"character":8,"number":0},{"user_infos":[],"character":9,"number":0},{"user_infos":[],"character":10,"number":0},{"user_infos":[],"character":11,"number":0},{"user_infos":[],"character":12,"number":0},{"user_infos":[],"character":13,"number":0},{"user_infos":[],"character":14,"number":0},{"user_infos":[],"character":15,"number":0},{"user_infos":[],"character":16,"number":0},{"user_infos":[],"character":17,"number":0},{"user_infos":[],"character":18,"number":0},{"user_infos":[],"character":19,"number":0},{"user_infos":[],"character":20,"number":0},{"user_infos":[],"character":21,"number":0},{"user_infos":[],"character":22,"number":0},{"user_infos":[],"character":23,"number":0},{"user_infos":[],"character":24,"number":0},{"user_infos":[],"character":25,"number":0},{"user_infos":[],"character":26,"number":0}],"parser_options":[{"names":["-c","--character","角色编号"],"args":[{"name":"character","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"角色编号：1、爱莉，2、彰人，3、杏，4、梦，5、绘名，6、遥，7、穗波，8、一歌，9、KAITO，10、奏，11、心羽，12、连，13、流歌，14、真冬，15、MEIKO，16、初音未来，17、实乃理，18、瑞希，19、宁宁，20、铃，21、类，22、咲希，23、志步，24、雫，25、冬弥，26、司","compact":false},{"names":["-n","--number","图片编号"],"args":[{"name":"number","value":"int","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"图片编号","compact":false}]}},"keywords":["pjsk","世界计划"],"shortcuts":[{"key":"(:?pjsk|世界计划)[_-]?(:?爱莉|airi)","args":["--character","1"],"humanized":"pjsk爱莉"},{"key":"(:?pjsk|世界计划)[_-]?(:?彰人|akito)","args":["--character","2"],"humanized":"pjsk彰人"},{"key":"(:?pjsk|世界计划)[_-]?(:?杏|an)","args":["--character","3"],"humanized":"pjsk杏"},{"key":"(:?pjsk|世界计划)[_-]?(:?梦|emu)","args":["--character","4"],"humanized":"pjsk梦"},{"key":"(:?pjsk|世界计划)[_-]?(:?绘名|ena)","args":["--character","5"],"humanized":"pjsk绘名"},{"key":"(:?pjsk|世界计划)[_-]?(:?遥|haruka)","args":["--character","6"],"humanized":"pjsk遥"},{"key":"(:?pjsk|世界计划)[_-]?(:?穗波|honami)","args":["--character","7"],"humanized":"pjsk穗波"},{"key":"(:?pjsk|世界计划)[_-]?(:?一歌|ichika)","args":["--character","8"],"humanized":"pjsk一歌"},{"key":"(:?pjsk|世界计划)[_-]?(:?KAITO|kaito)","args":["--character","9"],"humanized":"pjskKAITO"},{"key":"(:?pjsk|世界计划)[_-]?(:?奏|kanade)","args":["--character","10"],"humanized":"pjsk奏"},{"key":"(:?pjsk|世界计划)[_-]?(:?心羽|kohane)","args":["--character","11"],"humanized":"pjsk心羽"},{"key":"(:?pjsk|世界计划)[_-]?(:?连|len)","args":["--character","12"],"humanized":"pjsk连"},{"key":"(:?pjsk|世界计划)[_-]?(:?流歌|luka)","args":["--character","13"],"humanized":"pjsk流歌"},{"key":"(:?pjsk|世界计划)[_-]?(:?真冬|mafuyu)","args":["--character","14"],"humanized":"pjsk真冬"},{"key":"(:?pjsk|世界计划)[_-]?(:?MEIKO|meiko)","args":["--character","15"],"humanized":"pjskMEIKO"},{"key":"(:?pjsk|世界计划)[_-]?(:?初音未来|miku)","args":["--character","16"],"humanized":"pjsk初音未来"},{"key":"(:?pjsk|世界计划)[_-]?(:?实乃理|minori)","args":["--character","17"],"humanized":"pjsk实乃理"},{"key":"(:?pjsk|世界计划)[_-]?(:?瑞希|mizuki)","args":["--character","18"],"humanized":"pjsk瑞希"},{"key":"(:?pjsk|世界计划)[_-]?(:?宁宁|nene)","args":["--character","19"],"humanized":"pjsk宁宁"},{"key":"(:?pjsk|世界计划)[_-]?(:?铃|rin)","args":["--character","20"],"humanized":"pjsk铃"},{"key":"(:?pjsk|世界计划)[_-]?(:?类|rui)","args":["--character","21"],"humanized":"pjsk类"},{"key":"(:?pjsk|世界计划)[_-]?(:?咲希|saki)","args":["--character","22"],"humanized":"pjsk咲希"},{"key":"(:?pjsk|世界计划)[_-]?(:?志步|shiho)","args":["--character","23"],"humanized":"pjsk志步"},{"key":"(:?pjsk|世界计划)[_-]?(:?雫|shizuku)","args":["--character","24"],"humanized":"pjsk雫"},{"key":"(:?pjsk|世界计划)[_-]?(:?冬弥|touya)","args":["--character","25"],"humanized":"pjsk冬弥"},{"key":"(:?pjsk|世界计划)[_-]?(:?司|tsukasa)","args":["--character","26"],"humanized":"pjsk司"}],"tags":["世界计划"],"date_created":"2024-12-19T00:00:00","date_modified":"2024-12-19T00:00:00"};
const plana_eat = {"key":"plana_eat","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["普拉娜吃","普拉娜舔"],"shortcuts":[],"tags":["普拉娜","蔚蓝档案","碧蓝档案"],"date_created":"2024-11-21T00:00:00","date_modified":"2024-11-21T00:00:00"};
const play = {"key":"play","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["顶","玩"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2021-10-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const play_baseball = {"key":"play_baseball","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打棒球"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-06-03T00:00:00","date_modified":"2025-06-03T00:00:00"};
const play_basketball = {"key":"play_basketball","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打篮球","火柴人打篮球"],"shortcuts":[],"tags":["火柴人"],"date_created":"2025-04-30T00:00:00","date_modified":"2025-04-30T00:00:00"};
const play_game = {"key":"play_game","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["来玩休闲游戏啊"],"args_type":null},"keywords":["玩游戏"],"shortcuts":[],"tags":[],"date_created":"2022-01-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const play_together = {"key":"play_together","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["一起玩"],"shortcuts":[],"tags":["蔚蓝档案","碧蓝档案"],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const police = {"key":"police","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["平安名すみれ"],"args_type":null},"keywords":["出警"],"shortcuts":[],"tags":[],"date_created":"2022-02-23T00:00:00","date_modified":"2024-09-06T00:00:00"};
const police1 = {"key":"police1","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["警察"],"shortcuts":[],"tags":[],"date_created":"2022-03-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const police_car = {"key":"police_car","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["警车"],"shortcuts":[],"tags":[],"date_created":"2025-05-13T00:00:00","date_modified":"2025-05-13T00:00:00"};
const pornhub = {"key":"pornhub","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["You","Tube"],"args_type":null},"keywords":["ph","pornhub"],"shortcuts":[],"tags":[],"date_created":"2022-10-27T00:00:00","date_modified":"2023-02-14T00:00:00"};
const potato = {"key":"potato","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["土豆"],"shortcuts":[],"tags":[],"date_created":"2023-01-19T00:00:00","date_modified":"2023-02-14T00:00:00"};
const potato_mines = {"key":"potato_mines","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["土豆地雷"],"shortcuts":[],"tags":[],"date_created":"2025-09-03T00:00:00","date_modified":"2025-09-03T00:00:00"};
const pound = {"key":"pound","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捣"],"shortcuts":[],"tags":[],"date_created":"2022-03-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const pregnancy_test = {"key":"pregnancy_test","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["验孕棒"],"shortcuts":[],"tags":[],"date_created":"2025-07-16T00:00:00","date_modified":"2025-07-16T00:00:00"};
const printing = {"key":"printing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打印"],"shortcuts":[],"tags":[],"date_created":"2023-01-26T00:00:00","date_modified":"2023-02-14T00:00:00"};
const prpr = {"key":"prpr","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["舔","舔屏","prpr"],"shortcuts":[],"tags":[],"date_created":"2022-03-05T00:00:00","date_modified":"2023-02-14T00:00:00"};
const psyduck = {"key":"psyduck","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["来份","涩图"],"args_type":null},"keywords":["可达鸭"],"shortcuts":[],"tags":[],"date_created":"2022-06-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const punch = {"key":"punch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["打拳"],"shortcuts":[],"tags":[],"date_created":"2022-03-18T00:00:00","date_modified":"2023-02-14T00:00:00"};
const pyramid = {"key":"pyramid","params_type":{"min_images":1,"max_images":4,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["四棱锥","金字塔"],"shortcuts":[],"tags":[],"date_created":"2024-08-16T00:00:00","date_modified":"2024-08-18T00:00:00"};
const qi = {"key":"qi","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑"],"shortcuts":[],"tags":[],"date_created":"2021-05-04T00:00:00","date_modified":"2025-11-26T21:46:16.871656"};
const qian = {"key":"qian","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["牵","调教"],"shortcuts":[],"tags":["猫和老鼠","杰瑞"],"date_created":"2024-08-09T00:00:00","date_modified":"2024-08-09T00:00:00"};
const qiegewala = {"key":"qiegewala","params_type":{"min_images":0,"max_images":0,"min_texts":6,"max_texts":6,"default_texts":["没有钱啊 肯定要做的啊","不做的话没有钱用","那你不会去打工啊","有手有脚的","打工是不可能打工的","这辈子不可能打工的"],"args_type":null},"keywords":["切格瓦拉"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const qiejupai = {"key":"qiejupai","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["男銅！"],"args_type":null},"keywords":["企鹅举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-10-22T00:00:00","date_modified":"2025-10-22T00:00:00"};
const qilongwang = {"key":"qilongwang","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑龙王"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const qixi_festival = {"key":"qixi_festival","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["七夕和谁过","七夕和谁过?","七夕和谁过？"],"shortcuts":[],"tags":[],"date_created":"2025-08-28T00:00:00","date_modified":"2025-08-28T00:00:00"};
const qixiong = {"key":"qixiong","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑熊"],"shortcuts":[],"tags":[],"date_created":"2025-09-08T00:00:00","date_modified":"2025-09-08T00:00:00"};
const qizhu = {"key":"qizhu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["骑猪"],"shortcuts":[],"tags":[],"date_created":"2025-09-06T00:00:00","date_modified":"2025-09-06T00:00:00"};
const quilt = {"key":"quilt","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["被窝"],"shortcuts":[],"tags":[],"date_created":"2025-09-12T00:00:00","date_modified":"2025-09-12T00:00:00"};
const qunchao = {"key":"qunchao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["群嘲","笑他"],"shortcuts":[],"tags":[],"date_created":"2025-07-15T00:00:00","date_modified":"2025-07-15T00:00:00"};
const qunyoujupai = {"key":"qunyoujupai","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["我是晓楠嬢"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["群友举牌","他举牌","你举牌"],"shortcuts":[],"tags":["米哈游"],"date_created":"2025-06-10T00:00:00","date_modified":"2025-06-19T00:00:00"};
const qushi = {"key":"qushi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["去o屎"],"shortcuts":[],"tags":[],"date_created":"2025-10-30T00:00:00","date_modified":"2025-10-30T00:00:00"};
const rabbit = {"key":"rabbit","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["🐇","兔子","兔","兔耳帽"],"shortcuts":[],"tags":[],"date_created":"2025-08-17T00:00:00","date_modified":"2025-08-17T00:00:00"};
const raise_image = {"key":"raise_image","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["举"],"shortcuts":[],"tags":[],"date_created":"2023-08-09T00:00:00","date_modified":"2023-08-09T00:00:00"};
const raise_sign = {"key":"raise_sign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["大佬带带我"],"args_type":null},"keywords":["举牌"],"shortcuts":[],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const read_book = {"key":"read_book","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["エロ本"],"args_type":null},"keywords":["看书"],"shortcuts":[],"tags":[],"date_created":"2022-08-22T00:00:00","date_modified":"2023-10-25T00:00:00"};
const read_love_letters = {"key":"read_love_letters","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["看情书"],"shortcuts":[],"tags":[],"date_created":"2025-08-14T00:00:00","date_modified":"2025-08-14T00:00:00"};
const remote_control = {"key":"remote_control","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["遥控","控制"],"shortcuts":[],"tags":[],"date_created":"2025-03-04T00:00:00","date_modified":"2025-03-24T00:00:00"};
const rengshi = {"key":"rengshi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["扔屎"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const repeat = {"key":"repeat","params_type":{"min_images":1,"max_images":5,"min_texts":1,"max_texts":1,"default_texts":["救命啊"],"args_type":null},"keywords":["复读"],"shortcuts":[],"tags":[],"date_created":"2022-06-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const richu = {"key":"richu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["日出"],"shortcuts":[],"tags":[],"date_created":"2025-06-17T00:00:00","date_modified":"2025-06-17T00:00:00"};
const rip = {"key":"rip","params_type":{"min_images":1,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["撕"],"shortcuts":[],"tags":[],"date_created":"2021-05-05T00:00:00","date_modified":"2023-02-14T00:00:00"};
const rip_angrily = {"key":"rip_angrily","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["怒撕"],"shortcuts":[],"tags":[],"date_created":"2022-10-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const rip_clothes = {"key":"rip_clothes","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["撕衣服"],"shortcuts":[],"tags":[],"date_created":"2025-05-07T00:00:00","date_modified":"2025-06-03T00:00:00"};
const rise_dead = {"key":"rise_dead","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["诈尸","秽土转生"],"shortcuts":[],"tags":[],"date_created":"2022-11-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const roll = {"key":"roll","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["滚"],"shortcuts":[],"tags":[],"date_created":"2022-01-04T00:00:00","date_modified":"2023-02-14T00:00:00"};
const rotate_3d = {"key":"rotate_3d","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["三维旋转"],"shortcuts":[],"tags":[],"date_created":"2024-04-30T00:00:00","date_modified":"2024-04-30T00:00:00"};
const rub = {"key":"rub","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["贴","贴贴","蹭","蹭蹭"],"shortcuts":[],"tags":[],"date_created":"2021-06-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const rudong = {"key":"rudong","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["蠕动","磕头"],"shortcuts":[],"tags":[],"date_created":"2025-09-06T00:00:00","date_modified":"2025-09-06T00:00:00"};
const run = {"key":"run","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["快跑"],"args_type":null},"keywords":["快跑"],"shortcuts":[],"tags":[],"date_created":"2022-10-17T00:00:00","date_modified":"2023-02-14T00:00:00"};
const run_away = {"key":"run_away","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["快逃"],"shortcuts":[],"tags":["初音未来"],"date_created":"2024-07-23T00:00:00","date_modified":"2024-07-23T00:00:00"};
const run_with = {"key":"run_with","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拿着跑","抱着跑","带走"],"shortcuts":[],"tags":[],"date_created":"2025-10-25T00:00:00","date_modified":"2025-10-25T00:00:00"};
const rune = {"key":"rune","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["符咒"],"shortcuts":[],"tags":[],"date_created":"2025-09-09T00:00:00","date_modified":"2025-09-09T00:00:00"};
const safe_sense = {"key":"safe_sense","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["你给我的安全感\n远不及{ta}的万分之一"],"args_type":null},"keywords":["安全感"],"shortcuts":[],"tags":[],"date_created":"2022-03-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const saimin_app = {"key":"saimin_app","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["催眠app"],"shortcuts":[],"tags":[],"date_created":"2024-12-10T00:00:00","date_modified":"2024-12-10T00:00:00"};
const sayguaihua = {"key":"sayguaihua","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你好会上班哦~"],"args_type":null},"keywords":["说怪话","阴阳大师"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-09-29T00:00:00","date_modified":"2025-09-29T00:00:00"};
const sayhi = {"key":"sayhi","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["小奶龙"],"args_type":null},"keywords":["打招呼"],"shortcuts":[],"tags":[],"date_created":"2025-06-25T00:00:00","date_modified":"2025-06-25T00:00:00"};
const scissor_seven_head = {"key":"scissor_seven_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["伍六七","阿七"],"shortcuts":[],"tags":[],"date_created":"2025-07-02T00:00:00","date_modified":"2025-07-02T00:00:00"};
const scratch_head = {"key":"scratch_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["挠头"],"shortcuts":[],"tags":[],"date_created":"2023-01-07T00:00:00","date_modified":"2023-02-14T00:00:00"};
const scratchcard = {"key":"scratchcard","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["谢谢参与"],"args_type":null},"keywords":["刮刮乐"],"shortcuts":[],"tags":[],"date_created":"2022-10-05T00:00:00","date_modified":"2023-02-14T00:00:00"};
const scroll = {"key":"scroll","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你们说话啊"],"args_type":null},"keywords":["滚屏"],"shortcuts":[],"tags":[],"date_created":"2022-01-19T00:00:00","date_modified":"2023-02-14T00:00:00"};
const seal = {"key":"seal","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["源石封印"],"shortcuts":[],"tags":["明日方舟"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const sekaiichi_kawaii = {"key":"sekaiichi_kawaii","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["世界第一可爱"],"shortcuts":[],"tags":["学园偶像大师","藤田琴音"],"date_created":"2024-12-04T00:00:00","date_modified":"2024-12-04T00:00:00"};
const sending_love = {"key":"sending_love","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["比心"],"shortcuts":[],"tags":[],"date_created":"2025-09-12T00:00:00","date_modified":"2025-09-12T00:00:00"};
const shadow_boxing = {"key":"shadow_boxing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["太极"],"shortcuts":[],"tags":[],"date_created":"2025-05-14T00:00:00","date_modified":"2025-05-14T00:00:00"};
const shake_head = {"key":"shake_head","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["晃脑"],"shortcuts":[],"tags":[],"date_created":"2024-10-31T00:00:00","date_modified":"2024-10-31T00:00:00"};
const shamate = {"key":"shamate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["杀马特"],"shortcuts":[],"tags":[],"date_created":"2025-10-17T00:00:00","date_modified":"2025-10-17T00:00:00"};
const shikanoko_noko = {"key":"shikanoko_noko","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["鹿乃子乃子","鹿乃子"],"shortcuts":[],"tags":[],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const shipborne_laser_weapons = {"key":"shipborne_laser_weapons","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["舰载激光武器"],"shortcuts":[],"tags":[],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-21T00:00:00"};
const shiroko_pero = {"key":"shiroko_pero","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["白子舔"],"shortcuts":[],"tags":["蔚蓝档案","砂狼白子","碧蓝档案"],"date_created":"2024-08-10T00:00:00","date_modified":"2024-08-10T00:00:00"};
const shishilani = {"key":"shishilani","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["穿西装打领带","拿大哥大有什么用","跟着这样的大哥","食屎啦你"],"args_type":null},"keywords":["食屎啦你"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const shock = {"key":"shock","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["震惊"],"shortcuts":[],"tags":[],"date_created":"2022-03-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const shoot = {"key":"shoot","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["射","🐍"],"shortcuts":[],"tags":[],"date_created":"2024-08-19T00:00:00","date_modified":"2024-08-19T00:00:00"};
const shuai = {"key":"shuai","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["甩"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const shuaiqunwu = {"key":"shuaiqunwu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["甩裙舞"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const shuifandui = {"key":"shuifandui","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["我话说完了","谁赞成","谁反对","我反对"],"args_type":null},"keywords":["谁反对"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const shutup = {"key":"shutup","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你不要再说了"],"args_type":null},"keywords":["别说了"],"shortcuts":[],"tags":[],"date_created":"2022-01-19T00:00:00","date_modified":"2023-02-14T00:00:00"};
const sibalu = {"key":"sibalu","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["给你看个傻子"],"args_type":null},"keywords":["486"],"shortcuts":[],"tags":[],"date_created":"2025-07-09T00:00:00","date_modified":"2025-07-09T00:00:00"};
const sikete = {"key":"sikete","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["那我的屁股怎么办"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["斯科特"],"shortcuts":[],"tags":[],"date_created":"2025-07-13T00:00:00","date_modified":"2025-07-13T00:00:00"};
const sit_still = {"key":"sit_still","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["坐得住","坐的住"],"shortcuts":[],"tags":[],"date_created":"2022-12-03T00:00:00","date_modified":"2023-02-14T00:00:00"};
const sitdown_do = {"key":"sitdown_do","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["坐撅"],"shortcuts":[],"tags":[],"date_created":"2025-08-21T00:00:00","date_modified":"2025-09-04T00:00:00"};
const slacking_off = {"key":"slacking_off","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["摸鱼"],"shortcuts":[],"tags":[],"date_created":"2025-09-12T00:00:00","date_modified":"2025-09-12T00:00:00"};
const slap = {"key":"slap","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["一巴掌"],"shortcuts":[],"tags":[],"date_created":"2022-01-19T00:00:00","date_modified":"2023-02-14T00:00:00"};
const slipper = {"key":"slipper","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拖鞋"],"shortcuts":[],"tags":[],"date_created":"2025-05-13T00:00:00","date_modified":"2025-05-13T00:00:00"};
const slogan = {"key":"slogan","params_type":{"min_images":0,"max_images":0,"min_texts":6,"max_texts":6,"default_texts":["我们是谁？","浙大人！","到浙大来做什么？","混！","将来毕业后要做什么样的人？","混混！"],"args_type":null},"keywords":["口号"],"shortcuts":[],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const sm = {"key":"sm","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["sm"],"shortcuts":[],"tags":[],"date_created":"2025-05-13T00:00:00","date_modified":"2025-05-13T00:00:00"};
const small_hands = {"key":"small_hands","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["小手"],"shortcuts":[],"tags":[],"date_created":"2025-08-12T00:00:00","date_modified":"2025-08-12T00:00:00"};
const smash = {"key":"smash","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["砸"],"shortcuts":[],"tags":[],"date_created":"2022-11-29T00:00:00","date_modified":"2023-02-14T00:00:00"};
const sold_out = {"key":"sold_out","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["卖掉了"],"shortcuts":[],"tags":[],"date_created":"2024-11-18T00:00:00","date_modified":"2024-11-18T00:00:00"};
const speechless = {"key":"speechless","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["无语"],"shortcuts":[{"key":"(?P<text>典型的\\S+思维)","args":["{text}"],"humanized":"典型的xx思维"}],"tags":[],"date_created":"2024-11-12T00:00:00","date_modified":"2024-11-12T00:00:00"};
const spend_christmas = {"key":"spend_christmas","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["一起圣诞"],"shortcuts":[],"tags":[],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const sphere_rotate = {"key":"sphere_rotate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["球面旋转"],"shortcuts":[],"tags":[],"date_created":"2025-07-06T00:00:00","date_modified":"2025-07-06T00:00:00"};
const spider = {"key":"spider","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["蜘蛛","蜘蛛爬"],"shortcuts":[],"tags":[],"date_created":"2025-04-27T00:00:00","date_modified":"2025-04-27T00:00:00"};
const spike_spinebuster = {"key":"spike_spinebuster","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["斯派克抱摔"],"shortcuts":[],"tags":[],"date_created":"2025-05-27T00:00:00","date_modified":"2025-05-27T00:00:00"};
const spinner = {"key":"spinner","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["陀螺"],"shortcuts":[],"tags":[],"date_created":"2025-05-13T00:00:00","date_modified":"2025-05-19T00:00:00"};
const stare_at_you = {"key":"stare_at_you","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["盯着你"],"shortcuts":[],"tags":[],"date_created":"2025-01-28T00:00:00","date_modified":"2025-02-02T00:00:00"};
const steam_message = {"key":"steam_message","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["黑神话：悟空"],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["steam消息"],"shortcuts":[{"key":"(?P<name>\\S+)正在玩(?P<game>\\S+)","args":["--name","{name}","{game}"],"humanized":"xx正在玩xx"}],"tags":[],"date_created":"2024-08-21T00:00:00","date_modified":"2024-08-21T00:00:00"};
const step_on = {"key":"step_on","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["踩"],"shortcuts":[],"tags":[],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const stew = {"key":"stew","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["炖"],"shortcuts":[],"tags":[],"date_created":"2024-01-19T00:00:00","date_modified":"2024-01-19T00:00:00"};
const stickman_dancing = {"key":"stickman_dancing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳舞","火柴人跳舞"],"shortcuts":[],"tags":["火柴人"],"date_created":"2025-04-30T00:00:00","date_modified":"2025-04-30T00:00:00"};
const stretch = {"key":"stretch","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["双手","伸展"],"shortcuts":[],"tags":[],"date_created":"2023-03-28T00:00:00","date_modified":"2023-03-28T00:00:00"};
const subject3 = {"key":"subject3","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["科目三"],"shortcuts":[],"tags":[],"date_created":"2024-04-17T00:00:00","date_modified":"2024-04-17T00:00:00"};
const suck = {"key":"suck","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["吸","嗦"],"shortcuts":[],"tags":[],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const sunflower = {"key":"sunflower","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["太阳花"],"shortcuts":[],"tags":[],"date_created":"2025-05-14T00:00:00","date_modified":"2025-05-14T00:00:00"};
const support = {"key":"support","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["精神支柱"],"shortcuts":[],"tags":[],"date_created":"2021-05-05T00:00:00","date_modified":"2023-02-14T00:00:00"};
const swimsuit_group_photo = {"key":"swimsuit_group_photo","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["泳衣合影","比基尼合影"],"shortcuts":[],"tags":[],"date_created":"2025-05-25T00:00:00","date_modified":"2025-09-05T00:00:00"};
const swirl_turn = {"key":"swirl_turn","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["回旋转","旋风转"],"shortcuts":[],"tags":[],"date_created":"2024-05-07T00:00:00","date_modified":"2024-05-07T00:00:00"};
const symmetric = {"key":"symmetric","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"direction":{"default":"left","description":"对称方向，包含 left、right、top、bottom","enum":["left","right","top","bottom"],"title":"Direction","type":"string"}},"title":"Model","type":"object"},"args_examples":[{"user_infos":[],"direction":"left"},{"user_infos":[],"direction":"right"},{"user_infos":[],"direction":"top"},{"user_infos":[],"direction":"bottom"}],"parser_options":[{"names":["-d","--direction"],"args":[{"name":"direction","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"对称方向，包含 left、right、top、bottom","compact":false},{"names":["--left","左"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"left"},"help_text":null,"compact":false},{"names":["--right","右"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"right"},"help_text":null,"compact":false},{"names":["--top","上"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"top"},"help_text":null,"compact":false},{"names":["--bottom","下"],"args":null,"dest":"direction","default":null,"action":{"type":0,"value":"bottom"},"help_text":null,"compact":false}]}},"keywords":["对称"],"shortcuts":[],"tags":[],"date_created":"2022-03-14T00:00:00","date_modified":"2023-02-14T00:00:00"};
const tankuku_raisesign = {"key":"tankuku_raisesign","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["唐可可举牌"],"shortcuts":[],"tags":["唐可可","LoveLive!Superstar!!"],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const taunt = {"key":"taunt","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["嘲讽"],"shortcuts":[],"tags":[],"date_created":"2023-07-19T00:00:00","date_modified":"2023-07-19T00:00:00"};
const teach = {"key":"teach","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["我老婆"],"args_type":null},"keywords":["讲课","敲黑板"],"shortcuts":[],"tags":["井之上泷奈","莉可丽丝"],"date_created":"2022-08-16T00:00:00","date_modified":"2023-02-14T00:00:00"};
const tease = {"key":"tease","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拿捏","戏弄"],"shortcuts":[],"tags":["蔚蓝档案","碧蓝档案"],"date_created":"2023-06-27T00:00:00","date_modified":"2023-06-27T00:00:00"};
const telescope = {"key":"telescope","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["望远镜"],"shortcuts":[],"tags":[],"date_created":"2024-01-18T00:00:00","date_modified":"2024-01-18T00:00:00"};
const thermometer_gun = {"key":"thermometer_gun","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["笨蛋"],"args_type":null},"keywords":["体温枪"],"shortcuts":[],"tags":[],"date_created":"2024-09-03T00:00:00","date_modified":"2024-09-03T00:00:00"};
const think_what = {"key":"think_what","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["想什么"],"shortcuts":[],"tags":[],"date_created":"2022-05-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const this_chicken = {"key":"this_chicken","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["这是十二生肖中的鸡"],"args_type":null},"keywords":["这是鸡","🐔"],"shortcuts":[],"tags":[],"date_created":"2023-11-12T00:00:00","date_modified":"2024-01-18T00:00:00"};
const throw_gif = {"key":"throw_gif","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["抛","掷"],"shortcuts":[],"tags":[],"date_created":"2022-03-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const throwing_poop = {"key":"throwing_poop","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["扔史"],"shortcuts":[],"tags":[],"date_created":"2025-09-21T00:00:00","date_modified":"2025-09-23T00:00:00"};
const thump = {"key":"thump","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捶"],"shortcuts":[],"tags":[],"date_created":"2022-03-30T00:00:00","date_modified":"2023-02-14T00:00:00"};
const thump_wildly = {"key":"thump_wildly","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["捶爆","爆捶"],"shortcuts":[],"tags":["明日方舟"],"date_created":"2023-03-31T00:00:00","date_modified":"2023-03-31T00:00:00"};
const tiaopi = {"key":"tiaopi","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳劈","敲死你"],"shortcuts":[],"tags":[],"date_created":"2025-11-07T00:00:00","date_modified":"2025-11-07T00:00:00"};
const tiaosheng = {"key":"tiaosheng","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳绳"],"shortcuts":[],"tags":[],"date_created":"2025-10-20T00:00:00","date_modified":"2025-10-20T00:00:00"};
const tiaowu_mao = {"key":"tiaowu_mao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["跳舞猫","跳舞","猫猫舞","舞蹈猫"],"shortcuts":[],"tags":[],"date_created":"2025-11-01T00:00:00","date_modified":"2023-11-01T00:00:00"};
const tightly = {"key":"tightly","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["紧贴","紧紧贴着"],"shortcuts":[],"tags":[],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const time_to_go = {"key":"time_to_go","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["说完了吗？该走了"],"args_type":null},"keywords":["该走了"],"shortcuts":[],"tags":[],"date_created":"2024-09-04T00:00:00","date_modified":"2024-09-04T00:00:00"};
const together = {"key":"together","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["一起玩{name}吧！"],"args_type":null},"keywords":["一起"],"shortcuts":[],"tags":[],"date_created":"2022-10-13T00:00:00","date_modified":"2023-03-29T00:00:00"};
const together_two = {"key":"together_two","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["在一起"],"shortcuts":[],"tags":[],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const tom_tease = {"key":"tom_tease","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["汤姆嘲笑"],"shortcuts":[],"tags":["猫和老鼠","汤姆"],"date_created":"2024-01-19T00:00:00","date_modified":"2024-01-19T00:00:00"};
const tomb_yeah = {"key":"tomb_yeah","params_type":{"min_images":1,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["上坟","坟前比耶"],"shortcuts":[],"tags":[],"date_created":"2023-11-12T00:00:00","date_modified":"2023-11-12T00:00:00"};
const top_notch = {"key":"top_notch","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["运营"],"args_type":null},"keywords":["顶尖"],"shortcuts":[],"tags":[],"date_created":"2024-08-17T00:00:00","date_modified":"2024-08-17T00:00:00"};
const torture_yourself = {"key":"torture_yourself","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["折磨自己"],"shortcuts":[],"tags":[],"date_created":"2025-05-25T00:00:00","date_modified":"2025-09-04T00:00:00"};
const trance = {"key":"trance","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["恍惚"],"shortcuts":[],"tags":[],"date_created":"2022-12-11T00:00:00","date_modified":"2023-02-14T00:00:00"};
const trolley = {"key":"trolley","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["推车"],"shortcuts":[],"tags":[],"date_created":"2025-04-12T00:00:00","date_modified":"2025-04-12T00:00:00"};
const tuo_laji = {"key":"tuo_laji","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["拖垃圾","拖垃圾车","垃圾车"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const turn = {"key":"turn","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["转"],"shortcuts":[],"tags":[],"date_created":"2022-01-01T00:00:00","date_modified":"2024-09-30T00:00:00"};
const turtle_jue = {"key":"turtle_jue","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["龟龟撅"],"shortcuts":[],"tags":[],"date_created":"2025-05-12T00:00:00","date_modified":"2025-05-12T00:00:00"};
const twist = {"key":"twist","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["搓"],"shortcuts":[],"tags":[],"date_created":"2022-03-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const universal = {"key":"universal","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":10,"default_texts":["在此处添加文字"],"args_type":null},"keywords":["万能表情","空白表情"],"shortcuts":[],"tags":[],"date_created":"2022-04-20T00:00:00","date_modified":"2023-02-14T00:00:00"};
const upside_down = {"key":"upside_down","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["我看你们是反了！"],"args_type":null},"keywords":["反了"],"shortcuts":[],"tags":[],"date_created":"2024-10-12T00:00:00","date_modified":"2024-10-12T00:00:00"};
const vibrate = {"key":"vibrate","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["震动"],"shortcuts":[],"tags":[],"date_created":"2023-08-28T00:00:00","date_modified":"2023-08-28T00:00:00"};
const vme50 = {"key":"vme50","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["V我50","v我50"],"shortcuts":[],"tags":[],"date_created":"2025-07-11T00:00:00","date_modified":"2025-07-11T00:00:00"};
const vni50 = {"key":"vni50","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["给你V50"],"args_type":null},"keywords":["v你50"],"shortcuts":[],"tags":[],"date_created":"2025-08-07T00:00:00","date_modified":"2025-08-07T00:00:00"};
const wakeup = {"key":"wakeup","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["好"],"args_type":null},"keywords":["好起来了"],"shortcuts":[{"key":"(?P<text>\\S{1,4})\\s+起来了","args":["{text}"],"humanized":"xx 起来了"}],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wallpaper = {"key":"wallpaper","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["墙纸"],"shortcuts":[],"tags":["瑞克·桑切斯","瑞克和莫蒂"],"date_created":"2022-03-09T00:00:00","date_modified":"2023-02-14T00:00:00"};
const walnut_pad = {"key":"walnut_pad","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["胡桃平板"],"shortcuts":[],"tags":["胡桃","莉可丽丝"],"date_created":"2022-08-07T00:00:00","date_modified":"2023-02-14T00:00:00"};
const walnut_zoom = {"key":"walnut_zoom","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["胡桃放大"],"shortcuts":[],"tags":["胡桃","莉可丽丝"],"date_created":"2022-10-01T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wang = {"key":"wang","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["王"],"shortcuts":[],"tags":[],"date_created":"2025-10-30T00:00:00","date_modified":"2025-10-30T00:00:00"};
const wangjingze = {"key":"wangjingze","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["我就是饿死","死外边 从这里跳下去","不会吃你们一点东西","真香"],"args_type":null},"keywords":["王境泽"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wanhuo = {"key":"wanhuo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["玩火"],"shortcuts":[],"tags":[],"date_created":"2025-09-06T00:00:00","date_modified":"2025-09-06T00:00:00"};
const washer = {"key":"washer","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["洗衣机"],"shortcuts":[],"tags":[],"date_created":"2024-01-18T00:00:00","date_modified":"2024-01-18T00:00:00"};
const wave = {"key":"wave","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["波纹"],"shortcuts":[],"tags":[],"date_created":"2022-10-26T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wechat_pay = {"key":"wechat_pay","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"message":{"default":"","description":"二维码内容","title":"Message","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-m","--message"],"args":[{"name":"message","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"二维码内容","compact":false}]}},"keywords":["微信支付"],"shortcuts":[],"tags":[],"date_created":"2024-10-30T00:00:00","date_modified":"2024-10-30T00:00:00"};
const weisuoyuwei = {"key":"weisuoyuwei","params_type":{"min_images":0,"max_images":0,"min_texts":9,"max_texts":9,"default_texts":["好啊","就算你是一流工程师","就算你出报告再完美","我叫你改报告你就要改","毕竟我是客户","客户了不起啊","Sorry 客户真的了不起","以后叫他天天改报告","天天改 天天改"],"args_type":null},"keywords":["为所欲为"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const what_I_want_to_do = {"key":"what_I_want_to_do","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["我想上的"],"shortcuts":[],"tags":[],"date_created":"2023-07-19T00:00:00","date_modified":"2023-07-19T00:00:00"};
const what_he_wants = {"key":"what_he_wants","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["今年520"],"args_type":null},"keywords":["最想要的东西"],"shortcuts":[],"tags":[],"date_created":"2023-05-20T00:00:00","date_modified":"2023-05-20T00:00:00"};
const whisper = {"key":"whisper","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["窃窃私语"],"shortcuts":[],"tags":[],"date_created":"2025-08-11T00:00:00","date_modified":"2025-08-11T00:00:00"};
const why_at_me = {"key":"why_at_me","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["为什么@我"],"shortcuts":[],"tags":["东方Project"],"date_created":"2022-04-14T00:00:00","date_modified":"2023-05-03T00:00:00"};
const why_have_hands = {"key":"why_have_hands","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["为什么要有手"],"shortcuts":[],"tags":[],"date_created":"2023-05-18T00:00:00","date_modified":"2023-05-18T00:00:00"};
const widow = {"key":"widow","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["未亡人"],"shortcuts":[],"tags":[],"date_created":"2025-08-13T00:00:00","date_modified":"2025-08-13T00:00:00"};
const windmill_turn = {"key":"windmill_turn","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["风车转"],"shortcuts":[],"tags":[],"date_created":"2022-12-13T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wish_fail = {"key":"wish_fail","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["我要对象"],"args_type":null},"keywords":["许愿失败"],"shortcuts":[],"tags":[],"date_created":"2022-10-21T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wolaile = {"key":"wolaile","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["我来了","我来啦","我来辣","芜湖"],"shortcuts":[],"tags":[],"date_created":"2025-09-13T00:00:00","date_modified":"2025-09-13T00:00:00"};
const wooden_fish = {"key":"wooden_fish","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["木鱼"],"shortcuts":[],"tags":[],"date_created":"2022-11-16T00:00:00","date_modified":"2023-02-14T00:00:00"};
const worship = {"key":"worship","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["膜","膜拜"],"shortcuts":[],"tags":[],"date_created":"2022-02-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const woyouyijian = {"key":"woyouyijian","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["我有意见","有意见"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const wudizhen = {"key":"wudizhen","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["无敌帧"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wujing = {"key":"wujing","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["不买华为不是","人"],"args_type":null},"keywords":["吴京中国"],"shortcuts":[{"key":"吴京[\\s:：]*(?P<left>\\S*)中国(?P<right>\\S*)","args":["{left}","{right}"],"humanized":"吴京xx中国xx"}],"tags":[],"date_created":"2022-06-12T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wunian = {"key":"wunian","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["五年","你知道我这五年是怎么过的吗","我每天躲在家里玩贪玩蓝月","你知道有多好玩吗"],"args_type":null},"keywords":["五年怎么过的"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const wuyage = {"key":"wuyage","params_type":{"min_images":0,"max_images":0,"min_texts":3,"max_texts":3,"default_texts":["哟 云崽机器人","今天掉线了没","来给他弹个版本过低"],"args_type":null},"keywords":["乌鸦哥"],"shortcuts":[],"tags":[],"date_created":"2024-12-05T00:00:00","date_modified":"2024-12-05T00:00:00"};
const wuyingtui = {"key":"wuyingtui","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["无影腿"],"shortcuts":[],"tags":[],"date_created":"2025-05-21T00:00:00","date_modified":"2025-05-21T00:00:00"};
const xiatou = {"key":"xiatou","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["这个群友，蒸丅亠！"],"args_type":null},"keywords":["丅亠"],"shortcuts":[],"tags":[],"date_created":"2025-05-22T00:00:00","date_modified":"2025-05-22T00:00:00"};
const xile = {"key":"xile","params_type":{"min_images":1,"max_images":1,"min_texts":1,"max_texts":1,"default_texts":["救我，我要洗了"],"args_type":null},"keywords":["洗了"],"shortcuts":[],"tags":[],"date_created":"2025-05-21T00:00:00","date_modified":"2025-05-21T00:00:00"};
const xiluo_disgust = {"key":"xiluo_disgust","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["希罗嫌弃","二阶堂希罗嫌弃"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const xiongqi = {"key":"xiongqi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["熊骑"],"shortcuts":[],"tags":[],"date_created":"2025-09-08T00:00:00","date_modified":"2025-09-08T00:00:00"};
const xueli_say = {"key":"xueli_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["你是高手？"],"args_type":null},"keywords":["雪莉说","雪梨说","橘雪莉说"],"shortcuts":[],"tags":[],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const xueli_think = {"key":"xueli_think","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["雪莉想","雪梨想","橘雪莉想"],"shortcuts":[],"tags":["鸣潮"],"date_created":"2025-10-05T00:00:00","date_modified":"2025-10-05T00:00:00"};
const yalidaye = {"key":"yalidaye","params_type":{"min_images":0,"max_images":0,"min_texts":3,"max_texts":3,"default_texts":["外界都说我们压力大","我觉得吧压力也没有那么大","主要是28岁了还没媳妇儿"],"args_type":null},"keywords":["压力大爷"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const yao = {"key":"yao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["摇"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const yes = {"key":"yes","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["yes","Yes","YES"],"shortcuts":[],"tags":[],"date_created":"2025-08-19T00:00:00","date_modified":"2025-08-19T00:00:00"};
const yeshu = {"key":"yeshu","params_type":{"min_images":0,"max_images":0,"min_texts":8,"max_texts":8,"default_texts":["椰子特产在海南","正宗","椰树","29年","坚持在海南岛","用新鲜椰子肉","鲜榨","不用椰浆\n不加香精当生榨"],"args_type":null},"keywords":["椰树椰汁"],"shortcuts":[],"tags":[],"date_created":"2024-11-05T00:00:00","date_modified":"2024-11-05T00:00:00"};
const yesirmiao = {"key":"yesirmiao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["敬礼喵"],"shortcuts":[],"tags":[],"date_created":"2025-05-28T00:00:00","date_modified":"2025-05-28T00:00:00"};
const yo_yo = {"key":"yo_yo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["yoyo"],"shortcuts":[],"tags":[],"date_created":"2025-05-15T00:00:00","date_modified":"2025-05-15T00:00:00"};
const you_dont_get = {"key":"you_dont_get","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["你不懂啦"],"shortcuts":[],"tags":["猫猫虫","咖波"],"date_created":"2025-05-15T00:00:00","date_modified":"2025-05-15T00:00:00"};
const you_should_call = {"key":"you_should_call","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["致电","你应该致电"],"shortcuts":[],"tags":[],"date_created":"2024-07-26T00:00:00","date_modified":"2024-07-26T00:00:00"};
const your_new_years_eve = {"key":"your_new_years_eve","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["你的跨年"],"shortcuts":[],"tags":[],"date_created":"2024-12-31T00:00:00","date_modified":"2024-12-31T00:00:00"};
const youtube = {"key":"youtube","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["Porn","Hub"],"args_type":null},"keywords":["yt","youtube"],"shortcuts":[],"tags":[],"date_created":"2022-10-27T00:00:00","date_modified":"2023-02-14T00:00:00"};
const yuanshen = {"key":"yuanshen","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["缘神"],"shortcuts":[],"tags":[],"date_created":"2025-08-29T00:00:00","date_modified":"2025-08-29T00:00:00"};
const yuwangwa = {"key":"yuwangwa","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["渔网袜","黑丝"],"shortcuts":[],"tags":[],"date_created":"2025-11-06T00:00:00","date_modified":"2025-11-06T00:00:00"};
const yuzu_soft_ayachi_nene = {"key":"yuzu_soft_ayachi_nene","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["宁宁困惑","绫地宁宁困惑"],"shortcuts":[],"tags":["绫地宁宁","魔女的夜宴","柚子社"],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const yuzu_soft_ciallo = {"key":"yuzu_soft_ciallo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["ciallo","ciallo~"],"shortcuts":[{"key":"(?i)ciallo","args":[],"humanized":"ciallo"},{"key":"(?i)ciallo～\\(∠・ω< \\)⌒[★☆]","args":[],"humanized":"ciallo～(∠・ω< )⌒★"}],"tags":["柚子社"],"date_created":"2025-09-05T00:00:00","date_modified":"2025-09-25T00:00:00"};
const yuzu_soft_holdsign = {"key":"yuzu_soft_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["不要再涩涩了"],"args_type":null},"keywords":["柚子厨举牌"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const yuzu_soft_mako_hitachi_holdsign = {"key":"yuzu_soft_mako_hitachi_holdsign","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["Ciallo～"],"args_type":null},"keywords":["常陸茉子举牌","茉子举牌","常陆茉子举牌"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-05-17T00:00:00","date_modified":"2025-05-17T00:00:00"};
const yuzu_soft_murasame_blackboard = {"key":"yuzu_soft_murasame_blackboard","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["不要再涩涩了"],"args_type":null},"keywords":["丛雨黑板"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const yuzu_soft_murasame_clothes = {"key":"yuzu_soft_murasame_clothes","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["丛雨衣服","丛雨衣物"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-03-24T00:00:00","date_modified":"2025-03-24T00:00:00"};
const yuzu_soft_murasame_dislike = {"key":"yuzu_soft_murasame_dislike","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["丛雨讨厌这个"],"args_type":null},"keywords":["丛雨讨厌"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const yuzu_soft_murasame_finger = {"key":"yuzu_soft_murasame_finger","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["柚子厨","丛雨指"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-07-26T00:00:00","date_modified":"2025-05-25T00:00:00"};
const yuzu_soft_murasame_husband = {"key":"yuzu_soft_murasame_husband","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["丛雨老公"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-07-26T00:00:00","date_modified":"2025-05-25T00:00:00"};
const yuzu_soft_murasame_ipad = {"key":"yuzu_soft_murasame_ipad","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["丛雨平板"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-06-20T00:00:00","date_modified":"2025-06-20T00:00:00"};
const yuzu_soft_murasame_like = {"key":"yuzu_soft_murasame_like","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["丛雨喜欢这个"],"args_type":null},"keywords":["丛雨喜欢"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-05-25T00:00:00","date_modified":"2025-05-25T00:00:00"};
const yuzu_soft_murasame_say = {"key":"yuzu_soft_murasame_say","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["非酋，不要再涩涩了"],"args_type":null},"keywords":["丛雨说"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-12-21T00:00:00","date_modified":"2024-12-21T00:00:00"};
const yuzu_soft_shocked = {"key":"yuzu_soft_shocked","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["震惊柚子厨"],"shortcuts":[],"tags":["柚子社"],"date_created":"2024-07-26T00:00:00","date_modified":"2025-05-25T00:00:00"};
const yuzu_soft_ticket = {"key":"yuzu_soft_ticket","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":[],"args_type":null},"keywords":["准考证"],"shortcuts":[],"tags":["柚子社"],"date_created":"2025-06-07T00:00:00","date_modified":"2025-06-07T00:00:00"};
const yys_yuanjieshenjupai = {"key":"yys_yuanjieshenjupai","params_type":{"min_images":0,"max_images":0,"min_texts":1,"max_texts":1,"default_texts":["阴阳师，启动！"],"args_type":null},"keywords":["缘结神举牌"],"shortcuts":[],"tags":["布洛妮娅·扎伊切克","崩坏3","米哈游"],"date_created":"2025-10-13T00:00:00","date_modified":"2025-10-13T00:00:00"};
const yys_yuanjieshenpeng = {"key":"yys_yuanjieshenpeng","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["大宝贝！"],"args_type":null},"keywords":["缘结神举","缘结神捧"],"shortcuts":[],"tags":[],"date_created":"2025-10-13T00:00:00","date_modified":"2025-10-13T00:00:00"};
const zaoleipi = {"key":"zaoleipi","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["遭雷劈","电"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const zengxiaoxian = {"key":"zengxiaoxian","params_type":{"min_images":0,"max_images":0,"min_texts":4,"max_texts":4,"default_texts":["平时你打电子游戏吗","偶尔","星际还是魔兽","连连看"],"args_type":null},"keywords":["曾小贤"],"shortcuts":[],"tags":[],"date_created":"2021-12-24T00:00:00","date_modified":"2023-02-14T00:00:00"};
const zhebianqing = {"key":"zhebianqing","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["这边请"],"shortcuts":[],"tags":[],"date_created":"2022-03-10T00:00:00","date_modified":"2023-02-14T00:00:00"};
const zheng_zai_zhao_ni = {"key":"zheng_zai_zhao_ni","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":1,"default_texts":["⭕🈸"],"args_type":null},"keywords":["正在找你"],"shortcuts":[],"tags":[],"date_created":"2025-09-10T00:00:00","date_modified":"2025-09-10T00:00:00"};
const zhiyexuanshou = {"key":"zhiyexuanshou","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":{"args_model":{"$defs":{"UserInfo":{"properties":{"name":{"default":"","title":"Name","type":"string"},"gender":{"default":"unknown","enum":["male","female","unknown"],"title":"Gender","type":"string"}},"title":"UserInfo","type":"object"}},"properties":{"user_infos":{"default":[],"items":{"$ref":"#/$defs/UserInfo"},"title":"User Infos","type":"array"},"name":{"default":"","description":"指定名字","title":"Name","type":"string"}},"title":"Model","type":"object"},"args_examples":[],"parser_options":[{"names":["-n","--name"],"args":[{"name":"name","value":"str","default":null,"flags":null}],"dest":null,"default":null,"action":null,"help_text":"指定名字","compact":false}]}},"keywords":["职业选手"],"shortcuts":[],"tags":[],"date_created":"2025-09-11T00:00:00","date_modified":"2025-09-11T00:00:00"};
const zhongcheng = {"key":"zhongcheng","params_type":{"min_images":1,"max_images":2,"min_texts":0,"max_texts":1,"default_texts":["华为"],"args_type":null},"keywords":["忠诚"],"shortcuts":[],"tags":[],"date_created":"2025-06-23T00:00:00","date_modified":"2025-06-23T00:00:00"};
const zhuishamiao = {"key":"zhuishamiao","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["追杀喵"],"shortcuts":[],"tags":[],"date_created":"2025-05-28T00:00:00","date_modified":"2025-05-28T00:00:00"};
const zhuwu = {"key":"zhuwu","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["猪舞"],"shortcuts":[],"tags":[],"date_created":"2025-10-25T00:00:00","date_modified":"2025-10-25T00:00:00"};
const zixingche = {"key":"zixingche","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["自行车"],"shortcuts":[],"tags":[],"date_created":"2023-01-08T00:00:00","date_modified":"2023-02-14T00:00:00"};
const zuini = {"key":"zuini","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["嘴你"],"shortcuts":[],"tags":[],"date_created":"2025-06-11T00:00:00","date_modified":"2025-06-11T00:00:00"};
const zuo = {"key":"zuo","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["坐","镇压"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"};
const zuoyizuo = {"key":"zuoyizuo","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["唑一唑"],"shortcuts":[],"tags":[],"date_created":"2025-06-17T00:00:00","date_modified":"2025-06-17T00:00:00"};
const zzdd = {"key":"zzdd","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["指指点点"],"shortcuts":[],"tags":[],"date_created":"2025-07-03T00:00:00","date_modified":"2025-07-03T00:00:00"};
const MEME_DATA = {
  "5000choyen": {"key":"5000choyen","params_type":{"min_images":0,"max_images":0,"min_texts":2,"max_texts":2,"default_texts":["我去","洛天依"],"args_type":null},"keywords":["5000兆"],"shortcuts":[],"tags":[],"date_created":"2022-10-29T00:00:00","date_modified":"2024-11-02T00:00:00"},
  a_jj_play_baseball,
  abstinence,
  acacia_anan_holdsign,
  accelerate,
  ace_attorney_dialog,
  acg_entrance,
  add_chaos,
  addiction,
  admission_letter,
  adoption,
  ai_ace,
  aichuai,
  aima_say,
  alike,
  alipay,
  all_the_days,
  allegiance,
  always,
  always_like,
  anan_hs,
  andwho,
  anmo,
  anti_kidnap,
  anya_suki,
  anyliew_struggling,
  applaud,
  arona_throw,
  ascension,
  ask,
  atri_finger,
  atri_holdsign,
  atri_like,
  atri_pillow,
  ayachi_holdsign,
  azur_lane_cheshire_thumbs_up,
  ba_say,
  baby,
  back_to_work,
  backflip,
  bad_news,
  baipiaoguai,
  beat_head,
  beat_up,
  beg_foster_care,
  begged_me,
  behead,
  beloveds,
  big_do,
  big_eagle_cute_girl,
  bite,
  blamed_mahiro,
  blood_pressure,
  bluearchive,
  bocchi_draft,
  bonfire_dance,
  bronya_holdsign,
  bubble_tea,
  bully_me,
  buyaolian,
  cairen,
  call_110,
  can_can_need,
  caosini,
  capoo_draw,
  capoo_fished_out,
  capoo_love,
  capoo_point,
  capoo_qunou,
  capoo_rip,
  capoo_rub,
  capoo_say,
  capoo_smash_egg,
  capoo_stew,
  capoo_strike,
  capoo_take_dump,
  capoo_take_sleep,
  capoo_take_smash,
  capooplay,
  capoozhao,
  captain,
  cat_lick,
  cat_scratch,
  caused_by_this,
  certificate,
  cha,
  chanshenzi,
  charpic,
  chase_train,
  chiikawa,
  chillet_deer,
  china_flag,
  chino_throw,
  chiwoyichui,
  chuai,
  chuangfei,
  chuanmama,
  chuini,
  chuosini,
  cinderella_eat,
  clauvio_twist,
  clown,
  clown_mask,
  clownish,
  cockroaches,
  confuse,
  contract,
  cooking,
  coupon,
  cover_face,
  crawl,
  cyan,
  dafen,
  daobao,
  daomaoyan,
  daqi,
  daxiaojiejiadao,
  daynight,
  decent_kiss,
  deer_help,
  deer_plan,
  deer_time,
  dianzhongdian,
  dieluohan,
  dinosaur,
  dinosaur_head,
  distracted,
  diucat,
  divorce,
  "do": {"key":"do","params_type":{"min_images":2,"max_images":2,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["撅","狠狠地撅"],"shortcuts":[],"tags":[],"date_created":"2023-03-07T00:00:00","date_modified":"2023-03-07T00:00:00"},
  dog_dislike,
  dog_ear_hat,
  dog_girl,
  dog_of_vtb,
  dont_go_near,
  dont_press,
  dont_touch,
  doro_contact,
  doro_dear,
  doro_kiss,
  doro_knight,
  doro_lick,
  doro_openlight,
  doro_orange,
  doro_surrounding_photos,
  doro_thumbs_up,
  doro_trampoline,
  doro_work_for_you,
  dorochou,
  dorochui,
  dorojupai,
  doroqi,
  doroti,
  dorotuodi,
  dorowaimai,
  doroya,
  douyin,
  downban,
  drag_trash,
  dragon_hand,
  drumstick,
  duidi,
  durian,
  eat,
  electrify_you,
  empathy,
  emperor_dragon,
  erciyuan,
  erised_mirror,
  estrous,
  fade_away,
  family_know,
  fanatic,
  fart,
  father_work,
  fbi_photo,
  feizhaiking,
  fencing,
  fever,
  fight_with_sunuo,
  fill_head,
  find_chips,
  firefly_holdsign,
  fireworks_head,
  fishing,
  flash_blind,
  fleshlight,
  fleshlight_air_play,
  fleshlight_angel,
  fleshlight_cleaning_liquid,
  fleshlight_commemorative_edition_saint_sister,
  fleshlight_hoshino_alice,
  fleshlight_idol_heartbeat,
  fleshlight_jissbon,
  fleshlight_kuileishushi,
  fleshlight_limited_edition_saint_sister,
  fleshlight_machinery,
  fleshlight_mengxin_packs,
  fleshlight_miyuko_kamimiya,
  fleshlight_mizuki_shiranui,
  fleshlight_nrn,
  fleshlight_pure_buttocks,
  fleshlight_purple_spirit,
  fleshlight_qiaobenyouxi,
  fleshlight_random,
  fleshlight_saint_sister,
  fleshlight_saki_haruna,
  fleshlight_selena,
  fleshlight_starter_pack,
  fleshlight_summer_liuli_zi,
  fleshlight_taimanin_asgi,
  fleshlight_xingnai,
  flick,
  flush,
  fogging,
  follow,
  fontqu_smile,
  forbid,
  frieren_take,
  fulilianv50,
  funny_mirror,
  garbage,
  gejiji,
  gemen_hug,
  genshin_eat,
  genshin_start,
  get_up,
  gong_xi_fa_cai,
  gongzei,
  good_news,
  google,
  google_captcha,
  gorilla_throw,
  goujiao,
  grab,
  guan_bingxiang,
  guichu,
  gulaojupai,
  gun,
  hammer,
  handwriting,
  happy_mid_autumn_festival,
  happy_national_day,
  happy_new_year,
  haruhi_raise,
  heartbeat,
  heike,
  hendo,
  henqi,
  high_EQ,
  hit_screen,
  hitachi_mako_together,
  hold_grudge,
  hold_tight,
  horse_riding,
  houminghao,
  huanying,
  huanying2,
  huanyingchuo,
  hug,
  hug_leg,
  huochailu,
  hutao_bite,
  ice_tea_head,
  ignite,
  ikun_basketball,
  ikun_durian_head,
  ikun_head,
  ikun_like,
  ikun_need_tv,
  ikun_why_are_you,
  imprison,
  incivilization,
  intel_inside,
  interaction,
  interview,
  izumi_sagiri_painting,
  jd_delivery_person,
  jd_takeout,
  jerk_off,
  jerry_stare,
  jiamianqishi,
  jianpanxia,
  jibao,
  jiji_king,
  jinhsi,
  jiubingfufa,
  jiujiu,
  jiumi,
  jump,
  juwu,
  kaleidoscope,
  karyl_point,
  kawa,
  keep_away,
  keep_your_money,
  keliplay,
  kfc,
  kfc_thursday,
  kick_ball,
  kirby_hammer,
  kiss,
  klee_eat,
  knock,
  kokona_seal,
  konata_watch,
  kou,
  kurogames_abby_eat,
  kurogames_abby_lift_high,
  kurogames_abby_rub,
  kurogames_abby_solace,
  kurogames_abby_weeping,
  kurogames_abby_write,
  kurogames_camellya_holdsign,
  kurogames_camellya_photo,
  kurogames_carlotta_holdsign,
  kurogames_carlotta_play,
  kurogames_cartethyia_feetup,
  kurogames_cartethyia_holdsign,
  kurogames_cartethyia_say,
  kurogames_changli_finger,
  kurogames_changli_holdsign,
  kurogames_chun_holdsign,
  kurogames_good_night,
  kurogames_gugu_blowfish_small_classes,
  kurogames_iuno_holdsign,
  kurogames_iuno_hug,
  kurogames_iuno_kick,
  kurogames_iuno_play,
  kurogames_iuno_say,
  kurogames_jinhsi_eat,
  kurogames_jinhsi_sit,
  kurogames_jinhsi_steamed_buns,
  kurogames_lingyang_holdsign,
  kurogames_lupa_eat,
  kurogames_lupa_holdsign,
  kurogames_lupa_photo,
  kurogames_mortefi_holdsign,
  kurogames_mp,
  kurogames_nsfw_verina_holdsign,
  kurogames_orang,
  kurogames_phoebe_holdsign,
  kurogames_phoebe_say,
  kurogames_phoebe_score_sheet,
  kurogames_phrolova_eat,
  kurogames_phrolova_holdsign,
  kurogames_phrolova_say,
  kurogames_roccia_holdsign,
  kurogames_rover_cards,
  kurogames_rover_head,
  kurogames_rover_holdsign,
  kurogames_rover_lick,
  kurogames_songlun_dinner,
  kurogames_songlun_finger,
  kurogames_songlun_holdsign,
  kurogames_songlun_say,
  kurogames_the_shorekeeper_holdsign,
  kurogames_verina_finger,
  kurogames_verina_group_photo,
  kurogames_verina_holdsign,
  kurogames_verina_say,
  kurogames_yangyang_holdsign,
  kurogames_yangyang_lover,
  kurogames_zani_aloft,
  kurogames_zhezhi_draw,
  kurogames_zhezhi_holdsign,
  lash,
  laughing,
  laydown_do,
  learn,
  left_right_jump,
  lemon,
  let_me_in,
  lick_candy,
  liedui,
  lim_x_0,
  listen_music,
  little_angel,
  little_do,
  liugou,
  llz,
  loading,
  lochi_mari_play,
  look_flat,
  look_leg,
  look_this_icon,
  loop,
  lost_dog,
  louvre,
  love_you,
  lulu_feed_pig,
  lulu_qizhu,
  luotianyi_need,
  luotianyi_say,
  luoyonghao_say,
  luxun_say,
  ly01,
  mahiro_fuck,
  mahiro_readbook,
  maikease,
  maimai_awaken,
  maimai_join,
  make_friend,
  maodielanqiu,
  maomaochong,
  marriage,
  masturbate,
  meiyijian,
  mengbimao,
  mengjue,
  mengqin,
  merry_christmas,
  meteor,
  mi_leijun_holdsign,
  mi_monkey,
  mihoyo,
  mihoyo_amber_frame,
  mihoyo_bailu_kick,
  mihoyo_barbara_pegg_frame,
  mihoyo_barbatos_frame,
  mihoyo_caribert_alberich_frame,
  mihoyo_chasca_frame,
  mihoyo_citlali_frame,
  mihoyo_columbina_jade_feet,
  mihoyo_duantou,
  mihoyo_editorial_society_frame,
  mihoyo_elysia_come,
  mihoyo_funina_card,
  mihoyo_funina_death_penalty,
  mihoyo_funina_finger,
  mihoyo_funina_holdsign,
  mihoyo_funina_round_head,
  mihoyo_funina_square_head,
  mihoyo_gemini_frame,
  mihoyo_genshin_impact_op,
  mihoyo_genshin_impact_players,
  mihoyo_guoba_frame,
  mihoyo_hilichurl_frame,
  mihoyo_hutao_frame,
  mihoyo_hutao_holdsign,
  mihoyo_ineffa_droid,
  mihoyo_kaveh_frame,
  mihoyo_keqing_pointo,
  mihoyo_klee_duduke_frame,
  mihoyo_klee_frame,
  mihoyo_klee_hat_frame,
  mihoyo_kujou_sara_frame,
  mihoyo_kuki_shinobu_frame,
  mihoyo_kuki_shinobu_who,
  mihoyo_lce_slime_frame,
  mihoyo_liuwei_dinner,
  mihoyo_liuwei_holdsign,
  mihoyo_liuwei_say,
  mihoyo_lynette_holdsign,
  mihoyo_navia_caspar_persuade,
  mihoyo_outlander_frame,
  mihoyo_paimon_crown,
  mihoyo_paimon_emergency_food_frame,
  mihoyo_paimon_frame,
  mihoyo_qiqi_suck,
  mihoyo_sangonomiya_kokomi_love,
  mihoyo_senior_phone,
  mihoyo_shikanoin_heizou_frame,
  mihoyo_sigewinne_fingered,
  mihoyo_tartaglia_frame,
  mihoyo_tepetlisauri_frame,
  mihoyo_thunderbolt_slime_frame,
  mihoyo_traveler_frame,
  mihoyo_wind_slime_frame,
  mihoyo_yanfei_frame,
  mihoyo_yelan_phone,
  miss_in_my_sleep,
  mix_dog,
  mixue,
  mixue_jasmine_milk_green,
  mixue_stick_beaten_fresh_orange,
  motivate,
  mourning,
  murmur,
  my_certificate,
  my_friend,
  my_opinion,
  my_wife,
  mygo_sakiko_togawa,
  myplay,
  nahida_bite,
  nakano_lchika,
  nakano_ltsuki,
  nakano_miku,
  nakano_nino,
  nakano_yotsuba,
  name_generator,
  nantongjue,
  naonao_tou,
  naruro_resurrection,
  naruro_s_ninja,
  naruro_uzumaki_naruto_holdsign,
  national_day_plan,
  need,
  nekoha_holdsign,
  new_goodnews,
  nietumao,
  nihaosaoa,
  nijika_holdsign,
  niuniu_play_ball,
  nizaishuo,
  no_response,
  nokia,
  not_call_me,
  note_for_leave,
  nvtongjue,
  ok,
  onepunch,
  operator_generator,
  oral_sex,
  orange_head,
  oshi_no_ko,
  osu,
  out,
  overtime,
  p5letter,
  painitou,
  paint,
  painter,
  palworld_chillet,
  palworld_chillet_god_wealth,
  panda_dragon_figure,
  pao,
  paobujis,
  pass_the_buck,
  pat,
  pay_to_watch,
  peas,
  penshe,
  penshui,
  pepe_raise,
  perfect,
  petpet,
  pi,
  piboss,
  picking_flowers,
  pierrot_plus_head,
  pigcar,
  pinailong,
  pinch,
  pinch_egg,
  pineapple,
  pineapples,
  pingdiguo,
  pixelate,
  pjsk,
  plana_eat,
  play,
  play_baseball,
  play_basketball,
  play_game,
  play_together,
  police,
  police1,
  police_car,
  pornhub,
  potato,
  potato_mines,
  pound,
  pregnancy_test,
  printing,
  prpr,
  psyduck,
  punch,
  pyramid,
  qi,
  qian,
  qiegewala,
  qiejupai,
  qilongwang,
  qixi_festival,
  qixiong,
  qizhu,
  quilt,
  qunchao,
  qunyoujupai,
  qushi,
  rabbit,
  raise_image,
  raise_sign,
  read_book,
  read_love_letters,
  remote_control,
  rengshi,
  repeat,
  richu,
  rip,
  rip_angrily,
  rip_clothes,
  rise_dead,
  roll,
  rotate_3d,
  rub,
  rudong,
  run,
  run_away,
  run_with,
  rune,
  safe_sense,
  saimin_app,
  sayguaihua,
  sayhi,
  scissor_seven_head,
  scratch_head,
  scratchcard,
  scroll,
  seal,
  sekaiichi_kawaii,
  sending_love,
  shadow_boxing,
  shake_head,
  shamate,
  shikanoko_noko,
  shipborne_laser_weapons,
  shiroko_pero,
  shishilani,
  shock,
  shoot,
  shuai,
  shuaiqunwu,
  shuifandui,
  shutup,
  sibalu,
  sikete,
  sit_still,
  sitdown_do,
  slacking_off,
  slap,
  slipper,
  slogan,
  sm,
  small_hands,
  smash,
  sold_out,
  speechless,
  spend_christmas,
  sphere_rotate,
  spider,
  spike_spinebuster,
  spinner,
  stare_at_you,
  steam_message,
  step_on,
  stew,
  stickman_dancing,
  stretch,
  subject3,
  suck,
  sunflower,
  support,
  swimsuit_group_photo,
  swirl_turn,
  symmetric,
  tankuku_raisesign,
  taunt,
  teach,
  tease,
  telescope,
  thermometer_gun,
  think_what,
  this_chicken,
  "throw": {"key":"throw","params_type":{"min_images":1,"max_images":1,"min_texts":0,"max_texts":0,"default_texts":[],"args_type":null},"keywords":["丢","扔"],"shortcuts":[],"tags":["东方Project"],"date_created":"2021-05-05T00:00:00","date_modified":"2023-03-30T00:00:00"},
  throw_gif,
  throwing_poop,
  thump,
  thump_wildly,
  tiaopi,
  tiaosheng,
  tiaowu_mao,
  tightly,
  time_to_go,
  together,
  together_two,
  tom_tease,
  tomb_yeah,
  top_notch,
  torture_yourself,
  trance,
  trolley,
  tuo_laji,
  turn,
  turtle_jue,
  twist,
  universal,
  upside_down,
  vibrate,
  vme50,
  vni50,
  wakeup,
  wallpaper,
  walnut_pad,
  walnut_zoom,
  wang,
  wangjingze,
  wanhuo,
  washer,
  wave,
  wechat_pay,
  weisuoyuwei,
  what_I_want_to_do,
  what_he_wants,
  whisper,
  why_at_me,
  why_have_hands,
  widow,
  windmill_turn,
  wish_fail,
  wolaile,
  wooden_fish,
  worship,
  woyouyijian,
  wudizhen,
  wujing,
  wunian,
  wuyage,
  wuyingtui,
  xiatou,
  xile,
  xiluo_disgust,
  xiongqi,
  xueli_say,
  xueli_think,
  yalidaye,
  yao,
  yes,
  yeshu,
  yesirmiao,
  yo_yo,
  you_dont_get,
  you_should_call,
  your_new_years_eve,
  youtube,
  yuanshen,
  yuwangwa,
  yuzu_soft_ayachi_nene,
  yuzu_soft_ciallo,
  yuzu_soft_holdsign,
  yuzu_soft_mako_hitachi_holdsign,
  yuzu_soft_murasame_blackboard,
  yuzu_soft_murasame_clothes,
  yuzu_soft_murasame_dislike,
  yuzu_soft_murasame_finger,
  yuzu_soft_murasame_husband,
  yuzu_soft_murasame_ipad,
  yuzu_soft_murasame_like,
  yuzu_soft_murasame_say,
  yuzu_soft_shocked,
  yuzu_soft_ticket,
  yys_yuanjieshenjupai,
  yys_yuanjieshenpeng,
  zaoleipi,
  zengxiaoxian,
  zhebianqing,
  zheng_zai_zhao_ni,
  zhiyexuanshou,
  zhongcheng,
  zhuishamiao,
  zhuwu,
  zixingche,
  zuini,
  zuo,
  zuoyizuo,
  zzdd,
};

let memeListImageCache = null;
const getDataDir = () => path.join(pluginState.dataPath, DATA_DIR_NAME);
async function initMemeData() {
  mkdirs(getDataDir());
  loadBuiltinMemeData();
  pluginState.initialized = true;
  pluginState.log("info", `Meme数据加载完成，共 ${Object.keys(pluginState.keyMap).length} 个关键词`);
}
function loadBuiltinMemeData() {
  const keyMap = {}, infos = {};
  for (const [key, data] of Object.entries(MEME_DATA)) {
    infos[key] = data;
    data.keywords?.forEach((k) => keyMap[k] = key);
  }
  pluginState.infos = infos;
  pluginState.keyMap = keyMap;
}
async function updateMemeData() {
  deleteFile(path.join(getDataDir(), CACHE_FILES.renderList));
  loadBuiltinMemeData();
  pluginState.log("info", "Meme数据已重新加载");
}
function findLongestMatchingKey(msg) {
  const keys = Object.keys(pluginState.keyMap).filter((k) => msg.startsWith(k));
  return keys.length ? keys.sort((a, b) => b.length - a.length)[0] : null;
}
function getMemeDetail(code) {
  const d = pluginState.infos[code];
  if (!d) return "未找到该表情信息";
  let ins = `【代码】${d.key}
【名称】${d.keywords.join("、")}
【图片】${d.params_type.min_images}-${d.params_type.max_images}
【文本】${d.params_type.min_texts}-${d.params_type.max_texts}`;
  if (d.params_type.args_type?.parser_options?.length) ins += `
【参数】支持额外参数`;
  return ins;
}
function searchMemeKeywords(kw) {
  return Object.keys(pluginState.keyMap).filter((k) => k.includes(kw));
}
function getRandomMemeKey() {
  const keys = Object.keys(pluginState.infos).filter((k) => {
    const i = pluginState.infos[k];
    return i.params_type.min_images === 1 && i.params_type.min_texts === 0;
  });
  return keys.length ? pluginState.infos[keys[Math.floor(Math.random() * keys.length)]].keywords[0] : null;
}
function handleMemeArgs(key, args, userInfos) {
  const obj = {};
  const info = pluginState.infos[key];
  if (info?.params_type?.args_type) {
    const { args_model, parser_options = [] } = info.params_type.args_type;
    for (const prop in args_model.properties) {
      if (prop === "user_infos") continue;
      const pi = args_model.properties[prop];
      if (pi.enum) {
        const map = {};
        parser_options.filter((o) => o.dest === prop && o.action?.type === 0 && o.action.value).forEach((o) => o.names.forEach((n) => map[n.replace(/^--/, "")] = o.action.value));
        obj[prop] = map[args.trim()] || pi.default;
      } else if (pi.type === "integer" || pi.type === "number") {
        if (/^\d+$/.test(args.trim())) obj[prop] = parseInt(args.trim());
      }
    }
  }
  obj.user_infos = userInfos.map((u) => ({ name: trimChar(u.text || "", "@"), gender: u.gender || "unknown" }));
  return JSON.stringify(obj);
}
function getMemeListImageBase64() {
  if (memeListImageCache) return memeListImageCache;
  const dir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const paths = [path.join(dir, "meme-list.png"), path.join(process.cwd(), "plugins", "napcat-plugin-play", "meme-list.png")];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      memeListImageCache = fs.readFileSync(p).toString("base64");
      return memeListImageCache;
    }
  }
  return null;
}
async function generateMeme(code, images, texts, args) {
  const form = new FormData();
  images.forEach((b, i) => form.append("images", new Blob([b], { type: "image/jpeg" }), `img${i}.jpg`));
  texts.forEach((t) => form.append("texts", t));
  if (args) form.set("args", args);
  const res = await fetch(`${pluginState.config.memeApiUrl}/memes/${code}/`, { method: "POST", body: form }).catch(() => null);
  if (!res || !res.ok) return res ? await res.text() : "请求失败";
  return Buffer.from(await (await res.blob()).arrayBuffer());
}
async function downloadImage(url) {
  const res = await fetch(url).catch(() => null);
  return res?.ok ? Buffer.from(await (await res.blob()).arrayBuffer()) : null;
}

async function handleMemeCommand(event, raw, ctx) {
  if (!pluginState.initialized) await initMemeData();
  const prefix = pluginState.config.prefix ?? "";
  const userId = String(event.user_id);
  const cleaned = raw.replace(/\[CQ:at,qq=\d+\]/g, "").replace(/\[CQ:reply,id=-?\d+\]/g, "").trim();
  if (/^设置主人\s*\d+/.test(cleaned)) {
    await handleAddMaster(event, cleaned, userId, ctx);
    return true;
  }
  if (/^删除主人\s*\d+/.test(cleaned)) {
    await handleRemoveMaster(event, cleaned, userId, ctx);
    return true;
  }
  if (/^主人列表$/.test(cleaned)) {
    await handleMasterList(event, ctx);
    return true;
  }
  if (/^(meme(s)?|表情包)列表$/.test(cleaned)) {
    await handleMemeList(event, ctx);
    return true;
  }
  if (/^随机(meme(s)?|表情包)/.test(cleaned)) {
    await handleRandomMeme(event, ctx);
    return true;
  }
  if (/^(meme(s)?|表情包)帮助/.test(cleaned)) {
    await sendReply(event, HELP_MESSAGE, ctx);
    return true;
  }
  if (/^(meme(s)?|表情包)搜索/.test(cleaned)) {
    await handleMemeSearch(event, cleaned, ctx);
    return true;
  }
  if (/^(meme(s)?|表情包)更新/.test(cleaned)) {
    await handleMemeUpdate(event, ctx);
    return true;
  }
  if (prefix && !cleaned.startsWith(prefix)) return false;
  const content = prefix ? cleaned.slice(prefix.length).trim() : cleaned;
  const target = findLongestMatchingKey(content);
  if (target) {
    await handleMemeGenerate(event, content, target, ctx);
    return true;
  }
  return false;
}
async function handleAddMaster(event, msg, userId, ctx) {
  if (!pluginState.isMaster(userId)) {
    await sendReply(event, "只有主人才能设置", ctx);
    return;
  }
  const m = msg.match(/(\d+)/);
  if (!m) {
    await sendReply(event, "格式：设置主人+QQ", ctx);
    return;
  }
  const qq = m[1], list = pluginState.getMasterQQs();
  if (list.includes(qq)) {
    await sendReply(event, `${qq} 已是主人`, ctx);
    return;
  }
  list.push(qq);
  pluginState.config.ownerQQs = list.join(",");
  saveConfig(ctx);
  await sendReply(event, `已添加主人：${qq}`, ctx);
}
async function handleRemoveMaster(event, msg, userId, ctx) {
  if (!pluginState.isMaster(userId)) {
    await sendReply(event, "只有主人才能删除", ctx);
    return;
  }
  const m = msg.match(/(\d+)/);
  if (!m) {
    await sendReply(event, "格式：删除主人+QQ", ctx);
    return;
  }
  const qq = m[1], list = pluginState.getMasterQQs();
  if (!list.includes(qq)) {
    await sendReply(event, `${qq} 不是主人`, ctx);
    return;
  }
  if (qq === userId && list.length === 1) {
    await sendReply(event, "不能删除唯一主人", ctx);
    return;
  }
  pluginState.config.ownerQQs = list.filter((q) => q !== qq).join(",");
  saveConfig(ctx);
  await sendReply(event, `已删除主人：${qq}`, ctx);
}
async function handleMasterList(event, ctx) {
  const list = pluginState.getMasterQQs();
  await sendReply(event, list.length ? `主人列表：
${list.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "当前没有设置主人", ctx);
}
function saveConfig(ctx) {
  if (!ctx?.configPath) return;
  const dir = path.dirname(ctx.configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ctx.configPath, JSON.stringify(pluginState.config, null, 2), "utf-8");
}
async function handleMemeList(event, ctx) {
  const img = getMemeListImageBase64();
  if (img) {
    await sendImageBase64(event, img, ctx);
    return;
  }
  const kws = Object.keys(pluginState.keyMap).slice(0, 30).map((k) => `【${k}】`).join(" ");
  await sendReply(event, `【Meme列表】共 ${Object.keys(pluginState.keyMap).length} 个

${kws} ...

发送【meme搜索+词】搜索更多`, ctx);
}
async function handleRandomMeme(event, ctx) {
  const kw = getRandomMemeKey();
  if (!kw) {
    await sendReply(event, "暂无可用随机meme", ctx);
    return;
  }
  await handleMemeGenerate(event, kw, kw, ctx);
}
async function handleMemeSearch(event, msg, ctx) {
  const s = msg.replace(/^#?(meme(s)?|表情包)搜索/, "").trim();
  if (!s) {
    await sendReply(event, "请输入关键词", ctx);
    return;
  }
  const hits = searchMemeKeywords(s);
  const txt = hits.length ? hits.slice(0, 20).map((k, i) => `${i + 1}. ${k}`).join("\n") + (hits.length > 20 ? `
...共${hits.length}个` : "") : "无结果";
  await sendReply(event, `搜索结果：
${txt}`, ctx);
}
async function handleMemeUpdate(event, ctx) {
  await sendReply(event, "更新中...", ctx);
  await updateMemeData();
  await sendReply(event, "更新完成", ctx);
}
async function handleMemeGenerate(event, msg, target, ctx) {
  try {
    const code = pluginState.keyMap[target], info = pluginState.infos[code];
    if (!info) {
      await sendReply(event, "未找到该表情", ctx);
      return;
    }
    let text1 = msg.replace(target, "");
    if (text1.trim() === "详情" || text1.trim() === "帮助") {
      await sendReply(event, getMemeDetail(code), ctx);
      return;
    }
    const [text, args = ""] = text1.split("#");
    const userId = String(event.user_id);
    const sender = event.sender;
    let imgs = [];
    const atUsers = extractAtUsers(event.message);
    if (info.params_type.max_images > 0) {
      imgs = [...await getReplyImages(event, ctx).catch(() => []), ...extractImageUrls(event.message)];
      if (!imgs.length && atUsers.length) imgs = atUsers.map((a) => getAvatarUrl$1(a.qq));
      if (!imgs.length && info.params_type.min_images > 0) imgs.push(getAvatarUrl$1(userId));
      if (imgs.length < info.params_type.min_images && !imgs.includes(getAvatarUrl$1(userId))) imgs = [getAvatarUrl$1(userId), ...imgs];
      imgs = applyMasterProtection(code, imgs, userId, atUsers);
      imgs = imgs.slice(0, info.params_type.max_images);
    }
    let texts = [];
    if (text && info.params_type.max_texts === 0) return;
    if (!text && info.params_type.min_texts > 0) {
      texts.push(atUsers[0]?.text?.replace("@", "").trim() || sender?.card || sender?.nickname || "用户");
    } else if (text) {
      texts = text.split("/").slice(0, info.params_type.max_texts);
    }
    if (texts.length < info.params_type.min_texts) {
      await sendReply(event, `需要${info.params_type.min_texts}个文本，用/隔开`, ctx);
      return;
    }
    if (info.params_type.max_texts > 0 && !texts.length) texts.push(atUsers[0]?.text?.replace("@", "").trim() || sender?.card || sender?.nickname || "用户");
    let userInfos = atUsers;
    if (atUsers.length && event.group_id && ctx.actions) {
      const members = await ctx.actions.call("get_group_member_list", { group_id: String(event.group_id) }, ctx.adapterName, ctx.pluginManager.config).catch(() => []);
      userInfos = atUsers.map((a) => {
        const m = members.find((m2) => String(m2.user_id) === String(a.qq));
        return { qq: a.qq, text: m?.card || m?.nickname || a.text, gender: m?.sex || "unknown" };
      });
    }
    if (!userInfos.length) userInfos = [{ text: sender?.card || sender?.nickname || "用户", gender: sender?.sex || "unknown" }];
    const buffers = [];
    for (const url of imgs) {
      const b = await downloadImage(url).catch(() => null);
      if (b) buffers.push(b);
    }
    if (info.params_type.min_images > 0 && !buffers.length) {
      await sendReply(event, "图片下载失败", ctx);
      return;
    }
    if (buffers.length && checkFileSize(buffers.map((b) => ({ size: b.length })), pluginState.config.maxFileSize)) {
      await sendReply(event, `文件超限，最大${pluginState.config.maxFileSize}MB`, ctx);
      return;
    }
    const result = await generateMeme(code, buffers, texts, handleMemeArgs(code, args, userInfos)).catch(() => "生成失败");
    if (typeof result === "string") await sendReply(event, result, ctx);
    else await sendImageBase64(event, result.toString("base64"), ctx);
  } catch {
    await sendReply(event, "表情生成出错", ctx).catch(() => {
    });
  }
}
function applyMasterProtection(code, imgs, senderId, atUsers) {
  if (!pluginState.config.enableMasterProtect || !MASTER_PROTECT_LIST.includes(code)) return imgs;
  const masters = pluginState.getMasterQQs();
  if (!masters.length || masters.includes(senderId)) return imgs;
  const senderAva = getAvatarUrl$1(senderId);
  const atMaster = atUsers.find((a) => masters.includes(String(a.qq)));
  if (atMaster) {
    if (imgs.length === 1) {
      const qq = imgs[0].match(/nk=(\d+)/)?.[1];
      if (qq && masters.includes(qq)) return [senderAva];
    } else if (imgs.length >= 2) {
      return [getAvatarUrl$1(atMaster.qq), senderAva, ...imgs.slice(2)];
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

class LRUCache {
  cache = /* @__PURE__ */ new Map();
  capacity;
  constructor(capacity = 100) {
    this.capacity = capacity;
  }
  get(key) {
    if (!this.cache.has(key)) return void 0;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== void 0) this.cache.delete(firstKey);
    }
  }
  has(key) {
    return this.cache.has(key);
  }
}
const musicCache = new LRUCache(100);
async function handleMusicCommand(event, raw, ctx) {
  if (!pluginState.config.enableMusic) return false;
  const content = raw.replace(/\[CQ:[^\]]+\]/g, "").trim();
  const userId = String(event.user_id);
  const searchMatch = content.match(/^点歌\s*(.*)$/);
  if (searchMatch) {
    await searchMusic(event, searchMatch[1].trim(), ctx);
    return true;
  }
  const playMatch = content.match(/^听(\d+)$/);
  if (playMatch) {
    await playMusic(event, parseInt(playMatch[1]), userId, ctx);
    return true;
  }
  return false;
}
async function searchMusic(event, keyword, ctx) {
  const userId = String(event.user_id);
  if (!keyword) {
    await sendReply(event, "请输入要搜索的歌曲名，如：点歌 晴天", ctx);
    return;
  }
  try {
    const encoded = encodeURIComponent(keyword);
    const apiUrl = pluginState.config.musicApiUrl || "https://a.aa.cab";
    const res = await fetch(`${apiUrl}/qq.music?msg=${encoded}`, { signal: AbortSignal.timeout(1e4) }).catch(() => null);
    if (!res || !res.ok) {
      await sendReply(event, "网络请求超时，请稍后重试", ctx);
      return;
    }
    const data = await res.json().catch(() => null);
    if (!data || !data.data || !data.data.length) {
      await sendReply(event, "未找到相关歌曲，请尝试其他关键词", ctx);
      return;
    }
    const songs = data.data.slice(0, 10);
    musicCache.put(userId, { type: "qq", songs, keyword });
    const msgList = [];
    msgList.push(`🎵 点歌结果：${keyword}
发送"听+序号"播放，如：听1`);
    songs.forEach((song, idx) => {
      const name = cleanText(song.song || "未知歌名");
      const singer = cleanText(song.singer || "未知歌手");
      msgList.push(`${idx + 1}. ${name} - ${singer}`);
    });
    msgList.push('💡 提示：发送"听1"到"听10"播放对应歌曲');
    await sendForwardMsg(event, msgList, ctx);
  } catch {
    await sendReply(event, "搜索音乐时发生错误，请稍后重试", ctx);
  }
}
async function playMusic(event, idx, userId, ctx) {
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
    const apiUrl = pluginState.config.musicApiUrl || "https://a.aa.cab";
    const res = await fetch(`${apiUrl}/qq.music?msg=${encoded}&n=${idx}`, { signal: AbortSignal.timeout(1e4) }).catch(() => null);
    if (!res || !res.ok) {
      await sendReply(event, "网络请求超时，请稍后重试", ctx);
      return;
    }
    const data = await res.json().catch(() => null);
    if (!data?.data?.music) {
      await sendReply(event, "未获取到歌曲链接，请换一首歌尝试", ctx);
      return;
    }
    await sendVoice(event, data.data.music, ctx);
  } catch {
    await sendReply(event, "播放歌曲时出错，请稍后重试", ctx);
  }
}
async function sendVoice(event, url, ctx) {
  if (!ctx.actions) return;
  try {
    const msg = [{ type: "record", data: { file: url } }];
    const action = event.message_type === "group" ? "send_group_msg" : "send_private_msg";
    const id = event.message_type === "group" ? { group_id: String(event.group_id) } : { user_id: String(event.user_id) };
    await ctx.actions.call(action, { ...id, message: msg }, ctx.adapterName, ctx.pluginManager.config).catch(() => {
    });
  } catch {
  }
}
function cleanText(s) {
  return s.replace(/[<>"'&*_~`\[\](){}\\\/]/g, "").trim();
}

const DRAW_MODEL = "gemini-3-pro-image";
let promptsCache = {};
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1e3;
function getAvatarUrl(qq) {
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`;
}
function getPresetNames() {
  return Object.keys(promptsCache);
}
async function refreshPromptsCache() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && Object.keys(promptsCache).length > 0) return;
  try {
    const apiUrl = pluginState.config.drawApiUrl;
    if (!apiUrl) return;
    const res = await fetch(`${apiUrl}/image`, { signal: AbortSignal.timeout(1e4) });
    if (res.ok) {
      const data = await res.json();
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
async function handleDrawCommand(event, raw, ctx) {
  const text = raw.replace(/\[CQ:[^\]]+\]/g, "").trim();
  await refreshPromptsCache();
  if (/^(预设提示词|提示词列表|画图预设)$/.test(text)) {
    const presets = Object.keys(promptsCache);
    if (presets.length === 0) {
      await sendReply(event, "暂无预设提示词", ctx);
    } else {
      const list = presets.map((k, i) => `${i + 1}. ${k}`).join("\n");
      await sendReply(event, `🎨 预设提示词列表：
${list}

使用方式：
• ${presets[0]}@某人
• ${presets[0]}+QQ号
• 引用图片+${presets[0]}`, ctx);
    }
    return true;
  }
  const presetNames = Object.keys(promptsCache);
  for (const presetName of presetNames) {
    const presetMatch = text.match(new RegExp(`^${presetName}\\s*(.*)$`, "i"));
    if (presetMatch) {
      const extra = presetMatch[1].trim();
      return await handlePresetDraw(event, presetName, promptsCache[presetName], extra, ctx);
    }
  }
  const match = text.match(/^(?:画|绘|draw)\s*(.+)$/i);
  if (!match) return false;
  let prompt = match[1].trim().replace(/\[CQ:at,[^\]]+\]/g, "").trim();
  if (!prompt) {
    const presetsHint = presetNames.length ? `
预设: ${presetNames.join("、")}` : "";
    await sendReply(event, `请输入绘画描述，例如：画一只可爱的猫咪
支持引用图片、附带图片或@某人使用头像${presetsHint}`, ctx);
    return true;
  }
  const apiUrl = pluginState.config.drawApiUrl;
  if (!apiUrl) {
    await sendReply(event, "绘画功能未配置 API 地址", ctx);
    return true;
  }
  const presetPrompt = promptsCache[prompt];
  if (presetPrompt) {
    pluginState.debug(`[Draw] 使用预设提示语: ${prompt}`);
    prompt = presetPrompt;
  }
  let imageUrls = await getReplyImages(event, ctx);
  if (!imageUrls.length) imageUrls = extractImageUrls(event.message);
  if (!imageUrls.length) {
    const atUsers = extractAtUsers(event.message);
    if (atUsers.length > 0 && atUsers[0].qq) imageUrls = [getAvatarUrl(atUsers[0].qq)];
  }
  return await executeDrawRequest(event, prompt, imageUrls, ctx);
}
async function handlePresetDraw(event, presetName, prompt, extra, ctx) {
  const apiUrl = pluginState.config.drawApiUrl;
  if (!apiUrl) {
    await sendReply(event, "绘画功能未配置 API 地址", ctx);
    return true;
  }
  let imageUrls = [];
  imageUrls = await getReplyImages(event, ctx);
  if (!imageUrls.length) imageUrls = extractImageUrls(event.message);
  if (!imageUrls.length) {
    const qqMatch = extra.match(/(\d{5,11})/);
    if (qqMatch) {
      imageUrls = [getAvatarUrl(qqMatch[1])];
    }
  }
  if (!imageUrls.length) {
    const atUsers = extractAtUsers(event.message);
    if (atUsers.length > 0 && atUsers[0].qq) {
      imageUrls = [getAvatarUrl(atUsers[0].qq)];
    }
  }
  if (!imageUrls.length) {
    imageUrls = [getAvatarUrl(event.user_id)];
  }
  pluginState.debug(`[Draw] 预设: ${presetName}, 图片: ${imageUrls[0]}`);
  return await executeDrawRequest(event, prompt, imageUrls, ctx);
}
async function executeDrawRequest(event, prompt, imageUrls, ctx) {
  const apiUrl = pluginState.config.drawApiUrl;
  const hasImage = imageUrls.length > 0;
  await sendReply(event, hasImage ? "🎨 正在修改图片，请稍候..." : "🎨 正在绘制中，请稍候...", ctx);
  try {
    const messages = hasImage ? [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrls[0] } }] }] : [{ role: "user", content: prompt }];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e5);
    let response;
    try {
      response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: DRAW_MODEL, messages, stream: false, temperature: 0.7, top_p: 1, frequency_penalty: 0, presence_penalty: 0, type: 3 }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      await sendReply(event, `${hasImage ? "图片修改" : "绘画"}失败: ${response.status}`, ctx);
      return true;
    }
    const result = await response.json();
    if (result.error) {
      await sendReply(event, `${hasImage ? "图片修改" : "绘画"}失败: ${result.error.message || "未知错误"}`, ctx);
      return true;
    }
    if (result.choices?.[0]?.finish_reason === "content_filter") {
      await sendReply(event, "⚠️ 内容被安全过滤，请修改描述后重试", ctx);
      return true;
    }
    const content = result.choices?.[0]?.message?.content;
    let imageUrl = null;
    if (Array.isArray(content)) {
      const imgPart = content.find((c) => c.type === "image_url" || c.type === "image");
      if (imgPart?.image_url?.url) imageUrl = imgPart.image_url.url;
    } else if (typeof content === "string") {
      const mdB64Match = content.match(/!\[.*?\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/);
      if (mdB64Match) imageUrl = `base64://${mdB64Match[1].split(",")[1]}`;
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
      const errText = typeof content === "string" && content ? content.slice(0, 500) : "API 返回内容为空";
      await sendReply(event, `${hasImage ? "图片修改" : "绘画"}失败: ${errText}`, ctx);
    }
    return true;
  } catch (error) {
    const errMsg = error instanceof Error && error.name === "AbortError" ? "绘画超时，请稍后重试" : `绘画失败: ${String(error)}`;
    await sendReply(event, errMsg, ctx);
    return true;
  }
}

async function handleMenuCommand(event, raw, ctx) {
  const content = raw.replace(/\[CQ:[^\]]+\]/g, "").trim();
  if (/^(娱乐|play|功能)(菜单|帮助|menu|help)?$/.test(content)) {
    await showMenu(event, ctx);
    return true;
  }
  return false;
}
async function showMenu(event, ctx) {
  const msgList = [];
  msgList.push("🎮 Play 娱乐插件菜单");
  if (pluginState.config.enableMeme) {
    msgList.push(`📸 表情包功能
• meme列表 - 查看表情列表
• 表情名 - 制作表情（可@人或引用图片）
• 表情名+详情 - 查看表情用法
• meme搜索+关键词 - 搜索表情
• 随机meme - 随机生成表情
• meme更新 - 更新表情数据`);
  }
  if (pluginState.config.enableMusic) {
    msgList.push(`🎵 点歌功能
• 点歌+歌名 - 搜索歌曲
• 听+序号 - 播放搜索到的歌曲
示例：点歌 晴天 → 听1`);
  }
  if (pluginState.config.enableDraw) {
    await refreshPromptsCache();
    const presets = getPresetNames();
    let drawContent = `🎨 AI绘画功能
• 画+描述 - 文字生成图片
• 画+@某人+描述 - 用头像生成图片
• 引用图片+画+描述 - 修改图片
• 预设提示词 - 查看预设列表`;
    if (presets.length > 0) {
      drawContent += `

📋 可用预设 (${presets.length}个):`;
      presets.forEach((p) => {
        drawContent += `
• ${p}@某人 / ${p}+QQ号`;
      });
    }
    msgList.push(drawContent);
  }
  msgList.push(`⚙️ 管理功能
• 设置主人+QQ - 添加主人
• 删除主人+QQ - 移除主人
• 主人列表 - 查看主人列表`);
  const prefix = pluginState.config.prefix;
  if (prefix) {
    msgList.push(`💡 提示：表情包生成需加前缀「${prefix}」，其他指令直接发送`);
  } else {
    msgList.push("💡 提示：直接发送指令即可触发");
  }
  await sendForwardMsg(event, msgList, ctx);
}

let plugin_config_ui = [];
const plugin_init = async (ctx) => {
  Object.assign(pluginState, {
    logger: ctx.logger,
    actions: ctx.actions,
    adapterName: ctx.adapterName,
    networkConfig: ctx.pluginManager.config
  });
  pluginState.log("info", "Play 娱乐插件正在初始化...");
  plugin_config_ui = ctx.NapCatConfig.combine(
    ctx.NapCatConfig.html('<div style="padding:10px;background:#f5f5f5;border-radius:8px;margin-bottom:10px"><b>🎮 Play 娱乐插件</b><br/><span style="color:#666;font-size:13px">发送 <code>娱乐菜单</code> 查看指令 | 交流群：631348711</span></div>'),
    // 功能开关
    ctx.NapCatConfig.html("<b>📌 功能开关</b>"),
    ctx.NapCatConfig.boolean("enableMeme", "表情包功能", true, "启用 meme 表情包制作"),
    ctx.NapCatConfig.boolean("enableMusic", "点歌功能", true, "启用 QQ 音乐点歌"),
    ctx.NapCatConfig.boolean("enableDraw", "AI绘画功能", true, "启用 AI 绘画"),
    ctx.NapCatConfig.text("prefix", "Meme前缀", "", "仅表情包功能需要前缀"),
    // API 配置
    ctx.NapCatConfig.html("<b>🔧 API 配置</b>"),
    ctx.NapCatConfig.text("memeApiUrl", "Meme API", "http://datukuai.top:2233", "meme 服务地址"),
    ctx.NapCatConfig.text("musicApiUrl", "音乐 API", "https://a.aa.cab", "点歌服务地址"),
    ctx.NapCatConfig.text("drawApiUrl", "绘画 API", "https://i.elaina.vin/api/openai", "AI 绘画服务地址"),
    // 其他设置
    ctx.NapCatConfig.html("<b>⚙️ 其他设置</b>"),
    ctx.NapCatConfig.select("maxFileSize", "图片大小限制", [5, 10, 20].map((n) => ({ label: `${n}MB`, value: n })), 10),
    ctx.NapCatConfig.boolean("enableMasterProtect", "主人保护", true, "攻击性 meme 反向操作"),
    ctx.NapCatConfig.text("ownerQQs", "主人QQ", "", "多个用逗号分隔"),
    ctx.NapCatConfig.boolean("debug", "调试模式", false, "显示详细日志")
  );
  if (fs.existsSync(ctx.configPath)) {
    pluginState.config = { ...DEFAULT_PLUGIN_CONFIG, ...JSON.parse(fs.readFileSync(ctx.configPath, "utf-8")) };
  }
  pluginState.dataPath = ctx.configPath ? dirname(ctx.configPath) : path.join(process.cwd(), "data", "napcat-plugin-play");
  if (pluginState.config.enableMeme) initMemeData().catch(() => {
  });
  pluginState.log("info", "Play 娱乐插件初始化完成");
};
const plugin_get_config = async () => pluginState.config;
const plugin_set_config = async (ctx, config) => {
  const old = { ...pluginState.config };
  pluginState.config = config;
  if (config.enableMeme && !old.enableMeme && !pluginState.initialized) {
    initMemeData().catch(() => {
    });
  }
  if (ctx?.configPath) {
    const dir = path.dirname(ctx.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2), "utf-8");
  }
};
const plugin_config_controller = (_ctx, ui, config) => {
  const toggle = (fields, show) => fields.forEach((f) => show ? ui.showField(f) : ui.hideField(f));
  toggle(["memeApiUrl", "maxFileSize", "enableMasterProtect", "ownerQQs"], config.enableMeme !== false);
  toggle(["musicApiUrl"], config.enableMusic !== false);
  toggle(["drawApiUrl"], config.enableDraw !== false);
  return () => {
  };
};
const plugin_on_config_change = (_ctx, ui, key, _value, config) => {
  const toggle = (fields, show) => fields.forEach((f) => show ? ui.showField(f) : ui.hideField(f));
  if (key === "enableMeme") toggle(["memeApiUrl", "maxFileSize", "enableMasterProtect", "ownerQQs"], config.enableMeme !== false);
  if (key === "enableMusic") toggle(["musicApiUrl"], config.enableMusic !== false);
  if (key === "enableDraw") toggle(["drawApiUrl"], config.enableDraw !== false);
};
const plugin_cleanup = async () => {
  pluginState.log("info", "Play 娱乐插件已卸载");
};
const plugin_onmessage = async (ctx, event) => {
  if (event.post_type !== "message") return;
  const raw = event.raw_message || "";
  if (await handleMenuCommand(event, raw, ctx)) return;
  if (pluginState.config.enableMusic && await handleMusicCommand(event, raw, ctx)) return;
  if (pluginState.config.enableDraw && await handleDrawCommand(event, raw, ctx)) return;
  if (pluginState.config.enableMeme) await handleMemeCommand(event, raw, ctx);
};

export { plugin_cleanup, plugin_config_controller, plugin_config_ui, plugin_get_config, plugin_init, plugin_on_config_change, plugin_onmessage, plugin_set_config };
