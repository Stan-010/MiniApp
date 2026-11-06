// 云函数：ai-chef —— 根据冰箱食材调用大模型推荐菜品
// 配置见 config.json（OpenAI 兼容接口，换模型只改配置）
const cloud = require('wx-server-sdk')
const axios = require('axios')
const config = require('./config.json')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function parseDishes(text) {
  if (!text) return []
  let t = String(text).trim()
  t = t.replace(/```json/gi, '').replace(/```/g, '')
  try {
    const parsed = JSON.parse(t)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.dishes)) return parsed.dishes
  } catch (e) {
    const s = t.indexOf('[')
    const en = t.lastIndexOf(']')
    if (s >= 0 && en > s) {
      try {
        return JSON.parse(t.slice(s, en + 1))
      } catch (e2) {
        /* ignore */
      }
    }
  }
  return []
}

exports.main = async (event) => {
  const fridgeItems = (event.fridgeItems || [])
    .map((f) => `${f.name}${f.amount ? ' ' + f.amount + (f.unit || '') : ''}`)
  const excludeNames = event.excludeNames || []

  if (!fridgeItems.length) return { ok: false, message: '冰箱里还没有食材，先去冰箱加一些' }
  if (!config.apiKey) return { ok: false, message: 'AI 未配置 API Key（见 cloudfunctions/ai-chef/config.json）' }

  const system = `你是一位家庭厨师助手。请根据用户冰箱里现有的食材，推荐今天可以做的家常菜。
要求：
1. 推荐 5~10 道菜（不少于 5 道，最多 10 道）；
2. 优先使用冰箱里已有的食材，每道菜尽量大部分用料都来自冰箱；
3. 不要推荐用户明确排除的菜；
4. 每道菜返回：菜名 name、所需用料 ingredients（每项含 name 名称和 amount 大致用量）、做法 steps（3~6 个简短步骤）、note 一句话说明；
5. 输出 JSON 对象，格式：{"dishes":[{...}]}`

  const user = `冰箱里的食材：\n${fridgeItems.join('、')}\n\n排除的菜（不要推荐）：\n${excludeNames.length ? excludeNames.join('、') : '（无）'}\n\n每道菜的字段：
{"name":"西红柿炒鸡蛋","ingredients":[{"name":"鸡蛋","amount":"3个"},{"name":"西红柿","amount":"2个"}],"steps":["鸡蛋打散加盐","西红柿切块","热油炒蛋盛出","炒西红柿出汁后回锅","调味出锅"],"note":"经典快手菜"}`

  try {
    const resp = await axios.post(
      `${config.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      },
      {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        timeout: 60000
      }
    )
    const text = resp.data && resp.data.choices && resp.data.choices[0] && resp.data.choices[0].message.content
    const dishes = parseDishes(text)
    if (!dishes.length) {
      return { ok: false, message: 'AI 返回内容解析失败', raw: String(text || '').slice(0, 200) }
    }
    return { ok: true, dishes }
  } catch (e) {
    const detail = (e.response && e.response.data && JSON.stringify(e.response.data).slice(0, 300)) || e.message
    return { ok: false, message: 'AI 调用失败', detail }
  }
}
