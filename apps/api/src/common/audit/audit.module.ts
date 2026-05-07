import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Global()
@Module({
  providers: [
    AuditService,
    // Global interceptor — auto-records POST/PATCH on top-level resources.
    // Registered here (not in main.ts) so DI can inject AuditService.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
