import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

type MemberStatus = 'pending' | 'active';

interface Member {
  id: number;
  name: string;
  initials: string;
  email: string;
  joined: string;
  status: MemberStatus;
  points: number;
  attendance: number;
}

interface ClassSession {
  id: number;
  day: string;
  date: string;
  time: string;
  name: string;
  coach: string;
  capacity: number;
  booked: number;
  reserved: boolean;
}

interface Announcement {
  id: number;
  title: string;
  body: string;
  date: string;
}

interface ContentDraft {
  id: number;
  text: string;
  channels: string[];
  fileName: string;
}

@Component({
  selector: 'app-root',
  imports: [DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class App {
  readonly navItems = [
    { id: 'overview', label: 'סקירה' },
    { id: 'schedule', label: 'שיעורים' },
    { id: 'members', label: 'מתאמנים' },
    { id: 'payments', label: 'תשלומים' },
    { id: 'board', label: 'לוח מודעות' },
    { id: 'content', label: 'תוכן לרשתות' },
    { id: 'personal', label: 'האזור שלי' },
    { id: 'join', label: 'בקשת הצטרפות' }
  ];

  readonly activeTab = signal('overview');
  readonly toast = signal('');
  readonly joinName = signal('');
  readonly joinEmail = signal('');
  readonly joinState = signal<'idle' | 'sending' | 'sent' | 'error'>('idle');
  private readonly http = inject(HttpClient);
  readonly pendingMembers = computed(() => this.members().filter((member) => member.status === 'pending'));
  readonly activeMembers = computed(() => this.members().filter((member) => member.status === 'active'));
  readonly currentMember = computed(() => this.members().find((member) => member.id === 2));
  readonly members = signal<Member[]>([
    { id: 1, name: 'תמר לוי', initials: 'תל', email: 'tamar.levy@example.com', joined: 'היום, 09:42', status: 'pending', points: 0, attendance: 0 },
    { id: 2, name: 'נועה כהן', initials: 'נכ', email: 'noa.cohen@example.com', joined: '12 באוג׳', status: 'active', points: 180, attendance: 18 },
    { id: 3, name: 'מיה אברהם', initials: 'מא', email: 'maya.avraham@example.com', joined: '8 באוג׳', status: 'active', points: 125, attendance: 14 },
    { id: 4, name: 'שירה דיין', initials: 'שד', email: 'shira.dayan@example.com', joined: '2 באוג׳', status: 'active', points: 90, attendance: 9 }
  ]);

  requestAccess(): void {
    const name = this.joinName().trim();
    const email = this.joinEmail().trim().toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.joinState.set('error');
      return;
    }

    this.joinState.set('sending');
    this.http.post<{ status: 'pending' }>('/api/join-requests', { name, email }).subscribe({
      next: () => {
        const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
        this.members.update((members) => [{
          id: Date.now(), name, initials, email, joined: 'הרגע', status: 'pending', points: 0, attendance: 0
        }, ...members]);
        this.joinState.set('sent');
      },
      error: () => this.joinState.set('error')
    });
  }

  readonly classes = signal<ClassSession[]>([
    { id: 1, day: 'היום', date: '16.10', time: '18:00', name: 'יוגה זורמת', coach: 'יעל מזרחי', capacity: 12, booked: 9, reserved: false },
    { id: 2, day: 'היום', date: '16.10', time: '19:15', name: 'פילאטיס מזרן', coach: 'נועה לוין', capacity: 10, booked: 8, reserved: false },
    { id: 3, day: 'מחר', date: '17.10', time: '08:30', name: 'כוח וגמישות', coach: 'יעל מזרחי', capacity: 12, booked: 6, reserved: false },
    { id: 4, day: 'שבת', date: '18.10', time: '09:00', name: 'יוגה בוקר', coach: 'דנה רז', capacity: 14, booked: 11, reserved: false }
  ]);

  readonly payments = [
    { name: 'נועה כהן', item: 'חבילת 10 אימונים', date: '15.10.2026', amount: '₪520', status: 'שולם', tone: 'paid' },
    { name: 'מיה אברהם', item: 'אימון חד־פעמי', date: '15.10.2026', amount: '₪75', status: 'שולם', tone: 'paid' },
    { name: 'שירה דיין', item: 'מנוי חודשי', date: '14.10.2026', amount: '₪390', status: 'ממתין', tone: 'pending' }
  ];

  readonly announcements = signal<Announcement[]>([
    { id: 1, title: 'שינוי בשעת שיעור שישי', body: 'השיעור של יום שישי יתחיל השבוע ב־09:00. נתראה על המזרן.', date: 'היום, 08:30' },
    { id: 2, title: 'פותחים אתגר התמדה', body: 'ארבעה אימונים החודש? מחכות לכן נקודות בונוס והפתעה קטנה.', date: 'אתמול' }
  ]);

  readonly contentDrafts = signal<ContentDraft[]>([]);
  readonly selectedChannels = signal<string[]>(['Instagram', 'Facebook']);
  readonly postText = signal('מתחילות את הבוקר עם נשימה, תנועה וקצת זמן לעצמנו. מחכות לכן בסטודיו.');
  readonly videoName = signal('');
  readonly announcementTitle = signal('');
  readonly announcementBody = signal('');
  readonly sumAttendance = (total: number, member: Member): number => total + member.attendance;

  selectTab(tab: string): void {
    this.activeTab.set(tab);
  }

  approveMember(id: number): void {
    this.members.update((members) => members.map((member) => member.id === id ? { ...member, status: 'active' } : member));
    this.showToast('בקשת ההצטרפות אושרה');
  }

  removeMember(id: number): void {
    this.members.update((members) => members.filter((member) => member.id !== id));
    this.showToast('המתאמן הוסר מהרשימה');
  }

  grantPoints(id: number): void {
    this.members.update((members) => members.map((member) => member.id === id
      ? { ...member, points: member.points + 10, attendance: member.attendance + 1 }
      : member));
    this.showToast('האימון סומן ונוספו 10 נקודות');
  }

  reserveClass(id: number): void {
    this.classes.update((sessions) => sessions.map((session) => session.id === id && !session.reserved
      ? { ...session, booked: session.booked + 1, reserved: true }
      : session));
    this.showToast('המקום נשמר בדמו. לא בוצע חיוב');
  }

  toggleChannel(channel: string, checked: boolean): void {
    this.selectedChannels.update((channels) => checked
      ? [...new Set([...channels, channel])]
      : channels.filter((item) => item !== channel));
  }

  onVideoSelected(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.files?.[0]) {
      this.videoName.set(input.files[0].name);
    }
  }

  saveContentDraft(): void {
    const text = this.postText().trim();
    if (!text) {
      this.showToast('יש להוסיף טקסט לפני שמירת הטיוטה');
      return;
    }
    this.contentDrafts.update((drafts) => [{
      id: Date.now(),
      text,
      channels: this.selectedChannels(),
      fileName: this.videoName()
    }, ...drafts]);
    this.showToast('הטיוטה נשמרה. פרסום אוטומטי עדיין לא מחובר');
  }

  publishAnnouncement(): void {
    const title = this.announcementTitle().trim();
    const body = this.announcementBody().trim();
    if (!title || !body) {
      this.showToast('יש למלא כותרת והודעה');
      return;
    }
    this.announcements.update((items) => [{ id: Date.now(), title, body, date: 'הרגע' }, ...items]);
    this.announcementTitle.set('');
    this.announcementBody.set('');
    this.showToast('ההודעה פורסמה בלוח');
  }

  removeAnnouncement(id: number): void {
    this.announcements.update((items) => items.filter((item) => item.id !== id));
  }


  recordWorkout(): void {
    const member = this.currentMember();
    if (member) {
      this.grantPoints(member.id);
    }
  }

  showToast(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => this.toast.set(''), 2800);
  }
}
