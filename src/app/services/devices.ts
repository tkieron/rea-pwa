import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api.tokens';

export interface DeviceListItemDto {
  id: number;
  businessId?: string | null;
  name?: string | null;
}

export interface DeviceListResponseDto {
  items: DeviceListItemDto[];
}

export interface DeviceInfoAssignedPetDto {
  id: number;
  name: string;
}

export interface DeviceLastPositionDto {
  traccarPositionId: number;
  deviceTime: string | null;
  fixTime: string | null;
  serverTime: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  address: string | null;
}

export interface DeviceInfoResponseDto {
  id: number;
  businessId: string;
  displayName: string;
  traccarDeviceId: number | null;

  connectivityStatus: string | null;
  sensorLive: boolean | null;
  locationStatus: string | null;
  locationLive: boolean | null;

  batteryPercent: number | null;
  charging: boolean | null;
  liveTrackingEnabled: boolean | null;

  traccarLastUpdate: string | null;
  attributesReadAt?: string | null;

  assignedPet: DeviceInfoAssignedPetDto | null;
  lastPosition: DeviceLastPositionDto | null;

  rssi: number | null;
  motion: boolean | null;
  sat: number | null;
  distance: number | null;
  totalDistance: number | null;
  hours: number | null;
  heartRate: number | null;
  ip: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class DevicesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(options?: { petId?: number }): Observable<DeviceListResponseDto> {
    let params = new HttpParams();

    if (options?.petId) {
      params = params.set('petId', options.petId);
    }

    return this.http.get<DeviceListResponseDto>(`${this.apiBaseUrl}/api/v1/devices`, {
      params,
    });
  }

  getInfo(deviceId: number): Observable<DeviceInfoResponseDto> {
    return this.http.get<DeviceInfoResponseDto>(`${this.apiBaseUrl}/api/v1/devices/${deviceId}/info`);
  }
}
