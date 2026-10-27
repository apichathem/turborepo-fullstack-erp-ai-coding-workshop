## Problem Statement

RetailOne operates a head office and two stores (B01 Central, B02 Riverside). Product records, purchase orders, and stock balances live in separate files, so stock checks are slow and goods are received twice. Staff cannot trust the on-screen balance, there is no traceable history of why stock changed, and permissions are enforced by habit rather than by the system. RetailOne needs one web application that connects purchasing, receiving, sales, and reporting, with every inventory movement traceable and every balance guaranteed correct even under concurrent use.

## Solution

Deliver the initial release of a Retail ERP on this monorepo (React + NestJS + oRPC contract + Prisma/Postgres). The release covers master data, inventory with an append-only movement ledger, purchasing with a purchase-order lifecycle, goods receiving with partial deliveries, sales, reporting with CSV export, and the nonfunctional controls (auth, audit, validation, performance). The system is single-organization, Thai baht, one base unit per SKU, Thai UI, Asia/Bangkok time. Stock is tracked per store; the store is also the stock location. Correctness guarantees (no negative stock, no double posting, no lost updates, no permission bypass) are enforced at the API and database, not the UI.

This spec is the agreed release baseline. It implements the TOR's documented defaults only. Every future capability named in the TOR (Section 3 exclusions, clarifications Q-01…Q-05, change request CR-01 damaged goods) is explicitly out of scope until a separate change request.

## User Stories

