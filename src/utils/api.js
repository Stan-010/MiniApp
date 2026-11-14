/**
 * 数据层：云数据库集合 CRUD 封装（组隔离 v0.4）
 * 集合：users / groups / categories / dishes / orders / favorites / fridge / fridgeCategories
 * 所有业务数据按 groupId 隔离；写操作强制携带本组 groupId。
 * 所有写操作统一经 withLog 记录运行日志（logs 集合 + Console）。
 */
import { db, getOpenid, serverDate } from './cloud'
import { log } from './logger'
import { DISH_STATUS, ORDER_STATUS, PRESET_CATEGORIES, FRIDGE_PRESET_CATEGORIES } from './constants'

const col = (name) => db().collection(name)

/* ---------- AI 每日次数（aiUsage 集合，按 openid+日期 计数） ---------- */

function todayStr() {
  const t = new Date()
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}

export async function getAiDailyCount() {
  const openid = await getOpenid()
  try {
    const res = await col('aiUsage').doc(openid + '_' + todayStr()).get()
    return (res.data && res.data.count) || 0
  } catch (e) {
    return 0
  }
}

export async function incAiDailyCount() {
  const openid = await getOpenid()
  const key = openid + '_' + todayStr()
  try {
    await col('aiUsage').doc(key).update({ data: { count: db().command.inc(1) } })
  } catch (e) {
    try {
      await col('aiUsage').add({ data: { _id: key, count: 1, date: todayStr(), createTime: serverDate() } })
    } catch (e2) {
      try {
        await col('aiUsage').doc(key).update({ data: { count: db().command.inc(1) } })
      } catch (e3) {
        // 忽略：计数失败不阻断推荐
      }
    }
  }
}

/** 包装写操作：成功/失败都记日志（detail 可为函数，在成功后求值） */
async function withLog(action, fn, detail = '') {
  try {
    const r = await fn()
    const d = typeof detail === 'function' ? detail(r) : detail
    log(action, d || '成功')
    return r
  } catch (e) {
    const d = typeof detail === 'function' ? '' : detail
    log(action, (d ? d + ' ' : '') + '失败: ' + ((e && e.message) || e), 'error')
    throw e
  }
}

/* ---------- 用户 / 组 ---------- */

export async function getUser() {
  const openid = await getOpenid()
  const res = await col('users').where({ openid }).get()
  return res.data[0] || null
}

export function setRole(role) {
  return withLog('切换身份', async () => {
    const openid = await getOpenid()
    const exist = await col('users').where({ openid }).get()
    if (exist.data.length) {
      await col('users').doc(exist.data[0]._id).update({ data: { role, updateTime: serverDate() } })
    } else {
      await col('users').add({ data: { openid, role, groupId: '', createTime: serverDate() } })
    }
    return role
  }, role)
}

/** 当前用户所在组 id；未入组返回 '' */
export async function getGroupId() {
  const u = await getUser()
  return u ? u.groupId || '' : ''
}

/** 必须已入组，否则抛错 */
async function requireGroup() {
  const groupId = await getGroupId()
  if (!groupId) throw new Error('未加入家庭')
  return groupId
}

async function setUserGroup(openid, groupId, role) {
  const exist = await col('users').where({ openid }).get()
  if (exist.data.length) {
    await col('users').doc(exist.data[0]._id).update({ data: { groupId, role, updateTime: serverDate() } })
  } else {
    await col('users').add({ data: { openid, groupId, role, createTime: serverDate() } })
  }
}

/** 把历史无组数据归入指定组（一次性迁移） */
async function migrateAllToGroup(groupId) {
  const colls = ['categories', 'dishes', 'orders', 'favorites', 'fridge', 'fridgeCategories']
  for (const name of colls) {
    await col(name).where({ groupId: db().command.exists(false) }).update({ data: { groupId } })
  }
}

