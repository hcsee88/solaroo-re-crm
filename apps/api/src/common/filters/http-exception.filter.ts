import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { ApiError } from "@solaroo/types";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    const code =
      exception instanceof HttpException
        ? exception.name
        : "INTERNAL_SERVER_ERROR";

    const body: ApiError = {
      success: false,
      error: {
        code,
        message,
      },
    };

    reply.status(status).send(body);
  }
}
