/**
 * In-Memory Table Storage Mock
 * Map-based stand-in for an Azure TableClient, one store per table name.
 *
 * Usage in a test file:
 *   jest.mock('../shared/tableService', () => require('./mocks/tableStorage').tableServiceMock);
 */
import type { TableEntity } from '@azure/data-tables';

export interface MockTableEntity extends TableEntity {
  partitionKey: string;
  rowKey: string;
  [key: string]: any;
}

// tableName -> "partitionKey|rowKey" -> entity
const tables = new Map<string, Map<string, MockTableEntity>>();

const keyOf = (pk: string, rk: string) => `${pk}|${rk}`;

function tableStore(tableName: string): Map<string, MockTableEntity> {
  if (!tables.has(tableName)) tables.set(tableName, new Map());
  return tables.get(tableName)!;
}

export function resetTableStorageMocks() {
  tables.clear();
}

export function seedTableStorage(tableName: string, entities: MockTableEntity[]) {
  const store = tableStore(tableName);
  for (const e of entities) store.set(keyOf(e.partitionKey, e.rowKey), stored(e));
}

/** All entities currently held in a table (copies). */
export function getTableEntities(tableName: string): MockTableEntity[] {
  return Array.from(tableStore(tableName).values()).map(e => { const { etag, ...rest } = out(e); return rest as MockTableEntity; });
}

const notFound = () => Object.assign(new Error('ResourceNotFound'), { statusCode: 404 });
const preconditionFailed = () => Object.assign(new Error('UpdateConditionNotSatisfied'), { statusCode: 412 });

// Every write gets a new ETag, so optimistic-concurrency code (the scan lock) can be tested.
let etagCounter = 0;
const nextEtag = () => `W/"mock-etag-${++etagCounter}"`;
const ETAG = Symbol('etag');
const stored = (entity: MockTableEntity): MockTableEntity => ({ ...entity, [ETAG]: nextEtag() } as any);
const etagOf = (entity: any): string => entity[ETAG];
const out = (entity: any) => { const { [ETAG]: etag, ...rest } = entity; return { ...rest, etag }; };

export function getMockTableClient(tableName: string) {
  const store = tableStore(tableName);
  return {
    tableName,

    createTable: async () => undefined,

    createEntity: async (entity: MockTableEntity) => {
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (store.has(k)) throw Object.assign(new Error('EntityAlreadyExists'), { statusCode: 409 });
      const saved = stored(entity);
      store.set(k, saved);
      return { etag: etagOf(saved) };
    },

    upsertEntity: async (entity: MockTableEntity, mode: 'Replace' | 'Merge' = 'Merge') => {
      const k = keyOf(entity.partitionKey, entity.rowKey);
      const existing = store.get(k);
      const saved = stored(mode === 'Merge' && existing ? { ...existing, ...entity } : { ...entity });
      store.set(k, saved);
      return { etag: etagOf(saved) };
    },

    updateEntity: async (entity: MockTableEntity, mode: 'Replace' | 'Merge' = 'Merge', options?: { etag?: string }) => {
      const k = keyOf(entity.partitionKey, entity.rowKey);
      const existing = store.get(k);
      if (!existing) throw notFound();
      if (options && options.etag && options.etag !== '*' && options.etag !== etagOf(existing)) throw preconditionFailed();
      const saved = stored(mode === 'Merge' ? { ...existing, ...entity } : { ...entity });
      store.set(k, saved);
      return { etag: etagOf(saved) };
    },

    getEntity: async (partitionKey: string, rowKey: string) => {
      const entity = store.get(keyOf(partitionKey, rowKey));
      if (!entity) throw notFound();
      return out(entity);
    },

    deleteEntity: async (partitionKey: string, rowKey: string, options?: { etag?: string }) => {
      const k = keyOf(partitionKey, rowKey);
      const existing = store.get(k);
      if (!existing) throw notFound();
      if (options && options.etag && options.etag !== '*' && options.etag !== etagOf(existing)) throw preconditionFailed();
      store.delete(k);
      return {};
    },

    listEntities: (_options?: any) => ({
      async *[Symbol.asyncIterator]() {
        for (const entity of Array.from(store.values())) yield out(entity);
      },
    }),
  };
}

/** Drop-in replacement for shared/tableService (default table name matches production). */
export const tableServiceMock = {
  getTableClient: async (customTableName?: string) => getMockTableClient(customTableName || 'Exclusions'),
};
