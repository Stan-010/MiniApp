<template>
  <view class="page">
    <view class="top-actions">
      <view class="ai-btn" @tap="goAi">✨ AI 推荐</view>
      <view class="add-btn2" @tap="openAdd">＋ 新增食材</view>
      <view class="clean-btn" @tap="cleanExpired">清理过期</view>
    </view>

    <scroll-view scroll-x class="cat-bar" :show-scrollbar="false">
      <view class="cat-item" :class="{ active: currentCategory === 'all' }" @tap="selectCategory('all')">全部</view>
      <view
        v-for="c in categories"
        :key="c._id"
        class="cat-item"
        :class="{ active: currentCategory === c._id }"
        @tap="selectCategory(c._id)"
      >{{ c.name }}</view>
    </scroll-view>

    <view v-if="loading" class="empty">加载中…</view>
    <view v-else-if="!items.length" class="empty">冰箱还是空的\n点「＋ 新增食材」把食材放进来</view>
    <view v-else class="fridge-list">
      <view v-for="f in items" :key="f._id" class="fridge-card" @tap="openEdit(f)">
        <image v-if="f.image" class="fridge-img" :src="f.image" mode="aspectFill" />
        <view v-else class="fridge-img placeholder">{{ f.name.slice(0, 1) }}</view>
        <view class="fridge-info">
          <view class="fridge-name-row">
            <text class="fridge-name">{{ f.name }}</text>
            <text class="fresh-tag" :class="f.freshness">{{ FRESHNESS_NAMES[f.freshness] || '' }}</text>
          </view>
          <view class="fridge-meta">{{ categoryName(f.categoryId) }} · {{ f.amount }} {{ f.unit }}</view>
          <view class="expiry" :class="expiryInfo(f).state">{{ expiryInfo(f).text }}</view>
        </view>
        <text class="edit-arrow">›</text>
      </view>
    </view>

    <!-- 新增 / 编辑弹层 -->
    <view v-if="showForm" class="mask" @tap="showForm = false">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">{{ editingId ? '编辑食材' : '新增食材' }}</view>

        <input class="sheet-input" v-model="form.name" placeholder="食材名称（必填）" />

        <view class="form-row">
          <picker class="picker" mode="selector" :range="catNames" :value="form.categoryIndex" @change="onCatChange">
            <view class="picker-view">分类：{{ catNames[form.categoryIndex] || '未分类' }}</view>
          </picker>
        </view>

        <view class="form-row">
          <input class="half-input" v-model="form.amount" placeholder="数量" type="digit" />
          <picker class="picker half" mode="selector" :range="FRIDGE_UNITS" :value="form.unitIndex" @change="onUnitChange">
            <view class="picker-view">单位：{{ FRIDGE_UNITS[form.unitIndex] }}</view>
          </picker>
        </view>

        <view class="form-row">
          <picker class="picker" mode="selector" :range="freshnessNames" :value="form.freshnessIndex" @change="onFreshChange">
            <view class="picker-view">新鲜程度：{{ freshnessNames[form.freshnessIndex] }}</view>
          </picker>
          <input class="half-input" v-model="form.days" placeholder="存放天数" type="number" />
        </view>

        <view class="form-row photo-row">
          <view class="photo-btn" @tap="chooseImage">📷 {{ form.image ? '更换照片' : '拍照 / 选照片' }}</view>
          <image v-if="form.image" class="photo-preview" :src="form.image" mode="aspectFill" />
          <text v-if="form.image" class="photo-remove" @tap="removeImage">移除</text>
        </view>

        <view class="sheet-actions">
          <view v-if="editingId" class="sheet-btn danger" @tap="remove">删除</view>
          <view class="sheet-btn cancel" @tap="showForm = false">取消</view>
          <view class="sheet-btn ok" @tap="save">{{ saving ? '保存中…' : '保存' }}</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  listFridgeCategories, ensurePresetFridgeCategories, listFridge,
  addFridge, updateFridge, removeFridge, removeExpiredFridge
} from '../../utils/api'
import { serverDate } from '../../utils/cloud'
import { FRIDGE_UNITS, FRESHNESS_NAMES } from '../../utils/constants'

const categories = ref([])
const items = ref([])
const currentCategory = ref('all')
const loading = ref(true)
const showForm = ref(false)
const editingId = ref('')
const saving = ref(false)
const form = ref({
  name: '',
  categoryIndex: 0,
  amount: '',
  unitIndex: 0,
  freshnessIndex: 0,
  days: '7',
  image: ''
})

