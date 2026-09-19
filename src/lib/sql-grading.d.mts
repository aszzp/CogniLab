export interface QueryResult {
  columns: string[];
  rows: (string | number | null)[][];
}
export interface SqlMeta {
  initSql: string;
  expectedSql: string;
  rowOrderMatters?: boolean;
  columnOrderMatters?: boolean;
}
export function compareQueryResults(actual: QueryResult, expected: QueryResult, options?: Partial<SqlMeta>): {
  pass: boolean; colsMatch: boolean; rowsMatch: boolean;
};
export function gradeSql(meta: SqlMeta, code: string): {
  pass: boolean; colsMatch: boolean; rowsMatch: boolean;
  yourCount: number; expectedCount: number; result: QueryResult;
};
