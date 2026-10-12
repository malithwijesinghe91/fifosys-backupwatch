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
  for (const e of entities) store.set(keyOf(e.partitionKey, e.rowKey), { ...e });
}

/** All entities currently held in a table (copies). */
export function getTableEntities(tableName: string): MockTableEntity[] {
  return Array.from(tableStore(tableName).values()).map(e => ({ ...e }));
}

const notFound = () => Object.assign(new Error('ResourceNotFound'), { statusCode: 404 });

export function getMockTableClient(tableName: string) {
  const store = tableStore(tableName);
  return {
    tableName,

    createTable: async () => undefined,

    createEntity: async (entity: MockTableEntity) => {
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (store.has(k)) throw Object.assign(new Error('EntityAlreadyExists'), { statusCode: 409 });
      store.set(k, { ...entity });
      return { etag: 'W/"mock-etag"' };
    },

    upsertEntity: async (entity: MockTableEntity, mode: 'Replace' | 'Merge' = 'Merge') => {
      const k = keyOf(entity.partitionKey, entity.rowKey);
      const existing = store.get(k);
      store.set(k, mode === 'Merge' && existing ? { ...existing, ...entity } : { ...entity });
      return { etag: 'W/"mock-etag"' };
    },

    getEntity: async (partitionKey: string, rowKey: string) => {
      const entity = store.get(keyOf(partitionKey, rowKey));
      if (!entity) throw notFound();
      return { ...entity, etag: 'W/"mock-etag"' };
    },

    deleteEntity: async (partitionKey: string, rowKey: string) => {
      if (!store.delete(keyOf(partitionKey, rowKey))) throw notFound();
      return {};
    },

    listEntities: (_options?: any) => ({
      async *[Symbol.asyncIterator]() {
        for (const entity of Array.from(store.values())) yield { ...entity, etag: 'W/"mock-etag"' };
      },
    }),
  };
}

/** Drop-in replacement for shared/tableService (default table name matches production). */
export const tableServiceMock = {
  getTableClient: async (customTableName?: string) => getMockTableClient(customTableName || 'Exclusions'),
};
