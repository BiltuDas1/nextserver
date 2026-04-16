import jwt from '@tsndr/cloudflare-worker-jwt';

export class JwtService {
  static async generateTokens(userId: string, email: string, secret: string) {
    const accessToken = await jwt.sign({
      userId, email, exp: Math.floor(Date.now() / 1000) + (1 * 60 * 60)
    }, secret);

    const refreshToken = await jwt.sign({
      userId, exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
    }, secret);

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}