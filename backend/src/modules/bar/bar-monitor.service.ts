import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { BarService } from "./bar.service";
import { BarEntity } from "./entities/bar.entity";
import { BarStatus } from "./enum/bar-status.enum";

@Injectable()
export class BarMonitorService {
  private readonly logger = new Logger(BarMonitorService.name);

  constructor(
    private readonly barService: BarService
  ) { }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleClosingCheck() {

    const barRes = await this.barService.getBar();
    const bar: BarEntity = barRes?.data;

    if (!bar || bar.status === BarStatus.CLOSED) return;

    const now = new Date();
    const [closingHour, closingMinute] = bar.closeHour.split(':').map(Number);

    const closingDate = new Date();
    closingDate.setHours(closingHour, closingMinute, 0, 0);

    // Si la hora de cierre ya pasó hoy por más de 2 minutos, asumimos que es para mañana
    const pastDiffMs = now.getTime() - closingDate.getTime();
    if (pastDiffMs > 2 * 60 * 1000) {
      closingDate.setDate(closingDate.getDate() + 1);
    }

    const diffInMs = closingDate.getTime() - now.getTime();
    const diffInMinutes = Math.round(diffInMs / 1000 / 60);

    if (diffInMinutes <= 0 && bar.status === BarStatus.CLOSING) {
      this.logger.warn(`¡El local ha cerrado oficialmente (${bar.closeHour})!`);
      await this.barService.updateBar({ status: BarStatus.CLOSED });
      return;
    }

    if (diffInMinutes <= 30 && diffInMinutes > 0 && bar.status === BarStatus.OPEN) {
      this.logger.warn(`¡Faltan 30 minutos para el cierre (${bar.closeHour})!`);
      await this.barService.updateBar({ status: BarStatus.CLOSING });
    }
  }
}