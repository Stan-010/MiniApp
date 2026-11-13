<template>
  <view class="page">
    <!-- 家庭组卡片 -->
    <view class="group-card">
      <template v-if="groupInfo">
        <view class="group-name">🏠 {{ groupInfo.name }}</view>
        <view class="group-meta">组内 {{ memberCount }} 人 · 邀请码：{{ groupInfo.inviteCode }}</view>
        <view class="group-actions">
          <view class="group-btn" @tap="copyInvite">复制邀请码</view>
          <view class="group-btn leave" @tap="leave">退出家庭</view>
        </view>
      </template>
      <template v-else>
        <view class="group-name">还没有加入家庭</view>
        <view class="group-desc">创建家庭：生成邀请码，历史数据自动归入新组\n加入：输入家人给你的邀请码</view>
        <view class="group-actions">
          <view class="group-btn primary" @tap="create">创建家庭</view>
          <view class="group-btn" @tap="join">输入邀请码加入</view>
        </view>
      </template>
    </view>

    <view class="role-card">
      <view class="role-line">
        <text class="role-label">当前身份</text>
        <text class="role-value">{{ roleName }}</text>
      </view>
      <view class="role-switch" @tap="switchRole">切换身份</view>
      <view class="role-desc">客户：点单、加菜（只需菜名+备注）\n厨师：写做法用料、看订单、补全菜品（每组可多位厨师）</view>
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
      <view>家庭菜谱 v0.4.0</view>
      <view class="small">多家庭组隔离 · 数据存储于微信云开发</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ROLE, ROLE_NAMES } from '../../utils/constants'
import { createGroup, joinGroup, leaveGroup, getGroupInfo, countGroupMembers } from '../../utils/api'
import { useAppStore } from '../../store/app'

const appStore = useAppStore()
const groupInfo = ref(null)
const memberCount = ref(0)

const roleName = computed(() => ROLE_NAMES[appStore.role] || '未设置')

async function load() {
  if (!appStore.roleLoaded) await appStore.loadRole()
  groupInfo.value = await getGroupInfo()
  memberCount.value = await countGroupMembers()
}

function pickRole(cb) {
  uni.showActionSheet({
    itemList: ['我是厨师（做菜）', '我是客户（点单）'],
    success: (res) => cb(res.tapIndex === 0 ? ROLE.CHEF : ROLE.CUSTOMER)
  })
}

function create() {
  uni.showModal({
    title: '创建家庭',
    editable: true,
    placeholderText: '家庭名称（如：我们家）',
    success: (res) => {
      if (!res.confirm) return
      const name = (res.content || '').trim() || '我的家庭'
      pickRole(async (role) => {
        try {
          const g = await createGroup(name, role)
          await appStore.loadRole()
          await load()
          uni.showModal({
            title: '创建成功',
            content: `家庭：${g.name}\n邀请码：${g.inviteCode}\n\n把这个码告诉家人，他们在「我的」页输入即可加入`,
            showCancel: false
          })
        } catch (e) {
          console.error(e)
          uni.showToast({ title: (e && e.message) || '创建失败', icon: 'none' })
        }
      })
    }
  })
}

function join() {
  uni.showModal({
    title: '加入家庭',
    editable: true,
    placeholderText: '输入 6 位邀请码',
    success: (res) => {
      if (!res.confirm) return
      const code = (res.content || '').trim()
      if (!code) {
        uni.showToast({ title: '请输入邀请码', icon: 'none' })
        return
      }
      pickRole(async (role) => {
        try {
          const g = await joinGroup(code, role)
          await appStore.loadRole()
          await load()
          uni.showToast({ title: '已加入：' + g.name, icon: 'success' })
        } catch (e) {
          console.error(e)
          uni.showToast({ title: (e && e.message) || '加入失败', icon: 'none' })
        }
      })
    }
  })
}

function copyInvite() {
  if (!groupInfo.value) return
  uni.setClipboardData({
    data: `我在「${groupInfo.value.name}」的家庭菜谱等你：打开小程序 → 我的 → 输入邀请码加入：${groupInfo.value.inviteCode}`
  })
}

function leave() {
  uni.showModal({
    title: '退出家庭',
    content: '退出后看不到本组的菜单、订单和冰箱数据（数据保留在原组）。确定退出？',
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await leaveGroup()
        await appStore.loadRole()
        await load()
        uni.showToast({ title: '已退出家庭', icon: 'none' })
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    }
  })
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
.group-card {
  background: linear-gradient(135deg, #3a7afe, #2b5fd9);
  border-radius: 20rpx;
  padding: 32rpx;
  color: #fff;
  margin-bottom: 24rpx;
}
.group-name {
  font-size: 36rpx;
  font-weight: bold;
}
.group-meta {
  margin-top: 12rpx;
  font-size: 26rpx;
  opacity: 0.9;
}
.group-desc {
  margin-top: 16rpx;
  font-size: 24rpx;
  opacity: 0.9;
  line-height: 1.7;
  white-space: pre-line;
}
.group-actions {
  margin-top: 24rpx;
  display: flex;
}
.group-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.6);
  border-radius: 32rpx;
  font-size: 26rpx;
  padding: 12rpx 32rpx;
  margin-right: 20rpx;
}
.group-btn.primary {
  background: #fff;
  color: #2b5fd9;
  font-weight: bold;
  border: none;
}
.group-btn.leave {
  border-color: rgba(255, 120, 120, 0.8);
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
