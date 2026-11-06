<template>
  <view class="page">
    <view class="add-bar">
      <input
        class="add-input"
        v-model="newName"
        placeholder="新分类名（如 早餐 / 荤菜）"
        confirm-type="done"
        @confirm="add"
      />
      <view class="add-btn" @tap="add">添加</view>
    </view>

    <view class="cat-list">
      <view v-for="c in categories" :key="c._id" class="cat-row">
        <text class="cat-name">{{ c.name }}</text>
        <text class="cat-del" @tap="remove(c)">删除</text>
      </view>
      <view v-if="!categories.length" class="empty">还没有分类，先添加一个</view>
    </view>

    <view class="tip">删除分类后，该分类下的菜品会归入「未分类」</view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listCategories, addCategory, removeCategory } from '../../utils/api'

const categories = ref([])
const newName = ref('')

async function load() {
  try {
    categories.value = await listCategories()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  }
}

async function add() {
  const name = newName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入分类名', icon: 'none' })
    return
  }
  if (categories.value.some((c) => c.name === name)) {
    uni.showToast({ title: '分类已存在', icon: 'none' })
    return
  }
  try {
    await addCategory(name)
    newName.value = ''
    load()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

function remove(c) {
  uni.showModal({
    title: '删除分类',
    content: `确定删除「${c.name}」？该分类下的菜品将归入「未分类」。`,
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await removeCategory(c._id)
        load()
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  })
}

onShow(load)
</script>

<style>
.page {
  padding: 24rpx;
}
.add-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 24rpx;
}
.add-input {
  flex: 1;
  font-size: 28rpx;
}
.add-btn {
  color: #07c160;
  font-size: 28rpx;
  padding-left: 24rpx;
}
.cat-list {
  margin-top: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}
.cat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
  font-size: 30rpx;
}
.cat-del {
  color: #fa5151;
  font-size: 26rpx;
}
.empty {
  padding: 60rpx 0;
  text-align: center;
  color: #999;
}
.tip {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #999;
  text-align: center;
}
</style>
