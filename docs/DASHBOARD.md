# Dashboard data contract

`GET /api/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD&faculty=all&branch=all`

Returns `{ success, data }`. Data contains `filters`, `updatedAt`, `dimensions`,
`totalVisits`, `trend`, `trendInterval`, `gender`, `symptoms`, `topMedicines`,
`referrals`, `visits`, `stock`, `orders`, and `loans`.
The reads share a PostgreSQL Repeatable Read snapshot; no inventory writes occur.

- Default: today and the previous 29 days in Asia/Bangkok. End date is inclusive.
- Patient charts count visits, not unique people. All includes unaffiliated visitors.
- Faculty and branch match stored values. Available choices come from database records.
- Trend is daily up to 90 days, monthly above 90, including empty buckets.
- Drug ranking counts dispensing visits by medicine ID. Quantities remain separated
  by unit. Renamed drugs retain one ranking; visit exports retain historical snapshots.
- All medicine usage comes from Dispensation; there is no legacy medicine dataset.
- Symptoms group trimmed text with repeated whitespace collapsed. No diagnostic inference.
- Gender includes other/unspecified. Referral totals include missing hospital names.
- Active stock and loan alerts are current, independent of patient filters.
- Stock buckets are exclusive: expired, expires in 0–30 days, low, normal.
  Low means remaining <= max(1, ceil(total * 0.2)); it includes empty stock.
- Expiry chart includes expired, 0–30 and 31–90 days only. Its total is a count of
  medicine records in these ranges, not units or the entire catalogue.
- Loan alerts use outstanding items; fully returned loans do not alert.
- Refresh every 30 seconds while visible, on focus/visibility, and manually.
  Out-of-order responses cannot replace the latest requested filter. Failures retain
  the last confirmed snapshot with a visible stale notice; initial failure shows dashes.
- Latest user clarification supersedes the previous hiding behavior: preserve the
  original dashboard layout, all eight panels, stock rows, calendar, and chart types.
  Empty data leaves the original chart area blank or its value as a dash; it never
  removes a panel or rearranges the columns. Medicine ranking uses the original pie
  chart and legend, with real dispensing counts and quantities. No sample chart data.
- No extra summary bar, refresh button, ranking layout, or explanatory panels.
  Loading is unobtrusive; an API error is shown only when a request fails. The last
  update is available on the existing heading's tooltip and in exports.
- Excel export is an Excel-compatible SpreadsheetML `.xml` workbook with separate
  summary/detail worksheets. PDF uses browser print. Both report snapshot dates/time.

## Purchase history

`GET /api/catalog-orders` reads confirmed database history.
`POST /api/catalog-orders` accepts `{id, documentTitle, items}` with a stable ID.
The server appends under a shared advisory transaction lock. Reusing an ID with
the same contents returns the original order; different contents return 409.
`DELETE /api/catalog-orders/:id` removes only that ID under the same lock.
History remains in the existing `LegacyStorage` row; no schema migration is needed.
Generic legacy-storage writes for this key are blocked to prevent lost updates.

The catalogue waits for server confirmation before opening the export dialog.
A lost response can be retried with the same payload/ID. Browser-only order history
is not imported. Calendar dates prefer ISO `createdAt` in Bangkok, accept old Thai
dates, allow historical years, and display undated entries separately.

## Verification

With API on port 4000 and web on port 3000:

```powershell
cd Back-end
npm.cmd run test:dashboard
npm.cmd run test:inventory:browser
npm.cmd run verify:inventory
```

Dashboard tests use tagged database fixtures and remove only their own records in
`finally`. They cover database/API/browser parity, Bangkok dates from another browser
timezone, filters, refresh, stale/empty data, exports, historical calendar dates,
stock details, concurrent/idempotent orders, and retry after a committed response is lost.
The browser test uses installed Microsoft Edge via Playwright.