1. As an Administrator, I want to manage users, stores, products, and suppliers, so that the organisation's master data is maintained in one place.
2. As an Administrator, I want roles that do not automatically grant transaction approval, so that approval authority stays separate from administration.
3. As an Administrator, I want to assign store-bound users (Purchasing officer, Store employee) to exactly one store, so that their actions are confined to that store.
4. As an Administrator, I want to create products with SKU, name, category, unit, selling price, active status, and a per-store reorder threshold, so that each store can signal low stock independently.
5. As an Administrator, I want SKUs to be unique across the organisation and immutable once a transaction exists, so that historical documents always resolve to the same product.
6. As an Administrator, I want to deactivate a product while keeping it searchable in history, so that discontinued products stay auditable but cannot be added to new documents.
7. As an Administrator, I want selling prices and reorder thresholds rejected when negative and stock quantities forced to whole numbers, so that invalid master data never enters the system.
8. As an Administrator, I want to maintain store codes/names, supplier codes/names, and supplier contacts, so that purchase orders can reference a supplier and a destination store.
9. As a Store employee, I want to search stock by SKU, product name, and store, so that I can quickly see current quantity, unit, reorder threshold, and low-stock status for my store.
10. As a Manager, I want a low-stock indicator when quantity is at or below the threshold, so that I can reorder before stockouts, including products at zero stock.
11. As any user, I want every stock increase or decrease to record product, store, quantity change, balance before and after, movement type, source document, actor, and timestamp, so that every movement is traceable.
12. As an auditor, I want confirmed movements to be impossible to edit or delete, so that the ledger is tamper-evident.
13. As the business, I want stock balance to always equal opening balance plus successful movements and never go negative, so that inventory figures are trustworthy.
14. As the business, I want document posting and stock update to succeed together or roll back together, so that there are never half-applied transactions.
15. As the business, I want concurrent transactions for the same product and store to never lose an update and to validate the latest balance at confirmation, so that the browser's displayed balance is never authoritative.
16. As a Manager, I want to increase or decrease stock with a mandatory reason recorded in history, so that manual adjustments are accountable.
17. As a Manager, I want stock reductions greater than the available balance rejected, so that an adjustment can never drive stock negative.
18. As a Purchasing officer, I want to create draft purchase orders with a supplier, destination store, expected receipt date, and at least one product line, so that I can prepare an order for approval.
19. As a Purchasing officer, I want ordered quantities forced positive and whole, purchase unit prices non-negative, and duplicate SKUs within an order rejected, so that orders are well-formed.
20. As a Purchasing officer, I want creating or approving an order to leave stock unchanged, so that stock only moves on receipt.
21. As a Purchasing officer, I want to edit a draft and submit it for approval, so that only complete orders go to a manager.
22. As a Manager, I want to approve or reject submitted orders with a reason, so that spending is controlled.
23. As the business, I want approved lines, quantities, prices, and destination store to be immutable, so that an approved order cannot be altered after the fact.
24. As a user, I want rejected orders to remain viewable and require a brand-new order to resubmit, so that history is preserved.
25. As a creator or Manager, I want to cancel only Draft or Pending Approval orders with a reason, so that approved/partially received orders cannot be cancelled in this release.
26. As a Store employee, I want to receive only Approved or Partially Received orders for my assigned store, so that I cannot receive against another store's order.
27. As a Store employee, I want the receiving screen to show ordered, previously received, and outstanding quantities per line, so that I know exactly what remains.
28. As a Store employee, I want to receive partial deliveries across multiple receipts, with each received quantity a non-negative whole number and at least one line greater than zero, so that real-world deliveries are supported.
29. As the business, I want cumulative receipts never to exceed ordered quantities and products outside the order rejected, so that receiving stays within the order.
30. As a Store employee, I want confirmation to create a goods receipt number, increase destination-store stock, and record movements, setting the order to Partially Received or Completed, so that receiving updates inventory correctly.
31. As a Store employee, I want repeated confirmation clicks, duplicate requests, and retries after a network failure to never increase stock twice and to return the original receipt, so that flaky networks never double-post.
32. As a Store employee, I want a deliberately new receipt to still be possible, so that a genuine second delivery is not blocked by idempotency.
33. As the business, I want concurrent receiving requests to never exceed the order quantity in total, so that parallel receipts stay correct.
34. As a user, I want confirmed receipts viewable but not editable or cancellable, so that receipts are final in this release.
35. As a Store employee, I want to create sales for my assigned store using active products and positive whole-number quantities, so that I can record a sale.
36. As the business, I want the current selling price applied and retained on the document, with no price override, so that sale prices are consistent and immutable.
37. As the business, I want draft sales to not reduce stock, and on confirmation to validate the latest stock for every line, rejecting the entire document if any line is short and naming the affected products, so that partial posting never happens.
38. As a Store employee, I want successful confirmation to generate a document number, record the sale, and decrease stock with movement history in one transaction, so that sales and stock stay consistent.
39. As a Store employee, I want duplicate sale confirmation to never create another sale or deduct stock again, so that double-clicks are safe.
40. As a user, I want confirmed sales viewable but not editable, cancellable, or returnable in this release, so that sales are final.
41. As a Manager, I want a daily sales report filtered by date range and store, including only confirmed sales, showing document count, units sold, and total amount, so that I can see trading performance.
42. As a Manager, I want stock-on-hand and low-stock reports by store with product search, keeping zero-stock products visible when they match, so that I can manage replenishment.
43. As a user, I want movement-history reports filtered by product, store, movement type, and date range with access to the source document, so that I can trace any change; Store employees see only their store, Managers see all.
44. As a Manager, I want to export sales and stock reports as CSV with Thai text and the same filters and permissions as the screen, so that I can work with the data offline.
45. As the business, I want CSV values that spreadsheets might read as formulas handled safely, so that exports cannot trigger formula injection.
46. As a user, I want a reporting day defined as 00:00:00 inclusive to the next 00:00:00 exclusive in Asia/Bangkok using the sale confirmation timestamp, so that daily totals are unambiguous.
47. As a user, I want zero totals and a clear empty-state message when nothing matches, so that an empty report is obvious rather than broken.
48. As a user, I want lists paginated and ordered newest-first with loading/success/error states, so that large datasets are usable.
49. As the business, I want authentication required before any data access, with role AND store permissions enforced at the API for every request (hiding UI buttons is not sufficient), so that permissions cannot be bypassed.
50. As a Store employee of B02, I want a direct API call to receive goods for B01 rejected with no data change, so that cross-store access is impossible.
51. As the business, I want passwords never stored or logged in readable form, no secrets logged, non-production test data, and config kept out of source, so that credentials are protected.
52. As an auditor, I want approvals, goods receipts, sales, and stock adjustments auditable with actor, timestamp, source document, and outcome, with access restricted by permission, so that sensitive actions are accountable.
53. As a user, I want input validated in both UI and API with actionable Thai error messages and no stack traces or database details, so that errors are understandable and safe.
54. As the business, I want the system to handle 1,000 products, 10,000 movements, and 10 concurrent users with search and stock-view p95 <= 2s over a continuous 5-minute test, so that it performs under realistic load.
55. As a user, I want core screens to work on desktop browsers at 1366px width with labelled fields and keyboard support for core operations, so that the app is usable and accessible.

