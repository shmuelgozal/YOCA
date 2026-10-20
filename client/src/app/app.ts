import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import {
  LucideBell,
  LucideCalendarDays,
  LucideCheck,
  LucideChevronLeft,
  LucideClock3,
  LucideDumbbell,
  LucideHeart,
  LucideHouse,
  LucideInfo,
  LucideLogOut,
  LucideMapPin,
  LucideMegaphone,
  LucideMessageCircle,
  LucideShare2,
  LucideSettings,
  LucideStar,
  LucideTag,
  LucideTrophy,
  LucideUserRound,
} from '@lucide/angular';

type MemberStatus = 'pending' | 'approved' | 'active' | 'deactivated';
type MemberAddress = 'feminine' | 'masculine' | 'neutral';
type ProfileCopyKey =
  | 'memberArea'
  | 'memberProfileLabel'
  | 'memberProfileSideNote'
  | 'memberSettingsIntro'
  | 'memberProgressStreak'
  | 'coachArea'
  | 'coachProfileDescription'
  | 'coachProfileLabel'
  | 'coachProfileSideNote';
type AuthMode = 'login' | 'request' | 'activate';
type BodyView = 'front' | 'back';
type PainIntensity = 'mild' | 'moderate' | 'strong';
type DiscountKind = 'percent' | 'amount';
type PaymentMethod = 'cash' | 'bit' | 'paybox';

const profileCopyByAddress: Record<ProfileCopyKey, Record<MemberAddress, string>> = {
  memberArea: { feminine: 'אזור מתאמנת', masculine: 'אזור מתאמן', neutral: 'אזור אישי' },
  memberProfileLabel: { feminine: 'פרטי מתאמנת', masculine: 'פרטי מתאמן', neutral: 'פרטים אישיים' },
  memberProfileSideNote: {
    feminine: 'במערכת המלאה תוכלי לעדכן כאן פרטי קשר ולבחור אילו עדכונים לקבל.',
    masculine: 'במערכת המלאה תוכל לעדכן כאן פרטי קשר ולבחור אילו עדכונים לקבל.',
    neutral: 'במערכת המלאה אפשר לעדכן כאן פרטי קשר ולבחור אילו עדכונים לקבל.',
  },
  memberSettingsIntro: {
    feminine: 'בחרי אילו עדכונים ותזכורות לקבל.',
    masculine: 'בחר אילו עדכונים ותזכורות לקבל.',
    neutral: 'בחירת עדכונים ותזכורות.',
  },
  memberProgressStreak: {
    feminine: 'עוד אימון אחד השבוע ואת בדרך לרצף של 5.',
    masculine: 'עוד אימון אחד השבוע ואתה בדרך לרצף של 5.',
    neutral: 'עוד אימון אחד השבוע לרצף של 5.',
  },
  coachArea: { feminine: 'אזור המאמנת', masculine: 'אזור המאמן', neutral: 'אזור המאמן/ת' },
  coachProfileDescription: {
    feminine: 'הפרטים האישיים של המאמנת.',
    masculine: 'הפרטים האישיים של המאמן.',
    neutral: 'הפרטים האישיים של המאמן/ת.',
  },
  coachProfileLabel: { feminine: 'פרטי מאמנת', masculine: 'פרטי מאמן', neutral: 'פרטי המאמן/ת' },
  coachProfileSideNote: {
    feminine: 'כאן אפשר לעדכן את פרטי הקשר ולשון הפנייה של המאמנת.',
    masculine: 'כאן אפשר לעדכן את פרטי הקשר ולשון הפנייה של המאמן.',
    neutral: 'כאן אפשר לעדכן את פרטי הקשר ולשון הפנייה של המאמן/ת.',
  },
};

interface TrainingPackage {
  id: number | string;
  name: string;
  sessions: number;
  price: number;
}

interface MemberDiscount {
  id: number;
  memberId: number;
  authId?: string;
  kind: DiscountKind;
  value: number;
  note: string;
}

interface MemberPayment {
  id: number | string;
  memberId: number;
  authId?: string;
  memberName: string;
  packageName: string;
  sessions: number;
  grossAmount: number;
  discountAmount: number;
  paidAmount: number;
  method: PaymentMethod;
  date: string;
}

interface BodyRegion {
  id: string;
  label: string;
  view: BodyView;
  x: number;
  y: number;
}

interface PersonalWorkoutFeedback {
  id: number | string;
  memberId: number;
  classId?: string;
  workout: string;
  rating: number;
  painAreas: string[];
  painIntensity: PainIntensity | null;
  note: string;
  savedAt: string;
}

interface WorkoutHistoryEntry {
  id: number | string;
  memberId: number;
  classId?: string;
  name: string;
  workout: string;
  date: string;
  dateIso: string;
  time: string;
  coach: string;
  durationMinutes?: number;
  coachFeedback: string;
}

interface Member {
  id: number;
  authId?: string;
  requestId?: string;
  name: string;
  initials: string;
  email: string;
  username?: string;
  joined: string;
  status: MemberStatus;
  points: number;
  attendance: number;
  purchasedSessions: number;
  usedSessions: number;
  phone?: string;
  birthDate?: string;
  address?: MemberAddress;
  trainingSince?: string;
  invitationUrl?: string;
}

interface JoinRequestResponse {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved';
  createdAt?: string;
  invitationToken?: string;
  invitationExpiresAt?: number;
}

interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  status: 'active';
  role: 'coach' | 'member';
  phone?: string | null;
  birthDate?: string | null;
  address?: MemberAddress | null;
  trainingSince?: string;
  reminderEnabled?: boolean;
  reminderLeadMinutes?: number;
  updatesEnabled?: boolean;
}

interface StudioFinanceResponse {
  singleClassPrice: number;
  packages: TrainingPackage[];
  members: {
    id: string;
    name: string;
    email: string;
    username: string;
    phone: string | null;
    birthDate: string | null;
    address: MemberAddress | null;
    trainingSince: string;
    joined: string;
    status: 'active' | 'deactivated';
    purchasedSessions: number;
    usedSessions: number;
    attendance: number;
    points: number;
  }[];
  discounts: {
    memberId: string;
    kind: DiscountKind;
    value: number;
    note: string;
  }[];
  payments: {
    id: string;
    memberId: string;
    memberName: string;
    packageName: string;
    sessions: number;
    grossAmount: number;
    discountAmount: number;
    paidAmount: number;
    method: PaymentMethod;
    date: string;
  }[];
}

interface MemberFinanceResponse {
  singleClassPrice: number;
  packages: TrainingPackage[];
  balance: {
    purchasedSessions: number;
    usedSessions: number;
    attendance: number;
    points: number;
  };
  payments: Omit<MemberPayment, 'memberId' | 'memberName' | 'authId'>[];
}

interface ClassSession {
  id: number | string;
  day: string;
  date: string;
  dateIso: string;
  time: string;
  name: string;
  coach: string;
  location: string;
  capacity: number;
  durationMinutes?: number;
  booked: number;
  reserved: boolean;
  attendedMemberIds: number[];
  attendees?: ClassAttendee[];
}

interface ClassAttendee {
  memberId: string;
  name: string;
  attended: boolean;
}

interface StudioClassResponse {
  id: string;
  dateIso: string;
  time: string;
  name: string;
  coach: string;
  location: string;
  capacity: number;
  durationMinutes: number;
  booked: number;
  reserved: boolean;
  attendees: ClassAttendee[];
}

interface Announcement {
  id: number | string;
  title: string;
  body: string;
  date: string;
  createdAt?: string;
}

interface WorkoutHistoryResponse {
  classId: string;
  memberId: string;
  memberName: string;
  name: string;
  dateIso: string;
  time: string;
  coach: string;
  durationMinutes: number;
  attendedAt: string;
  isRead: boolean;
  coachFeedback: string;
  personalFeedback: {
    rating: number;
    painAreas: string[];
    painIntensity: PainIntensity | null;
    note: string;
    savedAt: string;
  } | null;
}

