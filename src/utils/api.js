/**
 * 数据层：云数据库集合 CRUD 封装（组隔离 v0.4）
 * 集合：users / groups / categories / dishes / orders / favorites / fridge / fridgeCategories
 * 所有业务数据按 groupId 隔离；写操作强制携带本组 groupId。
 */
import { db, getOpenid, serverDate } from './cloud'
import { DISH_STATUS, ORDER_STATUS, PRESET_CATEGORIES, FRIDGE_PRESET_CATEGORIES } from './constants'

const col = (name) => db().collection(name)

/* ---------- 用户 / 组 ---------- */

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
    await col('users').add({ data: { openid, role, groupId: '', createTime: serverDate() } })
  }
  return role
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
export async function createGroup(name, role) {
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
}

/** 通过邀请码加入家庭组 */
export async function joinGroup(inviteCode, role) {
  const openid = await getOpenid()
  const res = await col('groups').where({ inviteCode: String(inviteCode).trim() }).get()
  if (!res.data.length) throw new Error('邀请码不存在')
  await setUserGroup(openid, res.data[0]._id, role)
  return res.data[0]
}

/** 退出当前家庭组（数据保留在原组） */
export async function leaveGroup() {
  const openid = await getOpenid()
  const exist = await col('users').where({ openid }).get()
  if (exist.data.length) {
    await col('users').doc(exist.data[0]._id).update({ data: { groupId: '', updateTime: serverDate() } })
  }
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

export async function addCategory(name) {
  const groupId = await requireGroup()
  return col('categories').add({ data: { name, groupId, sort: 0, createTime: serverDate() } })
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

export async function addDish(data) {
  const groupId = await requireGroup()
  return col('dishes').add({ data: { ...data, groupId } })
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
export async function setOrderItem(dishId, dishName, count, note = '', image = '') {
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
}

/** 更新点单中某道菜的备注 */
export async function updateOrderItemNote(dishId, note) {
  const groupId = await requireGroup()
  const openid = await getOpenid()
  const order = await ensureDraft(openid, groupId)
  const items = (order.items || []).map((i) => (i.dishId === dishId ? { ...i, note } : i))
  return col('orders').doc(order._id).update({ data: { items, updateTime: serverDate() } })
}

export async function submitOrder() {
  const groupId = await requireGroup()
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
  const order = res.data[0] || null
  if (!order || !(order.items || []).length) throw new Error('还没有点菜')
  return col('orders').doc(order._id).update({
    data: { status: ORDER_STATUS.SUBMITTED, submitTime: serverDate(), updateTime: serverDate() }
  })
}

/** 一键清空购物车（清空当前草稿订单的条目） */
export async function clearDraftOrder() {
  const groupId = await getGroupId()
  if (!groupId) return
  const openid = await getOpenid()
  const res = await col('orders').where({ openid, groupId, status: ORDER_STATUS.DRAFT }).get()
  if (!res.data.length) return
  await col('orders').doc(res.data[0]._id).update({ data: { items: [], updateTime: serverDate() } })
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

export async function markOrderDone(id) {
  return col('orders').doc(id).update({ data: { status: ORDER_STATUS.DONE, doneTime: serverDate() } })
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

export async function addFridge(data) {
  const groupId = await requireGroup()
  return col('fridge').add({ data: { ...data, groupId } })
}

export async function updateFridge(id, data) {
  return col('fridge').doc(id).update({ data })
}

export async function removeFridge(id) {
  return col('fridge').doc(id).remove()
}

/** 清理本组已过期食材，返回清理数量 */
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
  const groupId = await getGroupId()
  if (!groupId) return []
  const openid = await getOpenid()
  const res = await col('favorites').where({ openid, groupId }).get()
  return res.data.map((f) => f.dishId)
}

export async function addFavorite(dishId) {
  const groupId = await requireGroup()
  const openid = await getOpenid()
  return col('favorites').add({ data: { openid, groupId, dishId, createTime: serverDate() } })
}

export async function removeFavoriteByDish(dishId) {
  const groupId = await getGroupId()
  if (!groupId) return
  const openid = await getOpenid()
  const res = await col('favorites').where({ openid, groupId, dishId }).get()
  await Promise.all(res.data.map((f) => col('favorites').doc(f._id).remove()))
}
