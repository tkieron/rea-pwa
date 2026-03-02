import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ToastService } from '../../services/toast';
import { ToastHostComponent } from './toast-host';

describe('ToastHostComponent', () => {
  it('should render toast items from service signal', async () => {
    const toastServiceMock = {
      items: signal([
        { id: 1, kind: 'success' as const, title: 'Saved', message: 'Ok' },
        { id: 2, kind: 'error' as const, title: 'Error' },
      ]),
      dismiss: vi.fn(),
    };

    await render(ToastHostComponent, {
      providers: [{ provide: ToastService, useValue: toastServiceMock }],
    });

    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Ok')).toBeTruthy();
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('should call dismiss when close button is clicked', async () => {
    const user = userEvent.setup();
    const toastServiceMock = {
      items: signal([{ id: 7, kind: 'warning' as const, title: 'Session expiring' }]),
      dismiss: vi.fn(),
    };

    await render(ToastHostComponent, {
      providers: [{ provide: ToastService, useValue: toastServiceMock }],
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(toastServiceMock.dismiss).toHaveBeenCalledWith(7);
  });
});

