import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the YOCA dashboard heading', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('בוקר טוב, יעל');
  });

  it('submits a join request to the API', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.joinName.set('Tamar Levi');
    app.joinEmail.set('tamar@example.com');

    app.requestAccess();

    const request = httpTesting.expectOne('/api/join-requests');
    expect(request.request.method).toBe('POST');
    request.flush({ status: 'pending' });
    expect(app.joinState()).toBe('sent');
    expect(app.pendingMembers().length).toBe(2);
  });
});
