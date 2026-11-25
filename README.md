# n8n-nodes-versendo

This is an n8n community node. It lets you send real paper letters by Deutsche Post to addresses in Germany from your n8n workflows.

[Versendo](https://versendo.de) prints, envelopes and posts letters: dunning letters and payment reminders, invoices for customers without email, cancellations, deadlines. You send text (Versendo lays it out according to DIN 5008) or your own finished PDF, optionally as Einwurf-Einschreiben (registered mail) with a Deutsche Post tracking number.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) ·
[Operations](#operations) ·
[Credentials](#credentials) ·
[Compatibility](#compatibility) ·
[Usage](#usage) ·
[Resources](#resources) ·
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-versendo`.

## Operations

**Letter**

- **Send Text**: Versendo lays out a DIN 5008 letter from sender, recipient, subject and text, prints and posts it. Optional: references (customer or invoice number, shown top right), attachments, registered mail, sender abroad.
- **Send PDF**: Print and post your own PDF, for example a dunning letter from your accounting software. A4 portrait, at most 8 pages. The recipient address must sit in the DIN 5008 envelope window, or turn on **Add Cover Page** and Versendo puts an address page in front.
- **Get**: Status of a letter, its price and, for registered mail, the Deutsche Post tracking number.

**Price**

- **Get**: Current prices per letter.

Attachments (PDF, JPG or PNG, up to 5 files) come from binary fields of the input item and are printed behind the letter.

## Credentials

You need a Versendo API key. No account or contract is required to start:

1. Get a free **test key** (`vs_test_…`) at [versendo.de/entwickler](https://versendo.de/entwickler). With a test key everything works like in production (PDF, status, prices), but nothing is printed and nothing is charged.
2. For real letters create a **live key** (`vs_live_…`) with prepaid balance at [versendo.de/guthaben](https://versendo.de/guthaben). Letters are paid from the balance. A daily spending limit protects you from runaway workflows.
3. In n8n create a **Versendo API** credential and paste the key. Leave **Base URL** as it is.

The credential test calls `GET /v1/webhook`, which only answers for a valid key.

## Compatibility

Tested with n8n 2.49 (self-hosted). Requires an n8n version that supports `n8nNodesApiVersion` 1.

## Usage

- **Avoid duplicate letters**: set **Idempotency Key** under Additional Fields, for example `{{ $json.invoiceNumber }}-stage-2`. The same key never creates a second letter, even if the workflow runs again.
- **Errors**: Versendo answers with clear messages, for example 402 when the balance is too low or 422 when a letter legally needs a handwritten signature (Versendo does not send those). Turn on **Settings → On Error → Continue** to handle them in the workflow; the output then contains `error`, `description` and `httpCode`.
- **Size**: the whole request may be at most about 4.5 MB, so roughly 3 MB of PDF and attachments together.
- **Recipients** must be in Germany. Senders may live abroad (set **Sender Country**).
- **AI agents**: the node can be used as a tool. Keep a test key while trying it out.

Ready-made workflows (Google Sheets dunning run, Lexware Office reminders with the invoice attached, letter status tracking) are available at [versendo.de/anleitungen/n8n](https://versendo.de/anleitungen/n8n#vorlagen).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Versendo API documentation](https://versendo.de/entwickler)
- [Versendo with n8n (German)](https://versendo.de/anleitungen/n8n)
- [Privacy and data processing agreement for businesses (German)](https://versendo.de/geschaeftskunden)

## Version history

### 0.1.0

First release: send text and PDF letters with attachments, get letter status, get prices.