/** 创建家庭组（创建者选身份，每组可多个厨师） */
export function createGroup(name, role) {
  return withLog('创建家庭', async () => {
    const openid = await getOpenid()
    let inviteCode = ''
    for (let i = 0; i < 10; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const dup = await col('groups').where({ inviteCode: code }).get()
      if (!dup.data.length) {
        inviteCode = code
        break
      }
    }
    if (!inviteCode) throw new Error('邀请码生成失败，请重试')
    const res = await col('groups').add({
      data: { name: name.trim() || '我的家庭', inviteCode, createTime: serverDate() }
    })
    const groupId = res._id
    await setUserGroup(openid, groupId, role)
    await migrateAllToGroup(groupId)
    return { groupId, inviteCode, name }
  }, `${name} / ${role}`)
}

/** 通过邀请码加入家庭组 */
export function joinGroup(inviteCode, role) {
  return withLog('加入家庭', async () => {
    const openid = await getOpenid()
    const res = await col('groups').where({ inviteCode: String(inviteCode).trim() }).get()
    if (!res.data.length) throw new Error('邀请码不存在')
    await setUserGroup(openid, res.data[0]._id, role)
    return res.data[0]
  }, `邀请码 ${inviteCode} / ${role}`)
}

/** 退出当前家庭组（数据保留在原组） */
export function leaveGroup() {
  return withLog('退出家庭', async () => {
    const openid = await getOpenid()
    const exist = await col('users').where({ openid }).get()
    if (exist.data.length) {
      await col('users').doc(exist.data[0]._id).update({ data: { groupId: '', updateTime: serverDate() } })
    }
  })
}

/** 当前组信息（名称、邀请码）；未入组返回 null */
export async function getGroupInfo() {
  const groupId = await getGroupId()
  if (!groupId) return null
  try {
    const res = await col('groups').doc(groupId).get()
    return res.data
  } catch (e) {
    return null
  }
}

/** 本组成员数 */
export async function countGroupMembers() {
  const groupId = await getGroupId()
  if (!groupId) return 0
  const res = await col('users').where({ groupId }).count()
  return res.total
}

/* ---------- 分类 ---------- */

export async function listCategories() {
  const groupId = await getGroupId()
  if (!groupId) return []
  const res = await col('categories').where({ groupId }).orderBy('sort', 'asc').orderBy('createTime', 'asc').get()
  return res.data
}

/** 本组没有分类时写入预置分类（幂等） */
export async function ensurePresetCategories() {
  const groupId = await requireGroup()
  const cnt = await col('categories').where({ groupId }).count()
  if (cnt.total > 0) return false
  await Promise.all(
    PRESET_CATEGORIES.map((name, i) =>
      col('categories').add({ data: { name, groupId, sort: i, isPreset: true, createTime: serverDate() } })
    )
  )
  return true
}

export function addCategory(name) {
  return withLog('新增分类', async () => {
    const groupId = await requireGroup()
    return col('categories').add({ data: { name, groupId, sort: 0, createTime: serverDate() } })
  }, name)
}

export async function updateCategory(id, data) {
  return col('categories').doc(id).update({ data })
}

export function removeCategory(id) {
  return withLog('删除分类', async () => {
    await col('dishes').where({ categoryId: id }).update({ data: { categoryId: '' } })
    return col('categories').doc(id).remove()
  }, id)
}

/* ---------- 菜品 ---------- */

export async function listDishes(filter = {}) {
  const groupId = await getGroupId()
  if (!groupId) return []
  let query = col('dishes')
  const conds = [{ groupId }]
  if (filter.categoryId !== undefined) conds.push({ categoryId: filter.categoryId })
  if (filter.status) conds.push({ status: filter.status })
  if (filter.keyword) {
    const reg = db().RegExp({ regexp: filter.keyword, options: 'i' })
    conds.push({ searchText: reg })
  }
  query = query.where(db().command.and(conds))
  const res = await query.orderBy('createTime', 'desc').get()
  return res.data
}

export async function listDishesByIds(ids) {
  if (!ids || !ids.length) return []
  const groupId = await getGroupId()
  if (!groupId) return []
  const res = await col('dishes').where({ groupId, _id: db().command.in(ids) }).get()
  return res.data
}

export async function getDish(id) {
  return col('dishes').doc(id).get()
}

/** 按名称精确查找本组菜品（不存在返回 null） */
export async function findDishByName(name) {
  const groupId = await getGroupId()
  if (!groupId) return null
  const res = await col('dishes').where({ groupId, name }).get()
  return res.data[0] || null
}

