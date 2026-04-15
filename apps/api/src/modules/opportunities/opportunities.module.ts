import { Module, forwardRef } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [forwardRef(() => ProjectsModule)],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
