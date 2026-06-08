import rawMoments from './moments.json';

export type MomentCategory = '游戏' | '音乐' | '生活';

export interface Moment {
  /** 时间，格式 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm */
  date: string;
  /** 分类，决定图标与筛选分组 */
  category: MomentCategory;
  /** 一句话碎碎念 */
  text: string;
  /** 可选：相关链接 */
  link?: string;
  /** 可选：图片 URL 数组 */
  images?: string[];
}

export const categoryMeta: Record<MomentCategory, { icon: string; label: string }> = {
  游戏: { icon: '🎮', label: '游戏' },
  音乐: { icon: '🎵', label: '音乐' },
  生活: { icon: '☕', label: '生活' },
};

export const categoryOrder: MomentCategory[] = ['游戏', '音乐', '生活'];

/**
 * 碎碎念列表 —— 发新动态只需在数组最前面加一行：
 *   { date: '2026-06-09', category: '游戏', text: '今天在玩……' }
 * 顺序无所谓，页面会自动按日期倒序排列。
 */
export const moments = rawMoments as Moment[];
