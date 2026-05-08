import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { CreateContactDto, UpdateContactDto, UpdateAccountLinkDto, ContactQueryDto } from './contacts.dto';
import { Prisma } from '@solaroo/db';

export type ContactListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  isActive: boolean;
  createdAt: Date;
  accounts: {
    isPrimary: boolean;
    relationship: string | null;
    account: {
      id: string;
      accountCode: string;
      name: string;
    };
  }[];
};

export type ContactDetail = ContactListItem & {
  notes: string | null;
  updatedAt: Date;
};

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  private async buildScopeFilter(
    user: UserContext,
    action: 'view' | 'edit',
  ): Promise<Prisma.ContactWhereInput> {
    const scope = await this.authz.getBestScope(user, 'contact', action);
    if (!scope) {
      throw new ForbiddenException(`No permission to ${action} contacts`);
    }

    const teamAccountScope: Prisma.ContactWhereInput = {
      accounts: {
        some: {
          account: {
            opportunities: {
              some: { owner: { role: { name: user.roleName } } },
            },
          },
        },
      },
    };
    const ownAccountScope: Prisma.ContactWhereInput = {
      accounts: {
        some: {
          account: {
            opportunities: {
              some: { ownerUserId: user.id },
            },
          },
        },
      },
    };
    const assignedAccountScope: Prisma.ContactWhereInput = {
      accounts: {
        some: {
          account: {
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
          },
        },
      },
    };
    const assignedSiteScope: Prisma.ContactWhereInput = {
      sitesPrimary: {
        some: {
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
        },
      },
    };

    switch (scope) {
      case 'all':
        return {};
      case 'team':
        return {
          OR: [
            teamAccountScope,
            {
              sitesPrimary: {
                some: {
                  opportunities: {
                    some: { owner: { role: { name: user.roleName } } },
                  },
                },
              },
            },
          ],
        };
      case 'own':
        return {
          OR: [
            ownAccountScope,
            {
              sitesPrimary: {
                some: {
                  opportunities: {
                    some: { ownerUserId: user.id },
                  },
                },
              },
            },
          ],
        };
      case 'assigned':
        return {
          OR: [assignedAccountScope, assignedSiteScope],
        };
    }
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async findAll(
    query: ContactQueryDto,
    user: UserContext,
  ): Promise<PaginatedResult<ContactListItem>> {
    const { search, accountId, isActive, page, pageSize, sortBy, sortDir } = query;
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const andFilters: Prisma.ContactWhereInput[] = [scopeFilter];

    if (search) {
      andFilters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.ContactWhereInput = {
      AND: andFilters,
      ...(accountId && {
        accounts: { some: { accountId } },
      }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, items] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          department: true,
          isActive: true,
          createdAt: true,
          accounts: {
            select: {
              isPrimary: true,
              relationship: true,
              account: {
                select: { id: true, accountCode: true, name: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: items as ContactListItem[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  async findById(id: string, user: UserContext): Promise<ContactDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'view');
    const contact = await this.prisma.contact.findFirst({
      where: { id, ...scopeFilter },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        department: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            isPrimary: true,
            relationship: true,
            account: {
              select: { id: true, accountCode: true, name: true },
            },
          },
        },
      },
    });

    if (!contact) throw new NotFoundException(`Contact ${id} not found`);
    return contact as ContactDetail;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateContactDto, _user: UserContext): Promise<ContactDetail> {
    const { accountId, isPrimary, relationship, ...contactData } = dto;

    const contact = await this.prisma.contact.create({
      data: {
        ...contactData,
        email: contactData.email || null,
        ...(accountId && {
          accounts: {
            create: {
              accountId,
              isPrimary: isPrimary ?? false,
              relationship: relationship ?? null,
            },
          },
        }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        department: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            isPrimary: true,
            relationship: true,
            account: {
              select: { id: true, accountCode: true, name: true },
            },
          },
        },
      },
    });

    return contact as ContactDetail;
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateContactDto, _user: UserContext): Promise<ContactDetail> {
    const scopeFilter = await this.buildScopeFilter(_user, 'edit');
    const existing = await this.prisma.contact.findFirst({
      where: { id, ...scopeFilter },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Contact ${id} not found`);

    const { accountId, isPrimary, relationship, ...contactData } = dto;

    // If an accountId is provided, upsert the account link
    if (accountId) {
      await this.prisma.accountContact.upsert({
        where: { accountId_contactId: { accountId, contactId: id } },
        update: { isPrimary: isPrimary ?? false, relationship: relationship ?? null },
        create: { accountId, contactId: id, isPrimary: isPrimary ?? false, relationship: relationship ?? null },
      });
    }

    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        ...contactData,
        email: contactData.email === '' ? null : contactData.email,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        department: true,
        notes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            isPrimary: true,
            relationship: true,
            account: {
              select: { id: true, accountCode: true, name: true },
            },
          },
        },
      },
    });

    return contact as ContactDetail;
  }

  // ─── Delete ────────────────────────────────────────────────────────────────
  // Hard-delete a contact AND all its account-link rows (M2M cascade is manual).

  async delete(id: string, user: UserContext): Promise<{ ok: true }> {
    const scopeFilter = await this.buildScopeFilter(user, 'edit');
    const existing = await this.prisma.contact.findFirst({
      where: { id, ...scopeFilter },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Contact ${id} not found`);

    await this.prisma.$transaction([
      this.prisma.accountContact.deleteMany({ where: { contactId: id } }),
      this.prisma.contact.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  // ─── Update account link ───────────────────────────────────────────────────

  async updateAccountLink(
    contactId: string,
    accountId: string,
    dto: UpdateAccountLinkDto,
    user: UserContext,
  ): Promise<ContactDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'edit');
    const allowed = await this.prisma.contact.findFirst({
      where: { id: contactId, ...scopeFilter },
      select: { id: true },
    });
    if (!allowed) throw new NotFoundException(`Contact ${contactId} not found`);

    const existing = await this.prisma.accountContact.findUnique({
      where: { accountId_contactId: { accountId, contactId } },
    });
    if (!existing) throw new NotFoundException(`Account link not found`);

    await this.prisma.accountContact.update({
      where: { accountId_contactId: { accountId, contactId } },
      data: {
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        ...(dto.relationship !== undefined && { relationship: dto.relationship }),
      },
    });

    return this.findById(contactId, user);
  }

  // ─── Remove account link ───────────────────────────────────────────────────

  async removeAccountLink(
    contactId: string,
    accountId: string,
    user: UserContext,
  ): Promise<ContactDetail> {
    const scopeFilter = await this.buildScopeFilter(user, 'edit');
    const allowed = await this.prisma.contact.findFirst({
      where: { id: contactId, ...scopeFilter },
      select: { id: true },
    });
    if (!allowed) throw new NotFoundException(`Contact ${contactId} not found`);

    const existing = await this.prisma.accountContact.findUnique({
      where: { accountId_contactId: { accountId, contactId } },
    });
    if (!existing) throw new NotFoundException(`Account link not found`);

    await this.prisma.accountContact.delete({
      where: { accountId_contactId: { accountId, contactId } },
    });

    return this.findById(contactId, user);
  }

  // ─── Link to account (legacy) ─────────────────────────────────────────────

  async linkToAccount(
    contactId: string,
    accountId: string,
    isPrimary: boolean,
    relationship: string | null,
    _user: UserContext,
  ): Promise<void> {
    await this.prisma.accountContact.upsert({
      where: { accountId_contactId: { accountId, contactId } },
      update: { isPrimary, relationship },
      create: { accountId, contactId, isPrimary, relationship },
    });
  }
}
