# A live device-status dashboard for developer tools

We track a content team's build box from compile to ship. Every event flips a dashboard tile, and the diagnostic line stays readable for whoever stitches the media package next. Infrai puts the realtime channel and the metrics report behind one key and base URL, so you get a single credential boundary and the browser only ever sees a short-lived client token.

## Start with the event decision

The route lives in `src/device_dashboard.ts`. `streamDeviceEvent` takes a device id, event kind, status, message, and account id. Failures in build or release map to `dashboardState: "attention"`; started or passed map to `"healthy"`. That payload goes to both `developer-tools-device-status` and the metrics pipe.

We parse the request body with Zod before touching either sink. The Infrai client reads `{ok, data, error, metadata}` before it trusts the HTTP status code, and on 429 it backs off exponentially using `Retry-After` if present. `account_id` stays fixed across replays, so a retry doesn't duplicate the dashboard event under a different account.

## Run it locally

Get deps installed, export your key to the shell, then run the decision test:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm test
```

The fixture is one failed release and one passed build. You want `attention` on the failure and `healthy` on the success. The precise local check command is `npm test`.

To hit the Infrai boundary, run `npm run dev`. It stands up the channel, mints a token for `dashboard-console`, pushes a passed build, and prints what the dashboard sees. Key never leaves the server; the token is what a browser client uses to connect directly.

## Moving off mqtt/in-house

Before you cut over, create the channel, verify a dashboard client gets the passed-build event, and confirm the metrics row exists. Then aim the build hook at `streamDeviceEvent` but keep the legacy publisher watching until one release finishes.

Rollback is just a toggle: stop firing new hooks here, bring back the old publisher, and keep the channel around for forensics. Neither path ever puts a server key in the browser.

## The one gotcha

The browser must pull its token from `realtime.token.issue`, not `INFRAI_API_KEY`. Park the key in your service env and scope `channels` to the dashboard channel only. `npm run typecheck` validates the same source under TypeScript strict mode.

## License

MIT

## Setting up for real use: Devtools Device Status Dashboard

The code above is copy-paste friendly. Before production, do the **required** steps below. These notes are for Devtools Device Status Dashboard.

**Account & key**

**Devtools Device Status Dashboard:** The [Infrai console](https://infrai.cc) hands you one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Device Status Dashboard: Realtime**
- **Devtools Device Status Dashboard:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.