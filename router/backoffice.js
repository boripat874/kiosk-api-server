const express = require("express")
const router = express.Router()
const dashboard = require("../controllers/backoffice/dashboard");
const report = require("../controllers/backoffice/report");
const eventlog = require("../controllers/backoffice/eventlog");
const login = require("../controllers/backoffice/login");
const administrator = require("../controllers/backoffice/administrator");
const users = require("../controllers/backoffice/users");

// dashboard
router.get("/dashboardlistall", dashboard.dashboardlistAll);
router.get("/dashboardnumberusers", dashboard.dashboardnumberusers);
router.get("/dashboardusertype", dashboard.dashboardusertype);
router.get("/dashboardusers", dashboard.dashboardusers);

// administrator
router.get("/administratorlistall", administrator.administratorlistAll);
router.post("/administratorcreate", administrator.administratorcreate);
router.put("/administratorupdate", administrator.administratorupdate);
router.post("/administratordelete", administrator.administratordelete);

// users
router.get("/userslistall", users.userslistAll);
router.post("/userscreate", users.userscreate);
router.put("/usersupdate", users.usersupdate);
router.post("/usersdelete", users.usersdelete);
router.get("/groupuserslistall", users.groupuserslistAll);
router.post("/groupuserscreate", users.groupuserscreate);
router.put("/groupusersupdate", users.groupusersupdate);
router.post("/groupusersdelete", users.groupusersdelete);
router.post("/usersimport",users.usersImport);

// report
router.get("/reporttraffic_volume", report.traffic_volume);
router.get("/reportlistall", report.reportlistAll);
router.put("/reportuserdetails", report.reportUserDetails);

// eventlog
router.get("/eventloglistall", eventlog.eventloglistAll);

//login
router.post("/login", login.signin);
router.get("/checklogin", login.checklogin);
router.get("/logout", login.logout);

module.exports = router