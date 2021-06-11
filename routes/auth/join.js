const express = require("express");
const defaultRes = require("../../module/utils/utils");
const statusCode = require("../../module/utils/statusCode");
const resMessage = require("../../module/utils/responseMessage");
const jwt = require("../../module/jwt");
const crypto = require("crypto");

const User = require("../../models/user");

const router = express.Router();

router.post("/", async (req, res, next) => {
  const { email, nick, password } = req.body;

  try {
    const exUser = await User.findOne({ where: { email } });
    if (exUser) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.BAD_REQUEST,
            resMessage.ALREADY_EXIST_EMAIL
          )
        );
    }
    const salt = crypto.randomBytes(64).toString("base64");
    const hashedPassword = crypto
      .pbkdf2Sync(password, salt, 10000, 64, "sha512")
      .toString("base64");

    const createResult = await User.create({
      email,
      nick,
      password: hashedPassword,
      passwordSalt: salt,
    });

    const newUser = {
      id: createResult.id,
      nick: createResult.nick,
    };

    const token = jwt.sign(newUser);

    return res
      .status(200)
      .send(
        defaultRes.successTrue(
          statusCode.CREATED,
          resMessage.SUCCESS_SIGNUP,
          token
        )
      );
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.INTERNAL_SERVER_ERROR,
          resMessage.FAIL_SIGNUP
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
