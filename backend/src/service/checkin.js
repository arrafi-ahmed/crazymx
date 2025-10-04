const {query} = require("../db");
const CustomError = require("../model/CustomError");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const {generateQrCode, getApiPublicImgUrl} = require("../others/util");
const attendeesService = require("./attendees");
const eventService = require("./event");

exports.save = async ({newCheckin}) => {
    if (!newCheckin) {
        throw new CustomError("Checkin data is required", 400);
    }

    if (!newCheckin.attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }

    if (!newCheckin.registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    if (!newCheckin.checkedInBy) {
        throw new CustomError("Checked in by user ID is required", 400);
    }

    const sql = `
        INSERT INTO checkin (attendee_id, registration_id, checked_in_by)
        VALUES ($1, $2, $3) RETURNING *
    `;
    const values = [
        newCheckin.attendeeId,
        newCheckin.registrationId,
        newCheckin.checkedInBy,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create checkin record", 500);
    }

    return result.rows[0];
};

exports.delete = async ({attendeeId, eventId}) => {
    if (!attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // First verify the attendee belongs to the specified event
    const verifySql = `
        SELECT c.id
        FROM checkin c
                 JOIN attendees a ON c.attendee_id = a.id
                 JOIN registration r ON a.registration_id = r.id
        WHERE c.attendee_id = $1
          AND r.event_id = $2
    `;

    const verifyResult = await query(verifySql, [attendeeId, eventId]);

    if (verifyResult.rows.length === 0) {
        throw new CustomError(
            "Checkin record not found for this attendee and event",
            404,
        );
    }

    // Delete the checkin record
    const deleteSql = `
        DELETE
        FROM checkin
        WHERE attendee_id = $1
    `;

    const deleteResult = await query(deleteSql, [attendeeId]);

    if (deleteResult.rowCount === 0) {
        throw new CustomError("Failed to delete checkin record", 500);
    }

    return {message: "Checkin record deleted successfully"};
};

exports.getCheckinByRegistrationId = async ({registrationId}) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM checkin
        WHERE registration_id = $1
    `;
    const result = await query(sql, [registrationId]);
    return result.rows;
};

exports.getCheckinStats = async ({eventId}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT COUNT(DISTINCT a.id)          as "totalAttendees",
               COUNT(DISTINCT c.attendee_id) as "checkedInCount"
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.event_id = $1
          AND r.status = true
    `;

    const result = await query(sql, [eventId]);

    return {
        totalRegistrations: result.rows[0].totalAttendees || 0,
        totalCheckins: result.rows[0].checkedInCount || 0,
        successfulCheckins: result.rows[0].checkedInCount || 0,
        totalAttendees: result.rows[0].totalAttendees || 0,
        totalCheckedInAttendees: result.rows[0].checkedInCount || 0,
    };
};

exports.validateQrCode = async ({registrationId, attendeeId, qrUuid}) => {
    if (!registrationId || !attendeeId || !qrUuid) {
        throw new CustomError("Invalid QR Code", 400);
    }

    // Get attendee with registration validation using all three IDs
    const attendee = await attendeesService.getAttendeeByIdRegistrationAndQrUuid({
        registrationId,
        attendeeId,
        qrUuid,
    });

    if (!attendee) {
        throw new CustomError("Invalid QR Code", 401);
    }

    // Validate registration status
    if (attendee.registrationStatus !== true) {
        throw new CustomError(
            "Registration not active - cannot check in",
            401,
            attendee,
        );
    }

    // Check if already checked in
    const checkinSql = `
        SELECT COUNT(*) as checkin_count
        FROM checkin
        WHERE attendee_id = $1
    `;
    const checkinResult = await query(checkinSql, [attendee.id]);

    if (checkinResult.rows[0].checkinCount > 0) {
        throw new CustomError("Already checked-in", 401, attendee);
    }

    return attendee;
};

const badgeTemplatePath = path.join(
    __dirname,
    "../templates/badgeTemplate.html",
);
const badgeTemplateSource = fs.readFileSync(badgeTemplatePath, "utf8");

exports.scanByRegistrationId = async ({qrCodeData, eventId, userId}) => {
    if (!qrCodeData) {
        throw new CustomError("QR code data is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    let qrData;
    try {
        qrData = JSON.parse(qrCodeData);
    } catch (error) {
        throw new CustomError("Invalid QR code data format", 400);
    }

    const {r: registrationId, a: attendeeId, q: qrUuid} = qrData;

    if (!registrationId || !attendeeId || !qrUuid) {
        throw new CustomError("Invalid QR code", 400);
    }

    // Validate QR code using all three IDs for maximum security
    const attendee = await exports.validateQrCode({
        registrationId,
        attendeeId,
        qrUuid,
    });

    // Create a check-in record
    const newCheckin = {
        attendeeId: attendee.id,
        registrationId: attendee.registrationId,
        checkedInBy: userId,
    };
    const checkinRecord = await exports.save({newCheckin});

    return {
        ...attendee,
        checkinTime: checkinRecord.createdAt,
        attendee: {
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            email: attendee.email,
            ticketTitle: attendee.ticketTitle,
        },
    };
};

const compileBadgeTemplate = handlebars.compile(badgeTemplateSource);

exports.getBadgeHtml = async ({registration, event}) => {
    if (!registration) {
        throw new CustomError("Registration data is required", 400);
    }

    if (!event) {
        throw new CustomError("Event data is required", 400);
    }

    const qrCode = await generateQrCode({
        id: registration.id,
        qrUuid: registration.qrUuid,
    });

    const html = compileBadgeTemplate({
        event,
        eventBanner: event.banner
            ? getApiPublicImgUrl(event.banner, "event-banner")
            : null,
        registration,
        qrCode,
    });

    return html;
};

// Scan by registration ID with badge generation
exports.scanWithBadge = async ({
                                   eventId,
                                   userId,
                                   attendeeIndex = 0,
                                   ...otherData
                               }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const checkinResult = await exports.scanByRegistrationId({
        ...otherData,
        eventId: eventId,
        userId: userId,
        attendeeIndex: attendeeIndex,
    });

    const event = await eventService.getEventById({eventId: eventId});

    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    // Use attendee info from the validated attendee
    const attendeeInfo = checkinResult.attendee;

    const badgeHtml = await exports.getBadgeHtml({
        registration: {
            id: checkinResult.id,
            qrUuid: checkinResult.qrUuid,
            name: `${attendeeInfo.firstName} ${attendeeInfo.lastName}`,
            email: attendeeInfo.email,
            ticketTitle: attendeeInfo.ticketTitle,
        },
        event: {
            name: event.name,
            banner: event.banner,
        },
    });

    return {
        checkinResult,
        badgeHtml,
    };
};
