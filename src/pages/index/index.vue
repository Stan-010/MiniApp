<template>
  <view class="page">
    <!-- 顶部：搜索 + 加菜 -->
    <view class="top-bar">
      <view class="search-box">
        <input
          class="search-input"
          v-model="keyword"
          confirm-type="search"
          placeholder="搜菜名"
          @confirm="doSearch"
        />
        <text v-if="keyword" class="search-clear" @tap="clearSearch">✕</text>
      </view>
      <view class="add-dish-btn" @tap="onAddDish">＋ 新增菜品</view>
    </view>

    <!-- 主体：左分类 + 右菜品 -->
    <view class="main">
      <scroll-view scroll-y class="cat-rail">
        <view
          class="cat-rail-item"
          :class="{ active: currentCategory === 'all' }"
          @tap="selectCategory('all')"
        >全部</view>
        <view
          v-for="c in categories"
          :key="c._id"
          class="cat-rail-item"
          :class="{ active: currentCategory === c._id }"
          @tap="selectCategory(c._id)"
        >{{ c.name }}</view>
      </scroll-view>

      <scroll-view scroll-y class="dish-pane">
        <view v-if="loading" class="empty">加载中…</view>
        <view v-else-if="!dishes.length" class="empty">这个分类还没有菜\n点「＋ 加菜」添加</view>
        <view v-for="d in dishes" :key="d._id" class="dish-row">
          <image v-if="d.image" class="dish-img" :src="d.image" mode="aspectFill" @tap="goDetail(d._id)" />
          <view class="dish-main" @tap="goDetail(d._id)">
            <view class="dish-name-row">
              <text class="dish-name">{{ d.name }}</text>
              <text v-if="d.status === 'pending'" class="pending-tag">待完善</text>
            </view>
            <view v-if="d.customerNote" class="dish-sub">想吃：{{ d.customerNote }}</view>
          </view>
          <view class="add-btn" @tap="changeCount(d, 1)">＋</view>
        </view>
        <view class="pane-pad" />
      </scroll-view>
    </view>

    <!-- 底部：已点栏 -->
    <view class="bottom-bar" @tap="goPreview">
      <view class="bb-count" :class="{ none: appStore.draftCount === 0 }">{{ appStore.draftCount }}</view>
      <text class="bb-text">已点 {{ appStore.draftCount }} 件 · 去下单 ›</text>
    </view>

    <!-- 快速加菜弹层（客户） -->
    <view v-if="showQuickAdd" class="mask" @tap="showQuickAdd = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">新增菜品</view>
        <input class="sheet-input" v-model="quickName" placeholder="菜名（必填）" />
        <textarea
          class="sheet-textarea"
          v-model="quickNote"
          placeholder="想吃备注：口味、忌口等（可选，如：少放辣）"
        />
        <view class="sheet-actions">
          <view class="sheet-btn cancel" @tap="showQuickAdd = false">取消</view>
          <view class="sheet-btn ok" @tap="confirmQuickAdd">{{ savingQuick ? '添加中…' : '加入菜单并点单' }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  listCategories, ensurePresetCategories, listDishes, addDish,
  getDraftOrder, setOrderItem
} from '../../utils/api'
import { serverDate } from '../../utils/cloud'
import { classifyDish } from '../../utils/category-rules'
import { ROLE, DISH_STATUS } from '../../utils/constants'
import { useAppStore } from '../../store/app'

const appStore = useAppStore()
const categories = ref([])
const dishes = ref([])
const keyword = ref('')
const currentCategory = ref('all')
const loading = ref(true)
const draftMap = ref({})
const showQuickAdd = ref(false)
const quickName = ref('')
const quickNote = ref('')
const savingQuick = ref(false)

function countOf(id) {
  return draftMap.value[id] || 0
}

async function loadDishes() {
  const f = {}
  if (currentCategory.value !== 'all') f.categoryId = currentCategory.value
  if (keyword.value.trim()) f.keyword = keyword.value.trim()
  dishes.value = await listDishes(f)
}

async function loadDraft() {
  const draft = await getDraftOrder()
  draftMap.value = {}
  ;(draft && draft.items ? draft.items : []).forEach((i) => {
    draftMap.value[i.dishId] = i.count
  })
}

function promptRole() {
  uni.showActionSheet({
    itemList: ['客户（点单的人）', '厨师（做菜的人）'],
    success: async (res) => {
      const role = res.tapIndex === 0 ? ROLE.CUSTOMER : ROLE.CHEF
      try {
        await appStore.chooseRole(role)
        uni.showToast({ title: '身份已设置', icon: 'none' })
      } catch (e) {
        console.error(e)
      }
    }
  })
}

let groupPrompted = false

