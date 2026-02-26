import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthSessionService } from './services/auth-session';
import { PingService } from './services/ping';
import { HttpAuthEventsService } from './services/http-auth-events';
import { ToastService } from './services/toast';
import {
  createAuthSessionServiceMock,
  createHttpAuthEventsServiceMock,
  createPingServiceMock,
  createToastServiceMock,
} from '../test-helpers/service-mocks';

function createAppMocks() {
  return {
    authSession: createAuthSessionServiceMock(),
    pingService: createPingServiceMock(),
    authEvents: createHttpAuthEventsServiceMock(),
    toastService: createToastServiceMock(),
  };
}

describe('App', () => {
  beforeEach(async () => {
    const mocks = createAppMocks();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: mocks.authSession },
        { provide: PingService, useValue: mocks.pingService },
        { provide: HttpAuthEventsService, useValue: mocks.authEvents },
        { provide: ToastService, useValue: mocks.toastService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-toast-host')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
