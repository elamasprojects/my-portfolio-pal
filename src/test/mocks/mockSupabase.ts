import {
  InflationIndexFixture,
  FxRateFixture,
  TradeFixture,
  GameReviewFixture,
  BackupPayloadFixture,
} from '../fixtures/types';

export interface MockSupabaseStore {
  trades: TradeFixture[];
  inflation_index: InflationIndexFixture[];
  fx_rates: FxRateFixture[];
  game_reviews: GameReviewFixture[];
  backups: BackupPayloadFixture[];
  [key: string]: any[];
}

export interface MockQueryResult<T = any> {
  data: T;
  error: { message: string; code?: string } | null;
}

function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      return JSON.parse(JSON.stringify(obj));
    }
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates a mock Supabase client with chainable query methods and stateful memory store.
 */
export function createMockSupabaseClient(initialData: Partial<MockSupabaseStore> = {}) {
  const clonedInitial = deepClone(initialData);

  const store: MockSupabaseStore = {
    trades: clonedInitial.trades ? deepClone(clonedInitial.trades) : [],
    inflation_index: clonedInitial.inflation_index ? deepClone(clonedInitial.inflation_index) : [],
    fx_rates: clonedInitial.fx_rates ? deepClone(clonedInitial.fx_rates) : [],
    game_reviews: clonedInitial.game_reviews ? deepClone(clonedInitial.game_reviews) : [],
    backups: clonedInitial.backups ? deepClone(clonedInitial.backups) : [],
    ...clonedInitial,
  };

  const getTableData = (tableName: string): any[] => {
    if (!store[tableName]) {
      store[tableName] = [];
    }
    return store[tableName];
  };

  const createQueryBuilder = (tableName: string, currentFilteredItems?: any[]) => {
    const tableData = getTableData(tableName);
    const activeItems = currentFilteredItems !== undefined ? currentFilteredItems : [...tableData];

    const builder: any = {
      data: activeItems,
      error: null,

      // Promise interface so await queryBuilder resolves to { data, error }
      then(onfulfilled?: (value: MockQueryResult) => any, onrejected?: (reason: any) => any) {
        return Promise.resolve({ data: activeItems, error: null }).then(onfulfilled, onrejected);
      },

      select(_columns = '*') {
        return createQueryBuilder(tableName, activeItems);
      },

      eq(field: string, value: any) {
        const filtered = activeItems.filter(item => item && item[field] === value);
        return createQueryBuilder(tableName, filtered);
      },

      gte(field: string, value: any) {
        const filtered = activeItems.filter(item => item && item[field] >= value);
        return createQueryBuilder(tableName, filtered);
      },

      lte(field: string, value: any) {
        const filtered = activeItems.filter(item => item && item[field] <= value);
        return createQueryBuilder(tableName, filtered);
      },

      in(field: string, values: any[]) {
        const filtered = activeItems.filter(item => item && values.includes(item[field]));
        return createQueryBuilder(tableName, filtered);
      },

      order(orderColumn: string, options?: { ascending?: boolean }) {
        const ascending = options?.ascending ?? true;
        const sorted = [...activeItems].sort((a, b) => {
          if (a[orderColumn] < b[orderColumn]) return ascending ? -1 : 1;
          if (a[orderColumn] > b[orderColumn]) return ascending ? 1 : -1;
          return 0;
        });
        return createQueryBuilder(tableName, sorted);
      },

      single() {
        const found = activeItems.length > 0 ? activeItems[0] : null;
        const result: MockQueryResult = {
          data: found,
          error: found ? null : { message: 'Row not found', code: 'PGRST116' },
        };
        return Promise.resolve(result);
      },

      upsert(rowOrRows: any, _options?: any) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const newEntries = rows.map((r, idx) => ({
          id: r.id || `mock-${tableName}-${Date.now()}-${idx}`,
          created_at: r.created_at || new Date().toISOString(),
          ...r,
        }));
        store[tableName].push(...newEntries);
        return Promise.resolve({ data: newEntries, error: null });
      },

      insert(rowOrRows: any) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const newEntries = rows.map((r, idx) => ({
          id: r.id || `mock-${tableName}-${Date.now()}-${idx}`,
          created_at: r.created_at || new Date().toISOString(),
          ...r,
        }));
        store[tableName].push(...newEntries);

        const insertedResult = Array.isArray(rowOrRows) ? newEntries : newEntries[0];
        
        // Return object that supports direct resolution AND chainable .select()
        const insertBuilder: any = Promise.resolve({ data: insertedResult, error: null });
        insertBuilder.select = (_cols = '*') => Promise.resolve({ data: insertedResult, error: null });
        insertBuilder.single = () => Promise.resolve({ data: Array.isArray(insertedResult) ? insertedResult[0] : insertedResult, error: null });
        return insertBuilder;
      },

      update(updates: Record<string, any>) {
        return {
          eq(field: string, value: any) {
            let updatedCount = 0;
            const updatedItems: any[] = [];

            store[tableName] = getTableData(tableName).map(item => {
              if (item && item[field] === value) {
                updatedCount++;
                const updated = { ...item, ...updates };
                updatedItems.push(updated);
                return updated;
              }
              return item;
            });

            const updateResult = {
              data: updatedItems,
              error: null,
              count: updatedCount,
            };
            return Promise.resolve(updateResult);
          },
        };
      },

      delete() {
        return {
          eq(field: string, value: any) {
            const initialLength = store[tableName].length;
            store[tableName] = getTableData(tableName).filter(item => item && item[field] !== value);
            const deletedCount = initialLength - store[tableName].length;

            return Promise.resolve({
              data: null,
              error: null,
              count: deletedCount,
            });
          },
        };
      },
    };

    return builder;
  };

  return {
    getStore: () => store,

    resetStore: (newData: Partial<MockSupabaseStore> = {}) => {
      const clonedNew = deepClone(newData);
      Object.keys(store).forEach(key => delete store[key]);
      Object.assign(store, {
        trades: clonedNew.trades ? deepClone(clonedNew.trades) : [],
        inflation_index: clonedNew.inflation_index ? deepClone(clonedNew.inflation_index) : [],
        fx_rates: clonedNew.fx_rates ? deepClone(clonedNew.fx_rates) : [],
        game_reviews: clonedNew.game_reviews ? deepClone(clonedNew.game_reviews) : [],
        backups: clonedNew.backups ? deepClone(clonedNew.backups) : [],
        ...clonedNew,
      });
    },

    from: (tableName: string) => {
      return createQueryBuilder(tableName);
    },

    rpc: (functionName: string, params?: any) => {
      if (functionName === 'perform_backup_dry_run') {
        const rowsRestored = params?.backup_data?.data
          ? Object.values(params.backup_data.data).reduce((acc: number, items: any) => acc + (Array.isArray(items) ? items.length : 0), 0)
          : 120;

        return Promise.resolve({
          data: {
            valid: true,
            rowsRestored,
            restorationValid: true,
            checksumMatched: true,
            message: 'Dry run restoration completed successfully.',
          },
          error: null,
        });
      }

      return Promise.resolve({ data: null, error: null });
    },
  };
}
