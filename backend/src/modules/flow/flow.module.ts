import { Module } from '@nestjs/common';
import { CeModule } from '../ce/ce.module';
import { HistoryModule } from '../history/history.module';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';

@Module({
  imports: [CeModule, HistoryModule],
  controllers: [FlowController],
  providers: [FlowService]
})
export class FlowModule {}