interface AnnouncementResponse {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface CoachPost {
  id?: string;
  createdAt?: string;
  title: string;
  publishedLabel: string;
  permalink: string;
  embedUrl: string;
  explanations: string[];
}

interface CoachPostResponse {
  id: string;
  title: string;
  permalink: string;
  explanations: string[];
  createdAt: string;
}

@Component({
  selector: 'app-root',
  imports: [
    DecimalPipe,
    LucideBell,
    LucideCalendarDays,
    LucideCheck,
    LucideChevronLeft,
    LucideClock3,
    LucideDumbbell,
    LucideHeart,
    LucideHouse,
    LucideInfo,
    LucideLogOut,
    LucideMapPin,
    LucideMegaphone,
    LucideMessageCircle,
    LucideShare2,
    LucideSettings,
    LucideStar,
    LucideTag,
    LucideTrophy,
    LucideUserRound,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class App {
  constructor() {
    this.restoreSession();
  }

  private readonly sanitizer = inject(DomSanitizer);
  readonly navItems = [
    { id: 'overview', label: 'סקירה' },
    { id: 'schedule', label: 'שיעורים' },
    { id: 'members', label: 'מתאמנים' },
    { id: 'pricing', label: 'מחירון' },
    { id: 'board', label: 'לוח מודעות' },
    { id: 'content', label: 'תוכן לרשתות' },
  ];

  readonly memberNavItems = [
    { id: 'home', label: 'בית' },
    { id: 'workouts', label: 'אימונים' },
    { id: 'member-pricing', label: 'מחירון' },
    { id: 'updates', label: 'עדכונים' },
    { id: 'progress', label: 'ההתקדמות שלי' },
  ];
  readonly role = signal<'admin' | 'member'>('member');
  readonly invitationToken = signal(
    new URLSearchParams(window.location.search).get('invite') ?? '',
  );
  readonly isAuthenticated = signal(false);
  readonly isDemoSession = signal(false);
  readonly authMode = signal<AuthMode>(this.invitationToken() ? 'activate' : 'login');
  readonly loginEmail = signal('');
  readonly loginPassword = signal('');
  readonly loginMessage = signal('');
  readonly activationUsername = signal('');
  readonly activationEmail = signal('');
  readonly activationPassword = signal('');
  readonly activationPasswordConfirm = signal('');
  readonly activationMessage = signal('');
  readonly visibleNavItems = computed(() =>
    this.role() === 'admin' ? this.navItems : this.memberNavItems,
  );
  readonly activeTab = signal('home');
  readonly toast = signal('');
  readonly profileMenuOpen = signal(false);
  readonly reminderEnabled = signal(true);
  readonly reminderLeadMinutes = signal(60);
  readonly reminderLeadOptions = [
    { minutes: 15, label: '15 דקות' },
    { minutes: 30, label: '30 דקות' },
    { minutes: 60, label: 'שעה' },
    { minutes: 90, label: 'שעה וחצי' },
    { minutes: 120, label: 'שעתיים' },
  ];
  readonly reminderLeadLabel = computed(
    () =>
      this.reminderLeadOptions.find((option) => option.minutes === this.reminderLeadMinutes())
        ?.label ?? 'שעה',
  );
  readonly workoutFilter = signal<'all' | 'mine'>('all');
  readonly memberName = signal('נועה כהן');
  readonly memberEmail = signal('noa.cohen@example.com');
  readonly memberPhone = signal('050-123-4567');
  readonly memberBirthDate = signal('1994-06-18');
  readonly memberTrainingSince = signal('');
  readonly memberAddress = signal<MemberAddress>('masculine');
  readonly coachName = signal('אלכסיי יוצקוביץ');
  readonly coachEmail = signal('eitan.levi@example.com');
  readonly coachPhone = signal('050-987-6543');
  readonly coachBirthDate = signal('1988-03-12');
  readonly coachAddress = signal<MemberAddress>('masculine');
  readonly coachInitials = computed(() =>
    this.coachName()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join(''),
  );
  readonly coachFirstName = computed(() => this.coachName().trim().split(/\s+/)[0] ?? '');
  readonly profileName = computed(() =>
    this.role() === 'admin' ? this.coachName() : (this.currentMember()?.name ?? this.memberName()),
  );
  readonly profileEmail = computed(() =>
    this.role() === 'admin'
      ? this.coachEmail()
      : (this.currentMember()?.email ?? this.memberEmail()),
  );
  readonly profilePhone = computed(() =>
    this.role() === 'admin' ? this.coachPhone() : this.memberPhone(),
  );
  readonly profileBirthDate = computed(() =>
    this.role() === 'admin' ? this.coachBirthDate() : this.memberBirthDate(),
  );
  readonly profileAddress = computed(() =>
    this.role() === 'admin' ? this.coachAddress() : this.memberAddress(),
  );
  readonly memberAddressOptions: { id: MemberAddress; label: string }[] = [
    { id: 'feminine', label: 'אישה' },
    { id: 'masculine', label: 'גבר' },
    { id: 'neutral', label: 'ניטרלי' },
  ];
  readonly updatesEnabled = signal(true);
  readonly singleClassPrice = signal(75);
  readonly classPriceDraft = signal('75');
  readonly trainingPackages = signal<TrainingPackage[]>([
    { id: 1, name: 'חבילת 5 אימונים', sessions: 5, price: 350 },
    { id: 2, name: 'חבילת 10 אימונים', sessions: 10, price: 650 },
    { id: 3, name: 'חבילת 20 אימונים', sessions: 20, price: 1200 },
  ]);
  readonly packageDeleteConfirmationId = signal<number | string | null>(null);
  readonly newPackageName = signal('');
  readonly newPackageSessions = signal('');
  readonly newPackagePrice = signal('');
  readonly discountMemberId = signal(2);
  readonly discountKind = signal<DiscountKind>('percent');
  readonly discountValue = signal('10');
  readonly discountNote = signal('');
  readonly memberDiscounts = signal<MemberDiscount[]>([]);
  readonly paymentMemberId = signal(2);
  readonly paymentPackageId = signal<number | string>(2);
  readonly paymentPackageCount = signal('1');
  readonly paymentMethod = signal<PaymentMethod>('bit');
  readonly paymentSaving = signal(false);
  readonly memberPayments = signal<MemberPayment[]>([
    {
      id: 1,
      memberId: 2,
      memberName: 'נועה כהן',
      packageName: 'חבילת 10 אימונים',
      sessions: 10,
      grossAmount: 650,
      discountAmount: 0,
      paidAmount: 650,
      method: 'bit',
      date: '12.08.2026',
    },
  ]);
  readonly workoutHistory = signal<WorkoutHistoryEntry[]>([
    {
      id: 1,
      memberId: 2,
      name: 'יוגה זורמת',
      workout: 'יוגה זורמת · 15.10',
      date: '15 באוקטובר 2026',
      dateIso: '2026-10-15',
      time: '18:00',
      coach: this.coachName(),
      durationMinutes: 55,
      coachFeedback:
        'שמירה טובה על נשימה וקצב לאורך התרגול. באימון הבא נמשיך לעבוד על יציבות במעבר בין התנוחות.',
    },
    {
      id: 2,
      memberId: 2,
      name: 'פילאטיס מזרן',
      workout: 'פילאטיס מזרן · 14.10',
      date: '14 באוקטובר 2026',
      dateIso: '2026-10-14',
      time: '19:15',
      coach: 'נועה לוין',
      durationMinutes: 50,
      coachFeedback:
        'עבודה מדויקת וחיבור טוב לשרירי הליבה. נסי לשמור על אותה שליטה גם כשהקצב עולה.',
    },
    {
      id: 3,
      memberId: 2,
      name: 'כוח וגמישות',
      workout: 'כוח וגמישות · 12.10',
      date: '12 באוקטובר 2026',
      dateIso: '2026-10-12',
      time: '08:30',
      coach: this.coachName(),
      durationMinutes: 45,
      coachFeedback:
        'התקדמות יפה בטווח התנועה. הקפידי על מנוחה קצרה בין הסטים כדי לשמור על טכניקה.',
    },
    {
      id: 4,
      memberId: 3,
      name: 'פילאטיס מזרן',
      workout: 'פילאטיס מזרן · 15.10',
      date: '15 באוקטובר 2026',
      dateIso: '2026-10-15',
      time: '19:15',
      coach: 'נועה לוין',
      durationMinutes: 50,
      coachFeedback: 'שליטה טובה בתנועה ושמירה על יציבה לאורך התרגול.',
    },
    {
      id: 5,
      memberId: 3,
      name: 'יוגה זורמת',
      workout: 'יוגה זורמת · 13.10',
      date: '13 באוקטובר 2026',
      dateIso: '2026-10-13',
      time: '18:00',
      coach: this.coachName(),
      durationMinutes: 55,
      coachFeedback: 'תרגול רציף ומדויק. המשיכי לעבוד בקצב שנוח לך.',
    },
    {
      id: 6,
      memberId: 4,
      name: 'כוח וגמישות',
      workout: 'כוח וגמישות · 14.10',
      date: '14 באוקטובר 2026',
      dateIso: '2026-10-14',
      time: '08:30',
      coach: this.coachName(),
      durationMinutes: 45,
      coachFeedback: 'עבודה טובה. שימי לב לטווח התנועה הנוח בכל חזרה.',
    },
  ]);
  readonly memberHistoryExpanded = signal(false);
  readonly memberHistoryTypeFilter = signal('all');
  readonly memberHistoryFromDate = signal('');
  readonly memberHistoryToDate = signal('');
  readonly selectedWorkoutHistoryId = signal<number | string>(1);
  readonly currentMemberWorkoutHistory = computed(() =>
    this.workoutHistory().filter((item) => item.memberId === this.currentMemberId()),
  );
  readonly readWorkoutHistoryIds = signal<Array<number | string>>([]);
  readonly unreadWorkoutHistoryCount = computed(
    () =>
      this.currentMemberWorkoutHistory().filter(
        (workout) => !this.readWorkoutHistoryIds().includes(workout.id),
      ).length,
  );
  readonly workoutDetailsModalOpen = signal(false);
  readonly selectedWorkoutHistory = computed(() => {
    const history = this.currentMemberWorkoutHistory();
    return history.find((item) => item.id === this.selectedWorkoutHistoryId()) ?? history[0];
  });
  readonly feedbackWorkout = signal(
    this.workoutHistory().find((item) => item.memberId === 2)?.workout ?? '',
  );
  readonly workoutFeedbackModalOpen = signal(false);
  readonly feedbackRating = signal(0);
  readonly painReported = signal(false);
  readonly painIntensityOptions: { id: PainIntensity; label: string }[] = [
    { id: 'mild', label: 'קל' },
    { id: 'moderate', label: 'בינוני' },
    { id: 'strong', label: 'חזק' },
  ];
  readonly painIntensity = signal<PainIntensity>('mild');
  readonly bodyView = signal<BodyView>('front');
  readonly selectedPainAreaIds = signal<string[]>([]);
  readonly feedbackNote = signal('');
  readonly personalFeedback = signal<PersonalWorkoutFeedback[]>([]);
  readonly selectedWorkoutFeedback = computed(() => {
    const workout = this.selectedWorkoutHistory()?.workout;
    return this.personalFeedback().find(
      (feedback) => feedback.memberId === this.currentMemberId() && feedback.workout === workout,
    );
  });
  readonly joinName = signal('');
  readonly joinEmail = signal('');
  readonly joinState = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  readonly currentMemberId = signal(2);
  private readonly http = inject(HttpClient);
  readonly memberSearch = signal('');
  readonly pendingMembers = computed(() =>
    this.members().filter((member) => member.status === 'pending'),
  );
  readonly activeMembers = computed(() =>
    this.members().filter((member) => member.status === 'active'),
  );
  readonly filteredMembers = computed(() => {
    const query = this.memberSearch().trim().toLocaleLowerCase();
    return this.members().filter((member) =>
      [member.name, member.email, member.username ?? '', member.phone ?? ''].some((field) =>
        field.toLocaleLowerCase().includes(query),
      ),
    );
  });
  readonly discountsWithMembers = computed(() =>
    this.memberDiscounts().map((discount) => ({
      ...discount,
      member: this.members().find((member) => member.id === discount.memberId),
    })),
  );
  readonly currentMember = computed(() =>
    this.members().find((member) => member.id === this.currentMemberId()),
  );
  readonly currentMemberFirstName = computed(
    () => this.currentMember()?.name.trim().split(/\s+/)[0] ?? '',
  );
  readonly recordedIncome = computed(() =>
    this.memberPayments().reduce((total, payment) => total + payment.paidAmount, 0),
  );
  readonly members = signal<Member[]>([
    {
      id: 1,
      requestId: 'request-demo-tamar',
      name: 'תמר לוי',
      initials: 'תל',
      email: 'tamar.levy@example.com',
      joined: 'היום, 09:42',
      status: 'pending',
      points: 0,
      attendance: 0,
      purchasedSessions: 0,
      usedSessions: 0,
    },
    {
      id: 2,
      name: 'נועה כהן',
      initials: 'נכ',
      email: 'noa.cohen@example.com',
      joined: '12 באוג׳',
      status: 'active',
      points: 180,
      attendance: 18,
      purchasedSessions: 10,
      usedSessions: 4,
      phone: '050-123-4567',
      birthDate: '1994-06-18',
      address: 'feminine',
      trainingSince: '2024-08-12',
    },
    {
      id: 3,
      name: 'מיה אברהם',
      initials: 'מא',
      email: 'maya.avraham@example.com',
      joined: '8 באוג׳',
      status: 'active',
      points: 125,
      attendance: 14,
      purchasedSessions: 0,
      usedSessions: 0,
      trainingSince: '2025-08-08',
    },
    {
      id: 4,
      name: 'שירה דיין',
      initials: 'שד',
      email: 'shira.dayan@example.com',
      joined: '2 באוג׳',
      status: 'active',
      points: 90,
      attendance: 9,
      purchasedSessions: 0,
      usedSessions: 0,
      trainingSince: '2025-02-02',
    },
  ]);
  readonly memberRemovalConfirmationId = signal<number | null>(null);
  readonly memberPendingRemoval = computed(() =>
    this.members().find((member) => member.id === this.memberRemovalConfirmationId()),
  );
  readonly selectedCoachMemberId = signal<number | null>(null);
  readonly memberDetailsOpen = signal(false);
  readonly editingCoachFeedbackWorkoutId = signal<number | string | null>(null);
  readonly coachFeedbackDraft = signal('');
  readonly selectedCoachMember = computed(() =>
    this.members().find((member) => member.id === this.selectedCoachMemberId()),
  );
  readonly selectedCoachMemberAllWorkouts = computed(() =>
    this.workoutHistory()
      .filter((workout) => workout.memberId === this.selectedCoachMemberId())
      .sort(
        (left, right) =>
          right.dateIso.localeCompare(left.dateIso) ||
          String(right.id).localeCompare(String(left.id)),
      ),
  );
  readonly selectedCoachMemberWorkoutTypes = computed(() =>
    [...new Set(this.selectedCoachMemberAllWorkouts().map((workout) => workout.name))].sort(),
  );
  readonly filteredCoachMemberWorkouts = computed(() =>
    this.selectedCoachMemberAllWorkouts().filter(
      (workout) =>
        (this.memberHistoryTypeFilter() === 'all' ||
          workout.name === this.memberHistoryTypeFilter()) &&
        (!this.memberHistoryFromDate() || workout.dateIso >= this.memberHistoryFromDate()) &&
        (!this.memberHistoryToDate() || workout.dateIso <= this.memberHistoryToDate()),
    ),
  );
  readonly selectedCoachMemberWorkouts = computed(() =>
    this.memberHistoryExpanded()
      ? this.filteredCoachMemberWorkouts()
      : this.filteredCoachMemberWorkouts().slice(0, 5),
  );
  readonly selectedCoachMemberFeedback = computed(() =>
    this.personalFeedback()
      .filter((feedback) => feedback.memberId === this.selectedCoachMemberId())
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
  );
  readonly selectedCoachMemberPainReports = computed(() =>
    this.selectedCoachMemberFeedback().filter((feedback) => feedback.painAreas.length > 0),
  );
  readonly selectedCoachMemberPainAreas = computed(() => {
    const counts = new Map<string, number>();
    this.selectedCoachMemberPainReports().forEach((feedback) =>
      feedback.painAreas.forEach((area) => counts.set(area, (counts.get(area) ?? 0) + 1)),
    );
    return Array.from(counts, ([area, count]) => ({ area, count })).sort(
      (left, right) => right.count - left.count,
    );
  });
  readonly selectedCoachMemberPainAnalysis = computed(() => {
    const reports = this.selectedCoachMemberPainReports();
    const areas = this.selectedCoachMemberPainAreas();
    if (!reports.length) {
      return 'לא נשמרו דיווחי כאב או אי־נוחות. כדאי לשאול לפני האימון אם יש משהו שחשוב להתייחס אליו.';
    }
    const highestIntensity = reports.reduce<PainIntensity>((highest, report) => {
      const order: Record<PainIntensity, number> = { mild: 1, moderate: 2, strong: 3 };
      return report.painIntensity && order[report.painIntensity] > order[highest]
        ? report.painIntensity
        : highest;
    }, 'mild');
    const intensityLabel =
      this.painIntensityOptions.find((option) => option.id === highestIntensity)?.label ?? 'קל';
    return `${reports.length} דיווחים אישיים. האזורים שחזרו: ${areas.map((item) => `${item.area} (${item.count})`).join(', ')}. העוצמה המרבית שדווחה: ${intensityLabel}. יש לברר עם המתאמן/ת ולתכנן התאמות בהתאם לתחושה באותו יום.`;
  });

  openMemberDetails(memberId: number): void {
    const member = this.members().find((item) => item.id === memberId);
    if (!member) {
      return;
    }
    this.selectedCoachMemberId.set(memberId);
    this.editingCoachFeedbackWorkoutId.set(null);
    this.memberHistoryExpanded.set(false);
    this.memberHistoryTypeFilter.set('all');
    this.memberHistoryFromDate.set('');
    this.memberHistoryToDate.set('');
    this.memberDetailsOpen.set(true);
    if (this.isAuthenticated() && !this.isDemoSession() && member.authId) {
      this.workoutHistory.update((items) => items.filter((item) => item.memberId !== member.id));
      this.personalFeedback.update((items) => items.filter((item) => item.memberId !== member.id));
      this.loadCoachMemberWorkoutHistory(member);
    }
  }

  closeMemberDetails(): void {
    this.memberDetailsOpen.set(false);
    this.selectedCoachMemberId.set(null);
    this.editingCoachFeedbackWorkoutId.set(null);
  }

  openCoachWorkoutFeedback(memberId: number, workoutId: number | string): void {
    const workout = this.workoutHistory().find(
      (item) => item.memberId === memberId && item.id === workoutId,
    );
    if (!workout) {
      return;
    }
    this.editingCoachFeedbackWorkoutId.set(workoutId);
    this.coachFeedbackDraft.set(workout.coachFeedback);
  }

  cancelCoachWorkoutFeedback(): void {
    this.editingCoachFeedbackWorkoutId.set(null);
  }

  saveCoachWorkoutFeedback(memberId: number, workoutId: number | string): void {
    const feedback = this.coachFeedbackDraft().trim();
    if (!feedback) {
      this.showToast('יש להזין משוב לפני השמירה');
      return;
    }
    const exists = this.workoutHistory().some(
      (item) => item.memberId === memberId && item.id === workoutId,
    );
    if (!exists) {
      return;
    }
    const member = this.members().find((item) => item.id === memberId);
    const workout = this.workoutHistory().find(
      (item) => item.memberId === memberId && item.id === workoutId,
    );
    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (!member?.authId || !workout?.classId) {
        this.showToast('לא ניתן לזהות את האימון לשמירת המשוב');
        return;
      }
      this.http
        .put(
          `/api/studio/members/${member.authId}/workouts/${workout.classId}/feedback`,
          { feedback },
          { withCredentials: true },
        )
        .subscribe({
          next: () => {
            this.updateCoachWorkoutFeedback(memberId, workoutId, feedback);
            this.editingCoachFeedbackWorkoutId.set(null);
            this.showToast('משוב המאמן נשמר באימון');
          },
          error: () => this.showToast('לא ניתן לשמור משוב לאימון'),
        });
      return;
    }
    this.workoutHistory.update((items) =>
      items.map((item) =>
        item.memberId === memberId && item.id === workoutId
          ? { ...item, coachFeedback: feedback }
          : item,
      ),
    );
    this.editingCoachFeedbackWorkoutId.set(null);
    this.showToast('משוב המאמן נשמר באימון');
  }

  private updateCoachWorkoutFeedback(
    memberId: number,
    workoutId: number | string,
    feedback: string,
  ): void {
    this.workoutHistory.update((items) =>
      items.map((item) =>
        item.memberId === memberId && item.id === workoutId
          ? { ...item, coachFeedback: feedback }
          : item,
      ),
    );
  }

  memberAge(member: Member): number | null {
    if (!member.birthDate) {
      return null;
    }
    const birthDate = new Date(`${member.birthDate}T12:00:00`);
    if (!Number.isFinite(birthDate.getTime())) {
      return null;
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (
      today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }
    return age;
  }

  memberTrainingTenure(member: Member): string {
    if (!member.trainingSince) {
      return 'לא צוין';
    }
    const start = new Date(`${member.trainingSince}T12:00:00`);
    if (!Number.isFinite(start.getTime())) {
      return 'לא צוין';
    }
    const today = new Date();
    let months =
      (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
    if (today.getDate() < start.getDate()) {
      months -= 1;
    }
    months = Math.max(months, 0);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years && remainingMonths) {
      return `${years} שנים ו־${remainingMonths} חודשים`;
    }
    if (years) {
      return `${years} שנים`;
    }
    return `${months} חודשים`;
  }

  memberFeedbackForWorkout(memberId: number, workout: string): PersonalWorkoutFeedback | undefined {
    return this.personalFeedback().find(
      (feedback) => feedback.memberId === memberId && feedback.workout === workout,
    );
  }

  toggleMemberHistoryExpanded(): void {
    this.memberHistoryExpanded.update((expanded) => !expanded);
    if (!this.memberHistoryExpanded()) {
      this.memberHistoryTypeFilter.set('all');
      this.memberHistoryFromDate.set('');
      this.memberHistoryToDate.set('');
    }
  }

  requestAccess(): void {
    const name = this.joinName().trim();
    const email = this.joinEmail().trim().toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.joinState.set('error');
      return;
    }

    this.joinState.set('sending');
    this.http.post<JoinRequestResponse>('/api/join-requests', { name, email }).subscribe({
      next: (request) => {
        const initials = name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('');
        this.members.update((members) => [
          {
            id: Date.now(),
            requestId: request.id,
            name,
            initials,
            email,
            joined: 'הרגע',
            status: 'pending',
            points: 0,
            attendance: 0,
            purchasedSessions: 0,
            usedSessions: 0,
          },
          ...members,
        ]);
        this.joinState.set('sent');
      },
      error: () => this.joinState.set('error'),
    });
  }

  loadJoinRequests(): void {
    this.http
      .get<JoinRequestResponse[]>('/api/join-requests', { withCredentials: true })
      .subscribe({
        next: (requests) => {
          this.members.update((members) => {
            const localAccounts = members.filter(
              (member) =>
                member.status === 'active' && (!member.requestId || member.authId !== undefined),
            );
            const syncedRequests = requests.map((request, index): Member => {
              const existing = members.find(
                (member) => member.requestId === request.id || member.email === request.email,
              );
              return {
                id: existing?.id ?? Date.now() + index,
                requestId: request.id,
                name: request.name,
                initials: request.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join(''),
                email: request.email,
                username: existing?.username,
                joined: existing?.joined ?? 'בקשה חדשה',
                status: request.status,
                points: existing?.points ?? 0,
                attendance: existing?.attendance ?? 0,
                purchasedSessions: existing?.purchasedSessions ?? 0,
                usedSessions: existing?.usedSessions ?? 0,
                phone: existing?.phone,
                birthDate: existing?.birthDate,
                address: existing?.address,
                trainingSince: existing?.trainingSince,
                invitationUrl: request.invitationToken
                  ? `${window.location.origin}/?invite=${request.invitationToken}`
                  : existing?.invitationUrl,
              };
            });
            return [...localAccounts, ...syncedRequests];
          });
        },
        error: () => this.showToast('לא ניתן לטעון בקשות גישה מהשרת'),
      });
  }

  loadClasses(): void {
    if (!this.isAuthenticated() || this.isDemoSession()) {
      return;
    }
    this.http.get<StudioClassResponse[]>('/api/classes', { withCredentials: true }).subscribe({
      next: (classes) => {
        this.classes.set(
          classes.map((session) => {
            const [year, month, day] = session.dateIso.split('-').map(Number);
            const sessionDate = new Date(year, month - 1, day, 12);
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            const relativeDay = Math.round((sessionDate.getTime() - today.getTime()) / 86400000);
            return {
              ...session,
              day:
                relativeDay === 0
                  ? 'היום'
                  : relativeDay === 1
                    ? 'מחר'
                    : new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(sessionDate),
              date: new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' }).format(
                sessionDate,
              ),
              time: session.time.slice(0, 5),
              attendedMemberIds: [],
            };
          }),
        );
      },
      error: () => this.showToast('לא ניתן לטעון את לוח השיעורים מהשרת'),
    });
  }

  loadStudioAnnouncements(): void {
    if (!this.isAuthenticated() || this.isDemoSession()) {
      return;
    }
    this.announcements.set([]);
    this.http
      .get<AnnouncementResponse[]>('/api/studio/announcements', { withCredentials: true })
      .subscribe({
        next: (announcements) =>
          this.announcements.set(
            announcements.map((item) => ({
              id: item.id,
              title: item.title,
              body: item.body,
              createdAt: item.createdAt,
              date: new Intl.DateTimeFormat('he-IL', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(item.createdAt)),
            })),
          ),
        error: () => this.showToast('לא ניתן לטעון את הודעות הסטודיו'),
      });
  }

  private loadLatestSocialPost(): void {
    if (!this.isAuthenticated() || this.isDemoSession()) {
      return;
    }
    this.http
      .get<CoachPostResponse | null>('/api/studio/social-post', {
        withCredentials: true,
      })
      .subscribe({
        next: (post) => {
          if (!post) {
            this.latestCoachPost.set(null);
            this.coachPostTitle.set('');
            this.coachPostUrl.set('');
            this.coachPostExplanations.set('');
            return;
          }
          const parts = post.permalink.match(/\/(p|reel|tv)\/([a-zA-Z0-9_-]+)\/?/);
          if (!parts) {
            this.showToast('הקישור לפוסט האחרון אינו תקין');
            return;
          }
          const embedUrl = new URL(`https://www.instagram.com/${parts[1]}/${parts[2]}/embed/`);
          embedUrl.searchParams.set('hl', 'en');
          const imageIndex = new URL(post.permalink).searchParams.get('img_index');
          if (imageIndex) {
            embedUrl.searchParams.set('img_index', imageIndex);
          }
          this.latestCoachPost.set({
            id: post.id,
            createdAt: post.createdAt,
            title: post.title,
            publishedLabel: 'פוסט חדש',
            permalink: post.permalink,
            embedUrl: embedUrl.toString(),
            explanations: post.explanations,
          });
          this.coachPostTitle.set(post.title);
          this.coachPostUrl.set(post.permalink);
          this.coachPostExplanations.set(post.explanations.join('\n'));
        },
        error: () => this.showToast('לא ניתן לטעון את הפוסט האחרון'),
      });
  }

  private loadMemberWorkoutHistory(): void {
    const memberId = this.currentMemberId();
    if (!this.isAuthenticated() || this.isDemoSession() || this.role() !== 'member') {
      return;
    }
    this.http
      .get<WorkoutHistoryResponse[]>('/api/member/workouts', { withCredentials: true })
      .subscribe({
        next: (history) => {
          const workouts = history.map((item) => this.mapWorkoutHistory(item, memberId));
          this.workoutHistory.update((items) => [
            ...items.filter((item) => item.memberId !== memberId),
            ...workouts,
          ]);
          const feedback = history.flatMap((item) =>
            item.personalFeedback
              ? [
                  {
                    id: item.classId,
                    classId: item.classId,
                    memberId,
                    workout: this.workoutLabel(item.name, item.dateIso),
                    ...item.personalFeedback,
                  },
                ]
              : [],
          );
          this.personalFeedback.update((items) => [
            ...items.filter((item) => item.memberId !== memberId),
            ...feedback,
          ]);
          this.readWorkoutHistoryIds.set(
            history.filter((item) => item.isRead).map((item) => item.classId),
          );
          const firstWorkout = workouts[0];
          this.selectedWorkoutHistoryId.set(firstWorkout?.id ?? -1);
          this.feedbackWorkout.set(firstWorkout?.workout ?? '');
        },
        error: () => this.showToast('לא ניתן לטעון את היסטוריית האימונים'),
      });
  }

  private loadCoachMemberWorkoutHistory(member: Member): void {
    if (!member.authId) {
      return;
    }
    this.http
      .get<WorkoutHistoryResponse[]>(`/api/studio/members/${member.authId}/workouts`, {
        withCredentials: true,
      })
      .subscribe({
        next: (history) => {
          const workouts = history.map((item) => this.mapWorkoutHistory(item, member.id));
          this.workoutHistory.update((items) => [
            ...items.filter((item) => item.memberId !== member.id),
            ...workouts,
          ]);
          const feedback = history.flatMap((item) =>
            item.personalFeedback
              ? [
                  {
                    id: item.classId,
                    classId: item.classId,
                    memberId: member.id,
                    workout: this.workoutLabel(item.name, item.dateIso),
                    ...item.personalFeedback,
                  },
                ]
              : [],
          );
          this.personalFeedback.update((items) => [
            ...items.filter((item) => item.memberId !== member.id),
            ...feedback,
          ]);
        },
        error: () => this.showToast('לא ניתן לטעון את היסטוריית האימונים של המתאמן/ת'),
      });
  }

  private mapWorkoutHistory(item: WorkoutHistoryResponse, memberId: number): WorkoutHistoryEntry {
    const date = new Date(`${item.dateIso}T12:00:00`);
    return {
      id: item.classId,
      classId: item.classId,
      memberId,
      name: item.name,
      workout: this.workoutLabel(item.name, item.dateIso),
      date: new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date),
      dateIso: item.dateIso,
      time: item.time,
      coach: item.coach,
      durationMinutes: item.durationMinutes,
      coachFeedback: item.coachFeedback,
    };
  }

  private workoutLabel(name: string, dateIso: string): string {
    const date = new Date(`${dateIso}T12:00:00`);
    return `${name} · ${new Intl.DateTimeFormat('he-IL', {
      day: '2-digit',
      month: '2-digit',
    }).format(date)}`;
  }

  loadStudioFinance(): void {
    if (!this.isAuthenticated() || this.isDemoSession() || this.role() !== 'admin') {
      return;
    }
    this.http
      .get<StudioFinanceResponse>('/api/studio/finance', { withCredentials: true })
      .subscribe({
        next: (finance) => {
          this.singleClassPrice.set(finance.singleClassPrice);
          this.classPriceDraft.set(String(finance.singleClassPrice));
          this.trainingPackages.set(finance.packages);
          const existingMembers = this.members();
          const pending = existingMembers.filter(
            (member) => member.status === 'pending' || member.status === 'approved',
          );
          const active = finance.members.map((member, index): Member => {
            const existing = existingMembers.find((item) => item.authId === member.id);
            return {
              id: existing?.id ?? Date.now() + index,
              authId: member.id,
              name: member.name,
              initials: member.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join(''),
              email: member.email,
              username: member.username,
              joined:
                existing?.joined ??
                new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(
                  new Date(member.joined),
                ),
              status: member.status,
              points: member.points,
              attendance: member.attendance,
              purchasedSessions: member.purchasedSessions,
              usedSessions: member.usedSessions,
              phone: member.phone ?? undefined,
              birthDate: member.birthDate ?? undefined,
              address: member.address ?? undefined,
              trainingSince: member.trainingSince,
            };
          });
          this.members.set([...pending, ...active]);
          this.memberDiscounts.set(
            finance.discounts.flatMap((discount) => {
              const member = active.find((item) => item.authId === discount.memberId);
              return member
                ? [
                    {
                      id: member.id,
                      memberId: member.id,
                      authId: discount.memberId,
                      kind: discount.kind,
                      value: discount.value,
                      note: discount.note,
                    },
                  ]
                : [];
            }),
          );
          this.memberPayments.set(
            finance.payments.flatMap((payment) => {
              const member = active.find((item) => item.authId === payment.memberId);
              return member
                ? [
                    {
                      ...payment,
                      memberId: member.id,
                      authId: payment.memberId,
                      date: new Intl.DateTimeFormat('he-IL').format(new Date(payment.date)),
                    },
                  ]
                : [];
            }),
          );
          if (!this.trainingPackages().some((item) => item.id === this.paymentPackageId())) {
            this.paymentPackageId.set(this.trainingPackages()[0]?.id ?? 0);
          }
        },
        error: () => this.showToast('לא ניתן לטעון נתוני המחירון והיתרות'),
      });
  }

  loadMemberFinance(): void {
    if (!this.isAuthenticated() || this.isDemoSession() || this.role() !== 'member') {
      return;
    }
    this.http
      .get<MemberFinanceResponse>('/api/member/finance', { withCredentials: true })
      .subscribe({
        next: (finance) => {
          this.singleClassPrice.set(finance.singleClassPrice);
          this.classPriceDraft.set(String(finance.singleClassPrice));
          this.trainingPackages.set(finance.packages);
          this.members.update((members) =>
            members.map((member) =>
              member.authId === this.currentMember()?.authId
                ? {
                    ...member,
                    purchasedSessions: finance.balance.purchasedSessions,
                    usedSessions: finance.balance.usedSessions,
                    attendance: finance.balance.attendance,
                    points: finance.balance.points,
                  }
                : member,
            ),
          );
        },
        error: () => this.showToast('לא ניתן לטעון את היתרה והמחירון'),
      });
  }

  readonly classes = signal<ClassSession[]>([
    {
      id: 1,
      day: 'היום',
      date: '16.10',
      dateIso: '2026-10-16',
      time: '18:00',
      name: 'יוגה זורמת',
      coach: this.coachName(),
      location: 'סטודיו ראשי',
      capacity: 12,
      booked: 9,
      reserved: true,
      attendedMemberIds: [],
    },
    {
      id: 2,
      day: 'היום',
      date: '16.10',
      dateIso: '2026-10-16',
      time: '19:15',
      name: 'פילאטיס מזרן',
      coach: 'נועה לוין',
      location: 'סטודיו ראשי',
      capacity: 10,
      booked: 8,
      reserved: false,
      attendedMemberIds: [],
    },
    {
      id: 3,
      day: 'מחר',
      date: '17.10',
      dateIso: '2026-10-17',
      time: '08:30',
      name: 'כוח וגמישות',
      coach: this.coachName(),
      location: 'סטודיו ראשי',
      capacity: 12,
      booked: 6,
      reserved: false,
      attendedMemberIds: [],
    },
    {
      id: 4,
      day: 'שבת',
      date: '18.10',
      dateIso: '2026-10-18',
      time: '09:00',
      name: 'יוגה בוקר',
      coach: 'דנה רז',
      location: 'סטודיו ראשי',
      capacity: 14,
      booked: 11,
      reserved: false,
      attendedMemberIds: [],
    },
  ]);
  readonly classFormOpen = signal(false);
  readonly editingClassId = signal<number | string | null>(null);
  readonly confirmClassCancellationId = signal<number | string | null>(null);
  readonly classNameDraft = signal('');
  readonly classDateDraft = signal('');
  readonly classTimeDraft = signal('18:00');
  readonly classCoachDraft = signal('');
  readonly classLocationDraft = signal('סטודיו ראשי');
  readonly classCapacityDraft = signal('12');
  readonly classDurationDraft = signal('60');
  readonly classPlacesBooked = computed(() =>
    this.classes().reduce((total, session) => total + session.booked, 0),
  );
  readonly classPlacesTotal = computed(() =>
    this.classes().reduce((total, session) => total + session.capacity, 0),
  );
  readonly attendanceSessionId = signal<number | string | null>(null);
  readonly attendanceSession = computed(() =>
    this.classes().find((session) => session.id === this.attendanceSessionId()),
  );
  attendedCount(session: ClassSession): number {
    return this.isDemoSession()
      ? session.attendedMemberIds.length
      : (session.attendees?.filter((attendee) => attendee.attended).length ?? 0);
  }

  readonly announcements = signal<Announcement[]>([
    {
      id: 1,
      title: 'שינוי בשעת שיעור שישי',
      body: 'השיעור של יום שישי יתחיל השבוע ב־09:00. נתראה על המזרן.',
      date: 'היום, 08:30',
    },
    {
      id: 2,
      title: 'פותחים אתגר התמדה',
      body: 'ארבעה אימונים החודש? מחכות לכן נקודות בונוס והפתעה קטנה.',
      date: 'אתמול',
    },
  ]);
  readonly demoCoachPost: CoachPost = {
    title: 'קאקאסנה, תנוחת העורב',
    publishedLabel: 'פוסט השבוע',
    permalink: 'https://www.instagram.com/p/DejHXnmDiYr/?img_index=6&mdxt=MWo3Y2N5dDJqbzd0dw==',
    embedUrl: 'https://www.instagram.com/p/DejHXnmDiYr/embed/?hl=en&img_index=6',
    explanations: ['מיקום הברך על הזרוע', 'העברת משקל הדרגתית', 'הרמת הרגל מתוך יציבות'],
  };
  readonly latestCoachPost = signal<CoachPost | null>(this.demoCoachPost);
  readonly latestCoachPostEmbedUrl = computed(() => {
    const post = this.latestCoachPost();
    return post ? this.sanitizer.bypassSecurityTrustResourceUrl(post.embedUrl) : null;
  });
  readonly coachPostTitle = signal(this.demoCoachPost.title);
  readonly coachPostUrl = signal(this.demoCoachPost.permalink);
  readonly coachPostExplanations = signal(this.demoCoachPost.explanations.join('\n'));
  private readonly demoData = {
    members: this.members(),
    classes: this.classes(),
    singleClassPrice: this.singleClassPrice(),
    trainingPackages: this.trainingPackages(),
    memberDiscounts: this.memberDiscounts(),
    memberPayments: this.memberPayments(),
    workoutHistory: this.workoutHistory(),
    personalFeedback: this.personalFeedback(),
    announcements: this.announcements(),
    latestCoachPost: this.latestCoachPost(),
  };
  readonly announcementTitle = signal('');
  readonly announcementBody = signal('');
  readonly sumAttendance = (total: number, member: Member): number => total + member.attendance;
  readonly nextWorkout = computed(() => this.classes().find((session) => session.reserved));
  readonly reservedWorkoutCount = computed(
    () => this.classes().filter((session) => session.reserved).length,
  );
  readonly memberAttendancePercent = computed(() =>
    Math.min((this.currentMember()?.attendance ?? 0) * 4, 100),
  );
  readonly visibleClasses = computed(() =>
    this.workoutFilter() === 'mine'
      ? this.classes().filter((session) => session.reserved)
      : this.classes(),
  );
  readonly bodyRegions: BodyRegion[] = [
    { id: 'neck', label: 'צוואר', view: 'front', x: 50, y: 15 },
    { id: 'left-shoulder', label: 'כתף שמאל', view: 'front', x: 29, y: 27 },
    { id: 'right-shoulder', label: 'כתף ימין', view: 'front', x: 71, y: 27 },
    { id: 'chest', label: 'חזה', view: 'front', x: 50, y: 35 },
    { id: 'abdomen', label: 'בטן', view: 'front', x: 50, y: 46 },
    { id: 'left-hip', label: 'ירך שמאל', view: 'front', x: 39, y: 57 },
    { id: 'right-hip', label: 'ירך ימין', view: 'front', x: 61, y: 57 },
    { id: 'left-knee', label: 'ברך שמאל', view: 'front', x: 41, y: 73 },
    { id: 'right-knee', label: 'ברך ימין', view: 'front', x: 59, y: 73 },
    { id: 'back-neck', label: 'צוואר', view: 'back', x: 50, y: 15 },
    { id: 'back-left-shoulder', label: 'כתף שמאל', view: 'back', x: 29, y: 27 },
    { id: 'back-right-shoulder', label: 'כתף ימין', view: 'back', x: 71, y: 27 },
    { id: 'upper-back', label: 'גב עליון', view: 'back', x: 50, y: 36 },
    { id: 'lower-back', label: 'גב תחתון', view: 'back', x: 50, y: 49 },
    { id: 'back-left-hip', label: 'ירך שמאל', view: 'back', x: 39, y: 60 },
    { id: 'back-right-hip', label: 'ירך ימין', view: 'back', x: 61, y: 60 },
    { id: 'left-calf', label: 'שוק שמאל', view: 'back', x: 41, y: 81 },
    { id: 'right-calf', label: 'שוק ימין', view: 'back', x: 59, y: 81 },
  ];
  readonly visibleBodyRegions = computed(() =>
    this.bodyRegions.filter((region) => region.view === this.bodyView()),
  );
  readonly selectedPainAreas = computed(() =>
    this.bodyRegions.filter((region) => this.selectedPainAreaIds().includes(region.id)),
  );
  readonly latestPersonalFeedback = computed(() =>
    this.personalFeedback().find((feedback) => feedback.memberId === this.currentMemberId()),
  );

  selectWorkoutHistory(id: number | string): void {
    const workout = this.currentMemberWorkoutHistory().find((item) => item.id === id);
    if (!workout) {
      return;
    }
    this.selectedWorkoutHistoryId.set(id);
    this.feedbackWorkout.set(workout.workout);
  }

  openWorkoutDetails(id: number | string): void {
    const workout = this.currentMemberWorkoutHistory().find((item) => item.id === id);
    if (!workout) {
      return;
    }
    this.selectWorkoutHistory(id);
    if (!this.readWorkoutHistoryIds().includes(id)) {
      if (this.isAuthenticated() && !this.isDemoSession()) {
        const workout = this.currentMemberWorkoutHistory().find((item) => item.id === id);
        if (!workout?.classId) {
          this.showToast('לא ניתן לזהות את האימון לעדכון מצב הקריאה');
          return;
        }
        this.http
          .post(`/api/member/workouts/${workout.classId}/read`, {}, { withCredentials: true })
          .subscribe({
            next: () =>
              this.readWorkoutHistoryIds.update((ids) => (ids.includes(id) ? ids : [...ids, id])),
            error: () => this.showToast('לא ניתן לשמור את מצב הקריאה'),
          });
      } else {
        this.readWorkoutHistoryIds.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
      }
    }
    this.workoutDetailsModalOpen.set(true);
  }

  closeWorkoutDetails(): void {
    this.workoutDetailsModalOpen.set(false);
  }

  openWorkoutFeedback(workoutLabel: string): void {
    const workout = this.currentMemberWorkoutHistory().find(
      (item) => item.workout === workoutLabel,
    );
    if (!workout) {
      return;
    }
    this.selectWorkoutHistory(workout.id);
    const feedback = this.personalFeedback().find(
      (item) => item.memberId === this.currentMemberId() && item.workout === workout.workout,
    );
    const savedAreas = feedback?.painAreas ?? [];
    const firstSavedRegion = this.bodyRegions.find((region) => savedAreas.includes(region.label));
    const bodyView = firstSavedRegion?.view ?? 'front';
    this.feedbackRating.set(feedback?.rating ?? 0);
    this.feedbackNote.set(feedback?.note ?? '');
    this.painReported.set(savedAreas.length > 0);
    this.painIntensity.set(feedback?.painIntensity ?? 'mild');
    this.bodyView.set(bodyView);
    this.selectedPainAreaIds.set(
      this.bodyRegions
        .filter((region) => region.view === bodyView && savedAreas.includes(region.label))
        .map((region) => region.id),
    );
    this.workoutFeedbackModalOpen.set(true);
  }

  closeWorkoutFeedback(): void {
    this.workoutFeedbackModalOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeWorkoutFeedbackOnEscape(): void {
    if (this.workoutFeedbackModalOpen()) {
      this.closeWorkoutFeedback();
      return;
    }
    if (this.workoutDetailsModalOpen()) {
      this.closeWorkoutDetails();
      return;
    }
    if (this.memberDetailsOpen()) {
      this.closeMemberDetails();
      return;
    }
    if (this.memberRemovalConfirmationId() !== null) {
      this.cancelMemberRemoval();
    }
    if (this.attendanceSessionId() !== null) {
      this.closeAttendanceSheet();
    }
  }

  selectTab(tab: string): void {
    const memberTab =
      this.role() === 'member' ? ({ schedule: 'workouts', board: 'updates' }[tab] ?? tab) : tab;
    this.activeTab.set(memberTab);
    this.profileMenuOpen.set(false);
  }

  signOut(): void {
    this.http.post('/api/auth/logout', {}, { withCredentials: true }).subscribe({
      error: () => this.showToast('ההתנתקות המקומית הושלמה; לא ניתן לאמת את סיום הסשן בשרת'),
    });
    this.isAuthenticated.set(false);
    this.isDemoSession.set(false);
    this.role.set('member');
    this.activeTab.set('home');
    this.authMode.set('login');
    this.profileMenuOpen.set(false);
    this.loginMessage.set('');
    this.loadClasses();
  }

  enterDemo(): void {
    this.restoreDemoData();
    this.isDemoSession.set(true);
    this.isAuthenticated.set(true);
    this.switchRole('member');
  }

  enterCoachDemo(): void {
    this.restoreDemoData();
    this.isDemoSession.set(true);
    this.isAuthenticated.set(true);
    this.switchRole('admin');
  }

  private restoreDemoData(): void {
    this.members.set(this.demoData.members);
    this.classes.set(this.demoData.classes);
    this.singleClassPrice.set(this.demoData.singleClassPrice);
    this.classPriceDraft.set(String(this.demoData.singleClassPrice));
    this.trainingPackages.set(this.demoData.trainingPackages);
    this.memberDiscounts.set(this.demoData.memberDiscounts);
    this.memberPayments.set(this.demoData.memberPayments);
    this.workoutHistory.set(this.demoData.workoutHistory);
    this.personalFeedback.set(this.demoData.personalFeedback);
    this.announcements.set(this.demoData.announcements);
    this.latestCoachPost.set(this.demoData.latestCoachPost ?? this.demoCoachPost);
    this.coachPostTitle.set(this.demoCoachPost.title);
    this.coachPostUrl.set(this.demoCoachPost.permalink);
    this.coachPostExplanations.set(this.demoCoachPost.explanations.join('\n'));
    this.currentMemberId.set(2);
    this.readWorkoutHistoryIds.set([]);
    const member = this.demoData.members.find((item) => item.id === 2);
    if (member) {
      this.memberName.set(member.name);
      this.memberEmail.set(member.email);
      this.memberPhone.set(member.phone ?? '');
      this.memberBirthDate.set(member.birthDate ?? '');
      this.memberAddress.set(member.address ?? 'masculine');
      this.memberTrainingSince.set(member.trainingSince ?? '');
    }
  }

  setAuthMode(mode: AuthMode): void {
    this.authMode.set(mode);
    this.loginMessage.set('');
    this.activationMessage.set('');
    this.joinState.set('idle');
  }

  submitLogin(): void {
    const identifier = this.loginEmail().trim();
    if (identifier.length < 3 || !this.loginPassword()) {
      this.loginMessage.set('יש למלא שם משתמש או אימייל וסיסמה.');
      return;
    }
    this.http
      .post<AuthUserResponse>(
        '/api/auth/login',
        { identifier, password: this.loginPassword() },
        { withCredentials: true },
      )
      .subscribe({
        next: (user) => this.openAuthenticatedAccount(user),
        error: () =>
          this.loginMessage.set('שם המשתמש או הסיסמה אינם נכונים, או שהחשבון עדיין לא הופעל.'),
      });
  }

  submitActivation(): void {
    const username = this.activationUsername().trim().toLowerCase();
    const password = this.activationPassword();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      this.activationMessage.set(
        'שם המשתמש צריך להכיל 3–32 אותיות באנגלית, ספרות, נקודה, מקף או קו תחתון.',
      );
      return;
    }
    if (password.length < 12 || password.length > 128) {
      this.activationMessage.set('הסיסמה צריכה להכיל לפחות 12 תווים.');
      return;
    }
    if (password !== this.activationPasswordConfirm()) {
      this.activationMessage.set('הסיסמאות אינן תואמות.');
      return;
    }
    const email = this.activationEmail().trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.activationMessage.set('יש להזין את כתובת האימייל שאליה נשלחה ההזמנה.');
      return;
    }

    this.http
      .post<AuthUserResponse>(
        '/api/auth/activate',
        {
          token: this.invitationToken(),
          email,
          username,
          password,
        },
        { withCredentials: true },
      )
      .subscribe({
        next: (user) => {
          this.openAuthenticatedAccount(user);
          window.history.replaceState({}, document.title, window.location.pathname);
          this.invitationToken.set('');
        },
        error: () =>
          this.activationMessage.set(
            'קישור ההפעלה אינו תקף, פג תוקפו, או שהאימייל אינו תואם להזמנה.',
          ),
      });
  }

