require("dotenv").config();

// Fix for MongoDB driver crypto issue in some environments
global.crypto = require("crypto");

const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const User = require("../models/User");
const Role = require("../models/Role");
const Department = require("../models/Department");
const Task = require("../models/Task");
const TaskPreset = require("../models/TaskPreset");
const Holiday = require("../models/Holiday");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const LeaveBalance = require("../models/LeaveBalance");
const TimeEntry = require("../models/TimeEntry");
const Timesheet = require("../models/Timesheet");
const ActiveTimer = require("../models/ActiveTimer");
const Payroll = require("../models/Payroll");
const Setting = require("../models/Setting");
const JobOpening = require("../models/JobOpening");
const Applicant = require("../models/Applicant");
const Interview = require("../models/Interview");
const Onboarding = require("../models/Onboarding");
const MonthlyPlan = require("../models/MonthlyPlan");
const Goal = require("../models/Goal");
const KPI = require("../models/KPI");
const PerformanceReview = require("../models/PerformanceReview");
const ContinuousFeedback = require("../models/ContinuousFeedback");
const Appraisal = require("../models/Appraisal");

const connectDB = require("../config/db");

const TenantData = require("./data/tenants");
const UserData = require("./data/users");
const RoleData = require("./data/roles");
const DepartmentData = require("./data/departments");
const TaskData = require("./data/tasks");
const TaskPresetData = require("./data/task-presets");
const HolidayData = require("./data/holidays");

const {
  randomEnum,
  randomDateBetween,
  randomWorkingDay,
  generateAttendanceDays,
  generateTimeEntries,
  generatePayrollRecord,
} = require("./helpers");

let tenantIds = [];
let userIds = [];
let roleIds = [];
let departmentIds = [];

const clearDB = async () => {
  const staleIndexes = [
    ["attendances", "tenant_1"],
    ["roles", "name_1"],
    ["holidays", "tenant_1"],
    ["leavebalances", "tenant_1"],
    ["leavebalances", "user_1"],
    ["payrolls", "tenant_1"],
    ["payrolls", "user_1"],
  ];
  for (const [collection, index] of staleIndexes) {
    await mongoose.connection.db.collection(collection).dropIndex(index).catch(() => {});
  }
  await Promise.all([
    Attendance.deleteMany({}),
    LeaveRequest.deleteMany({}),
    LeaveBalance.deleteMany({}),
    Payroll.deleteMany({}),
    Task.deleteMany({}),
    TaskPreset.deleteMany({}),
    Holiday.deleteMany({}),
    TimeEntry.deleteMany({}),
    Timesheet.deleteMany({}),
    ActiveTimer.deleteMany({}),
    Setting.deleteMany({}),
    JobOpening.deleteMany({}),
    Applicant.deleteMany({}),
    Interview.deleteMany({}),
    Onboarding.deleteMany({}),
    MonthlyPlan.deleteMany({}),
    Goal.deleteMany({}),
    KPI.deleteMany({}),
    PerformanceReview.deleteMany({}),
    ContinuousFeedback.deleteMany({}),
    Appraisal.deleteMany({}),
    User.deleteMany({}),
    Role.deleteMany({}),
    Department.deleteMany({}),
    Tenant.deleteMany({}),
  ]);
  console.log("All collections cleared");
};

