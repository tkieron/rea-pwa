import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  /**
   * Otwiera zewnętrzną aplikację nawigacji.
   * Nie korzysta z płatnego API Google, tylko z darmowych linków systemowych.
   */
  openNavigation(lat: number, lng: number) {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);

    // Apple Maps dla iOS, Google Maps dla reszty świata
    const url = isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    window.open(url, '_blank');
  }
}
