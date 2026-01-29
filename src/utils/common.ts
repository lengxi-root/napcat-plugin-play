// 公共工具函数
import fs from 'fs';
import path from 'path';

// 创建目录
export function mkdirs (dir: string): boolean {
  if (fs.existsSync(dir)) return true;
  if (mkdirs(path.dirname(dir))) { fs.mkdirSync(dir); return true; }
  return false;
}

// 删除文件
export function deleteFile (p: string): boolean {
  if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  return false;
}

// 检查文件大小是否超限
export function checkFileSize (files: { size?: number; }[], maxMB: number): boolean {
  const max = maxMB * 1024 * 1024;
  return files.some(f => (f.size ?? 0) >= max);
}

// 去除开头字符
export function trimStart (str: string, char: string): string {
  return str.replace(new RegExp(`^[${char}]+`), '');
}

// 去除两端字符
export function trimChar (str: string, char: string): string {
  return str.replace(new RegExp(`^[${char}]+|[${char}]+$`, 'g'), '');
}

// 获取头像URL
export function getAvatarUrl (userId: string | number, size: number = 160): string {
  return `https://q1.qlogo.cn/g?b=qq&s=${size}&nk=${userId}`;
}