export function addDish(data) {
  return withLog('新增菜品', async () => {
    const groupId = await requireGroup()
    return col('dishes').add({ data: { ...data, groupId } })
  }, (data && data.name) || '')
}

export function updateDish(id, data) {
  return withLog('编辑菜品', async () => {
    return col('dishes').doc(id).update({ data })
  }, (data && data.name) || id)
}

export function removeDish(id) {
  return withLog('删除菜品', async () => {
    return col('dishes').doc(id).remove()
  }, id)
}

/** 待厨师完善的菜品列表 */
export async function listPendingDishes() {
  return listDishes({ status: DISH_STATUS.PENDING })
}

/* ---------- 订单 ---------- */

/** 找到当前用户在本组的草稿订单（购物车）；没有则创建一张新草稿 */
async function ensureDraft(openid, groupId) {
  const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
  if (res.data.length) return res.data[0]
  const addRes = await col('orders').add({
    data: {
      openid,
      groupId,
      items: [],
      status: ORDER_STATUS.DRAFT,
      createTime: serverDate(),
      updateTime: serverDate()
    }
  })
  const g = await col('orders').doc(addRes._id).get()
  return g.data
}

/** 当前用户的草稿订单（购物车）；没有或已下单则返回 null */
export async function getDraftOrder() {
  const groupId = await getGroupId()
  if (!groupId) return null
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
  return res.data[0] || null
}

/** 设置点单中某道菜的数量（count<=0 即移除）；新增时写入 note 和 image，更新时保留已有值 */
export function setOrderItem(dishId, dishName, count, note = '', image = '') {
  return withLog('点单增减', async () => {
    const groupId = await requireGroup()
    const openid = await getOpenid()
    const order = await ensureDraft(openid, groupId)
    const items = [...(order.items || [])]
    const idx = items.findIndex((i) => i.dishId === dishId)
    if (count <= 0) {
      if (idx >= 0) items.splice(idx, 1)
    } else if (idx >= 0) {
      items[idx] = { ...items[idx], count, image: image || items[idx].image || '' }
    } else {
      items.push({ dishId, dishName, count, note, image })
    }
    return col('orders').doc(order._id).update({ data: { items, updateTime: serverDate() } })
  }, `${dishName} x${count}`)
}

/** 更新点单中某道菜的备注 */
export function updateOrderItemNote(dishId, note) {
  return withLog('修改点单备注', async () => {
    const groupId = await requireGroup()
    const openid = await getOpenid()
    const order = await ensureDraft(openid, groupId)
    const items = (order.items || []).map((i) => (i.dishId === dishId ? { ...i, note } : i))
    return col('orders').doc(order._id).update({ data: { items, updateTime: serverDate() } })
  }, String(note).slice(0, 50))
}

export function submitOrder() {
  let count = 0
  return withLog('下单', async () => {
    const groupId = await requireGroup()
    const openid = await getOpenid()
    const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
    const order = res.data[0] || null
    if (!order || !(order.items || []).length) throw new Error('还没有点菜')
    count = (order.items || []).length
    return col('orders').doc(order._id).update({
      data: { status: ORDER_STATUS.SUBMITTED, submitTime: serverDate(), updateTime: serverDate() }
    })
  }, () => count + ' 道菜')
}

/** 一键清空购物车（清空当前草稿订单的条目） */
export function clearDraftOrder() {
  return withLog('清空购物车', async () => {
    const groupId = await getGroupId()
    if (!groupId) return
    const openid = await getOpenid()
    const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
    if (!res.data.length) return
    await col('orders').doc(res.data[0]._id).update({ data: { items: [], updateTime: serverDate() } })
  })
}

export async function listSubmittedOrders() {
  const groupId = await getGroupId()
  if (!groupId) return []
  const res = await col('orders')
    .where({ groupId, status: ORDER_STATUS.SUBMITTED })
    .orderBy('submitTime', 'asc')
    .get()
  return res.data
}

