<template>
  <view class="page">
    <view class="role-card">
      <view class="role-line">
        <text class="role-label">当前身份</text>
        <text class="role-value">{{ roleName }}</text>
      </view>
      <view class="role-switch" @tap="switchRole">切换身份</view>
      <view class="role-desc">客户：点单、加菜（只需菜名+备注）\n厨师：写做法用料、看订单、补全菜品</view>
    </view>

    <view class="menu">
      <view class="menu-row" @tap="go('/pages/favorites/favorites')">
        <text>我的收藏</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-row" @tap="go('/pages/category-manage/category-manage')">
        <text>分类管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-row" @tap="go('/pages/order-preview/order-preview')">
        <text>我的购物车</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="about">
      <view>家庭菜谱 v0.2.0</view>
      <view class="small">数据存储于微信云开发（本家庭共享）</view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ROLE, ROLE_NAMES } from '../../utils/constants'
import { useAppStore } from '../../store/app'

const appStore = useAppStore()

const roleName = computed(() => ROLE_NAMES[appStore.role] || '未设置')

async function load() {
  if (!appStore.roleLoaded) await appStore.loadRole()
}

function switchRole() {
  uni.showActionSheet({
    itemList: ['客户（点单的人）', '厨师（做菜的人）'],
    success: async (res) => {
      const role = res.tapIndex === 0 ? ROLE.CUSTOMER : ROLE.CHEF
      try {
        await appStore.chooseRole(role)
        appStore.refreshCounts()
        uni.showToast({ title: '已切换为：' + ROLE_NAMES[role], icon: 'none' })
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '切换失败', icon: 'none' })
      }
    }
  })
}

function go(url) {
  uni.navigateTo({ url })
}

onShow(load)
</script>

<style>
.page {
  padding: 24rpx;
}
.role-card {
  background: linear-gradient(135deg, #07c160, #05a34f);
  border-radius: 20rpx;
  padding: 32rpx;
  color: #fff;
  margin-bottom: 24rpx;
}
.role-line {
  display: flex;
  align-items: center;
}
.role-label {
  font-size: 26rpx;
  opacity: 0.85;
}
.role-value {
  margin-left: 20rpx;
  font-size: 40rpx;
  font-weight: bold;
}
.role-switch {
  display: inline-block;
  margin-top: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.6);
  border-radius: 32rpx;
  font-size: 26rpx;
  padding: 12rpx 32rpx;
}
.role-desc {
  margin-top: 20rpx;
  font-size: 22rpx;
  opacity: 0.85;
  line-height: 1.6;
  white-space: pre-line;
}
.menu {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.menu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
  font-size: 30rpx;
}
.arrow {
  color: #ccc;
  font-size: 40rpx;
}
.about {
  margin-top: 40rpx;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  line-height: 1.8;
}
.small {
  font-size: 22rpx;
}
</style>
