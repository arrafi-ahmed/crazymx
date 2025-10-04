const router = require("express").Router();
const appUserService = require("../service/appUser");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdminClubAuthor} = require("../middleware/auth");

router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await appUserService.save({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse("User saved!", results));
    } catch (err) {
        next(err);
    }
});

router.get("/getUsers", auth, isAdminClubAuthor, async (req, res, next) => {
    try {
        const results = await appUserService.getUsers({
            clubId: req.currentUser.clubId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/removeUser", auth, isAdminClubAuthor, async (req, res, next) => {
    try {
        const result = await appUserService.removeUser({
            userId: req.query.userId,
            clubId: req.currentUser.clubId,
        });
        res.status(200).json(new ApiResponse("User removed!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
