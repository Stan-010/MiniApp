<template>
  <view class="page">
    <view v-if="fridgeCount === 0 && !loading" class="empty">冰箱里还没有食材\n先去「冰箱」tab 加一些吧</view>
    <template v-else>
      <view class="head-bar">
        <text class="head-text">冰箱现有 {{ fridgeCount }} 种食材 · AI 推荐</text>
        <view class="refresh-btn" @tap="recommend(true)">🔄 换一批</view>
      </view>

      <view v-if="loading" class="loading">AI 正在想菜谱…（约 3–10 秒）</view>
      <view v-else-if="errorMsg" class="empty">{{ errorMsg }}</view>
      <view v-else-if="!dishes.length" class="empty">暂无推荐</view>
      <view v-else>
        <view v-for="(d, idx) in dishes" :key="idx" class="dish-card">
          <view class="card-top">
            <image v-if="imageOf(d)" class="card-img" :src="imageOf(d)" mode="aspectFill" />
            <view v-else class="card-img placeholder">{{ d.name.slice(0, 1) }}</view>
            <view class="card-title">
              <text class="card-name">{{ d.name }}</text>
              <text v-if="d.note" class="card-note">{{ d.note }}</text>
            </view>
          </view>

          <view class="ing-list">
            <view v-for="(ing, i) in d.ingredients" :key="i" class="ing-row">
              <text class="ing-name">{{ ing.name }}</text>
              <text class="ing-amount">{{ ing.amount }}</text>
              <text class="ing-flag" :class="isMissing(d, ing) ? 'missing' : 'have'">
                {{ isMissing(d, ing) ? '缺' : '有' }}
              </text>
            </view>
          </view>

          <view v-if="d.steps && d.steps.length" class="steps">
            <view class="step" v-for="(s, i) in d.steps" :key="i">{{ i + 1 }}. {{ s }}</view>
          </view>

          <view class="card-actions">
            <view class="act-btn" :class="{ done: addedNames.includes(d.name) }" @tap="addToMenu(d)">
              {{ addedNames.includes(d.name) ? '已在菜单' : '加入菜单' }}
            </view>
            <view class="act-btn order" @tap="addToOrder(d)">点这道菜</view>
            <view class="copy-btn" @tap="copyDish(d)">复制</view>
          </view>
        </view>

        <view class="bottom-bar">
          <view class="btn" @tap="copyMissingAll">复制缺料清单</view>
          <view class="btn primary" @tap="copyAll">复制全部推荐</view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { listFridge, listDishes, listCategories, addDish, findDishByName, setOrderItem } from '../../utils/api'
import { serverDate } from '../../utils/cloud'
import { classifyDish } from '../../utils/category-rules'
import { ROLE, DISH_STATUS } from '../../utils/constants'
import { useAppStore } from '../../store/app'

const appStore = useAppStore()
const fridgeItems = ref([])
const dishList = ref([])
const categories = ref([])
const dishes = ref([])
const excludeNames = ref([])
const addedNames = ref([])
const loading = ref(false)
const errorMsg = ref('')
const fridgeCount = ref(-1)

function norm(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase()
}

function isMissing(d, ing) {
  const have = fridgeItems.value.some((f) => norm(f.name) === norm(ing.name) || norm(f.name).includes(norm(ing.name)) || norm(ing.name).includes(norm(f.name)))
  return !have
}

function imageOf(d) {
  const hit = dishList.value.find((x) => norm(x.name) === norm(d.name))
  return hit ? hit.image || '' : ''
}

async function loadBase() {
  const [fridge, all, cats] = await Promise.all([listFridge(), listDishes(), listCategories()])
  fridgeItems.value = fridge
  dishList.value = all
  categories.value = cats
  fridgeCount.value = fridge.length
}

/** 把 AI 推荐的菜整理成厨师大长串说明（用料 + 做法 + 说明） */
function buildChefNote(d) {
  const lines = []
  if (d.ingredients && d.ingredients.length) {
    lines.push('【用料】')
    d.ingredients.forEach((ing) => lines.push(`- ${ing.name}${ing.amount ? ' ' + ing.amount : ''}`))
  }
  if (d.steps && d.steps.length) {
    lines.push('【做法】')
    d.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
  }
  if (d.note) lines.push(`【说明】${d.note}`)
  return lines.join('\n')
}

/** 确保这道菜在菜单里（存在则复用，不存在则创建），返回 { dish, existed } */
async function ensureDishInMenu(d) {
  const name = String(d.name || '').trim()
  if (!name) throw new Error('菜名为空')
  const exist = await findDishByName(name)
  if (exist) return { dish: exist, existed: true }
  const chefNote = buildChefNote(d)
  const res = await addDish({
    name,
    categoryId: classifyDish(name, categories.value),
    image: '',
    chefNote,
    customerNote: '',
    status: DISH_STATUS.READY,
    createdByRole: ROLE.CHEF,
    searchText: (name + ' ' + chefNote).slice(0, 2000),
    createTime: serverDate(),
    updateTime: serverDate()
  })
  return { dish: { _id: res._id, name }, existed: false }
}

async function addToMenu(d) {
  try {
    const { existed } = await ensureDishInMenu(d)
    if (!addedNames.value.includes(d.name)) addedNames.value.push(d.name)
    uni.showToast({ title: existed ? '这道菜已在菜单里' : '已加入菜单', icon: existed ? 'none' : 'success' })
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加入失败', icon: 'none' })
  }
}

