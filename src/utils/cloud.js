/**
 * 微信云开发封装
 * 环境 ID：留空表示使用默认环境；
 * 如有多个云环境，把 CLOUD_ENV 改成你的环境 ID，例如 'cloud1-xxxxxx'
 */
export const CLOUD_ENV = 'cloud1-d8gpiixhe09deeed2';

let inited = false;

export function initCloud() {
  if (inited) return;
  inited = true;
  if (typeof wx === 'undefined' || !wx.cloud) {
    console.error('[cloud] 当前环境不支持云开发（请在微信开发者工具或真机中使用）');
    return;
  }
  wx.cloud.init({
    env: CLOUD_ENV || undefined,
    traceUser: true
  });
}

export function db() {
  initCloud();
  return wx.cloud.database();
}

export function serverDate() {
  return db().serverDate();
}

let openidPromise = null;

/** 通过 login 云函数获取当前用户 openid（带缓存） */
export function getOpenid() {
  initCloud();
  if (!openidPromise) {
    openidPromise = wx.cloud
      .callFunction({ name: 'login' })
      .then((res) => {
        const openid = res.result && res.result.openid;
        if (!openid) throw new Error('未获取到 openid');
        return openid;
      })
      .catch((err) => {
        openidPromise = null;
        throw err;
      });
  }
  return openidPromise;
}
