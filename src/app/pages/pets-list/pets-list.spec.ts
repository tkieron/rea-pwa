import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { delay, of, throwError } from 'rxjs';
import { PetsListPage } from './pets-list';
import { ApiFeedbackService } from '../../services/api-feedback';
import { DevicesService } from '../../services/devices';
import { PetsService } from '../../services/pets';
import {
  createApiFeedbackServiceMock,
  createDevicesServiceMock,
  createPetsServiceMock,
} from '../../../test-helpers/service-mocks';

describe('PetsListPage', () => {
  let mockPetsService: ReturnType<typeof createPetsServiceMock>;
  let mockDevicesService: ReturnType<typeof createDevicesServiceMock>;
  let mockApiFeedback: ReturnType<typeof createApiFeedbackServiceMock>;

  beforeEach(() => {
    mockPetsService = createPetsServiceMock();
    mockDevicesService = createDevicesServiceMock();
    mockApiFeedback = createApiFeedbackServiceMock();
  });

  const setup = async () =>
    render(PetsListPage, {
      providers: [
        provideRouter([]),
        { provide: PetsService, useValue: mockPetsService },
        { provide: DevicesService, useValue: mockDevicesService },
        { provide: ApiFeedbackService, useValue: mockApiFeedback },
      ],
    });

  it('powinien wyrenderować stan ładowania na początku', async () => {
    // Opoznienie pozwala zobaczyc loader przed zakonczeniem forkJoin.
    mockPetsService.list.mockReturnValue(of({ items: [] }).pipe(delay(100)));
    mockDevicesService.list.mockReturnValue(of({ items: [] }).pipe(delay(100)));

    await setup();

    expect(screen.getByText('Ladowanie listy zwierzakow...')).toBeTruthy();
  });

  it('powinien poprawnie wyrenderować listę zwierzaków (sukces)', async () => {
    mockPetsService.list.mockReturnValue(of({
      items: [
        {
          id: 1,
          name: 'Burek',
          breed: { name: 'Mieszaniec', species: 'DOG' },
          gender: 'MALE',
          assignedDevice: null,
          photoUrl: 'burek.jpg',
        },
        {
          id: 2,
          name: 'Mruczek',
          breed: { name: 'Dachowiec', species: 'CAT' },
          gender: 'MALE',
          assignedDevice: { id: 10, name: 'Tracker1' },
          photoUrl: null,
        },
      ],
    }));
    mockDevicesService.list.mockReturnValue(of({
      items: [{ id: 10, name: 'Tracker1' }],
    }));

    await setup();

    // ATL render czeka na stabilnosc, wiec dane powinny byc juz gotowe.
    expect(screen.queryByText('Ladowanie listy zwierzakow...')).toBeFalsy();

    expect(screen.getByText('Burek')).toBeTruthy();
    expect(screen.getByText('Mruczek')).toBeTruthy();

    expect(screen.getByText('Assigned: 1')).toBeTruthy();
    expect(screen.getByText('Devices: 1')).toBeTruthy();
    expect(screen.getByText('All Pets (2)')).toBeTruthy();

    expect(screen.getByText('NO DEVICE')).toBeTruthy();
    expect(screen.getByText('TRACKED')).toBeTruthy();
  });

  it('powinien pokazać stan pusty, gdy brak zwierzaków', async () => {
    mockPetsService.list.mockReturnValue(of({ items: [] }));
    mockDevicesService.list.mockReturnValue(of({ items: [] }));

    await setup();

    expect(screen.getByText('Brak zwierzakow')).toBeTruthy();
    expect(screen.getByText(/Po dodaniu pierwszego peta pojawi sie tutaj/)).toBeTruthy();
  });

  it('powinien pokazać błąd widoku i wezwać ApiFeedback przy błędzie API', async () => {
    const errorObj = new Error('Brak polaczenia');
    mockPetsService.list.mockReturnValue(throwError(() => errorObj));
    mockDevicesService.list.mockReturnValue(of({ items: [] }));

    await setup();

    expect(screen.getByText('Nie udalo sie pobrac listy. Sprobuj ponownie za chwile.')).toBeTruthy();

    expect(mockApiFeedback.showError).toHaveBeenCalledWith(
      errorObj,
      expect.objectContaining({
        title: 'Nie udalo sie pobrac listy zwierzakow',
      })
    );
  });
});
