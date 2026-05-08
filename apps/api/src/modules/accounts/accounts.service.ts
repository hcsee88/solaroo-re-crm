import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  private async buildScopeFilter(
    user: UserContext,
    action: 'view' | 'edit',
  ): Promise<Prisma.AccountWhereInput> {
    const scope = await this.authz.getBestScope(user, 'account', action);
    if (!scope) {
      throw new ForbiddenException(`No permission to ${action} accounts`);
    }

    switch (scope) {
      case 'all':
        return {};
      case 'team':
        return {
          opportunities: {
            some: { owner: { role: { name: user.roleName } } },
          },
        };
      case 'own':
        return {
          opportunities: {
            some: { ownerUserId: user.id },
          },
        };
      case 'assigned':
        return {
          OR: [
            {
              opportunities: {
                some: {
                  OR: [
                    { ownerUserId: user.id },
                    { members: { some: { userId: user.id } } },
                  ],
                },
              },
            },
            {
              projects: {
                some: {
                  OR: [
                    { projectManagerId: user.id },
                    { members: { some: { userId: user.id } } },
                  ],
                },
              },
            },
          ],
        };
    }
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(
    query: AccountQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<AccountListItem>> {
    const { search, type, isActive, page, pageSize, sortBy, sortDir } = query;
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const andFilters: Prisma.AccountWhereInput[] = [scopeFilter];

    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { accountCode: { contains: search, mode: 'insensitive' } },
          { industry: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.AccountWhereInput = {
      AND: andFilters,
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

  async findById(id: string, user: UserContext): Promise<AccountDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const account = await this.prisma.account.findFirst({
      where: { id, ...scopeFilter },
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
    user: UserContext,
  ): Promise<AccountDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'edit');
    const existing = await this.prisma.account.findFirst({
      where: { id, ...scopeFilter },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Account ${id} not found`);
    }

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

  // ─── Delete ────────────────────────────────────────────────────────────────
  // Hard-delete an account. Refuses if any sites/opportunities/projects/contacts
  // reference it — caller must clear them first. Protects audit history.

  async delete(id: string, user: UserContext): Promise<{ ok: true }> {
    const scopeFilter = await this.buildScopeFilter(user, 'edit');
    const existing = await this.prisma.account.findFirst({
      where: { id, ...scopeFilter },
      select: {
        id: true,
        accountCode: true,
        _count: {
          select: { sites: true, contacts: true, opportunities: true, projects: true },
        },
      },
    });
    if (!existing) throw new NotFoundException(`Account ${id} not found`);

    const blockers: string[] = [];
    if (existing._count.opportunities > 0) blockers.push(`${existing._count.opportunities} opportunit${existing._count.opportunities === 1 ? 'y' : 'ies'}`);
    if (existing._count.projects      > 0) blockers.push(`${existing._count.projects} project${existing._count.projects === 1 ? '' : 's'}`);
    if (existing._count.sites         > 0) blockers.push(`${existing._count.sites} site${existing._count.sites === 1 ? '' : 's'}`);
    if (existing._count.contacts      > 0) blockers.push(`${existing._count.contacts} contact link${existing._count.contacts === 1 ? '' : 's'}`);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete account ${existing.accountCode} — still referenced by ${blockers.join(', ')}. Remove them first.`,
      );
    }

    await this.prisma.account.delete({ where: { id } });
    return { ok: true };
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
