import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import type { UserContext } from "@solaroo/types";
import type { FastifyRequest } from "fastify";

function cookieExtractor(req: FastifyRequest): string | null {
  return (req.cookies as Record<string, string>)["session"] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow("JWT_SECRET"),
    });
  }

  validate(payload: UserContext): UserContext {
    return payload;
  }
}
