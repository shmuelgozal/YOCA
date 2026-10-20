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

  afterEach(() => {
    httpTesting
      .match('/api/auth/me')
      .forEach((request) => request.flush({}, { status: 401, statusText: 'Unauthorized' }));
    httpTesting.match('/api/auth/logout').forEach((request) => request.flush({ status: 'ok' }));
    httpTesting.match('/api/classes').forEach((request) => request.flush([]));
    httpTesting.match('/api/studio/finance').forEach((request) =>
      request.flush({
        singleClassPrice: 75,
        packages: [],
        members: [],
        discounts: [],
        payments: [],
      }),
    );
    httpTesting.match('/api/member/finance').forEach((request) =>
      request.flush({
        singleClassPrice: 75,
        packages: [],
        balance: { purchasedSessions: 0, usedSessions: 0, attendance: 0, points: 0 },
        payments: [],
      }),
    );
    httpTesting.match('/api/member/workouts').forEach((request) => request.flush([]));
    httpTesting.match('/api/studio/announcements').forEach((request) => request.flush([]));
    httpTesting.match('/api/studio/social-post').forEach((request) => request.flush(null));
    httpTesting
      .match(
        (request) =>
          request.url.startsWith('/api/studio/members/') && request.url.endsWith('/workouts'),
      )
      .forEach((request) => request.flush([]));
    httpTesting
      .match((request) => request.url.endsWith('/feedback'))
      .forEach((request) => request.flush({}));
    httpTesting.verify();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the trainee home and member navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.enterDemo();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('היי נועה');
    expect(compiled.querySelector('.app-footer')?.textContent).toContain('שליטה היא הכוח האמיתי.');
    expect(compiled.querySelector('.latest-coach-post')).toBeTruthy();
    expect(compiled.querySelector('.member-updates')).toBeTruthy();
    expect(compiled.querySelector('.instagram-embed-wrap')?.getAttribute('dir')).toBe('ltr');
    expect(compiled.querySelector('.instagram-embed')?.getAttribute('dir')).toBe('ltr');
    expect(compiled.querySelector('.coach-social-post a[href*="instagram.com"]')).toBeNull();
    expect(compiled.querySelector('.coach-post-explanations')).toBeNull();
    const navTabs = Array.from(compiled.querySelectorAll('.main-nav .nav-tab')).map((tab) =>
      tab.textContent?.trim(),
    );
    expect(navTabs).toEqual(['בית', 'אימונים', 'מחירון', 'עדכונים', 'ההתקדמות שלי']);
  });

  it('shows the weekly post and updates only on the trainee home', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();

    app.activeTab.set('workouts');
    fixture.detectChanges();
    let page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.latest-coach-post')).toBeNull();
    expect(page.querySelector('.member-updates')).toBeNull();

    app.role.set('admin');
    app.activeTab.set('overview');
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.latest-coach-post')).toBeNull();
    expect(page.querySelector('.member-updates')).toBeNull();

    app.activeTab.set('content');
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.latest-coach-post')).toBeNull();
    expect(page.querySelector('.member-updates')).toBeNull();
  });

  it('offers the coach Instagram post embed on member home', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const post = app.latestCoachPost();
    expect(post).not.toBeNull();
    expect(post!.permalink).toContain('/p/DejHXnmDiYr/');
    expect(post!.embedUrl).toBe('https://www.instagram.com/p/DejHXnmDiYr/embed/?hl=en&img_index=6');
    expect(app.latestCoachPostEmbedUrl()).toBeTruthy();
  });

  it('publishes a coach post to member home and rejects non-Instagram URLs', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.enterDemo();
    app.coachPostTitle.set('תרגול יוגה חדש');
    app.coachPostUrl.set('https://www.instagram.com/reel/AbC_123/?utm_source=profile');
    app.coachPostExplanations.set('הכנה לתנוחה\n\nנשימה יציבה');
    app.publishCoachPost();

    const post = app.latestCoachPost();
    expect(post).not.toBeNull();
    expect(post!.title).toBe('תרגול יוגה חדש');
    expect(post!.permalink).toContain('/reel/AbC_123/');
    expect(post!.embedUrl).toBe('https://www.instagram.com/reel/AbC_123/embed/?hl=en');
    expect(post!.explanations).toEqual(['הכנה לתנוחה', 'נשימה יציבה']);
    app.coachPostUrl.set('https://example.com/video');
    app.publishCoachPost();
    expect(app.latestCoachPost()!.title).toBe('תרגול יוגה חדש');
  });

  it('keeps package balance and announcements on their dedicated pages', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.activeTab.set('progress');
    fixture.detectChanges();
    let page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.personal-hero')).toBeTruthy();
    expect(page.querySelector('.member-progress-grid')).toBeTruthy();
    expect(
      Array.from(page.querySelectorAll('.member-progress-grid > article')).map((article) =>
        ['personal-hero', 'streak-panel', 'workout-history-list'].find((cardClass) =>
          article.classList.contains(cardClass),
        ),
      ),
    ).toEqual(['personal-hero', 'streak-panel', 'workout-history-list']);
    expect(page.querySelector('.workout-history-detail')).toBeNull();
    expect(page.querySelector('.workout-details-modal')).toBeNull();
    expect(page.querySelector('.personal-classes')).toBeNull();
    expect(page.querySelector('.package-panel')).toBeNull();
    expect(page.querySelector('.personal-board')).toBeNull();
    expect(page.textContent).not.toContain('הודעות אחרונות');
    expect(page.querySelector('#workout-feedback-form')).toBeNull();

    app.activeTab.set('member-pricing');
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.member-package-summary')).toBeTruthy();

    app.activeTab.set('updates');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.member-feed')).toBeTruthy();
  });

  it('opens workout details in a modal and marks the workout read', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.activeTab.set('progress');
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(app.unreadWorkoutHistoryCount()).toBe(3);
    expect(page.querySelectorAll('.unread-workout-badge').length).toBe(3);
    (page.querySelector('.history-item') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page.querySelector('.workout-details-modal')?.getAttribute('role')).toBe('dialog');
    expect(app.readWorkoutHistoryIds()).toContain(1);
    expect(app.unreadWorkoutHistoryCount()).toBe(2);
    expect(page.querySelectorAll('.unread-workout-badge').length).toBe(2);

    const feedbackAction = page.querySelector('.history-feedback-action') as HTMLButtonElement;
    expect(feedbackAction.tagName).toBe('BUTTON');
    feedbackAction.click();
    fixture.detectChanges();
    expect(app.workoutFeedbackModalOpen()).toBeTrue();

    app.closeWorkoutFeedbackOnEscape();
    fixture.detectChanges();
    expect(app.workoutFeedbackModalOpen()).toBeFalse();
    expect(page.querySelector('.workout-details-modal')).toBeTruthy();

    app.closeWorkoutFeedbackOnEscape();
    fixture.detectChanges();
    expect(page.querySelector('.workout-details-modal')).toBeNull();
  });

  it('switches between separate member and admin navigation', () => {
    const app = TestBed.createComponent(App).componentInstance;
    expect(app.activeTab()).toBe('home');
    app.switchRole('admin');
    expect(app.activeTab()).toBe('overview');
    expect(app.visibleNavItems().some((item) => item.id === 'pricing')).toBeTrue();
    expect(app.visibleNavItems().some((item) => item.id === 'payments')).toBeFalse();
    httpTesting.expectOne('/api/join-requests').flush([]);
    app.switchRole('member');
    expect(app.visibleNavItems().map((item) => item.id)).toEqual([
      'home',
      'workouts',
      'member-pricing',
      'updates',
      'progress',
    ]);
  });

  it('offers logout, not an admin switch, in the trainee profile menu', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.profileMenuOpen.set(true);
    fixture.detectChanges();
    const menuText =
      (fixture.nativeElement as HTMLElement).querySelector('.profile-menu')?.textContent ?? '';
    expect(menuText).toContain('התנתקות');
    expect(menuText).not.toContain('מעבר לתצוגת מנהל');
  });

  it('allows the coach to edit personal details without changing a trainee profile', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.profileMenuOpen.set(true);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.profile-menu')?.textContent).toContain('פרטים אישיים');
    (
      Array.from(page.querySelectorAll('.profile-menu button')).find((button) =>
        button.textContent?.includes('פרטים אישיים'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(page.querySelector('h1')?.textContent).toContain('פרטים אישיים');
    expect((page.querySelector('#member-name') as HTMLInputElement).value).toBe('אלכסיי יוצקוביץ');

    app.updateProfileName('איתן נבון');
    app.updateProfileEmail('eitan.n@example.com');
    app.updateProfilePhone('050-111-2233');
    app.updateProfileBirthDate('1987-02-11');
    app.updateProfileAddress('neutral');
    app.saveMemberDetails();

    expect(app.coachName()).toBe('איתן נבון');
    expect(app.coachEmail()).toBe('eitan.n@example.com');
    expect(app.coachPhone()).toBe('050-111-2233');
    expect(app.coachBirthDate()).toBe('1987-02-11');
    expect(app.coachAddress()).toBe('neutral');
    expect(app.members().find((member) => member.id === 2)?.name).toBe('נועה כהן');
    expect(app.memberEmail()).toBe('noa.cohen@example.com');
  });

  it('opens a member dossier with only that member history and pain reports', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.activeTab.set('members');
    const extraWorkouts = Array.from({ length: 7 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      const name = index % 2 === 0 ? 'פילאטיס מזרן' : 'יוגה זורמת';
      return {
        id: 100 + index,
        memberId: 2,
        name,
        workout: `${name} · ${day}.09`,
        date: `${day} בספטמבר 2026`,
        dateIso: `2026-09-${day}`,
        time: '18:00',
        coach: 'אלכסיי יוצקוביץ',
        durationMinutes: 50,
        coachFeedback: 'משוב לדוגמה',
      };
    });
    app.workoutHistory.update((history) => [...history, ...extraWorkouts]);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('[aria-label="פתיחת תיק נועה כהן"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('[role="dialog"]')).toBeTruthy();
    expect(app.selectedCoachMember()?.name).toBe('נועה כהן');
    expect(app.memberAge(app.selectedCoachMember()!)).toBe(32);
    expect(app.memberTrainingTenure(app.selectedCoachMember()!)).toContain('2 שנים');
    expect(app.selectedCoachMemberAllWorkouts().length).toBe(10);
    expect(app.selectedCoachMemberWorkouts().length).toBe(5);
    app.toggleMemberHistoryExpanded();
    expect(app.selectedCoachMemberWorkouts().length).toBe(10);
    app.memberHistoryTypeFilter.set('פילאטיס מזרן');
    app.memberHistoryFromDate.set('2026-09-04');
    app.memberHistoryToDate.set('2026-09-06');
    expect(app.filteredCoachMemberWorkouts().length).toBe(1);
    expect(app.filteredCoachMemberWorkouts()[0].dateIso).toBe('2026-09-05');
    app.toggleMemberHistoryExpanded();
    expect(app.memberHistoryTypeFilter()).toBe('all');
    expect(app.selectedCoachMemberWorkouts().length).toBe(5);
    app.openCoachWorkoutFeedback(2, 1);
    app.coachFeedbackDraft.set('לשמור על נשימה יציבה');
    app.saveCoachWorkoutFeedback(2, 1);
    expect(
      app.workoutHistory().find((workout) => workout.memberId === 2 && workout.id === 1)
        ?.coachFeedback,
    ).toBe('לשמור על נשימה יציבה');

    app.personalFeedback.set([
      {
        id: 1,
        memberId: 3,
        workout: 'פילאטיס מזרן · 15.10',
        rating: 3,
        painAreas: ['ברך שמאל'],
        painIntensity: 'strong',
        note: 'כאב בסוף האימון',
        savedAt: 'היום',
      },
    ]);
    app.openMemberDetails(3);
    expect(app.selectedCoachMemberWorkouts().length).toBe(2);
    expect(app.selectedCoachMemberPainAreas()).toEqual([{ area: 'ברך שמאל', count: 1 }]);
    expect(app.selectedCoachMemberPainAnalysis()).toContain('העוצמה המרבית שדווחה: חזק');

    app.openMemberDetails(2);
    expect(app.selectedCoachMemberPainReports()).toEqual([]);
    expect(app.selectedCoachMemberWorkouts().every((workout) => workout.memberId === 2)).toBeTrue();
    expect(app.memberDetailsOpen()).toBeTrue();
    app.closeWorkoutFeedbackOnEscape();
    expect(app.memberDetailsOpen()).toBeFalse();
  });

  it('saves coach feedback from the selected workout in a member dossier', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.activeTab.set('members');
    fixture.detectChanges();
    app.openMemberDetails(2);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.member-coach-feedback-action') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector(
      '.coach-feedback-editor textarea',
    ) as HTMLTextAreaElement;
    editor.value = 'להתמקד ביציבות';
    editor.dispatchEvent(new Event('input'));
    (
      fixture.nativeElement.querySelector(
        '.coach-feedback-editor .button-dark',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(
      app.workoutHistory().find((workout) => workout.memberId === 2 && workout.id === 1)
        ?.coachFeedback,
    ).toBe('להתמקד ביציבות');
    expect(fixture.nativeElement.querySelector('.coach-feedback-editor')).toBeNull();
  });

  it('shows a removal confirmation before deleting a trainee from the roster', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.activeTab.set('members');
    app.removeMember(2);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelectorAll('.member-remove-modal').length).toBe(1);
    expect(page.textContent).toContain('הכרטיס, ההיסטוריה והרישומים של נועה כהן יוסרו מהדמו.');
    (page.querySelector('.member-remove-modal .button-outline') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(app.members().some((member) => member.id === 2)).toBeTrue();

    app.removeMember(2);
    fixture.detectChanges();
    (page.querySelector('.member-remove-modal .button-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(app.members().some((member) => member.id === 2)).toBeFalse();
  });

  it('starts on login and shows access-request modes after sign-out', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    expect(app.isAuthenticated()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('#login-email')).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('מתאמן');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('מאמן');
    app.signOut();
    expect(app.isAuthenticated()).toBeFalse();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#login-email')).toBeTruthy();

    app.setAuthMode('request');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#auth-join-name')).toBeTruthy();

    app.setAuthMode('login');
    app.loginEmail.set('noa@example.com');
    app.loginPassword.set('demo-password');
    app.submitLogin();
    httpTesting.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(app.isAuthenticated()).toBeFalse();
    expect(app.loginMessage()).toContain('שם המשתמש או הסיסמה');

    app.enterDemo();
    expect(app.isAuthenticated()).toBeTrue();
    expect(app.role()).toBe('member');
    app.signOut();
    app.enterCoachDemo();
    expect(app.isAuthenticated()).toBeTrue();
    expect(app.role()).toBe('admin');
    expect(app.activeTab()).toBe('overview');
  });

  it('approves a member request and stores an activation link', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.approveMember(1);

    const approval = httpTesting.expectOne('/api/join-requests/request-demo-tamar/approve');
    expect(approval.request.method).toBe('PATCH');
    approval.flush({ invitationToken: 'one-time-token' });

    expect(app.members()[0].status).toBe('approved');
    expect(app.members()[0].invitationUrl).toContain('?invite=one-time-token');
  });

  it('activates an approved account and logs in with the created username', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.invitationToken.set('one-time-token');
    app.activationEmail.set('tamar.levy@example.com');
    app.activationUsername.set('tamar.levy');
    app.activationPassword.set('secure-password-123');
    app.activationPasswordConfirm.set('secure-password-123');
    app.submitActivation();

    const activation = httpTesting.expectOne('/api/auth/activate');
    expect(activation.request.method).toBe('POST');
    activation.flush({
      id: 'request-demo-tamar',
      name: 'תמר לוי',
      email: 'tamar.levy@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
    });
    expect(app.isAuthenticated()).toBeTrue();
    expect(app.currentMember()?.name).toBe('תמר לוי');
    expect(app.currentMemberFirstName()).toBe('תמר');
    expect(app.memberName()).toBe('תמר לוי');

    app.signOut();
    app.loginEmail.set('tamar.levy');
    app.loginPassword.set('secure-password-123');
    app.submitLogin();
    const login = httpTesting.expectOne('/api/auth/login');
    expect(login.request.body.identifier).toBe('tamar.levy');
    login.flush({
      id: 'request-demo-tamar',
      name: 'תמר לוי',
      email: 'tamar.levy@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
    });
    expect(app.isAuthenticated()).toBeTrue();
    expect(app.currentMember()?.name).toBe('תמר לוי');
  });

  it('loads the persisted schedule and sends reservation changes to the API', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.loginEmail.set('tamar.levy');
    app.loginPassword.set('secure-password-123');
    app.submitLogin();
    httpTesting.expectOne('/api/auth/login').flush({
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'תמר לוי',
      email: 'tamar.levy@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
    });

    const classId = 'a1aa0000-0000-4000-8000-000000000003';
    const classes = httpTesting.expectOne('/api/classes');
    expect(classes.request.method).toBe('GET');
    classes.flush([
      {
        id: classId,
        dateIso: '2026-11-01',
        time: '18:00',
        name: 'יוגה זורמת',
        coach: 'YOCA Coach',
        location: 'סטודיו ראשי',
        capacity: 12,
        booked: 0,
        reserved: false,
        attendees: [],
      },
    ]);
    expect(app.classes()[0].id).toBe(classId);

    app.reserveClass(classId);
    httpTesting
      .expectOne({
        method: 'POST',
        url: `/api/classes/${classId}/reservations`,
      })
      .flush({ id: classId, status: 'reserved' });

    httpTesting.expectOne('/api/classes').flush([
      {
        id: classId,
        dateIso: '2026-11-01',
        time: '18:00',
        name: 'יוגה זורמת',
        coach: 'YOCA Coach',
        location: 'סטודיו ראשי',
        capacity: 12,
        booked: 1,
        reserved: true,
        attendees: [],
      },
    ]);
    expect(app.classes()[0].reserved).toBeTrue();

    app.cancelReservation(classId);
    httpTesting
      .expectOne({
        method: 'DELETE',
        url: `/api/classes/${classId}/reservations`,
      })
      .flush({ id: classId, status: 'cancelled' });
    httpTesting.expectOne('/api/classes').flush([
      {
        id: classId,
        dateIso: '2026-11-01',
        time: '18:00',
        name: 'יוגה זורמת',
        coach: 'YOCA Coach',
        location: 'סטודיו ראשי',
        capacity: 12,
        booked: 0,
        reserved: false,
        attendees: [],
      },
    ]);
    expect(app.classes()[0].reserved).toBeFalse();
  });

  it('loads persisted workout history and saves personal feedback through the API', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.loginEmail.set('tamar.levy');
    app.loginPassword.set('secure-password-123');
    app.submitLogin();
    httpTesting.expectOne('/api/auth/login').flush({
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'תמר לוי',
      email: 'tamar.levy@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
    });
    httpTesting.expectOne('/api/classes').flush([]);
    httpTesting.expectOne('/api/member/finance').flush({
      singleClassPrice: 75,
      packages: [],
      balance: { purchasedSessions: 0, usedSessions: 0, attendance: 0, points: 0 },
      payments: [],
    });
    httpTesting.expectOne('/api/studio/announcements').flush([]);

    const workoutId = 'a1aa0000-0000-4000-8000-000000000003';
    const history = httpTesting.expectOne('/api/member/workouts');
    history.flush([
      {
        classId: workoutId,
        memberId: 'a1aa0000-0000-4000-8000-000000000002',
        memberName: 'תמר לוי',
        name: 'יוגה זורמת',
        dateIso: '2026-10-15',
        time: '18:00',
        coach: 'YOCA Coach',
        attendedAt: '2026-10-15T16:00:00.000Z',
        coachFeedback: 'נשימה טובה',
        personalFeedback: null,
      },
    ]);

    const workout = app.currentMemberWorkoutHistory()[0];
    expect(workout.classId).toBe(workoutId);
    expect(workout.coachFeedback).toBe('נשימה טובה');
    app.openWorkoutFeedback(workout.workout);
    app.feedbackRating.set(4);
    app.feedbackNote.set('הרגשתי טוב');
    app.savePersonalWorkoutFeedback();
    const feedbackRequest = httpTesting.expectOne(`/api/member/workouts/${workoutId}/feedback`);
    expect(feedbackRequest.request.body).toEqual({
      rating: 4,
      painAreas: [],
      painIntensity: null,
      note: 'הרגשתי טוב',
    });
    feedbackRequest.flush({ classId: workoutId });
    expect(app.selectedWorkoutFeedback()?.note).toBe('הרגשתי טוב');
  });

  it('loads and saves the authenticated member profile and preferences', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.loginEmail.set('tamar.levy');
    app.loginPassword.set('secure-password-123');
    app.submitLogin();
    httpTesting.expectOne('/api/auth/login').flush({
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'תמר לוי',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
      phone: '050-111-2233',
      birthDate: '1994-06-18',
      address: 'feminine',
      reminderEnabled: true,
      reminderLeadMinutes: 60,
      updatesEnabled: true,
    });
    httpTesting.expectOne('/api/classes').flush([]);

    expect(app.memberPhone()).toBe('050-111-2233');
    expect(app.memberBirthDate()).toBe('1994-06-18');
    expect(app.memberAddress()).toBe('feminine');
    app.updateProfileName('תמר לוי-כהן');
    app.updateProfilePhone('050-123-4567');
    app.updateProfileAddress('neutral');
    app.saveMemberDetails();
    const profileUpdate = httpTesting.expectOne('/api/auth/profile');
    expect(profileUpdate.request.method).toBe('PATCH');
    expect(profileUpdate.request.body).toEqual(
      jasmine.objectContaining({
        name: 'תמר לוי-כהן',
        phone: '050-123-4567',
        address: 'neutral',
      }),
    );
    profileUpdate.flush({
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'תמר לוי-כהן',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'neutral',
      reminderEnabled: true,
      reminderLeadMinutes: 60,
      updatesEnabled: true,
    });
    expect(app.currentMember()?.name).toBe('תמר לוי-כהן');
    expect(app.currentMember()?.phone).toBe('050-123-4567');
    expect(app.currentMember()?.address).toBe('neutral');

    app.reminderLeadMinutes.set(30);
    app.updatesEnabled.set(false);
    app.saveMemberPreferences();
    const preferenceUpdate = httpTesting.expectOne('/api/auth/profile');
    expect(preferenceUpdate.request.body).toEqual(
      jasmine.objectContaining({
        reminderLeadMinutes: 30,
        updatesEnabled: false,
      }),
    );
    preferenceUpdate.flush({
      id: 'a1aa0000-0000-4000-8000-000000000002',
      name: 'תמר לוי-כהן',
      email: 'tamar@example.com',
      username: 'tamar.levy',
      status: 'active',
      role: 'member',
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'neutral',
      reminderEnabled: true,
      reminderLeadMinutes: 30,
      updatesEnabled: false,
    });
    expect(app.reminderLeadMinutes()).toBe(30);
    expect(app.updatesEnabled()).toBeFalse();
  });

  it('loads coach finance data and records a payment through the API', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.loginEmail.set('coach');
    app.loginPassword.set('secure-password-123');
    app.submitLogin();
    httpTesting.expectOne('/api/auth/login').flush({
      id: 'a1aa0000-0000-4000-8000-000000000001',
      name: 'YOCA Coach',
      email: 'coach@example.com',
      username: 'coach',
      status: 'active',
      role: 'coach',
    });
    httpTesting.expectOne('/api/join-requests').flush([]);
    httpTesting.expectOne('/api/classes').flush([]);
    const packageId = 'a1aa0000-0000-4000-8000-000000000003';
    const memberId = 'a1aa0000-0000-4000-8000-000000000002';
    httpTesting.expectOne('/api/studio/finance').flush({
      singleClassPrice: 80,
      packages: [{ id: packageId, name: 'חבילת 10 אימונים', sessions: 10, price: 650 }],
      members: [
        {
          id: memberId,
          name: 'תמר לוי',
          email: 'tamar@example.com',
          username: 'tamar.levy',
          phone: null,
          birthDate: null,
          address: null,
          joined: '2026-10-01T12:00:00.000Z',
          status: 'active',
          purchasedSessions: 0,
          usedSessions: 0,
          attendance: 0,
          points: 0,
        },
      ],
      discounts: [],
      payments: [],
    });
    expect(app.singleClassPrice()).toBe(80);
    expect(app.trainingPackages()[0].id).toBe(packageId);
    const member = app.activeMembers()[0];
    expect(member.authId).toBe(memberId);
    app.discountMemberId.set(member.id);
    app.discountKind.set('percent');
    app.discountValue.set('10');
    app.applyMemberDiscount();
    const discount = httpTesting.expectOne(`/api/studio/members/${memberId}/discount`);
    expect(discount.request.method).toBe('PUT');
    expect(discount.request.body).toEqual({
      kind: 'percent',
      value: 10,
      note: '',
    });
    discount.flush({ memberId, kind: 'percent', value: 10, note: '' });
    httpTesting.expectOne('/api/studio/finance').flush({
      singleClassPrice: 80,
      packages: [{ id: packageId, name: 'חבילת 10 אימונים', sessions: 10, price: 650 }],
      members: [
        {
          id: memberId,
          name: 'תמר לוי',
          email: 'tamar@example.com',
          username: 'tamar.levy',
          phone: null,
          birthDate: null,
          address: null,
          joined: '2026-10-01T12:00:00.000Z',
          status: 'active',
          purchasedSessions: 0,
          usedSessions: 0,
          attendance: 0,
          points: 0,
        },
      ],
      discounts: [{ memberId, kind: 'percent', value: 10, note: '' }],
      payments: [],
    });

    app.paymentMemberId.set(member.id);
    app.paymentPackageId.set(packageId);
    app.paymentPackageCount.set('2');
    app.paymentMethod.set('bit');
    app.recordMemberPayment();
    const payment = httpTesting.expectOne('/api/studio/payments');
    expect(payment.request.body).toEqual({
      memberId,
      packageId,
      packageCount: 2,
      method: 'bit',
    });
    payment.flush({ id: 'payment-id', sessions: 20, paidAmount: 1170 });
    expect(app.paymentSaving()).toBeFalse();
    expect(app.paymentPackageCount()).toBe('1');
    httpTesting.expectOne('/api/studio/finance').flush({
      singleClassPrice: 80,
      packages: [{ id: packageId, name: 'חבילת 10 אימונים', sessions: 10, price: 650 }],
      members: [
        {
          id: memberId,
          name: 'תמר לוי',
          email: 'tamar@example.com',
          username: 'tamar.levy',
          phone: null,
          birthDate: null,
          address: null,
          joined: '2026-10-01T12:00:00.000Z',
          status: 'active',
          purchasedSessions: 20,
          usedSessions: 0,
          attendance: 0,
          points: 0,
        },
      ],
      discounts: [{ memberId, kind: 'percent', value: 10, note: '' }],
      payments: [],
    });
    expect(app.currentMember()).toBeUndefined();
    expect(app.activeMembers().find((item) => item.authId === memberId)?.purchasedSessions).toBe(
      20,
    );
  });

  it('opens member profile sections from the name menu', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.profileMenuOpen.set(true);
    app.selectTab('member-settings');
    expect(app.activeTab()).toBe('member-settings');
    expect(app.profileMenuOpen()).toBeFalse();
  });

  it('lets members choose a reminder lead time with a one-hour default', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.selectTab('member-settings');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const reminderSelect = compiled.querySelector('#reminder-lead-time') as HTMLSelectElement;

    expect(reminderSelect.value).toBe('60');
    expect(app.reminderLeadLabel()).toBe('שעה');
    reminderSelect.value = '30';
    reminderSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(app.reminderLeadMinutes()).toBe(30);
    expect(app.reminderLeadLabel()).toBe('30 דקות');

    app.selectTab('home');
    fixture.detectChanges();
    expect(compiled.querySelector('.reminder-strip')?.textContent).toContain('30 דקות לפני האימון');
  });

  it('filters the member roster through the search field', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.selectTab('members');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(app.role()).toBe('admin');
    expect(app.activeTab()).toBe('members');
    expect(compiled.querySelector('h1')?.textContent).toContain('המתאמנים שלנו');
    const search = compiled.querySelector('#member-search') as HTMLInputElement;
    expect(search)
      .withContext(
        Array.from(compiled.querySelectorAll('input'))
          .map((input) => `${input.id}:${input.type}`)
          .join(', '),
      )
      .not.toBeNull();

    search.value = 'noa.cohen@example.com';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.member-table .table-row').length).toBe(1);
    expect(compiled.querySelector('.member-table')?.textContent).toContain('נועה כהן');

    search.value = 'not-found';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(compiled.querySelectorAll('.member-table .table-row').length).toBe(0);
    expect(compiled.querySelector('.empty-state')?.textContent).toContain('לא נמצאו מתאמנים');
  });

  it('uses the coach demo name for seeded sessions and workout history', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    expect(app.coachName()).toBe('אלכסיי יוצקוביץ');
    expect(app.classes()[0].coach).toBe('אלכסיי יוצקוביץ');
    expect(app.workoutHistory()[0].coach).toBe('אלכסיי יוצקוביץ');
    app.enterCoachDemo();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'בוקר טוב, אלכסיי',
    );
  });

  it('filters members by name, email, and phone', () => {
    const app = TestBed.createComponent(App).componentInstance;

    app.memberSearch.set('מיה');
    expect(app.filteredMembers().map((member) => member.name)).toEqual(['מיה אברהם']);
    app.memberSearch.set('noa.cohen@example.com');
    expect(app.filteredMembers().map((member) => member.name)).toEqual(['נועה כהן']);
    app.memberSearch.set('050-123-4567');
    expect(app.filteredMembers().map((member) => member.name)).toEqual(['נועה כהן']);
    app.memberSearch.set('not-found');
    expect(app.filteredMembers()).toEqual([]);
  });

  it('uses the demo member form of address and follows changes', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.selectTab('member-profile');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(app.memberAddress()).toBe('feminine');
    expect(compiled.querySelector('.profile-form-panel .eyebrow')?.textContent).toContain(
      'פרטי מתאמנת',
    );

    const feminine = Array.from(compiled.querySelectorAll('.gender-option')).find(
      (option) => option.textContent?.trim() === 'אישה',
    ) as HTMLButtonElement;
    feminine.click();
    fixture.detectChanges();
    expect(app.profileText('memberSettingsIntro')).toBe('בחרי אילו עדכונים ותזכורות לקבל.');
    expect(compiled.querySelector('.profile-form-panel .eyebrow')?.textContent).toContain(
      'פרטי מתאמנת',
    );

    const masculine = Array.from(compiled.querySelectorAll('.gender-option')).find(
      (option) => option.textContent?.trim() === 'גבר',
    ) as HTMLButtonElement;
    masculine.click();
    fixture.detectChanges();
    expect(app.profileText('memberSettingsIntro')).toBe('בחר אילו עדכונים ותזכורות לקבל.');

    const neutral = Array.from(compiled.querySelectorAll('.gender-option')).find(
      (option) => option.textContent?.trim() === 'ניטרלי',
    ) as HTMLButtonElement;
    neutral.click();
    fixture.detectChanges();
    expect(app.profileText('memberSettingsIntro')).toBe('בחירת עדכונים ותזכורות.');

    app.switchRole('admin');
    app.selectTab('member-profile');
    fixture.detectChanges();
    expect(compiled.querySelector('.profile-form-panel .eyebrow')?.textContent).toContain(
      'פרטי מאמן',
    );
    expect(app.profileText('coachProfileDescription')).toBe('הפרטים האישיים של המאמן.');
    const coachWoman = Array.from(compiled.querySelectorAll('.gender-option')).find(
      (option) => option.textContent?.trim() === 'אישה',
    ) as HTMLButtonElement;
    coachWoman.click();
    fixture.detectChanges();
    expect(compiled.querySelector('.page-heading .eyebrow')?.textContent).toContain('אזור המאמנת');
    expect(compiled.querySelector('.profile-form-panel .eyebrow')?.textContent).toContain(
      'פרטי מאמנת',
    );
    expect(app.profileText('coachProfileDescription')).toBe('הפרטים האישיים של המאמנת.');
  });

  it('uses masculine singular copy on generic authentication screens', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.signOut();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.auth-story h1')?.textContent).toContain('חזור לתנועה');
    app.setAuthMode('request');
    fixture.detectChanges();
    expect(compiled.querySelector('.auth-story h1')?.textContent).toContain('הצטרף ל־YOCA');
    expect(compiled.querySelector('.auth-panel .eyebrow')?.textContent).toContain('הצטרף לסטודיו');
  });

  it('allows a trainee to cancel and rebook a workout', () => {
    const app = TestBed.createComponent(App).componentInstance;
    expect(app.nextWorkout()?.id).toBe(1);
    app.cancelReservation(1);
    expect(app.nextWorkout()).toBeUndefined();
    expect(app.classes()[0].booked).toBe(8);
    app.reserveClass(2);
    expect(app.classes()[1].reserved).toBeTrue();
  });

  it('requires confirmation before removing a member and cleans member records after confirmation', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.removeMember(2);
    expect(app.members().some((member) => member.id === 2)).toBeTrue();
    expect(app.memberPendingRemoval()?.name).toBe('נועה כהן');
    app.cancelMemberRemoval();
    expect(app.members().some((member) => member.id === 2)).toBeTrue();

    app.removeMember(2);
    app.confirmMemberRemoval();
    expect(app.members().some((member) => member.id === 2)).toBeFalse();
    expect(app.memberPayments().some((payment) => payment.memberId === 2)).toBeFalse();
  });

  it('creates, edits, and confirms cancellation of classes without losing reservations', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const firstClassCapacity = app.classes()[0].capacity;
    app.openEditClassForm(1);
    app.classCapacityDraft.set('8');
    app.saveClass();
    expect(app.classes()[0].capacity).toBe(firstClassCapacity);

    const bookedBefore = app.classPlacesBooked();
    const capacityBefore = app.classPlacesTotal();
    app.openCreateClassForm();
    app.classNameDraft.set('יוגה מתקדמת');
    app.classDateDraft.set('2026-11-02');
    app.classTimeDraft.set('19:30');
    app.classCoachDraft.set('אלכסיי יוצקוביץ');
    app.classLocationDraft.set('חצר חיצונית');
    app.classCapacityDraft.set('10');
    app.saveClass();

    const createdClass = app.classes().find((session) => session.name === 'יוגה מתקדמת');
    expect(createdClass?.dateIso).toBe('2026-11-02');
    expect(createdClass?.location).toBe('חצר חיצונית');
    expect(app.classPlacesBooked()).toBe(bookedBefore);
    expect(app.classPlacesTotal()).toBe(capacityBefore + 10);
    app.reserveClass(createdClass!.id);
    expect(app.classPlacesBooked()).toBe(bookedBefore + 1);

    app.openEditClassForm(createdClass!.id);
    app.classNameDraft.set('יוגה מתקדמת · ערב');
    app.classLocationDraft.set('סטודיו גג');
    app.classCapacityDraft.set('12');
    app.saveClass();
    const editedClass = app.classes().find((session) => session.id === createdClass!.id);
    expect(editedClass?.name).toBe('יוגה מתקדמת · ערב');
    expect(editedClass?.location).toBe('סטודיו גג');
    expect(editedClass?.booked).toBe(1);
    expect(editedClass?.reserved).toBeTrue();

    app.requestCancelClass(createdClass!.id);
    expect(app.classes().some((session) => session.id === createdClass!.id)).toBeTrue();
    app.cancelClassCancellation();
    expect(app.classes().some((session) => session.id === createdClass!.id)).toBeTrue();
    app.requestCancelClass(createdClass!.id);
    app.cancelClass(createdClass!.id);
    expect(app.classes().some((session) => session.id === createdClass!.id)).toBeFalse();
    expect(app.classPlacesBooked()).toBe(bookedBefore);
    expect(app.classPlacesTotal()).toBe(capacityBefore);
  });

  it('marks attendance from the class row and adds that class to the trainee history', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterCoachDemo();
    app.activeTab.set('schedule');
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    (page.querySelector('.schedule-row .schedule-actions .button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page.querySelector('[role="dialog"] h2')?.textContent).toContain('יוגה זורמת');
    const noaRow = Array.from(page.querySelectorAll('.attendance-member')).find((row) =>
      row.textContent?.includes('נועה כהן'),
    ) as HTMLElement;
    (noaRow.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(app.classes()[0].attendedMemberIds).toEqual([2]);
    expect(app.members().find((member) => member.id === 2)?.attendance).toBe(19);
    expect(app.remainingSessions(2)).toBe(5);
    expect(
      app.currentMemberWorkoutHistory().some((workout) => workout.workout === 'יוגה זורמת · 16.10'),
    ).toBeTrue();
    expect(noaRow.textContent).toContain('נוכחות סומנה');
  });

  it('manages class price, packages, and member-specific discounts', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.classPriceDraft.set('90');
    app.saveSingleClassPrice();
    expect(app.singleClassPrice()).toBe(90);

    app.newPackageName.set('חבילת ניסיון');
    app.newPackageSessions.set('3');
    app.newPackagePrice.set('210');
    app.addTrainingPackage();
    expect(app.trainingPackages().length).toBe(4);
    expect(app.trainingPackages()[3].price).toBe(210);

    app.discountMemberId.set(3);
    app.discountKind.set('percent');
    app.discountValue.set('15');
    app.discountNote.set('חבר מביא חבר');
    app.applyMemberDiscount();
    expect(app.memberDiscounts().length).toBe(1);
    expect(app.discountsWithMembers()[0].member?.name).toBe('מיה אברהם');

    app.discountKind.set('amount');
    app.discountValue.set('25');
    app.applyMemberDiscount();
    expect(app.memberDiscounts().length).toBe(1);
    expect(app.memberDiscounts()[0].kind).toBe('amount');
    app.removeMemberDiscount(3);
    expect(app.memberDiscounts().length).toBe(0);
  });

  it('records manual package payments, applies private discounts, and tracks used sessions', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.discountMemberId.set(2);
    app.discountKind.set('percent');
    app.discountValue.set('10');
    app.applyMemberDiscount();
    app.paymentPackageId.set(1);
    app.paymentPackageCount.set('2');
    app.paymentMethod.set('cash');

    app.recordMemberPayment();

    expect(app.members().find((member) => member.id === 2)?.purchasedSessions).toBe(20);
    expect(app.remainingSessions(2)).toBe(16);
    expect(app.memberPayments()[0].grossAmount).toBe(700);
    expect(app.memberPayments()[0].discountAmount).toBe(70);
    expect(app.memberPayments()[0].paidAmount).toBe(630);
    expect(app.memberPayments()[0].method).toBe('cash');
    expect(app.recordedIncome()).toBe(1280);

    app.openAttendanceSheet(1);
    app.markClassAttendance(1, 2);
    expect(app.members().find((member) => member.id === 2)?.usedSessions).toBe(5);
    expect(app.members().find((member) => member.id === 2)?.attendance).toBe(19);
    expect(app.classes()[0].attendedMemberIds).toEqual([2]);
    expect(app.remainingSessions(2)).toBe(15);
    const attendanceAfterFirstMark = app.members().find((member) => member.id === 2)?.attendance;
    app.markClassAttendance(1, 2);
    expect(app.members().find((member) => member.id === 2)?.attendance).toBe(
      attendanceAfterFirstMark,
    );
    expect(
      app
        .workoutHistory()
        .some((workout) => workout.memberId === 2 && workout.workout === 'יוגה זורמת · 16.10'),
    ).toBeTrue();
  });

  it('records single-class purchases against the single-class rate', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.paymentPackageId.set(0);
    app.paymentPackageCount.set('2');

    app.recordMemberPayment();

    expect(app.members().find((member) => member.id === 2)?.purchasedSessions).toBe(12);
    expect(app.memberPayments()[0].packageName).toBe('אימון בודד');
    expect(app.memberPayments()[0].sessions).toBe(2);
    expect(app.memberPayments()[0].grossAmount).toBe(150);
    expect(app.memberPayments()[0].paidAmount).toBe(150);
  });

  it('edits and confirms removal of training packages', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.updatePackageName(2, '  חבילת סטודיו  ');
    app.updatePackageSessions(2, '8');
    app.updatePackagePrice(2, '720');
    expect(app.trainingPackages()[1]).toEqual({
      id: 2,
      name: 'חבילת סטודיו',
      sessions: 8,
      price: 720,
    });

    app.updatePackageName(2, '   ');
    app.updatePackageSessions(2, '2.5');
    expect(app.trainingPackages()[1].name).toBe('חבילת סטודיו');
    expect(app.trainingPackages()[1].sessions).toBe(8);

    app.requestDeleteTrainingPackage(2);
    expect(app.trainingPackages().length).toBe(3);
    app.deleteTrainingPackage(2);
    expect(app.trainingPackages().map((item) => item.id)).toEqual([1, 3]);
    expect(app.paymentPackageId()).toBe(1);
    expect(app.packageDeleteConfirmationId()).toBeNull();
  });

  it('shows public prices and package balance without exposing member discounts', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.enterDemo();
    app.discountMemberId.set(2);
    app.discountKind.set('percent');
    app.discountValue.set('10');
    app.applyMemberDiscount();
    app.activeTab.set('member-pricing');
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.member-package-summary')?.textContent).toContain('6');
    expect(page.querySelector('.member-package-summary')?.textContent).toContain(
      '4 נוצלו מתוך 10 אימונים',
    );
    expect(page.querySelector('.member-public-pricing')?.textContent).toContain('חבילת 10 אימונים');
    expect(page.querySelector('.member-public-pricing')?.textContent).toContain('₪650');
    expect(page.textContent).not.toContain('הטבה אישית');
    expect(page.textContent).not.toContain('10%');
  });

  it('requires a pain area before saving a pain report', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.feedbackRating.set(4);
    app.painReported.set(true);

    app.savePersonalWorkoutFeedback();

    expect(app.personalFeedback()).toEqual([]);
    app.togglePainArea('lower-back');
    app.savePersonalWorkoutFeedback();
    expect(app.latestPersonalFeedback()?.painAreas).toEqual(['גב תחתון']);
  });

  it('saves a trainee rating and optional workout note', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.feedbackWorkout.set('יוגה זורמת · 15.10');
    app.feedbackRating.set(5);
    app.feedbackNote.set('הרגשתי טוב אחרי האימון');

    app.savePersonalWorkoutFeedback();

    const feedback = app.latestPersonalFeedback();
    expect(feedback?.workout).toBe('יוגה זורמת · 15.10');
    expect(feedback?.rating).toBe(5);
    expect(feedback?.painAreas).toEqual([]);
    expect(feedback?.note).toBe('הרגשתי טוב אחרי האימון');
  });

  it('drills into a workout and shows its matching member feedback', () => {
    const app = TestBed.createComponent(App).componentInstance;
    app.openWorkoutFeedback('פילאטיס מזרן · 14.10');
    expect(app.selectedWorkoutHistory()?.workout).toBe('פילאטיס מזרן · 14.10');
    expect(app.feedbackWorkout()).toBe('פילאטיס מזרן · 14.10');
    expect(app.workoutFeedbackModalOpen()).toBeTrue();

    app.feedbackRating.set(4);
    app.feedbackNote.set('הרגשתי יציבה יותר');
    app.savePersonalWorkoutFeedback();
    expect(app.selectedWorkoutFeedback()?.note).toBe('הרגשתי יציבה יותר');
    expect(app.workoutFeedbackModalOpen()).toBeFalse();

    app.openWorkoutFeedback('פילאטיס מזרן · 14.10');
    expect(app.feedbackRating()).toBe(4);
    expect(app.feedbackNote()).toBe('הרגשתי יציבה יותר');
    app.feedbackNote.set('עדכנתי את ההערה');
    app.savePersonalWorkoutFeedback();
    expect(app.personalFeedback().length).toBe(1);
    expect(app.selectedWorkoutFeedback()?.note).toBe('עדכנתי את ההערה');

    app.selectWorkoutHistory(3);
    expect(app.selectedWorkoutFeedback()).toBeUndefined();
  });

  it('submits a join request to the API', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    app.joinName.set('Tamar Levi');
    app.joinEmail.set('tamar@example.com');

    app.requestAccess();

    const request = httpTesting.expectOne('/api/join-requests');
    expect(request.request.method).toBe('POST');
    request.flush({
      id: 'request-tamar',
      name: 'Tamar Levi',
      email: 'tamar@example.com',
      status: 'pending',
    });
    expect(app.joinState()).toBe('sent');
    expect(app.pendingMembers().length).toBe(2);
  });
});
