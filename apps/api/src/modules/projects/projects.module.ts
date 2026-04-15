import { Module, forwardRef } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OpportunitiesModule } from '../opportunities/opportunities.module';

@Module({
  imports: [forwardRef(() => OpportunitiesModule)],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
