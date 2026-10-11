// Fix for MongoDB driver crypto issue under Jest in some environments
global.crypto = global.crypto || require("crypto");

const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");

const TEST_URI = "mongodb://127.0.0.1:27017/workforce_os_test";
let token;

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

beforeAll(async () => {
  await mongoose.connect(TEST_URI, {
    serverSelectionTimeoutMS: 10000,
    // Jest's CJS sandbox rejects the driver's dynamic import('os'); pass it explicitly
    runtimeAdapters: { os: require("os") },
  });
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((col) => col.deleteMany({})));

  const Tenant = require("../models/Tenant");
  const User = require("../models/User");
  const Setting = require("../models/Setting");

  const tenant = await Tenant.create({ name: "Test Co", code: "TESTCO" });
  await User.create({
    name: "Test Admin",
    email: "admin@testco.com",
    password: "password123",
    role: "Super Admin",
    tenant: tenant._id,
  });
  await Setting.create({ tenant: tenant._id });

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@testco.com", password: "password123" });
  expect(login.status).toBe(200);
  token = login.body.data.token;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

describe("S4-S8 Integration Tests", () => {
  describe("Auth guards", () => {
    test("POST /api/auth/login rejects a wrong password with 401", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "admin@testco.com", password: "nope" });
      expect(res.status).toBe(401);
    });

    test("protected route returns 401 without a token", async () => {
      const res = await request(app).get("/api/tasks");
      expect(res.status).toBe(401);
    });
  });

  describe("S4.1 - Configuration APIs", () => {
    test("GET /api/settings returns settings for the tenant", async () => {
      const res = await auth(request(app).get("/api/settings"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("idleThresholdSeconds");
    });

    test("PUT /api/settings updates settings", async () => {
      const res = await auth(
        request(app).put("/api/settings").send({ idleThresholdSeconds: 300 })
      );
      expect(res.status).toBe(200);
      expect(res.body.data.idleThresholdSeconds).toBe(300);
    });
  });

  describe("S4.2 - Org & RBAC APIs", () => {
    test("GET /api/org/tree returns org tree", async () => {
      const res = await auth(request(app).get("/api/org/tree"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("GET /api/rbac/matrix returns matrix", async () => {
      const res = await auth(request(app).get("/api/rbac/matrix"));
      expect(res.status).toBe(200);
    });
  });

  describe("S4.6 - Tasks APIs", () => {
    test("GET /api/tasks returns tasks", async () => {
      const res = await auth(request(app).get("/api/tasks?scope=mine"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("POST /api/tasks creates a task", async () => {
      const res = await auth(
        request(app).post("/api/tasks")        .send({
          title: "Test Task",
          description: "Test description",
          category: "Admin",
          priority: "Medium",
        })
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data.title).toBe("Test Task");
    });

    test("GET /api/tasks/:id returns 404 for a missing task", async () => {
      const res = await auth(
        request(app).get("/api/tasks/64b000000000000000000000")
      );
      expect(res.status).toBe(404);
    });
  });

  describe("S4.7 - Time APIs", () => {
    test("GET /api/time/timer returns timer state", async () => {
      const res = await auth(request(app).get("/api/time/timer"));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("running");
    });
  });

  describe("S4.8 - User-wise log APIs", () => {
    test("GET /api/reports/user-log returns logs", async () => {
      const res = await auth(request(app).get("/api/reports/user-log"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("S4.10 - Notifications APIs", () => {
    test("GET /api/notifications returns notifications", async () => {
      const res = await auth(request(app).get("/api/notifications"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
