import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Интеграционные тесты работают с одной общей базой и очищают таблицы в `beforeEach`.
     * При параллельном запуске файлов они вычищали бы данные друг друга — падения
     * были нестабильными и зависели от числа воркеров на машине (в CI их больше).
     */
    fileParallelism: false,
  },
});
