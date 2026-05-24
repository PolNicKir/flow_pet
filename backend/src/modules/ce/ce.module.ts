import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { CeCalculationService } from './ce-calculation.service';
import { CeController } from './ce.controller';
import { CeService } from './ce.service';

@Module({
  imports: [HistoryModule],
  controllers: [CeController],
  providers: [CeService, CeCalculationService],
  exports: [CeService, CeCalculationService]
})
export class CeModule {}
