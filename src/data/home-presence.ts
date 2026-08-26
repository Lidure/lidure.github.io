export type HomeNowItem = {
  label: string;
  value: string;
  href?: string;
};

export const homePresence = {
  intro: '把喜欢的东西，认真地收进小站里。',
  visual: {
    src: '/p0-256.webp',
    alt: '搁浅的小窝',
  },
  now: [
    { label: '最近在研究', value: '视觉、飞行与一些有趣的小项目' },
    { label: '最近在听', value: '歌单随机播放中', href: '/player' },
    { label: '最近在玩', value: 'Project SEKAI', href: '/sekai-quest' },
  ] satisfies HomeNowItem[],
};
