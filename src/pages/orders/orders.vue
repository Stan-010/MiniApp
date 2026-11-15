<template>
  <view class="page">
    <!-- 客户：购物车 + 历史点单记录 -->
    <template v-if="appStore.roleLoaded && appStore.role === ROLE.CUSTOMER">
      <order-cart />
      <view class="section-title">历史点单</view>
      <view v-if="!myOrders.length" class="hint">暂无点单记录</view>
      <view v-for="o in myOrders" :key="o._id" class="my-order-card">
        <view class="my-order-head"
          >{{ fmtTime(o.submitTime || o.createTime) }} ·
          {{ ORDER_STATUS_NAMES[o.status] || '' }}</view
        >
        <view v-for="(it, i) in o.items" :key="i" class="my-order-item">
          <image v-if="itemImage(it)" class="my-order-img" :src="itemImage(it)" mode="aspectFill" />
          <text class="my-order-name">{{ it.dishName }}</text>
          <text class="my-order-count">×{{ it.count }}</text>
        </view>
      </view>
    </template>

    <!-- 厨师：订单 -->
    <template v-else-if="appStore.roleLoaded">
      <!-- 待完善菜品 -->
      <view class="section-title">待完善菜品（客户新加的菜）</view>
      <view v-if="!pendingDishes.length" class="hint">暂无</view>
      <view v-for="d in pendingDishes" :key="d._id" class="pending-row">
        <view class="pending-info" @tap="goDetail(d._id)">
          <text class="pending-name">{{ d.name }}</text>
          <text v-if="d.customerNote" class="pending-note">{{ d.customerNote }}</text>
        </view>
        <view class="fill-btn" @tap="goEdit(d._id)">补充说明</view>
      </view>

      <!-- 待做订单 -->
      <view class="section-title">待做订单</view>
      <view v-if="!orders.length" class="hint">暂无订单</view>
      <view v-for="o in orders" :key="o._id" class="order-card">
        <view class="order-head">订单 · {{ fmtTime(o.submitTime) }}</view>
        <view v-for="(it, i) in o.items" :key="i" class="order-item">
          <view class="order-item-top">
            <image
              v-if="itemImage(it)"
              class="order-item-img"
              :src="itemImage(it)"
              mode="aspectFill"
            />
            <text class="order-item-name">{{ it.dishName }}</text>
            <text class="order-item-count">×{{ it.count }}</text>
          </view>
          <view v-if="it.note" class="order-item-note">客户备注：{{ it.note }}</view>
          <view v-if="chefNoteOf(it.dishId)" class="chef-note">📖 {{ chefNoteOf(it.dishId) }}</view>
          <view v-else class="chef-note missing" @tap="goEdit(it.dishId)"
            >还没有做法说明，点此补充 ›</view
          >
        </view>
        <view class="order-foot">
          <view class="done-btn" @tap="markDone(o)">完成订单</view>
        </view>
      </view>

      <!-- 历史订单 -->
      <view v-if="doneOrders.length" class="section-title">历史订单</view>
      <view v-for="o in doneOrders" :key="o._id" class="done-row">
        {{ o.items.map((i) => i.dishName + '×' + i.count).join('、') }}
        <text class="done-time">{{ fmtTime(o.doneTime) }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import {
  listDishes,
  listPendingDishes,
  listSubmittedOrders,
  listDoneOrders,
  markOrderDone,
  listMyOrders
} from '../../utils/api';
import { ROLE, ORDER_STATUS_NAMES } from '../../utils/constants';
import { useAppStore } from '../../store/app';
import OrderCart from '../../components/order-cart/order-cart.vue';

const appStore = useAppStore();
const pendingDishes = ref([]);
const orders = ref([]);
const doneOrders = ref([]);
const myOrders = ref([]);
const dishMap = ref({});

const isCustomer = computed(() => appStore.role === ROLE.CUSTOMER);

function fmtTime(d) {
  if (!d) return '';
  const t = new Date(d);
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

function chefNoteOf(id) {
  const m = dishMap.value[id];
  return m ? m.chefNote : '';
}

function itemImage(it) {
  const m = dishMap.value[it.dishId];
  return it.image || (m ? m.image : '') || '';
}

async function load() {
  try {
    const [all, submitted, doneList, pending] = await Promise.all([
      listDishes(),
      listSubmittedOrders(),
      listDoneOrders(20),
      listPendingDishes()
    ]);
    dishMap.value = {};
    all.forEach((d) => {
      dishMap.value[d._id] = { chefNote: d.chefNote || '', image: d.image || '' };
    });
    orders.value = submitted;
    doneOrders.value = doneList;
    pendingDishes.value = pending;
    appStore.refreshCounts();
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' });
  }
}

async function loadCustomerData() {
  try {
    const [all, mine] = await Promise.all([listDishes(), listMyOrders()]);
    dishMap.value = {};
    all.forEach((d) => {
      dishMap.value[d._id] = { chefNote: d.chefNote || '', image: d.image || '' };
    });
    myOrders.value = mine;
  } catch (e) {
    console.error(e);
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' });
  }
}

function markDone(o) {
  uni.showModal({
    title: '完成订单',
    content: '这单做完了？完成后会移到历史订单。',
    confirmColor: '#07c160',
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await markOrderDone(o._id);
        load();
        uni.showToast({ title: '已完成', icon: 'success' });
      } catch (e) {
        console.error(e);
        uni.showToast({ title: '操作失败', icon: 'none' });
      }
    }
  });
}

