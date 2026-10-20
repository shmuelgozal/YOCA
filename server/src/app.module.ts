import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  CoachAuthGuard,
  MemberAuthGuard,
  SessionAuthGuard,
} from './coach-auth.guard';
import { DatabaseService } from './database.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    CoachAuthGuard,
    MemberAuthGuard,
    SessionAuthGuard,
    DatabaseService,
  ],
})
export class AppModule {}
