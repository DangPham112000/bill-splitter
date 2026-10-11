# Data model

MongoDB collections, defined with Mongoose in [`backend/src/models/`](../backend/src/models/).

```
Splitter 1 ── * Member 1 ── * Transaction 1 ── * AuditLog
                                   │
Device (global, keyed by deviceId) ┘  createdByDeviceId / AuditLog.deviceId
```

## Money

Every amount is an **integer number of VND**: no floats, no minor units. Validators reject anything that is not a safe non-negative integer (`isVndAmount` in `money.ts`). When a total has to be divided, use `splitEqually` / `splitByWeights`, which hand the leftover dong to the first participants so the parts always add up to the total.

## Splitter

A trip, party or project that people join.

| Field                  | Type                                      | Notes                                            |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| `name`                 | string                                    | Required, up to 100 characters                   |
| `type`                 | `trip` \| `party` \| `project` \| `other` | Default `trip`                                   |
| `startDate`, `endDate` | Date                                      | Optional; `endDate` cannot be before `startDate` |
| `currency`             | `VND`                                     | Only VND for now                                 |
| `inviteToken`          | string                                    | Secret part of the join link; unique             |
| `hasInitialFund`       | boolean                                   | Whether the group pools money up front           |
| `status`               | `open` \| `locked`                        | Locked splitters accept no new transactions      |
| `adminUserId`          | string                                    | Signed-in creator's auth user id                 |

Indexes: `inviteToken` (unique), `adminUserId + createdAt`.

## Member

A name inside one splitter. Members don't need an account.

| Field               | Type                               | Notes                                                              |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `splitterId`        | ObjectId → Splitter                |                                                                    |
| `displayName`       | string                             | As typed, up to 50 characters                                      |
| `normalizedName`    | string                             | Set automatically: lowercase, no accents, `đ` → `d`, single spaces |
| `role`              | `admin` \| `treasurer` \| `member` | Admins and treasurers can adjust any transaction                   |
| `userId`            | string                             | Optional link to a signed-in account                               |
| `createdByDeviceId` | string                             | Device that created the name, so it can be offered there again     |
| `removedAt`         | Date \| null                       | Soft delete; history stays                                         |

Indexes: `splitterId + normalizedName` unique among active members (so "Đặng Phạm" and "dang pham" clash, but a removed member's name can be reused), `splitterId + role`, `userId`.

## Device

One browser or phone, identified by a random `deviceId` the client generates and keeps in local storage. Devices are global, not per splitter.

| Field                       | Type   | Notes                                       |
| --------------------------- | ------ | ------------------------------------------- |
| `deviceId`                  | string | Unique                                      |
| `label`                     | string | From the user agent, e.g. "iPhone · Safari" |
| `nickname`                  | string | Optional, set by the user                   |
| `firstSeenAt`, `lastSeenAt` | Date   |                                             |

## Transaction

One movement of money in a splitter.

| Field                     | Type                         | Notes                                |
| ------------------------- | ---------------------------- | ------------------------------------ |
| `splitterId`              | ObjectId → Splitter          |                                      |
| `type`                    | see below                    |                                      |
| `amount`                  | integer VND                  | Greater than 0                       |
| `description`, `category` | string                       | Optional                             |
| `date`                    | Date                         | When it happened (defaults to now)   |
| `paidByMemberId`          | ObjectId → Member            | Who handed over the money            |
| `receivedByMemberId`      | ObjectId → Member            | Who got the money                    |
| `paidFromFund`            | boolean                      | Expense paid from the initial fund   |
| `split`                   | `{ method, participants[] }` | Who shares an expense or income      |
| `createdByMemberId`       | ObjectId → Member            |                                      |
| `createdByDeviceId`       | string → Device              | Edit rights are bound to this device |
| `deletedAt`               | Date \| null                 | Soft delete                          |

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
