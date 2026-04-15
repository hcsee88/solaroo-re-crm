import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { UserContext } from "@solaroo/types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard("local"))
  async login(
    @Body() _dto: LoginDto,
    @CurrentUser() user: any,
    @Res({ passthrough: true }) reply: FastifyReply
  ) {
    const result = this.authService.login(user);

    // Set httpOnly cookie for browser clients
    reply.setCookie("session", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return result;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie("session", { path: "/" });
    return { message: "Logged out" };
  }

  @Get("me")
  async me(@CurrentUser() user: UserContext) {
    return this.authService.getMe(user.id);
  }

  @Patch("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: UserContext,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }
}