async function load() {
  loading.value = true
  try {
    if (!appStore.roleLoaded) await appStore.loadRole()
    if (!appStore.role) promptRole()
    if (!appStore.groupId) {
      if (!groupPrompted) {
        groupPrompted = true
        uni.showModal({
          title: '还没有加入家庭',
          content: '先到「我的」页创建家庭，或输入家人给你的邀请码加入',
          showCancel: false,
          confirmText: '去设置',
          success: () => uni.switchTab({ url: '/pages/mine/mine' })
        })
      }
      dishes.value = []
      categories.value = []
      return
    }
    await ensurePresetCategories()
    categories.value = await listCategories()
    await loadDishes()
    await loadDraft()
    await appStore.refreshCounts()
    // #ifdef MP-WEIXIN
    if (appStore.role === ROLE.CHEF && appStore.orderCount > 0) {
      uni.setTabBarBadge({ index: 1, text: String(appStore.orderCount) })
    } else {
      uni.removeTabBarBadge({ index: 1 })
    }
    // #endif
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function selectCategory(id) {
  currentCategory.value = id
  loadDishes().catch((e) => console.error(e))
}

function doSearch() {
  loadDishes().catch((e) => console.error(e))
}

function clearSearch() {
  keyword.value = ''
  loadDishes().catch((e) => console.error(e))
}

async function changeCount(d, delta) {
  const cur = countOf(d._id)
  const next = Math.max(0, cur + delta)
  draftMap.value[d._id] = next
  try {
    await setOrderItem(d._id, d.name, next, '', d.image || '')
    appStore.draftCount = Object.values(draftMap.value).reduce((s, c) => s + c, 0)
    appStore.refreshCounts()
  } catch (e) {
    draftMap.value[d._id] = cur
    console.error(e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function onAddDish() {
  if (appStore.role === ROLE.CHEF) {
    uni.navigateTo({ url: '/pages/dish-edit/dish-edit' })
  } else {
    showQuickAdd.value = true
  }
}

async function confirmQuickAdd() {
  if (savingQuick.value) return
  const name = quickName.value.trim()
  if (!name) {
    uni.showToast({ title: '请填写菜名', icon: 'none' })
    return
  }
  savingQuick.value = true
  try {
    const note = quickNote.value.trim()
    const categoryId = classifyDish(name, categories.value)
    const res = await addDish({
      name,
      categoryId,
      image: '',
      chefNote: '',
      customerNote: note,
      status: DISH_STATUS.PENDING,
      createdByRole: ROLE.CUSTOMER,
      searchText: (name + ' ' + note).trim(),
      createTime: serverDate(),
      updateTime: serverDate()
    })
    await setOrderItem(res._id, name, 1, note)
    quickName.value = ''
    quickNote.value = ''
    showQuickAdd.value = false
    appStore.refreshCounts()
    uni.showToast({ title: '已加入菜单并点单', icon: 'success' })
    loadDishes().catch((e) => console.error(e))
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '添加失败，请确认云开发已开通', icon: 'none' })
  } finally {
    savingQuick.value = false
  }
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/dish-detail/dish-detail?id=${id}` })
}

function goPreview() {
  uni.navigateTo({ url: '/pages/order-preview/order-preview' })
}

onShow(() => {
  load()
})
</script>

<style>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.top-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 24rpx;
  background: #fff;
}
.search-box {
  flex: 1;
  position: relative;
}
.search-input {
  height: 64rpx;
  background: #f2f2f2;
  border-radius: 32rpx;
  padding: 0 60rpx 0 28rpx;
  font-size: 28rpx;
}
.search-clear {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  padding: 8rpx;
}
.add-dish-btn {
  margin-left: 16rpx;
  color: #fff;
  background: #07c160;
  border-radius: 32rpx;
  font-size: 26rpx;
  padding: 12rpx 24rpx;
}
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.cat-rail {
  width: 176rpx;
  flex-shrink: 0;
  background: #f7f7f7;
  height: 100%;
}
.cat-rail-item {
  padding: 32rpx 12rpx;
  text-align: center;
  font-size: 26rpx;
  color: #666;
  position: relative;
}
.cat-rail-item.active {
  background: #fff;
  color: #07c160;
  font-weight: bold;
}
.cat-rail-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 20rpx;
  bottom: 20rpx;
  width: 6rpx;
  background: #07c160;
  border-radius: 0 3rpx 3rpx 0;
}
.dish-pane {
  flex: 1;
  height: 100%;
  background: #fff;
}
.dish-row {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.dish-img {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #eee;
}
.dish-main {
  flex: 1;
  padding: 0 16rpx;
  overflow: hidden;
}
.dish-name-row {
  display: flex;
  align-items: center;
}
.dish-name {
  font-size: 30rpx;
  font-weight: bold;
}
.pending-tag {
  margin-left: 12rpx;
  font-size: 20rpx;
  color: #fa9d3b;
  border: 1rpx solid #fa9d3b;
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
}
.dish-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #999;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}
.add-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #07c160;
  color: #fff;
  font-size: 36rpx;
  text-align: center;
  line-height: 56rpx;
  flex-shrink: 0;
}
.empty {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.pane-pad {
  height: 120rpx;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100rpx;
  background: #2b2b2b;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
}
.bb-count {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #07c160;
  color: #fff;
  font-size: 24rpx;
  text-align: center;
  line-height: 44rpx;
  margin-right: 16rpx;
}
.bb-count.none {
  background: #666;
}
.bb-text {
  color: #fff;
  font-size: 30rpx;
}
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}
.sheet-title {
  font-size: 32rpx;
  font-weight: bold;
  margin-bottom: 24rpx;
  text-align: center;
}
.sheet-input {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  margin-bottom: 16rpx;
}
.sheet-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 140rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
}
.sheet-actions {
  display: flex;
  margin-top: 32rpx;
}
.sheet-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  border-radius: 42rpx;
  font-size: 30rpx;
  margin: 0 10rpx;
}
.sheet-btn.cancel {
  background: #f2f2f2;
  color: #666;
}
.sheet-btn.ok {
  background: #07c160;
  color: #fff;
}
</style>