const seed = async () => {
  try {
    await connectDB();
    console.log("MongoDB connected for seeding");

    // Clear existing data if --fresh
    const args = process.argv.slice(2);
    if (args.includes("--fresh") || args.includes("--destroy")) {
      await clearDB();
    }

    // Seed Tenants
    const tenants = await Tenant.insertMany(TenantData);
    tenantIds = tenants.map((t) => t._id);
    console.log(`${tenants.length} tenants seeded`);

    const apexTenant = tenants.find((t) => t.code === "APEX");
    const techbdTenant = tenants.find((t) => t.code === "TECH-BD");

    // Deep-replace tenant placeholders in plain JSON data
    const replaceTenantPlaceholders = (obj) =>
      JSON.parse(
        JSON.stringify(obj)
          .replaceAll("APEX_TENANT_ID_PLACEHOLDER", apexTenant._id.toString())
          .replaceAll("TECH-BD_TENANT_ID_PLACEHOLDER", techbdTenant._id.toString())
      );

    // Map tenant placeholders to actual IDs
    const updatedUsers = UserData.map((u) => {
      if (u.email.includes("apex")) {
        u.tenant = apexTenant._id;
      } else if (u.email.includes("techbd")) {
        u.tenant = techbdTenant._id;
      }
      return u;
    });

    const updatedRoles = replaceTenantPlaceholders(RoleData);

    const updatedDepartments = replaceTenantPlaceholders(DepartmentData);

    // Seed Users
    const users = await User.insertMany(updatedUsers);
    userIds = users.map((u) => u._id);
    console.log(`${users.length} users seeded`);

    // Seed Roles
    const roles = await Role.insertMany(updatedRoles);
    roleIds = roles.map((r) => r._id);
    console.log(`${roles.length} roles seeded`);

    // Seed Departments (resolve user refs by name)
    const userByName = (name) => users.find((u) => u.name === name);
    for (const d of updatedDepartments) {
      if (d.hodName) {
        const hodUser = userByName(d.hodName);
        d.hod = hodUser ? hodUser._id.toString() : undefined;
      }
      for (const team of d.teams || []) {
        const leadUser = userByName(team.leadName);
        team.lead = leadUser ? leadUser._id : undefined;
        team.members = leadUser ? [leadUser._id] : [];
      }
    }
    const departments = await Department.insertMany(updatedDepartments);
    departmentIds = departments.map((d) => d._id);
    console.log(`${departments.length} departments seeded`);

    // Seed Tasks with proper owner references (owner must be in the same tenant)
    const updatedTasks = replaceTenantPlaceholders(TaskData).map((t, i) => {
      const sameTenantUsers = users
        .map((u, idx) => ({ u, id: userIds[idx] }))
        .filter((x) => String(x.u.tenant) === String(t.tenant));
      const byName = sameTenantUsers.find((x) => x.u.name === t.ownerName);
      const pick = byName || (sameTenantUsers.length ? sameTenantUsers[i % sameTenantUsers.length] : null);
      if (pick) {
        t.owner = pick.id;
        t.ownerName = pick.u.name;
      }
      return t;
    });
    const tasks = await Task.insertMany(updatedTasks);
    console.log(`${tasks.length} tasks seeded`);

    // Seed TaskPresets
    const taskPresets = await TaskPreset.insertMany(replaceTenantPlaceholders(TaskPresetData));
    console.log(`${taskPresets.length} task presets seeded`);

    // Seed Holidays
    const holidays = await Holiday.insertMany(replaceTenantPlaceholders(HolidayData));
    console.log(`${holidays.length} holidays seeded`);

    // Seed Attendance (60 days per user)
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      const attendanceDocs = generateAttendanceDays(new Date("2026-09-01"), new Date("2026-10-31")).map((day) => ({
        tenant: userDoc.tenant,
        user: userId,
        userName: userDoc.name,
        ...day,
      }));
      await Attendance.insertMany(attendanceDocs);
    }
    console.log("Attendance data seeded for all users");

    // Seed LeaveRequests (some sample requests)
    const leaveRequests = [
      {
        tenant: apexTenant._id,
        user: userIds[1], // Jane Smith
        applicantName: "Jane Smith",
        dept: "Engineering",
        type: "Sick",
        startDate: new Date("2026-10-10"),
        endDate: new Date("2026-10-12"),
        days: 3,
        duration: "3 working days",
        reason: "Flu",
        status: "Pending Manager",
      },
      {
        tenant: techbdTenant._id,
        user: userIds[8], // Rahman Islam
        applicantName: "Rahman Islam",
        dept: "Human Resources",
        type: "Casual",
        startDate: new Date("2026-10-20"),
        endDate: new Date("2026-10-22"),
        days: 3,
        duration: "3 working days",
        reason: "Family event",
        status: "Pending Manager",
      },
    ];
    await LeaveRequest.insertMany(leaveRequests);
    console.log(`${leaveRequests.length} leave requests seeded`);

    // Seed LeaveBalances
    const leaveBalances = [];
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      leaveBalances.push({
        tenant: userDoc.tenant,
        user: userId,
        year: 2026,
        casualTotal: 10,
        casualUsed: Math.floor(Math.random() * 5),
        sickTotal: 7,
        sickUsed: Math.floor(Math.random() * 3),
        annualTotal: 15,
        annualUsed: Math.floor(Math.random() * 5),
        unpaidUsed: Math.floor(Math.random() * 2),
      });
    }
    await LeaveBalance.insertMany(leaveBalances);
    console.log(`${leaveBalances.length} leave balances seeded`);

    // Seed TimeEntries
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      const sameTenantTasks = tasks.filter((t) => String(t.tenant) === String(userDoc.tenant));
      const taskForUser =
        sameTenantTasks.find((t) => String(t.owner) === userId.toString()) || sameTenantTasks[0] || tasks[0];
      await TimeEntry.insertMany(generateTimeEntries(userDoc.tenant, userId, [taskForUser._id], new Date("2026-10-01"), new Date("2026-10-31")));
    }
    console.log("Time entries seeded for all users");

    // Seed Timesheets
    let timesheetCount = 0;
    for (const userId of userIds) {
      const userDoc = await User.findById(userId);
      await Timesheet.create({
        tenant: userDoc.tenant,
        user: userId,
        userName: userDoc.name,
        weekStart: new Date("2026-10-07"),
        weekEnd: new Date("2026-10-13"),
        weekLabel: "Week 40",
        dailyHours: {
          mon: 8,
          tue: 7.5,
          wed: 9,
          thu: 8,
          fri: 7.5,
          sat: 0,
          sun: 0,
        },
        totalHours: 40,
        status: "Submitted",
        idleFlags: 0,
      });
      timesheetCount++;
    }
    console.log(`${timesheetCount} timesheets seeded`);

    // Seed ActiveTimers (some running, some not)
    let activeTimerCount = 0;
    for (let i = 0; i < userIds.length; i++) {
      const isRunning = i % 3 !== 0;
      const userDoc = await User.findById(userIds[i]);
      const sameTenantTasks = tasks.filter((t) => String(t.tenant) === String(userDoc.tenant));
      const pool = sameTenantTasks.length ? sameTenantTasks : tasks;
      const chosen = pool[i % pool.length];
      const accumulatedSeconds = isRunning ? Math.floor(Math.random() * 3600 * 4) : 0;
      await ActiveTimer.create({
        tenant: userDoc.tenant,
        user: userIds[i],
        task: chosen._id,
        taskTitle: chosen.title,
        startedAt: isRunning ? new Date(Date.now() - accumulatedSeconds * 1000) : undefined,
        lastResumedAt: isRunning ? new Date() : undefined,
        accumulatedSeconds,
        running: isRunning,
        idleDiscardedSeconds: 0,
      });
      activeTimerCount++;
    }
    console.log(`${activeTimerCount} active timers seeded`);

    // Seed Payroll records (3 months)
    const months = ["2026-09", "2026-10", "2026-11"];
    let payrollCount = 0;
    for (let i = 0; i < userIds.length; i++) {
      const userDoc = await User.findById(userIds[i]);
      await Payroll.create(generatePayrollRecord({ tenant: userDoc.tenant, _id: userIds[i], name: userDoc.name, department: userDoc.department }, months[i % months.length]));
      payrollCount++;
    }
    console.log(`${payrollCount} payroll records seeded`);

    // Seed Settings (one per tenant)
    for (const tenant of tenants) {
      await Setting.create({
        tenant: tenant._id,
        idleThresholdSeconds: 60,
        defaultWorkingHours: 8,
        officeStartTime: "09:00",
        lateGraceMinutes: 15,
        monthlySubmissionDay: 25,
        approvalWindowDay: 28,
        overtimeRateMultiplier: 1.5,
        workingDays: [0, 1, 2, 3, 4], // Sun-Thu for TECH-BD
        deductionFormula: "salary × (presentDays − absentDays − leaveDays) / presentDays + overtimeRate × overtimeHours",
        leaveAllowance: { casual: 10, sick: 7, annual: 15 },
        sickCertificateAfterDays: 1,
      });
    }
    console.log(`${tenants.length} settings seeded`);

    // Seed Recruitment & Onboarding Demo Data (Module 2)
    for (const tenant of [apexTenant, techbdTenant]) {
      const tenantUsers = users.filter((u) => u.tenant.toString() === tenant._id.toString());
      const hrUser = tenantUsers.find((u) => u.role === "HR") || tenantUsers[0];
      const managerUser = tenantUsers.find((u) => u.role === "Manager") || tenantUsers[0];

      // 1. Create Job Openings
      const jobs = await JobOpening.insertMany([
        {
          tenant: tenant._id,
          title: "Senior Full Stack Engineer (MERN)",
          department: "Engineering",
          team: "Platform Core",
          location: "On-site (Dhaka)",
          employmentType: "Full-Time",
          experienceLevel: "Senior Level",
          salaryMin: 120000,
          salaryMax: 160000,
          currency: "BDT",
          vacancies: 2,
          deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          description: "We are seeking an experienced MERN Stack Engineer to lead web platform architecture, build scalable microservices, and mentor engineering talent.",
          requirements: ["4+ years React and Node.js experience", "MongoDB schema design & indexing", "RESTful API and JWT authentication"],
          responsibilities: ["Develop robust backend APIs", "Design responsive frontend interfaces", "Lead sprint planning and code reviews"],
          skillsRequired: ["React", "Node.js", "Express", "MongoDB", "TypeScript", "Docker"],
          status: "Published",
          postedBy: hrUser?._id,
          postedByName: hrUser?.name,
        },
        {
          tenant: tenant._id,
          title: "UI/UX Product Designer",
          department: "Design",
          team: "Product Experience",
          location: "Hybrid (Dhaka)",
          employmentType: "Full-Time",
          experienceLevel: "Mid Level",
          salaryMin: 70000,
          salaryMax: 95000,
          currency: "BDT",
          vacancies: 1,
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          description: "Design intuitive user flows, high-fidelity prototypes in Figma, and design systems for enterprise SaaS applications.",
          requirements: ["2+ years UI/UX design experience", "Strong portfolio with web & mobile cases", "Proficiency in Figma and component libraries"],
          responsibilities: ["Create wireframes and mockups", "Conduct user research & testing", "Collaborate with frontend developers"],
          skillsRequired: ["Figma", "Design Systems", "Prototyping", "User Research"],
          status: "Published",
          postedBy: hrUser?._id,
          postedByName: hrUser?.name,
        },
        {
          tenant: tenant._id,
          title: "Technical Support & DevOps Specialist",
          department: "Operations",
          team: "Infrastructure",
          location: "On-site (Dhaka)",
          employmentType: "Full-Time",
          experienceLevel: "Mid Level",
          salaryMin: 65000,
          salaryMax: 85000,
          currency: "BDT",
          vacancies: 1,
          deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          description: "Manage deployment pipelines, Linux server administration, monitoring systems, and resolve technical user queries.",
          requirements: ["Experience with Linux, Docker, and CI/CD pipelines", "Familiarity with cloud hosting and Nginx"],
          responsibilities: ["Monitor system uptime and health", "Automate deployment workflows", "Handle level-2 technical escalation"],
          skillsRequired: ["Linux", "Docker", "CI/CD", "Bash", "Nginx"],
          status: "Published",
          postedBy: hrUser?._id,
          postedByName: hrUser?.name,
        },
        {
          tenant: tenant._id,
          title: "HR & Talent Acquisition Executive",
          department: "Human Resources",
          team: "Talent Team",
          location: "On-site (Dhaka)",
          employmentType: "Full-Time",
          experienceLevel: "Mid Level",
          salaryMin: 50000,
          salaryMax: 65000,
          currency: "BDT",
          vacancies: 1,
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          description: "Source qualified candidates, coordinate interview schedules, and facilitate smooth onboarding transitions for new hires.",
          requirements: ["1-3 years HR or recruitment experience", "Excellent interpersonal and communication skills"],
          responsibilities: ["Post job openings", "Screen candidate resumes", "Coordinate onboarding programs"],
          skillsRequired: ["Talent Sourcing", "Interviewing", "Onboarding", "Communication"],
          status: "Published",
          postedBy: hrUser?._id,
          postedByName: hrUser?.name,
        },
      ]);

      const jobMern = jobs[0];
      const jobDesign = jobs[1];
      const jobHr = jobs[3];

      // 2. Create Applicants across stages
      const app1 = await Applicant.create({
        tenant: tenant._id,
        job: jobMern._id,
        jobTitle: jobMern.title,
        department: jobMern.department,
        name: "Mahmudur Rahman",
        email: `mahmudur.${tenant.code.toLowerCase()}@example.com`,
        phone: "+880 1711 234567",
        currentCompany: "NextGen Software Ltd",
        currentPosition: "Full Stack Developer",
        experienceYears: 4,
        education: "B.Sc in Software Engineering, DIU",
        resumeUrl: "https://example.com/resumes/mahmudur-cv.pdf",
        portfolioUrl: "https://github.com/mahmudur-dev",
        coverLetter: "Excited to apply for the Senior MERN Engineer role. I have delivered multiple high-traffic SaaS products with Node and React.",
        skills: ["React", "Node.js", "MongoDB", "Express", "Docker"],
        source: "LinkedIn",
        status: "Interview",
        rating: 4.5,
        notes: "Passed screening call with flying colors. Strong architecture knowledge.",
      });

      const app2 = await Applicant.create({
        tenant: tenant._id,
        job: jobDesign._id,
        jobTitle: jobDesign.title,
        department: jobDesign.department,
        name: "Farhana Yasmin",
        email: `farhana.${tenant.code.toLowerCase()}@example.com`,
        phone: "+880 1819 876543",
        currentCompany: "Creative Studio BD",
        currentPosition: "Product Designer",
        experienceYears: 3,
        education: "B.Sc in CSE, University of Dhaka",
        resumeUrl: "https://example.com/resumes/farhana-portfolio.pdf",
        portfolioUrl: "https://dribbble.com/farhana-design",
        coverLetter: "Passionate about building intuitive enterprise interfaces and accessible web experiences.",
        skills: ["Figma", "Design Systems", "Wireframing", "User Research"],
        source: "Website",
        status: "Screening",
        rating: 4.0,
        notes: "Impressive portfolio with clean component library samples.",
      });

      const app3 = await Applicant.create({
        tenant: tenant._id,
        job: jobHr._id,
        jobTitle: jobHr.title,
        department: jobHr.department,
        name: "Sadia Afrin",
        email: `sadia.${tenant.code.toLowerCase()}@example.com`,
        phone: "+880 1912 345678",
        currentCompany: "InnoTech Solutions",
        currentPosition: "HR Officer",
        experienceYears: 2,
        education: "BBA in HRM, North South University",
        resumeUrl: "https://example.com/resumes/sadia-cv.pdf",
        skills: ["Recruitment", "HR Operations", "Onboarding", "Employee Relations"],
        source: "Referral",
        status: "Offer",
        rating: 5.0,
        notes: "Exceptional cultural fit and great communication. Offer approved by management.",
        offerDetails: {
          offeredSalary: 60000,
          joiningDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          designation: "HR & Talent Acquisition Executive",
          status: "Pending",
          notes: "Official appointment package sent via email.",
        },
      });

      const app4 = await Applicant.create({
        tenant: tenant._id,
        job: jobMern._id,
        jobTitle: jobMern.title,
        department: jobMern.department,
        name: "Kazi Nabil",
        email: `kazi.nabil.${tenant.code.toLowerCase()}@example.com`,
        phone: "+880 1622 112233",
        currentCompany: "CodeMasters Asia",
        currentPosition: "Lead Developer",
        experienceYears: 5,
        education: "B.Sc in Software Engineering, DIU",
        skills: ["React", "Node.js", "MongoDB", "Redux", "AWS"],
        source: "Job Board",
        status: "Hired",
        rating: 5.0,
        onboardingInitiated: true,
        offerDetails: {
          offeredSalary: 145000,
          joiningDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          designation: "Senior Full Stack Engineer",
          status: "Accepted",
          notes: "Offer accepted. Onboarding underway.",
        },
      });

      // 3. Create Scheduled & Completed Interviews
      await Interview.create({
        tenant: tenant._id,
        applicant: app1._id,
        job: jobMern._id,
        applicantName: app1.name,
        applicantEmail: app1.email,
        jobTitle: jobMern.title,
        stage: "Technical Round",
        title: "Round 1: System Design & MERN Coding Interview",
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        durationMinutes: 60,
        interviewers: managerUser ? [managerUser._id] : [],
        interviewerNames: managerUser ? [managerUser.name] : ["Technical Lead"],
        type: "Online Video (Meet/Zoom)",
        locationOrLink: "https://meet.google.com/xyz-workforce-tech",
        status: "Scheduled",
        feedback: "Prepare questions on MongoDB aggregations, transaction handling, and React state architecture.",
      });

      await Interview.create({
        tenant: tenant._id,
        applicant: app3._id,
        job: jobHr._id,
        applicantName: app3.name,
        applicantEmail: app3.email,
        jobTitle: jobHr.title,
        stage: "HR Round",
        title: "Culture & Organizational Fit Discussion",
        scheduledAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        durationMinutes: 45,
        interviewers: hrUser ? [hrUser._id] : [],
        interviewerNames: hrUser ? [hrUser.name] : ["HR Director"],
        type: "In-Person",
        locationOrLink: "Conference Room 2A, Head Office",
        status: "Completed",
        rating: 5,
        recommendation: "Strong Hire",
        feedback: "Candidate demonstrated thorough knowledge of Bangladesh labor regulations and employee retention strategies. Recommended for offer.",
      });

      // 4. Create Active Onboarding Process for Hired Candidate
      const hiredEmployee = await User.findOne({ email: app4.email.toLowerCase() });
      let employeeUser = hiredEmployee;
      if (!employeeUser) {
        employeeUser = await User.create({
          tenant: tenant._id,
          name: app4.name,
          email: app4.email.toLowerCase(),
          password: "password123",
          role: "Member",
          department: "Engineering",
          dept: "Engineering",
          designation: "Senior Full Stack Engineer",
          empCode: `EMP-0${Math.floor(100 + Math.random() * 900)}`,
          isActive: true,
        });
      }

      await Onboarding.create({
        tenant: tenant._id,
        applicant: app4._id,
        user: employeeUser._id,
        employeeName: app4.name,
        employeeEmail: app4.email,
        department: "Engineering",
        designation: "Senior Full Stack Engineer",
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        mentor: managerUser?._id,
        mentorName: managerUser?.name || "Tech Lead",
        status: "In Progress",
        progressPercentage: 57,
        checklist: [
          {
            title: "Document Verification (NID/Passport, Academic Certificates)",
            category: "Documentation",
            assignedToName: hrUser?.name || "HR Admin",
            isCompleted: true,
            completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            notes: "Verified original B.Sc certificate and National ID card.",
          },
          {
            title: "Employment Agreement & Confidentiality NDA Signing",
            category: "Documentation",
            assignedToName: hrUser?.name || "HR Admin",
            isCompleted: true,
            completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            notes: "Signed appointment letter and NDA archived in employee file.",
          },
          {
            title: "IT Equipment & Workstation Provisioning",
            category: "IT Setup",
            assignedToName: "IT Support Admin",
            isCompleted: true,
            completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            notes: "Issued MacBook Pro M3, 27-inch 4K monitor, and RFID access card.",
          },
          {
            title: "Corporate Email & Communication Tools Setup",
            category: "IT Setup",
            assignedToName: "IT Support Admin",
            isCompleted: true,
            completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            notes: "Google Workspace account active. Added to #engineering and #general Slack channels.",
          },
          {
            title: "HR Orientation & Company Policy Briefing",
            category: "HR Orientation",
            assignedToName: hrUser?.name || "HR Admin",
            isCompleted: false,
            notes: "Scheduled for tomorrow at 11:00 AM.",
          },
          {
            title: "Team Introduction & Mentor / Buddy Assignment",
            category: "Team Training",
            assignedToName: managerUser?.name || "Team Lead",
            isCompleted: false,
            notes: "Introductory 1-on-1 with designated engineering buddy.",
          },
          {
            title: "Development Environment & Project Repositories Setup",
            category: "Team Training",
            assignedToName: managerUser?.name || "Tech Lead",
            isCompleted: false,
            notes: "Clone core repositories and setup local Docker development stack.",
          },
        ],
        welcomeNotes: `Welcome to the Engineering team, ${app4.name}! We're thrilled to have you lead our platform initiatives.`,
      });
    }
    console.log("Recruitment & Onboarding demo data seeded");

    // ==========================================
    // SEED MODULE: MONTHLY PLANNING & PERFORMANCE MANAGEMENT (Member 2: Anindita Ghosh Mridu)
    // ==========================================
    for (const tId of tenantIds) {
      const tenantUsers = await User.find({ tenant: tId });
      if (tenantUsers.length === 0) continue;

      const adminUser = tenantUsers.find((u) => ["Super Admin", "Admin"].includes(u.role)) || tenantUsers[0];
      const managerUser = tenantUsers.find((u) => u.role === "Manager") || adminUser;
      const memberUser = tenantUsers.find((u) => u.role === "Member") || tenantUsers[1] || adminUser;
      const hrUser = tenantUsers.find((u) => u.role === "HR") || adminUser;

      // 1. Monthly Plans
      await MonthlyPlan.create([
        {
          tenant: tId,
          title: "Q4 Core Platform Modernization & Microservices Sprint",
          monthCycle: "2026-11",
          year: 2026,
          month: 11,
          department: "Engineering",
          team: "Backend & Cloud",
          lead: managerUser._id,
          leadName: managerUser.name,
          description: "Scale backend architecture, migrate legacy modules to multi-tenant schemas, and optimize query latency.",
          objectives: [
            "Achieve < 100ms API response latency on all authenticated endpoints",
            "Deliver 100% test coverage for Monthly Planning and Performance modules",
            "Implement multi-tenant data isolation and audit logging",
            "Deploy Redis caching for workforce dashboard metrics",
          ],
          priority: "High",
          status: "In Progress",
          totalPlannedHours: 320,
          totalActualHours: 285,
          targetBudget: 150000,
          actualCost: 132000,
          progressPercentage: 85,
          schedules: [
            {
              title: "Week 1: Sprint Architecture & Multi-Tenant Schema Design",
              weekNumber: 1,
              startDate: new Date("2026-11-01"),
              endDate: new Date("2026-11-07"),
              deliverables: "ERD diagram, Mongoose schemas, initial migration scripts",
              milestone: "Database Schema Approved",
              status: "Completed",
              plannedHours: 80,
              actualHours: 76,
              notes: "Completed ahead of schedule with zero breaking changes.",
            },
            {
              title: "Week 2: Backend REST APIs & RBAC Guard Implementation",
              weekNumber: 2,
              startDate: new Date("2026-11-08"),
              endDate: new Date("2026-11-14"),
              deliverables: "Monthly Planning and Performance controllers with tenant scoping",
              milestone: "API Integration Ready",
              status: "Completed",
              plannedHours: 85,
              actualHours: 82,
              notes: "Integration tests passing against mock and test database.",
            },
            {
              title: "Week 3: React Vite Frontend UI & Analytics Dashboards",
              weekNumber: 3,
              startDate: new Date("2026-11-15"),
              endDate: new Date("2026-11-21"),
              deliverables: "Responsive tabs, KPI tracking sliders, Review workflows",
              milestone: "UI Components Verification",
              status: "In Progress",
              plannedHours: 80,
              actualHours: 72,
              notes: "Interactive modal dialogues and stats charts implemented.",
            },
            {
              title: "Week 4: QA End-to-End Testing & Production Deployment",
              weekNumber: 4,
              startDate: new Date("2026-11-22"),
              endDate: new Date("2026-11-28"),
              deliverables: "Load testing, Docker compose release, deployment documentation",
              milestone: "Release 2.4 Production Launch",
              status: "Pending",
              plannedHours: 75,
              actualHours: 55,
              notes: "Staging deployment scheduled for next week.",
            },
          ],
          assignments: [
            {
              employee: memberUser._id,
              employeeName: memberUser.name,
              employeeEmail: memberUser.email,
              roleInPlan: "Core Fullstack Engineer",
              department: "Engineering",
              targetHours: 120,
              actualHours: 110,
              assignedTasksCount: 10,
              completedTasksCount: 9,
              completionRate: 90,
              status: "In Progress",
              deliverables: "Develop REST endpoints, data models, and reactive frontend widgets.",
              notes: "Consistently delivering high code quality and meeting daily targets.",
            },
            {
              employee: managerUser._id,
              employeeName: managerUser.name,
              employeeEmail: managerUser.email,
              roleInPlan: "Technical Lead & Reviewer",
              department: "Engineering",
              targetHours: 80,
              actualHours: 78,
              assignedTasksCount: 6,
              completedTasksCount: 6,
              completionRate: 100,
              status: "Completed",
              deliverables: "Sprint roadmap, architecture reviews, and PR approvals.",
              notes: "All PRs reviewed within 2 hours of submission.",
            },
            {
              employee: adminUser._id,
              employeeName: adminUser.name,
              employeeEmail: adminUser.email,
              roleInPlan: "Product Owner / QA Sign-off",
              department: "Engineering",
              targetHours: 60,
              actualHours: 50,
              assignedTasksCount: 5,
              completedTasksCount: 4,
              completionRate: 80,
              status: "In Progress",
              deliverables: "User story validation, acceptance criteria verification.",
              notes: "Verified milestone 1 and milestone 2 deliverables.",
            },
          ],
          submittedBy: managerUser._id,
          submittedByName: managerUser.name,
          submittedAt: new Date("2026-10-28"),
          reviewedBy: adminUser._id,
          reviewedByName: adminUser.name,
          reviewedAt: new Date("2026-10-29"),
          reviewRemarks: "Comprehensive plan. Budget and resource allocation approved for Q4 sprint.",
          varianceNotes: "Actual hours are 35 hrs below target while achieving 85% progress.",
        },
        {
          tenant: tId,
          title: "Talent Acquisition & Annual Appraisal Campaign",
          monthCycle: "2026-11",
          year: 2026,
          month: 11,
          department: "Human Resources",
          team: "People Operations",
          lead: hrUser._id,
          leadName: hrUser.name,
          description: "Coordinate annual employee appraisals, salary benchmarks, and onboarding for 5 new engineering hires.",
          objectives: [
            "Complete 100% of employee self and manager performance appraisals",
            "Process salary increments and promotion recommendations",
            "Complete structured 30-day onboarding for new team members",
          ],
          priority: "Medium",
          status: "Approved",
          totalPlannedHours: 160,
          totalActualHours: 140,
          targetBudget: 60000,
          actualCost: 52000,
          progressPercentage: 70,
          schedules: [
            {
              title: "Week 1: Review Cycles Launch & Self-Assessment Window",
              weekNumber: 1,
              startDate: new Date("2026-11-01"),
              endDate: new Date("2026-11-07"),
              deliverables: "All employees notified and review forms published",
              milestone: "Self-Review Window Closed",
              status: "Completed",
              plannedHours: 40,
              actualHours: 38,
            },
            {
              title: "Week 2: Manager 1-on-1 Evaluations & Rating Calibration",
              weekNumber: 2,
              startDate: new Date("2026-11-08"),
              endDate: new Date("2026-11-14"),
              deliverables: "Competency scores, promotion proposals, and feedback compiled",
              milestone: "Management Review Finalized",
              status: "Completed",
              plannedHours: 45,
              actualHours: 42,
            },
            {
              title: "Week 3: HR Salary Benchmarking & Sign-Off Processing",
              weekNumber: 3,
              startDate: new Date("2026-11-15"),
              endDate: new Date("2026-11-21"),
              deliverables: "Revised compensation letters and executive approval",
              milestone: "Appraisals HR Approved",
              status: "In Progress",
              plannedHours: 40,
              actualHours: 35,
            },
          ],
          assignments: [
            {
              employee: hrUser._id,
              employeeName: hrUser.name,
              employeeEmail: hrUser.email,
              roleInPlan: "HR Operations Lead",
              department: "Human Resources",
              targetHours: 90,
              actualHours: 80,
              assignedTasksCount: 8,
              completedTasksCount: 6,
              completionRate: 75,
              status: "In Progress",
              deliverables: "Supervise review cycle and process compensation letters.",
            },
          ],
        },
      ]);

      // 2. Employee Goals
      await Goal.create([
        {
          tenant: tId,
          employee: memberUser._id,
          employeeName: memberUser.name,
          employeeEmail: memberUser.email,
          department: memberUser.department || "Engineering",
          title: "Optimize MongoDB Query Performance and Index Latency (< 100ms)",
          description: "Analyze slow query logs, implement compound indexes on tenant-scoped queries, and eliminate unindexed scans.",
          category: "Technical & Delivery",
          cycle: "Q4 2026",
          startDate: new Date("2026-10-01"),
          targetDate: new Date("2026-12-15"),
          weightage: 30,
          targetMetric: "< 100ms p95 latency across all API routes",
          currentMetric: "78ms average latency achieved",
          progress: 88,
          status: "In Progress",
          alignment: "Company Objective: Platform Scalability & Speed",
          managerNotes: "Terrific work optimizing the compound indexes on monthCycle and tenant.",
          employeeNotes: "Benchmarking completed on staging server with 1000 simulated requests.",
          createdBy: managerUser._id,
        },
        {
          tenant: tId,
          employee: memberUser._id,
          employeeName: memberUser.name,
          employeeEmail: memberUser.email,
          department: memberUser.department || "Engineering",
          title: "Complete Microservices Architecture & Cloud Certification",
          description: "Complete hands-on certification modules for containerized deployment, microservice patterns, and distributed logging.",
          category: "Learning & Development",
          cycle: "Q4 2026",
          startDate: new Date("2026-09-01"),
          targetDate: new Date("2026-11-15"),
          weightage: 20,
          targetMetric: "Pass certification exam with 85%+ score",
          currentMetric: "Certification achieved with 92% score",
          progress: 100,
          status: "Achieved",
          alignment: "Professional Growth & Technical Excellence",
          managerNotes: "Congratulations on securing your advanced certificate!",
          employeeNotes: "Certificate uploaded to HR portal.",
          createdBy: memberUser._id,
        },
        {
          tenant: tId,
          employee: managerUser._id,
          employeeName: managerUser.name,
          employeeEmail: managerUser.email,
          department: managerUser.department || "Engineering",
          title: "Mentor 3 Junior Engineers & Maintain 95% Sprint Delivery",
          description: "Conduct bi-weekly pair programming sessions, conduct thorough code reviews, and achieve team sprint commitments.",
          category: "Leadership & Initiative",
          cycle: "Q4 2026",
          startDate: new Date("2026-10-01"),
          targetDate: new Date("2026-12-31"),
          weightage: 25,
          targetMetric: "95% sprint velocity, 100% 1-on-1 mentor sessions held",
          currentMetric: "94% velocity, all mentor sessions completed",
          progress: 90,
          status: "In Progress",
          alignment: "People Development & Team Culture",
          managerNotes: "Direct reports gave glowing feedback on the mentoring sessions.",
          createdBy: adminUser._id,
        },
        {
          tenant: tId,
          employee: hrUser._id,
          employeeName: hrUser.name,
          employeeEmail: hrUser.email,
          department: hrUser.department || "Human Resources",
          title: "Reduce Time-to-Hire to Under 18 Days",
          description: "Streamline multi-stage technical screening, automate offer letter generation, and accelerate candidate onboarding.",
          category: "Process Improvement",
          cycle: "Q4 2026",
          startDate: new Date("2026-10-01"),
          targetDate: new Date("2026-12-31"),
          weightage: 25,
          targetMetric: "< 18 days average time to hire",
          currentMetric: "16.4 days average achieved",
          progress: 92,
          status: "In Progress",
          alignment: "Operational Efficiency & Talent Acquisition",
          createdBy: adminUser._id,
        },
      ]);

      // 3. KPIs
      await KPI.create([
        {
          tenant: tId,
          title: "API Endpoint Response Latency (p95)",
          code: "KPI-ENG-01",
          description: "P95 latency measurement across authenticated workforce APIs under normal concurrent load.",
          department: "Engineering",
          assignedTo: memberUser._id,
          assignedToName: memberUser.name,
          category: "Quality",
          unit: "Count / Units",
          targetValue: 120,
          currentValue: 88,
          frequency: "Monthly",
          calculationMethod: "P95 response time in milliseconds recorded by API gateway",
          status: "Exceeded",
          cycle: "November 2026",
          history: [
            { date: new Date("2026-10-01"), value: 145, notes: "Baseline before query caching" },
            { date: new Date("2026-11-01"), value: 105, notes: "Compound index rollout" },
            { date: new Date("2026-11-15"), value: 88, notes: "Current reading with Redis cache" },
          ],
        },
        {
          tenant: tId,
          title: "Sprint Commitment Velocity & On-Time Delivery",
          code: "KPI-ENG-02",
          description: "Percentage of planned user stories and work plan deliverables completed within scheduled cycle.",
          department: "Engineering",
          assignedTo: managerUser._id,
          assignedToName: managerUser.name,
          category: "Productivity",
          unit: "Percentage (%)",
          targetValue: 90,
          currentValue: 92,
          frequency: "Monthly",
          calculationMethod: "(Completed Story Points / Committed Story Points) * 100",
          status: "On Track",
          cycle: "November 2026",
          history: [
            { date: new Date("2026-10-01"), value: 87, notes: "September sprint velocity" },
            { date: new Date("2026-11-01"), value: 92, notes: "October sprint velocity" },
          ],
        },
        {
          tenant: tId,
          title: "Employee 30-Day Retention & Onboarding Rating",
          code: "KPI-HR-01",
          description: "Feedback score from newly onboarded employees following their 30-day orientation program.",
          department: "Human Resources",
          assignedTo: hrUser._id,
          assignedToName: hrUser.name,
          category: "Customer Satisfaction",
          unit: "Percentage (%)",
          targetValue: 95,
          currentValue: 97,
          frequency: "Quarterly",
          calculationMethod: "Average onboarding survey positive response rate",
          status: "On Track",
          cycle: "November 2026",
          history: [
            { date: new Date("2026-10-15"), value: 94, notes: "Q3 onboarding review" },
            { date: new Date("2026-11-10"), value: 97, notes: "Q4 mid-quarter check" },
          ],
        },
        {
          tenant: tId,
          title: "Critical Defect SLA Resolution (< 24 Hours)",
          code: "KPI-QA-01",
          description: "Percentage of high priority or critical defects fixed and tested within 24 hours of filing.",
          department: "Engineering",
          assignedTo: memberUser._id,
          assignedToName: memberUser.name,
          category: "Efficiency",
          unit: "Percentage (%)",
          targetValue: 98,
          currentValue: 86,
          frequency: "Monthly",
          calculationMethod: "(Resolved within 24h / Total Critical Bugs) * 100",
          status: "Behind",
          cycle: "November 2026",
          history: [
            { date: new Date("2026-11-01"), value: 86, notes: "Two complex concurrency bugs took > 24 hours" },
          ],
        },
      ]);

      // 4. Performance Reviews
      await PerformanceReview.create([
        {
          tenant: tId,
          employee: memberUser._id,
          employeeName: memberUser.name,
          employeeEmail: memberUser.email,
          department: memberUser.department || "Engineering",
          designation: memberUser.designation || "Software Engineer",
          reviewer: managerUser._id,
          reviewerName: managerUser.name,
          cycle: "Q4 2026 Review",
          periodStart: new Date("2026-07-01"),
          periodEnd: new Date("2026-11-15"),
          status: "Completed",
          selfAssessment: {
            rating: 4.5,
            keyAchievements: "Engineered monthly planning APIs, optimized database indexes reducing query latency by 45%, and mentored new onboarding hires.",
            challengesFaced: "Handling complex multi-tenant query edge cases and mock Jest sandbox issues.",
            skillsLearned: "MongoDB Aggregation Pipeline, Advanced Tailwind CSS 4, and Microservices Security.",
            futureAspirations: "Step into a Senior Engineering role and lead platform architectural roadmap.",
            submittedAt: new Date("2026-11-10"),
          },
          managerAssessment: {
            ratings: {
              technicalCompetence: 5,
              qualityOfWork: 5,
              productivityAndTimeliness: 4,
              communicationAndTeamwork: 5,
              initiativeAndProblemSolving: 5,
              attendanceAndDiscipline: 5,
            },
            overallScore: 4.8,
            strengths: "Exceptionally strong analytical mindset, deep technical understanding of MERN stack, and high reliability under sprint deadlines.",
            areasForImprovement: "Can delegate more routine bug fixes to junior peers to focus on system design.",
            managerFeedback: "One of our most impactful contributors this quarter. Highly recommended for title promotion and merit increment.",
            trainingRecommendations: "Distributed Systems & Cloud Architecture Executive Workshop.",
            submittedAt: new Date("2026-11-12"),
          },
          finalRating: 4.8,
          finalRatingLabel: "Outstanding (5)",
          completedAt: new Date("2026-11-12"),
          hrNotes: "Sign-off verified. Appraisal increment processed in system.",
        },
        {
          tenant: tId,
          employee: managerUser._id,
          employeeName: managerUser.name,
          employeeEmail: managerUser.email,
          department: managerUser.department || "Engineering",
          designation: managerUser.designation || "Engineering Lead",
          reviewer: adminUser._id,
          reviewerName: adminUser.name,
          cycle: "Q4 2026 Review",
          periodStart: new Date("2026-07-01"),
          periodEnd: new Date("2026-11-15"),
          status: "Completed",
          selfAssessment: {
            rating: 4.6,
            keyAchievements: "Led team to 92% sprint delivery velocity across 4 major feature rollouts.",
            challengesFaced: "Balancing direct people mentorship with hands-on code review volume.",
            submittedAt: new Date("2026-11-09"),
          },
          managerAssessment: {
            ratings: {
              technicalCompetence: 5,
              qualityOfWork: 4,
              productivityAndTimeliness: 5,
              communicationAndTeamwork: 5,
              initiativeAndProblemSolving: 5,
              attendanceAndDiscipline: 5,
            },
            overallScore: 4.8,
            strengths: "Superb leadership, empathetic mentoring, and impeccable work ethic.",
            areasForImprovement: "Documenting architectural decision records (ADRs) more systematically.",
            managerFeedback: "Exceptional team leadership throughout the fiscal quarter.",
            submittedAt: new Date("2026-11-13"),
          },
          finalRating: 4.8,
          finalRatingLabel: "Outstanding (5)",
          completedAt: new Date("2026-11-13"),
        },
      ]);

      // 5. Continuous Feedback
      await ContinuousFeedback.create([
        {
          tenant: tId,
          fromUser: adminUser._id,
          fromUserName: adminUser.name,
          toUser: memberUser._id,
          toUserName: memberUser.name,
          type: "Praise",
          category: "Technical Mentorship",
          badge: "Rockstar",
          message: "Sensational delivery on the new Monthly Planning module! The variance tracking and schedules make operational management effortless.",
          visibility: "Public",
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        },
        {
          tenant: tId,
          fromUser: managerUser._id,
          fromUserName: managerUser.name,
          toUser: memberUser._id,
          toUserName: memberUser.name,
          type: "Praise",
          category: "Collaboration",
          badge: "Team Player",
          message: "Thank you for staying late to help debug the sprint release pipeline. Your dedication made all the difference!",
          visibility: "Public",
          isAcknowledged: true,
          acknowledgedAt: new Date(),
        },
        {
          tenant: tId,
          fromUser: memberUser._id,
          fromUserName: memberUser.name,
          toUser: managerUser._id,
          toUserName: managerUser.name,
          type: "General Feedback",
          category: "Core Values",
          badge: "Innovator",
          message: "Really appreciate your constructive feedback during architectural design reviews. It helped level up our system modularity.",
          visibility: "Public",
          isAcknowledged: false,
        },
      ]);

      // 6. Appraisal Records
      await Appraisal.create([
        {
          tenant: tId,
          employee: memberUser._id,
          employeeName: memberUser.name,
          employeeEmail: memberUser.email,
          department: memberUser.department || "Engineering",
          currentDesignation: memberUser.designation || "Software Engineer",
          proposedDesignation: "Senior Software Engineer",
          currentSalary: memberUser.baseSalary || 22000,
          proposedSalary: Math.round((memberUser.baseSalary || 22000) * 1.25),
          incrementPercentage: 25.0,
          bonusAmount: 30000,
          appraisalCycle: "Annual 2026",
          evaluationPeriod: "Jan 2026 - Dec 2026",
          performanceScore: 4.8,
          performanceGrade: "A+ (Outstanding)",
          promotionRecommended: true,
          promotionNotes: "Demonstrated exceptional mastery across fullstack delivery, reliability, and proactive initiative. Promoted to Senior Software Engineer.",
          effectiveDate: new Date("2026-12-01"),
          signOff: {
            managerSigned: true,
            managerSignedAt: new Date("2026-11-13"),
            managerSigner: managerUser._id,
            managerSignerName: managerUser.name,
            hrSigned: true,
            hrSignedAt: new Date("2026-11-14"),
            hrSigner: hrUser._id,
            hrSignerName: hrUser.name,
            employeeAcknowledged: true,
            employeeAcknowledgedAt: new Date("2026-11-15"),
          },
          status: "Approved",
          remarks: "All sign-offs completed. 25% compensation adjustment effective next payroll cycle.",
          createdBy: managerUser._id,
        },
        {
          tenant: tId,
          employee: managerUser._id,
          employeeName: managerUser.name,
          employeeEmail: managerUser.email,
          department: managerUser.department || "Engineering",
          currentDesignation: managerUser.designation || "Engineering Lead",
          proposedDesignation: "Principal Engineering Lead",
          currentSalary: managerUser.baseSalary || 35000,
          proposedSalary: Math.round((managerUser.baseSalary || 35000) * 1.20),
          incrementPercentage: 20.0,
          bonusAmount: 50000,
          appraisalCycle: "Annual 2026",
          evaluationPeriod: "Jan 2026 - Dec 2026",
          performanceScore: 4.7,
          performanceGrade: "A (Exceeds Expectations)",
          promotionRecommended: true,
          promotionNotes: "Outstanding leadership across multiple engineering pods, high retention, and zero downtime across major deployments.",
          effectiveDate: new Date("2026-12-01"),
          signOff: {
            managerSigned: true,
            managerSignedAt: new Date("2026-11-14"),
            managerSigner: adminUser._id,
            managerSignerName: adminUser.name,
            hrSigned: false,
            employeeAcknowledged: false,
          },
          status: "Pending HR Approval",
          remarks: "Manager review approved; pending final executive HR committee signature.",
          createdBy: adminUser._id,
        },
      ]);
    }
    console.log("Monthly Planning & Performance Management demo data seeded");

    // Print demo login summary
    console.log("\n=== Demo Login Summary ===\n");
    console.log("TECH-BD Super Admin:");
    console.log("  Email: sarah@techbd.com");
    console.log("  Password: password123");
    console.log("\nTECH-BD Admin:");
    console.log("  Email: mohammad@techbd.com");
    console.log("  Password: password123");
    console.log("\nTECH-BD Member:");
    console.log("  Email: karim@techbd.com");
    console.log("  Password: password123");
    console.log("\nAPEX Super Admin:");
    console.log("  Email: john@apex.com");
    console.log("  Password: password123");
    console.log("\nAPEX Admin:");
    console.log("  Email: jane@apex.com");
    console.log("  Password: password123");
    console.log("\nAPEX Member:");
    console.log("  Email: charlie@apex.com");
    console.log("  Password: password123\n");

    console.log("Seeding completed successfully!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    mongoose.connection.close();
    process.exit(1);
  }
};

seed();