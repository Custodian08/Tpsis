import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports readiness when the database answers', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(dataSource as unknown as DataSource);

    await expect(controller.check({ status: jest.fn() } as any)).resolves.toMatchObject({
      status: 'ok',
      components: { api: 'ok', database: 'ok' },
    });
  });

  it('reports service unavailable without exposing the database error', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('password=secret in connection string')) };
    const controller = new HealthController(dataSource as unknown as DataSource);
    const response = { status: jest.fn() };

    const result = await controller.check(response as any);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result).toMatchObject({ status: 'error', components: { database: 'unavailable' } });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
