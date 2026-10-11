const router = require("express").Router();
const {
  getOrgTree,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addTeam,
  updateTeam,
  deleteTeam,
  assignUser,
  getRbacMatrix,
  updateMatrix,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/orgController");

router.get("/org/tree", getOrgTree);
router.post("/org/departments", createDepartment);
router.put("/org/departments/:id", updateDepartment);
router.delete("/org/departments/:id", deleteDepartment);
router.post("/org/departments/:id/teams", addTeam);
router.put("/org/teams/:deptId/:teamName", updateTeam);
router.delete("/org/teams/:deptId/:teamName", deleteTeam);
router.post("/users/assignment", assignUser);
router.get("/rbac/matrix", getRbacMatrix);
router.put("/rbac/matrix", updateMatrix);
router.post("/rbac/roles", createRole);
router.put("/rbac/roles/:id", updateRole);
router.delete("/rbac/roles/:id", deleteRole);

module.exports = router;