/**
 * Генератор идентификаторов записей.
 *
 * `crypto.randomUUID()` доступен только в secure context, поэтому приложение
 * может работать по `http://<IP>` в локальной сети. В этом случае используем
 * `crypto.getRandomValues`, а при его отсутствии — детерминированный fallback.
 */
const randomHex = (length: number): string => {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
};

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // secure context недоступен — переходим на fallback
    }
  }
  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
};
