import { randomUUID } from 'crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { TenantDbService } from '@database/tenant-db.service';
import { users } from '@database/schema/users';
import { refreshTokens } from '@database/schema/auth';
import { JWT_ACCESS_TOKEN_EXPIRY, JWT_REFRESH_TOKEN_EXPIRY } from '@saas-platform/shared';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

const BCRYPT_ROUNDS = 10;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface RefreshPayload {
  sub: string;
  type?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.tenantDb.withoutTenantContext(async (tx) => {
      return tx.select({ id: users.id }).from(users).where(eq(users.email, dto.email)).limit(1);
    });

    if (existing.length > 0) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const [user] = await this.tenantDb.withoutTenantContext(async (tx) => {
      return tx
        .insert(users)
        .values({ email: dto.email, name: dto.name, passwordHash })
        .returning({ id: users.id, email: users.email, name: users.name });
    });

    const tokens = await this.generateTokens(user.id);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { ...tokens, user };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const [user] = await this.tenantDb.withoutTenantContext(async (tx) => {
      return tx
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, dto.email))
        .limit(1);
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash ?? '');
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async refresh(incomingToken: string): Promise<AuthResponseDto> {
    const userId = await this.verifyRefreshJwt(incomingToken);

    // Query all non-expired tokens for this user (active and revoked) in one pass.
    // Including revoked tokens allows detecting reuse of a stolen token.
    const allTokens = await this.tenantDb.withoutTenantContext(async (tx) => {
      return tx
        .select()
        .from(refreshTokens)
        .where(and(eq(refreshTokens.userId, userId), gt(refreshTokens.expiresAt, new Date())));
    });

    let matched: (typeof allTokens)[0] | null = null;
    for (const record of allTokens) {
      if (await bcrypt.compare(incomingToken, record.tokenHash)) {
        matched = record;
        break;
      }
    }

    if (!matched) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // A valid-signature token that is already revoked → reuse detected
    if (matched.revokedAt !== null) {
      await this.tenantDb.withoutTenantContext(async (tx) => {
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
      });
      throw new UnauthorizedException('Session compromised');
    }

    // Generate tokens before the transaction so the new token hash is ready to insert
    const tokens = await this.generateTokens(userId);
    const newTokenHash = await bcrypt.hash(tokens.refreshToken, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

    // Rotation: revoke old token, fetch user, and persist new token — all atomic
    const [user] = await this.tenantDb.withoutTenantContext(async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, matched!.id));

      await tx.insert(refreshTokens).values({ userId, tokenHash: newTokenHash, expiresAt });

      return tx
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    });

    return { ...tokens, user };
  }

  async logout(incomingToken: string): Promise<void> {
    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<RefreshPayload>(incomingToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      userId = payload.sub;
    } catch {
      // Invalid or expired token — nothing to revoke, idempotent
      return;
    }

    const activeTokens = await this.tenantDb.withoutTenantContext(async (tx) => {
      return tx
        .select({ id: refreshTokens.id, tokenHash: refreshTokens.tokenHash })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.userId, userId),
            isNull(refreshTokens.revokedAt),
            gt(refreshTokens.expiresAt, new Date()),
          ),
        );
    });

    for (const record of activeTokens) {
      if (await bcrypt.compare(incomingToken, record.tokenHash)) {
        await this.tenantDb.withoutTenantContext(async (tx) => {
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.id, record.id));
        });
        return;
      }
    }
    // Not found in active tokens — idempotent no-op
  }

  private async verifyRefreshJwt(token: string): Promise<string> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return payload.sub;
  }

  private async generateTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, jti: randomUUID() },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          expiresIn: JWT_ACCESS_TOKEN_EXPIRY,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, type: 'refresh', jti: randomUUID() },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: JWT_REFRESH_TOKEN_EXPIRY,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string): Promise<void> {
    const tokenHash = await bcrypt.hash(token, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);

    await this.tenantDb.withoutTenantContext(async (tx) => {
      await tx.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
    });
  }
}