  private restoreSession(): void {
    this.http.get<AuthUserResponse>('/api/auth/me', { withCredentials: true }).subscribe({
      next: (user) => this.openAuthenticatedAccount(user),
      error: (error: HttpErrorResponse) => {
        if (error.status !== 401) {
          this.loginMessage.set('לא ניתן לבדוק את ההתחברות מול השרת.');
        }
      },
    });
  }

  private openAuthenticatedAccount(user: AuthUserResponse): void {
    this.isDemoSession.set(false);
    this.latestCoachPost.set(null);
    this.coachPostTitle.set('');
    this.coachPostUrl.set('');
    this.coachPostExplanations.set('');
    this.applyProfile(user);
    if (user.role === 'coach') {
      this.coachName.set(user.name);
      this.coachEmail.set(user.email);
      this.isAuthenticated.set(true);
      this.role.set('admin');
      this.activeTab.set('overview');
      this.profileMenuOpen.set(false);
      this.loginMessage.set('');
      this.loadJoinRequests();
      this.loadClasses();
      this.loadStudioFinance();
      this.loadStudioAnnouncements();
      this.loadLatestSocialPost();
      return;
    }
    this.openMemberAccount(user);
  }

  private openMemberAccount(user: AuthUserResponse): void {
    const existing = this.members().find(
      (member) => member.authId === user.id || member.email === user.email,
    );
    const memberId = existing?.id ?? Date.now();
    const member: Member = {
      id: memberId,
      authId: user.id,
      requestId: user.id,
      name: user.name,
      initials: user.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join(''),
      email: user.email,
      username: user.username,
      joined: existing?.joined ?? 'היום',
      status: 'active',
      points: existing?.points ?? 0,
      attendance: existing?.attendance ?? 0,
      purchasedSessions: existing?.purchasedSessions ?? 0,
      usedSessions: existing?.usedSessions ?? 0,
      address: user.address ?? existing?.address ?? 'masculine',
      phone: user.phone ?? existing?.phone,
      birthDate: user.birthDate ?? existing?.birthDate,
      trainingSince:
        user.trainingSince ?? existing?.trainingSince ?? new Date().toISOString().slice(0, 10),
    };
    this.members.update((members) =>
      existing
        ? members.map((item) => (item.id === memberId ? member : item))
        : [...members, member],
    );
    this.currentMemberId.set(memberId);
    this.workoutHistory.update((items) => items.filter((workout) => workout.memberId !== memberId));
    this.personalFeedback.update((items) =>
      items.filter((feedback) => feedback.memberId !== memberId),
    );
    const firstWorkout = this.workoutHistory().find((workout) => workout.memberId === memberId);
    this.selectedWorkoutHistoryId.set(firstWorkout?.id ?? -1);
    this.feedbackWorkout.set(firstWorkout?.workout ?? '');
    this.memberName.set(user.name);
    this.memberEmail.set(user.email);
    this.memberPhone.set(member.phone ?? '');
    this.memberBirthDate.set(member.birthDate ?? '');
    this.memberTrainingSince.set(member.trainingSince ?? '');
    this.readWorkoutHistoryIds.set([]);
    this.memberAddress.set(member.address ?? 'masculine');
    this.isAuthenticated.set(true);
    this.isDemoSession.set(false);
    this.role.set('member');
    this.activeTab.set('home');
    this.profileMenuOpen.set(false);
    this.loginMessage.set('');
    this.loadClasses();
    this.loadMemberFinance();
    this.loadMemberWorkoutHistory();
    this.loadStudioAnnouncements();
    this.loadLatestSocialPost();
  }

