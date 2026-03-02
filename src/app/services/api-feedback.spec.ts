import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ApiFeedbackService } from './api-feedback';
import { ToastService } from './toast';

describe('ApiFeedbackService', () => {
  let service: ApiFeedbackService;
  let toastServiceMock: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastServiceMock = {
      show: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ApiFeedbackService,
        { provide: ToastService, useValue: toastServiceMock },
      ],
    });

    service = TestBed.inject(ApiFeedbackService);
  });

  it('should show success toast with default duration', () => {
    service.showSuccess('Saved', 'Everything ok');

    expect(toastServiceMock.show).toHaveBeenCalledWith(
      {
        kind: 'success',
        title: 'Saved',
        message: 'Everything ok',
      },
      { durationMs: 3000 },
    );
  });

  it('should use fallback error message for non-http errors', () => {
    service.showError(new Error('boom'), {
      title: 'Load failed',
      fallbackMessage: 'Fallback message',
    });

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Load failed',
      message: 'Fallback message',
    });
  });

  it('should use api string error body when available', () => {
    service.showError(
      new HttpErrorResponse({
        status: 400,
        error: 'API says no',
      }),
      {
        title: 'Save failed',
        fallbackMessage: 'Fallback',
      },
    );

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Save failed',
      message: 'API says no',
    });
  });

  it('should use nested api message when available', () => {
    service.showError(
      new HttpErrorResponse({
        status: 422,
        error: { message: 'Validation failed' },
      }),
      {
        title: 'Save failed',
        fallbackMessage: 'Fallback',
      },
    );

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Save failed',
      message: 'Validation failed',
    });
  });

  it('should use mapped status message when response has no api message', () => {
    service.showError(
      new HttpErrorResponse({
        status: 404,
        error: {},
      }),
      {
        title: 'Load failed',
        fallbackMessage: 'Fallback',
        statusMessages: { 404: 'Nie znaleziono' },
      },
    );

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Load failed',
      message: 'Nie znaleziono',
    });
  });

  it('should use custom network message for status 0', () => {
    service.showError(
      new HttpErrorResponse({
        status: 0,
        error: null,
      }),
      {
        title: 'Load failed',
        fallbackMessage: 'Fallback',
        networkMessage: 'Brak sieci',
      },
    );

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Load failed',
      message: 'Brak sieci',
    });
  });

  it('should use default network message for status 0 without override', () => {
    service.showError(
      new HttpErrorResponse({
        status: 0,
        error: null,
      }),
      {
        title: 'Load failed',
        fallbackMessage: 'Fallback',
      },
    );

    expect(toastServiceMock.show).toHaveBeenCalledWith({
      kind: 'error',
      title: 'Load failed',
      message: 'Brak polaczenia z API.',
    });
  });
});

