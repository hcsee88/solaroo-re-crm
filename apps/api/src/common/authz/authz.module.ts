import { Global, Module } from '@nestjs/common';
import { AuthzService } from './authz.service';

/**
 * Global module — AuthzService is available everywhere without
 * importing AuthzModule into individual feature modules.
 */
@Global()
@Module({
  providers: [AuthzService],
  exports: [AuthzService],
})
export class AuthzModule {}
