import type {
  KintoneAppMetadata,
  KintoneField,
  KintoneValue,
  KintoneRecord,
  KintoneRecordReference,
} from "./types";

export type KintoneCredentials = {
  origin: string;
  appId: string;
  apiToken: string;
};

export class KintoneApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }

  get isAccessError(): boolean {
    return this.status === 401 || this.status === 403 || this.status === 404;
  }
}

type JsonObject = { [key: string]: unknown };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringProperty(value: JsonObject, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined;
}

function requireString(value: JsonObject, key: string, context: string): string {
  const result = stringProperty(value, key);
  if (result === undefined) throw new Error(`Invalid kintone response: ${context}.${key} is missing.`);
  return result;
}

function toFieldValue(value: unknown): KintoneValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map(toFieldValue);
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toFieldValue(entry)]));
  }
  throw new Error("Invalid kintone field value.");
}

function recordFromJson(value: unknown): KintoneRecord {
  if (!isObject(value)) throw new Error("Invalid kintone record response.");
  const idField = value.$id;
  const revisionField = value.$revision;
  if (!isObject(idField) || !isObject(revisionField)) {
    throw new Error("Invalid kintone record metadata.");
  }
  const fields: Record<string, KintoneValue> = {};
  for (const [code, field] of Object.entries(value)) {
    if (code === "$id" || code === "$revision" || !isObject(field) || !("value" in field)) continue;
    fields[code] = toFieldValue(field.value);
  }
  return {
    id: requireString(idField, "value", "$id"),
    revision: requireString(revisionField, "value", "$revision"),
    fields,
  };
}

function inputFields(fields: Record<string, KintoneValue>): JsonObject {
  return Object.fromEntries(Object.entries(fields).map(([code, value]) => [code, { value }]));
}

export class KintoneApi {
  constructor(private readonly credentials: KintoneCredentials) {}

  async #request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${this.credentials.origin}${path}`, {
      ...init,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Cybozu-API-Token": this.credentials.apiToken,
        ...init.headers,
      },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const object = isObject(body) ? body : {};
      throw new KintoneApiError(
        stringProperty(object, "message") ?? `kintone request failed with HTTP ${response.status}.`,
        response.status,
        stringProperty(object, "code"),
      );
    }
    return body;
  }

  async getApp(): Promise<KintoneAppMetadata> {
    const body = await this.#request(`/k/v1/app.json?id=${encodeURIComponent(this.credentials.appId)}`);
    if (!isObject(body)) throw new Error("Invalid kintone app response.");
    return {
      appId: requireString(body, "appId", "app"),
      name: requireString(body, "name", "app"),
      description: stringProperty(body, "description"),
      url: `${this.credentials.origin}/k/${this.credentials.appId}/`,
      spaceId: stringProperty(body, "spaceId"),
      guestSpaceId: stringProperty(body, "guestSpaceId"),
    };
  }

  async getFields(): Promise<Record<string, KintoneField>> {
    const body = await this.#request(
      `/k/v1/app/form/fields.json?app=${encodeURIComponent(this.credentials.appId)}&lang=ja`,
    );
    if (!isObject(body) || !isObject(body.properties)) {
      throw new Error("Invalid kintone field response.");
    }
    const result: Record<string, KintoneField> = {};
    for (const [code, raw] of Object.entries(body.properties)) {
      if (!isObject(raw)) continue;
      const options = isObject(raw.options) ? Object.keys(raw.options) : undefined;
      result[code] = {
        code,
        label: stringProperty(raw, "label") ?? code,
        type: stringProperty(raw, "type") ?? "UNKNOWN",
        required: typeof raw.required === "boolean" ? raw.required : undefined,
        unique: typeof raw.unique === "boolean" ? raw.unique : undefined,
        options,
      };
    }
    return result;
  }

  async getRecord(recordId: string): Promise<KintoneRecord> {
    const body = await this.#request(
      `/k/v1/record.json?app=${encodeURIComponent(this.credentials.appId)}&id=${encodeURIComponent(recordId)}`,
    );
    if (!isObject(body)) throw new Error("Invalid kintone record response.");
    return recordFromJson(body.record);
  }

  async queryRecords(options: {
    query?: string;
    fields?: string[];
    limit: number;
    offset: number;
  }): Promise<KintoneRecord[]> {
    if (options.query && /(?:^|\s)(?:limit|offset)\s+\d+(?:\s|$)/i.test(options.query)) {
      throw new Error("query must not include limit or offset; use the cursor batch size instead.");
    }
    const params = new URLSearchParams({ app: this.credentials.appId });
    const suffix = `limit ${options.limit} offset ${options.offset}`;
    params.set("query", options.query?.trim() ? `${options.query.trim()} ${suffix}` : suffix);
    for (const field of options.fields ?? []) params.append("fields[]", field);
    const body = await this.#request(`/k/v1/records.json?${params}`);
    if (!isObject(body) || !Array.isArray(body.records)) {
      throw new Error("Invalid kintone records response.");
    }
    return body.records.map(recordFromJson);
  }

  async createRecord(fields: Record<string, KintoneValue>): Promise<KintoneRecordReference> {
    const body = await this.#request("/k/v1/record.json", {
      method: "POST",
      body: JSON.stringify({ app: this.credentials.appId, record: inputFields(fields) }),
    });
    if (!isObject(body)) throw new Error("Invalid kintone create response.");
    return { id: requireString(body, "id", "record"), revision: requireString(body, "revision", "record") };
  }

  async updateRecord(
    recordId: string,
    fields: Record<string, KintoneValue>,
    revision?: string,
  ): Promise<KintoneRecordReference> {
    const body = await this.#request("/k/v1/record.json", {
      method: "PUT",
      body: JSON.stringify({ app: this.credentials.appId, id: recordId, record: inputFields(fields), revision }),
    });
    if (!isObject(body)) throw new Error("Invalid kintone update response.");
    return { id: recordId, revision: requireString(body, "revision", "record") };
  }

  async addComment(recordId: string, text: string): Promise<{ commentId: string }> {
    const body = await this.#request("/k/v1/record/comment.json", {
      method: "POST",
      body: JSON.stringify({ app: this.credentials.appId, record: recordId, comment: { text } }),
    });
    if (!isObject(body)) throw new Error("Invalid kintone comment response.");
    return { commentId: requireString(body, "id", "comment") };
  }

  async transitionStatus(recordId: string, action: string, assignee?: string, revision?: string): Promise<void> {
    await this.#request("/k/v1/record/status.json", {
      method: "PUT",
      body: JSON.stringify({ app: this.credentials.appId, id: recordId, action, assignee, revision }),
    });
  }
}
