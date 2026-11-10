# Data model

MongoDB collections, defined with Mongoose in [`backend/src/models/`](../backend/src/models/).

```
Splitter 1 ── * Member 1 ── * Transaction 1 ── * AuditLog
                                   │
Device (global, keyed by deviceId) ┘  createdByDeviceId / AuditLog.deviceId
```

## Money and currencies

Each splitter has one currency, chosen when it is created. VND is the default; a Bangkok trip can use THB and a trip to China CNY. Any ISO 4217 code is accepted.

Every amount is an **integer in that currency's minor unit**: dong for VND (no decimals), satang for THB, fen for CNY. So 150,000 ₫ is stored as `150000` and 120.50 ฿ as `12050`. `currencyDecimals()` in [`shared/src/money.ts`](../shared/src/money.ts) gives the number of decimals for display and input. Validators reject anything that is not a safe non-negative integer, so no floats are ever stored. When a total has to be divided, use `splitEqually` / `splitByWeights`, which hand the leftover minor units to the first participants so the parts always add up to the total.

On screen, amounts use the Vietnamese number style in every currency: `formatAmount()` in [`shared/src/amountFormat.ts`](../shared/src/amountFormat.ts) turns `1250000` into `1.250.000 ₫` and `12050` THB into `120,50 ฿`, and `parseAmount()` reads what people type, including shorthands such as `50k` and `1.2tr`.

A transaction paid in another currency (say 500 ฿ on a trip tracked in VND) keeps what was actually paid in `original` and stores the converted figure in `amount`. Balances and settlement only ever use `amount`, so they stay in one currency; the exchange rate is implied by the two numbers.

## Splitter

A trip, party or project that people join.

| Field                  | Type                                      | Notes                                            |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| `name`                 | string                                    | Required, up to 100 characters                   |
| `description`          | string                                    | Optional, up to 1000 characters                  |
| `type`                 | `trip` \| `party` \| `project` \| `other` | Default `trip`                                   |
| `coverEmoji`           | string                                    | Optional, shown on the splitter's card           |
| `startDate`, `endDate` | Date                                      | Optional; `endDate` cannot be before `startDate` |
| `currency`             | ISO 4217 code                             | Default `VND`; all balances use it               |
| `inviteToken`          | string                                    | Secret part of the join link; unique             |
| `joiningEnabled`       | boolean                                   | Default `true`; the admin can turn the link off  |
| `hasInitialFund`       | boolean                                   | Whether the group pools money up front           |
| `status`               | `open` \| `locked`                        | Locked splitters accept no new transactions      |
| `adminUserId`          | string                                    | Clerk user id of the signed-in creator           |
| `linkedEvent`          | `{ app, id }`                             | Event Manager event it was created from (DAN-96) |

Indexes: `inviteToken` (unique), `adminUserId + createdAt`, `linkedEvent.app + linkedEvent.id` (unique: one splitter per event).

The join link is `/join/<inviteToken>` (DAN-36). The token is 128 random bits in base64url (22 characters). `regenerateInviteToken` replaces it, so old links stop working at once; `setJoiningEnabled` turns the link off without changing it. `invite(token)` is public and returns only what the link preview shows (name, type, emoji, dates, currency, member count), plus the splitter id when the caller can already open it.

`linkedEvent` is only a reference (`app` is `event-manager`). The event's title, description, dates and attendees are copied into the form once, when the splitter is created, and are not kept in sync. Event Manager's "Split costs" button opens `/events/:eventId`, which calls `splitterForEvent`: it returns the event's splitter, or creates it with the caller as admin and everyone who JOINED the event as linked members. Attendees the admin keeps (when creating from the form) become members with `userId` set to their Clerk id; the backend checks each one is an attendee of the event, read live from Event Manager with the admin's own session token.

## Member

A name inside one splitter. Members don't need an account. There is no User collection: signed-in users are identified by their Clerk user id from the ecosystem's shared Clerk app, and their email, name and avatar are read from the shared `core.users` (DAN-93).

| Field               | Type                               | Notes                                                              |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `splitterId`        | ObjectId → Splitter                |                                                                    |
| `displayName`       | string                             | As typed, in NFC with single spaces, up to 50 characters           |
| `normalizedName`    | string                             | Set automatically: lowercase, no accents, `đ` → `d`, single spaces |
| `role`              | `admin` \| `treasurer` \| `member` | See "Roles" below                                                  |
| `userId`            | string                             | Optional Clerk user id, set when a signed-in user links the member |
| `createdByDeviceId` | string                             | Device that created the name, so it can be offered there again     |
| `removedAt`         | Date \| null                       | Soft delete; history stays                                         |

