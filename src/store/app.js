import { defineStore } from 'pinia';
import { getUser, setRole, getDraftOrder, listSubmittedOrders } from '../utils/api';

export const useAppStore = defineStore('app', {
  state: () => ({
    role: '', // customer / chef
    groupId: '', // 所在家庭组 id（空 = 未入组）
    roleLoaded: false,
    draftCount: 0, // 点单中件数
    orderCount: 0 // 待做订单数
  }),
  actions: {
    /** 加载当前用户身份与所在组 */
    async loadRole() {
      try {
        const u = await getUser();
        this.role = u ? u.role : '';
        this.groupId = u ? u.groupId || '' : '';
      } catch (e) {
        console.warn('[store] 角色加载失败', e);
      } finally {
        this.roleLoaded = true;
      }
      return this.role;
    },
    async chooseRole(role) {
      await setRole(role);
      this.role = role;
    },
    async refreshCounts() {
      try {
        const draft = await getDraftOrder();
        this.draftCount = draft ? (draft.items || []).reduce((s, i) => s + i.count, 0) : 0;
        this.orderCount = (await listSubmittedOrders()).length;
      } catch (e) {
        console.warn('[store] 数量刷新失败', e);
      }
    }
  }
});
