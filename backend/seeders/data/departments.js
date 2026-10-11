module.exports = [
  // APEX departments
  {
    tenant: "APEX_TENANT_ID_PLACEHOLDER",
    name: "Engineering",
    code: "ENG",
    budget: 500000,
    hod: "APEX_TENANT_ID_PLACEHOLDER",
    hodName: "John Doe",
    teams: [
      { name: "Backend", lead: "APEX_TENANT_ID_PLACEHOLDER", leadName: "Jane Smith", members: ["APEX_TENANT_ID_PLACEHOLDER"] },
      { name: "Frontend", lead: "APEX_TENANT_ID_PLACEHOLDER", leadName: "Bob Johnson", members: ["APEX_TENANT_ID_PLACEHOLDER"] },
    ],
  },
  {
    tenant: "APEX_TENANT_ID_PLACEHOLDER",
    name: "Human Resources",
    code: "HR",
    budget: 100000,
    hod: "APEX_TENANT_ID_PLACEHOLDER",
    hodName: "Alice Williams",
    teams: [],
  },
  // TECH-BD departments
  {
    tenant: "TECH-BD_TENANT_ID_PLACEHOLDER",
    name: "Development",
    code: "DEV",
    budget: 800000,
    hod: "TECH-BD_TENANT_ID_PLACEHOLDER",
    hodName: "Sarah Khan",
    teams: [
      { name: "Backend", lead: "TECH-BD_TENANT_ID_PLACEHOLDER", leadName: "Mohammad Ali", members: ["TECH-BD_TENANT_ID_PLACEHOLDER"] },
      { name: "Frontend", lead: "TECH-BD_TENANT_ID_PLACEHOLDER", leadName: "Fatima Ahmed", members: ["TECH-BD_TENANT_ID_PLACEHOLDER"] },
    ],
  },
  {
    tenant: "TECH-BD_TENANT_ID_PLACEHOLDER",
    name: "Human Resources",
    code: "HR",
    budget: 100000,
    hod: "TECH-BD_TENANT_ID_PLACEHOLDER",
    hodName: "Rahman Islam",
    teams: [],
  },
];