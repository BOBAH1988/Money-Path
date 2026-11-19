import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const specPath = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

interface Spec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: {
    securitySchemes: Record<string, { type?: string; scheme?: string }>;
    schemas: Record<string, unknown>;
  };
}

const spec = parse(readFileSync(specPath, 'utf8')) as Spec;

const resolveRef = (doc: unknown, ref: string): unknown => {
  const segments = ref.replace(/^#\//, '').split('/');
  let node: unknown = doc;
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
};

const collectRefs = (node: unknown, refs: string[] = []): string[] => {
  if (Array.isArray(node)) {
    for (const entry of node) collectRefs(entry, refs);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
};

describe('openapi.yaml', () => {
  it('объявлен как OpenAPI 3.1', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Money-Path API');
  });

  it('описывает все эндпоинты, нужные клиенту', () => {
    const expected = [
      '/health',
      '/me',
      '/me/profile',
      '/me/budget_plan',
      '/me/sync',
      '/admin/stats',
      '/me/collections/{collection}',
      '/me/collections/{collection}/{id}',
    ];

    for (const path of expected) {
      expect(spec.paths, `нет пути ${path}`).toHaveProperty([path]);
    }
  });

  it('у каждой операции есть operationId', () => {
    const missing: string[] = [];
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (['get', 'put', 'post', 'delete', 'patch'].includes(method)) {
          const id = (operation as { operationId?: string }).operationId;
          if (!id) missing.push(`${method.toUpperCase()} ${path}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('объявляет bearer-авторизацию', () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('не содержит ссылок на несуществующие схемы и ответы', () => {
    const refs = collectRefs(spec);
    expect(refs.length).toBeGreaterThan(0);

    const broken = refs.filter((ref) => resolveRef(spec, ref) === undefined);
    expect(broken).toEqual([]);
  });

  it('описывает коллекции, которые клиент реально синхронизирует', () => {
    const collectionParam = spec.components.schemas;
    expect(collectionParam).toBeTypeOf('object');

    const param = (spec.paths['/me/collections/{collection}'] as Record<string, unknown>)
      .get as { parameters?: { $ref: string }[] };
    const paramRef = param.parameters?.[0]?.$ref;
    expect(paramRef).toBeDefined();

    const resolved = resolveRef(spec, paramRef!) as { schema?: { enum?: string[] } };
    expect(resolved.schema?.enum).toEqual(['assets', 'liabilities', 'income', 'income_archive']);
  });
});
