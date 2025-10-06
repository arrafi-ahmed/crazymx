const router = require("express").Router();
const eventService = require("../service/event");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isAdminEventAuthor,
    isAuthenticated,
} = require("../middleware/auth");
const {uploadEventBanner} = require("../middleware/upload");
const compressImages = require("../middleware/compress");
const {ifSudo, ifAdmin} = require("../others/util");

router.post(
    "/save",
    auth,
    uploadEventBanner,
    compressImages,
    async (req, res, next) => {
        try {
            const result = await eventService.save({
                payload: req.body,
                files: req.files,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Event saved!", result));
        } catch (err) {
            next(err);
        }
    },
);

router.post(
    "/saveConfig",
    auth,
    async (req, res, next) => {
        try {
            const result = await eventService.saveConfig({
                payload: req.body,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Configuration saved!", result));
        } catch (err) {
            next(err);
        }
    },
);

router.post(
    "/saveLandingConfig",
    auth,
    async (req, res, next) => {
        try {
            const result = await eventService.saveLandingConfig({
                payload: req.body,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Landing configuration saved!", result));
        } catch (err) {
            next(err);
        }
    },
);

router.post("/saveExtras", auth, isAdminEventAuthor, async (req, res, next) => {
    try {
        const results = await eventService.saveExtras({payload: req.body});
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getAllEvents", async (req, res, next) => {
    try {
        const results = await eventService.getAllEvents({
            clubId: req.query.clubId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getEvent", async (req, res, next) => {
    try {
        const results = await eventService.getEventById({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getEventBySlug", async (req, res, next) => {
    try {
        const results = await eventService.getEventBySlug({
            slug: req.query.slug,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getEventByEventIdnClubId",
    isAuthenticated,
    async (req, res, next) => {
        try {
            const results = await eventService.getEventByEventIdnClubId({
                clubId: req.query.clubId,
                eventId: req.query.eventId,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse(null, results[0]));
        } catch (err) {
            next(err);
        }
    },
);

router.get("/removeEvent", auth, isAdminEventAuthor, async (req, res, next) => {
    try {
        const results = await eventService.removeEvent({
            clubId: req.query.clubId,
            eventId: req.query.eventId,
            currentUser: req.currentUser,
        });
        res.status(200).json(new ApiResponse("Event deleted!", results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/removeExtras",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const results = await eventService.removeExtras({
                extrasId: req.query.extrasId,
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse("Voucher deleted!", results));
        } catch (err) {
            next(err);
        }
    },
);

router.get("/getExtras", auth, isAdminEventAuthor, async (req, res, next) => {
    try {
        const results = await eventService.getExtras({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getExtrasByEventId",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const results = await eventService.getExtrasByEventId({
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/getExtrasByIds",
    auth,
    isAdminEventAuthor,
    async (req, res, next) => {
        try {
            const results = await eventService.getExtrasByIds({
                extrasIds: req.query.extrasIds,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.post("/saveExtrasPurchase", auth, async (req, res, next) => {
    try {
        const results = await eventService.saveExtrasPurchase({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getFirstEvent", async (req, res, next) => {
    try {
        const event = await eventService.getFirstEvent();
        res.status(200).json(new ApiResponse(null, event));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
