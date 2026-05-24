import { ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AuthUser } from '../auth/auth.guard';

const LOCK_TTL_SECONDS = 15 * 60;

@Injectable()
export class LocksService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? 'redis://redis:6379');

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private key(projectId: string) {
    return `lock:project:${projectId}`;
  }

  async get(projectId: string) {
    const value = await this.redis.get(this.key(projectId));
    return value ? JSON.parse(value) : null;
  }

  async acquire(projectId: string, user: AuthUser) {
    const existing = await this.get(projectId);
    if (existing && existing.userId !== user.id) {
      throw new ConflictException(existing);
    }

    const now = Date.now();
    const lock = {
      userId: user.id,
      displayName: user.displayName,
      lockedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + LOCK_TTL_SECONDS * 1000).toISOString()
    };
    await this.redis.set(this.key(projectId), JSON.stringify(lock), 'EX', LOCK_TTL_SECONDS);
    return lock;
  }

  async heartbeat(projectId: string, user: AuthUser) {
    const existing = await this.get(projectId);
    if (!existing || existing.userId !== user.id) {
      throw new ConflictException(existing ?? { message: 'Lock is not owned by current user' });
    }
    return this.acquire(projectId, user);
  }

  async release(projectId: string, user: AuthUser) {
    const existing = await this.get(projectId);
    if (existing?.userId === user.id) {
      await this.redis.del(this.key(projectId));
    }
    return { ok: true };
  }
}