async function addToOrder(d) {
  try {
    const { dish } = await ensureDishInMenu(d)
    await setOrderItem(dish._id, dish.name, 1, '')
    appStore.refreshCounts()
    uni.showToast({ title: '已加入点单', icon: 'success' })
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加入失败', icon: 'none' })
  }
}

async function recommend(isRefresh) {
  if (fridgeItems.value.length === 0) {
    errorMsg.value = '冰箱里还没有食材，先去「冰箱」tab 加一些'
    return
  }
  if (isRefresh && dishes.value.length) {
    const names = dishes.value.map((d) => d.name)
    excludeNames.value = excludeNames.value.concat(names).slice(-60)
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await wx.cloud.callFunction({
      name: 'ai-chef',
      data: {
        fridgeItems: fridgeItems.value.map((f) => ({ name: f.name, amount: f.amount, unit: f.unit })),
        excludeNames: excludeNames.value
      }
    })
    const r = res.result || {}
    if (!r.ok) {
      errorMsg.value = (r.message || 'AI 调用失败') + (r.detail ? '\n' + r.detail : '')
      dishes.value = []
      return
    }
    dishes.value = (r.dishes || []).slice(0, 10)
  } catch (e) {
    console.error(e)
    errorMsg.value = '调用失败：请确认 ai-chef 云函数已部署\n' + (e.message || '')
  } finally {
    loading.value = false
  }
}

function dishText(d) {
  const lines = []
  lines.push(d.name)
  lines.push('【用料】')
  ;(d.ingredients || []).forEach((ing) => {
    const miss = isMissing(d, ing)
    lines.push(`- ${ing.name}${ing.amount ? ' ' + ing.amount : ''}${miss ? '（缺）' : ''}`)
  })
  if (d.steps && d.steps.length) {
    lines.push('【做法】')
    d.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
  }
  if (d.note) lines.push(`【备注】${d.note}`)
  return lines.join('\n')
}

function copyDish(d) {
  uni.setClipboardData({ data: dishText(d) })
}

function copyMissingAll() {
  const set = []
  dishes.value.forEach((d) => {
    ;(d.ingredients || []).forEach((ing) => {
      if (isMissing(d, ing) && !set.includes(ing.name)) set.push(ing.name)
    })
  })
  const text = set.length
    ? `缺料清单（共 ${set.length} 种）：\n${set.map((n) => '- ' + n).join('\n')}`
    : '什么都不缺，冰箱食材够做这些菜 🎉'
  uni.setClipboardData({ data: text })
}

function copyAll() {
  uni.setClipboardData({ data: dishes.value.map(dishText).join('\n\n----------\n\n') })
}

onLoad(async () => {
  try {
    await loadBase()
    await recommend(false)
  } catch (e) {
    console.error(e)
    errorMsg.value = '加载失败，请确认云开发已开通'
  }
})
</script>

<style>
.page {
  padding: 24rpx;
  padding-bottom: 140rpx;
}
.head-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.head-text {
  font-size: 26rpx;
  color: #666;
}
.refresh-btn {
  background: #07c160;
  color: #fff;
  font-size: 26rpx;
  border-radius: 32rpx;
  padding: 10rpx 28rpx;
}
.loading {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
.empty {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.dish-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.card-top {
  display: flex;
  align-items: center;
}
.card-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 14rpx;
  background: #eee;
  flex-shrink: 0;
}
.card-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f7ee;
  color: #07c160;
  font-size: 52rpx;
  font-weight: bold;
}
.card-title {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.card-name {
  font-size: 34rpx;
  font-weight: bold;
  display: block;
}
.card-note {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #999;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.ing-list {
  margin-top: 20rpx;
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 8rpx 20rpx;
}
.ing-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #efefef;
}
.ing-row:last-child {
  border-bottom: none;
}
.ing-name {
  flex: 1;
  font-size: 26rpx;
}
.ing-amount {
  font-size: 24rpx;
  color: #999;
  margin-right: 16rpx;
}
.ing-flag {
  font-size: 22rpx;
  border-radius: 6rpx;
  padding: 2rpx 12rpx;
}
.ing-flag.have {
  color: #07c160;
  border: 1rpx solid #07c160;
}
.ing-flag.missing {
  color: #fa5151;
  border: 1rpx solid #fa5151;
  background: #fff5f5;
}
.steps {
  margin-top: 16rpx;
}
.step {
  font-size: 26rpx;
  color: #555;
  line-height: 1.7;
}
.card-actions {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.act-btn {
  font-size: 26rpx;
  color: #fff;
  background: #07c160;
  border-radius: 28rpx;
  padding: 8rpx 28rpx;
  margin-left: 16rpx;
}
.act-btn.order {
  background: #fa9d3b;
}
.act-btn.done {
  background: #e0e0e0;
  color: #999;
}
.copy-btn {
  font-size: 26rpx;
  color: #666;
  border: 1rpx solid #ccc;
  border-radius: 28rpx;
  padding: 8rpx 28rpx;
  margin-left: 16rpx;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #fff;
  display: flex;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  border-radius: 42rpx;
  font-size: 28rpx;
  margin: 0 10rpx;
  border: 1rpx solid #fa9d3b;
  color: #fa9d3b;
  background: #fff;
}
.btn.primary {
  background: #07c160;
  border: none;
  color: #fff;
}
</style>
