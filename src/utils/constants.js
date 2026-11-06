/**
 * 全局常量：角色 / 状态机 / 预置分类
 * 二期扩展（冰箱、推荐等）也在这里加常量，不动业务代码结构
 */
export const ROLE = {
  CUSTOMER: 'customer',
  CHEF: 'chef'
}

export const ROLE_NAMES = {
  customer: '客户（点单）',
  chef: '厨师（做菜）'
}

export const DISH_STATUS = {
  PENDING: 'pending', // 待厨师完善
  READY: 'ready'      // 已完善
}

export const ORDER_STATUS = {
  DRAFT: 'draft',         // 点单中（未下单）
  SUBMITTED: 'submitted', // 已下单，厨师待做
  DONE: 'done'            // 已完成（历史）
}

export const ORDER_STATUS_NAMES = {
  draft: '点单中',
  submitted: '待做',
  done: '已完成'
}

/** 预置分类（首次启动自动写入，可增删） */
export const PRESET_CATEGORIES = ['荤菜', '素菜', '汤羹', '主食', '凉菜', '饮品']
