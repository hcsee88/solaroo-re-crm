import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<unknown> {
    return this.aiService.findAll(user);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<unknown> {
    return this.aiService.findById(id, user);
  }
}
