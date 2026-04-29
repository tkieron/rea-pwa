import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Map } from './map';

describe('Map', () => {
  let component: Map;
  let fixture: ComponentFixture<Map>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Map],
    }).compileComponents();

    fixture = TestBed.createComponent(Map);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render direction arrows for route points with course', () => {
    fixture.componentRef.setInput('routePoints', [
      { lat: 52.2297, lng: 21.0122, course: 183.4 },
      { lat: 52.23, lng: 21.02, course: null },
      { lat: 52.231, lng: 21.03, course: 90 },
    ]);
    fixture.detectChanges();

    const arrows = fixture.nativeElement.querySelectorAll('.rea-route-direction');

    expect(arrows).toHaveLength(2);
    expect(arrows[0].getAttribute('style')).toContain('--course:183.4deg');
    expect(arrows[1].getAttribute('style')).toContain('--course:90deg');
  });
});
