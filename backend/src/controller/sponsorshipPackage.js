const router = require("express").Router();
const sponsorshipPackageService = require("../service/sponsorshipPackage");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isAuthenticated,
    isAdminEventAuthor,
} = require("../middleware/auth");

// Get sponsorship packages by event ID (public route)
router.get("/getPackagesByEventId", async (req, res, next) => {
    try {
        const results = await sponsorshipPackageService.getPackagesByEventId({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Save sponsorship package
router.post("/save", auth, isAdminEventAuthor, async (req, res, next) => {
    try {
        const result = await sponsorshipPackageService.save({payload: req.body});
        res
            .status(200)
            .json(new ApiResponse("Sponsorship package saved successfully!", result));
    } catch (err) {
        next(err);
    }
});

// Get sponsorship package by ID
router.get(
    "/getPackageById",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const result = await sponsorshipPackageService.getPackageById({
                packageId: req.query.packageId,
            });
            res.status(200).json(new ApiResponse(null, result));
        } catch (err) {
            next(err);
        }
    },
);

// Delete sponsorship package
router.delete(
    "/deletePackage",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const result = await sponsorshipPackageService.deletePackage({
                packageId: req.body.packageId,
                eventId: req.body.eventId,
                clubId: req.body.clubId,
            });
            res
                .status(200)
                .json(
                    new ApiResponse("Sponsorship package deleted successfully!", result),
                );
        } catch (err) {
            next(err);
        }
    },
);

// Update package status
router.post(
    "/updateStatus",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const result = await sponsorshipPackageService.updatePackageStatus({
                packageId: req.body.packageId,
                isActive: req.body.isActive,
            });
            res
                .status(200)
                .json(new ApiResponse("Package status updated successfully!", result));
        } catch (err) {
            next(err);
        }
    },
);

module.exports = router;
