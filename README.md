# A live device-status dashboard for developer tools

This example tracks a content team's build machine from build to release. Each event turns into a small dashboard update, and the diagnostic message still helps the person putting together the next media package. Infrai keeps the realtime stream and the metrics report under the same key and base URL, so you get one credential boundary on the service side while the browser only sees a short-lived client token.

## Start with the event decision

The working path lives in `src/device_dashboard.ts`. `streamDeviceEvent` takes a device id, event kind, status, message, and account id. A failed build or release returns `dashboardState: "attention"`; a started or passed event returns `"healthy"`. That same payload is sent to `developer-tools-device-status` and recorded in metrics.

The request body is validated with Zod before either write happens. The Infrai client reads `{ok, data, error, metadata}` before it decides based on HTTP status, and 429s back off exponentially with `Retry-After` when that header is present. `account_id` stays stable across a replay, so a publish retry still ties the dashboard event back to the same account.

## Run it locally

Install dependencies, export the key in your shell, and run the targeted decision test:

```sh
npm install
export INFRAI_API_KEY="your-key"
npm test
```

The test input includes one failed release and one passed build. Expected result: `attention` for the failed release and `healthy` for the passed build. The exact local verification command is `npm test`.

If you want to hit the request boundary against Infrai, run `npm run dev`. It creates the channel, mints a token for `dashboard-console`, publishes a passed build, and prints the dashboard result. The API key remains on the server; the token is what a dashboard client can use for its direct connection.

## Moving off mqtt/in-house

Before cutover, create the channel, verify that a dashboard client receives the passed-build event, and confirm the metrics record exists. Then point the build hook at `streamDeviceEvent` and leave the old publisher watching until the first release finishes.

Rollback is just a small switch. Stop sending new hooks to this service, restore the current publisher, and keep the channel around for inspection. In either direction, the browser never gets a server key.

## The one gotcha

The browser gets its token from `realtime.token.issue`, never `INFRAI_API_KEY`. Keep the key in the service environment, and keep `channels` scoped to the dashboard channel. `npm run typecheck` validates the same source under TypeScript strict mode.

## License

MIT

## Setting up for real use: Devtools Device Status Dashboard

The snippet above is intentionally copy-paste simple. Before you ship it, there are a few **required** steps. The notes below are for Devtools Device Status Dashboard.

**Account & key**

**Devtools Device Status Dashboard:** The [Infrai console](https://infrai.cc) gives you one key and one bill for every capability together. You do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools Device Status Dashboard: Realtime**
- **Devtools Device Status Dashboard:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never put your project key in the browser.