const catNames = computed(() => ['未分类', ...categories.value.map((c) => c.name)])
const freshnessNames = computed(() => Object.values(FRESHNESS_NAMES))

function categoryName(id) {
  const c = categories.value.find((x) => x._id === id)
  return c ? c.name : '未分类'
}

function expiryInfo(f) {
  if (!f.addTime || !f.days) return { text: '未设置存放天数', state: 'none' }
  const exp = new Date(f.addTime).getTime() + Number(f.days) * 86400000
  const left = Math.ceil((exp - Date.now()) / 86400000)
  if (left < 0) return { text: `已过期 ${-left} 天`, state: 'expired' }
  if (left <= 3) return { text: left === 0 ? '今天过期' : `${left} 天后过期`, state: 'warning' }
  return { text: `还剩 ${left} 天`, state: 'normal' }
}

async function load() {
  loading.value = true
  try {
    await ensurePresetFridgeCategories()
    categories.value = await listFridgeCategories()
    await loadItems()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadItems() {
  const f = {}
  if (currentCategory.value !== 'all') f.categoryId = currentCategory.value
  items.value = await listFridge(f)
}

function selectCategory(id) {
  currentCategory.value = id
  loadItems().catch((e) => console.error(e))
}

function goAi() {
  uni.navigateTo({ url: '/pages/ai-recommend/ai-recommend' })
}

function openAdd() {
  editingId.value = ''
  form.value = { name: '', categoryIndex: 0, amount: '', unitIndex: 0, freshnessIndex: 0, days: '7', image: '' }
  showForm.value = true
}

function openEdit(f) {
  editingId.value = f._id
  const catIdx = categories.value.findIndex((c) => c._id === f.categoryId)
  const unitIdx = FRIDGE_UNITS.indexOf(f.unit)
  const freshIdx = Math.max(0, Object.keys(FRESHNESS_NAMES).indexOf(f.freshness))
  form.value = {
    name: f.name || '',
    categoryIndex: catIdx >= 0 ? catIdx + 1 : 0,
    amount: f.amount || '',
    unitIndex: unitIdx >= 0 ? unitIdx : 0,
    freshnessIndex: freshIdx,
    days: f.days ? String(f.days) : '7',
    image: f.image || ''
  }
  showForm.value = true
}

function onCatChange(e) {
  form.value.categoryIndex = Number(e.detail.value)
}

function onUnitChange(e) {
  form.value.unitIndex = Number(e.detail.value)
}

function onFreshChange(e) {
  form.value.freshnessIndex = Number(e.detail.value)
}

function chooseImage() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: async (res) => {
      const filePath = res.tempFilePaths[0]
      const extMatch = filePath.match(/\.(\w+)$/)
      const ext = extMatch ? extMatch[1] : 'jpg'
      uni.showLoading({ title: '上传中' })
      try {
        const cloudRes = await wx.cloud.uploadFile({
          cloudPath: `fridge/${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`,
          filePath
        })
        form.value.image = cloudRes.fileID
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function removeImage() {
  if (form.value.image) {
    wx.cloud.deleteFile({ fileList: [form.value.image] }).catch(() => {})
  }
  form.value.image = ''
}

async function save() {
  if (saving.value) return
  const name = form.value.name.trim()
  if (!name) {
    uni.showToast({ title: '请填写食材名称', icon: 'none' })
    return
  }
  if (!form.value.amount.trim()) {
    uni.showToast({ title: '请填写数量', icon: 'none' })
    return
  }
  const catId = form.value.categoryIndex <= 0 ? '' : categories.value[form.value.categoryIndex - 1]._id
  const data = {
    name,
    categoryId: catId,
    amount: form.value.amount.trim(),
    unit: FRIDGE_UNITS[form.value.unitIndex],
    freshness: Object.keys(FRESHNESS_NAMES)[form.value.freshnessIndex],
    days: Number(form.value.days) || 7,
    image: form.value.image,
    updateTime: serverDate()
  }
  saving.value = true
  try {
    if (editingId.value) await updateFridge(editingId.value, data)
    else await addFridge({ ...data, addTime: serverDate() })
    showForm.value = false
    uni.showToast({ title: '已保存', icon: 'success' })
    load()
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '保存失败，请确认云开发已开通', icon: 'none' })
  } finally {
    saving.value = false
  }
}

function remove() {
  uni.showModal({
    title: '删除食材',
    content: `确定把「${form.value.name}」移出冰箱？`,
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      try {
        await removeFridge(editingId.value)
        if (form.value.image) wx.cloud.deleteFile({ fileList: [form.value.image] }).catch(() => {})
        showForm.value = false
        uni.showToast({ title: '已删除', icon: 'success' })
        load()
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    }
  })
}

function cleanExpired() {
  uni.showModal({
    title: '清理过期食材',
    content: '将删除所有已过期的食材，确定吗？',
    confirmColor: '#fa5151',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const n = await removeExpiredFridge()
        uni.showToast({ title: `已清理 ${n} 种过期食材`, icon: 'none' })
        load()
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '清理失败', icon: 'none' })
      }
    }
  })
}

