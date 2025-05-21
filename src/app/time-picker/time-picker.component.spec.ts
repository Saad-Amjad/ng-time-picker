import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TimePickerComponent } from './time-picker.component';
import { ElementRef } from '@angular/core';

describe('TimePickerComponent', () => {
  let component: TimePickerComponent;
  let fixture: ComponentFixture<TimePickerComponent>;
  let store: { [key: string]: string | null } = {};

  const mockLocalStorage = {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      store[key] = null;
    },
    clear: () => {
      store = {};
    }
  };

  // Mock ElementRef for clockFaceEl
  class MockElementRef implements ElementRef {
    nativeElement = {
      getBoundingClientRect: () => ({
        left: 50, // Example value
        top: 50,  // Example value
        width: 200, // Example value (clock-face width)
        height: 200 // Example value (clock-face height)
      })
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TimePickerComponent],
      providers: [
        { provide: ElementRef, useClass: MockElementRef } // Provide the mock for ElementRef if needed directly
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TimePickerComponent);
    component = fixture.componentInstance;

    // Mock localStorage
    spyOn(localStorage, 'getItem').and.callFake(mockLocalStorage.getItem);
    spyOn(localStorage, 'setItem').and.callFake(mockLocalStorage.setItem);
    spyOn(localStorage, 'removeItem').and.callFake(mockLocalStorage.removeItem);
    spyOn(localStorage, 'clear').and.callFake(mockLocalStorage.clear);
    
    // Assign the mock ElementRef to the component's ViewChild property
    component.clockFaceEl = new MockElementRef() as ElementRef<HTMLDivElement>;

    store = {}; // Reset store before each test
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Theme Picker Functionality', () => {
    it('should initialize with "light" theme by default', () => {
      fixture.detectChanges(); // Trigger ngOnInit
      expect(component.currentTheme).toBe('light');
      expect(component.isDarkTheme).toBe(false);
    });

    it('should set theme correctly and update localStorage', () => {
      component.setTheme('dark');
      expect(component.currentTheme).toBe('dark');
      expect(mockLocalStorage.getItem('timePickerTheme')).toBe('dark');
      expect(component.isDarkTheme).toBe(true);

      component.setTheme('light');
      expect(component.currentTheme).toBe('light');
      expect(mockLocalStorage.getItem('timePickerTheme')).toBe('light');
      expect(component.isDarkTheme).toBe(false);
    });

    it('should load theme from localStorage on ngOnInit', () => {
      mockLocalStorage.setItem('timePickerTheme', 'dark');
      fixture.detectChanges(); // Trigger ngOnInit
      expect(component.currentTheme).toBe('dark');
      expect(component.isDarkTheme).toBe(true);
    });
  });

  describe('Time Selection via Dragging', () => {
    beforeEach(() => {
      // Ensure clock center is calculated for drag tests
      // ngAfterViewInit would normally call updateClockCenter via setTimeout
      // For tests, we can call it directly or simulate the async part
      fixture.detectChanges(); // This calls ngOnInit
      component.ngAfterViewInit(); // Manually call to setup clockFaceEl if not already
      tick(); // Process the setTimeout in ngAfterViewInit
      component.updateClockCenter(); // Ensure it's calculated
       // Expected center based on MockElementRef: left:50, width:200 => 50 + 100 = 150
       // top:50, height:200 => 50 + 100 = 150
      expect(component.clockCenterX).toBe(150);
      expect(component.clockCenterY).toBe(150);
    });

    describe('updateHandRotations()', () => {
      it('should calculate correct rotations for 12:00 AM/PM', () => {
        component.selectedHour = 12;
        component.selectedMinute = '00';
        component.updateHandRotations();
        expect(component.hourHandRotation).toBe(0); // 12 maps to 0 for rotation calculation
        expect(component.minuteHandRotation).toBe(0);
      });

      it('should calculate correct rotations for 3:30', () => {
        component.selectedHour = 3;
        component.selectedMinute = '30';
        component.updateHandRotations();
        expect(component.hourHandRotation).toBe(105); // (3 * 30) + (30 / 60) * 30 = 90 + 15
        expect(component.minuteHandRotation).toBe(180); // 30 * 6
      });

      it('should calculate correct rotations for 9:45', () => {
        component.selectedHour = 9;
        component.selectedMinute = '45';
        component.updateHandRotations();
        expect(component.hourHandRotation).toBe(292.5); // (9 * 30) + (45 / 60) * 30 = 270 + 22.5
        expect(component.minuteHandRotation).toBe(270); // 45 * 6
      });
       it('should calculate correct rotations for 6:00', () => {
        component.selectedHour = 6;
        component.selectedMinute = '00';
        component.updateHandRotations();
        expect(component.hourHandRotation).toBe(180); 
        expect(component.minuteHandRotation).toBe(0);
      });
    });

    describe('startDrag()', () => {
      it('should set dragging state and calculate clock center', fakeAsync(() => {
        const mockEvent = { clientX: 0, clientY: 0, preventDefault: jasmine.createSpy() } as unknown as MouseEvent;
        spyOn(component, 'updateClockCenter').and.callThrough();
        spyOn(component, 'onDrag').and.stub(); // We test onDrag separately

        component.startDrag('hour', mockEvent);
        tick(); // Process setTimeout if any were introduced, though not directly in startDrag

        expect(component.isDragging).toBe(true);
        expect(component.draggingHand).toBe('hour');
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(component.updateClockCenter).toHaveBeenCalled();
        expect(component.clockCenterX).toBeDefined(); // Check if calculated
        expect(component.clockCenterY).toBeDefined();
        expect(component.onDrag).toHaveBeenCalledWith(mockEvent); // Ensure onDrag is called for initial set
      }));
    });

    describe('onDrag()', () => {
      let emitSpy: jasmine.Spy;
      let updateRotationsSpy: jasmine.Spy;

      beforeEach(fakeAsync(() => {
        component.isDragging = true;
        // Clock center based on mock values in MockElementRef: left:50, top:50, width:200, height:200
        // component.clockCenterX = 50 + 200 / 2 = 150;
        // component.clockCenterY = 50 + 200 / 2 = 150;
        // Call updateClockCenter after fixture.detectChanges() to ensure clockFaceEl is available
        fixture.detectChanges();
        component.ngAfterViewInit(); // call manually
        tick(); // complete the setTimeout
        
        emitSpy = spyOn(component, 'emitValues').and.callThrough();
        updateRotationsSpy = spyOn(component, 'updateHandRotations').and.callThrough();
      }));
      
      // Helper to create mouse event
      const createMouseEvent = (x: number, y: number) => ({ clientX: x, clientY: y, preventDefault: () => {} } as MouseEvent);

      it('should update hour correctly when dragging hour hand (e.g., to ~3 o clock)', () => {
        component.draggingHand = 'hour';
        // Simulate mouse position for approx 3 o'clock (angle ~90 deg from 12 o'clock)
        // Clock center is (150, 150). 3 o'clock is to the right.
        const event = createMouseEvent(component.clockCenterX + 50, component.clockCenterY); // x=200, y=150 => angle relative to center (50,0) => atan2(0,50) = 0 rad. Adjusted: (0 * 180/PI + 90 + 360)%360 = 90 deg
        component.onDrag(event);
        expect(component.selectedHour).toBe(3); 
        expect(updateRotationsSpy).toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalled();
      });

      it('should update hour correctly when dragging hour hand (e.g., to ~9 o clock)', () => {
        component.draggingHand = 'hour';
        // 9 o'clock is to the left.
        const event = createMouseEvent(component.clockCenterX - 50, component.clockCenterY); // x=100, y=150 => angle relative to center (-50,0) => atan2(0,-50) = PI rad. Adjusted: (180 * 180/PI + 90 + 360)%360 = 270 deg
        component.onDrag(event);
        expect(component.selectedHour).toBe(9);
      });
      
      it('should update hour to 12 when dragging hour hand to top', () => {
        component.draggingHand = 'hour';
        // 12 o'clock is to the top.
        const event = createMouseEvent(component.clockCenterX, component.clockCenterY - 50); // x=150, y=100 => angle relative to center (0,-50) => atan2(-50,0) = -PI/2 rad. Adjusted: (-90 + 90 + 360)%360 = 0 deg
        component.onDrag(event);
        expect(component.selectedHour).toBe(12);
      });


      it('should update minute correctly when dragging minute hand (e.g., to ~15 mins / 3 o clock position)', () => {
        component.draggingHand = 'minute';
        // 15 mins is at 3 o'clock position (angle 90 deg)
        const event = createMouseEvent(component.clockCenterX + 50, component.clockCenterY);
        component.onDrag(event);
        expect(component.selectedMinute).toBe('15'); // 90deg / 6 = 15
        expect(updateRotationsSpy).toHaveBeenCalled();
        expect(emitSpy).toHaveBeenCalled();
      });

      it('should update minute correctly when dragging minute hand (e.g., to ~45 mins / 9 o clock position)', () => {
        component.draggingHand = 'minute';
        // 45 mins is at 9 o'clock position (angle 270 deg)
        const event = createMouseEvent(component.clockCenterX - 50, component.clockCenterY);
        component.onDrag(event);
        expect(component.selectedMinute).toBe('45'); // 270deg / 6 = 45
      });

      it('should update minute to "00" when dragging to 12 o clock position', () => {
        component.draggingHand = 'minute';
        // 00 mins is at 12 o'clock position (angle 0 deg)
        const event = createMouseEvent(component.clockCenterX, component.clockCenterY - 50);
        component.onDrag(event);
        expect(component.selectedMinute).toBe('00'); // 0deg / 6 = 0
      });


      it('should not do anything if not dragging', () => {
        component.isDragging = false;
        component.draggingHand = null;
        const initialHour = component.selectedHour;
        const initialMinute = component.selectedMinute;
        const event = createMouseEvent(component.clockCenterX + 50, component.clockCenterY);
        
        component.onDrag(event);
        
        expect(component.selectedHour).toBe(initialHour);
        expect(component.selectedMinute).toBe(initialMinute);
        expect(updateRotationsSpy).not.toHaveBeenCalled();
        expect(emitSpy).not.toHaveBeenCalled();
      });
    });

    describe('stopDrag()', () => {
      it('should reset dragging state', () => {
        component.isDragging = true;
        component.draggingHand = 'hour';
        document.body.style.cursor = 'grabbing';

        component.stopDrag();

        expect(component.isDragging).toBe(false);
        expect(component.draggingHand).toBeNull();
        expect(document.body.style.cursor).toBe('default');
      });
       it('should not fail if called when not dragging', () => {
        component.isDragging = false;
        component.draggingHand = null;
        expect(() => component.stopDrag()).not.toThrow();
      });
    });
  });

  describe('Interaction with Existing Functionality', () => {
    beforeEach(() => {
      spyOn(component, 'updateHandRotations').and.callThrough();
      spyOn(component, 'emitValues').and.callThrough();
    });

    it('setHour() should update selectedHour and hand rotations', () => {
      component.setHour(5);
      expect(component.selectedHour).toBe(5);
      expect(component.updateHandRotations).toHaveBeenCalled();
      expect(component.emitValues).toHaveBeenCalled();
    });

    it('setMinute() should update selectedMinute and hand rotations', () => {
      component.setMinute(25);
      expect(component.selectedMinute).toBe('25');
      expect(component.updateHandRotations).toHaveBeenCalled();
      expect(component.emitValues).toHaveBeenCalled();
    });
    
    it('setMinute() should handle "0" and pad it to "00"', () => {
      component.setMinute(0);
      expect(component.selectedMinute).toBe('00');
      expect(component.updateHandRotations).toHaveBeenCalled();
    });

    it('resetClock() should reset time and update hand rotations', () => {
      component.selectedHour = 5;
      component.selectedMinute = '30';
      component.selectedTime = 'PM';
      component.resetClock();
      expect(component.selectedHour).toBe(12);
      expect(component.selectedMinute).toBe('00');
      expect(component.selectedTime).toBe('AM');
      expect(component.updateHandRotations).toHaveBeenCalled();
      expect(component.emitValues).toHaveBeenCalled();
    });
  });

   describe('pad() utility', () => {
    it('should pad numbers less than 10', () => {
      expect(component.pad(5, 2)).toBe('05');
      expect(component.pad(0, 2)).toBe('00');
    });

    it('should not pad numbers greater than or equal to 10', () => {
      expect(component.pad(10, 2)).toBe('10');
      expect(component.pad(59, 2)).toBe('59');
    });
  });

  describe('openClock()', () => {
    it('should toggle open state and update rotations/center when opening', fakeAsync(() => {
      spyOn(component, 'updateClockCenter').and.callThrough();
      spyOn(component, 'updateHandRotations').and.callThrough();
      
      component.open = false;
      component.openClock(); // Open
      tick(); // For setTimeout in openClock
      
      expect(component.open).toBe(true);
      expect(component.updateClockCenter).toHaveBeenCalled();
      expect(component.updateHandRotations).toHaveBeenCalled();
      
      component.openClock(); // Close
      tick();

      expect(component.open).toBe(false);
      // Check that they are not called again on close
      expect(component.updateClockCenter).toHaveBeenCalledTimes(1);
      expect(component.updateHandRotations).toHaveBeenCalledTimes(1); 
    }));
  });
});
