const express = require("express");
const defaultRes = require("../../module/utils/utils");
const statusCode = require("../../module/utils/statusCode");
const resMessage = require("../../module/utils/responseMessage");
const jwt = require("../../module/jwt");
const crypto = require("crypto");

const User = require("../../models/user");

const router = express.Router();

router.post("/", async (req, res, next) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.BAD_REQUEST,
            resMessage.NOT_EXIST_EMAIL
          )
        );
    }

    const hashedPassword = crypto
      .pbkdf2Sync(password, user.passwordSalt, 10000, 64, "sha512")
      .toString("base64");
    if (hashedPassword != user.password) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.BAD_REQUEST,
            resMessage.NOT_CORRECT_PASSWORD
          )
        );
    }

    const { token } = jwt.sign(user);

    return res
      .status(200)
      .send(
        defaultRes.successTrue(statusCode.OK, resMessage.SUCCESS_LOGIN, token)
      );
  } catch (err) {
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.INTERNAL_SERVER_ERROR,
          resMessage.FAIL_LOGIN
        )
      );
  }
});

// router.get("/logout", (req, res) => {
//   req.logout();
//   req.session.destroy();
//   res.redirect("/");
// });

module.exports = router;
