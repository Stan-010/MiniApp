/**
 * 运行日志：所有关键操作写入云数据库 logs 集合，
 * 同时镜像到开发者工具 Console（方便开发时看）。
 * 日志写入失败不影响业务。
 */
import { db, getOpenid, serverDate } from './cloud'

export async function log(action, detail = '', level = 'info') {
  const line = `[${level}] ${action}${detail ? ' | ' + detail : ''}`
  if (level === 'error') console.error(line)
  else console.log(line)
  try {
    const openid = await getOpenid()
    await db().collection('logs').add({
      data: {
        openid,
        openidTail: openid.slice(-6),
        action: String(action).slice(0, 100),
        detail: String(detail).slice(0, 300),
        level,
        time: serverDate()
      }
    })
  } catch (e) {
    console.warn('[log] 日志写入失败（请确认已创建 logs 集合）', e && e.message)
  }
}
