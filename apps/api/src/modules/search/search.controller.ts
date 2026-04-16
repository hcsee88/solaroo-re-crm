import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserContext } from '@solaroo/types';
import { SearchService, GlobalSearchResult } from './search.service';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query(new ZodValidationPipe(SearchQuerySchema)) query: { q: string },
    @CurrentUser() user: UserContext,
  ): Promise<GlobalSearchResult> {
    return this.searchService.search(query.q, user);
  }
}
