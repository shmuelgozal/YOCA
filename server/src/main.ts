import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

config({ path: resolve(__dirname, '..', '.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('');
  app.enableCors({
    origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:4200')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
