import { ToastService } from './toast';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should add toast with incremental ids', () => {
    const firstId = service.show({ kind: 'info', title: 'Info' }, { durationMs: 0 });
    const secondId = service.show({ kind: 'success', title: 'Done' }, { durationMs: 0 });

    expect(firstId).toBe(1);
    expect(secondId).toBe(2);
    expect(service.items()).toEqual([
      { id: 1, kind: 'info', title: 'Info' },
      { id: 2, kind: 'success', title: 'Done' },
    ]);
  });

  it('should auto-dismiss toast after default duration', () => {
    service.show({ kind: 'warning', title: 'Warn' });

    expect(service.items()).toHaveLength(1);

    vi.advanceTimersByTime(4000);

    expect(service.items()).toEqual([]);
  });

  it('should not auto-dismiss when duration is zero', () => {
    service.show({ kind: 'error', title: 'Error' }, { durationMs: 0 });

    vi.advanceTimersByTime(10_000);

    expect(service.items()).toHaveLength(1);
  });

  it('should dismiss a single toast by id', () => {
    const firstId = service.show({ kind: 'info', title: 'A' }, { durationMs: 0 });
    service.show({ kind: 'info', title: 'B' }, { durationMs: 0 });

    service.dismiss(firstId);

    expect(service.items()).toEqual([{ id: 2, kind: 'info', title: 'B' }]);
  });

  it('should clear all toasts', () => {
    service.show({ kind: 'info', title: 'A' }, { durationMs: 0 });
    service.show({ kind: 'success', title: 'B' }, { durationMs: 0 });

    service.clearAll();

    expect(service.items()).toEqual([]);
  });
});

