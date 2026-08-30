/** A connection to one kintone app. */
export interface KintoneApp {
  /** Returns the connected app's identity and canonical URL. */
  getMetadata(): Promise<KintoneAppMetadata>;

  /** Returns the app's fields, keyed by field code. */
  getFields(): Promise<Record<string, KintoneField>>;

  /**
   * Queries records using kintone query syntax. Results are returned in batches; call `next()`
   * until it returns `null`, then dispose the cursor.
   */
  queryRecords(options?: KintoneQueryOptions): Promise<KintoneRecordCursor>;

  /** Returns one record by its numeric ID or by an ID returned from `createRecord()`. */
  getRecord(recordId: string): Promise<KintoneRecord>;

  /** Creates one record. The returned reference can be passed to later methods immediately. */
  createRecord(fields: Record<string, KintoneValue>): Promise<KintoneRecordReference>;

  /** Updates only the supplied fields. Pass the known revision to reject concurrent changes. */
  updateRecord(
    recordId: string,
    fields: Record<string, KintoneValue>,
    revision?: string,
  ): Promise<KintoneRecordReference>;

  /** Adds a text comment to a record. */
  addComment(recordId: string, text: string): Promise<KintoneCommentReference>;

  /** Runs a process-management action on a record. */
  transitionStatus(
    recordId: string,
    action: string,
    assignee?: string,
    revision?: string,
  ): Promise<void>;
}

/** A stateful cursor over kintone record-query results. */
export interface KintoneRecordCursor {
  /** Returns the next batch, or `null` after the final batch. */
  next(): Promise<KintoneRecord[] | null>;
}

/** Identity of the connected kintone app. */
export type KintoneAppMetadata = {
  appId: string;
  name: string;
  description?: string;
  url: string;
  spaceId?: string;
  guestSpaceId?: string;
};

/** Simplified field schema suitable for building forms and interpreting records. */
export type KintoneField = {
  code: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  options?: string[];
};

/** Options for querying records in the connected app. */
export type KintoneQueryOptions = {
  /** Native kintone filter/order query. Do not include `limit` or `offset`. */
  query?: string;
  /** Field codes to return. Omit to return every readable field. */
  fields?: string[];
  /** Records per cursor batch, from 1 to 500. Defaults to 100. */
  batchSize?: number;
};

/** A kintone record with normalized metadata and field values keyed by field code. */
export type KintoneRecord = {
  id: string;
  revision: string;
  fields: Record<string, KintoneValue>;
};

/** A JSON-like field value returned by kintone or accepted for record writes. */
export type KintoneValue =
  | string
  | number
  | boolean
  | null
  | KintoneValue[]
  | { [key: string]: KintoneValue };

/** Identity returned after a record create or update. */
export type KintoneRecordReference = { id: string; revision: string };

/** Identity returned after posting a comment. */
export type KintoneCommentReference = { commentId: string };
