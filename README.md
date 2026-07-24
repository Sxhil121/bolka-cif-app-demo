# Bolka CIF App Demo

A real Next.js app for testing the Dynamics 365 Channel Integration
Framework (CIF) click-to-call flow the way a real embedded app actually
behaves — real routing, real page loads, a real login page — rather than a
single flat HTML file. It's still just a **test harness**: no real
authentication, no real telephony backend, no real Dataverse writes. Only
the parts that talk to Dynamics 365 via the CIF JavaScript API are real.

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
  form just checks both fields are non-empty), no real telephony backend,
  and no real Dataverse writes. Every place a real integration would plug
  in is marked `// TODO: real integration — ...` in
  `app/dialpad/DialpadClient.js`.

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
  entityLogicalName }`) so the full call lifecycle — ringing → connected →
  end call → wrap-up → logged call — can be exercised with zero Dynamics
  connection.
- The manual dial box works the same way in every mode.
- The event log panel shows every event, real or simulated, timestamped
  and pretty-printed.

## Deployed URLs

- GitHub repo: `<TBD — filled in after push>`
- Live app (Vercel): `<TBD — filled in after deploy>`

## Registering this as a Channel Provider in Dynamics 365

Same CIF 1.0 admin flow as any custom provider:

1. Sign in to Dynamics 365 → **Settings (cog icon) → Advanced Settings**,
   and install the **Channel Integration Framework** app from Microsoft
   AppSource if it isn't already installed.
2. Open the **Channel Integration Framework** app → **New** to add a
   provider.
3. Fill in:
   - **Name** / **Label** — e.g. `Bolka Demo`
   - **Channel URL** — your deployed app's `/dialpad` route with `ucilib`
     appended, e.g.
     `<vercel-url>/dialpad?ucilib=https://<org>.crm.dynamics.com/webresources/Widget/msdyn_ciLibrary.js`
   - **Enable Outbound Communication** = `Yes`
   - **Channel Order** — e.g. `1`, or higher than an existing provider if
     testing alongside one
   - **API Version** = `1.0`
   - **Trusted Domain** — the Vercel app's domain (e.g.
     `<app-name>.vercel.app`)
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
| `onclicktoact` → simulated call trigger | **Real event, simulated response** | The trigger is real; everything after is fake |
| Ringing → connected → timer → end call | **Simulated** | No telephony backend, no network calls, purely local state/timers |
| Wrap-up (disposition + notes) → "Log call activity" | **Simulated** | Appends to an in-memory array only; a page reload wipes it |
| `createRecord`/`retrieveRecord`/`updateRecord`/`deleteRecord`, `getEnvironment`, `setWidth`/`getWidth`, `setMode`/`getMode`, `searchAndOpenRecords`, `openForm`, `renderSearchPage`, `removeHandler`, `raiseEvent`, `updateContext` | **Referenced only** | Listed/commented in `DialpadClient.js` for future use; none are invoked |
| Any Bolka backend call (e.g. `POST /calls/originate`) | **Not implemented** | Every seam is marked `// TODO: real integration — ...` |

Search `app/dialpad/DialpadClient.js` for `TODO: real integration` to find
every place real telephony or a real Dataverse write would eventually
replace the simulation.

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
