export type WireframeScreenId =
  // Portal / login
  | 'login-portal'
  | 'instructor-login'
  | 'lab-staff-login'
  | 'student-login'
  | 'admin-login'
  // Instructor
  | 'instructor-session-verification'
  | 'instructor-attendance-module'
  | 'instructor-attendance-export'
  // Student
  | 'student-claim-pc'
  | 'student-report-history'          // ← NEW
  | 'student-report-issue'
  // Lab staff / Custodian
  | 'lab-staff-report-detail'
  | 'lab-staff-report-export'
  | 'lab-staff-records-module'
  | 'lab-staff-rooms-module'
  | 'lab-staff-usage-history'         // ← NEW
  // Admin
  | 'admin-schedule-module'
  | 'admin-schedule-add-module'
  | 'admin-schedule-roster'
  | 'admin-subjects'
  | 'admin-terms'
  | 'admin-teacher-workload'
  | 'admin-reports-dashboard'
  | 'admin-students-analytics'
  | 'admin-user-management';

export type UserRole = 'ADMIN' | 'STUDENT' | 'INSTRUCTOR' | 'CUSTODIAN';
export type ManagedUserRole = Exclude<UserRole, 'ADMIN'>;

export interface ManagedUser {
  id: number;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  schoolId: string;
  role: UserRole;
  isCurrentUser?: boolean;
}

export interface AttendanceEntry {
  id: string;
  timeIn: string;
  timeOut?: string | null;
  studentId: string;
  name: string;
  formalName: string;
  pcNumber: string;
  status: 'On-Time' | 'Late';
  signed?: boolean;
}

export interface PCStation {
  number: string;
  status: 'occupied' | 'free' | 'you' | 'unavailable';
  occupantName?: string;
  occupantId?: string;
  hasIssue?: boolean;
  issueCategory?: string;
  issueDescription?: string;
}

export type PCIssueStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED';

export interface PCIssueReport {
  id: string;
  pcNumber: string;
  labRoom: string;
  subjectCode?: string;
  classDay?: string;
  classTimeRange?: string;
  studentId: string;
  category: 'Mouse / Keyboard' | 'Monitor' | 'No Power' | 'No Network' | 'Software' | 'Other';
  description: string;
  submittedAt: string;
  status: PCIssueStatus;
  custodianReport?: string;
  resolvedAt?: string;
}

export interface LabUsageRecord {
  id: string;
  date: string;
  timeslot: string;
  laboratory: string;
  subject: string;
  subjectName: string;
  instructor: string;
  section: string;
  yearLevel: string;
  status: 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  academicYear: string;
  semester: string;
  studentsPresent: number;
  studentsTotal: number;
  students: AttendanceEntry[];
}

export interface LabRoomStatus {
  id: string;
  name: string;
  location: string;
  status: 'IN USE' | 'AVAILABLE' | 'MAINTENANCE';
  subject?: string;
  instructor?: string;
  section?: string;
  timeslot?: string;
  availablePcs: number;
  occupiedPcs: number;
  totalPcs: number;
}

export type PcStatus = 'AVAILABLE' | 'UNDER_REPAIR' | 'BROKEN' | 'RETIRED';

export interface Pc {
  id: number;
  labRoomId: number;
  pcNumber: string;
  status: PcStatus;
  notes: string | null;
}

export interface ScheduleEntry {
  id: string;
  instructorId: number;
  labRoomId: number;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  department: string;
  semester: string;
  colorTheme: 'blue' | 'green' | 'amber' | 'purple';
  // ── NEW ──
  termId?: number | null;
  section?: string;
  yearLevel?: number;
}

export interface ScheduleInstructorOption {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
}

export interface ScheduleLabRoomOption {
  id: number;
  roomName: string;
}

export interface TeacherWorkload {
  id: string;
  name: string;
  department: string;
  assignedSubjects: string[];
  totalHours: number;
  status: 'Available' | 'Full Load' | 'On Leave';
  weeklyBreakdown: {
    Monday?: { title: string; detail: string };
    Tuesday?: { title: string; detail: string };
    Wednesday?: { title: string; detail: string };
    Thursday?: { title: string; detail: string };
    Friday?: { title: string; detail: string };
  };
}

export interface ClassReportSubmission {
  id: string;
  date: string;
  subjectCode: string;
  subjectName: string;
  section?: string;
  yearLevel?: number;
  instructor: string;
  labRoom: string;
  sessionTime: string;
  semester: string;
  academicYear?: string;
  termSemester?: string;
  studentsPresent: number;
  studentsTotal: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;
  attendanceList: AttendanceEntry[];
}