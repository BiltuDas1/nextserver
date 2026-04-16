import { DurableObject } from "cloudflare:workers";
import { Env } from "../index";

export class SignalingRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    this.ctx.getWebSockets().forEach((peer) => {
      if (peer !== ws) {
        peer.send(message);
      }
    });
  }

  async webSocketClose(ws: WebSocket) {
    console.log("A device disconnected.");
  }
}