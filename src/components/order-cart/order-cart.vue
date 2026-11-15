<template>
  <view class="cart">
    <view v-if="!items.length" class="empty">购物车是空的\n去点单页挑几道菜吧</view>
    <view v-else>
      <view class="item" v-for="it in items" :key="it.dishId">
        <view class="item-top">
          <image v-if="imageOf(it)" class="item-img" :src="imageOf(it)" mode="aspectFill" />
          <view class="item-title">
            <text class="item-name">{{ it.dishName }}</text>
          </view>
          <view class="stepper">
            <view class="step-btn" @tap="changeCount(it, -1)">−</view>
            <text class="step-num">{{ it.count }}</text>
            <view class="step-btn plus" @tap="changeCount(it, 1)">＋</view>
          </view>
        </view>
        <input
          class="note-input"
          v-model="it.note"
          placeholder="这道菜的备注（可选，如：少放辣）"
          @blur="saveNote(it)"
        />
      </view>

      <view class="actions">
        <view class="clear-btn" @tap="clearCart">一键清空购物车</view>
        <view class="submit-btn" @tap="submit">下单（共 {{ totalCount }} 件）</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  getDraftOrder,
  setOrderItem,
  updateOrderItemNote,
  submitOrder,
  clearDraftOrder,
  listDishes
} from '../../utils/api';
import { useAppStore } from '../../store/app';

const appStore = useAppStore();
const items = ref([]);
const imageMap = ref({});

const totalCount = computed(() => items.value.reduce((s, i) => s + i.count, 0));

function imageOf(it) {
  return it.image || imageMap.value[it.dishId] || '';
}

async function load() {
  try {
    const draft = await getDraftOrder();
    items.value = draft && draft.items ? draft.items : [];
    const all = await listDishes();
    imageMap.value = {};
    all.forEach((d) => {
      imageMap.value[d._id] = d.image || '';
    });
    appStore.refreshCounts();
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' });
  }
}

async function changeCount(it, delta) {
  const next = Math.max(0, it.count + delta);
  it.count = next;
  try {
    await setOrderItem(it.dishId, it.dishName, next, it.note, it.image || '');
    if (next <= 0) load();
    appStore.refreshCounts();
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '操作失败', icon: 'none' });
  }
}

async function saveNote(it) {
  try {
    await updateOrderItemNote(it.dishId, it.note || '');
  } catch (e) {
    console.error(e);
  }
}

function clearCart() {
  uni.showModal({
    title: '清空购物车',
    content: '确定清空购物车里的所有菜品？',
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await clearDraftOrder();
        items.value = [];
        appStore.refreshCounts();
        uni.showToast({ title: '已清空', icon: 'success' });
      } catch (e) {
        console.error(e);
        uni.showToast({ title: '清空失败', icon: 'none' });
      }
    }
  });
}

function submit() {
  uni.showModal({
    title: '确认下单',
    content: `共 ${totalCount.value} 件，下单后厨师就能看到。`,
    confirmColor: '#07c160',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await submitOrder();
        appStore.refreshCounts();
        uni.showToast({ title: '已下单', icon: 'success' });
        load();
      } catch (e) {
        console.error(e);
        uni.showToast({ title: '下单失败', icon: 'none' });
      }
    }
  });
}

onShow(load);
</script>

<style>
.cart {
  padding: 24rpx;
  padding-bottom: 60rpx;
}
.empty {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.item-top {
  display: flex;
  align-items: center;
}
.item-img {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  background: #eee;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.item-title {
  flex: 1;
  overflow: hidden;
}
.item-name {
  font-size: 32rpx;
  font-weight: bold;
}
.stepper {
  display: flex;
  align-items: center;
}
.step-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 8rpx;
  text-align: center;
  line-height: 56rpx;
  font-size: 32rpx;
  background: #f2f2f2;
  color: #333;
}
.step-btn.plus {
  background: #07c160;
  color: #fff;
}
.step-num {
  min-width: 72rpx;
  text-align: center;
  font-size: 30rpx;
}
.note-input {
  margin-top: 20rpx;
  height: 72rpx;
  background: #f7f7f7;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}
.actions {
  display: flex;
  margin-top: 40rpx;
}
.clear-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: 1rpx solid #fa5151;
  color: #fa5151;
  background: #fff;
  margin-right: 20rpx;
}
.submit-btn {
  flex: 1.6;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 44rpx;
  font-size: 30rpx;
  background: #07c160;
  color: #fff;
}
</style>
