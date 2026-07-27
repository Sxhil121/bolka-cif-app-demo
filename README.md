# Bolka CIF App Demo

A real Next.js app for testing the Dynamics 365 Channel Integration
Framework (CIF) click-to-call flow the way a real embedded app actually
behaves — real routing, real page loads, a real login page — rather than a
single flat HTML file. It's still a **test harness**: no real
authentication and no real Dataverse writes. However, outbound calling is
now **real**, via Tata Smartflo's Click-to-Call API — clicking to call
places an actual phone call.

This is a sibling project to the earlier static demo,
[`bolka-cif-demo`](https://github.com/Sxhil121/bolka-cif-demo) — that one
was a single HTML file; this one is a proper Next.js app with a login page
and a dedicated dialpad route.

## What this is and isn't

- **Is**: a real Next.js (App Router) app with two real routes (`/login`,
  `/dialpad`), real client-side navigation between them, and a real
  integration with Microsoft's CIF JavaScript API (`CIFInitDone`,
  `Microsoft.CIFramework.addHandler`).
- **Isn't**: a production app. There is no real authentication (the login
  form just checks both fields are non-empty) and no real Dataverse
  writes. The remaining seam is marked `// TODO: real integration — ...`
  in `app/dialpad/DialpadClient.js`.

## Running it locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — it redirects to `/login`. Log in with any
non-empty email/password to reach `/dialpad`.

