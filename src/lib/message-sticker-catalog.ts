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
 *
 * The catalog deliberately uses direct PNGMart asset URLs. The original
 * mixed-source catalog contained several images whose preview/background was
 * baked into the image even though the filename claimed to be transparent.
 */
export const MESSAGE_STICKER_CATALOG: readonly MessageStickerDefinition[] = [
  {
    key: 'hello-kitty-01',
    label: '挥挥手',
    character: 'Hello Kitty',
    imageUrl: 'https://www.pngmart.com/files/16/Hello-Kitty-Transparent-Background.png',
    width: 88,
    height: 94,
  },
  {
    key: 'kuromi-01',
    label: '小恶魔',
    character: '酷洛米',
    imageUrl: 'https://www.pngmart.com/files/23/Kuromi-PNG-Photo.png',
    width: 88,
    height: 96,
  },
  {
    key: 'my-melody-01',
    label: '粉粉的',
    character: '美乐蒂',
    imageUrl: 'https://www.pngmart.com/files/23/My-Melody-PNG-Transparent.png',
    width: 90,
    height: 98,
  },
  {
    key: 'pompompurin-01',
    label: '困困布丁',
    character: '布丁狗',
    imageUrl: 'https://www.pngmart.com/files/23/Pompompurin-PNG.png',
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
    imageUrl: 'https://www.pngmart.com/files/12/Keroppi-Frog-PNG-File.png',
    width: 88,
    height: 82,
  },
  {
    key: 'gudetama-01',
    label: '今天躺平',
    character: '蛋黄哥',
    imageUrl: 'https://www.pngmart.com/files/23/Gudetama-PNG-HD-Isolated.png',
    width: 104,
    height: 72,
  },
  {
    key: 'badtz-maru-01',
    label: '拽拽的',
    character: '酷企鹅',
    imageUrl: 'https://www.pngmart.com/files/23/Badtz-Maru-Transparent-PNG.png',
    width: 88,
    height: 96,
  },
  {
    key: 'chococat-01',
    label: '黑猫探头',
    character: '巧克猫',
    imageUrl: 'https://www.pngmart.com/files/23/Chococat-PNG-Isolated-HD.png',
    width: 86,
    height: 96,
  },
  {
    key: 'cinnamoroll-heart-01',
    label: '送你爱心',
    character: '玉桂狗',
    imageUrl: 'https://www.pngmart.com/files/23/Cinnamoroll-PNG-Photos.png',
    width: 72,
    height: 110,
  },
  {
    key: 'kuromi-heart-01',
    label: '酷洛米爱心',
    character: '酷洛米',
    imageUrl: 'https://www.pngmart.com/files/23/Kuromi-PNG-Photos.png',
    width: 88,
    height: 96,
  },
  {
    key: 'my-melody-heart-01',
    label: '抱住爱心',
    character: '美乐蒂',
    imageUrl: 'https://www.pngmart.com/files/23/My-Melody-PNG-Free-Download.png',
    width: 88,
    height: 100,
  },
] as const;

export const MESSAGE_STICKER_BY_KEY = new Map(
  MESSAGE_STICKER_CATALOG.map((item) => [item.key, item] as const),
);
