import { SignalingRoom } from './durable_objects/SignalingRoom';
import { AuthController } from './controllers/authController';

export interface Env {
  SIGNALING_ROOM: DurableObjectNamespace<SignalingRoom>;
  JWT_SECRET: string;
}

// We must export the Durable Object class from the main entry point 
// so Cloudflare knows it exists.
export { SignalingRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ROUTE: Auth
    if (request.method === "POST" && url.pathname === "/api/v1/auth/google") {
      return await AuthController.handleGoogleLogin(request, env);
    }

    // ROUTE: WebRTC Signaling (Fallback route)
    const roomName = url.pathname.slice(1) || "default";
    const id = env.SIGNALING_ROOM.idFromName(roomName);
    const roomStub = env.SIGNALING_ROOM.get(id);
    
    return roomStub.fetch(request);
  },
} satisfies ExportedHandler<Env>;