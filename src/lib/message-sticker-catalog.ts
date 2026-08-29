export type MessageStickerDefinition = {
  key: string;
  label: string;
  character: string;
  imageUrl: string;
  width: number;
  height: number;
};

/**
 * Third-party character artwork used by the public sticker picker.
 * Keep every remote image URL in this single manifest so broken/hotlinked
 * assets can be replaced without touching board interaction code.
 */
export const MESSAGE_STICKER_CATALOG: readonly MessageStickerDefinition[] = [
  {
    key: 'hello-kitty-01',
    label: '挥挥手',
    character: 'Hello Kitty',
    imageUrl: 'https://www.citypng.com/public/uploads/preview/sweet-portrait-of-hello-kitty-waving-hd-transparent-png-735811696611595jr36apxzjp.png?v=2026031113',
    width: 88,
    height: 94,
  },
  {
    key: 'cinnamoroll-01',
    label: '软乎乎',
    character: '玉桂狗',
    imageUrl: 'https://www.kindpng.com/picc/m/343-3433469_cinnamoroll-png-transparent-png.png',
    width: 96,
    height: 84,
  },
  {
    key: 'kuromi-01',
    label: '小恶魔',
    character: '酷洛米',
    imageUrl: 'https://pngdownload.io/wp-content/uploads/2025/07/Kuromi-Hello-Kitty-Character-Transparent.webp',
    width: 88,
    height: 96,
  },
  {
    key: 'my-melody-01',
    label: '粉粉的',
    character: '美乐蒂',
    imageUrl: 'https://png.klev.club/uploads/posts/2024-04/png-klev-club-171i-p-mai-melodi-png-12.png',
    width: 90,
    height: 98,
  },
  {
    key: 'pompompurin-01',
    label: '困困布丁',
    character: '布丁狗',
    imageUrl: 'https://www.pngmart.com/files/23/Pompompurin-PNG-Isolated-Pic.png',
    width: 96,
    height: 88,
  },
  {
    key: 'pochacco-01',
    label: '来玩呀',
    character: '帕恰狗',
    imageUrl: 'https://www.pngmart.com/files/23/Pochacco-Download-PNG-Image.png',
    width: 90,
    height: 96,
  },
  {
    key: 'keroppi-01',
    label: '元气青蛙',
    character: '大眼蛙',
    imageUrl: 'https://toppng.com/uploads/preview/keroppi-vector-download-free-11574092208ij6x8nnuv8.png',
    width: 88,
    height: 82,
  },
  {
    key: 'gudetama-01',
    label: '今天躺平',
    character: '蛋黄哥',
    imageUrl: 'https://www.pngkey.com/png/detail/439-4394523_sanrio-gudetama-cartoon.png',
    width: 104,
    height: 72,
  },
  {
    key: 'badtz-maru-01',
    label: '拽拽的',
    character: '酷企鹅',
    imageUrl: 'https://www.citypng.com/public/uploads/preview/badtz-maru-penguin-sanrio-character-hd-transparent-png-7358116966701368cgnlqeujb.png?v=2025102122',
    width: 88,
    height: 96,
  },
  {
    key: 'chococat-01',
    label: '黑猫探头',
    character: '巧克猫',
    imageUrl: 'https://www.kindpng.com/picc/m/94-945646_transparent-hello-kitty-chococat-sanrio-hd-png-download.png',
    width: 86,
    height: 96,
  },
  {
    key: 'little-twin-stars-01',
    label: '一起做梦',
    character: '双星仙子',
    imageUrl: 'https://www.kindpng.com/picc/m/313-3137857_little-twin-stars-png-transparent-png.png',
    width: 112,
    height: 84,
  },
  {
    key: 'cinnamoroll-heart-01',
    label: '送你爱心',
    character: '玉桂狗',
    imageUrl: 'https://www.kindpng.com/picc/m/700-7006833_transparent-cinnamoroll-png-heart-png-download.png',
    width: 72,
    height: 110,
  },
  {
    key: 'kuromi-heart-01',
    label: '酷洛米爱心',
    character: '酷洛米',
    imageUrl: 'https://icon2.cleanpng.com/ci2/lmd/doj/a1jdwd6no.webp',
    width: 88,
    height: 96,
  },
  {
    key: 'my-melody-heart-01',
    label: '抱住爱心',
    character: '美乐蒂',
    imageUrl: 'https://www.clipartmax.com/png/middle/186-1868103_my-melody-by-peacymy-melody-cartoon.png',
    width: 88,
    height: 100,
  },
] as const;

export const MESSAGE_STICKER_BY_KEY = new Map(
  MESSAGE_STICKER_CATALOG.map((item) => [item.key, item] as const),
);