onShow(load)
</script>

<style>
.page {
  padding: 24rpx;
  padding-bottom: 60rpx;
}
.top-actions {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.add-btn2 {
  background: #07c160;
  color: #fff;
  font-size: 28rpx;
  border-radius: 32rpx;
  padding: 12rpx 32rpx;
  margin-left: 16rpx;
}
.ai-btn {
  background: #fa9d3b;
  color: #fff;
  font-size: 28rpx;
  border-radius: 32rpx;
  padding: 12rpx 28rpx;
}
.clean-btn {
  margin-left: 20rpx;
  border: 1rpx solid #fa5151;
  color: #fa5151;
  font-size: 26rpx;
  border-radius: 32rpx;
  padding: 10rpx 28rpx;
  background: #fff;
}
.cat-bar {
  white-space: nowrap;
  margin-bottom: 20rpx;
}
.cat-item {
  display: inline-block;
  padding: 10rpx 28rpx;
  margin-right: 16rpx;
  background: #fff;
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #666;
}
.cat-item.active {
  background: #07c160;
  color: #fff;
}
.empty {
  padding: 160rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
  white-space: pre-line;
}
.fridge-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}
.fridge-img {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  background: #eee;
  flex-shrink: 0;
}
.fridge-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f7ee;
  color: #07c160;
  font-size: 44rpx;
  font-weight: bold;
}
.fridge-info {
  flex: 1;
  margin-left: 20rpx;
  overflow: hidden;
}
.fridge-name-row {
  display: flex;
  align-items: center;
}
.fridge-name {
  font-size: 30rpx;
  font-weight: bold;
}
.fresh-tag {
  margin-left: 12rpx;
  font-size: 20rpx;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
}
.fresh-tag.fresh {
  color: #07c160;
  border: 1rpx solid #07c160;
}
.fresh-tag.normal {
  color: #ad6800;
  border: 1rpx solid #ad6800;
}
.fresh-tag.fading {
  color: #fa5151;
  border: 1rpx solid #fa5151;
}
.fridge-meta {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #999;
}
.expiry {
  margin-top: 6rpx;
  font-size: 22rpx;
}
.expiry.normal {
  color: #999;
}
.expiry.warning {
  color: #fa9d3b;
}
.expiry.expired {
  color: #fa5151;
}
.expiry.none {
  color: #ccc;
}
.edit-arrow {
  color: #ccc;
  font-size: 40rpx;
  margin-left: 12rpx;
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
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.picker {
  flex: 1;
  background: #f5f5f5;
  border-radius: 12rpx;
  height: 76rpx;
  display: flex;
  align-items: center;
}
.picker.half {
  margin-left: 16rpx;
}
.picker-view {
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  width: 100%;
}
.half-input {
  flex: 1;
  height: 76rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}
.photo-row {
  align-items: center;
}
.photo-btn {
  color: #07c160;
  font-size: 26rpx;
  border: 1rpx solid #07c160;
  border-radius: 28rpx;
  padding: 10rpx 24rpx;
}
.photo-preview {
  width: 88rpx;
  height: 88rpx;
  border-radius: 10rpx;
  margin-left: 20rpx;
  background: #eee;
}
.photo-remove {
  margin-left: 20rpx;
  color: #fa5151;
  font-size: 26rpx;
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
.sheet-btn.danger {
  background: #fff;
  border: 1rpx solid #fa5151;
  color: #fa5151;
}
</style>
