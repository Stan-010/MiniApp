/**
 * 数据层：云数据库集合 CRUD 封装
 * 集合：users / categories / dishes / orders / favorites
 * 二期扩展（fridge 等）在文件底部追加模块，保持按集合分块
 */
import { db, getOpenid, serverDate } from './cloud'
import { DISH_STATUS, ORDER_STATUS, PRESET_CATEGORIES, FRIDGE_PRESET_CATEGORIES } from './constants'

const col = (name) => db().collection(name)

/* ---------- 用户与角色 ---------- */

export async function getUser() {
  const openid = await getOpenid()
  const res = await col('users').where({ openid }).get()
  return res.data[0] || null
}

export async function setRole(role) {
  const openid = await getOpenid()
  const exist = await col('users').where({ openid }).get()
  if (exist.data.length) {
    await col('users').doc(exist.data[0]._id).update({ data: { role, updateTime: serverDate() } })
  } else {
    await col('users').add({ data: { openid, role, createTime: serverDate() } })
  }
  return role
}

/* ---------- 分类 ---------- */

export async function listCategories() {
  const res = await col('categories').orderBy('sort', 'asc').orderBy('createTime', 'asc').get()
  return res.data
}

/** 分类集合为空时写入预置分类（幂等） */
export async function ensurePresetCategories() {
  const cnt = await col('categories').count()
  if (cnt.total > 0) return false
  await Promise.all(
    PRESET_CATEGORIES.map((name, i) =>
      col('categories').add({ data: { name, sort: i, isPreset: true, createTime: serverDate() } })
    )
  )
  return true
}

export async function addCategory(name) {
  return col('categories').add({ data: { name, sort: 0, createTime: serverDate() } })
}

export async function updateCategory(id, data) {
  return col('categories').doc(id).update({ data })
}

export async function removeCategory(id) {
  await col('dishes').where({ categoryId: id }).update({ data: { categoryId: '' } })
  return col('categories').doc(id).remove()
}

/* ---------- 菜品 ---------- */

export async function listDishes(filter = {}) {
  let query = col('dishes')
  const conds = []
  if (filter.categoryId !== undefined) conds.push({ categoryId: filter.categoryId })
  if (filter.status) conds.push({ status: filter.status })
  if (filter.keyword) {
    const reg = db().RegExp({ regexp: filter.keyword, options: 'i' })
    conds.push({ searchText: reg })
  }
  if (conds.length === 1) query = query.where(conds[0])
  if (conds.length > 1) query = query.where(db().command.and(conds))
  const res = await query.orderBy('createTime', 'desc').get()
  return res.data
}

export async function listDishesByIds(ids) {
  if (!ids || !ids.length) return []
  const res = await col('dishes').where({ _id: db().command.in(ids) }).get()
  return res.data
}

export async function getDish(id) {
  return col('dishes').doc(id).get()
}

/** 按名称精确查找菜品（不存在返回 null） */
export async function findDishByName(name) {
  const res = await col('dishes').where({ name }).get()
  return res.data[0] || null
}

export async function addDish(data) {
  return col('dishes').add({ data })
}

export async function updateDish(id, data) {
  return col('dishes').doc(id).update({ data })
}

export async function removeDish(id) {
  return col('dishes').doc(id).remove()
}

/** 待厨师完善的菜品列表 */
export async function listPendingDishes() {
  return listDishes({ status: DISH_STATUS.PENDING })
}

/* ---------- 订单 ---------- */

/** 找到当前用户的草稿订单（购物车）；没有则创建一张新草稿 */
async function ensureDraft(openid) {
  const res = await col('orders').where({ openid, status: ORDER_STATUS.DRAFT }).get()
  if (res.data.length) return res.data[0]
  const addRes = await col('orders').add({
    data: {
      openid,
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
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, status: ORDER_STATUS.DRAFT }).get()
  return res.data[0] || null
}

/** 设置点单中某道菜的数量（count<=0 即移除）；新增时写入 note 和 image，更新时保留已有值 */
export async function setOrderItem(dishId, dishName, count, note = '', image = '') {
  const openid = await getOpenid()
  const order = await ensureDraft(openid)
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
}

/** 更新点单中某道菜的备注 */
export async function updateOrderItemNote(dishId, note) {
  const openid = await getOpenid()
  const order = await ensureDraft(openid)
  const items = (order.items || []).map((i) => (i.dishId === dishId ? { ...i, note } : i))
  return col('orders').doc(order._id).update({ data: { items, updateTime: serverDate() } })
}

export async function submitOrder() {
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, status: ORDER_STATUS.DRAFT }).get()
  const order = res.data[0] || null
  if (!order || !(order.items || []).length) throw new Error('还没有点菜')
  return col('orders').doc(order._id).update({
    data: { status: ORDER_STATUS.SUBMITTED, submitTime: serverDate(), updateTime: serverDate() }
  })
}

