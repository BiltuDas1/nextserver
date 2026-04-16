import jwt from '@tsndr/cloudflare-worker-jwt';
import { DurableObject } from "cloudflare:workers";

// Define the environment variables and bindings your Worker needs
export interface Env {
  // The Durable Object binding for WebRTC rooms
  SIGNALING_ROOM: DurableObjectNamespace<SignalingRoom>;
  // The secret key used to sign your app's custom JWTs
  JWT_SECRET: string;
}

// =====================================================================
// 1. WEBRTC SIGNALING ROOM (Your existing code)
// =====================================================================
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

// =====================================================================
// 2. MAIN ROUTER (Handles both HTTP API and WebSockets)
// =====================================================================
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- A. GOOGLE LOGIN ROUTE ---
    // If the Android app sends a POST request to this exact URL, handle the login
    if (request.method === "POST" && url.pathname === "/api/v1/auth/google") {
      try {
        // 1. Get the Google token sent from the Android app
        const body: any = await request.json();
        const googleToken = body.id_token;

        if (!googleToken) {
          return new Response("Missing id_token", { status: 400 });
        }

        // 2. Decode the Google token to find out who the user is
        const decoded = jwt.decode(googleToken);
        const payload = decoded.payload as { email: string; sub: string };
        const userEmail = payload.email;
        const googleUserId = payload.sub;

        // 3. Define your secret key (Uses environment variable, or a fallback for testing)
        const secret = env.JWT_SECRET || "my-super-secret-key-change-this";

        // 4. Create your own custom Access Token (Expires in 1 hour)
        const accessToken = await jwt.sign({
          userId: googleUserId,
          email: userEmail,
          exp: Math.floor(Date.now() / 1000) + (1 * 60 * 60) // 1 hour
        }, secret);

        // 5. Create a Refresh Token (Expires in 30 days)
        const refreshToken = await jwt.sign({
          userId: googleUserId,
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        }, secret);

        // 6. Send the response back exactly how ApiModels.kt expects it
        return new Response(JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          user_id: googleUserId
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Login error:", error);
        return new Response("Authentication Failed", { status: 401 });
      }
    }

    // --- B. WEBRTC SIGNALING ROUTE ---
    // If the URL is anything else (like /my-room), pass it to the Durable Object
    const roomName = url.pathname.slice(1) || "default";
    const id = env.SIGNALING_ROOM.idFromName(roomName);
    const roomStub = env.SIGNALING_ROOM.get(id);

    return roomStub.fetch(request);
  },
} satisfies ExportedHandler<Env>;