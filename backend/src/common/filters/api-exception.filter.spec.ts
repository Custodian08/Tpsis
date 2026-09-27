import { ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('returns a safe 500 response with a request ID, without exposing the exception', () => {
    const request = { requestId: 'req-test-1', method: 'GET', originalUrl: '/api/data/stats?secret=query' };
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new Error('password=private database detail'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 500,
      requestId: 'req-test-1',
      path: '/api/data/stats',
      message: expect.not.stringContaining('private'),
    }));
  });
});
