/**
 * 把 cloudfunctions 同步到 mp-weixin 构建产物目录，
 * 并给 project.config.json 补上 cloudfunctionRoot。
 * 用法：node scripts/copy-cloud.mjs [输出目录]
 * 默认输出目录：dist/build/mp-weixin
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'build', 'mp-weixin');

// 1. 拷贝云函数目录
const cfSrc = join(root, 'cloudfunctions');
if (existsSync(cfSrc)) {
  const cfDst = join(out, 'cloudfunctions');
  mkdirSync(cfDst, { recursive: true });
  cpSync(cfSrc, cfDst, { recursive: true });
}

// 2. project.config.json 补 cloudfunctionRoot
const pc = join(out, 'project.config.json');
if (existsSync(pc)) {
  const conf = JSON.parse(readFileSync(pc, 'utf8'));
  conf.cloudfunctionRoot = 'cloudfunctions/';
  writeFileSync(pc, JSON.stringify(conf, null, 2));
}

console.log('[copy-cloud] 云函数已同步到', out);
