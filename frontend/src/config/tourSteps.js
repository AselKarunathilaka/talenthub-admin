// Guided tour steps for TalentHub intern onboarding.
// Each sidebar intro step highlights the sidebar item first; the next step
// navigates to that page and continues with its page-specific guidance.

export const TOUR_STEPS = [
  // --- DASHBOARD ---
  {
    route: '/dashboard',
    element: '[data-tour="sidebar-dashboard"]',
    title: 'Dashboard',
    description: 'This is your Dashboard — it shows your profile information, task performance, and attendance history at a glance.',
    side: 'right'
  },
  {
    route: '/dashboard',
    element: '[data-tour="contact-support"]',
    title: 'Contact Support',
    description: 'Click Contact Support to join the WhatsApp group where you can report and get assistance with TalentHub-related issues.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="personal-info"]',
    title: 'Personal Information',
    description: 'View your personal and internship-related information here.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="training-period"]',
    title: 'Training Period',
    description: 'This section shows your internship training period and relevant dates.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="project-assignments"]',
    title: 'Project Assignments',
    description: 'View the projects you have been assigned to and keep track of your project involvement.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="attendance-performance"]',
    title: 'Attendance & Performance',
    description: 'Track your attendance and overall performance here.\n\n• Non-Developing Interns: Performance = (Logbook Rate + Meeting Attendance Rate) / 2\n• Developing Interns: Performance = (Logbook Rate + Meeting Attendance Rate) / 2 + Extra Commit Contribution (granted when commits exceed working days).',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="recent-activities"]',
    title: 'Recent Activities',
    description: 'Keep track of your latest activities and updates from here.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="logbook-heatmap"]',
    title: 'Daily Logbook Activity Heatmap',
    description: 'Use this heatmap to see your daily logbook submission activity at a glance.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="github-heatmap"]',
    title: 'GitHub Code Commit Activity Heatmap',
    description: 'View your GitHub commit activity and track your coding contributions over time.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="daily-attendance-history"]',
    title: 'Daily Attendance History',
    description: 'Review your daily attendance records and check your attendance history here.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="meeting-attendance-history"]',
    title: 'Meeting Attendance History',
    description: 'View your meeting attendance records and keep track of your participation.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="team-attendance-history"]',
    title: 'Team Attendance History',
    description: 'Check the attendance status of your team members and view team attendance information here.',
    side: 'bottom'
  },

  // --- ATTENDANCE ---
  {
    route: '/attendance',
    element: '[data-tour="sidebar-attendance"]',
    title: 'Attendance',
    description: 'This is the Attendance section, where you mark your daily attendance and meeting attendance using Face ID or a QR code.',
    side: 'right'
  },
  {
    route: '/attendance',
    element: '[data-tour="attendance-location"]',
    title: 'Attendance Location',
    description: 'Attendance can only be marked when the intern is physically within the SLT premises.',
    side: 'bottom'
  },
  {
    route: '/attendance',
    element: '[data-tour="attendance-meeting"]',
    title: 'Meeting Attendance',
    description: 'Meeting attendance is recorded by scanning the QR code provided for the meeting. Click Start Scanner to scan the meeting QR code.',
    side: 'bottom'
  },
  {
    route: '/attendance',
    element: '[data-tour="attendance-daily"]',
    title: 'Daily Attendance',
    description: 'Daily attendance is recorded using Face ID. To check in, scan your face and record your attendance. When checking out, scan your face again to record your check-out.',
    side: 'bottom'
  },
  {
    route: '/attendance',
    element: '[data-tour="attendance-enroll"]',
    title: 'Enroll Here',
    description: 'If you need to update your Face ID profile, use the Enroll Here option to register your face again.',
    side: 'bottom'
  },

  // --- LOG BOOK ---
  {
    route: '/log-book',
    element: '[data-tour="sidebar-logbook"]',
    title: 'Log Book',
    description: 'This is the Log Book, where you record your daily work status, tasks, challenges, and plans for tomorrow.',
    side: 'right'
  },
  {
    route: '/log-book',
    element: '[data-tour="logbook-step-tab-0"]',
    title: 'Work Status',
    description: 'Start by selecting your current work status.',
    side: 'bottom'
  },
  {
    route: '/log-book',
    element: '[data-tour="logbook-step-tab-1"]',
    title: 'Technology Stack',
    description: 'Tap here to move to the Stack step and select the technology or technologies you worked with today.',
    side: 'bottom'
  },
  {
    route: '/log-book',
    element: '[data-tour="logbook-step-tab-2"]',
    title: 'Task Details & Submission',
    description: 'Tap Details to describe the tasks you completed, any challenges you faced, and your plans for tomorrow — then submit your logbook from there.',
    side: 'bottom'
  },
  {
    route: '/log-book',
    element: '[data-tour="logbook-view-records"]',
    title: 'View Records',
    description: 'Use View Records to review your previously submitted logbook entries.',
    side: 'bottom'
  },

  // --- SHORT LEAVE ---
  {
    route: '/leave-requests',
    element: '[data-tour="sidebar-shortleave"]',
    title: 'Short Leave',
    description: 'This is the Short Leave section, where you can request and track short leave from the premises.',
    side: 'right'
  },
  {
    route: '/leave-requests',
    element: '[data-tour="shortleave-new"]',
    title: 'New Request',
    description: 'Use this option to submit a new short-leave request.',
    side: 'bottom'
  },
  {
    route: '/leave-requests',
    element: '[data-tour="shortleave-requests"]',
    title: 'My Requests',
    description: 'View your submitted short-leave requests here, including their status and request details. If you are leaving the premises early, show your approved short-leave pass to Security. You can access your pass from this section.',
    side: 'bottom'
  },

  // --- EXTENDED LEAVE ---
  {
    route: '/study-leave-requests',
    element: '[data-tour="sidebar-extendedleave"]',
    title: 'Extended Leave',
    description: 'This is the Extended Leave section, where you can request and track longer leave periods',
    side: 'right'
  },
  {
    route: '/study-leave-requests',
    element: '[data-tour="extendedleave-new"]',
    title: 'New Request',
    description: 'Use this option to submit a new extended-leave request.',
    side: 'bottom'
  },
  {
    route: '/study-leave-requests',
    element: '[data-tour="extendedleave-requests"]',
    title: 'My Requests',
    description: 'View your submitted extended-leave requests and check their current status and details here.',
    side: 'bottom'
  },

  // --- SEAT RESERVATION ---
  {
    route: '/seat-reservation',
    element: '[data-tour="sidebar-seatreservation"]',
    title: 'Seat Reservation',
    description: 'This is the Seat Reservation section, where you can book a seat for today or reserve one for tomorrow.',
    side: 'right'
  },
  {
    route: '/seat-reservation',
    element: '[data-tour="seat-map"]',
    title: 'Seat Map',
    description: 'Choose a seat from the seat map. White seats are available and can be booked, red seats are already occupied, and ash color seats are locked.',
    side: 'bottom'
  },
  {
    route: '/seat-reservation',
    element: '[data-tour="seat-my-bookings"]',
    title: 'My Bookings',
    description: 'View your current seat booking here. You can cancel your existing booking and reserve another seat if you want to change your seat.\nEach intern can have only one seat booking at a time.',
    side: 'bottom'
  },
  {
    route: '/seat-reservation',
    element: '[data-tour="seat-tomorrow"]',
    title: 'Tomorrow Map',
    description: 'Use the Tomorrow tab to quickly access tomorrow\'s seat map and reserve your seat in advance.',
    side: 'bottom'
  },

  // --- NAVBAR & EXISTING EXTERNAL SIDEBAR FEATURES ---
  {
    route: '/announcements',
    element: '[data-tour="navbar-notifications"]',
    title: 'Notifications',
    description: 'Click the notification icon to view your latest notifications and updates.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="navbar-profile"]',
    title: 'Profile & Profile Photo',
    description: 'Click your profile to update your profile photo or sign out.\nPlease use a clear photo of yourself as your profile picture.',
    side: 'bottom'
  },
  {
    route: '/dashboard',
    element: '[data-tour="sidebar-talenttrail"]',
    title: 'TalentTrail Platform',
    description: 'Click TalentTrail to access the TalentTrail platform and continue to your project-related information.',
    side: 'right'
  },
  {
    route: '/dashboard',
    element: '[data-tour="sidebar-guidelines"]',
    title: 'Guidelines',
    description: 'Click Guidelines to download the guidelines you agreed to.',
    side: 'right'
  },
  {
    route: '/dashboard',
    element: '[data-tour="sidebar-serendib"]',
    title: 'Digital Serendib',
    description: "Click Digital Serendib to visit SLT's Digital Serendib YouTube page.",
    side: 'right'
  },
  {
    route: '/dashboard',
    element: '[data-tour="sidebar-signout"]',
    title: 'Sign Out',
    description: 'You can also sign out of TalentHub from the sidebar.',
    side: 'right'
  },
  {
    route: '/dashboard',
    isCompletionStep: true,
    title: 'Tour Completion',
    description: 'You’re ready to go! Explore TalentHub, stay on track, and make the most of your internship.',
    side: 'center'
  }
];
