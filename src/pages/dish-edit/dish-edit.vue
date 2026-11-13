<template>
  <view class="page">
    <view class="form">
      <!-- 菜名 -->
      <view class="field">
        <text class="label">菜名 *</text>
        <input class="input" v-model="name" placeholder="如：西红柿炒鸡蛋" @blur="onNameBlur" />
      </view>

      <!-- 分类 + 自动归类 -->
      <view class="field">
        <text class="label">分类</text>
        <picker class="picker" mode="selector" :range="catNames" :value="categoryIndex" @change="onCatChange">
          <view class="picker-text">{{ catNames[categoryIndex] || '未分类' }}</view>
        </picker>
        <view class="auto-btn" @tap="autoClassify">自动归类</view>
      </view>

      <!-- 图片 -->
      <view class="field">
        <text class="label">图片</text>
        <view class="img-box">
          <image v-if="imageFileID" class="img-preview" :src="imageFileID" mode="aspectFill" @tap="previewImage" />
          <view v-else class="img-placeholder" @tap="chooseImage">＋ 选图 / 拍照</view>
          <text v-if="imageFileID" class="img-remove" @tap="removeImage">移除</text>
        </view>
      </view>

      <!-- 客户想吃备注（只读） -->
      <view v-if="customerNote" class="field column">
        <text class="label">客户备注</text>
        <view class="ro-note">{{ customerNote }}</view>
      </view>

      <!-- 厨师说明：大长串 -->
      <view class="field column">
        <text class="label">做法与用料 *</text>
        <textarea
          class="big-textarea"
          v-model="chefNote"
          :placeholder="notePlaceholder"
        />
      </view>
    </view>

    <view class="save-bar">
      <view class="save-btn" :class="{ disabled: saving }" @tap="save">{{ saving ? '保存中…' : '保存' }}</view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getDish, addDish, updateDish, listCategories } from '../../utils/api'
import { serverDate } from '../../utils/cloud'
import { classifyDish } from '../../utils/category-rules'
import { ROLE, DISH_STATUS } from '../../utils/constants'

const id = ref('')
const categories = ref([])
const name = ref('')
const categoryIndex = ref(0)
const imageFileID = ref('')
const chefNote = ref('')
const customerNote = ref('')
const saving = ref(false)

const notePlaceholder = '做法、食材配比、用料…全部写在这里（一长串说明）\n例如：\n用料：鸡蛋 3 个、西红柿 2 个、盐适量\n做法：1. 西红柿切块… 2. 鸡蛋打散… 3. …'

const catNames = computed(() => ['未分类', ...categories.value.map((c) => c.name)])

function onCatChange(e) {
  categoryIndex.value = Number(e.detail.value)
}

function autoClassify() {
  const n = name.value.trim()
  if (!n) {
    uni.showToast({ title: '先填写菜名', icon: 'none' })
    return
  }
  const cid = classifyDish(n, categories.value)
  if (!cid) {
    uni.showToast({ title: '没匹配到，手动选吧', icon: 'none' })
    return
  }
  const idx = categories.value.findIndex((c) => c._id === cid)
  categoryIndex.value = idx >= 0 ? idx + 1 : 0
  uni.showToast({ title: '已归类：' + catNames.value[categoryIndex.value], icon: 'none' })
}

function onNameBlur() {
  // 名字填完、分类还没选时自动归类
  if (categoryIndex.value === 0 && name.value.trim()) {
    const cid = classifyDish(name.value.trim(), categories.value)
    if (cid) {
      const idx = categories.value.findIndex((c) => c._id === cid)
      if (idx >= 0) categoryIndex.value = idx + 1
    }
  }
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
          cloudPath: `dishes/${Date.now()}_${Math.floor(Math.random() * 100000)}.${ext}`,
          filePath
        })
        imageFileID.value = cloudRes.fileID
      } catch (e) {
        console.error(e)
        uni.showToast({ title: '上传失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    }
  })
}

function previewImage() {
  uni.previewImage({ urls: [imageFileID.value] })
}

function removeImage() {
  if (imageFileID.value) {
    wx.cloud.deleteFile({ fileList: [imageFileID.value] }).catch(() => {})
  }
  imageFileID.value = ''
}

async function save() {
  if (saving.value) return
  if (!name.value.trim()) {
    uni.showToast({ title: '请填写菜名', icon: 'none' })
    return
  }
  if (!chefNote.value.trim()) {
    uni.showToast({ title: '请填写做法与用料', icon: 'none' })
    return
  }
  const catId = categoryIndex.value <= 0 ? '' : categories.value[categoryIndex.value - 1]._id
  const data = {
    name: name.value.trim(),
    categoryId: catId,
    image: imageFileID.value,
    chefNote: chefNote.value.trim(),
    customerNote: customerNote.value,
    status: DISH_STATUS.READY,
    searchText: [name.value.trim(), customerNote.value, chefNote.value].filter(Boolean).join(' '),
    updateTime: serverDate()
  }

  saving.value = true
  try {
    if (id.value) await updateDish(id.value, data)
    else await addDish({ ...data, createdByRole: ROLE.CHEF, createTime: serverDate() })
    uni.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 600)
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '保存失败，请确认云开发已开通', icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad(async (query) => {
  try {
    categories.value = await listCategories()
    if (query && query.id) {
      id.value = query.id
      uni.setNavigationBarTitle({ title: '编辑菜品' })
      const res = await getDish(id.value)
      const d = res.data
      name.value = d.name || ''
      imageFileID.value = d.image || ''
      chefNote.value = d.chefNote || ''
      customerNote.value = d.customerNote || ''
      if (d.categoryId) {
        const idx = categories.value.findIndex((c) => c._id === d.categoryId)
        categoryIndex.value = idx >= 0 ? idx + 1 : 0
      }
    } else {
      uni.setNavigationBarTitle({ title: '新增菜品' })
    }
  } catch (e) {
    console.error(e)
    uni.showToast({ title: '加载失败，请确认云开发已开通', icon: 'none' })
  }
})
</script>

<style>
.page {
  padding-bottom: 140rpx;
}
.form {
  padding: 24rpx;
}
.field {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
}
.field.column {
  display: block;
}
.label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  color: #666;
}
.input {
  flex: 1;
  font-size: 28rpx;
}
.picker {
  flex: 1;
}
.picker-text {
  font-size: 28rpx;
}
.auto-btn {
  flex-shrink: 0;
  color: #07c160;
  font-size: 24rpx;
  border: 1rpx solid #07c160;
  border-radius: 24rpx;
  padding: 6rpx 20rpx;
}
.img-box {
  display: flex;
  align-items: center;
}
.img-preview {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  background: #eee;
}
.img-placeholder {
  width: 140rpx;
  height: 140rpx;
  border: 1rpx dashed #ccc;
  border-radius: 12rpx;
  color: #999;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.img-remove {
  margin-left: 24rpx;
  color: #fa5151;
  font-size: 26rpx;
}
.ro-note {
  margin-top: 8rpx;
  font-size: 28rpx;
  color: #fa9d3b;
  line-height: 1.6;
}
.big-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 480rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  line-height: 1.7;
  margin-top: 8rpx;
}
.save-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.save-btn {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  background: #07c160;
  color: #fff;
  border-radius: 44rpx;
  font-size: 32rpx;
}
.save-btn.disabled {
  opacity: 0.6;
}
</style>
