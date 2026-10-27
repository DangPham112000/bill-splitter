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
| `hasInitialFund`       | boolean                                   | Whether the group pools money up front           |
| `status`               | `open` \| `locked`                        | Locked splitters accept no new transactions      |
| `adminUserId`          | string                                    | Clerk user id of the signed-in creator           |
| `linkedEvent`          | `{ app, id }`                             | Event Manager event it was created from (DAN-96) |

Indexes: `inviteToken` (unique), `adminUserId + createdAt`, `linkedEvent.app + linkedEvent.id` (unique: one splitter per event).

`linkedEvent` is only a reference (`app` is `event-manager`). The event's title, description, dates and attendees are copied into the form once, when the splitter is created, and are not kept in sync. Event Manager's "Split costs" button opens `/events/:eventId`, which calls `splitterForEvent`: it returns the event's splitter, or creates it with the caller as admin and everyone who JOINED the event as linked members. Attendees the admin keeps (when creating from the form) become members with `userId` set to their Clerk id; the backend checks each one is an attendee of the event, read live from Event Manager with the admin's own session token.

## Member

A name inside one splitter. Members don't need an account. There is no User collection: signed-in users are identified by their Clerk user id from the ecosystem's shared Clerk app, and their email, name and avatar are read from the shared `core.users` (DAN-93).

| Field               | Type                               | Notes                                                              |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `splitterId`        | ObjectId → Splitter                |                                                                    |
| `displayName`       | string                             | As typed, up to 50 characters                                      |
| `normalizedName`    | string                             | Set automatically: lowercase, no accents, `đ` → `d`, single spaces |
| `role`              | `admin` \| `treasurer` \| `member` | Admins and treasurers can adjust any transaction                   |
| `userId`            | string                             | Optional Clerk user id, set when a signed-in user links the member |
| `createdByDeviceId` | string                             | Device that created the name, so it can be offered there again     |
| `removedAt`         | Date \| null                       | Soft delete; history stays                                         |

Indexes: `splitterId + normalizedName` unique among active members (so "Đặng Phạm" and "dang pham" clash, but a removed member's name can be reused), `splitterId + role`, `userId`.

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

Indexes: `splitterId + deletedAt + date` (the transaction list), `splitterId + createdByMemberId` ("my transactions"), `createdByDeviceId`.

**Edit rights.** A member edits a transaction only from the device in `createdByDeviceId`; from another device the app shows which device created it. Admins and treasurers can adjust any transaction. (Enforced in the API, see DAN-47.)

## AuditLog

Append-only history of transaction changes.

| Field             | Type                             | Notes                                                    |
| ----------------- | -------------------------------- | -------------------------------------------------------- |
| `splitterId`      | ObjectId → Splitter              |                                                          |
| `transactionId`   | ObjectId → Transaction           |                                                          |
| `action`          | `create` \| `update` \| `delete` |                                                          |
| `memberId`        | ObjectId → Member                | Who made the change                                      |
| `deviceId`        | string → Device                  | Where it was made from                                   |
| `before`, `after` | object \| null                   | Snapshots; `before` is null on create, `after` on delete |
| `createdAt`       | Date                             |                                                          |

Indexes: `transactionId + createdAt`, `splitterId + createdAt`.
