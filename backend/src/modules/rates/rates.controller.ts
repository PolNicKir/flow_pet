import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRateDto, UpdateRateDto } from './dto';
import { RatesService } from './rates.service';

@Controller('rates')
@UseGuards(AuthGuard)
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  list() {
    return this.ratesService.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRateDto) {
    return this.ratesService.create(user.id, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRateDto) {
    return this.ratesService.update(id, dto);
  }
}

