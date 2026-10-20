import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appService = {
    getHealth: jest.fn().mockResolvedValue({ status: 'ok' }),
    getClasses: jest.fn().mockResolvedValue([{ id: 'class-1' }]),
    createJoinRequest: jest
      .fn()
      .mockResolvedValue({ id: 'request-1', status: 'pending' }),
    getLatestSocialPost: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('returns a health status', async () => {
    await expect(appController.getHealth()).resolves.toEqual({ status: 'ok' });
  });

  it('delegates join request creation', async () => {
    await expect(
      appController.createJoinRequest({
        name: 'Tamar Levi',
        email: 'tamar@example.com',
      }),
    ).resolves.toMatchObject({ id: 'request-1', status: 'pending' });
    expect(appService.createJoinRequest).toHaveBeenCalledWith({
      name: 'Tamar Levi',
      email: 'tamar@example.com',
    });
  });

  it('returns the persisted latest social post', async () => {
    await expect(appController.getLatestSocialPost()).resolves.toBeNull();
    expect(appService.getLatestSocialPost).toHaveBeenCalled();
  });
});
