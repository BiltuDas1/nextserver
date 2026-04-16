import jwt from '@tsndr/cloudflare-worker-jwt';
import { Env } from '../index';
import { JwtService } from '../services/jwtService';

export class AuthController {
  static async handleGoogleLogin(request: Request, env: Env): Promise<Response> {
    try {
      const body: any = await request.json();
      const googleToken = body.id_token;

      if (!googleToken) {
        return new Response("Missing id_token", { status: 400 });
      }

      // Decode token
      const decoded = jwt.decode(googleToken);
      const payload = decoded.payload as { email: string; sub: string };
      
      const secret = env.JWT_SECRET || "fallback-secret";

      // Generate tokens using our service
      const tokens = await JwtService.generateTokens(payload.sub, payload.email, secret);

      return new Response(JSON.stringify({
        ...tokens,
        user_id: payload.sub
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("Login error:", error);
      return new Response("Authentication Failed", { status: 401 });
    }
  }
}