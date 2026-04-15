import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import {
  CreateAccountDto,
  UpdateAccountDto,
  AccountQueryDto,
} from './accounts.dto';
import { Prisma } from '@solaroo/db';

// ─── Account list item (lightweight) ─────────────────────────────────────────

export type AccountListItem = {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  industry: string | null;
  region: string | null;
  country: string;
  isActive: boolean;
  createdAt: Date;
  _count: {
    contacts: number;
    sites: number;
    opportunities: number;
  };
};

// ─── Account detail ───────────────────────────────────────────────────────────

export type AccountDetail = {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  industry: string | null;
  registrationNo: string | null;
  country: string;
  region: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    contacts: number;
    sites: number;
    opportunities: number;
    projects: number;
  };
};

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(
    query: AccountQueryDto,
    _user: UserContext,
  ): Promise<PaginatedResult<AccountListItem>> {
    const { search, type, isActive, page, pageSize, sortBy, sortDir } = query;

    const where: Prisma.AccountWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { accountCode: { contains: search, mode: 'insensitive' } },
          { industry: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, items] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          accountCode: true,
          name: true,
          type: true,
          industry: true,
          region: true,
          country: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              contacts: true,
              sites: true,
              opportunities: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items as AccountListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, _user: UserContext): Promise<AccountDetail> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: {
        id: true,
        accountCode: true,
        name: true,
        type: true,
        industry: true,
        registrationNo: true,
        country: true,
        region: true,
        website: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            contacts: true,
            sites: true,
            opportunities: true,
            projects: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }

    return account as AccountDetail;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(
    dto: CreateAccountDto,
    _user: UserContext,
  ): Promise<AccountDetail> {
    const accountCode = await this.generateAccountCode();

    const account = await this.prisma.account.create({
      data: {
        ...dto,
        accountCode,
        website: dto.website || null,
      },
      select: {
        id: true,
        accountCode: true,
        name: true,
        type: true,
        industry: true,
        registrationNo: true,
        country: true,
        region: true,
        website: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            contacts: true,
            sites: true,
            opportunities: true,
            projects: true,
          },
        },
      },
    });

    return account as AccountDetail;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateAccountDto,
    _user: UserContext,
  ): Promise<AccountDetail> {
    await this.findById(id, _user); // ensure exists

    const account = await this.prisma.account.update({
      where: { id },
      data: {
        ...dto,
        website: dto.website === '' ? null : dto.website,
      },
      select: {
        id: true,
        accountCode: true,
        name: true,
        type: true,
        industry: true,
        registrationNo: true,
        country: true,
        region: true,
        website: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            contacts: true,
            sites: true,
            opportunities: true,
            projects: true,
          },
        },
      },
    });

    return account as AccountDetail;
  }

  // ─── Code generator ────────────────────────────────────────────────────────

  private async generateAccountCode(): Promise<string> {
    const latest = await this.prisma.account.findFirst({
      where: { accountCode: { startsWith: 'ACC-' } },
      orderBy: { accountCode: 'desc' },
      select: { accountCode: true },
    });

    let nextNum = 1;
    if (latest) {
      const match = latest.accountCode.match(/ACC-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const code = `ACC-${String(nextNum).padStart(4, '0')}`;

    // Guard against race conditions
    const existing = await this.prisma.account.findUnique({
      where: { accountCode: code },
    });
    if (existing) {
      throw new BadRequestException(
        'Account code collision — please retry',
      );
    }

    return code;
  }
}