  private applyProfile(profile: AuthUserResponse): void {
    if (profile.role === 'coach') {
      this.coachPhone.set(profile.phone ?? '');
      this.coachBirthDate.set(profile.birthDate ?? '');
      if (profile.address) {
        this.coachAddress.set(profile.address);
      }
    } else {
      this.memberPhone.set(profile.phone ?? '');
      this.memberBirthDate.set(profile.birthDate ?? '');
      this.memberTrainingSince.set(profile.trainingSince ?? '');
      if (profile.address) {
        this.memberAddress.set(profile.address);
      }
    }
    if (profile.reminderEnabled !== undefined) {
      this.reminderEnabled.set(profile.reminderEnabled);
    }
    if (profile.reminderLeadMinutes !== undefined) {
      this.reminderLeadMinutes.set(profile.reminderLeadMinutes);
    }
    if (profile.updatesEnabled !== undefined) {
      this.updatesEnabled.set(profile.updatesEnabled);
    }
  }

  saveSingleClassPrice(): void {
    const price = Number(this.classPriceDraft());
    if (!Number.isFinite(price) || price <= 0) {
      this.showToast('יש להזין מחיר חיובי');
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.patch('/api/studio/pricing', { price }, { withCredentials: true }).subscribe({
        next: () => {
          this.singleClassPrice.set(price);
          this.classPriceDraft.set(String(price));
          this.showToast('מחיר האימון נשמר');
        },
        error: () => this.showToast('לא ניתן לשמור את המחיר'),
      });
      return;
    }
    this.singleClassPrice.set(price);
    this.showToast('מחיר האימון נשמר בדמו');
  }