/** 当前用户的点单记录（已下单 + 已完成），供顾客查看历史点单 */
export async function listMyOrders() {
  const groupId = await getGroupId()
  if (!groupId) return []
  const openid = await getOpenid()
  const submitted = await col('orders')
    .where({ openid, groupId, status: ORDER_STATUS.SUBMITTED })
    .orderBy('submitTime', 'desc')
    .get()
  const done = await col('orders')
    .where({ openid, groupId, status: ORDER_STATUS.DONE })
    .orderBy('doneTime', 'desc')
    .limit(20)
    .get()
  return [...submitted.data, ...done.data]
}

export async function listDoneOrders(limit = 10) {
  const groupId = await getGroupId()
  if (!groupId) return []
  const res = await col('orders')
    .where({ groupId, status: ORDER_STATUS.DONE })
    .orderBy('doneTime', 'desc')
    .limit(limit)
    .get()
  return res.data
}

export function markOrderDone(id) {
  return withLog('完成订单', async () => {
    return col('orders').doc(id).update({ data: { status: ORDER_STATUS.DONE, doneTime: serverDate() } })
  }, id)
}

/* ---------- 冰箱（v0.3） ---------- */

export async function listFridgeCategories() {
  const groupId = await getGroupId()
  if (!groupId) return []
  const res = await col('fridgeCategories').where({ groupId }).orderBy('sort', 'asc').get()
  return res.data
}

/** 本组没有冰箱分类时写入预置分类（幂等） */
export async function ensurePresetFridgeCategories() {
  const groupId = await requireGroup()
  const cnt = await col('fridgeCategories').where({ groupId }).count()
  if (cnt.total > 0) return false
  await Promise.all(
    FRIDGE_PRESET_CATEGORIES.map((name, i) =>
      col('fridgeCategories').add({ data: { name, groupId, sort: i, isPreset: true, createTime: serverDate() } })
    )
  )
  return true
}

export async function listFridge(filter = {}) {
  const groupId = await getGroupId()
  if (!groupId) return []
  let query = col('fridge').where({ groupId })
  if (filter.categoryId !== undefined) query = query.where({ categoryId: filter.categoryId })
  const res = await query.orderBy('addTime', 'desc').get()
  return res.data
}

export function addFridge(data) {
  return withLog('冰箱入库', async () => {
    const groupId = await requireGroup()
    return col('fridge').add({ data: { ...data, groupId } })
  }, `${(data && data.name) || ''} ${(data && data.amount) || ''}${(data && data.unit) || ''}`)
}

export function updateFridge(id, data) {
  return withLog('冰箱编辑', async () => {
    return col('fridge').doc(id).update({ data })
  }, (data && data.name) || id)
}

export function removeFridge(id) {
  return withLog('冰箱删除', async () => {
    return col('fridge').doc(id).remove()
  }, id)
}

/** 清理本组已过期食材，返回清理数量 */
export function removeExpiredFridge() {
  return withLog('清理过期食材', async () => {
    const all = await listFridge()
    const now = Date.now()
    const expired = all.filter(
      (f) => f.addTime && f.days && new Date(f.addTime).getTime() + f.days * 86400000 < now
    )
    await Promise.all(expired.map((f) => col('fridge').doc(f._id).remove()))
    return expired.length
  })
}

/* ---------- 收藏 ---------- */

export async function listFavoriteDishIds() {
  const groupId = await getGroupId()
  if (!groupId) return []
  const openid = await getOpenid()
  const res = await col('favorites').where({ openid, groupId }).get()
  return res.data.map((f) => f.dishId)
}

export function addFavorite(dishId) {
  return withLog('收藏菜品', async () => {
    const groupId = await requireGroup()
    const openid = await getOpenid()
    return col('favorites').add({ data: { openid, groupId, dishId, createTime: serverDate() } })
  }, dishId)
}

export function removeFavoriteByDish(dishId) {
  return withLog('取消收藏', async () => {
    const groupId = await getGroupId()
    if (!groupId) return
    const openid = await getOpenid()
    const res = await col('favorites').where({ openid, groupId, dishId }).get()
    await Promise.all(res.data.map((f) => col('favorites').doc(f._id).remove()))
  }, dishId)
}
