export type MomentCategory = '游戏' | '音乐' | '生活';

export interface Moment {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 分类，决定图标与筛选分组 */
  category: MomentCategory;
  /** 一句话碎碎念 */
  text: string;
  /** 可选：相关链接（外链或站内路径），填了文字就会变成链接 */
  link?: string;
}

/** 各分类的图标与展示名，想加新分类就在这里和上面的类型里各加一项 */
export const categoryMeta: Record<MomentCategory, { icon: string; label: string }> = {
  游戏: { icon: '🎮', label: '游戏' },
  音乐: { icon: '🎵', label: '音乐' },
  生活: { icon: '☕', label: '生活' },
};

/** 筛选条里的分类顺序 */
export const categoryOrder: MomentCategory[] = ['游戏', '音乐', '生活'];

/**
 * 碎碎念列表 —— 发新动态只需在数组最前面加一行：
 *   { date: '2026-06-09', category: '游戏', text: '今天在玩……' }
 * 顺序无所谓，页面会自动按日期倒序排列。
 */
export const moments: Moment[] = [
  { date: '2026-06-08', category: '游戏', text: '在打《艾尔登法环》DLC，被女武神打到自闭，但风景是真的美。' },
  { date: '2026-06-06', category: '音乐', text: '单曲循环《25時、ナイトコードで。》一整天，耳朵怀孕了。' },
  { date: '2026-06-03', category: '生活', text: '周末睡到自然醒，煮了杯手冲，给阳台的多肉换了盆。' },
  { date: '2026-05-30', category: '游戏', text: '通关《空洞骑士》拿到真结局，准备入坑《丝之歌》。' },
  { date: '2026-05-25', category: '音乐', text: '挖到 Leoneed 的《心拍数♯0822》，前奏一响 DNA 就动了。' },
  { date: '2026-05-20', category: '生活', text: '最近迷上了下厨，番茄炒蛋终于不糊锅了。' },
];