  updatePackagePrice(id: number | string, rawPrice: string): void {
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price <= 0) {
      this.showToast('יש להזין מחיר חיובי');
      return;
    }
    this.updatePackage(id, { price });
  }

  updatePackageName(id: number | string, rawName: string): void {
    const name = rawName.trim();
    if (!name) {
      this.showToast('שם החבילה לא יכול להיות ריק');
      return;
    }
    this.updatePackage(id, { name });
  }

  updatePackageSessions(id: number | string, rawSessions: string): void {
    const sessions = Number(rawSessions);
    if (!Number.isInteger(sessions) || sessions <= 0) {
      this.showToast('מספר האימונים חייב להיות מספר שלם וחיובי');
      return;
    }
    this.updatePackage(id, { sessions });
  }

  private updatePackage(id: number | string, changes: Partial<TrainingPackage>): void {
    const original = this.trainingPackages().find((item) => item.id === id);
    if (!original) {
      return;
    }
    const updated = { ...original, ...changes };
    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (typeof id !== 'string') {
        this.showToast('לא ניתן לזהות את החבילה בשרת');
        return;
      }
      this.http
        .patch(
          `/api/studio/packages/${id}`,
          {
            name: updated.name,
            sessions: updated.sessions,
            price: updated.price,
          },
          { withCredentials: true },
        )
        .subscribe({
          next: () => this.loadStudioFinance(),
          error: () => this.showToast('לא ניתן לשמור את החבילה'),
        });
      return;
    }
    this.trainingPackages.update((packages) =>
      packages.map((item) => (item.id === id ? updated : item)),
    );
  }

  requestDeleteTrainingPackage(id: number | string): void {
    this.packageDeleteConfirmationId.set(id);
  }

  cancelDeleteTrainingPackage(): void {
    this.packageDeleteConfirmationId.set(null);
  }

  deleteTrainingPackage(id: number | string): void {
    if (this.packageDeleteConfirmationId() !== id) {
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.delete(`/api/studio/packages/${id}`, { withCredentials: true }).subscribe({
        next: () => {
          this.packageDeleteConfirmationId.set(null);
          this.loadStudioFinance();
          this.showToast('החבילה הוסרה מהמחירון');
        },
        error: () => this.showToast('לא ניתן להסיר את החבילה'),
      });
      return;
    }
    const remainingPackages = this.trainingPackages().filter((item) => item.id !== id);
    this.trainingPackages.set(remainingPackages);
    if (this.paymentPackageId() === id) {
      this.paymentPackageId.set(remainingPackages[0]?.id ?? 0);
    }
    this.packageDeleteConfirmationId.set(null);
    this.showToast('החבילה הוסרה מהמחירון');
  }

  addTrainingPackage(): void {
    const name = this.newPackageName().trim();
    const sessions = Number(this.newPackageSessions());
    const price = Number(this.newPackagePrice());
    if (
      !name ||
      !Number.isInteger(sessions) ||
      sessions <= 0 ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      this.showToast('יש למלא שם, מספר אימונים ומחיר תקינים');
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http
        .post('/api/studio/packages', { name, sessions, price }, { withCredentials: true })
        .subscribe({
          next: () => {
            this.clearNewPackageDraft();
            this.loadStudioFinance();
            this.showToast('החבילה נוספה למחירון');
          },
          error: () => this.showToast('לא ניתן להוסיף את החבילה'),
        });
      return;
    }
    this.trainingPackages.update((packages) => [
      ...packages,
      { id: Date.now(), name, sessions, price },
    ]);
    this.clearNewPackageDraft();
    this.showToast('החבילה נוספה למחירון הדמו');
  }

  private clearNewPackageDraft(): void {
    this.newPackageName.set('');
    this.newPackageSessions.set('');
    this.newPackagePrice.set('');
  }

  applyMemberDiscount(): void {
    const memberId = this.discountMemberId();
    const value = Number(this.discountValue());
    const member = this.members().find((item) => item.id === memberId && item.status === 'active');
    if (
      !member ||
      !Number.isFinite(value) ||
      value <= 0 ||
      (this.discountKind() === 'percent' && value > 100)
    ) {
      this.showToast('יש לבחור מתאמן ולהזין הנחה תקינה');
      return;
    }
    const discount: MemberDiscount = {
      id: memberId,
      memberId,
      kind: this.discountKind(),
      value,
      note: this.discountNote().trim(),
    };
    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (!member.authId) {
        this.showToast('לא ניתן לזהות את חשבון המתאמן בשרת');
        return;
      }
      this.http
        .put(
          `/api/studio/members/${member.authId}/discount`,
          { kind: discount.kind, value: discount.value, note: discount.note },
          { withCredentials: true },
        )
        .subscribe({
          next: () => {
            this.discountNote.set('');
            this.loadStudioFinance();
            this.showToast('ההנחה נשמרה');
          },
          error: () => this.showToast('לא ניתן לשמור את ההנחה'),
        });
      return;
    }
    this.memberDiscounts.update((discounts) =>
      discounts.some((item) => item.memberId === memberId)
        ? discounts.map((item) => (item.memberId === memberId ? discount : item))
        : [...discounts, discount],
    );
    this.discountNote.set('');
    this.showToast('ההנחה נשמרה בדמו');
  }

  removeMemberDiscount(id: number): void {
    const discount = this.memberDiscounts().find((item) => item.id === id);
    if (this.isAuthenticated() && !this.isDemoSession() && discount?.authId) {
      this.http
        .delete(`/api/studio/members/${discount.authId}/discount`, { withCredentials: true })
        .subscribe({
          next: () => this.loadStudioFinance(),
          error: () => this.showToast('לא ניתן להסיר את ההנחה'),
        });
      return;
    }
    this.memberDiscounts.update((discounts) => discounts.filter((discount) => discount.id !== id));
  }

  remainingSessions(memberId: number): number {
    const member = this.members().find((item) => item.id === memberId);
    return Math.max((member?.purchasedSessions ?? 0) - (member?.usedSessions ?? 0), 0);
  }

  memberUsagePercent(memberId: number): number {
    const member = this.members().find((item) => item.id === memberId);
    return member?.purchasedSessions
      ? Math.min((member.usedSessions / member.purchasedSessions) * 100, 100)
      : 0;
  }

  memberIncome(memberId: number): number {
    return this.memberPayments()
      .filter((payment) => payment.memberId === memberId)
      .reduce((total, payment) => total + payment.paidAmount, 0);
  }

  paymentMethodLabel(method: PaymentMethod): string {
    switch (method) {
      case 'cash':
        return 'מזומן';
      case 'bit':
        return 'Bit';
      case 'paybox':
        return 'PayBox';
    }
  }

  openMemberPayment(memberId: number): void {
    this.paymentMemberId.set(memberId);
    this.activeTab.set('pricing');
  }

  recordMemberPayment(): void {
    const member = this.members().find(
      (item) => item.id === this.paymentMemberId() && item.status === 'active',
    );
    const isSingleClass = this.paymentPackageId() === 0;
    const packageItem = this.trainingPackages().find((item) => item.id === this.paymentPackageId());
    const packageCount = Number(this.paymentPackageCount());
    if (
      !member ||
      (!packageItem && !isSingleClass) ||
      !Number.isInteger(packageCount) ||
      packageCount <= 0
    ) {
      this.showToast('יש לבחור מתאמן, חבילה וכמות תקינה');
      return;
    }

    const sessions = (packageItem?.sessions ?? 1) * packageCount;
    const grossAmount = (packageItem?.price ?? this.singleClassPrice()) * packageCount;
    const discount = this.memberDiscounts().find((item) => item.memberId === member.id);
    const discountAmount = discount
      ? Math.min(
          discount.kind === 'percent'
            ? (grossAmount * discount.value) / 100
            : discount.value * packageCount,
          grossAmount,
        )
      : 0;
    const payment: MemberPayment = {
      id: Date.now(),
      memberId: member.id,
      memberName: member.name,
      packageName: packageItem?.name ?? 'אימון בודד',
      sessions,
      grossAmount,
      discountAmount,
      paidAmount: grossAmount - discountAmount,
      method: this.paymentMethod(),
      date: new Intl.DateTimeFormat('he-IL').format(new Date()),
    };

    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (!member.authId) {
        this.showToast('לא ניתן לזהות את חשבון המתאמן בשרת');
        return;
      }
      if (this.paymentSaving()) {
        return;
      }
      this.paymentSaving.set(true);
      this.http
        .post<{ sessions: number; paidAmount: number }>(
          '/api/studio/payments',
          {
            memberId: member.authId,
            packageId: isSingleClass ? 0 : String(this.paymentPackageId()),
            packageCount,
            method: this.paymentMethod(),
          },
          { withCredentials: true },
        )
        .subscribe({
          next: (savedPayment) => {
            this.paymentSaving.set(false);
            this.paymentPackageCount.set('1');
            this.loadStudioFinance();
            this.showToast(
              `נרשמו ${savedPayment.sessions} אימונים ותשלום של ₪${savedPayment.paidAmount}`,
            );
          },
          error: () => {
            this.paymentSaving.set(false);
            this.showToast('לא ניתן לתעד את התשלום');
          },
        });
      return;
    }

    this.members.update((members) =>
      members.map((item) =>
        item.id === member.id
          ? { ...item, purchasedSessions: item.purchasedSessions + sessions }
          : item,
      ),
    );
    this.memberPayments.update((payments) => [payment, ...payments]);
    this.paymentPackageCount.set('1');
    this.showToast(`נרשמו ${sessions} אימונים ותשלום של ₪${payment.paidAmount}`);
  }

  openAttendanceSheet(sessionId: number | string): void {
    if (this.classes().some((session) => session.id === sessionId)) {
      this.attendanceSessionId.set(sessionId);
    }
  }

  closeAttendanceSheet(): void {
    this.attendanceSessionId.set(null);
  }

  markClassAttendance(sessionId: number | string, memberId: number | string): void {
    const session = this.classes().find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      const attendee = session.attendees?.find((item) => item.memberId === memberId);
      if (typeof memberId !== 'string' || !attendee || attendee.attended) {
        return;
      }
      this.http
        .post(`/api/classes/${sessionId}/attendance`, { memberId }, { withCredentials: true })
        .subscribe({
          next: () => {
            this.loadClasses();
            this.loadStudioFinance();
            this.showToast(`הנוכחות של ${attendee.name} סומנה`);
          },
          error: () => this.showToast('לא ניתן לשמור נוכחות לשיעור'),
        });
      return;
    }
    const member =
      typeof memberId === 'number'
        ? this.members().find((item) => item.id === memberId && item.status === 'active')
        : undefined;
    if (!member || session.attendedMemberIds.includes(member.id)) {
      return;
    }

    this.classes.update((sessions) =>
      sessions.map((item) =>
        item.id === sessionId
          ? { ...item, attendedMemberIds: [...item.attendedMemberIds, member.id] }
          : item,
      ),
    );
    this.members.update((members) =>
      members.map((item) =>
        item.id === member.id
          ? {
              ...item,
              attendance: item.attendance + 1,
              points: item.points + 10,
              usedSessions: Math.min(item.usedSessions + 1, item.purchasedSessions),
            }
          : item,
      ),
    );

    const workout = `${session.name} · ${session.date}`;
    if (
      !this.workoutHistory().some((item) => item.memberId === member.id && item.workout === workout)
    ) {
      const [year, month, day] = session.dateIso.split('-').map(Number);
      const date = new Date(year, month - 1, day, 12);
      const nextId =
        this.workoutHistory().reduce(
          (highest, item) => Math.max(highest, typeof item.id === 'number' ? item.id : 0),
          0,
        ) + 1;
      this.workoutHistory.update((items) => [
        {
          id: nextId,
          memberId: member.id,
          name: session.name,
          workout,
          date: new Intl.DateTimeFormat('he-IL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }).format(date),
          dateIso: session.dateIso,
          time: session.time,
          coach: session.coach,
          durationMinutes: session.durationMinutes ?? 0,
          coachFeedback: '',
        },
        ...items,
      ]);
    }
    this.showToast(`הנוכחות של ${member.name} סומנה והחבילה עודכנה`);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((isOpen) => !isOpen);
  }

  profileText(key: ProfileCopyKey): string {
    return profileCopyByAddress[key][this.profileAddress()];
  }

  switchRole(role: 'admin' | 'member'): void {
    this.role.set(role);
    this.activeTab.set(role === 'admin' ? 'overview' : 'home');
    this.profileMenuOpen.set(false);
    if (role === 'admin' && !this.isDemoSession()) {
      this.loadJoinRequests();
      this.loadStudioFinance();
      this.loadClasses();
    }
  }

  openCreateClassForm(): void {
    this.editingClassId.set(null);
    this.classNameDraft.set('');
    this.classDateDraft.set(new Date().toISOString().slice(0, 10));
    this.classTimeDraft.set('18:00');
    this.classCoachDraft.set('');
    this.classLocationDraft.set('סטודיו ראשי');
    this.classCapacityDraft.set('12');
    this.classDurationDraft.set('60');
    this.classFormOpen.set(true);
  }

  openEditClassForm(id: number | string): void {
    const session = this.classes().find((item) => item.id === id);
    if (!session) {
      return;
    }
    this.editingClassId.set(id);
    this.classNameDraft.set(session.name);
    this.classDateDraft.set(session.dateIso);
    this.classTimeDraft.set(session.time);
    this.classCoachDraft.set(session.coach);
    this.classLocationDraft.set(session.location);
    this.classCapacityDraft.set(String(session.capacity));
    this.classDurationDraft.set(String(session.durationMinutes ?? 0));
    this.classFormOpen.set(true);
  }

  closeClassForm(): void {
    this.classFormOpen.set(false);
    this.editingClassId.set(null);
  }

  saveClass(): void {
    const name = this.classNameDraft().trim();
    const coach = this.classCoachDraft().trim();
    const location = this.classLocationDraft().trim();
    const dateIso = this.classDateDraft();
    const time = this.classTimeDraft();
    const capacity = Number(this.classCapacityDraft());
    const durationMinutes = Number(this.classDurationDraft());
    const [year, month, day] = dateIso.split('-').map(Number);
    const sessionDate = new Date(year, month - 1, day, 12);
    const validDate =
      sessionDate.getFullYear() === year &&
      sessionDate.getMonth() === month - 1 &&
      sessionDate.getDate() === day;
    if (
      !name ||
      !coach ||
      !location ||
      !validDate ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
      !Number.isInteger(capacity) ||
      capacity <= 0 ||
      capacity > 200 ||
      !Number.isInteger(durationMinutes) ||
      (durationMinutes !== 0 && (durationMinutes < 15 || durationMinutes > 240))
    ) {
      this.showToast('יש למלא פרטים תקינים לכל שדות השיעור');
      return;
    }

    const editingId = this.editingClassId();
    const existing = this.classes().find((item) => item.id === editingId);
    if (existing && capacity < existing.booked) {
      this.showToast(`כבר רשומים ${existing.booked} מתאמנים; הקיבולת לא יכולה להיות נמוכה מכך`);
      return;
    }
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const relativeDay = Math.round((sessionDate.getTime() - today.getTime()) / 86400000);
    const dayLabel =
      relativeDay === 0
        ? 'היום'
        : relativeDay === 1
          ? 'מחר'
          : new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(sessionDate);
    const session: ClassSession = {
      id: existing?.id ?? Date.now(),
      day: dayLabel,
      date: new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' }).format(
        sessionDate,
      ),
      dateIso,
      time,
      name,
      coach,
      location,
      capacity,
      durationMinutes,
      booked: existing?.booked ?? 0,
      reserved: existing?.reserved ?? false,
      attendedMemberIds: existing?.attendedMemberIds ?? [],
    };
    if (this.isAuthenticated() && !this.isDemoSession()) {
      const body = {
        name,
        coach,
        location,
        date: dateIso,
        time,
        capacity,
        durationMinutes,
      };
      const saveRequest = existing
        ? this.http.patch(`/api/classes/${existing.id}`, body, { withCredentials: true })
        : this.http.post('/api/classes', body, { withCredentials: true });
      saveRequest.subscribe({
        next: () => {
          this.closeClassForm();
          this.loadClasses();
          this.showToast(existing ? 'פרטי השיעור עודכנו' : 'השיעור נוסף ללוח');
        },
        error: () => this.showToast('לא ניתן לשמור את השיעור בשרת'),
      });
      return;
    }
    this.classes.update((sessions) =>
      existing
        ? sessions.map((item) => (item.id === existing.id ? session : item))
        : [...sessions, session].sort((left, right) =>
            `${left.dateIso}T${left.time}`.localeCompare(`${right.dateIso}T${right.time}`),
          ),
    );
    this.closeClassForm();
    this.showToast(existing ? 'פרטי השיעור עודכנו' : 'השיעור נוסף ללוח');
  }

  requestCancelClass(id: number | string): void {
    this.confirmClassCancellationId.set(id);
  }

  cancelClassCancellation(): void {
    this.confirmClassCancellationId.set(null);
  }

  cancelClass(id: number | string): void {
    if (this.confirmClassCancellationId() !== id) {
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.delete(`/api/classes/${id}`, { withCredentials: true }).subscribe({
        next: () => {
          this.confirmClassCancellationId.set(null);
          this.loadClasses();
          this.showToast('השיעור בוטל והוסר מלוחות המשתתפים');
        },
        error: () => this.showToast('לא ניתן לבטל את השיעור בשרת'),
      });
      return;
    }
    this.classes.update((sessions) => sessions.filter((session) => session.id !== id));
    this.confirmClassCancellationId.set(null);
    this.showToast('השיעור בוטל והוסר מלוחות המשתתפים');
  }

  cancelReservation(id: number | string): void {
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.delete(`/api/classes/${id}/reservations`, { withCredentials: true }).subscribe({
        next: () => {
          this.loadClasses();
          this.showToast('ההרשמה בוטלה');
        },
        error: () => this.showToast('לא ניתן לבטל את ההרשמה'),
      });
      return;
    }
    this.classes.update((sessions) =>
      sessions.map((session) =>
        session.id === id && session.reserved
          ? { ...session, booked: Math.max(0, session.booked - 1), reserved: false }
          : session,
      ),
    );
    this.showToast('ההרשמה בוטלה בדמו');
  }

  saveMemberDetails(): void {
    const isCoach = this.role() === 'admin';
    const name = (isCoach ? this.coachName() : this.memberName()).trim();
    const email = (isCoach ? this.coachEmail() : this.memberEmail()).trim().toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.showToast('יש לבדוק את השם ואת כתובת האימייל');
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http
        .patch<AuthUserResponse>('/api/auth/profile', this.profilePayload(name, email), {
          withCredentials: true,
        })
        .subscribe({
          next: (profile) => {
            this.applySavedProfile(profile);
            this.showToast('הפרטים האישיים נשמרו');
          },
          error: () => this.showToast('לא ניתן לשמור את הפרטים; בדקי אימייל וטלפון'),
        });
      return;
    }
    if (isCoach) {
      this.coachName.set(name);
      this.coachEmail.set(email);
    } else {
      this.members.update((members) =>
        members.map((member) =>
          member.id === this.currentMemberId()
            ? {
                ...member,
                name,
                email,
                phone: this.memberPhone(),
                birthDate: this.memberBirthDate(),
                address: this.memberAddress(),
                trainingSince: this.memberTrainingSince(),
                initials: name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join(''),
              }
            : member,
        ),
      );
    }
    this.showToast('הפרטים נשמרו בדמו בלבד');
  }

  saveMemberPreferences(): void {
    if (!this.isAuthenticated() || this.isDemoSession()) {
      this.showToast('ההעדפות נשמרו בדמו בלבד');
      return;
    }
    const name = this.role() === 'admin' ? this.coachName().trim() : this.memberName().trim();
    const email =
      this.role() === 'admin'
        ? this.coachEmail().trim().toLowerCase()
        : this.memberEmail().trim().toLowerCase();
    this.http
      .patch<AuthUserResponse>('/api/auth/profile', this.profilePayload(name, email), {
        withCredentials: true,
      })
      .subscribe({
        next: (profile) => {
          this.applySavedProfile(profile);
          this.showToast('ההעדפות נשמרו');
        },
        error: () => this.showToast('לא ניתן לשמור את ההעדפות'),
      });
  }

  private profilePayload(name: string, email: string) {
    return {
      name,
      email,
      phone: this.role() === 'admin' ? this.coachPhone() : this.memberPhone(),
      birthDate: this.role() === 'admin' ? this.coachBirthDate() : this.memberBirthDate(),
      trainingSince: this.memberTrainingSince() || null,
      address: this.role() === 'admin' ? this.coachAddress() : this.memberAddress(),
      reminderEnabled: this.reminderEnabled(),
      reminderLeadMinutes: this.reminderLeadMinutes(),
      updatesEnabled: this.updatesEnabled(),
    };
  }

  private applySavedProfile(profile: AuthUserResponse): void {
    this.applyProfile(profile);
    if (profile.role === 'coach') {
      this.coachName.set(profile.name);
      this.coachEmail.set(profile.email);
      return;
    }
    this.memberName.set(profile.name);
    this.memberEmail.set(profile.email);
    this.members.update((members) =>
      members.map((member) =>
        member.authId === profile.id
          ? {
              ...member,
              name: profile.name,
              email: profile.email,
              phone: profile.phone ?? undefined,
              birthDate: profile.birthDate ?? undefined,
              address: profile.address ?? member.address,
              trainingSince: profile.trainingSince ?? member.trainingSince,
              initials: profile.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join(''),
            }
          : member,
      ),
    );
  }

  updateProfileName(value: string): void {
    if (this.role() === 'admin') {
      this.coachName.set(value);
    } else {
      this.memberName.set(value);
    }
  }

  updateProfileEmail(value: string): void {
    if (this.role() === 'admin') {
      this.coachEmail.set(value);
    } else {
      this.memberEmail.set(value);
    }
  }

  updateProfilePhone(value: string): void {
    if (this.role() === 'admin') {
      this.coachPhone.set(value);
    } else {
      this.memberPhone.set(value);
    }
  }

  updateProfileBirthDate(value: string): void {
    if (this.role() === 'admin') {
      this.coachBirthDate.set(value);
    } else {
      this.memberBirthDate.set(value);
    }
  }

  updateProfileTrainingSince(value: string): void {
    this.memberTrainingSince.set(value);
  }

  updateProfileAddress(value: MemberAddress): void {
    if (this.role() === 'admin') {
      this.coachAddress.set(value);
    } else {
      this.memberAddress.set(value);
    }
  }

  togglePainArea(id: string): void {
    this.selectedPainAreaIds.update((selected) =>
      selected.includes(id) ? selected.filter((areaId) => areaId !== id) : [...selected, id],
    );
  }

  savePersonalWorkoutFeedback(): void {
    if (!this.feedbackRating()) {
      this.showToast('בחרי דירוג לאימון');
      return;
    }
    if (this.painReported() && !this.selectedPainAreas().length) {
      this.showToast('סמני אזור בגוף או בחרי ללא כאב');
      return;
    }

    const feedback: PersonalWorkoutFeedback = {
      id: Date.now(),
      memberId: this.currentMemberId(),
      workout: this.feedbackWorkout(),
      rating: this.feedbackRating(),
      painAreas: this.painReported() ? this.selectedPainAreas().map((area) => area.label) : [],
      painIntensity: this.painReported() ? this.painIntensity() : null,
      note: this.feedbackNote().trim(),
      savedAt: 'היום',
    };
    const workout = this.currentMemberWorkoutHistory().find(
      (item) => item.workout === feedback.workout,
    );
    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (!workout?.classId) {
        this.showToast('לא ניתן לזהות את האימון לשמירת המשוב');
        return;
      }
      this.http
        .post(
          `/api/member/workouts/${workout.classId}/feedback`,
          {
            rating: feedback.rating,
            painAreas: feedback.painAreas,
            painIntensity: feedback.painIntensity,
            note: feedback.note,
          },
          { withCredentials: true },
        )
        .subscribe({
          next: () => {
            this.upsertPersonalWorkoutFeedback(feedback);
            this.workoutFeedbackModalOpen.set(false);
            this.showToast('המשוב נשמר באימון');
          },
          error: () => this.showToast('לא ניתן לשמור את המשוב לאימון'),
        });
      return;
    }
    this.upsertPersonalWorkoutFeedback(feedback);
    this.workoutFeedbackModalOpen.set(false);
    this.showToast('המשוב נשמר בדמו בלבד');
  }

  private upsertPersonalWorkoutFeedback(feedback: PersonalWorkoutFeedback): void {
    this.personalFeedback.update((items) =>
      items.some((item) => item.memberId === feedback.memberId && item.workout === feedback.workout)
        ? items.map((item) =>
            item.memberId === feedback.memberId && item.workout === feedback.workout
              ? { ...feedback, id: item.id }
              : item,
          )
        : [feedback, ...items],
    );
  }

  approveMember(id: number): void {
    if (this.isDemoSession()) {
      this.showToast('אישור בקשות זמין לאחר התחברות כמאמן');
      return;
    }
    const member = this.members().find((item) => item.id === id);
    if (!member?.requestId) {
      this.showToast('לא נמצא מזהה בקשה מהשרת');
      return;
    }
    this.http
      .patch<{ invitationToken: string }>(
        `/api/join-requests/${member.requestId}/approve`,
        {},
        { withCredentials: true },
      )
      .subscribe({
        next: ({ invitationToken }) => {
          const invitationUrl = `${window.location.origin}/?invite=${invitationToken}`;
          this.members.update((members) =>
            members.map((item) =>
              item.id === id ? { ...item, status: 'approved', invitationUrl } : item,
            ),
          );
          this.showToast('הבקשה אושרה. אפשר להעתיק קישור הפעלה');
        },
        error: () => this.showToast('לא ניתן לאשר את הבקשה כרגע'),
      });
  }

  copyInvitationLink(memberId: number): void {
    const member = this.members().find((item) => item.id === memberId);
    const invitationUrl = member?.invitationUrl;
    if (!invitationUrl) {
      if (!member?.requestId || member.status !== 'approved' || this.isDemoSession()) {
        this.showToast('לא נמצא קישור הפעלה');
        return;
      }
      this.http
        .post<{ invitationToken: string }>(
          `/api/join-requests/${member.requestId}/invitation`,
          {},
          { withCredentials: true },
        )
        .subscribe({
          next: ({ invitationToken }) => {
            const refreshedUrl = `${window.location.origin}/?invite=${invitationToken}`;
            this.members.update((members) =>
              members.map((item) =>
                item.id === memberId ? { ...item, invitationUrl: refreshedUrl } : item,
              ),
            );
            this.copyText(refreshedUrl);
          },
          error: () => this.showToast('לא ניתן ליצור קישור הפעלה חדש'),
        });
      return;
    }
    this.copyText(invitationUrl);
  }

  private copyText(invitationUrl: string): void {
    if (!navigator.clipboard) {
      this.showToast(invitationUrl);
      return;
    }
    navigator.clipboard
      .writeText(invitationUrl)
      .then(() => this.showToast('קישור ההפעלה הועתק'))
      .catch(() => this.showToast(invitationUrl));
  }

  removeMember(id: number): void {
    if (this.members().some((member) => member.id === id)) {
      this.memberRemovalConfirmationId.set(id);
    }
  }

  cancelMemberRemoval(): void {
    this.memberRemovalConfirmationId.set(null);
  }

  confirmMemberRemoval(): void {
    const member = this.memberPendingRemoval();
    if (!member) {
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      if (member.authId) {
        const activate = member.status === 'deactivated';
        this.http
          .patch<{ active: boolean }>(
            `/api/studio/members/${member.authId}/status`,
            { active: activate },
            { withCredentials: true },
          )
          .subscribe({
            next: () => {
              this.memberRemovalConfirmationId.set(null);
              this.closeMemberDetails();
              this.loadStudioFinance();
              this.loadClasses();
              this.showToast(
                activate ? 'חשבון המתאמן הופעל מחדש' : 'החשבון הושבת; ההיסטוריה נשמרה',
              );
            },
            error: () =>
              this.showToast(
                activate ? 'לא ניתן להפעיל מחדש את החשבון' : 'לא ניתן להשבית את החשבון',
              ),
          });
        return;
      }
      if (member.requestId) {
        this.http
          .delete(`/api/join-requests/${member.requestId}`, {
            withCredentials: true,
          })
          .subscribe({
            next: () => {
              this.members.update((members) => members.filter((item) => item.id !== member.id));
              this.memberRemovalConfirmationId.set(null);
              this.closeMemberDetails();
              this.showToast('בקשת ההצטרפות הוסרה');
            },
            error: () => this.showToast('לא ניתן להסיר את בקשת ההצטרפות'),
          });
        return;
      }
      this.showToast('לא ניתן לזהות את חשבון המתאמן בשרת');
      return;
    }
    this.members.update((members) => members.filter((item) => item.id !== member.id));
    this.memberPayments.update((payments) =>
      payments.filter((payment) => payment.memberId !== member.id),
    );
    this.memberDiscounts.update((discounts) =>
      discounts.filter((discount) => discount.memberId !== member.id),
    );
    this.workoutHistory.update((workouts) =>
      workouts.filter((workout) => workout.memberId !== member.id),
    );
    this.personalFeedback.update((feedback) =>
      feedback.filter((item) => item.memberId !== member.id),
    );
    this.classes.update((sessions) =>
      sessions.map((session) => ({
        ...session,
        attendedMemberIds: session.attendedMemberIds.filter((id) => id !== member.id),
      })),
    );
    this.closeMemberDetails();
    this.memberRemovalConfirmationId.set(null);
    this.showToast('המתאמן הוסר מהרשימה');
  }

  reserveClass(id: number | string): void {
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.post(`/api/classes/${id}/reservations`, {}, { withCredentials: true }).subscribe({
        next: () => {
          this.loadClasses();
          this.showToast('נרשמת לשיעור. התשלום למאמן אחרי האימון במזומן, Bit או PayBox.');
        },
        error: () => this.showToast('לא ניתן להירשם לשיעור; ייתכן שהוא מלא או שכבר נרשמת'),
      });
      return;
    }
    this.classes.update((sessions) =>
      sessions.map((session) =>
        session.id === id && !session.reserved
          ? { ...session, booked: session.booked + 1, reserved: true }
          : session,
      ),
    );
    this.showToast('נרשמת. התשלום למאמן אחרי האימון במזומן, Bit או PayBox.');
  }

  publishCoachPost(): void {
    const title = this.coachPostTitle().trim();
    const rawUrl = this.coachPostUrl().trim();
    let postUrl: URL;
    try {
      postUrl = new URL(rawUrl);
    } catch {
      this.showToast('יש להזין קישור תקין לפוסט באינסטגרם');
      return;
    }
    const host = postUrl.hostname.toLowerCase();
    const postPath = postUrl.pathname.match(/^\/(p|reel|tv)\/([a-zA-Z0-9_-]+)\/?$/);
    if (
      !title ||
      postUrl.protocol !== 'https:' ||
      !['instagram.com', 'www.instagram.com'].includes(host) ||
      !postPath
    ) {
      this.showToast(
        !title ? 'יש להזין כותרת לפוסט' : 'הקישור חייב להיות לפוסט או ל־Reel באינסטגרם',
      );
      return;
    }
    const postType = postPath[1];
    const postId = postPath[2];
    const permalink = postUrl.toString();
    const embedUrl = new URL(`https://www.instagram.com/${postType}/${postId}/embed/`);
    embedUrl.searchParams.set('hl', 'en');
    const imageIndex = postUrl.searchParams.get('img_index');
    if (imageIndex) {
      embedUrl.searchParams.set('img_index', imageIndex);
    }
    const explanations = this.coachPostExplanations()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const post: CoachPost = {
      title,
      publishedLabel: 'פוסט חדש',
      permalink,
      embedUrl: embedUrl.toString(),
      explanations,
    };
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http
        .put<CoachPostResponse>(
          '/api/studio/social-post',
          { title, permalink, explanations },
          { withCredentials: true },
        )
        .subscribe({
          next: (savedPost) => {
            this.latestCoachPost.set({
              ...post,
              id: savedPost.id,
              createdAt: savedPost.createdAt,
              title: savedPost.title,
              permalink: savedPost.permalink,
              explanations: savedPost.explanations,
            });
            this.coachPostTitle.set(savedPost.title);
            this.coachPostUrl.set(savedPost.permalink);
            this.coachPostExplanations.set(savedPost.explanations.join('\n'));
            this.showToast('הפוסט נשמר בדף הבית של המתאמנים');
          },
          error: () => this.showToast('לא ניתן לשמור את הפוסט'),
        });
      return;
    }
    this.latestCoachPost.set(post);
    this.showToast('הפוסט פורסם בדמו בלבד');
  }

  publishAnnouncement(): void {
    const title = this.announcementTitle().trim();
    const body = this.announcementBody().trim();
    if (!title || !body) {
      this.showToast('יש למלא כותרת והודעה');
      return;
    }
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http
        .post<AnnouncementResponse>(
          '/api/studio/announcements',
          { title, body },
          { withCredentials: true },
        )
        .subscribe({
          next: (announcement) => {
            this.announcements.update((items) => [
              {
                ...announcement,
                date: new Intl.DateTimeFormat('he-IL', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(announcement.createdAt)),
              },
              ...items,
            ]);
            this.announcementTitle.set('');
            this.announcementBody.set('');
            this.showToast('ההודעה פורסמה בלוח');
          },
          error: () => this.showToast('לא ניתן לפרסם את ההודעה'),
        });
      return;
    }
    this.announcements.update((items) => [{ id: Date.now(), title, body, date: 'הרגע' }, ...items]);
    this.announcementTitle.set('');
    this.announcementBody.set('');
    this.showToast('ההודעה פורסמה בדמו בלבד');
  }

  removeAnnouncement(id: number | string): void {
    if (this.isAuthenticated() && !this.isDemoSession()) {
      this.http.delete(`/api/studio/announcements/${id}`, { withCredentials: true }).subscribe({
        next: () => {
          this.announcements.update((items) => items.filter((item) => item.id !== id));
          this.showToast('ההודעה הוסרה');
        },
        error: () => this.showToast('לא ניתן להסיר את ההודעה'),
      });
      return;
    }
    this.announcements.update((items) => items.filter((item) => item.id !== id));
  }
  showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2800);
  }
}
