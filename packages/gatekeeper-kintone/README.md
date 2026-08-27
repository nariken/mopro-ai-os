# kintone Gatekeeper

Connects one kintone app per account using an app-scoped API token. The session exposes app
metadata, field schema, record queries, reads, record creation and updates, comments, and process
status transitions. Every read is audited and every external write is approval-gated. Pending
field updates are overlaid on later reads; app metadata, field definitions, and individual records
use short-lived Durable Object caches.

Sharing uses an app-level ACL check: a collaborator is admitted only when their own kintone
connection can still read the same origin and app ID.

The connect flow accepts only `https://*.cybozu.com` origins and validates the app ID and token
against kintone before storing the credentials.
