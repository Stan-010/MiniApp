<template>
  <view class="page">
    <view class="head">
      <text class="head-title">运行日志（最近 50 条）</text>
      <view class="refresh" @tap="load">刷新</view>
    </view>

    <view v-if="!logs.length" class="empty">暂无日志\n（确认云数据库已创建 logs 集合）</view>
    <view v-for="(l, i) in logs" :key="i" class="log-row" :class="l.level">
      <view class="log-head">
        <text class="log-time">{{ fmtTime(l.time) }}</text>
        <text class="log-tail">{{ l.openidTail || '----' }}</text>
        <text class="log-action">{{ l.action }}</text>
        <text class="log-level">{{ l.level === 'error' ? '✗' : '✓' }}</text>
      </view>
      <view v-if="l.detail" class="log-detail">{{ l.detail }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { db } from '../../utils/cloud'

const logs = ref([])

function fmtTime(d) {
  if (!d) return ''
  const t = new Date(d)
  const p = (n) => (n < 10 ? '0' + n : '' + n)
  return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`
}

async function load() {
  try {
    const res = await db().collection('logs').orderBy('time', 'desc').limit(50).get()
    logs.value = res.data
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '请先创建 logs 集合', icon: 'none' })
  }
}

onShow(load)
</script>

<style>
.page {
  padding: 24rpx;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.head-title {
  font-size: 28rpx;
  color: #666;
}
.refresh {
  color: #07c160;
  font-size: 26rpx;
  border: 1rpx solid #07c160;
  border-radius: 28rpx;
  padding: 8rpx 28rpx;
}
.empty {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.log-row {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  border-left: 6rpx solid #07c160;
}
.log-row.error {
  border-left-color: #fa5151;
}
.log-head {
  display: flex;
  align-items: center;
  font-size: 24rpx;
}
.log-time {
  color: #999;
  margin-right: 12rpx;
}
.log-tail {
  color: #3a7afe;
  margin-right: 12rpx;
  background: #eef3ff;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
}
.log-action {
  flex: 1;
  font-weight: bold;
  color: #333;
}
.log-level {
  color: #07c160;
}
.log-row.error .log-level {
  color: #fa5151;
}
.log-detail {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #888;
  word-break: break-all;
}
.log-row.error .log-detail {
  color: #fa5151;
}
</style>