function goDetail(id) {
  uni.navigateTo({ url: `/pages/dish-detail/dish-detail?id=${id}` });
}

function goEdit(id) {
  uni.navigateTo({ url: `/pages/dish-edit/dish-edit?id=${id}` });
}

onShow(async () => {
  if (!appStore.roleLoaded) await appStore.loadRole();
  if (isCustomer.value) {
    uni.setNavigationBarTitle({ title: '购物车' });
    loadCustomerData();
  } else {
    uni.setNavigationBarTitle({ title: '订单' });
    load();
  }
});
</script>

<style>
.page {
  padding: 24rpx;
  padding-bottom: 60rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: bold;
  margin: 24rpx 0 16rpx;
}
.hint {
  color: #999;
  font-size: 26rpx;
  padding: 12rpx 0;
}
.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}
.pending-info {
  flex: 1;
  overflow: hidden;
}
.pending-name {
  font-size: 30rpx;
  font-weight: bold;
  display: block;
}
.pending-note {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}
.fill-btn {
  flex-shrink: 0;
  background: #07c160;
  color: #fff;
  font-size: 26rpx;
  border-radius: 28rpx;
  padding: 12rpx 28rpx;
}
.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.order-head {
  font-size: 24rpx;
  color: #999;
  border-bottom: 1rpx solid #f5f5f5;
  padding-bottom: 16rpx;
}
.order-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.order-item-top {
  display: flex;
  align-items: center;
}
.order-item-img {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  background: #eee;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.order-item-name {
  flex: 1;
  font-size: 30rpx;
  font-weight: bold;
}
.order-item-count {
  font-size: 28rpx;
  color: #07c160;
}
.order-item-note {
  margin-top: 8rpx;
  font-size: 26rpx;
  color: #fa9d3b;
}
.chef-note {
  margin-top: 12rpx;
  background: #f7fbf7;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #555;
  white-space: pre-wrap;
  line-height: 1.6;
}
.chef-note.missing {
  color: #07c160;
  background: #f0faf3;
}
.order-foot {
  padding-top: 16rpx;
  display: flex;
  justify-content: flex-end;
}
.done-btn {
  background: #07c160;
  color: #fff;
  font-size: 28rpx;
  border-radius: 32rpx;
  padding: 14rpx 40rpx;
}
.done-row {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #666;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.done-time {
  color: #999;
  font-size: 22rpx;
}
.my-order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}
.my-order-head {
  font-size: 24rpx;
  color: #999;
  border-bottom: 1rpx solid #f5f5f5;
  padding-bottom: 16rpx;
}
.my-order-item {
  display: flex;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}
.my-order-img {
  width: 72rpx;
  height: 72rpx;
  border-radius: 10rpx;
  background: #eee;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.my-order-name {
  flex: 1;
  font-size: 28rpx;
}
.my-order-count {
  font-size: 26rpx;
  color: #07c160;
}
</style>