/** 一键清空购物车（清空当前草稿订单的条目） */
export async function clearDraftOrder() {
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, status: ORDER_STATUS.DRAFT }).get()
  if (!res.data.length) return
  await col('orders').doc(res.data[0]._id).update({ data: { items: [], updateTime: serverDate() } })
}

export async function listSubmittedOrders() {
  const res = await col('orders')
    .where({ status: ORDER_STATUS.SUBMITTED })
    .orderBy('submitTime', 'asc')
    .get()
  return res.data
}

/** 当前用户的点单记录（已下单 + 已完成），供顾客查看历史点单 */
export async function listMyOrders() {
  const openid = await getOpenid()
  const submitted = await col('orders')
    .where({ openid, status: ORDER_STATUS.SUBMITTED })
    .orderBy('submitTime', 'desc')
    .get()
  const done = await col('orders')
    .where({ openid, status: ORDER_STATUS.DONE })
    .orderBy('doneTime', 'desc')
    .limit(20)
    .get()
  return [...submitted.data, ...done.data]
}

export async function listDoneOrders(limit = 10) {
  const res = await col('orders')
    .where({ status: ORDER_STATUS.DONE })
    .orderBy('doneTime', 'desc')
    .limit(limit)
    .get()
  return res.data
}

export async function markOrderDone(id) {
  return col('orders').doc(id).update({ data: { status: ORDER_STATUS.DONE, doneTime: serverDate() } })
}

/* ---------- 冰箱（v0.3） ---------- */

export async function listFridgeCategories() {
  const res = await col('fridgeCategories').orderBy('sort', 'asc').get()
  return res.data
}

/** 冰箱分类集合为空时写入预置分类（幂等） */
export async function ensurePresetFridgeCategories() {
  const cnt = await col('fridgeCategories').count()
  if (cnt.total > 0) return false
  await Promise.all(
    FRIDGE_PRESET_CATEGORIES.map((name, i) =>
      col('fridgeCategories').add({ data: { name, sort: i, isPreset: true, createTime: serverDate() } })
    )
  )
  return true
}

export async function listFridge(filter = {}) {
  let query = col('fridge')
  if (filter.categoryId !== undefined) query = query.where({ categoryId: filter.categoryId })
  const res = await query.orderBy('addTime', 'desc').get()
  return res.data
}

export async function addFridge(data) {
  return col('fridge').add({ data })
}

export async function updateFridge(id, data) {
  return col('fridge').doc(id).update({ data })
}

export async function removeFridge(id) {
  return col('fridge').doc(id).remove()
}

/** 清理已过期食材，返回清理数量 */
export async function removeExpiredFridge() {
  const all = await listFridge()
  const now = Date.now()
  const expired = all.filter(
    (f) => f.addTime && f.days && new Date(f.addTime).getTime() + f.days * 86400000 < now
  )
  await Promise.all(expired.map((f) => col('fridge').doc(f._id).remove()))
  return expired.length
}

/* ---------- 收藏 ---------- */

export async function listFavoriteDishIds() {
  const openid = await getOpenid()
  const res = await col('favorites').where({ openid }).get()
  return res.data.map((f) => f.dishId)
}

export async function addFavorite(dishId) {
  const openid = await getOpenid()
  return col('favorites').add({ data: { openid, dishId, createTime: serverDate() } })
}

export async function removeFavoriteByDish(dishId) {
  const openid = await getOpenid()
  const res = await col('favorites').where({ openid, dishId }).get()
  await Promise.all(res.data.map((f) => col('favorites').doc(f._id).remove()))
}
