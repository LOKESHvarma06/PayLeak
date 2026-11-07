# Database schema

MongoDB is the planned datastore. These collections are the initial ownership
boundaries; field definitions and indexes should be agreed before persistence work.

| Collection/model | Purpose | Expected relationships |
| --- | --- | --- |
| `User` | Account and connection settings | Owns invoices, payments, and approvals |
| `Invoice` | Invoice details and status | Belongs to a user |
| `Payment` | Captured payment and fee details | Belongs to a user; may reference an invoice |
| `WebhookEvent` | Processed payment-provider webhook record | References a provider event and account |
| `ReferenceRate` | Currency or benchmark reference rates | Time- and currency-scoped |
| `FeeSchedule` | Payment-provider fee rules | Provider-, currency-, and region-scoped |
| `RouteQuote` | Compared payment-route estimates | Belongs to a user |
| `Approval` | Review and approval decisions | Belongs to a user and target record |
| `AuditLog` | Security-relevant account activity | Belongs to a user |

Store money as integer minor units with an explicit ISO currency code. Add
retention, uniqueness, and access-control rules before production data is stored.