## Implementation Decisions

**Role and store model (root decision).** Expand the `Role` enum from `{ADMIN, STAFF}` to the four TOR roles: Administrator, Purchasing officer, Store employee, Manager. Add a `Store` model (code, name). Add a nullable `User.storeId`: store-bound roles (Purchasing officer, Store employee) must have a store; org-wide roles (Administrator, Manager) have none and are not store-scoped. This drives every permission and most queries.

**Inventory as an append-only ledger plus a balance snapshot.** A `StockMovement` table is append-only (never edited or deleted) and records product, store, quantity change, balance before, balance after, movement type, source document reference, actor, timestamp. A `StockBalance` row per (product, store) holds the current quantity. Both are written inside one database transaction so the ledger and the balance never diverge. Current balance is read from `StockBalance`, never recomputed on the hot path; the ledger is the audit trail.

**Movement types.** `MovementType = {RECEIPT, SALE, ADJUSTMENT}` only. Receiving produces RECEIPT, sales produce SALE, manager stock changes produce ADJUSTMENT. Opening balances are seeded as an initial movement/adjustment. No movement types are added for the excluded transfer/return/reversal features.

**Purchase-order state machine.** Seven states: Draft, Pending Approval, Approved, Partially Received, Completed, Rejected, Cancelled. Transitions are encoded as one explicit table enforced at the service layer: submit (Draft -> Pending Approval), approve/reject (Pending Approval -> Approved/Rejected, with reason), receipt progress (Approved -> Partially Received -> Completed), cancel (Draft or Pending Approval -> Cancelled, with reason). After Approved, lines/quantities/prices/destination store are immutable. Rejected orders are terminal and viewable; resubmission requires a new order. Illegal transitions are rejected at the API.

**Idempotent confirmations.** Every confirm endpoint (goods receipt, sale) takes a client-supplied idempotency key. A unique constraint stores the key with the resulting document. A repeat with the same key returns the original document and performs no stock change; a new key creates a new document. This satisfies GR-04 (duplicate clicks/retries return the original receipt, a deliberate new receipt is still possible) and SAL-03.

**Atomic concurrency guarantee.** Stock decrement is a conditional, atomic database operation inside the posting transaction (e.g. `UPDATE ... WHERE quantity >= :needed`, or an equivalent row-lock / `SELECT ... FOR UPDATE` check-and-decrement), so check-and-decrement cannot interleave. The loser of a race is rejected; application-level read-then-write is not acceptable. This satisfies INV-03/INV-04, GR-05, and AC-07 (two concurrent sales of 7 against stock 10: exactly one succeeds, final stock 3).

**Historical snapshots on document lines.** Each document line (PO line, goods-receipt line, sale line) stores a snapshot of the relevant master-data values at the time of the transaction (e.g. product name and unit price copied onto the sale line). Views and reports read from the snapshot, not by joining live master data, so later edits to products/prices never alter historical documents (TOR Section 4.3, SAL-01).

**Line and document arithmetic.** Monetary values use two decimal places. Each line amount = quantity x unit price; the document total = sum of line amounts. No discounts, taxes, inventory valuation, or cost of goods sold in this release.

