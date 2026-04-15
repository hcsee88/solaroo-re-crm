import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { GatesService } from './gates.service';

@Controller('gates')
@UseGuards(JwtAuthGuard)
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<unknown> {
    return this.gatesService.findAll(user);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<unknown> {
    return this.gatesService.findById(id, user);
  }
}