Visiting `/dialpad` directly with no `ucilib` query parameter (which is how
you'll load it outside of Dynamics) auto-detects that it isn't running
inside a Dynamics CIF panel and drops into **standalone preview mode**:

- The status dot turns blue and reads "Standalone preview".
- A **"Simulate incoming click-to-call"** button appears, fabricating an
  `onclicktoact`-shaped payload (`{ value, name, format,
  entityLogicalName }`) around whatever number is in the destination
  field, so the trigger path can be tested without Dynamics — but it
  places a **real call**, same as manual dial.
- The manual dial box works the same way in every mode.
- The event log panel shows every event, real or simulated, timestamped
  and pretty-printed.

## Setting up real click-to-call (Tata Smartflo)

`app/api/click-to-call/route.js` is a server-only Next.js Route Handler
that calls Tata Smartflo's **Click to Call Support** API. It's server-only
on purpose: the Tata API key must never reach the browser bundle. The
client only ever sends `{ toNumber }` to this route; the route holds the
API key as a server-side environment variable and does the rest.

**Why this specific API, not the plain Click to Call API**: Tata actually
has two different click-to-call endpoints, and they behave differently:

- `POST /v1/click_to_call` (email/password login → bearer token,
  `agent_number` + `destination_number`) — but `agent_number` must be the
  agent's **mobile number** (their `follow_me_number`). It cannot target a
  Smartflo **extension**/softphone — Tata rejects any other value with
  `"This agent_number doesn't belong to your associated agent."`
- `POST /v1/click_to_call_support` (a static `api_key` + `customer_number`,
  no login needed) — the destination agent leg (Mobile **or** Extension) is
  baked into the `api_key` itself when it's generated in the Smartflo
  dashboard. This is the one this app uses, because it's what lets the call
  ring an agent's **extension/softphone** instead of their mobile.

**How the call actually works**: Tata rings the agent leg configured
behind the API key first (in this app's case, a specific Smartflo
extension); once someone picks up, Tata bridges the call to `toNumber`
(`customer_number`). It is not an in-browser/WebRTC call — a real phone or
softphone rings.

**To get the API key**: in the Smartflo admin dashboard, go to
**API Connect → Click to Call Support API**, and either use an existing
enabled key or **Generate API Key**, choosing the **Extension** (not
Mobile) as the destination type for the agent you want calls to ring.

1. Copy `.env.local.example` to `.env.local` and fill in:
   - `TATA_CTC_SUPPORT_API_KEY` — the key from the dashboard above
   - `TATA_EMAIL` / `TATA_PASSWORD` / `TATA_CALLER_ID` — not used by the
     current calling code path, kept for reference / possible future use
     of other Tata APIs
2. For the deployed app, set the same variables in Vercel:
   **Project → Settings → Environment Variables** (or `vercel env add
   TATA_CTC_SUPPORT_API_KEY`, etc., run from your own terminal so the
   value is typed directly into the CLI prompt and never stored in a chat
   log or a file).
3. Restart `npm run dev` (or redeploy) after setting them.

**What happens under the hood on each call** (see
`app/api/click-to-call/route.js`):
```
POST https://api-smartflo.tatateleservices.com/v1/click_to_call_support
{ customer_number, api_key, async: 1, call_timeout }
```

**Safety note**: this dials real phones and may incur real charges. The
dialpad shows a confirmation dialog before every call, and "End call" only
updates the local UI — it does not hang up the real call (Tata's
Click-to-Call Support API is fire-and-forget; there's no documented cancel
endpoint), so hang up on your own handset/softphone when you're done.

## Deployed URLs

- GitHub repo: https://github.com/Sxhil121/bolka-cif-app-demo
- Live app (Vercel): https://bolka-cif-app-demo.vercel.app

## Registering this as a Channel Provider in Dynamics 365

Same CIF 1.0 admin flow as any custom provider:

1. Sign in to Dynamics 365 → **Settings (cog icon) → Advanced Settings**,
   and install the **Channel Integration Framework** app from Microsoft
   AppSource if it isn't already installed.
2. Open the **Channel Integration Framework** app → **New** to add a
   provider.
3. Fill in:
   - **Name** / **Label** — e.g. `Bolka Demo`
   - **Channel URL** — the deployed `/dialpad` route with `ucilib`
     appended, e.g.
     `https://bolka-cif-app-demo.vercel.app/dialpad?ucilib=https://<org>.crm.dynamics.com/webresources/Widget/msdyn_ciLibrary.js`
   - **Enable Outbound Communication** = `Yes`
   - **Channel Order** — e.g. `1`, or higher than an existing provider if
     testing alongside one
   - **API Version** = `1.0`
   - **Trusted Domain** — `bolka-cif-app-demo.vercel.app`
   - **Unified Interface Apps** — Sales Hub / Customer Service Hub, as
     applicable
   - **Security roles** — whichever roles should see the provider
4. Save, open the selected app, and click a phone-number field on a record
   — this should trigger `onclicktoact` in the deployed `/dialpad` page.

### Important gotcha

The underlying `msdyn_ciprovider` entity is **only readable by
administrator security roles by default**. If a non-admin agent doesn't see
the panel, create a security role with **read** access to
`msdyn_ciprovider` and assign it to the agents who need the panel. This is
documented in Microsoft's own configuration guide (see References below).

### Recommended: use a throwaway environment

Test in a trial/sandbox Dynamics 365 environment, not production —
especially if another CIF provider (e.g. an existing Tata Smartflo
integration) is already configured there.

## What's real vs. simulated

| Area | Status | Details |
|---|---|---|
| `/login` page and navigation to `/dialpad` | **Real page, fake auth** | Real route, real client-side navigation; only checks both fields are non-empty |
| Detecting `ucilib` param, injecting the CIF library `<script>` | **Real** | Reads via `useSearchParams` in `app/dialpad/DialpadClient.js`, injects the script Dynamics tells it to load |
| `CIFInitDone` event | **Real** | Genuine Microsoft readiness event; nothing else is called before it fires |
| `Microsoft.CIFramework.addHandler("onclicktoact", ...)` | **Real** | Registers a real handler; the raw `eventData` Dynamics sends is logged verbatim |
| `onclicktoact` → call trigger | **Real** | The trigger is real, and it now places a real call |
| Originating the call (Tata Smartflo `click_to_call_support`) | **Real** | Server-side route in `app/api/click-to-call/route.js`; rings a real Smartflo extension, then bridges to the destination |
| "In progress" timer, "End call" | **Local UI only** | The timer is just a local clock; "End call" does not hang up the real call — Tata's API is fire-and-forget with no cancel endpoint |
| Wrap-up (disposition + notes) → "Log call activity" | **Simulated** | Appends to an in-memory array only; a page reload wipes it |
| `createRecord`/`retrieveRecord`/`updateRecord`/`deleteRecord`, `getEnvironment`, `setWidth`/`getWidth`, `setMode`/`getMode`, `searchAndOpenRecords`, `openForm`, `renderSearchPage`, `removeHandler`, `raiseEvent`, `updateContext` | **Referenced only** | Listed/commented in `DialpadClient.js` for future use; none are invoked |
| Writing the call activity back into Dataverse | **Not implemented** | Marked `// TODO: real integration — ...` in `DialpadClient.js` |

Search `app/dialpad/DialpadClient.js` for `TODO: real integration` to find
the one remaining seam — writing the logged call activity into Dataverse.

## Reference documentation

Every API name, event shape, and config field used above comes from these
official Microsoft Learn pages:

- Getting started: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/channel-integration-framework
- Build a communication widget: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/administer/getting-started-simple-widget
- Configure a channel provider (fields, `msdyn_ciprovider` permission gotcha): https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/administer/configure-channel-provider-channel-integration-framework
- Enable outbound communication (ClickToAct): https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/administer/enable-outbound-communication-clicktoact
- Pass a Dynamics 365 URL to the widget library (`ucilib`): https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/whats-new-channel-integration-framework
- Client-side events index: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/develop/reference/client-side-events
- `CIFInitDone` reference: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/develop/reference/events/cifinitdone
- `onclicktoact` reference (exact `eventData` shape): https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/develop/reference/events/onclicktoact
- `Microsoft.CIFramework.addHandler` reference: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/develop/reference/microsoft-ciframework/addhandler
- `Microsoft.CIFramework` full method index (also the 10-second timeout note): https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/v1/develop/reference/microsoft-ciframework
- Choosing between CIF 1.0 and 2.0: https://learn.microsoft.com/en-us/dynamics365/channel-integration-framework/choose-between-versions

Tata Smartflo Click-to-Call API:

- Click to Call Support (used by this app — supports Extension as a destination): https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call_support
- Click to Call (mobile/`follow_me_number` only — not used here): https://docs.smartflo.tatatelebusiness.com/reference/v1click_to_call
- Generate a token (login, used only if other Tata APIs are added later): https://docs.smartflo.tatatelebusiness.com/reference/generate-a-token
