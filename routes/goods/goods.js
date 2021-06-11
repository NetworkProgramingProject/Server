const express = require("express");
const upload = require("../../config/multer");
const schedule = require("node-schedule");

const authUtil = require("../../module/utils/authUtils");
const defaultRes = require("../../module/utils/utils");
const statusCode = require("../../module/utils/statusCode");
const resMessage = require("../../module/utils/responseMessage");

const User = require("../../models/user");
const Goods = require("../../models/good");
const Auction = require("../../models/auction");
const { sequelize } = require("../../models/user");

const router = express.Router();

router.post(
  "/",
  authUtil.isLoggedin,
  upload.single("img"),
  async (req, res, next) => {
    if (req.decoded == null) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.BAD_REQUEST,
            resMessage.NO_TOKEN_VALUE
          )
        );
    }

    try {
      const { title, min_price, desc } = req.body;
      const goods = await Goods.create({
        OwnerId: req.decoded.id,
        title,
        img: req.file.location,
        min_price,
        desc,
      });
      const end = new Date();
      end.setDate(end.getDate() + 1); // 하루 뒤(시간 만약에 사용자마다 다르게 받는다 하면 1을 사용자 입력 값(대신 시간으로)바꾸기)
      schedule.scheduleJob(end, async () => {
        const success = await Auction.find({
          where: { goodId: goods.id },
          order: [["bid", "DESC"]],
        });
        await Goods.update(
          { soldId: success.userId },
          { where: { id: goods.id } }
        );
        await User.update(
          {
            money: sequelize.literal(`money - ${success.bid}`),
          },
          {
            where: { id: success.userId },
          }
        );
      });
      return res
        .status(200)
        .send(
          defaultRes.successTrue(
            statusCode.CREATED,
            resMessage.SUCCESS_UPLOAD_GOODS
          )
        );
    } catch (error) {
      console.error(error);
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.INTERNAL_SERVER_ERROR,
            resMessage.FAIL_UPLOAD_GOODS
          )
        );
    }
  }
);

router.get("/", authUtil.isLoggedin, async (req, res, next) => {
  if (req.decoded == null) {
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.BAD_REQUEST,
          resMessage.NO_TOKEN_VALUE
        )
      );
  }

  try {
    const goods_list = await Goods.findAll({ where: { soldId: null } });
    return res
      .status(200)
      .send(
        defaultRes.successTrue(
          statusCode.OK,
          resMessage.SUCCESS_SELECT_GOODS_LIST,
          goods_list
        )
      );
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.INTERNAL_SERVER_ERROR,
          resMessage.FAIL_SELECT_GOODS_LIST
        )
      );
  }
});

router.get("/:id", authUtil.isLoggedin, async (req, res, next) => {
  try {
    const [good, auction] = await Promise.all([
      Goods.findOne({
        where: { id: req.decoded.id },
        include: {
          model: User,
          as: "Owner",
        },
      }),
      Auction.findAll({
        where: { GoodId: req.decoded.id },
        include: { model: User },
        order: [["bid", "ASC"]],
      }),
    ]);

    return res
      .status(200)
      .send(
        defaultRes.successTrue(
          statusCode.OK,
          resMessage.SUCCESS_ENTER_THE_ROOM,
          { good, auction }
        )
      );
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.INTERNAL_SERVER_ERROR,
          resMessage.FAIL_ENTER_THE_ROOM
        )
      );
  }
});

router.post("/:id/bid", authUtil.isLoggedin, async (req, res, next) => {
  try {
    const { bid, msg } = req.body;
    const goods = await Goods.findOne({
      where: { id: req.params.id },
      include: { model: Auction },
      order: [[{ model: Auction }, "bid", "DESC"]],
    });
    if (goods.min_price >= bid) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.FORBIDDEN,
            resMessage.BE_HIGHER_THAN_STARTING_PRICE
          )
        );
    }
    if (
      new Date(goods.createdAt).valueOf() + 24 * 60 * 60 * 1000 <
      new Date()
    ) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.FORBIDDEN,
            resMessage.BE_FINISHED_THE_AUCTION
          )
        );
    }
    if (goods.Auctions[0] && goods.Auctions[0].bid >= bid) {
      return res
        .status(200)
        .send(
          defaultRes.successFalse(
            statusCode.FORBIDDEN,
            resMessage.BE_HIGHER_THAN_PREVIOUS_BID
          )
        );
    }
    const result = await Auction.create({
      bid,
      msg,
      UserId: req.decoded.id,
      GoodId: req.params.id,
    });
    // 실시간으로 입찰 내역 전송
    req.app.get("io").to(req.params.id).emit("bid", {
      bid: result.bid,
      msg: result.msg,
      nick: req.decoded.nick,
    });
    return res
      .status(200)
      .send(defaultRes.successTrue(statusCode.OK, resMessage.SUCCESS_BIDDING));
  } catch (error) {
    console.error(error);
    return res
      .status(200)
      .send(
        defaultRes.successFalse(
          statusCode.INTERNAL_SERVER_ERROR,
          resMessage.FAIL_BIDDING
        )
      );
  }
});

module.exports = router;
