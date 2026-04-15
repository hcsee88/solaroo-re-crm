import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { UserContext } from "@solaroo/types";

/** Injects the authenticated user from the JWT payload. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserContext;
  }
);
