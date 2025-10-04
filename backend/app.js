require("dotenv").config({
    path:
        process.env.NODE_ENV === "production"
            ? ".env.production"
            : ".env.development",
});
process.env.TZ = "UTC";

const express = require("express");
const app = express();
const path = require("path");

const customHelmet = require("./src/middleware/customHelmet");
const customCors = require("./src/middleware/customCors");
const {
    globalErrHandler,
    uncaughtErrHandler,
} = require("./src/middleware/errHandler");
const suppressToastMiddleware = require("./src/middleware/suppressToast");
const {appInfo} = require("./src/others/util");
const ApiResponse = require("./src/model/ApiResponse");
const port = process.env.PORT || 3001;

// Stripe webhook route - must be BEFORE express.json() to avoid body parsing conflicts
app.post(
    "/stripe/webhook",
    express.raw({type: "application/json"}),
    require("./src/controller/stripe").webhook,
);

//middlewares
app.use(customHelmet);
app.use(customCors);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Apply suppress toast middleware globally
app.use(suppressToastMiddleware);

//routes
app.use("/auth", require("./src/controller/auth"));
app.use("/club", require("./src/controller/club"));
app.use("/event", require("./src/controller/event"));
app.use("/registration", require("./src/controller/registration"));
app.use("/checkin", require("./src/controller/checkin"));
app.use("/form", require("./src/controller/form"));
app.use("/appUser", require("./src/controller/appUser"));
app.use("/stripe", require("./src/controller/stripe").router);
app.use("/ticket", require("./src/controller/ticket"));
app.use("/order", require("./src/controller/order"));
app.use("/sponsorship", require("./src/controller/sponsorship"));
app.use("/sponsorship-package", require("./src/controller/sponsorshipPackage"));
app.use("/extras", require("./src/controller/extras"));
app.use("/temp-registration", require("./src/controller/tempRegistration"));

app.get("/info", (req, res) => {
    res.status(200).json(new ApiResponse('Request successful!', appInfo));
});

app.listen(port, (err) => {
    if (err) return console.error(err);
    console.log(`Server started at ${port} - ${new Date()}`);
});

uncaughtErrHandler();
app.use(globalErrHandler);
