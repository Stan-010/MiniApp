/**
 * 菜品自动归类：关键词规则匹配
 * 规则表按顺序匹配，命中即返回对应分类；
 * 后期想调整只需改这张表，或新增规则对象。
 */
export const CATEGORY_RULES = [
  { category: '汤羹', keywords: ['汤'] },
  { category: '凉菜', keywords: ['凉拌', '沙拉', '拍黄瓜', '卤'] },
  { category: '饮品', keywords: ['茶', '咖啡', '奶', '果汁', '汽水', '饮'] },
  { category: '主食', keywords: ['饭', '面', '粉', '饼', '饺', '包', '粥', '馄饨', '馒头'] },
  { category: '荤菜', keywords: ['肉', '鸡', '鸭', '鹅', '鱼', '虾', '蟹', '牛', '羊', '猪', '排', '蛋', '肠', '肚', '贝'] },
  { category: '素菜', keywords: ['菜', '菇', '豆腐', '土豆', '茄子', '豆角', '藕', '笋', '番茄'] }
]

/**
 * 根据菜名给出分类 id
 * @param {string} name 菜名
 * @param {Array} categories 分类列表 [{_id, name}]
 * @returns {string} 分类 _id；未命中返回 ''
 */
export function classifyDish(name, categories) {
  if (!name || !categories || !categories.length) return ''
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => name.includes(k))) {
      const c = categories.find((x) => x.name === rule.category)
      if (c) return c._id
    }
  }
  return ''
}
