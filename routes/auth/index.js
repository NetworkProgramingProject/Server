var express = require("express");
var router = express.Router();

/* GET home page. */

router.use("/join", require("./join"));
router.use("/login", require("./login"));

module.exports = router;
