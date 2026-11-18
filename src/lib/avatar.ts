const MAX_SIDE = 256;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    image.src = url;
  });

/**
 * Готовит аватар: обрезает по центру до квадрата, уменьшает до 256 px
 * и сжимает в JPEG. Файл профиля остаётся маленьким, поэтому хранение
 * в документе Firestore не упирается в лимит размера документа.
 */
export const prepareAvatar = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения (JPEG, PNG или WebP)');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Файл больше 8 МБ — выберите изображение меньшего размера');
  }
  const image = await loadImage(file);
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = MAX_SIDE;
  canvas.height = MAX_SIDE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Браузер не поддерживает обработку изображений');
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX_SIDE,
    MAX_SIDE,
  );
  return canvas.toDataURL('image/jpeg', 0.85);
};
