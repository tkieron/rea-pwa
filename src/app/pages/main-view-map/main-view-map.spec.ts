import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MainViewMapPage } from './main-view-map';
import { ApiFeedbackService } from '../../services/api-feedback';
import { AuthSessionService } from '../../services/auth-session';
import { DevicesService, DeviceInfoResponseDto } from '../../services/devices';
import { PetsService } from '../../services/pets';
import {
  createApiFeedbackServiceMock,
  createAuthSessionServiceMock,
  createDevicesServiceMock,
  createPetsServiceMock,
} from '../../../test-helpers/service-mocks';

describe('MainViewMapPage', () => {
  let mockPetsService: ReturnType<typeof createPetsServiceMock>;
  let mockDevicesService: ReturnType<typeof createDevicesServiceMock>;
  let mockApiFeedback: ReturnType<typeof createApiFeedbackServiceMock>;
  let mockAuthSession: ReturnType<typeof createAuthSessionServiceMock>;

  beforeEach(() => {
    mockPetsService = createPetsServiceMock();
    mockDevicesService = createDevicesServiceMock();
    mockApiFeedback = createApiFeedbackServiceMock();
    mockAuthSession = createAuthSessionServiceMock();

    mockPetsService.list.mockReturnValue(of({ items: [] }));
    mockPetsService.resolvePhotoUrl.mockReturnValue(null);
    mockDevicesService.list.mockReturnValue(of({ items: [] }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PetsService, useValue: mockPetsService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: ApiFeedbackService, useValue: mockApiFeedback },
        { provide: AuthSessionService, useValue: mockAuthSession },
      ],
    });
  });

  it('opens and closes the drawer menu', () => {
    const fixture = TestBed.createComponent(MainViewMapPage);
    fixture.detectChanges();

    const menuButton = fixture.nativeElement.querySelector(
      '[data-testid="main-menu-button"]',
    ) as HTMLButtonElement;
    menuButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-drawer')).not.toBeNull();

    const closeButton = fixture.nativeElement.querySelector(
      '[data-testid="drawer-close-button"]',
    ) as HTMLButtonElement;
    closeButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-drawer')).toBeNull();
  });

  it('logs out from the drawer menu', () => {
    const fixture = TestBed.createComponent(MainViewMapPage);
    fixture.detectChanges();

    fixture.componentInstance.openDrawer();
    fixture.detectChanges();

    const logoutButton = fixture.nativeElement.querySelector(
      '[data-testid="drawer-logout-button"]',
    ) as HTMLButtonElement;
    logoutButton.click();

    expect(mockAuthSession.logout).toHaveBeenCalled();
    expect(fixture.componentInstance.drawerOpen()).toBe(false);
  });

  it('opens tracker details when requested', () => {
    const component = TestBed.createComponent(MainViewMapPage).componentInstance;

    component.currentDeviceInfo.set({
      id: 3,
      businessId: 'TRK-003',
      displayName: 'Tracker 3',
      traccarDeviceId: 88,
      connectivityStatus: 'online',
      sensorLive: true,
      locationStatus: 'LIVE',
      locationLive: true,
      batteryPercent: 95,
      charging: false,
      liveTrackingEnabled: true,
      alarmTime: '2026-04-22T10:15:30Z',
      alarmType: 'lowPower',
      traccarLastUpdate: '2026-04-22T10:16:30Z',
      assignedPet: { id: 12, name: 'Rea' },
      lastPosition: null,
      rssi: 63,
      motion: false,
      sat: 9,
      distance: 12.5,
      totalDistance: 100.0,
      hours: 8,
      heartRate: 72,
      ip: '10.0.0.1',
    } as DeviceInfoResponseDto);

    component.openTrackerDetails();

    expect(component.trackerDetailsOpen()).toBe(true);
  });

  it('hides map controls while tracker details are open', () => {
    const fixture = TestBed.createComponent(MainViewMapPage);
    const component = fixture.componentInstance;

    component.currentDeviceInfo.set({
      id: 3,
      businessId: 'TRK-003',
      displayName: 'Tracker 3',
      traccarDeviceId: 88,
      connectivityStatus: 'online',
      sensorLive: true,
      locationStatus: 'LIVE',
      locationLive: true,
      batteryPercent: 95,
      charging: false,
      liveTrackingEnabled: true,
      alarmTime: '2026-04-22T10:15:30Z',
      alarmType: 'lowPower',
      traccarLastUpdate: '2026-04-22T10:16:30Z',
      assignedPet: { id: 12, name: 'Rea' },
      lastPosition: null,
      rssi: 63,
      motion: false,
      sat: 9,
      distance: 12.5,
      totalDistance: 100.0,
      hours: 8,
      heartRate: 72,
      ip: '10.0.0.1',
    } as DeviceInfoResponseDto);

    component.trackerDetailsOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fab-stack')).toBeNull();
  });

  it('loads today route history for current pet', () => {
    const component = TestBed.createComponent(MainViewMapPage).componentInstance;

    component.currentPet.set({
      id: 12,
      name: 'Rea',
      breed: { name: 'Mixed Breed', species: 'DOG' },
      gender: 'FEMALE',
      dateOfBirth: '2025-01-01',
      photoUrl: null,
      assignedDevice: { id: 3, businessId: 'TRK-003', name: 'Tracker 3' },
    });
    component.trackerDetailsOpen.set(true);
    mockPetsService.getRoute.mockReturnValue(of({
      petId: 12,
      from: '2026-04-26T00:00:00Z',
      to: '2026-04-27T00:00:00Z',
      points: [
        { lat: 52.2297, lng: 21.0122, course: 183.4, gps: true },
        { lat: 52.22, lng: 21.01, course: 90.0, gps: false },
        { lat: 52.23, lng: 21.02, course: null, gps: true },
      ],
    }));

    component.showTodayRouteHistory();

    expect(mockPetsService.getRoute).toHaveBeenCalledWith(12, {
      preset: 'today',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
    expect(component.routeHistoryPoints()).toEqual([
      { lat: 52.2297, lng: 21.0122, course: 183.4 },
      { lat: 52.23, lng: 21.02, course: null },
    ]);
    expect(component.trackerDetailsOpen()).toBe(false);
  });

  it('groups device info into logical detail sections', () => {
    const component = TestBed.createComponent(MainViewMapPage).componentInstance;

    component.currentPet.set({
      id: 12,
      name: 'Rea',
      breed: { name: 'Mixed Breed', species: 'DOG' },
      gender: 'FEMALE',
      dateOfBirth: '2025-01-01',
      photoUrl: null,
      assignedDevice: { id: 3, businessId: 'TRK-003', name: 'Tracker 3' },
    });
    component.currentDeviceInfo.set({
      id: 3,
      businessId: 'TRK-003',
      displayName: 'Tracker 3',
      traccarDeviceId: 88,
      connectivityStatus: 'online',
      sensorLive: true,
      locationStatus: 'LIVE',
      locationLive: true,
      batteryPercent: 95,
      charging: false,
      liveTrackingEnabled: true,
      alarmTime: '2026-04-22T10:15:30Z',
      alarmType: 'lowPower',
      traccarLastUpdate: '2026-04-22T10:16:30Z',
      assignedPet: { id: 12, name: 'Rea' },
      lastPosition: {
        traccarPositionId: 42,
        deviceTime: '2026-04-22T10:10:00Z',
        fixTime: '2026-04-22T10:12:00Z',
        serverTime: '2026-04-22T10:16:30Z',
        latitude: 52.1,
        longitude: 21.0,
        speed: 12.5,
        course: 90,
        address: 'Warsaw',
      },
      rssi: 63,
      motion: false,
      sat: 9,
      distance: 12.5,
      totalDistance: 100.0,
      hours: 8,
      heartRate: 72,
      ip: '10.0.0.1',
    } as DeviceInfoResponseDto);

    const sections = component.trackerDetailSections();

    expect(sections.map((section) => section.title)).toEqual([
      'Identity',
      'Status',
      'Power & telemetry',
      'Location',
    ]);
    expect(sections[0].items.some((item) => item.label === 'Traccar Device ID' && item.value === '88')).toBe(true);
    expect(sections[1].items.some((item) => item.label === 'Alarm type' && item.value === 'Low Power')).toBe(true);
    expect(sections[2].items.some((item) => item.label === 'RSSI' && item.value === '63')).toBe(true);
    expect(sections[3].items.some((item) => item.label === 'Address' && item.value === 'Warsaw')).toBe(true);
  });
});
