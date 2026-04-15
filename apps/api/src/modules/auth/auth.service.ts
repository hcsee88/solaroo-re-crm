import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../common/database/prisma.service";
import type { UserContext } from "@solaroo/types";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  login(user: { id: string; email: string; name: string; roleId: string; role: { name: string } }) {
    const payload: UserContext = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: payload,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) throw new NotFoundException("User not found");
    if (!user.passwordHash) throw new BadRequestException("Cannot change password for this account");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException("Current password is incorrect");

    if (newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { ok: true };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
