import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext } from '@solaroo/types';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(_user: UserContext): Promise<unknown> {
    return [];
  }

  async findById(_id: string, _user: UserContext): Promise<unknown> {
    return null;
  }
}
