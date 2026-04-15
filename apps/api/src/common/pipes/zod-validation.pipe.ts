import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const formatted = (result.error as ZodError).errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formatted,
      });
    }
    return result.data;
  }
}
