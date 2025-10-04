const router = require("express").Router();
const clubService = require("../service/club");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdminClubAuthor} = require("../middleware/auth");

router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await clubService.save({
            payload: req.body,
            currentUser: req.currentUser,
        });
        res.status(200).json(new ApiResponse("Club saved!", results));
    } catch (err) {
        next(err);
    }
});

router.get("/getClub", async (req, res, next) => {
    try {
        const results = await clubService.getClubById({
            clubId: req.query.clubId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getClubByClubId", async (req, res, next) => {
    try {
        const result = await clubService.getClubById({
            clubId: req.query.clubId,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.get("/removeClub", auth, isAdminClubAuthor, async (req, res, next) => {
    try {
        const result = await clubService.deleteClub({
            clubId: req.query.clubId,
        });
        res.status(200).json(new ApiResponse("Club deleted!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
