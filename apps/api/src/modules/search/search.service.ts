import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { AuthzService } from '../../common/authz/authz.service';
import { UserContext } from '@solaroo/types';
import { Prisma } from '@solaroo/db';

// ─── Result types ─────────────────────────────────────────────────────────────

export type SearchResultItem = {
  id: string;
  type: 'account' | 'contact' | 'site' | 'opportunity' | 'proposal' | 'project';
  code: string | null;
  title: string;
  subtitle: string | null;
  url: string;
};

export type GlobalSearchResult = {
  query: string;
  total: number;
  groups: {
    type: SearchResultItem['type'];
    label: string;
    items: SearchResultItem[];
  }[];
};

const MAX_PER_GROUP = 5;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthzService,
  ) {}

  private async buildAccountScopeFilter(user: UserContext): Promise<Prisma.AccountWhereInput | null> {
    const scope = await this.authz.getBestScope(user, 'account', 'view');
    if (!scope) return null;

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

  private async buildContactScopeFilter(user: UserContext): Promise<Prisma.ContactWhereInput | null> {
    const scope = await this.authz.getBestScope(user, 'contact', 'view');
    if (!scope) return null;

    const accountAssignedScope: Prisma.ContactWhereInput = {
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
    const siteAssignedScope: Prisma.ContactWhereInput = {
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
            {
              accounts: {
                some: {
                  account: {
                    opportunities: {
                      some: { owner: { role: { name: user.roleName } } },
                    },
                  },
                },
              },
            },
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
            {
              accounts: {
                some: {
                  account: {
                    opportunities: {
                      some: { ownerUserId: user.id },
                    },
                  },
                },
              },
            },
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
          OR: [accountAssignedScope, siteAssignedScope],
        };
    }
  }

  private async buildSiteScopeFilter(user: UserContext): Promise<Prisma.SiteWhereInput | null> {
    const scope = await this.authz.getBestScope(user, 'site', 'view');
    if (!scope) return null;

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

  async search(q: string, user: UserContext): Promise<GlobalSearchResult> {
    const term = q.trim();
    if (term.length < 2) {
      return { query: term, total: 0, groups: [] };
    }

    const [accounts, contacts, sites, opportunities, proposals, projects] =
      await Promise.allSettled([
        this.searchAccounts(term, user),
        this.searchContacts(term, user),
        this.searchSites(term, user),
        this.searchOpportunities(term, user),
        this.searchProposals(term, user),
        this.searchProjects(term, user),
      ]);

    const resolveGroup = (
      result: PromiseSettledResult<SearchResultItem[]>,
    ): SearchResultItem[] =>
      result.status === 'fulfilled' ? result.value : [];

    const groupDefs: { type: SearchResultItem['type']; label: string; items: SearchResultItem[] }[] = [
      { type: 'opportunity', label: 'Opportunities', items: resolveGroup(opportunities) },
      { type: 'project',     label: 'Projects',      items: resolveGroup(projects) },
      { type: 'proposal',    label: 'Proposals',     items: resolveGroup(proposals) },
      { type: 'account',     label: 'Accounts',      items: resolveGroup(accounts) },
      { type: 'contact',     label: 'Contacts',      items: resolveGroup(contacts) },
      { type: 'site',        label: 'Sites',         items: resolveGroup(sites) },
    ];

    const groups = groupDefs.filter((g) => g.items.length > 0);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);

    return { query: term, total, groups };
  }

  // ─── Accounts ───────────────────────────────────────────────────────────────

  private async searchAccounts(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scopeFilter = await this.buildAccountScopeFilter(user);
    if (!scopeFilter) return [];

    const rows = await this.prisma.account.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { accountCode: { contains: q, mode: 'insensitive' as const } },
              { industry: { contains: q, mode: 'insensitive' as const } },
              { region: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ],
      },
      select: { id: true, accountCode: true, name: true, type: true, country: true },
      take: MAX_PER_GROUP,
      orderBy: { name: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'account' as const,
      code: r.accountCode,
      title: r.name,
      subtitle: [r.type, r.country].filter(Boolean).join(' · '),
      url: `/accounts/${r.id}`,
    }));
  }

  // ─── Contacts ───────────────────────────────────────────────────────────────

  private async searchContacts(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scopeFilter = await this.buildContactScopeFilter(user);
    if (!scopeFilter) return [];

    const rows = await this.prisma.contact.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { firstName: { contains: q, mode: 'insensitive' as const } },
              { lastName: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
              { jobTitle: { contains: q, mode: 'insensitive' as const } },
              { phone: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        accounts: {
          take: 1,
          select: {
            account: { select: { name: true } },
          },
        },
      },
      take: MAX_PER_GROUP,
      orderBy: { lastName: 'asc' },
    });

    return rows.map((r) => {
      const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ');
      const accountName = r.accounts[0]?.account?.name ?? null;
      return {
        id: r.id,
        type: 'contact' as const,
        code: null,
        title: fullName || r.email || 'Unnamed',
        subtitle: [r.jobTitle, accountName].filter(Boolean).join(' · '),
        url: `/contacts/${r.id}`,
      };
    });
  }

  // ─── Sites ───────────────────────────────────────────────────────────────────

  private async searchSites(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scopeFilter = await this.buildSiteScopeFilter(user);
    if (!scopeFilter) return [];

    const rows = await this.prisma.site.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { siteCode: { contains: q, mode: 'insensitive' as const } },
              { address: { contains: q, mode: 'insensitive' as const } },
              { region: { contains: q, mode: 'insensitive' as const } },
            ],
          },
        ],
      },
      select: {
        id: true,
        siteCode: true,
        name: true,
        region: true,
        account: { select: { name: true } },
      },
      take: MAX_PER_GROUP,
      orderBy: { name: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'site' as const,
      code: r.siteCode,
      title: r.name,
      subtitle: [r.account?.name, r.region].filter(Boolean).join(' · '),
      url: `/sites/${r.id}`,
    }));
  }

  // ─── Opportunities ───────────────────────────────────────────────────────────

  private async searchOpportunities(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scope = await this.authz.getBestScope(user, 'opportunity', 'view');
    if (!scope) return [];

    const scopeFilter =
      scope === 'own'
        ? { ownerUserId: user.id }
        : scope === 'assigned'
        ? { OR: [{ ownerUserId: user.id }, { members: { some: { userId: user.id } } }] }
        : scope === 'team'
        ? { owner: { role: { name: user.roleName } } }
        : {};

    const rows = await this.prisma.opportunity.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { opportunityCode: { contains: q, mode: 'insensitive' as const } },
              { summary: { contains: q, mode: 'insensitive' as const } },
              { account: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        opportunityCode: true,
        title: true,
        stage: true,
        account: { select: { name: true } },
      },
      take: MAX_PER_GROUP,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'opportunity' as const,
      code: r.opportunityCode,
      title: r.title,
      subtitle: [r.account?.name, r.stage.replace(/_/g, ' ')].filter(Boolean).join(' · '),
      url: `/opportunities/${r.id}`,
    }));
  }

  // ─── Proposals ───────────────────────────────────────────────────────────────

  private async searchProposals(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scope = await this.authz.getBestScope(user, 'proposal', 'view');
    if (!scope) return [];

    const scopeFilter =
      scope === 'own'
        ? { createdByUserId: user.id }
        : scope === 'assigned'
        ? {
            opportunity: {
              OR: [
                { ownerUserId: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
          }
        : scope === 'team'
        ? { opportunity: { owner: { role: { name: user.roleName } } } }
        : {};

    const rows = await this.prisma.proposal.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { proposalCode: { contains: q, mode: 'insensitive' as const } },
              { opportunity: { account: { name: { contains: q, mode: 'insensitive' as const } } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        proposalCode: true,
        title: true,
        opportunity: {
          select: {
            account: { select: { name: true } },
          },
        },
        versions: {
          orderBy: { versionNo: 'desc' },
          take: 1,
          select: { versionNo: true, approvalStatus: true },
        },
      },
      take: MAX_PER_GROUP,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((r) => {
      const latest = r.versions[0];
      const accountName = r.opportunity?.account?.name ?? null;
      return {
        id: r.id,
        type: 'proposal' as const,
        code: r.proposalCode,
        title: r.title,
        subtitle: [
          accountName,
          latest ? `v${latest.versionNo} · ${latest.approvalStatus}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        url: `/proposals/${r.id}`,
      };
    });
  }

  // ─── Projects ────────────────────────────────────────────────────────────────

  private async searchProjects(q: string, user: UserContext): Promise<SearchResultItem[]> {
    const scope = await this.authz.getBestScope(user, 'project', 'view');
    if (!scope) return [];

    const scopeFilter =
      scope === 'assigned'
        ? {
            OR: [
              { projectManagerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }
        : {};

    const rows = await this.prisma.project.findMany({
      where: {
        AND: [
          scopeFilter,
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { projectCode: { contains: q, mode: 'insensitive' as const } },
              { account: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        status: true,
        account: { select: { name: true } },
      },
      take: MAX_PER_GROUP,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      type: 'project' as const,
      code: r.projectCode,
      title: r.name,
      subtitle: [r.account?.name, r.status.replace(/_/g, ' ')].filter(Boolean).join(' · '),
      url: `/projects/${r.id}`,
    }));
  }
}
