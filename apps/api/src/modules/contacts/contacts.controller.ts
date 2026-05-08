import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/authz/require-permission.decorator';
import { UserContext, PaginatedResult } from '@solaroo/types';
import { ContactsService, ContactListItem, ContactDetail } from './contacts.service';
import { CreateContactSchema, UpdateContactSchema, ContactQuerySchema, UpdateAccountLinkSchema } from './contacts.dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @RequirePermission('contact', 'view')
  findAll(
    @Query(new ZodValidationPipe(ContactQuerySchema)) query: ReturnType<typeof ContactQuerySchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<PaginatedResult<ContactListItem>> {
    return this.contactsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('contact', 'view')
  findById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<ContactDetail> {
    return this.contactsService.findById(id, user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('contact', 'create')
  create(
    @Body(new ZodValidationPipe(CreateContactSchema)) dto: ReturnType<typeof CreateContactSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ContactDetail> {
    return this.contactsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermission('contact', 'edit')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateContactSchema)) dto: ReturnType<typeof UpdateContactSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ContactDetail> {
    return this.contactsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contact', 'delete')
  delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ): Promise<{ ok: true }> {
    return this.contactsService.delete(id, user);
  }

  @Patch(':id/accounts/:accountId')
  @RequirePermission('contact', 'edit')
  @HttpCode(HttpStatus.OK)
  updateAccountLink(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Body(new ZodValidationPipe(UpdateAccountLinkSchema)) dto: ReturnType<typeof UpdateAccountLinkSchema.parse>,
    @CurrentUser() user: UserContext,
  ): Promise<ContactDetail> {
    return this.contactsService.updateAccountLink(id, accountId, dto, user);
  }

  @Delete(':id/accounts/:accountId')
  @RequirePermission('contact', 'edit')
  @HttpCode(HttpStatus.OK)
  removeAccountLink(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @CurrentUser() user: UserContext,
  ): Promise<ContactDetail> {
    return this.contactsService.removeAccountLink(id, accountId, user);
  }
}
