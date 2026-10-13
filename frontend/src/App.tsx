/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Layers, ChevronRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AttendanceEntry,
  ClassReportSubmission,
  LabRoomStatus,
  LabUsageRecord,
  PCIssueReport,
  PCIssueStatus,
  PCStation,
  ScheduleEntry,
  ScheduleInstructorOption,
  ScheduleLabRoomOption,
  WireframeScreenId,
} from './types';
import { API_BASE_URL, readApiResponse } from './api';
import { RoleSelectionPage } from './pages/RoleSelectionPage';
import { AdminLogin } from './components/AdminComponents/AdminLogin';
import { InstructorLogin } from './components/InstructorComponents/InstructorLogin';
import { LabStaffLogin } from './components/CustodianComponents/LabStaffLogin';
import { StudentLogin } from './components/StudentComponents/StudentLogin';
import { LiveAttendancePage } from './pages/InstructorPages/LiveAttendancePage';
import { InstructorSessionVerificationPage } from './pages/InstructorPages/InstructorSessionVerificationPage';
import { ExportAttendancePage } from './pages/InstructorPages/ExportAttendancePage';
import { StudentClaimPCView } from './pages/StudentPages/PCAssignment';
import { StudentReportIssueView } from './pages/StudentPages/PCFeedbackReport';
import { LabStaffReportDetailView } from './pages/CustodianPages/ComputerReport';
import { LabStaffReportExportView } from './pages/CustodianPages/ExportReport';
import { LabStaffUsagePage } from './pages/CustodianPages/LaboratoryUsages';
import { AdminScheduleModuleView } from './pages/AdminPages/ScheduleManager';
import { AdminTeacherWorkloadView } from './pages/AdminPages/InstructorWorkload';
import { AdminReportsDashboardView } from './pages/AdminPages/ClassReports';
import { AdminStudentsAnalyticsView } from './pages/AdminPages/AnalyticsReport';
import { UserManagement } from './pages/AdminPages/UserManagement';
import { SubjectManagerView } from './pages/AdminPages/SubjectManager';
import { TermManagerView } from './pages/AdminPages/TermManager';
import { ManageRosterView } from './pages/AdminPages/ManageRosterPage';
import { formatAttendanceTime, getAttendanceStatus } from './utils/attendance-time';

interface ApiSchedule {
  id: number;
  instructorId: number;
  labRoomId: number;
  subjectCode: string;
  section: string;
  yearLevel: number;
  termId: number | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  instructor: ScheduleInstructorOption;
  labRoom: ScheduleLabRoomOption;
  term?: {
    id: number;
    academicYear: string;
    semester: string;
    isActive: boolean;
  } | null;
}

interface ApiSession {
  id: number;
  scheduleId: number;
  status: string;
  startTime: string;
  endTime: string | null;
  sessionDate: string;
  schedule: {
    scheduleId: number;
    subjectCode: string;
    section: string;
    yearLevel: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    labRoom: { id: number; roomName: string; capacity: number | null };
    term?: { academicYear: string; semester: string } | null;
  };
}

interface ApiAttendance {
  id: number;
  timeIn: string;
  timeOut: string | null;
  studentProfile: {
    id: number;
    firstName: string;
    lastName: string;
    user: { schoolId: string };
  };
}

interface ApiPcIssue {
  id: number;
  pcNumber: string;
  category: PCIssueReport['category'];
  issueDescription: string;
  status: string;
  staffNotes: string | null;
  reportedAt: string;
  studentProfile: { user: { schoolId: string } };
  activeSession: {
    schedule: {
      subjectCode: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      labRoom: { roomName: string };
    };
  };
}

const normalizePcIssueStatus = (status: string): PCIssueStatus => {
  const normalized = status.toUpperCase();
  return ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(normalized)
    ? normalized as PCIssueStatus
    : 'PENDING';
};

const mapApiPcIssue = (report: ApiPcIssue): PCIssueReport => ({
  id: String(report.id),
  pcNumber: report.pcNumber,
  labRoom: report.activeSession.schedule.labRoom.roomName,
  subjectCode: report.activeSession.schedule.subjectCode,
  classDay: apiDayToShort[report.activeSession.schedule.dayOfWeek] || 'Mon',
  classTimeRange: `${apiTimeToDisplay(report.activeSession.schedule.startTime)} - ${apiTimeToDisplay(report.activeSession.schedule.endTime)}`,
  studentId: report.studentProfile.user.schoolId,
  category: report.category,
  description: report.issueDescription,
  submittedAt: new Date(report.reportedAt).toLocaleString(),
  status: normalizePcIssueStatus(report.status),
  custodianReport: report.staffNotes || undefined,
});

const mapClassReportsToUsageRecords = (reports: ClassReportSubmission[]): LabUsageRecord[] =>
  reports.map((report) => ({
    id: report.id,
    date: report.date,
    timeslot: report.sessionTime,
    laboratory: report.labRoom,
    subject: report.subjectCode,
    subjectName: report.subjectName,
    instructor: report.instructor,
    section: report.section || '',
    yearLevel: report.yearLevel ? String(report.yearLevel) : '',
    status: 'COMPLETED' as const,
    academicYear: report.academicYear || '',
    semester: report.termSemester || report.semester,
    studentsPresent: report.studentsPresent,
    studentsTotal: report.studentsTotal,
    students: report.attendanceList.map((attendance) => ({
      ...attendance,
      timeIn: formatAttendanceTime(new Date(attendance.timeIn)),
      timeOut: attendance.timeOut
        ? formatAttendanceTime(new Date(attendance.timeOut))
        : 'Not recorded',
    })),
  }));

const apiDayToShort: Record<string, ScheduleEntry['day']> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sat',
};

const shortDayToApi: Record<ScheduleEntry['day'], string> = {
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
};