**API-enforced role + store authorization.** Extend the existing `@Roles()` / `AuthGuard` pattern with a store-scope check: store-bound roles may only act on their own `storeId`; org-wide roles pass the store check. Enforcement is at the guard/service layer for every request, independent of the UI. This satisfies NFR-01 and AC-04.

**Audit derived from existing records.** NFR-03 is satisfied by deriving audit from the documents and the movement ledger (which already carry actor, timestamp, source document, and outcome) rather than a separate audit table, exposed through a permission-restricted read endpoint.

**Structured error contract.** One structured API error envelope carrying a machine code and a category distinguishing "correct your input" (validation) from "retry" (conflict/transient). The web app maps these to actionable Thai messages. Internal details (stack traces, database errors) are never exposed. AC rejections (AC-03, AC-05) return a typed error the UI renders as correct-vs-retry.

**Reporting time rules.** Timestamps are stored in UTC and converted to Asia/Bangkok only at the report day boundary. A reporting day is the half-open interval `[00:00:00, next 00:00:00)` in Asia/Bangkok, keyed on the sale confirmation timestamp. Reports show zero totals and an empty-state message when nothing matches; lists are paginated and newest-first.

**CSV export safety.** The exporter sanitises any cell whose value begins with `=`, `+`, `-`, `@`, tab, or carriage return (prefix-guard so spreadsheets treat it as text), applies RFC-4180 quoting/escaping for delimiters and newlines, and writes a UTF-8 BOM so Thai renders in Excel. Same filters and permissions as the on-screen report. CSV is excluded from the performance target.

**Contract-first throughout.** All request/response shapes and validation live in `packages/contracts` as oRPC routes + Zod schemas (non-negative prices, positive whole-number quantities, unique SKU-per-order, whole-number stock). The api implements the contract; the web consumes the typed client; both derive types with `z.infer`. No hand-written request/response types in the apps.

**Performance.** A seed path produces the NFR-05 dataset (1,000 products, 10,000 movements). Search (INV-01) and stock-view/report (RPT-02) endpoints are the measured surface; indexes on the lookup keys (SKU, product×store, movement filters) support the p95 <= 2s target.

## Testing Decisions

Good tests assert external behaviour through the highest available seam, never implementation details. Everything runs on Vitest, colocated with the code. We reuse the three existing seams and add one integration harness; the ideal of few seams is preserved.

**Seam 1 - oRPC controller specs (`apps/api`, `*.spec.ts`) - primary.** Build the controller with Nest's testing module, stub `PrismaService`, invoke handlers with `call()` from `@orpc/server` (which runs contract validation like a real request). Pass the `User` straight into the method to simulate role and store. This seam proves the business behaviour and the eight acceptance scenarios as ID-tagged tests:

- AC-01 (GR-01..GR-03): receive 8 of SKU001 -> B01 stock 18, outstanding 12, Partially Received, exactly one receipt + one movement.
- AC-02 (GR-04): receive 8, resend same request -> original receipt, stock stays 18, cumulative 8.
- AC-03 (GR-02/GR-05): receive 21 -> rejected, no receipt/movement, stock stays 10, order stays Approved.
- AC-05 (SAL-02): sell 11 against 10 -> fail, no sale, no deduction.
- AC-06 (SAL-01..SAL-03): sell 2xSKU001 + 1xSKU002 = THB 155.00, balances 8 and 4, resend -> no change.
- AC-08 (RPT-01/RPT-02): no sales -> zero totals; SKU003 (0 <= threshold 3) appears in B01 low-stock report.
- PO state machine: every legal and illegal transition.
- Idempotency, snapshotting, line/total arithmetic, CSV formula-injection (feed a `=cmd`-style product name through the exporter), near-midnight Asia/Bangkok boundary.
  Prior art: `apps/api/src/auth/auth.controller.spec.ts`, `apps/api/src/health/health.controller.spec.ts`.

