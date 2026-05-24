import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './modules/auth/auth.module';
import { CeModule } from './modules/ce/ce.module';
import { ExportModule } from './modules/export/export.module';
import { FilesModule } from './modules/files/files.module';
import { FlowModule } from './modules/flow/flow.module';
import { HealthModule } from './modules/health/health.module';
import { HistoryModule } from './modules/history/history.module';
import { LocksModule } from './modules/locks/locks.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RatesModule } from './modules/rates/rates.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' }
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    CeModule,
    ExportModule,
    FilesModule,
    FlowModule,
    HealthModule,
    HistoryModule,
    LocksModule,
    RatesModule
  ]
})
export class AppModule {}
