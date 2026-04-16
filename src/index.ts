import { DurableObject } from "cloudflare:workers";

/**
 * The SignalingRoom handles all WebSocket connections for a specific room.
 * It uses Hibernation to stay efficient and free on the Workers plan.
 */
export class SignalingRoom extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    // Check if the client is trying to connect via WebSocket
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Create the pair: one for the device, one for this Durable Object
    const [client, server] = Object.values(new WebSocketPair());

    // Accept the connection and enable hibernation
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // This function wakes up whenever a phone sends a signaling message
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Broadcast the message to all other phones in this room
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Grab a Room ID from the URL path (e.g., /my-room)
    const roomName = url.pathname.slice(1) || "default";
    const id = env.SIGNALING_ROOM.idFromName(roomName);
    const roomStub = env.SIGNALING_ROOM.get(id);

    // Forward the request to our Durable Object
    return roomStub.fetch(request);
  },
} satisfies ExportedHandler<Env>;