Indexes: `splitterId + normalizedName` unique among active members (so "Đặng Phạm" and "dang pham" clash, but a removed member's name can be reused), `splitterId + role`, `userId`.

**Roles** (DAN-38). One admin, set at creation and never changed. The admin can make any member who is linked to an account (`userId` set) treasurer, and turn them back into a member, with `setMemberRole`; both are written to the AuditLog. Treasurer rights need sign-in so they follow the account to any device and survive a cleared browser. The table lives in `backend/src/permissions.ts` (`PERMISSIONS`, `roleOf`, `requirePermission`) and every new mutation checks it there:

| Action                                 | Member      | Treasurer | Admin |
| -------------------------------------- | ----------- | --------- | ----- |
| Add and edit own transactions (device) | ✓           | ✓         | ✓     |
| Edit or delete anyone's transactions   |             | ✓         | ✓     |
| Enter transactions on behalf of others |             | ✓         | ✓     |
| Manage fund contributions              |             | ✓         | ✓     |
| Mark settlement transfers as done      | payer/payee | ✓         | ✓     |
| Add/remove members, grant treasurer    |             |           | ✓     |

Name helpers live in `shared/src/names.ts` (DAN-32), so the frontend and backend agree: `cleanName` (what is stored), `normalizeName` (the key above, also used for search), `nameMatches` (search boxes: "dang" finds "Phạm Đăng") and `findSameName` (duplicate check before saving).

## Device

One browser or phone, identified by a random `deviceId` the client generates and keeps in local storage. Devices are global, not per splitter.

How the id is kept (DAN-30, [`backend/src/device.ts`](../backend/src/device.ts), [`frontend/src/lib/device.ts`](../frontend/src/lib/device.ts)):

- The browser creates a UUID on its first visit, stores it in `localStorage`, and sends it as the `X-Device-Id` header on every GraphQL request.
- On every page load it calls `registerDevice(deviceId, label)`. The server upserts the device and keeps the id in an httpOnly cookie (`bs_device`, path `/graphql`, 400 days). If the browser sends a brand-new id while the cookie names a known device, `localStorage` was cleared, so the server returns the old id and the browser keeps that. This matters on iPhones: Safari wipes `localStorage` after 7 days without a visit, but not server-set cookies.
- The label ("iPhone · Safari", "iPhone · Zalo", "Windows · Chrome") is built in the browser from the user agent and is for display only. The user can add a nickname ("Dang's phone"), asked when they first join a splitter on that device (DAN-41) and editable from the footer.
- A `deviceId` works like a password for that device's entries: the API returns it only for the caller's own device (`ThisDevice`), never for anyone else's. Other devices are shown by label and nickname only.
- Limits: private browsing, clearing the site's data (cookie included), or opening the link inside another app's browser (Zalo, Facebook) gives a new device. Entries from the old one become read-only there; a treasurer or the admin can still change them.

| Field                       | Type   | Notes                                       |
| --------------------------- | ------ | ------------------------------------------- |
| `deviceId`                  | string | Unique                                      |
| `label`                     | string | From the user agent, e.g. "iPhone · Safari" |
| `nickname`                  | string | Optional, set by the user                   |
| `firstSeenAt`, `lastSeenAt` | Date   |                                             |

## Transaction

One movement of money in a splitter.

| Field                     | Type                         | Notes                                                |
| ------------------------- | ---------------------------- | ---------------------------------------------------- |
| `splitterId`              | ObjectId → Splitter          |                                                      |
| `type`                    | see below                    |                                                      |
| `amount`                  | integer, minor units         | Greater than 0, in the splitter's currency           |
| `original`                | `{ currency, amount }`       | Optional: what was actually paid in another currency |
| `description`, `category` | string                       | Optional                                             |
| `date`                    | Date                         | When it happened (defaults to now)                   |
| `paidByMemberId`          | ObjectId → Member            | Who handed over the money                            |
| `receivedByMemberId`      | ObjectId → Member            | Who got the money                                    |
| `paidFromFund`            | boolean                      | Expense paid from the initial fund                   |
| `split`                   | `{ method, participants[] }` | Who shares an expense or income                      |
| `createdByMemberId`       | ObjectId → Member            |                                                      |
| `createdByDeviceId`       | string → Device              | Edit rights are bound to this device                 |
| `deletedAt`               | Date \| null                 | Soft delete                                          |

Rules per type, enforced on validation:

| Type                | Payer                                  | Receiver                                | Split    |
| ------------------- | -------------------------------------- | --------------------------------------- | -------- |
| `expense`           | `paidByMemberId` **or** `paidFromFund` | none                                    | required |
| `income`            | none                                   | `receivedByMemberId`                    | required |
| `fund_contribution` | `paidByMemberId`                       | the fund                                | none     |
| `transfer`          | `paidByMemberId`                       | `receivedByMemberId` (different member) | none     |

**Split.** `method` is `equal`, `exact` or `shares`. Each participant stores `memberId`, the resolved `amount`, and `shares` for the `shares` method. Amounts are stored for every method so balances never redo the rounding; they must add up exactly to the transaction `amount`, and a member appears at most once.

The split is worked out by `splitAmount()` in [`shared/src/split.ts`](../shared/src/split.ts), which the expense form also runs for its live preview. `equal` and `shares` round down and hand the leftover minor units out one each, the payer first (when they share the cost), then in member order: 100.000 ₫ / 3 paid by the second member is 33.333 + 33.334 + 33.333. `exact` takes the typed amounts, which must add up to the total.

**Adding an expense (DAN-43).** `addExpense` needs the caller to be a member (today: the member linked to their account; DAN-41 adds names picked on a device) and a registered device, which is saved as `createdByDeviceId`. The payer defaults to the caller; another payer needs `actForOthers`, and `paidFromFund` needs `manageFund` and a splitter with an initial fund. Category is one of `EXPENSE_CATEGORIES` in [`shared/src/categories.ts`](../shared/src/categories.ts) (food, transport, lodging, activities, shopping, other); `note` is optional free text. Each one is written to the AuditLog.

Indexes: `splitterId + deletedAt + date` (the transaction list), `splitterId + createdByMemberId` ("my transactions"), `createdByDeviceId`.

**Edit rights.** A member edits a transaction only from the device in `createdByDeviceId`; from another device the app shows which device created it. Admins and treasurers can adjust any transaction. (Enforced in the API, see DAN-47.)

## Balances and settlement

Computed on every read from the live transactions, never stored.

**Balances (DAN-51).** `computeBalances()` in [`shared/src/balances.ts`](../shared/src/balances.ts) gives each member, positive meaning they should receive:

```
+ expenses paid out of pocket   − share of all expenses (fund-paid ones too)
− income received and held      + share of income
+ fund contributions paid in    − fund money held as its holder (collected − spent from the fund)
+ settlement transfers sent     − settlement transfers received
```

Until the fund has a holder (milestone 5), fund money stands alone as `fund`, signed like a balance. Member balances plus `fund` always sum to exactly 0; the function throws otherwise.

**Settlement (DAN-52).** `settle()` in [`shared/src/settlement.ts`](../shared/src/settlement.ts) turns the balances into transfers. Members at 0 drop out. Up to 20 people with a non-zero balance, a bitmask search over subsets finds the most disjoint groups whose balances sum to 0; a group of k settles with k − 1 transfers, so this is the true minimum. Larger groups fall back to greedy (largest debtor pays largest creditor, at most n − 1 transfers). Input is sorted by id first, so the same balances always give the same transfers. Options: `roundTo` rounds each balance to the nearest step (1.000 ₫ for VND, one whole unit otherwise) and gives the leftover to one person (the hub, or whoever has the largest balance), so every transfer is round and `rounding` lists who gained or lost what; `viaMemberId` routes every payment through one member, usually the treasurer. An unheld fund takes part as a party of its own (a null member in the API).

## AuditLog

Append-only history of changes to transactions and members. Entries are never updated or deleted.

| Field             | Type                             | Notes                                                                 |
| ----------------- | -------------------------------- | --------------------------------------------------------------------- |
| `splitterId`      | ObjectId → Splitter              |                                                                       |
| `entity`          | `transaction` \| `member`        | Default `transaction` (entries from before DAN-37 have none)          |
| `transactionId`   | ObjectId → Transaction           | Required when `entity` is `transaction`                               |
| `targetMemberId`  | ObjectId → Member                | Required when `entity` is `member`: who was added, renamed or removed |
| `action`          | `create` \| `update` \| `delete` |                                                                       |
| `memberId`        | ObjectId → Member                | Who made the change                                                   |
| `deviceId`        | string → Device                  | Where it was made from; required for transactions                     |
| `before`, `after` | object \| null                   | Snapshots; `before` is null on create, `after` on delete              |
| `createdAt`       | Date                             |                                                                       |

Indexes: `transactionId + createdAt`, `targetMemberId + createdAt`, `splitterId + createdAt`.

**Member changes (DAN-37).** Only the admin adds, renames and removes members (`addMember`, `renameMember`, `removeMember`), and not on a locked splitter. Names follow the same rule as the unique index, so "dang" cannot be added next to "Đăng", while renaming "Dang" to "Đăng" is allowed. Removing is a soft delete (`removedAt`): the name leaves the member list and the join screen, and can be added again later. A member who pays, receives, shares or added a transaction that is not deleted cannot be removed (error code `MEMBER_IN_USE`), because that would change everyone's balance; reassigning their transactions may come later. The admin cannot be removed. Member snapshots hold `displayName`, `role` and `userId`.
