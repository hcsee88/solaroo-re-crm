import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { CreateSiteDto, UpdateSiteDto, SiteQueryDto } from './sites.dto';
import { Prisma, Prisma as PrismaTypes } from '@solaroo/db';

export type SiteListItem = {
  id: string;
  siteCode: string;
  name: string;
  gridCategory: string;
  region: string | null;
  country: string;
  isActive: boolean;
  createdAt: Date;
  account: {
    id: string;
    accountCode: string;
    name: string;
  };
  _count: {
    opportunities: number;
    projects: number;
    assets: number;
  };
};

export type SiteDetail = {
  id: string;
  siteCode: string;
  name: string;
  gridCategory: string;
  address: string | null;
  latitude: PrismaTypes.Decimal | null;
  longitude: PrismaTypes.Decimal | null;
  country: string;
  region: string | null;
  operatingSchedule: string | null;
  accessConstraints: string | null;
  safetyConstraints: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  accountId: string;
  account: {
    id: string;
    accountCode: string;
    name: string;
  };
  primaryContactId: string | null;
  primaryContact: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  _count: {
    opportunities: number;
    projects: number;
    assets: number;
  };
};

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  private async buildScopeFilter(
    user: UserContext,
    action: 'view' | 'edit',
  ): Promise<Prisma.SiteWhereInput> {
    const scope = await this.authz.getBestScope(user, 'site', action);
    if (!scope) {
      throw new ForbiddenException(`No permission to ${action} sites`);
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
    query: SiteQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<SiteListItem>> {
    const { search, accountId, gridCategory, isActive, page, pageSize, sortBy, sortDir } = query;
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const andFilters: Prisma.SiteWhereInput[] = [scopeFilter];

    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { siteCode: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.SiteWhereInput = {
      AND: andFilters,
      ...(accountId && { accountId }),
      ...(gridCategory && { gridCategory }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, items] = await Promise.all([
      this.prisma.site.count({ where }),
      this.prisma.site.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          siteCode: true,
          name: true,
          gridCategory: true,
          region: true,
          country: true,
          isActive: true,
          createdAt: true,
          account: {
            select: { id: true, accountCode: true, name: true },
          },
          _count: {
            select: { opportunities: true, projects: true, assets: true },
          },
        },
      }),
    ]);

    return {
      items: items as SiteListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<SiteDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const site = await this.prisma.site.findFirst({
      where: { id, ...scopeFilter },
      select: {
        id: true,
        siteCode: true,
        name: true,
        gridCategory: true,
        address: true,
        latitude: true,
        longitude: true,
        country: true,
        region: true,
        operatingSchedule: true,
        accessConstraints: true,
        safetyConstraints: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accountId: true,
        account: {
          select: { id: true, accountCode: true, name: true },
        },
        primaryContactId: true,
        primaryContact: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true },
        },
        _count: {
          select: { opportunities: true, projects: true, assets: true },
        },
      },
    });

    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site as SiteDetail;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateSiteDto, _user: UserContext): Promise<SiteDetail> {
    const siteCode = await this.generateSiteCode();

    const site = await this.prisma.site.create({
      data: {
        ...dto,
        siteCode,
      },
      select: {
        id: true,
        siteCode: true,
        name: true,
        gridCategory: true,
        address: true,
        latitude: true,
        longitude: true,
        country: true,
        region: true,
        operatingSchedule: true,
        accessConstraints: true,
        safetyConstraints: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accountId: true,
        account: {
          select: { id: true, accountCode: true, name: true },
        },
        primaryContactId: true,
        primaryContact: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true },
        },
        _count: {
          select: { opportunities: true, projects: true, assets: true },
        },
      },
    });

    return site as SiteDetail;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateSiteDto, _user: UserContext): Promise<SiteDetail> {
    const scopeFilter = await this.buildScopeFilter(_user, 'edit');
    const existing = await this.prisma.site.findFirst({
      where: { id, ...scopeFilter },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Site ${id} not found`);

    const site = await this.prisma.site.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        siteCode: true,
        name: true,
        gridCategory: true,
        address: true,
        latitude: true,
        longitude: true,
        country: true,
        region: true,
        operatingSchedule: true,
        accessConstraints: true,
        safetyConstraints: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accountId: true,
        account: {
          select: { id: true, accountCode: true, name: true },
        },
        primaryContactId: true,
        primaryContact: {
          select: { id: true, firstName: true, lastName: true, jobTitle: true, email: true, phone: true },
        },
        _count: {
          select: { opportunities: true, projects: true, assets: true },
        },
      },
    });

    return site as SiteDetail;
  }

  // ─── Code generator ────────────────────────────────────────────────────────

  private async generateSiteCode(): Promise<string> {
    const latest = await this.prisma.site.findFirst({
      where: { siteCode: { startsWith: 'SITE-' } },
      orderBy: { siteCode: 'desc' },
      select: { siteCode: true },
    });

    let nextNum = 1;
    if (latest) {
      const match = latest.siteCode.match(/SITE-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const code = `SITE-${String(nextNum).padStart(4, '0')}`;

    const existing = await this.prisma.site.findUnique({ where: { siteCode: code } });
    if (existing) throw new BadRequestException('Site code collision — please retry');

    return code;
  }
}
