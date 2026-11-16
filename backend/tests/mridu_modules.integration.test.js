global.crypto = global.crypto || require("crypto");

const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../app");

let mongoServer;
let token;
let tenantId;
let adminUserId;
let memberUserId;

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    runtimeAdapters: { os: require("os") },
  });

  const Tenant = require("../models/Tenant");
  const User = require("../models/User");
  const Setting = require("../models/Setting");

  const tenant = await Tenant.create({ name: "Mridu Test Tenant", code: "MRIDUTEST" });
  tenantId = tenant._id;

  const admin = await User.create({
    name: "Mridu Admin",
    email: "mridu.admin@test.com",
    password: "password123",
    role: "Admin",
    tenant: tenantId,
    department: "Engineering",
  });
  adminUserId = admin._id;

  const member = await User.create({
    name: "Mridu Member",
    email: "mridu.member@test.com",
    password: "password123",
    role: "Member",
    tenant: tenantId,
    department: "Engineering",
    baseSalary: 25000,
  });
  memberUserId = member._id;

  await Setting.create({ tenant: tenantId });

  const loginRes = await request(app)
    .post("/api/auth/login")
    .send({ email: "mridu.admin@test.com", password: "password123" });

  expect(loginRes.status).toBe(200);
  token = loginRes.body.data.token;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe("Module 2 - Member 2 (Anindita Ghosh Mridu) Integration Tests", () => {
  let createdPlanId;
  let scheduleItemId;
  let assignmentId;
  let createdGoalId;
  let createdKpiId;
  let createdReviewId;
  let createdFeedbackId;
  let createdAppraisalId;

  // ==========================================
  // 1. MONTHLY PLANNING TESTS
  // ==========================================
  describe("1. Monthly Planning Module APIs", () => {
    test("POST /api/monthly-plans creates a comprehensive monthly plan", async () => {
      const res = await auth(
        request(app)
          .post("/api/monthly-plans")
          .send({
            title: "Q4 High-Performance Core Engine",
            monthCycle: "2026-11",
            department: "Engineering",
            team: "Core Platform",
            description: "End-to-end modernization sprint",
            objectives: ["Zero regression", "< 100ms API response"],
            priority: "High",
            targetBudget: 80000,
            schedules: [
              {
                title: "Sprint Setup & Database Migration",
                weekNumber: 1,
                deliverables: "Compound indexes & models",
                plannedHours: 40,
                status: "Pending",
              },
            ],
            assignments: [
              {
                employeeId: memberUserId,
                roleInPlan: "Backend Architect",
                targetHours: 60,
                deliverables: "Design REST APIs and optimize aggregations",
              },
            ],
          })
      );

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Q4 High-Performance Core Engine");
      expect(res.body.data.monthCycle).toBe("2026-11");
      expect(res.body.data.status).toBe("Draft");
      createdPlanId = res.body.data.id || res.body.data._id;
      if (res.body.data.schedules && res.body.data.schedules.length > 0) {
        scheduleItemId = res.body.data.schedules[0].id || res.body.data.schedules[0]._id;
      }
    });

    test("GET /api/monthly-plans lists monthly plans with tenant isolation", async () => {
      const res = await auth(request(app).get("/api/monthly-plans?monthCycle=2026-11"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].tenant.toString()).toBe(tenantId.toString());
    });

    test("GET /api/monthly-plans/:id returns plan details with schedules and assignments", async () => {
      const res = await auth(request(app).get(`/api/monthly-plans/${createdPlanId}`));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Q4 High-Performance Core Engine");
      expect(Array.isArray(res.body.data.schedules)).toBe(true);
    });

    test("PATCH /api/monthly-plans/:id/status transitions plan workflow (Draft -> Submitted -> Approved)", async () => {
      // Submit
      const submitRes = await auth(
        request(app)
          .patch(`/api/monthly-plans/${createdPlanId}/status`)
          .send({ status: "Submitted" })
      );
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.data.status).toBe("Submitted");

      // Approve
      const approveRes = await auth(
        request(app)
          .patch(`/api/monthly-plans/${createdPlanId}/status`)
          .send({ status: "Approved", reviewRemarks: "Approved for execution" })
      );
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe("Approved");
      expect(approveRes.body.data.reviewRemarks).toBe("Approved for execution");
    });

    test("POST /api/monthly-plans/:id/schedules adds a schedule milestone", async () => {
      const res = await auth(
        request(app)
          .post(`/api/monthly-plans/${createdPlanId}/schedules`)
          .send({
            title: "Frontend Integration & QA Verification",
            weekNumber: 2,
            deliverables: "React Vite pages and unit tests",
            milestone: "Sprint 2 QA Pass",
            status: "In Progress",
            plannedHours: 45,
            actualHours: 40,
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.schedules.length).toBeGreaterThan(0);
    });

    test("POST /api/monthly-plans/:id/assignments assigns an employee to the plan", async () => {
      const res = await auth(
        request(app)
          .post(`/api/monthly-plans/${createdPlanId}/assignments`)
          .send({
            employeeId: adminUserId,
            roleInPlan: "Tech Lead",
            targetHours: 40,
            deliverables: "Architecture oversight and PR approvals",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const added = res.body.data.assignments.find((a) => a.employee.toString() === adminUserId.toString());
      expect(added).toBeDefined();
      assignmentId = added.id || added._id;
    });

    test("PUT /api/monthly-plans/:id/assignments/:assignmentId updates actual hours and progress", async () => {
      const res = await auth(
        request(app)
          .put(`/api/monthly-plans/${createdPlanId}/assignments/${assignmentId}`)
          .send({
            actualHours: 38,
            assignedTasksCount: 5,
            completedTasksCount: 4,
            status: "In Progress",
          })
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalActualHours).toBeGreaterThan(0);
    });

    test("GET /api/monthly-plans/tracking/variance calculates Planned vs Actual tracking matrix", async () => {
      const res = await auth(request(app).get("/api/monthly-plans/tracking/variance?monthCycle=2026-11"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).toHaveProperty("plannedHours");
      expect(res.body.data[0]).toHaveProperty("actualHours");
      expect(res.body.data[0]).toHaveProperty("varianceHours");
      expect(res.body.data[0]).toHaveProperty("varianceStatus");
    });

    test("GET /api/monthly-plans/stats returns aggregate analytics", async () => {
      const res = await auth(request(app).get("/api/monthly-plans/stats?monthCycle=2026-11"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("totalPlans");
      expect(res.body.data).toHaveProperty("totalPlannedHours");
      expect(res.body.data).toHaveProperty("totalActualHours");
      expect(res.body.data).toHaveProperty("varianceHours");
    });
  });

  // ==========================================
  // 2. PERFORMANCE MANAGEMENT TESTS
  // ==========================================
  describe("2. Performance Management Module APIs", () => {
    test("POST /api/performance/goals creates employee SMART goal", async () => {
      const res = await auth(
        request(app)
          .post("/api/performance/goals")
          .send({
            employeeId: memberUserId,
            title: "Reduce Redis Cache Miss Rate to < 5%",
            category: "Technical & Delivery",
            cycle: "Q4 2026",
            weightage: 25,
            targetMetric: "< 5% cache miss",
            progress: 50,
            status: "In Progress",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Reduce Redis Cache Miss Rate to < 5%");
      createdGoalId = res.body.data.id || res.body.data._id;
    });

    test("PATCH /api/performance/goals/:id/progress updates goal progress", async () => {
      const res = await auth(
        request(app)
          .patch(`/api/performance/goals/${createdGoalId}/progress`)
          .send({
            progress: 100,
            currentMetric: "3.2% cache miss achieved",
          })
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress).toBe(100);
      expect(res.body.data.status).toBe("Achieved");
    });

    test("POST /api/performance/kpis creates organizational KPI", async () => {
      const res = await auth(
        request(app)
          .post("/api/performance/kpis")
          .send({
            title: "P99 Database Query Execution Time",
            code: "KPI-DB-01",
            department: "Engineering",
            assignedTo: memberUserId,
            category: "Quality",
            unit: "Count / Units",
            targetValue: 50,
            currentValue: 55,
            frequency: "Monthly",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Exceeded");
      createdKpiId = res.body.data.id || res.body.data._id;
    });

    test("POST /api/performance/kpis/:id/history logs KPI metric update", async () => {
      const res = await auth(
        request(app)
          .post(`/api/performance/kpis/${createdKpiId}/history`)
          .send({
            value: 38,
            notes: "Query index re-indexing completed",
          })
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentValue).toBe(38);
      expect(res.body.data.history.length).toBeGreaterThan(1);
    });

    test("POST /api/performance/reviews initiates multi-stage performance review", async () => {
      const res = await auth(
        request(app)
          .post("/api/performance/reviews")
          .send({
            employeeId: memberUserId,
            reviewerId: adminUserId,
            cycle: "Q4 2026 Appraisal",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Self Review Pending");
      createdReviewId = res.body.data.id || res.body.data._id;
    });

    test("PUT /api/performance/reviews/:id/self submits self-assessment", async () => {
      const res = await auth(
        request(app)
          .put(`/api/performance/reviews/${createdReviewId}/self`)
          .send({
            rating: 4.5,
            keyAchievements: "Delivered workforce tracking APIs ahead of schedule",
            challengesFaced: "Managing complex data relationships",
            skillsLearned: "Advanced Mongoose & TypeScript",
          })
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Manager Review Pending");
      expect(res.body.data.selfAssessment.rating).toBe(4.5);
    });

    test("PUT /api/performance/reviews/:id/manager submits manager assessment & scores", async () => {
      const res = await auth(
        request(app)
          .put(`/api/performance/reviews/${createdReviewId}/manager`)
          .send({
            ratings: {
              technicalCompetence: 5,
              qualityOfWork: 5,
              productivityAndTimeliness: 5,
              communicationAndTeamwork: 4,
              initiativeAndProblemSolving: 5,
              attendanceAndDiscipline: 5,
            },
            strengths: "Top tier problem solver",
            areasForImprovement: "Expand cross-team communication",
            managerFeedback: "Exemplary performance throughout the sprint",
          })
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Completed");
      expect(res.body.data.finalRating).toBeGreaterThanOrEqual(4.5);
    });

    test("POST /api/performance/feedback creates continuous feedback & recognition badge", async () => {
      const res = await auth(
        request(app)
          .post("/api/performance/feedback")
          .send({
            toUserId: memberUserId,
            type: "Praise",
            category: "Collaboration",
            badge: "Rockstar",
            message: "Brilliant execution on the Monthly Planning and Performance modules!",
            visibility: "Public",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.badge).toBe("Rockstar");
      createdFeedbackId = res.body.data.id || res.body.data._id;
    });

    test("PATCH /api/performance/feedback/:id/acknowledge acknowledges feedback", async () => {
      const res = await auth(
        request(app).patch(`/api/performance/feedback/${createdFeedbackId}/acknowledge`)
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAcknowledged).toBe(true);
    });

    test("POST /api/performance/appraisals creates appraisal record with salary increment", async () => {
      const res = await auth(
        request(app)
          .post("/api/performance/appraisals")
          .send({
            employeeId: memberUserId,
            proposedDesignation: "Lead Engineer",
            incrementPercentage: 20,
            bonusAmount: 15000,
            appraisalCycle: "Annual 2026",
            performanceScore: 4.8,
            performanceGrade: "A+ (Outstanding)",
            promotionRecommended: true,
            promotionNotes: "Demonstrated strong leadership and delivery excellence",
          })
      );
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Draft");
      expect(res.body.data.proposedSalary).toBe(30000); // 25000 * 1.20
      createdAppraisalId = res.body.data.id || res.body.data._id;
    });

    test("PATCH /api/performance/appraisals/:id/sign-off performs manager and HR approval", async () => {
      // Manager sign-off
      const mgrRes = await auth(
        request(app)
          .patch(`/api/performance/appraisals/${createdAppraisalId}/sign-off`)
          .send({ roleType: "manager" })
      );
      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body.data.status).toBe("Pending HR Approval");

      // HR sign-off
      const hrRes = await auth(
        request(app)
          .patch(`/api/performance/appraisals/${createdAppraisalId}/sign-off`)
          .send({ roleType: "hr" })
      );
      expect(hrRes.status).toBe(200);
      expect(hrRes.body.data.status).toBe("Approved");
    });

    test("GET /api/performance/stats returns aggregated metrics & leaderboard", async () => {
      const res = await auth(request(app).get("/api/performance/stats"));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("totalGoals");
      expect(res.body.data).toHaveProperty("goalAttainmentRate");
      expect(res.body.data).toHaveProperty("totalKPIs");
      expect(res.body.data).toHaveProperty("kpiHealthRate");
      expect(res.body.data).toHaveProperty("totalReviews");
      expect(res.body.data).toHaveProperty("totalAppraisals");
      expect(res.body.data).toHaveProperty("topPerformers");
    });
  });
});
