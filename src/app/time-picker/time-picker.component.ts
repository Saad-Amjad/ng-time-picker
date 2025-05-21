import { Component, OnInit, Output, EventEmitter, HostBinding, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';

@Component({
  selector: 'ng-time-picker',
  templateUrl: './time-picker.component.html',
  styleUrls: ['./time-picker.component.css']
})
export class TimePickerComponent implements OnInit, AfterViewInit {

  @Output() notify: EventEmitter<any> = new EventEmitter<any>();
  @ViewChild('clockFace') clockFaceEl: ElementRef<HTMLDivElement>;

  constructor() { }
  hours = [];
  minutes = [];

  selectedTime: any = 'AM';
  selectedHour: number = 12; // Explicitly typed as number
  selectedMinute: string = '00'; // Explicitly typed as string

  open: boolean = false;
  currentTheme: string = 'light';

  // Properties for hand rotation
  hourHandRotation: number = 0;
  minuteHandRotation: number = 0;

  // Properties for dragging
  isDragging: boolean = false;
  draggingHand: 'hour' | 'minute' | null = null;
  clockCenterX: number;
  clockCenterY: number;

  @HostBinding('class.dark-theme') get isDarkTheme() {
    return this.currentTheme === 'dark';
  }

  ngOnInit() {
    const savedTheme = localStorage.getItem('timePickerTheme') || 'light';
    this.setTheme(savedTheme);

    this.initHours(); // Static numbers for display
    this.initMinutes(); // Static numbers/dots for display
    this.updateHandRotations(); // Initial hand positions
  }

  ngAfterViewInit() {
    // Defer calculation to ensure element is rendered and positioned
    setTimeout(() => this.updateClockCenter(), 0);
  }

  updateClockCenter() {
    if (this.clockFaceEl && this.clockFaceEl.nativeElement) {
      const rect = this.clockFaceEl.nativeElement.getBoundingClientRect();
      this.clockCenterX = rect.left + rect.width / 2;
      this.clockCenterY = rect.top + rect.height / 2;
    }
  }

  setTheme(themeName: string) {
    this.currentTheme = themeName;
    localStorage.setItem('timePickerTheme', themeName);
  }

  initHours() {
    this.hours = []; // Clear previous hours
    let degree = 0;
    this.hours.push({ hour: 12, degree: degree + 'deg' });
    degree = 30;
    for (let i = 1; i < 12; i++) {
      this.hours.push({ hour: i, degree: degree + 'deg' });
      degree = degree + 30;
    }
  }

  initMinutes() {
    this.minutes = []; // Clear previous minutes
    let degree = 0;
    // '00' minute (displayed as 00, value can be 0 or 60 for calcs)
    this.minutes.push({ minute: 0, degree: degree + 'deg', display: '00', hide: false }); 
    degree = 6;
    for (let i = 1; i < 60; i++) {
      this.minutes.push({
        minute: i,
        hide: (i % 5 !== 0),
        degree: degree + 'deg',
        display: this.pad(i, 2)
      });
      degree = degree + 6;
    }
  }

  updateHandRotations() {
    const numericHour = Number(this.selectedHour);
    const numericMinute = Number(this.selectedMinute);

    // Calculate minute hand rotation (0-354 degrees)
    this.minuteHandRotation = numericMinute * 6;

    // Calculate hour hand rotation (incorporating minute influence for smooth movement)
    // (numericHour % 12) handles 12 AM/PM correctly for rotation (12 maps to 0 rotation base)
    // Each hour is 30 degrees. Each minute contributes 0.5 degrees to the hour hand.
    this.hourHandRotation = ((numericHour % 12) * 30) + (numericMinute / 60) * 30;
  }

  setHour(hour: number) {
    this.selectedHour = hour;
    this.updateHandRotations();
    this.emitValues();
  }

  setMinute(min: number | string) { // Can be number from calculation or string from click
    // Number(min) will handle both number and string representations of numbers.
    // The drag logic and click logic should provide min in the 0-59 range.
    // Pad function will then format it.
    this.selectedMinute = this.pad(Number(min), 2); 
    this.updateHandRotations();
    this.emitValues();
  }
  
  startDrag(hand: 'hour' | 'minute', event: MouseEvent) {
    event.preventDefault(); // Prevent text selection, etc.
    this.isDragging = true;
    this.draggingHand = hand;
    this.updateClockCenter(); // Recalculate center in case of scroll/resize
    document.body.style.cursor = 'grabbing'; // Change cursor globally
    this.onDrag(event); // Initial update based on mousedown position
  }

  @HostListener('document:mousemove', ['$event'])
  onDrag(event: MouseEvent) {
    if (!this.isDragging || !this.draggingHand) return;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    // Calculate angle in radians, then convert to degrees (0-360, 0 at 3 o'clock)
    let angle = Math.atan2(mouseY - this.clockCenterY, mouseX - this.clockCenterX) * (180 / Math.PI);
    
    // Adjust angle so 0 is at 12 o'clock (top) and increases clockwise
    angle = (angle + 90 + 360) % 360;

    if (this.draggingHand === 'hour') {
      let hour = Math.round(angle / 30);
      if (hour === 0) hour = 12; // 0 degrees should be 12
      
      // For smoother hour changes near the 12/0 boundary when dragging quickly
      // If angle is very close to 0 (e.g., < 15 deg or > 345 deg), snap to 12
      if (angle < 15 || angle > 345) {
        hour = 12;
      } else {
        hour = Math.floor((angle + 15) / 30); // Add 15 deg offset for better snapping to middle of hour segment
        if (hour === 0) hour = 12;
      }
      this.selectedHour = hour;

    } else if (this.draggingHand === 'minute') {
      let minute = Math.round(angle / 6);
      if (minute === 60) minute = 0; // 360 degrees should be 00 minutes
      
      // Snap to nearest 5 minutes if desired, or keep precise
      // For now, keep it precise as per calculation:
      // minute = Math.round(angle / 6);
      // if (minute === 60) minute = 0;
      
      // Snap to nearest minute value
      minute = Math.floor((angle + 3) / 6); // Add 3 deg offset for better snapping
      if (minute >= 60) minute = 0;

      this.selectedMinute = this.pad(minute, 2);
    }
    this.updateHandRotations();
    this.emitValues();
  }

  @HostListener('document:mouseup')
  stopDrag() {
    if(this.isDragging) {
      this.isDragging = false;
      this.draggingHand = null;
      document.body.style.cursor = 'default'; // Reset global cursor
    }
  }

  toggleTime() {
    this.selectedTime = this.selectedTime === 'AM' ? 'PM' : 'AM';
    this.emitValues();
  }

  emitValues() {
    this.notify.emit({
      hour: this.selectedHour, // Ensure this is the number
      minute: this.selectedMinute, // This is the string '00', '05' etc.
      time: this.selectedTime
    });
  }

  openClock() {
    this.open = !this.open;
    if (this.open) {
      // Recalculate center when clock opens, as it might have moved
      // Defer to ensure element is visible and positioned
      setTimeout(() => this.updateClockCenter(), 0);
      this.updateHandRotations(); // Ensure hands are correctly positioned when opening
    }
  }

  resetClock() {
    this.selectedTime = 'AM';
    this.selectedHour = 12;
    this.selectedMinute = '00';
    this.updateHandRotations();
    this.emitValues();
    // this.open = !this.open; // User expectation: reset doesn't close the clock
  }

  pad(num: number, size: number): string {
    let s = String(num);
    while (s.length < size) { s = "0" + s; }
    // No need to check for '60' here if calculations use 0 for the 60th minute.
    // If '60' is passed, it will be '60', but setMinute handles 60 -> 0 conversion before padding.
    return s;
  }
}
