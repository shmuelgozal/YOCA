import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PoolClient } from 'pg';
import { AppService } from './app.service';
import { DatabaseService } from './database.service';

describe('AppService', () => {
  let appService: AppService;
  const database = {
    query: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService, { provide: DatabaseService, useValue: database }],
    }).compile();
    appService = module.get(AppService);
  });

  it('rejects invitation activation when the email does not match the request', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'a1aa0000-0000-4000-8000-000000000001',
            name: 'Tamar Levi',
            email: 'tamar@example.com',
            status: 'approved',
            invitation_expires_at: new Date(Date.now() + 60_000),
          },
        ],
        rowCount: 1,
      }),
    };
    database.transaction.mockImplementation(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work(client as PoolClient),
    );

    await expect(
      appService.activateInvitation({
        token: 'valid-token',
        email: 'someone-else@example.com',
        username: 'tamar.levy',
        password: 'secure-password-123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('activates a matching invitation and creates a server-side session', async () => {
    const user = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member',
    };
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'a1aa0000-0000-4000-8000-000000000001',
              name: 'Tamar Levi',
              email: 'tamar@example.com',
              status: 'approved',
              invitation_expires_at: new Date(Date.now() + 60_000),
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [user], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    database.transaction.mockImplementation(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work(client as PoolClient),
    );

    const result = await appService.activateInvitation({
      token: 'valid-token',
      email: 'TAMAR@example.com',
      username: 'tamar.levy',
      password: 'secure-password-123',
    });

    expect(result.user).toEqual({ ...user, status: 'active' });
    expect(result.sessionToken).toHaveLength(43);
    expect(client.query).toHaveBeenCalledTimes(4);
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('auth_sessions'),
      expect.not.arrayContaining([result.sessionToken]),
    );
  });

  it('rejects invalid class details before reaching PostgreSQL', async () => {
    await expect(
      appService.createClass({
        name: 'Yoga',
        coach: 'Coach',
        location: 'Studio',
        date: '2026-02-30',
        time: '18:00',
        capacity: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('prevents members from reserving for a full class and serializes the check', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ capacity: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ booked: 1 }], rowCount: 1 }),
    };
    database.transaction.mockImplementation(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work(client as PoolClient),
    );
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };

    await expect(
      appService.reserveClass('a1aa0000-0000-4000-8000-000000000003', member),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it('does not allow the coach account to reserve as a member', async () => {
    const coach = {
      id: 'a1aa0000-0000-4000-8000-000000000001',
      name: 'YOCA Coach',
      email: 'coach@example.com',
      username: 'coach',
      role: 'coach' as const,
    };

    await expect(
      appService.reserveClass('a1aa0000-0000-4000-8000-000000000003', coach),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('returns reservation rosters only for coaches', async () => {
    database.query.mockResolvedValue({
      rows: [
        {
          id: 'a1aa0000-0000-4000-8000-000000000003',
          class_date: '2026-11-01',
          start_time: '18:00:00',
          name: 'יוגה זורמת',
          coach: 'YOCA Coach',
          location: 'סטודיו ראשי',
          capacity: 12,
          booked: 1,
          reserved: false,
          attendees: [
            { memberId: 'member-id', name: 'Tamar Levi', attended: false },
          ],
        },
      ],
      rowCount: 1,
    });
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };
    const coach = {
      ...member,
      id: 'a1aa0000-0000-4000-8000-000000000001',
      role: 'coach' as const,
    };

    await appService.getClasses(member);
    expect(database.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("ELSE '[]'::json END AS attendees"),
      [false, member.id],
    );

    await appService.getClasses(coach);
    expect(database.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      true,
      coach.id,
    ]);
  });

  it('validates and updates only the authenticated account profile', async () => {
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };
    database.query.mockResolvedValue({
      rows: [
        {
          ...member,
          name: 'Tamar L.',
          email: 'tamar.new@example.com',
          phone: '050-123-4567',
          birthDate: '1994-06-18',
          address: 'neutral',
          reminderEnabled: true,
          reminderLeadMinutes: 30,
          updatesEnabled: false,
        },
      ],
      rowCount: 1,
    });

    const profile = await appService.updateProfile(member, {
      name: 'Tamar L.',
      email: 'TAMAR.NEW@example.com',
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'neutral',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      updatesEnabled: false,
    });

    expect(profile.email).toBe('tamar.new@example.com');
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      [
        member.id,
        'Tamar L.',
        'tamar.new@example.com',
        '050-123-4567',
        '1994-06-18',
        'neutral',
        true,
        30,
        false,
        null,
      ],
    );
  });

  it('rejects malformed profile data without updating the account', async () => {
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };
    await expect(
      appService.updateProfile(member, {
        name: 'Tamar Levi',
        email: 'tamar@example.com',
        phone: '',
        birthDate: '1994-02-30',
        address: 'neutral',
        reminderEnabled: true,
        reminderLeadMinutes: 60,
        updatesEnabled: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('calculates an offline payment and grants package sessions atomically', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            { id: 'a1aa0000-0000-4000-8000-000000000002', name: 'Tamar Levi' },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ name: 'חבילת 10 אימונים', sessions: 10, price: '650.00' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [{ kind: 'percent', value: '10.00' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 'payment-id', recorded_at: new Date('2026-10-20T08:00:00Z') },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    database.transaction.mockImplementation(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work(client as PoolClient),
    );

    const payment = await appService.recordManualPayment({
      memberId: 'a1aa0000-0000-4000-8000-000000000002',
      packageId: 'a1aa0000-0000-4000-8000-000000000003',
      packageCount: 2,
      method: 'bit',
    });

    expect(payment).toMatchObject({
      memberName: 'Tamar Levi',
      packageName: 'חבילת 10 אימונים',
      sessions: 20,
      grossAmount: 1300,
      discountAmount: 130,
      paidAmount: 1170,
      method: 'bit',
    });
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO manual_payments'),
      expect.arrayContaining([20, '1300.00', '130.00', '1170.00', 'bit']),
    );
    expect(client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('member_balances'),
      ['a1aa0000-0000-4000-8000-000000000002', 20],
    );
  });

  it('rejects invalid payment input before opening a transaction', async () => {
    await expect(
      appService.recordManualPayment({
        memberId: 'not-a-uuid',
        packageId: '0',
        packageCount: 1,
        method: 'cash',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it('records attendance and consumes at most one purchased session atomically', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ class_id: 'class-id' }],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    database.transaction.mockImplementation(
      (work: (client: PoolClient) => Promise<unknown>) =>
        work(client as PoolClient),
    );

    await expect(
      appService.markClassAttendance(
        'a1aa0000-0000-4000-8000-000000000003',
        'a1aa0000-0000-4000-8000-000000000002',
      ),
    ).resolves.toMatchObject({ attended: true });
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'least(member_balances.purchased_sessions, member_balances.used_sessions + 1)',
      ),
      ['a1aa0000-0000-4000-8000-000000000002'],
    );
  });

  it('scopes a member workout history query to the authenticated member', async () => {
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };
    database.query.mockResolvedValue({
      rows: [],
      rowCount: 0,
    });

    await expect(appService.getMemberWorkoutHistory(member)).resolves.toEqual(
      [],
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE r.user_id = $1 AND r.attended_at IS NOT NULL',
      ),
      [member.id],
    );
  });

  it('does not permit a coach to use the member workout-history service', async () => {
    await expect(
      appService.getMemberWorkoutHistory({
        id: 'a1aa0000-0000-4000-8000-000000000001',
        name: 'YOCA Coach',
        email: 'coach@example.com',
        username: 'coach',
        role: 'coach',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rejects invalid or unowned personal workout feedback', async () => {
    const member = {
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      role: 'member' as const,
    };
    await expect(
      appService.savePersonalWorkoutFeedback(
        member,
        'a1aa0000-0000-4000-8000-000000000003',
        { rating: 6, painAreas: [], painIntensity: null, note: '' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(database.query).not.toHaveBeenCalled();

    database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await expect(
      appService.savePersonalWorkoutFeedback(
        member,
        'a1aa0000-0000-4000-8000-000000000003',
        { rating: 5, painAreas: [], painIntensity: null, note: '' },
      ),
    ).rejects.toThrow('Attended workout not found');
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE class_id = $1 AND user_id = $2 AND attended_at IS NOT NULL',
      ),
      ['a1aa0000-0000-4000-8000-000000000003', member.id],
    );
  });
});
