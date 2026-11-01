# Wallet Transaction API

A NestJS wallet module that accepts bank transactions as plain-text
input, parses transactions from two bank-specific formats, ignores
duplicate references when persisting records, and generates XML payloads
for outgoing transactions.

> **Scope:** This README documents the supplied `WalletController`,
> `WalletService`, and `Wallet` entity. DTO definitions, `XmlService`,
> `DateConverter`, application bootstrap/body-parser configuration, and
> database migrations were not included, so their exact behavior and
> setup are not specified here.

## Contents

-   [Overview](#overview)
-   [Architecture](#architecture)
- [Getting Started & Installation](#getting-started)
-   [Data model](#data-model)
-   [API endpoints](#api-endpoints)
-   [Incoming transaction flow](#incoming-transaction-flow)
-   [Supported incoming formats](#supported-incoming-formats)
-   [Outgoing transaction flow](#outgoing-transaction-flow)
-   [Validation and error handling](#validation-and-error-handling)
-   [Implementation notes](#implementation-notes)
-   [Project components](#project-components)

## Overview

The wallet module exposes two HTTP endpoints:

  Method   Endpoint            Purpose
  -------- ------------------- --------------------------------------------------------------------------------------------------------
  `POST`   `/wallet/recieve`   Receive newline-separated transaction records as plain text, parse them, and persist new transactions.
  `POST`   `/wallet/send`      Accept a `SendTransactionDto` and convert its payload to XML.

The receive endpoint currently recognizes two input formats:

-   **Acme Bank:** fields separated by `//`.
-   **PayTech Bank:** fields separated by `#`, with optional
    slash-delimited metadata.

A transaction\'s `reference` is unique in the database. Existing
references are filtered out before insertion, and the insert query also
uses `orIgnore()` to ignore conflicts.
## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (LTS)
- npm
- PostgreSQL

### Installation

Clone the repository:

```bash
git clone https://github.com/0xZeyad11/Coding-Wallet-Challenge
cd wallet-coding-challenge
```

## Architecture

The controller handles HTTP input and validation. The service owns
parsing, duplicate filtering, persistence, and outgoing XML
construction. TypeORM\'s repository persists `Wallet` entities.

``` mermaid
flowchart TD
    Client[HTTP Client] --> Controller[WalletController]
    Controller -->|POST /wallet/recieve| Receive[Receive plain-text body]
    Controller -->|POST /wallet/send| Send[SendTransactionDto]

    Receive --> Validate[Validate ReceiveTransactionDTO]
    Validate --> Split[Split body into lines]
    Split --> Service[WalletService]
    Service --> Detect{Contains #?}
    Detect -->|Yes| PayTech[Parse PayTech format]
    Detect -->|No| Acme[Parse Acme format]
    PayTech --> Parsed[Parsed transactions]
    Acme --> Parsed
    Parsed --> Duplicates[Find existing references]
    Duplicates --> Filter[Filter existing references]
    Filter --> Insert[Insert with conflict ignore]
    Insert --> Repository[(TypeORM Repository)]
    Repository --> Response[Return inserted transactions]

    Send --> Service
    Service --> XML[XmlService.build]
    XML --> XMLResponse[Return XML string]
```

## Data model

The `Wallet` entity maps to the `wallet` database table.

  Property      Database mapping                   Description
  ------------- ---------------------------------- ------------------------------------------------------
  `id`          UUID primary key                   Generated automatically.
  `reference`   Unique column                      Transaction reference; used for duplicate detection.
  `amount`      `decimal(10, 3)`, default `0.0`    Transaction amount.
  `notes`       Nullable `jsonb`                   Optional transaction metadata.
  `date`        Column inferred by TypeORM         Transaction date parsed from the input.
  `createdAt`   `timestamptz` create-date column   Automatically populated creation timestamp.

The entity\'s `notes` property is typed as `TransactionMetaData | null`.

``` mermaid
erDiagram
    WALLET {
        uuid id PK
        string reference UK
        decimal amount
        jsonb notes
        date date
        timestamptz createdAt
    }
```

## API endpoints

### 1. Receive transactions {#1-receive-transactions}

`POST /wallet/recieve`

The controller expects a non-empty plain-text request body containing
one transaction per line. It trims the body, splits it on either Windows
(`CRLF`) or Unix (`LF`) line endings, and removes empty lines.

**Conceptual request body:**

``` text
125,500//ACME-REF-001//2026-10-31
75,250//ACME-REF-002//2026-10-31
```

The example above illustrates the Acme format; the actual accepted date
format depends on `DateConverter`.

On success, the controller returns an object with:

-   `status`: `"Success"`.
-   `length`: number of records returned by the insert operation.
-   `transaction`: the inserted wallet records.

**Response shape:**

``` json
{
  "status": "Success",
  "length": 1,
  "transaction": [
    {
      "id": "generated-uuid",
      "reference": "ACME-REF-001",
      "amount": 125.5,
      "notes": null,
      "date": "2026-10-31T00:00:00.000Z",
      "createdAt": "2026-11-02T00:00:00.000Z"
    }
  ]
}
```

This is an illustrative response shape, not a captured runtime response.
Database and date serialization details may differ.

If no new records remain after duplicate filtering, the service returns
an empty array. The controller consequently returns `length: 0` and
`transaction: []`.

### 2. Send a transaction {#2-send-a-transaction}

`POST /wallet/send`

The controller accepts a `SendTransactionDto` request body and passes it
to `WalletService.sendTransaction()`.

The service adjusts selected optional values, then delegates XML
generation to `XmlService.build()`. The endpoint returns the resulting
XML string.

The exact DTO fields, validation rules, XML schema, and response content
type cannot be documented from the supplied files because the DTO and
XML service implementation were not included.

## Incoming transaction flow

``` mermaid
sequenceDiagram
    participant Client
    participant Controller as WalletController
    participant Service as WalletService
    participant Parser as Bank Parser
    participant DB as Wallet Repository

    Client->>Controller: POST /wallet/recieve (plain text)
    Controller->>Controller: Check body is non-empty
    Controller->>Controller: Split into non-empty lines
    Controller->>Controller: Validate ReceiveTransactionDTO
    Controller->>Service: recieveTransaction(lines)

    loop Each transaction line
        Service->>Parser: Detect format and parse line
        Parser-->>Service: Transaction
    end

    Service->>DB: Find rows with matching references
    DB-->>Service: Existing transactions
    Service->>Service: Filter existing references

    alt New transactions exist
        Service->>DB: Insert new rows with orIgnore()
        DB-->>Service: Inserted rows
    else All transactions already exist
        Service-->>Controller: Empty array
    end

    Controller-->>Client: Success status, count, transactions
```

### Duplicate handling

The service applies two layers of duplicate protection:

1.  It queries the repository for existing records whose references are
    in the incoming batch.
2.  It filters those references out before building the insert.
3.  It executes the insert with `orIgnore()` as an additional conflict
    safeguard.

The unique constraint on `Wallet.reference` provides the database-level
uniqueness rule. The insert result is used to construct the response,
and `amount` is converted to a JavaScript `number` before returning.

## Supported incoming formats

The service chooses a parser based on whether the raw line contains `#`.

### Acme Bank

**Delimiter:** `//`

The parser reads three positional fields:

  Position   Meaning     Processing
  ---------- ----------- -----------------------------------------------------------------------------
  1          Amount      Comma decimal separator is replaced with a dot, then converted to `number`.
  2          Reference   Stored as the transaction reference.
  3          Date        Passed to `DateConverter`.

**Example:**

``` text
125,500//ACME-REF-001//2026-10-31
```

The parser does not attach metadata for this format.

### PayTech Bank

**Delimiter:** `#`

The parser reads three sections:

  Section   Meaning           Processing
  --------- ----------------- -------------------------------------------------------------------------------------------------
  1         Date and amount   First 8 characters are treated as the date; the remaining characters are treated as the amount.
  2         Reference         Stored as the transaction reference.
  3         Metadata          Parsed as alternating key/value entries separated by `/`.

**Example structure:**

``` text
20261031125,500#PAYTECH-REF-001#customer/12345/channel/mobile
```

The first section is split as follows:

-   `20261031` → date string passed to `DateConverter`.
-   `125,500` → amount, with comma replaced by dot and converted to
    `number`.

Metadata is parsed in key/value pairs:

``` text
customer/12345/channel/mobile
```

becomes:

``` json
{
  "customer": "12345",
  "channel": "mobile"
}
```

The metadata parser throws `BadRequestException` if the number of
slash-separated parts is odd, or if a key or value is empty.

## Outgoing transaction flow

``` mermaid
flowchart TD
    Request[POST /wallet/send] --> DTO[SendTransactionDto]
    DTO --> Service[WalletService.sendTransaction]
    Service --> Normalize[Normalize selected optional fields]
    Normalize --> Filter[Build filtered payload]
    Filter --> XML[XmlService.build]
    XML --> Result[Return XML string]
```

The service currently performs these transformations before building
XML:

-   Sets `PaymentType` to `undefined` when its value is `99`.
-   Sets `ChargeDetails` to `undefined` when its value is `'SHA'`.
-   Sets `Notes` to `undefined` when `Notes.Note` exists and has a
    length of zero.
-   Builds a new object from the payload entries and passes it to
    `XmlService.build()`.

See [Implementation notes](#implementation-notes) for an issue in the
current payload-filter condition.

## Validation and error handling

The receive controller:

-   Rejects a falsy/empty body with `BadRequestException`.
-   Creates a `ReceiveTransactionDTO` and assigns the body to its
    `content` property.
-   Runs `class-validator`\'s `validate()` function.
-   Flattens validation constraint messages and returns them in a
    `400 Bad Request` response when validation fails.

The service\'s metadata parser also throws `BadRequestException` for
malformed metadata.

The supplied files do not show a global validation pipe, exception
filter, authentication/authorization guard, rate limiting, or webhook
signature verification. Their presence elsewhere in the application
cannot be determined from these files.

## Implementation notes

These are observations about the supplied implementation, not claims
that the behavior has been tested.

1.  **Payload filtering condition:**
    `value != null || value != undefined` does not remove `null` or
    `undefined` values. To remove both, use `value != null` (which
    checks both cases), or an explicit
    `value !== null && value !== undefined`.
2.  **Duplicate race conditions:** the pre-insert lookup is useful for
    filtering, but concurrent requests can still race. The unique
    database constraint and conflict-ignore insert are important
    safeguards.
3.  **Input format validation:** the bank parsers access positional
    array entries after splitting. The supplied service code does not
    explicitly validate the number or shape of all fields before
    converting them.
4.  **Numeric conversion:** `Number(...)` can produce `NaN` for
    malformed amounts. No explicit finite-number check appears in the
    supplied service.
5.  **Request body parsing:** the controller expects `@Body()` to
    provide a string. The application bootstrap and body-parser
    configuration were not supplied, so verify that the server is
    configured to parse the incoming plain-text content type as a
    string.
6.  **Naming consistency:** the current route and service method use the
    spelling `recieve`. Renaming them to `receive` would be a breaking
    API change unless the old route is retained or aliased.

## Project components

  Component                 Responsibility
  ------------------------- ------------------------------------------------------------------------------------------------------
  `WalletController`        Defines receive/send HTTP endpoints, splits incoming text, and validates the receive DTO.
  `WalletService`           Parses bank records, filters duplicates, persists wallet transactions, and delegates XML generation.
  `Wallet`                  TypeORM entity representing a stored wallet transaction.
  `ReceiveTransactionDTO`   Validates the receive request\'s `content` property. Its implementation was not supplied.
  `SendTransactionDto`      Defines the outgoing transaction request. Its implementation was not supplied.
  `XmlService`              Builds XML for outgoing transactions. Its implementation was not supplied.
  `DateConverter`           Converts bank-provided date strings into `Date` values. Its implementation was not supplied.

## Files reviewed

-   `wallet.controller.ts`
-   `wallet.service.ts`
-   `wallet.entity.ts`
