import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

// ─── Security startup checks ──────────────────────────────────────────────────

function runSecurityChecks() {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings: string[] = [];
  const errors: string[] = [];

  // COOKIE_SECRET: reject insecure default in production
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret || cookieSecret === "change-this-secret") {
    if (isProduction) {
      errors.push("COOKIE_SECRET is not set or uses the default value. This is a critical security risk in production.");
    } else {
      warnings.push("COOKIE_SECRET is using the default dev value. Set a real secret before production.");
    }
  }

  // JWT_SECRET: must be set
  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      errors.push("JWT_SECRET is not set. Cannot run in production without it.");
    } else {
      warnings.push("JWT_SECRET is not set. Tokens will be insecure.");
    }
  }

  // AUTHZ_ENFORCE: warn if not enabled
  if (process.env.AUTHZ_ENFORCE !== "true") {
    warnings.push(
      "AUTHZ_ENFORCE is not set to 'true'. Permission guard is running in audit-only mode — " +
      "all authenticated users can access all endpoints regardless of role. " +
      "Set AUTHZ_ENFORCE=true before internal rollout."
    );
  }

  if (warnings.length > 0) {
    console.warn("\n⚠️  SECURITY WARNINGS:");
    warnings.forEach((w) => console.warn(`   • ${w}`));
    console.warn("");
  }

  if (errors.length > 0) {
    console.error("\n🚨 CRITICAL SECURITY ERRORS — refusing to start in production:");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("");
    process.exit(1);
  }
}

async function bootstrap() {
  runSecurityChecks();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: process.env.NODE_ENV !== "production",
      bodyLimit: 25 * 1024 * 1024, // 25 MB — supports base64-encoded file uploads
    })
  );

  // Cookie support (for httpOnly session cookie)
  await app.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET ?? "change-this-secret",
  });

  // Global prefix
  app.setGlobalPrefix("api");

  // CORS — allow the Next.js frontend
  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });

  // Validation: strip unknown fields, throw on invalid input
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Consistent API response envelope
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Consistent error shape
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
