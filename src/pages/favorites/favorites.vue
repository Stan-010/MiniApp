<template>
  <view class="page">
    <view v-if="!dishes.length" class="empty">还没有收藏\n在菜品详情页点 🤍 收藏</view>
    <view v-else class="dish-list">
      <view v-for="d in dishes" :key="d._id" class="dish-card" @tap="goDetail(d._id)">
        <image v-if="d.image" class="dish-img" :src="d.image" mode="aspectFill" />
        <view class="dish-info">
          <view class="dish-name">{{ d.name }}</view>
          <view class="dish-ing">{{ previewText(d) }}</view>
        </view>
        <text class="unfav" @tap.stop="unfav(d)">❤️</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listFavoriteDishIds, listDishesByIds, removeFavoriteByDish } from '../../utils/api'

const dishes = ref([])

function previewText(d) {
  const t = d.customerNote || d.chefNote || ''
  return t.split('\n')[0]
}

async function load() {
  try {
    const ids = await listFavoriteDishIds()
    dishes.value = await listDishesByIds(ids)
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  }
}

async function unfav(d) {
  try {
    await removeFavoriteByDish(d._id)
    load()
  } catch (e) {
    console.error(e)
  }
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/dish-detail/dish-detail?id=${id}` })
}

onShow(load)
</script>

<style>
.page {
  padding: 24rpx;
}
.empty {
  padding: 120rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.dish-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}
.dish-img {
  width: 140rpx;
  height: 140rpx;
  flex-shrink: 0;
  background: #eee;
}
.dish-info {
  flex: 1;
  padding: 20rpx 24rpx;
  overflow: hidden;
}
.dish-name {
  font-size: 30rpx;
  font-weight: bold;
}
.dish-ing {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #999;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}
.unfav {
  padding: 0 24rpx;
  font-size: 36rpx;
}
</style>
