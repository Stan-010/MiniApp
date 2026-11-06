<template>
  <view class="page">
    <view v-if="dish">
      <image v-if="dish.image" class="hero" :src="dish.image" mode="aspectFill" />
      <view class="body">
        <view class="name-row">
          <text class="name">{{ dish.name }}</text>
          <view class="right-actions">
            <text class="fav" @tap="toggleFav">{{ isFav ? '❤️' : '🤍' }}</text>
            <text v-if="dish.status === 'pending'" class="pending-tag">待完善</text>
          </view>
        </view>
        <view class="cat">{{ categoryName }}</view>

        <view v-if="dish.customerNote" class="section">
          <view class="sec-title">客户想吃备注</view>
          <view class="customer-note">{{ dish.customerNote }}</view>
        </view>

        <!-- 厨师视图：做法说明（大长串） -->
        <view v-if="isChef" class="section">
          <view class="sec-title">做法与用料（厨师说明）</view>
          <view v-if="dish.chefNote" class="chef-note">{{ dish.chefNote }}</view>
          <view v-else class="chef-note missing" @tap="goEdit">还没写说明，点此补充 ›</view>
        </view>

        <!-- 客户视图：点单 -->
        <view v-else class="section">
          <view class="sec-title">点单</view>
          <view class="order-row">
            <text class="order-label">数量</text>
            <view class="stepper">
              <view v-if="count > 0" class="step-btn" @tap="changeCount(-1)">−</view>
              <text v-if="count > 0" class="step-num">{{ count }}</text>
              <view class="step-btn plus" @tap="changeCount(1)">＋</view>
            </view>
          </view>
        </view>

        <view class="actions">
          <view v-if="isChef" class="btn primary" @tap="goEdit">编辑菜品</view>
          <view v-if="isChef" class="btn danger" @tap="remove">删除</view>
        </view>
      </view>
    </view>
    <view v-else class="empty">加载中…</view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getDish, removeDish, listCategories, getDraftOrder, setOrderItem,
  listFavoriteDishIds, addFavorite, removeFavoriteByDish
} from '../../utils/api'
import { ROLE } from '../../utils/constants'
import { useAppStore } from '../../store/app'

const appStore = useAppStore()
const id = ref('')
const dish = ref(null)
const isFav = ref(false)
const categories = ref([])
const count = ref(0)

const isChef = computed(() => appStore.role === ROLE.CHEF)

const categoryName = computed(() => {
  if (!dish.value) return ''
  if (dish.value.categoryId === '') return '未分类'
  const c = categories.value.find((x) => x._id === dish.value.categoryId)
  return c ? c.name : '—'
})

async function load() {
  if (!id.value) return
  try {
    if (!appStore.roleLoaded) await appStore.loadRole()
    const [d, cats] = await Promise.all([getDish(id.value), listCategories()])
    dish.value = d.data
    categories.value = cats
    const favs = await listFavoriteDishIds()
    isFav.value = favs.includes(id.value)
    const draft = await getDraftOrder()
    const item = draft && draft.items ? draft.items.find((i) => i.dishId === id.value) : null
    count.value = item ? item.count : 0
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  }
}

async function changeCount(delta) {
  const next = Math.max(0, count.value + delta)
  count.value = next
  try {
    await setOrderItem(dish.value._id, dish.value.name, next, '', dish.value.image || '')
    appStore.refreshCounts()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function toggleFav() {
  try {
    if (isFav.value) await removeFavoriteByDish(id.value)
    else await addFavorite(id.value)
    isFav.value = !isFav.value
    uni.showToast({ title: isFav.value ? '已收藏' : '已取消收藏', icon: 'none' })
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

function goEdit() {
  uni.navigateTo({ url: `/pages/dish-edit/dish-edit?id=${id.value}` })
}

function remove() {
  uni.showModal({
    title: '删除菜品',
    content: `确定删除「${dish.value.name}」？删除后不可恢复。`,
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await removeDish(id.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 600)
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  })
}

onLoad((query) => {
  id.value = query.id || ''
  load()
})
</script>

<style>
.page {
  padding-bottom: 60rpx;
}
.hero {
  width: 100%;
  height: 420rpx;
  background: #eee;
}
.body {
  padding: 24rpx;
}
.name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.name {
  font-size: 40rpx;
  font-weight: bold;
}
.right-actions {
  display: flex;
  align-items: center;
}
.fav {
  font-size: 44rpx;
  padding: 10rpx;
}
.pending-tag {
  font-size: 22rpx;
  color: #fa9d3b;
  border: 1rpx solid #fa9d3b;
  border-radius: 8rpx;
  padding: 4rpx 12rpx;
}
.cat {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #07c160;
}
.section {
  margin-top: 32rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}
.sec-title {
  font-size: 30rpx;
  font-weight: bold;
  margin-bottom: 16rpx;
}
.customer-note {
  font-size: 28rpx;
  color: #fa9d3b;
  line-height: 1.6;
}
.chef-note {
  font-size: 28rpx;
  color: #555;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}
.chef-note.missing {
  color: #07c160;
  background: #f0faf3;
  border-radius: 12rpx;
  padding: 20rpx;
}
.order-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.order-label {
  font-size: 28rpx;
  color: #666;
}
.stepper {
  display: flex;
  align-items: center;
}
.step-btn {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  text-align: center;
  line-height: 64rpx;
  font-size: 36rpx;
  border: 1rpx solid #ccc;
  color: #666;
}
.step-btn.plus {
  background: #07c160;
  border-color: #07c160;
  color: #fff;
}
.step-num {
  min-width: 72rpx;
  text-align: center;
  font-size: 32rpx;
}
.actions {
  display: flex;
  margin-top: 40rpx;
}
.btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 40rpx;
  font-size: 30rpx;
  margin: 0 10rpx;
}
.primary {
  background: #07c160;
  color: #fff;
}
.danger {
  border: 1rpx solid #fa5151;
  color: #fa5151;
  background: #fff;
}
.empty {
  padding: 120rpx 0;
  text-align: center;
  color: #999;
}
</style>
