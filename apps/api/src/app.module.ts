import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
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

@Module({
  imports: [
    // Config — loads .env, validates required vars
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
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
