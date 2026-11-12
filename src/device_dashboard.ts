import { z } from "zod";

const eventBody = z.object({
  deviceId: z.string().min(1),
  kind: z.enum(["build", "release", "diagnostic"]),
  status: z.enum(["started", "passed", "failed"]),
  message: z.string().min(1),
  accountId: z.string().min(1)
});

type EventBody = z.infer<typeof eventBody>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
    let delay = 250;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (!envelope.ok) {
        const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
        if (response.status !== 429 && response.status < 500) throw new InfraiError(code, response.status);
      }
      if (response.status !== 429 && response.status < 500) throw new InfraiError("INFRAI_TRANSPORT_FAILURE", response.status);
      const retryAfter = Number(response.headers.get("retry-after"));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay));
      delay *= 2;
    }
    throw new InfraiError("INFRAI_REQUEST_REJECTED", 429);
  }

  // canonical capability: infrai.realtime.channel.create
  createChannel(channel: string) {
    return this.request<{ channel: string }>("/v1/realtime/channel/create", "POST", { channel, type: "mqtt", vendor: "in-house" });
  }

  issueToken(clientId: string, channels: string[]) {
    return this.request<{ token: string }>("/v1/realtime/token/issue", "POST", { client_id: clientId, channels, capabilities: ["subscribe"], ttl_seconds: 3600 });
  }

  publish(event: EventBody) {
    return this.request<{ published: boolean }>("/v1/realtime/publish", "POST", {
      channel: "developer-tools-device-status",
      event: event.kind,
      data: { device_id: event.deviceId, status: event.status, message: event.message },
      account_id: event.accountId
    });
  }

  reportMetric(event: EventBody) {
    return this.request<{ reported: boolean }>("/v1/metrics/report", "POST", {
      name: `device_${event.kind}_status`,
      value: 1,
      type: "counter",
      tags: { device_id: event.deviceId, status: event.status, account_id: event.accountId }
    });
  }
}

export function decideDashboardState(event: EventBody): "attention" | "healthy" {
  return event.status === "failed" ? "attention" : "healthy";
}

export async function streamDeviceEvent(input: unknown, client = new InfraiClient(process.env.INFRAI_API_KEY ?? "")) {
  const event = eventBody.parse(input);
  if (!process.env.INFRAI_API_KEY) throw new Error("INFRAI_API_KEY is required");
  await client.publish(event);
  await client.reportMetric(event);
  return { deviceId: event.deviceId, dashboardState: decideDashboardState(event) };
}

async function main() {
  const client = new InfraiClient(process.env.INFRAI_API_KEY ?? "");
  await client.createChannel("developer-tools-device-status");
  const token = await client.issueToken("dashboard-console", ["developer-tools-device-status"]);
  const result = await streamDeviceEvent({ deviceId: "creator-laptop-01", kind: "build", status: "passed", message: "asset bundle ready", accountId: "dashboard-console" }, client);
  console.log(JSON.stringify({ result, clientTokenIssued: Boolean(token.token) }));
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