const apiTimeToDisplay = (value: string) => {
  const date = new Date(value);
  const hour = date.getUTCHours();
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${period}`;
};

const displayTimeToApi = (value: string) => {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error('Enter a valid start and end time.');
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
};

const mapApiSchedule = (schedule: ApiSchedule): ScheduleEntry => ({
  id: String(schedule.id),
  instructorId: schedule.instructorId,
  labRoomId: schedule.labRoomId,
  day: apiDayToShort[schedule.dayOfWeek] || 'Mon',
  startTime: apiTimeToDisplay(schedule.startTime),
  endTime: apiTimeToDisplay(schedule.endTime),
  subject: schedule.subjectCode,
  teacher: `${schedule.instructor.firstName} ${schedule.instructor.lastName}`,
  room: schedule.labRoom.roomName,
  department: schedule.instructor.department || '',
  semester: schedule.term ? `${schedule.term.academicYear} ${schedule.term.semester}` : '',
  colorTheme: 'blue',
  termId: schedule.termId,
  section: schedule.section,
  yearLevel: schedule.yearLevel,
} as ScheduleEntry);

const addTwoHours = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '04:00 PM';

  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  const startMinutes = hour * 60 + Number(match[2]);
  const endMinutes = Math.min(startMinutes + 120, 23 * 60 + 59);
  const endHour = Math.floor(endMinutes / 60);
  const period = endHour >= 12 ? 'PM' : 'AM';
  return `${String(endHour % 12 || 12).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')} ${period}`;
};

const WIREFRAME_SCREENS: Array<{
  id: WireframeScreenId;
  label: string;
  roleGroup: string;
}> = [
    { id: 'login-portal', label: '1. login-portal', roleGroup: 'Portal' },
    { id: 'instructor-login', label: 'Instructor login', roleGroup: 'Instructor' },
    { id: 'lab-staff-login', label: 'Lab staff login', roleGroup: 'Lab Staff' },
    { id: 'student-login', label: 'Student login', roleGroup: 'Student' },
    { id: 'admin-login', label: 'Administrator login', roleGroup: 'Admin' },
    {
      id: 'instructor-session-verification',
      label: 'Instructor session verification',
      roleGroup: 'Instructor',
    },
    {
      id: 'instructor-attendance-module',
      label: '2. instructor-attendance-module',
      roleGroup: 'Instructor',
    },
    {
      id: 'instructor-attendance-export',
      label: '3. instructor-attendance-export',
      roleGroup: 'Instructor',
    },
    { id: 'student-claim-pc', label: '4. student-claim-pc', roleGroup: 'Student' },
    { id: 'student-report-issue', label: '5. student-report-issue', roleGroup: 'Student' },
    {
      id: 'lab-staff-report-detail',
      label: '6. lab-staff-report-detail',
      roleGroup: 'Lab Staff',
    },
    {
      id: 'lab-staff-report-export',
      label: '7. lab-staff-report-export',
      roleGroup: 'Lab Staff',
    },
    {
      id: 'lab-staff-records-module',
      label: '8. lab-staff-records-module',
      roleGroup: 'Lab Staff',
    },
    {
      id: 'lab-staff-rooms-module',
      label: '9. lab-staff-rooms-module',
      roleGroup: 'Lab Staff',
    },
    {
      id: 'lab-staff-usage-history',
      label: '9b. lab-staff-usage-history',
      roleGroup: 'Lab Staff',
    },
    { id: 'admin-schedule-module', label: '10. admin-schedule-module', roleGroup: 'Admin' },
    {
      id: 'admin-teacher-workload',
      label: '12. admin-teacher-workload',
      roleGroup: 'Admin',
    },
    {
      id: 'admin-reports-dashboard',
      label: '13. admin-reports-dashboard',
      roleGroup: 'Admin',
    },
    {
      id: 'admin-students-analytics',
      label: '14. admin-students-analytics',
      roleGroup: 'Admin',
    },
    { id: 'admin-user-management', label: 'Admin user management', roleGroup: 'Admin' },
  ];

const LAST_SCREEN_STORAGE_KEY = 'clams.lastScreen';
const INSTRUCTOR_ATTENDANCE_STORAGE_KEY = 'clams.instructorAttendance';
const ROSTER_SCHEDULE_STORAGE_KEY = 'clams.rosterSchedule';
type AuthenticatedRole = 'ADMIN' | 'INSTRUCTOR' | 'CUSTODIAN' | 'STUDENT';

const roleTokenStorageKeys: Record<AuthenticatedRole, string> = {
  ADMIN: 'clams.adminToken',
  INSTRUCTOR: 'clams.instructorToken',
  CUSTODIAN: 'clams.custodianToken',
  STUDENT: 'clams.studentToken',
};

const roleLoginScreens: Record<AuthenticatedRole, WireframeScreenId> = {
  ADMIN: 'admin-login',
  INSTRUCTOR: 'instructor-login',
  CUSTODIAN: 'lab-staff-login',
  STUDENT: 'student-login',
};

const screenPaths: Record<WireframeScreenId, string> = {
  'login-portal': '/',
  'admin-login': '/login/admin',
  'instructor-login': '/login/instructor',
  'lab-staff-login': '/login/custodian',
  'student-login': '/login/student',
  'instructor-session-verification': '/instructor/sessions',
  'instructor-attendance-module': '/instructor/attendance',
  'instructor-attendance-export': '/instructor/attendance/export',
  'student-claim-pc': '/student/laboratory',
  'student-report-history': '/student/reports',
  'student-report-issue': '/student/reports/new',
  'lab-staff-report-detail': '/custodian/pc-issues',
  'lab-staff-report-export': '/custodian/pc-issues/export',
  'lab-staff-records-module': '/custodian/usage-records',
  'lab-staff-rooms-module': '/custodian/lab-rooms',
  'lab-staff-usage-history': '/custodian/laboratory-usages',
  'admin-schedule-module': '/admin/schedules',
  'admin-schedule-add-module': '/admin/schedules/new',
  'admin-schedule-roster': '/admin/schedules/roster',
  'admin-subjects': '/admin/subjects',
  'admin-terms': '/admin/terms',
  'admin-teacher-workload': '/admin/instructor-workload',
  'admin-reports-dashboard': '/admin/class-reports',
  'admin-students-analytics': '/admin/analytics',
  'admin-user-management': '/admin/users',
};

const screensByPath = Object.fromEntries(
  Object.entries(screenPaths).map(([screen, path]) => [path, screen])
) as Record<string, WireframeScreenId>;

const roleHomeScreens: Record<AuthenticatedRole, WireframeScreenId> = {
  ADMIN: 'admin-schedule-module',
  INSTRUCTOR: 'instructor-session-verification',
  CUSTODIAN: 'lab-staff-report-detail',
  STUDENT: 'student-claim-pc',
};

const getScreenRole = (screen: WireframeScreenId): AuthenticatedRole | null => {
  if (screen.startsWith('admin-') && screen !== 'admin-login') return 'ADMIN';
  if (screen.startsWith('instructor-') && screen !== 'instructor-login') return 'INSTRUCTOR';
  if (screen.startsWith('lab-staff-') && screen !== 'lab-staff-login') return 'CUSTODIAN';
  if (screen.startsWith('student-') && screen !== 'student-login') return 'STUDENT';
  return null;
};

const getInitialRosterSchedule = (): ScheduleEntry | null => {
  const savedSchedule = sessionStorage.getItem(ROSTER_SCHEDULE_STORAGE_KEY);
  if (!savedSchedule) return null;
  try {
    const schedule = JSON.parse(savedSchedule) as ScheduleEntry;
    return typeof schedule.id === 'string' ? schedule : null;
  } catch {
    sessionStorage.removeItem(ROSTER_SCHEDULE_STORAGE_KEY);
    return null;
  }
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreenState] = useState<WireframeScreenId>(
    screensByPath[location.pathname] || 'login-portal'
  );
  const setCurrentScreen = (screen: WireframeScreenId) => {
    setCurrentScreenState(screen);
    if (location.pathname !== screenPaths[screen]) navigate(screenPaths[screen]);
  };

  // Instructor Live Attendance State
  const [attendance, setAttendance] = useState<AttendanceEntry[]>([]);

  // Student Seat Claim & Issue Reports State
  const [pcStations, setPcStations] = useState<PCStation[]>([]);
  const [selectedPc, setSelectedPc] = useState<string>('');
  const [isClaimedConfirmed, setIsClaimedConfirmed] = useState<boolean>(false);
  const [currentStudentId, setCurrentStudentId] = useState('');
  const [pcIssueReports, setPcIssueReports] = useState<PCIssueReport[]>([]);

  // Lab Staff & Admin Reports State
  const [classReports, setClassReports] = useState<ClassReportSubmission[]>([]);

  // Admin Schedule State
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [activeInstructorSchedule, setActiveInstructorSchedule] = useState<ScheduleEntry | null>(null);
  const [rosterSchedule, setRosterSchedule] = useState<ScheduleEntry | null>(getInitialRosterSchedule);
  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem('clams.adminToken') || ''
  );
  const [instructorToken, setInstructorToken] = useState(
    () => sessionStorage.getItem('clams.instructorToken') || ''
  );
  const [studentToken, setStudentToken] = useState(
    () => sessionStorage.getItem('clams.studentToken') || ''
  );
  const [custodianToken, setCustodianToken] = useState(
    () => sessionStorage.getItem('clams.custodianToken') || ''
  );
  const [activeInstructorSessionId, setActiveInstructorSessionId] = useState('');
  const [studentSessions, setStudentSessions] = useState<ApiSession[]>([]);
  const [activeStudentSessionId, setActiveStudentSessionId] = useState('');
  const [studentTimedIn, setStudentTimedIn] = useState(false);
  const [studentOccupancyId, setStudentOccupancyId] = useState<number | null>(null);
  const [scheduleInstructors, setScheduleInstructors] = useState<ScheduleInstructorOption[]>([]);
  const [scheduleLabRooms, setScheduleLabRooms] = useState<ScheduleLabRoomOption[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [labRooms, setLabRooms] = useState<LabRoomStatus[]>([]);
  const [roomsRefreshKey, setRoomsRefreshKey] = useState(0);

  useEffect(() => {
    sessionStorage.setItem(LAST_SCREEN_STORAGE_KEY, currentScreen);
  }, [currentScreen]);

  useEffect(() => {
    const routeScreen = screensByPath[location.pathname];
    if (!routeScreen) {
      setCurrentScreen('login-portal');
    } else if (routeScreen !== currentScreen) {
      setCurrentScreenState(routeScreen);
    }
  }, [location.pathname]);

  useEffect(() => {
    const role = getScreenRole(currentScreen);
    if (role && !sessionStorage.getItem(roleTokenStorageKeys[role])) {
      setCurrentScreen(roleLoginScreens[role]);
    }
  }, [currentScreen]);

  useEffect(() => {
    const role = getScreenRole(currentScreen);
    if (role !== 'ADMIN' && role !== 'CUSTODIAN') return;
    const token = role === 'ADMIN' ? adminToken : custodianToken;
    if (!token) return;

    let active = true;
    const restoreRoleData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const response = role === 'ADMIN'
          ? await fetch(`${API_BASE_URL}/sessions/reports`, { headers })
          : await fetch(`${API_BASE_URL}/pc-issues`, { headers });
        const historyResponse = role === 'CUSTODIAN'
          ? await fetch(`${API_BASE_URL}/sessions/reports`, { headers })
          : null;
        if ([response, historyResponse].some((item) => item && (item.status === 401 || item.status === 403))) {
          sessionStorage.removeItem(roleTokenStorageKeys[role]);
          if (role === 'ADMIN') setAdminToken('');
          else setCustodianToken('');
          setCurrentScreen('login-portal');
          return;
        }
        if (!response.ok || (historyResponse && !historyResponse.ok)) throw new Error('Unable to restore role data.');
        if (!active) return;
        if (role === 'ADMIN') {
          const result = await readApiResponse<{ error?: string; reports: ClassReportSubmission[] }>(response);
          setClassReports(result.reports);
          setPcIssueReports([]);
        } else {
          const result = await readApiResponse<{ error?: string; reports: ApiPcIssue[] }>(response);
          const history = await readApiResponse<{ error?: string; reports: ClassReportSubmission[] }>(historyResponse!);
          setPcIssueReports(result.reports.map(mapApiPcIssue));
          setClassReports(history.reports);
        }
      } catch (error) {
        if (active) console.warn('Unable to restore role data.', error);
      }
    };

    void restoreRoleData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!instructorToken || attendance.length === 0) return;
    sessionStorage.setItem(INSTRUCTOR_ATTENDANCE_STORAGE_KEY, JSON.stringify(attendance));
  }, [attendance, instructorToken]);

  const restoreInstructorSessionState = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions?status=ACTIVE`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem('clams.instructorToken');
        setInstructorToken('');
        setCurrentScreen('login-portal');
        return;
      }
      const result = await readApiResponse<{ error?: string; sessions?: Array<{ id: number; schedule: { scheduleId: number; subjectCode: string; section: string; yearLevel: number; dayOfWeek: string; startTime: string; endTime: string; labRoom: { id: number; roomName: string; capacity: number | null }; term?: { academicYear: string; semester: string } | null; instructor?: { firstName: string; lastName: string; department?: string }; }; }> }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to restore your active session.');
      const activeSession = result.sessions?.[0];
      if (!activeSession) {
        const schedulesResponse = await fetch(`${API_BASE_URL}/schedules`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const schedulesResult = await readApiResponse<{ error?: string; schedules: ApiSchedule[] }>(schedulesResponse);
        if (!schedulesResponse.ok) throw new Error(schedulesResult.error || 'Unable to restore your class schedule.');
        setSchedules(schedulesResult.schedules.map(mapApiSchedule));

        if (sessionStorage.getItem(LAST_SCREEN_STORAGE_KEY) === 'instructor-attendance-export') {
          const savedAttendance = sessionStorage.getItem(INSTRUCTOR_ATTENDANCE_STORAGE_KEY);
          if (savedAttendance) {
            const restoredAttendance = JSON.parse(savedAttendance) as AttendanceEntry[];
            if (Array.isArray(restoredAttendance)) {
              setAttendance(restoredAttendance);
              setCurrentScreen('instructor-attendance-export');
              return;
            }
          }
        }
        setCurrentScreen('instructor-session-verification');
        return;
      }

      const restoredSchedule: ScheduleEntry = {
        id: String(activeSession.schedule.scheduleId),
        instructorId: 0,
        labRoomId: activeSession.schedule.labRoom.id,
        day: apiDayToShort[activeSession.schedule.dayOfWeek] || 'Mon',
        startTime: apiTimeToDisplay(activeSession.schedule.startTime),
        endTime: apiTimeToDisplay(activeSession.schedule.endTime),
        subject: activeSession.schedule.subjectCode,
        teacher: activeSession.schedule.instructor
          ? `${activeSession.schedule.instructor.firstName} ${activeSession.schedule.instructor.lastName}`
          : '',
        room: activeSession.schedule.labRoom.roomName,
        department: activeSession.schedule.instructor?.department || '',
        semester: activeSession.schedule.term ? `${activeSession.schedule.term.academicYear} ${activeSession.schedule.term.semester}` : '',
        colorTheme: 'blue',
        termId: null,
        section: activeSession.schedule.section,
        yearLevel: activeSession.schedule.yearLevel,
      } as ScheduleEntry;

      setActiveInstructorSchedule(restoredSchedule);
      setActiveInstructorSessionId(String(activeSession.id));

      const attendanceResponse = await fetch(`${API_BASE_URL}/attendance/session/${activeSession.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const attendanceData = await readApiResponse<{ error?: string; attendance: ApiAttendance[] }>(attendanceResponse);
      if (!attendanceResponse.ok) throw new Error(attendanceData.error || 'Unable to load your attendance log.');

      const occupancyResponse = await fetch(`${API_BASE_URL}/pc-occupancy/session/${activeSession.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const occupancyData = await readApiResponse<{ error?: string; occupancies: Array<{ studentProfileId: number; pcNumber: string }> }>(occupancyResponse);
      if (!occupancyResponse.ok) throw new Error(occupancyData.error || 'Unable to load PC claims.');

      const occupancyByStudent = new Map(
        (occupancyData.occupancies ?? []).map((occupancy) => [String(occupancy.studentProfileId), occupancy.pcNumber])
      );

      setAttendance(attendanceData.attendance.map((item) => ({
        id: String(item.id),
        timeIn: formatAttendanceTime(new Date(item.timeIn)),
        studentId: item.studentProfile.user.schoolId,
        name: `${item.studentProfile.firstName} ${item.studentProfile.lastName}`,
        formalName: `${item.studentProfile.lastName}, ${item.studentProfile.firstName}`,
        pcNumber: occupancyByStudent.get(String(item.studentProfile.id)) || 'None',
        status: getAttendanceStatus(new Date(item.timeIn), restoredSchedule.startTime, restoredSchedule.endTime),
      })));

      setCurrentScreen(sessionStorage.getItem(LAST_SCREEN_STORAGE_KEY) === 'instructor-attendance-export'
        ? 'instructor-attendance-export'
        : 'instructor-attendance-module');
    } catch (error) {
      console.warn('Unable to restore instructor session state.', error);
      setCurrentScreen('instructor-session-verification');
    }
  };

  const resetStudentLabState = () => {
    setStudentSessions([]);
    setActiveStudentSessionId('');
    setStudentTimedIn(false);
    setStudentOccupancyId(null);
    setSelectedPc('');
    setIsClaimedConfirmed(false);
    setPcStations([]);
    setPcIssueReports([]);
    setCurrentStudentId('');
  };

  const restoreStudentSessionState = async (token: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [response, issuesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/sessions/me/active`, { headers }),
        fetch(`${API_BASE_URL}/pc-issues/me`, { headers }),
      ]);
      if ([response, issuesResponse].some((item) => item.status === 401 || item.status === 403)) {
        sessionStorage.removeItem('clams.studentToken');
        sessionStorage.removeItem('clams.studentSchoolId');
        setStudentToken('');
        setCurrentScreen('login-portal');
        return;
      }
      const result = await readApiResponse<{ error?: string; sessions?: ApiSession[] }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to restore your active lab session.');
      const issuesResult = await readApiResponse<{ error?: string; reports: ApiPcIssue[] }>(issuesResponse);
      if (!issuesResponse.ok) throw new Error(issuesResult.error || 'Unable to load your PC issue reports.');
      setPcIssueReports(issuesResult.reports.map(mapApiPcIssue));

      const sessions = result.sessions ?? [];
      const activeSession = sessions[0] ?? null;
      setStudentSessions(sessions);
      setActiveStudentSessionId(activeSession ? String(activeSession.id) : '');
      const studentId = sessionStorage.getItem('clams.studentSchoolId') || currentStudentId || '';
      if (studentId) setCurrentStudentId(studentId);
      if (!activeSession) {
        setStudentTimedIn(false);
        setStudentOccupancyId(null);
        setSelectedPc('');
        setIsClaimedConfirmed(false);
        setPcStations([]);
        setCurrentScreen(['student-report-history', 'student-report-issue'].includes(currentScreen) ? currentScreen : 'student-claim-pc');
        return;
      }

      const [attendanceResponse, availabilityResponse, ownOccupancyResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/pc-occupancy/availability/${activeSession.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/pc-occupancy/me/${activeSession.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [attendanceData, availabilityData, occupancyData] = await Promise.all([
        readApiResponse<{ error?: string; attendance: Array<{ activeSessionId: number; timeOut: string | null }> }>(attendanceResponse),
        readApiResponse<{ error?: string; occupancies: Array<{ pcNumber: string }>; pcs?: Array<{ pcNumber: string; status: string }> }>(availabilityResponse),
        readApiResponse<{ error?: string; occupancy: { id: number; pcNumber: string } | null }>(ownOccupancyResponse),
      ]);

      const responses = [attendanceResponse, availabilityResponse, ownOccupancyResponse];
      const results = [attendanceData, availabilityData, occupancyData];
      for (let index = 0; index < responses.length; index += 1) {
        if (!responses[index].ok) throw new Error(results[index].error || 'Unable to load student lab data.');
      }

      setStudentTimedIn(attendanceData.attendance.some((row) => row.activeSessionId === activeSession.id && !row.timeOut));
      const ownOccupancy = occupancyData.occupancy;
      setStudentOccupancyId(ownOccupancy?.id ?? null);
      setSelectedPc((prev) => (ownOccupancy ? ownOccupancy.pcNumber.replace(/^PC-/, '') : prev));
      setIsClaimedConfirmed(Boolean(ownOccupancy));

      const occupied = new Set(availabilityData.occupancies.map((occupancy) => occupancy.pcNumber));
      const outOfService = new Set(
        (availabilityData.pcs ?? [])
          .filter((pc) => pc.status !== 'AVAILABLE')
          .map((pc) => pc.pcNumber)
      );
      const capacity = Math.max(0, activeSession.schedule.labRoom.capacity ?? 0);
      setPcStations(Array.from({ length: capacity }, (_, index) => {
        const number = String(index + 1);
        const pcNumber = `PC-${number}`;
        const isMine = ownOccupancy?.pcNumber === pcNumber;
        return {
          number,
          status: isMine
            ? 'you'
            : outOfService.has(pcNumber)
              ? 'unavailable'
              : occupied.has(pcNumber)
                ? 'occupied'
                : 'free',
        };
      }));

      setCurrentScreen(['student-report-history', 'student-report-issue'].includes(currentScreen) ? currentScreen : 'student-claim-pc');
    } catch (error) {
      console.warn('Unable to restore student session state.', error);
      setCurrentScreen(['student-report-history', 'student-report-issue'].includes(currentScreen) ? currentScreen : 'student-claim-pc');
    }
  };

  useEffect(() => {
    const savedInstructorToken = sessionStorage.getItem('clams.instructorToken');
    if (savedInstructorToken) {
      setInstructorToken(savedInstructorToken);
      void restoreInstructorSessionState(savedInstructorToken);
    }

    const savedStudentToken = sessionStorage.getItem('clams.studentToken');
    if (savedStudentToken) {
      setStudentToken(savedStudentToken);
      void restoreStudentSessionState(savedStudentToken);
    }
  }, []);

  useEffect(() => {
    if (!studentToken || currentScreen !== 'student-claim-pc') return;

    const intervalId = window.setInterval(() => {
      void restoreStudentSessionState(studentToken);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [studentToken, currentScreen]);

  useEffect(() => {
    if (!adminToken) return;
    let active = true;

    const loadScheduleData = async () => {
      setIsLoadingSchedules(true);
      setScheduleError('');
      try {
        const headers = { Authorization: `Bearer ${adminToken}` };
        const [scheduleResponse, instructorResponse, roomResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/schedules`, { headers }),
          fetch(`${API_BASE_URL}/instructors`, { headers }),
          fetch(`${API_BASE_URL}/lab-rooms`, { headers }),
        ]);
        const [scheduleResult, instructorResult, roomResult] = await Promise.all([
          readApiResponse<{ error?: string; schedules: ApiSchedule[] }>(scheduleResponse),
          readApiResponse<{ error?: string; instructors: ScheduleInstructorOption[] }>(instructorResponse),
          readApiResponse<{ error?: string; labRooms: ScheduleLabRoomOption[] }>(roomResponse),
        ]);
        for (const [response, result] of [
          [scheduleResponse, scheduleResult],
          [instructorResponse, instructorResult],
          [roomResponse, roomResult],
        ] as const) {
          if (!response.ok) throw new Error(result.error || 'Unable to load schedule data.');
        }
        if (!active) return;
        setSchedules(scheduleResult.schedules.map(mapApiSchedule));
        setScheduleInstructors(instructorResult.instructors);
        setScheduleLabRooms(roomResult.labRooms);
      } catch (error) {
        if (active) setScheduleError(error instanceof Error ? error.message : 'Unable to load schedule data.');
      } finally {
        if (active) setIsLoadingSchedules(false);
      }
    };

    void loadScheduleData();
    return () => { active = false; };
  }, [adminToken]);

  useEffect(() => {
    const isOnLabUsage =
      currentScreen === 'lab-staff-rooms-module' ||
      currentScreen === 'lab-staff-usage-history';

    if (!custodianToken || !isOnLabUsage) return;

    let active = true;

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/lab-rooms/status`, {
          headers: { Authorization: `Bearer ${custodianToken}` },
        });
        if (!res.ok) return;
        const data = await readApiResponse<{ rooms: LabRoomStatus[] }>(res);
        if (active) setLabRooms(data.rooms ?? []);
      } catch {
        /* silent — keep last known rooms */
      }
    };

    void load();
    const interval = window.setInterval(load, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [custodianToken, currentScreen, roomsRefreshKey]);

  const handleAdminLogin = async (schoolId: string, password: string) => {
    await handleRoleLogin('ADMIN', schoolId, password);
  };

  const handleRoleLogin = async (
    expectedRole: 'ADMIN' | 'INSTRUCTOR' | 'CUSTODIAN' | 'STUDENT',
    schoolId: string,
    password: string
  ) => {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId, password }),
    });
    const result = await readApiResponse<{
      error?: string;
      token?: string;
      user?: { role?: string };
    }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
    if (result.user?.role !== expectedRole || typeof result.token !== 'string') {
      throw new Error(`These credentials are not for the ${expectedRole.toLowerCase()} portal.`);
    }

    if (expectedRole === 'INSTRUCTOR') {
      const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
        headers: { Authorization: `Bearer ${result.token}` },
      });
      const scheduleResult = await readApiResponse<{ error?: string; schedules: ApiSchedule[] }>(scheduleResponse);
      if (!scheduleResponse.ok) throw new Error(scheduleResult.error || 'Unable to load your class schedule.');
      setSchedules(scheduleResult.schedules.map(mapApiSchedule));
    }

    if (expectedRole === 'STUDENT') {
      const headers = { Authorization: `Bearer ${result.token}` };
      const [sessionsResponse, issuesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/sessions/me/active`, { headers }),
        fetch(`${API_BASE_URL}/pc-issues/me`, { headers }),
      ]);
      const sessionsResult = await readApiResponse<{ error?: string; sessions: ApiSession[] }>(sessionsResponse);
      if (!sessionsResponse.ok) throw new Error(sessionsResult.error || 'Unable to load active class sessions.');
      const issuesResult = await readApiResponse<{ error?: string; reports: ApiPcIssue[] }>(issuesResponse);
      if (!issuesResponse.ok) throw new Error(issuesResult.error || 'Unable to load your PC issue reports.');
      setPcIssueReports(issuesResult.reports.map(mapApiPcIssue));
      setStudentSessions(sessionsResult.sessions);
      const activeSession = sessionsResult.sessions[0];
      const activeSessionId = activeSession ? String(activeSession.id) : '';
      setActiveStudentSessionId(activeSessionId);
      setStudentTimedIn(false);
      setStudentOccupancyId(null);
      setPcStations([]);
      if (activeSessionId) {
        const [attendanceResponse, availabilityResponse, ownOccupancyResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/attendance/me`, { headers: { Authorization: `Bearer ${result.token}` } }),
          fetch(`${API_BASE_URL}/pc-occupancy/availability/${activeSessionId}`, { headers: { Authorization: `Bearer ${result.token}` } }),
          fetch(`${API_BASE_URL}/pc-occupancy/me/${activeSessionId}`, { headers: { Authorization: `Bearer ${result.token}` } }),
        ]);
        const [attendanceData, availabilityData, occupancyData] = await Promise.all([
          readApiResponse<{ error?: string; attendance: Array<{ activeSessionId: number; timeOut: string | null }> }>(attendanceResponse),
          readApiResponse<{ error?: string; occupancies: Array<{ pcNumber: string }>; pcs?: Array<{ pcNumber: string; status: string }> }>(availabilityResponse),
          readApiResponse<{ error?: string; occupancy: { id: number; pcNumber: string } | null }>(ownOccupancyResponse),
        ]);
        const responses = [attendanceResponse, availabilityResponse, ownOccupancyResponse];
        const results = [attendanceData, availabilityData, occupancyData];
        for (let index = 0; index < responses.length; index += 1) {
          if (!responses[index].ok) throw new Error(results[index].error || 'Unable to load student lab data.');
        }
        setStudentTimedIn(attendanceData.attendance.some((row) => row.activeSessionId === activeSession.id && !row.timeOut));
        const ownOccupancy = occupancyData.occupancy;
        setStudentOccupancyId(ownOccupancy?.id ?? null);
        setSelectedPc((prev) => (ownOccupancy ? ownOccupancy.pcNumber.replace(/^PC-/, '') : prev));
        const occupied = new Set(availabilityData.occupancies.map((occupancy) => occupancy.pcNumber));
        const outOfService = new Set(
          (availabilityData.pcs ?? [])
            .filter((pc) => pc.status !== 'AVAILABLE')
            .map((pc) => pc.pcNumber)
        );
        const capacity = Math.max(0, activeSession.schedule.labRoom.capacity ?? 0);
        setPcStations(Array.from({ length: capacity }, (_, index) => {
          const number = String(index + 1);
          const pcNumber = `PC-${number}`;
          const isMine = ownOccupancy?.pcNumber === pcNumber;
          return {
            number,
            status: isMine
              ? 'you'
              : outOfService.has(pcNumber)
                ? 'unavailable'
                : occupied.has(pcNumber)
                  ? 'occupied'
                  : 'free',
          };
        }));
        setIsClaimedConfirmed(Boolean(ownOccupancy));
      }
    }

    if (expectedRole === 'ADMIN') {
      const response = await fetch(`${API_BASE_URL}/sessions/reports`, {
        headers: { Authorization: `Bearer ${result.token}` },
      });
      const data = await readApiResponse<{ error?: string; reports: ClassReportSubmission[] }>(response);
      if (!response.ok) throw new Error(data.error || 'Unable to load completed classes.');
      setClassReports(data.reports);
      setPcIssueReports([]);
    }

    if (expectedRole === 'CUSTODIAN') {
      const headers = { Authorization: `Bearer ${result.token}` };
      const [issuesResponse, reportsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/pc-issues`, { headers }),
        fetch(`${API_BASE_URL}/sessions/reports`, { headers }),
      ]);
      const issuesData = await readApiResponse<{ error?: string; reports: ApiPcIssue[] }>(issuesResponse);
      const reportsData = await readApiResponse<{ error?: string; reports: ClassReportSubmission[] }>(reportsResponse);
      if (!issuesResponse.ok) throw new Error(issuesData.error || 'Unable to load PC issue reports.');
      if (!reportsResponse.ok) throw new Error(reportsData.error || 'Unable to load class session history.');
      setPcIssueReports(issuesData.reports.map(mapApiPcIssue));
      setClassReports(reportsData.reports);
    }

    if (expectedRole === 'ADMIN') {
      sessionStorage.setItem('clams.adminToken', result.token);
      setAdminToken(result.token);
    } else {
      sessionStorage.removeItem('clams.adminToken');
      setAdminToken('');
    }

    if (expectedRole === 'INSTRUCTOR') {
      sessionStorage.setItem('clams.instructorToken', result.token);
      setInstructorToken(result.token);
      await cleanupActiveInstructorSession(result.token);
    } else {
      sessionStorage.removeItem('clams.instructorToken');
      setInstructorToken('');
    }

    if (expectedRole === 'STUDENT') {
      sessionStorage.setItem('clams.studentToken', result.token);
      sessionStorage.setItem('clams.studentSchoolId', schoolId);
      setStudentToken(result.token);
    } else {
      sessionStorage.removeItem('clams.studentToken');
      sessionStorage.removeItem('clams.studentSchoolId');
      setStudentToken('');
    }
    if (expectedRole === 'CUSTODIAN') {
      sessionStorage.setItem('clams.custodianToken', result.token);
    } else {
      sessionStorage.removeItem('clams.custodianToken');
    }
    setCustodianToken(expectedRole === 'CUSTODIAN' ? result.token : '');
    setActiveInstructorSchedule(null);

    if (expectedRole === 'STUDENT') {
      setCurrentStudentId(schoolId);
      setSelectedPc('');
      setIsClaimedConfirmed(false);
    }

    const roleHome: Record<typeof expectedRole, WireframeScreenId> = {
      ADMIN: 'admin-schedule-module',
      INSTRUCTOR: 'instructor-session-verification',
      CUSTODIAN: 'lab-staff-report-detail',
      STUDENT: 'student-claim-pc',
    };
    setCurrentScreen(roleHome[expectedRole]);
  };

  const handleInstructorLogin = (schoolId: string, password: string) =>
    handleRoleLogin('INSTRUCTOR', schoolId, password);

  const handleCustodianLogin = (schoolId: string, password: string) =>
    handleRoleLogin('CUSTODIAN', schoolId, password);

  const handleStudentLogin = (schoolId: string, password: string) =>
    handleRoleLogin('STUDENT', schoolId, password);

  const handleStartInstructorAttendance = async (schedule: ScheduleEntry) => {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId: Number(schedule.id) }),
    });
    const result = await readApiResponse<{ error?: string; session: ApiSession }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to start this class session.');
    const sessionId = String(result.session.id);
    const attendanceResponse = await fetch(`${API_BASE_URL}/attendance/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    const attendanceResult = await readApiResponse<{ error?: string; attendance: ApiAttendance[] }>(attendanceResponse);
    if (!attendanceResponse.ok) throw new Error(attendanceResult.error || 'Unable to load session attendance.');
    const startedAttendance = attendanceResult.attendance.map((item) => {
      const timeIn = new Date(item.timeIn);
      const student = item.studentProfile;
      return {
        id: String(item.id),
        timeIn: formatAttendanceTime(timeIn),
        studentId: student.user.schoolId,
        name: `${student.firstName} ${student.lastName}`,
        formalName: `${student.lastName}, ${student.firstName}`,
        pcNumber: 'None',
        status: getAttendanceStatus(timeIn, schedule.startTime, schedule.endTime),
      };
    });
    sessionStorage.setItem(INSTRUCTOR_ATTENDANCE_STORAGE_KEY, JSON.stringify(startedAttendance));
    setAttendance(startedAttendance);
    setActiveInstructorSchedule(schedule);
    setActiveInstructorSessionId(sessionId);
    setCurrentScreen('instructor-attendance-module');
  };

  const handleScanStudent = (newEntry: AttendanceEntry) => {
    setAttendance((prev) => prev.some((entry) => entry.studentId === newEntry.studentId)
      ? prev
      : [...prev, newEntry]);
  };

  const handleManualStudent = async (schoolId: string): Promise<AttendanceEntry> => {
    if (!activeInstructorSessionId || !activeInstructorSchedule) throw new Error('No active session.');
    const response = await fetch(`${API_BASE_URL}/attendance/manual`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${instructorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSessionId: Number(activeInstructorSessionId), schoolId }),
    });
    const result = await readApiResponse<{
      error?: string;
      attendanceId: number;
      studentId: string;
      studentName: string;
      formalName: string;
      timeIn: string;
    }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to record attendance.');
    const timeIn = new Date(result.timeIn);
    return {
      id: String(result.attendanceId),
      timeIn: formatAttendanceTime(timeIn),
      studentId: result.studentId,
      name: result.studentName,
      formalName: result.formalName,
      pcNumber: 'None',
      status: getAttendanceStatus(timeIn, activeInstructorSchedule.startTime, activeInstructorSchedule.endTime),
    };
  };

  const cleanupActiveInstructorSession = async (tokenOverride = instructorToken) => {
    if (!tokenOverride) return;

    try {
      const response = await fetch(`${API_BASE_URL}/sessions?status=ACTIVE`, {
        headers: { Authorization: `Bearer ${tokenOverride}` },
      });
      const result = await readApiResponse<{ error?: string; sessions?: Array<{ id: number }> }>(response);
      if (!response.ok) {
        console.warn(result.error || 'Unable to load active instructor sessions for cleanup.');
        return;
      }

      const activeSessions = result.sessions ?? [];
      for (const session of activeSessions) {
        const endResponse = await fetch(`${API_BASE_URL}/sessions/${session.id}/end`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${tokenOverride}` },
        });
        const endResult = await readApiResponse<{ error?: string }>(endResponse);
        if (!endResponse.ok && endResult.error !== 'Session already ended.') {
          console.warn(endResult.error || 'Unable to end a stale instructor session.');
        }
      }
    } catch (error) {
      console.warn('Unable to clean up active instructor sessions.', error);
    }
  };

  const refreshInstructorSessionState = async (sessionId = activeInstructorSessionId, token = instructorToken) => {
    if (!sessionId || !token || !activeInstructorSchedule) return;

    try {
      const [attendanceResponse, occupancyResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance/session/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/pc-occupancy/session/${sessionId}?occupied=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [attendanceData, occupancyData] = await Promise.all([
        readApiResponse<{ error?: string; attendance: ApiAttendance[] }>(attendanceResponse),
        readApiResponse<{ error?: string; occupancies: Array<{ studentProfileId: number; pcNumber: string }> }>(occupancyResponse),
      ]);

      if (!attendanceResponse.ok) throw new Error(attendanceData.error || 'Unable to refresh attendance.');
      if (!occupancyResponse.ok) throw new Error(occupancyData.error || 'Unable to refresh PC claims.');

      const occupancyByStudent = new Map(
        (occupancyData.occupancies ?? []).map((occupancy) => [String(occupancy.studentProfileId), occupancy.pcNumber])
      );

      setAttendance(attendanceData.attendance.map((item) => ({
        id: String(item.id),
        timeIn: formatAttendanceTime(new Date(item.timeIn)),
        studentId: item.studentProfile.user.schoolId,
        name: `${item.studentProfile.firstName} ${item.studentProfile.lastName}`,
        formalName: `${item.studentProfile.lastName}, ${item.studentProfile.firstName}`,
        pcNumber: occupancyByStudent.get(String(item.studentProfile.id)) || 'None',
        status: getAttendanceStatus(new Date(item.timeIn), activeInstructorSchedule.startTime, activeInstructorSchedule.endTime),
      })));
    } catch (error) {
      console.warn('Unable to refresh instructor session state.', error);
    }
  };

  useEffect(() => {
    if (!activeInstructorSessionId || !instructorToken || currentScreen !== 'instructor-attendance-module') return;

    const intervalId = window.setInterval(() => {
      void refreshInstructorSessionState(activeInstructorSessionId, instructorToken);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [activeInstructorSessionId, instructorToken, currentScreen, activeInstructorSchedule]);

  const handleEndInstructorSession = async () => {
    if (!activeInstructorSessionId) throw new Error('No active session to end.');
    const response = await fetch(`${API_BASE_URL}/sessions/${activeInstructorSessionId}/end`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${instructorToken}` },
    });
    const result = await readApiResponse<{ error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to end this session.');
    setActiveInstructorSessionId('');
  };

  const handleInstructorLogout = async () => {
    if (instructorToken) {
      await cleanupActiveInstructorSession(instructorToken);
    }

    setAttendance([]);
    setActiveInstructorSchedule(null);
    setActiveInstructorSessionId('');
    sessionStorage.removeItem(INSTRUCTOR_ATTENDANCE_STORAGE_KEY);
    sessionStorage.removeItem('clams.instructorToken');
    setInstructorToken('');
    setCurrentScreen('login-portal');
  };

  const handleStudentLogout = async () => {
    sessionStorage.removeItem('clams.studentToken');
    sessionStorage.removeItem('clams.studentSchoolId');
    setStudentToken('');
    resetStudentLabState();
    setCurrentScreen('login-portal');
  };

  const handleBackToInstructorScheduleSelection = () => {
    setAttendance([]);
    setActiveInstructorSchedule(null);
    setActiveInstructorSessionId('');
    sessionStorage.removeItem(INSTRUCTOR_ATTENDANCE_STORAGE_KEY);
    setCurrentScreen('instructor-session-verification');
  };

  const handleSelectPc = (pcNumber: string) => {
    if (selectedPc !== pcNumber && isClaimedConfirmed) {
      setIsClaimedConfirmed(false);
      if (currentStudentId) {
        setAttendance((prev) =>
          prev.map((entry) =>
            entry.studentId === currentStudentId ? { ...entry, pcNumber: 'None' } : entry
          )
        );
      }
    }
    setSelectedPc(pcNumber);
    setPcStations((prev) =>
      prev.map((pc) => {
        if (pc.number === pcNumber) {
          return {
            ...pc,
            status: 'you',
          };
        }
        if (pc.status === 'you') {
          return {
            ...pc,
            status: 'free',
            occupantName: undefined,
            occupantId: undefined,
          };
        }
        return pc;
      })
    );
  };

  const handleStudentTimeIn = async () => {
    if (!activeStudentSessionId || !studentToken) throw new Error('No active class session is available.');
    const response = await fetch(`${API_BASE_URL}/attendance/time-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSessionId: Number(activeStudentSessionId) }),
    });
    const result = await readApiResponse<{ error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to time in.');
    setStudentTimedIn(true);
  };

  const handleConfirmClaim = async () => {
    if (!activeStudentSessionId || !studentToken || !selectedPc) return;
    if (isClaimedConfirmed && studentOccupancyId) {
      const response = await fetch(`${API_BASE_URL}/pc-occupancy/${studentOccupancyId}/release`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const result = await readApiResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to release this PC.');
      setStudentOccupancyId(null);
      setIsClaimedConfirmed(false);
    } else {
      const response = await fetch(`${API_BASE_URL}/pc-occupancy/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeSessionId: Number(activeStudentSessionId), pcNumber: `PC-${selectedPc}` }),
      });
      const result = await readApiResponse<{ error?: string; occupancy: { id: number } }>(response);
      if (!response.ok) throw new Error(result.error || 'Unable to claim this PC.');
      setStudentOccupancyId(result.occupancy.id);
      setIsClaimedConfirmed(true);
    }
    const availabilityResponse = await fetch(`${API_BASE_URL}/pc-occupancy/availability/${activeStudentSessionId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const availability = await readApiResponse<{ error?: string; occupancies: Array<{ pcNumber: string }> }>(availabilityResponse);
    if (!availabilityResponse.ok) throw new Error(availability.error || 'Unable to refresh PC availability.');
    const occupied = new Set(availability.occupancies.map((occupancy) => occupancy.pcNumber));
    setPcStations((stations) => stations.map((station) => ({
      ...station,
      status: station.number === selectedPc && isClaimedConfirmed
        ? 'free'
        : station.number === selectedPc && !isClaimedConfirmed
          ? 'you'
          : occupied.has(`PC-${station.number}`) ? 'occupied' : 'free',
    })));
  };

  const handleSubmitPcIssue = async (
    category: PCIssueReport['category'],
    description: string
  ): Promise<void> => {
    if (!activeStudentSessionId || !studentToken || !isClaimedConfirmed) throw new Error('Claim a PC in an active session first.');
    const response = await fetch(`${API_BASE_URL}/pc-issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeSessionId: Number(activeStudentSessionId),
        pcNumber: `PC-${selectedPc}`,
        category,
        issueDescription: description,
      }),
    });
    const result = await readApiResponse<{ error?: string; report: ApiPcIssue }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to submit issue report.');

    const report = mapApiPcIssue(result.report);
    setPcIssueReports((previous) => [report, ...previous]);
  };

  const handleUpdatePcIssueStatus = async (reportId: string, status: PCIssueStatus) => {
    const response = await fetch(`${API_BASE_URL}/pc-issues/${reportId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${custodianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const result = await readApiResponse<{ error?: string; report: ApiPcIssue }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to update this PC issue.');
    setPcIssueReports((previous) => previous.map((item) => item.id === reportId ? mapApiPcIssue(result.report) : item));
  };

  const handleSavePcIssueReport = async (reportId: string, custodianReport: string) => {
    const response = await fetch(`${API_BASE_URL}/pc-issues/${reportId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${custodianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffNotes: custodianReport }),
    });
    const result = await readApiResponse<{ error?: string; report: ApiPcIssue }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to save repair notes.');
    setPcIssueReports((previous) => previous.map((item) => item.id === reportId ? mapApiPcIssue(result.report) : item));
  };

  const handleSaveSchedule = async (entry: ScheduleEntry) => {
    const isUpdate = /^\d+$/.test(entry.id) && Number(entry.id) > 0;
    const dayOfWeek = shortDayToApi[entry.day];

    // Cast to read the extra fields we added in the form
    const extended = entry as ScheduleEntry & {
      termId?: number | null;
      section?: string;
      yearLevel?: number;
    };

    const response = await fetch(
      isUpdate ? `${API_BASE_URL}/schedules/${entry.id}` : `${API_BASE_URL}/schedules`,
      {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          instructorId: entry.instructorId,
          labRoomId: entry.labRoomId,
          subjectCode: entry.subject.trim(),
          dayOfWeek,
          startTime: displayTimeToApi(entry.startTime),
          endTime: displayTimeToApi(entry.endTime),
          termId: extended.termId ?? null,
          section: extended.section ?? 'A',
          yearLevel: extended.yearLevel ?? 1,
        }),
      }
    );
    const result = await readApiResponse<{ error?: string; schedule: ApiSchedule }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to save schedule.');
    const savedSchedule = mapApiSchedule(result.schedule);
    setSchedules((current) =>
      isUpdate
        ? current.map((schedule) => (schedule.id === savedSchedule.id ? savedSchedule : schedule))
        : [...current, savedSchedule]
    );
    setScheduleError('');
  };

  const handleManageRoster = (entry: ScheduleEntry) => {
    setRosterSchedule(entry);
    sessionStorage.setItem(ROSTER_SCHEDULE_STORAGE_KEY, JSON.stringify(entry));
    setCurrentScreen('admin-schedule-roster');
  };

  const handleDeleteSchedule = async (scheduleId: string, withRecords = false) => {
    const id = withRecords ? `${scheduleId}?withRecords=true` : scheduleId;
    const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!response.ok) {
      const result = await readApiResponse<{ error?: string }>(response);
      throw new Error(result.error || 'Unable to delete schedule.');
    }
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    setScheduleError('');
  };

  const handleDeleteAllSchedules = async () => {
    const response = await fetch(`${API_BASE_URL}/schedules/all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const result = await readApiResponse<{ error?: string }>(response);
    if (!response.ok) throw new Error(result.error || 'Unable to delete schedules.');
    setSchedules([]);
    setScheduleError('');
  };

  const activeStudentSession = studentSessions.find((session) => String(session.id) === activeStudentSessionId);

  const currentIdx = WIREFRAME_SCREENS.findIndex((s) => s.id === currentScreen);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9]">


      {/* Main Active Screen */}
      <div className="flex-1">
        {currentScreen === 'login-portal' && (
          <RoleSelectionPage onNavigate={setCurrentScreen} />
        )}

        {currentScreen === 'instructor-login' && (
          <InstructorLogin onNavigate={setCurrentScreen} onInstructorLogin={handleInstructorLogin} />
        )}

        {currentScreen === 'instructor-session-verification' && (
          <InstructorSessionVerificationPage
            schedules={schedules}
            onStartAttendance={handleStartInstructorAttendance}
            onNavigate={setCurrentScreen}
            onLogout={handleInstructorLogout}
          />
        )}

        {currentScreen === 'lab-staff-login' && (
          <LabStaffLogin onNavigate={setCurrentScreen} onCustodianLogin={handleCustodianLogin} />
        )}

        {currentScreen === 'student-login' && (
          <StudentLogin onNavigate={setCurrentScreen} onStudentLogin={handleStudentLogin} />
        )}

        {currentScreen === 'admin-login' && (
          <AdminLogin onNavigate={setCurrentScreen} onAdminLogin={handleAdminLogin} />
        )}

        {currentScreen === 'instructor-attendance-module' && (
          <LiveAttendancePage
            attendance={attendance}
            schedule={activeInstructorSchedule}
            activeSessionId={activeInstructorSessionId}
            token={instructorToken}
            onScanStudent={handleScanStudent}
            onManualStudent={handleManualStudent}
            onEndSession={handleEndInstructorSession}
            onNavigate={setCurrentScreen}
            onLogout={handleInstructorLogout}
          />
        )}


        {currentScreen === 'instructor-attendance-export' && (
          <ExportAttendancePage
            attendance={attendance}
            onNavigate={setCurrentScreen}
            onBackToSchedule={handleBackToInstructorScheduleSelection}
          />
        )}

        {currentScreen === 'student-claim-pc' && (
          <StudentClaimPCView
            stations={pcStations}
            activeSessionLabel={activeStudentSession
              ? `${activeStudentSession.schedule.subjectCode} · ${activeStudentSession.schedule.labRoom.roomName}${activeStudentSession.schedule.term ? ` · ${activeStudentSession.schedule.term.academicYear} ${activeStudentSession.schedule.term.semester}` : ''}`
              : ''}
            isTimedIn={studentTimedIn}
            selectedPc={selectedPc}
            isClaimedConfirmed={isClaimedConfirmed}
            onSelectPc={handleSelectPc}
            onTimeIn={handleStudentTimeIn}
            onConfirmClaim={handleConfirmClaim}
            onNavigate={setCurrentScreen}
            onLogout={handleStudentLogout}
          />
        )}

        {['student-report-history', 'student-report-issue'].includes(currentScreen) && (
          <StudentReportIssueView
            selectedPc={selectedPc}
            reports={pcIssueReports}
            canSubmitIssue={currentScreen === 'student-report-issue' && Boolean(activeStudentSessionId) && isClaimedConfirmed}
            onSubmitIssue={handleSubmitPcIssue}
            onNavigate={setCurrentScreen}
            onLogout={handleStudentLogout}
          />
        )}

        {currentScreen === 'lab-staff-report-detail' && (
          <LabStaffReportDetailView
            pcIssueReports={pcIssueReports}
            onUpdatePcIssueStatus={handleUpdatePcIssueStatus}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'lab-staff-report-export' && (
          <LabStaffReportExportView
            reports={pcIssueReports}
            onSaveCustodianReport={handleSavePcIssueReport}
            onNavigate={setCurrentScreen}
          />
        )}

        {(currentScreen === 'lab-staff-rooms-module' || currentScreen === 'lab-staff-usage-history') && (
          <LabStaffUsagePage
            records={mapClassReportsToUsageRecords(classReports)}
            rooms={labRooms}
            token={custodianToken}
            onRoomsChanged={() => setRoomsRefreshKey((key) => key + 1)}
            activeTab={currentScreen === 'lab-staff-usage-history' ? 'history' : 'rooms'}
            onTabChange={(tab) =>
              setCurrentScreen(tab === 'history' ? 'lab-staff-usage-history' : 'lab-staff-rooms-module')
            }
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'admin-schedule-module' && (
          <AdminScheduleModuleView
            schedules={schedules}
            instructors={scheduleInstructors}
            labRooms={scheduleLabRooms}
            token={adminToken}
            onSaveSchedule={handleSaveSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onDeleteAllSchedules={handleDeleteAllSchedules}
            onManageRoster={handleManageRoster}
            isLoading={isLoadingSchedules}
            error={scheduleError}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'admin-teacher-workload' && (
          <AdminTeacherWorkloadView
            token={adminToken}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'admin-reports-dashboard' && (
          <AdminReportsDashboardView
            reports={classReports}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'admin-students-analytics' && (
          <AdminStudentsAnalyticsView token={adminToken} onNavigate={setCurrentScreen} />
        )}

        {currentScreen === 'admin-user-management' && (
          <UserManagement
            adminToken={adminToken}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen === 'admin-terms' && (
        <TermManagerView token={adminToken} onNavigate={setCurrentScreen} />
      )}
      {currentScreen === 'admin-subjects' && (
          <SubjectManagerView token={adminToken} onNavigate={setCurrentScreen} />
        )}

        {currentScreen === 'admin-schedule-roster' && (
          <ManageRosterView
            schedule={rosterSchedule}
            token={adminToken}
            onNavigate={setCurrentScreen}
          />
        )}
      </div>
    </div>
  );
}