**Seam 2 - guard spec (`apps/api/src/auth/auth.guard.spec.ts`) - authorization.** Extend the existing guard spec with the store-scope check. AC-04 (staff_b02 direct API call to receive for B01 is rejected, no data change) and every negative-authorization test live here. Prior art: the existing `@Public`/`@Roles` cases in the same file.

**Seam 3 - contract schema tests (`packages/contracts`, `*.test.ts`) - input rules.** `Schema.safeParse()` with valid and invalid payloads for: non-negative prices/thresholds (MD-02), positive whole-number quantities (PO-01/GR-02/SAL-01), no duplicate SKUs within one order, whole-number stock. Prior art: `packages/contracts/src/health.test.ts`, `auth.test.ts`.

**Web component tests (`apps/web`, `*.test.tsx`).** Render inside a `QueryClientProvider` with a stubbed fetch to cover loading/success/error/empty states, newest-first pagination, and the correct-vs-retry Thai error rendering (NFR-04). Prior art: `apps/web/src/components/health-status.test.tsx`, `routes/login.test.tsx`.

**Integration harness against real Postgres - AC-07 and NFR-05.** A stubbed-Prisma spec cannot prove a real lost-update guarantee or real latency, so one integration harness runs against a real Postgres: AC-07 (two concurrent sales of 7 against stock 10 -> exactly one succeeds, final stock 3) and the NFR-05 load test (1,000 products / 10,000 movements / 10 concurrent users / 5-minute continuous run, p95 <= 2s on search + stock-view, p95 recorded as an artifact). Kept as a single harness, as high as possible.

**Traceability.** The delivery carries a table mapping every requirement ID (MD/INV/PO/GR/SAL/RPT/NFR) to at least one ID-tagged test, satisfying TOR Section 7.2/8.2.

## Out of Scope

Everything in TOR Section 3: general ledger, accounts payable/receivable, payroll, manufacturing, tax calculation and tax invoices, real payments, external POS/ERP integration, inter-store transfers, batch/expiry tracking, returns, and migration of real business data.

The documented defaults are built, not the future capabilities behind the clarifications: Q-01 multi-approver/threshold/delegation, Q-02 receiving against products deactivated after approval, Q-03 backdated receiving, Q-04 reversals of incorrect receipts/sales, Q-05 different purchase/sales units or barcode scanning.

CR-01 (recording damaged quantities on receipt) is under consideration and excluded from the baseline.

Also excluded this release: editing/cancelling/returning confirmed sales and receipts; cancelling Approved or partially received purchase orders; discounts, taxes, inventory valuation, cost of goods sold; customer personal data; CSV export under the performance target.

## Further Notes

- Single organisation, Thai baht, one base unit per SKU, Thai UI, Asia/Bangkok timezone.
- Sample/acceptance data per TOR Section 8: stores B01 Central and B02 Riverside; supplier SUP01 SupplyOne; users buyer01, staff_b01, staff_b02, manager01; SKU001 drinking water (B01 10, THB 60.00), SKU002 tissue (B01 5, THB 35.00), SKU003 detergent (B01 0, THB 120.00), all B02 zero, reorder threshold 3; PO-DEMO-001 Approved for B01, 20 packs SKU001 at THB 45.00, no prior receipts. Each scenario resets data and must not depend on a previous scenario's outcome.
- Deliverables (TOR 7.2): source code, install/startup/test commands, example config, data structures + migrations, seed data, test accounts, API docs, and a known-limitations/issue register, plus per-requirement acceptance criteria, traceability, test results, and evidence of technical review.
- Acceptance (TOR 7.3): all in-scope UAT cases pass; no defect causing incorrect stock, duplicate posting, permission bypass, or data loss may remain; open clarifications affecting a requirement must be resolved before that requirement is used for acceptance.
- Clarification register (TOR Section 10): Q-01..Q-05 are answered by the documented default in this baseline; any change to a future capability goes through the change-request process and updates the baseline, delivery plan, and test coverage.
