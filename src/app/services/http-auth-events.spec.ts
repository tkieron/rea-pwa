import { HttpAuthEventsService } from './http-auth-events';

describe('HttpAuthEventsService', () => {
  it('should emit auth error code', () => {
    const service = new HttpAuthEventsService();

    service.emit(401);

    expect(service.lastAuthError()).toBe(401);
  });

  it('should clear auth error code', () => {
    const service = new HttpAuthEventsService();
    service.emit(403);

    service.clear();

    expect(service.lastAuthError()).toBeNull();
  });
});

