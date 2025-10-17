const jwt = require("jsonwebtoken");
const {getEventByEventIdnClubId} = require("../service/event");
const {ifAdmin, ifSudo, HTTP_STATUS} = require("../utils/common");
const ApiResponse = require("../model/ApiResponse");

const auth = (req, res, next) => {
    const token = req.header("authorization");
    if (!token) {
        console.error("Access denied in auth middleware");
        return res.status(401).json(new ApiResponse('Access denied'));
    }
    try {
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        req.currentUser = decoded.currentUser;
        next();
    } catch (error) {
        console.error("Invalid token in auth middleware", error.name);
        if (error?.name === 'TokenExpiredError') {
            return res.status(HTTP_STATUS.TOKEN_EXPIRED).json(new ApiResponse('Token expired, Please login again!'));
        }
        return res.status(401).json(new ApiResponse('Invalid token'));
    }
};

const isSudo = (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    try {
        if (ifSudo(currentUser.role)) next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAdmin = (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    try {
        if (ifAdmin(currentUser.role)) next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAdminEventAuthor = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifSudo(currentUser.role)) return next();

    const eventId =
        req.query?.eventId || req.query?.event?.id || req.body?.eventId || req.body?.payload?.eventId;

    const clubId = currentUser.clubId;
    try {
        const event = await getEventByEventIdnClubId({
            eventId,
            clubId,
            currentUser,
        });
        if (!event || !event.id) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }
        next();
    } catch (error) {
        console.error('Error in isAdminEventAuthor middleware', error);
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAdminClubAuthor = async (req, res, next) => {
    const currentUser = req.currentUser;
    if (!currentUser) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
    if (ifSudo(currentUser.role)) return next();

    const inputClubId =
        req.query?.clubId || req.body?.clubId || req.body?.payload?.clubId;

    const clubId = currentUser.clubId;
    try {
        if (inputClubId != clubId) {
            return res.status(401).json(new ApiResponse('Access denied'));
        }

        next();
    } catch (error) {
        return res.status(401).json(new ApiResponse('Invalid request'));
    }
};

const isAuthenticated = (req, res, next) => {
    try {
        const token = req.header("authorization");
        if (!token) throw new Error();
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        req.currentUser = decoded.currentUser;
        req.isLoggedIn = true;
    } catch (error) {
        req.isLoggedIn = false;
    } finally {
        next();
    }
};

module.exports = {
    auth,
    isSudo,
    isAdmin,
    isAuthenticated,
    isAdminEventAuthor,
    isAdminClubAuthor,
};
