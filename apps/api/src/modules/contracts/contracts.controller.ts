import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { ContractsService } from './contracts.service';

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@CurrentUser() user: UserContext): Promise<unknown> {
    return this.contractsService.findAll(user);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<unknown> {
    return this.contractsService.findById(id, user);
  }
}
