import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { resolve } from "node:path";
import { DatabaseModule } from "./common/database/database.module";
import { AuthzModule } from "./common/authz/authz.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { PermissionGuard } from "./common/authz/permission.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { SitesModule } from "./modules/sites/sites.module";
import { OpportunitiesModule } from "./modules/opportunities/opportunities.module";
import { ProposalsModule } from "./modules/proposals/proposals.module";
import { ContractsModule } from "./modules/contracts/contracts.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { GatesModule } from "./modules/gates/gates.module";
import { ProcurementModule } from "./modules/procurement/procurement.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { AiModule } from "./modules/ai/ai.module";
import { AdminModule } from "./modules/admin/admin.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { SearchModule } from "./modules/search/search.module";

@Module({
  imports: [
    // Load env files deterministically whether the process starts from the repo
    // root, apps/api, or a compiled dist entrypoint.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), ".env.local"),
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "apps/api/.env.local"),
        resolve(process.cwd(), "apps/api/.env"),
        resolve(__dirname, "../../.env.local"),
        resolve(__dirname, "../../.env"),
        resolve(__dirname, "../../../../.env.local"),
        resolve(__dirname, "../../../../.env"),
      ],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 200, // 200 req/min per IP
      },
    ]),

    // Shared Prisma client
    DatabaseModule,

    // Authorization — global, provides AuthzService to all modules
    AuthzModule,

    // Domain modules
    AuthModule,
    AccountsModule,
    ContactsModule,
    SitesModule,
    OpportunitiesModule,
    ProposalsModule,
    ContractsModule,
    ProjectsModule,
    GatesModule,
    ProcurementModule,
    DocumentsModule,
    AssetsModule,
    MaintenanceModule,
    ReportingModule,
    AiModule,
    AdminModule,
    NotificationsModule,
    SearchModule,
  ],
  providers: [
    // JWT auth — runs first; rejects unauthenticated requests (except @Public routes)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Permission check — runs after auth; checks @RequirePermission metadata
    // Controlled by AUTHZ_ENFORCE env var (false = audit-only, true = enforcing)
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
