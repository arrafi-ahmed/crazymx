const CustomError = require("../model/CustomError");
const {query} = require("../db");
const {v4: uuidv4} = require("uuid");
const exceljs = require("exceljs");
const {formatTime} = require("../others/util");
const formService = require("../service/form");
const eventService = require("./event");
const ticketService = require("./ticket");
const attendeesService = require("./attendees");
const emailService = require("./email");
const tempRegistrationService = require("./tempRegistration");
const orderService = require("./order");
const stripeService = require("./stripe");
const {log} = require("handlebars");

// Cleanup expired temporary registration data
exports.cleanupExpiredTempData = async () => {
    try {
        const result = await tempRegistrationService.cleanupExpiredTempData();
        return result;
    } catch (error) {
        console.error("Error cleaning up expired temporary data:", error);
        throw error;
    }
};

// Scheduled cleanup job (can be called by cron or manually)
exports.runCleanupJob = async () => {
    try {
        // Clean up incomplete registrations
        const incompleteCount = await exports.cleanupIncompleteRegistrations();

        // Clean up expired temporary data
        const tempCount = await exports.cleanupExpiredTempData();

        return {
            incompleteRegistrations: incompleteCount,
            expiredTempData: tempCount,
        };
    } catch (error) {
        console.error("Error running cleanup job:", error);
        throw error;
    }
};

exports.bulkImportAttendee = async ({files, eventId, clubId}) => {
    // Validate input parameters
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new CustomError("Excel file is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!clubId) {
        throw new CustomError("Club ID is required", 400);
    }

    // Validate event exists and belongs to club
    const event = await eventService.getEventById({eventId});
    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    if (event.clubId !== clubId) {
        throw new CustomError("Event does not belong to this club", 403);
    }

    const excelFile = files[0];
    if (!excelFile || !excelFile.path) {
        throw new CustomError("Invalid file format", 400);
    }

    const sheetPath = excelFile.path;
    const workbook = new exceljs.Workbook();

    try {
        await workbook.xlsx.readFile(sheetPath);
    } catch (error) {
        throw new CustomError("Invalid Excel file format", 400);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new CustomError(
            "Excel file must contain at least one worksheet",
            400,
        );
    }

    const headers = worksheet.getRow(1).values.slice(1); // ignore first undefined
    if (!headers || headers.length === 0) {
        throw new CustomError("Excel file must contain headers", 400);
    }

    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values.slice(1); // 1-based index
        const rowObj = Object.fromEntries(
            headers.map((h, i) => [h, values[i] || ""]),
        );

        rows.push(rowObj);
    });

    if (rows.length === 0) {
        throw new CustomError("Excel file must contain at least one data row", 400);
    }

    const attendees = [];
    for (const row of rows) {
        // format cell with object data type to simple string
        for (const key in row) {
            const value = row[key];
            if (typeof value === "object" && value !== null && "text" in value) {
                row[key] = value.text.trim();
            }
        }

        const {name, firstName, lastName, email, phone, ...others} = row;
        // Validate required fields
        if (!email || !email.trim()) {
            throw new CustomError("Email is required for all attendees", 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new CustomError(`Invalid email format: ${email}`, 400);
        }

        // dynamic based on excel header availability
        const fullName =
            name?.trim() || `${firstName || ""} ${lastName || ""}`.trim();

        if (!fullName || fullName.trim() === "") {
            throw new CustomError(
                `Name is required for attendee with email: ${email}`,
                400,
            );
        }

        attendees.push({
            firstName: firstName || fullName.split(" ")[0] || "",
            lastName: lastName || fullName.slice(1).join(" ") || "",
            email: email.trim(),
            phone: phone || "",
            additionalFields: others,
            eventId,
            clubId,
        });
    }

    // Check for duplicate emails in the same import
    const emailSet = new Set();
    for (const attendee of attendees) {
        if (emailSet.has(attendee.email)) {
            throw new CustomError(
                `Duplicate email found in import: ${attendee.email}`,
                400,
            );
        }
        emailSet.add(attendee.email);
    }

    // Check if any attendee already exists for this event
    for (const attendee of attendees) {
        const existingRegistration = await exports.getRegistrationByEmail({
            email: attendee.email,
            eventId: eventId,
        });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    let savedRegistrations = [];
    if (attendees.length) {
        // Create registration record
        const registrationSql = `
            INSERT INTO registration (event_id, additional_fields, status)
            VALUES ($1, $2, $3) RETURNING *
        `;

        const registrationValues = [
            eventId,
            JSON.stringify(attendees[0].additionalFields),
            true,
        ];
        const registrationResult = await query(registrationSql, registrationValues);
        const registration = registrationResult.rows[0];

        // Create attendees
        const createdAttendees = await attendeesService.createAttendees({
            registrationId: registration.id,
            attendees: attendees,
        });

        savedRegistrations = [registration];
    }

    //send ticket (async, don't wait)
    savedRegistrations.forEach(async (registration) => {
        try {
            // Fire and forget - don't await
            emailService
                .sendTicketsByRegistrationId({registrationId: registration.id})
                .catch((error) => {
                    console.error(
                        `Failed to send email for registration ${registration.id}:`,
                        error,
                    );
                });
        } catch (error) {
            console.error(
                `Failed to queue email for registration ${registration.id}:`,
                error,
            );
        }
    });

    return {insertCount: attendees.length};
};

exports.defaultSave = async ({payload}) => {
    // Check if event has any paid tickets, set 'status = unpaid' by default, after stripe purchase set 'status = paid' thru webhook
    const tickets = await ticketService.getTicketsByEventId({
        eventId: payload.eventId,
    });
    const hasPaidTickets = tickets.some((ticket) => ticket.price > 0);

    // For free events (no paid tickets), set status to true
    // For paid events, set status to false initially (will be updated after payment)
    payload.status = !hasPaidTickets;

    // Handle old single attendee registration structure
    if (payload.registrationData) {
        // Convert old structure to new structure
        const attendee = {
            firstName: payload.registrationData.name?.split(" ")[0] || "",
            lastName:
                payload.registrationData.name?.split(" ").slice(1).join(" ") || "",
            email: payload.registrationData.email || "",
            phone: payload.registrationData.phone || "",
            organization: payload.registrationData.organization || "",
            sector: payload.registrationData.sector || "",
            expectation: payload.registrationData.expectation || "",
            isPrimary: true,
        };

        payload.attendees = [attendee];
        payload.additionalFields = {
            organization: attendee.organization,
            sector: attendee.sector,
            expectation: attendee.expectation,
        };
    }

    // Ensure attendees data is properly structured
    if (payload.attendees && Array.isArray(payload.attendees)) {
        payload.attendees = payload.attendees.map((attendee) => ({
            firstName: attendee.firstName || "",
            lastName: attendee.lastName || "",
            email: attendee.email || "",
            phone: attendee.phone || "",
            isPrimary: attendee.isPrimary || false,
            ticketId: attendee.ticketId || null,
            ticketTitle: attendee.ticketTitle || null,
        }));
    }

    const result = await exports.save({payload});

    return result;
};

exports.save = async ({eventId, additionalFields, status = false}) => {
    const sql = `
        INSERT INTO registration (event_id, additional_fields, status)
        VALUES ($1, $2, $3) RETURNING *;`;
    const result = await query(sql, [
        eventId,
        JSON.stringify(additionalFields || {}),
        status,
    ]);
    return result.rows[0];
};

exports.getRegistrationById = async ({registrationId}) => {
    const sql = `
        SELECT r.*,
               e.name     as event_name,
               e.club_id,
               c.name     as club_name,
               c.location as club_location
        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 JOIN club c ON e.club_id = c.id
        WHERE r.id = $1;`;
    const result = await query(sql, [registrationId]);
    return result.rows[0];
};

exports.updateStatus = async ({payload: {id, status}}) => {
    const sql = `
        UPDATE registration
        SET status     = $1,
            updated_at = NOW()
        WHERE id = $2 RETURNING *
    `;
    const result = await query(sql, [status, id]);
    return result.rows[0];
};

exports.getRegistration = async ({registrationId, qrUuid, isLoggedIn}) => {
    let sql, values;

    if (qrUuid) {
        // For users with QR UUID, validate against attendees table
        sql = `
            SELECT r.*,
                   COALESCE((SELECT SUM((item ->>'quantity')::int)
                             FROM orders o
                                      CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
                            WHERE o.registration_id = r.id ), 0) as total_attendees,
                   jsonb_agg(
                           jsonb_build_object(
                                   'id', a.id,
                                   'firstName', a.first_name,
                                   'lastName', a.last_name,
                                   'email', a.email,
                                   'phone', a.phone,
                                   'ticketId', a.ticket_id,
                                   'ticketTitle', t.title,
                                   'qrUuid', a.qr_uuid,
                                   'isPrimary', a.is_primary,
                                   'createdAt', a.created_at,
                                   'updatedAt', a.updated_at
                           )
                   )                                             as attendees
            FROM registration r
                     LEFT JOIN attendees a ON r.id = a.registration_id
                     LEFT JOIN ticket t ON a.ticket_id = t.id
            WHERE r.id = $1
              AND a.qr_uuid = $2
            GROUP BY r.id
        `;
        values = [registrationId, qrUuid];
    } else {
        // For logged in users or without QR UUID, just get registration
        sql = `
            SELECT r.*,
                   COALESCE((SELECT SUM((item ->>'quantity')::int)
                             FROM orders o
                                      CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
                            WHERE o.registration_id = r.id ), 0) as total_attendees,
                   jsonb_agg(
                           jsonb_build_object(
                                   'id', a.id,
                                   'firstName', a.first_name,
                                   'lastName', a.last_name,
                                   'email', a.email,
                                   'phone', a.phone,
                                   'ticketId', a.ticket_id,
                                   'ticketTitle', t.title,
                                   'qrUuid', a.qr_uuid,
                                   'isPrimary', a.is_primary,
                                   'createdAt', a.created_at,
                                   'updatedAt', a.updated_at
                           )
                   )                                             as attendees
            FROM registration r
                     LEFT JOIN attendees a ON r.id = a.registration_id
                     LEFT JOIN ticket t ON a.ticket_id = t.id
            WHERE r.id = $1
            GROUP BY r.id
        `;
        values = [registrationId];
    }

    const result = await query(sql, values);
    return result.rows[0];
};

// Get registration by email and event ID
exports.getRegistrationByEmail = async ({email, eventId}) => {
    // Validate eventId
    if (!eventId || eventId === "unknown" || isNaN(parseInt(eventId))) {
        throw new CustomError("Invalid event ID", 400);
    }

    const sql = `
        SELECT r.*,
               jsonb_agg(
                       jsonb_build_object(
                               'id', a.id,
                               'firstName', a.first_name,
                               'lastName', a.last_name,
                               'email', a.email,
                               'phone', a.phone,
                               'ticketId', a.ticket_id,
                               'ticketTitle', t.title,
                               'qrUuid', a.qr_uuid,
                               'isPrimary', a.is_primary,
                               'createdAt', a.created_at,
                               'updatedAt', a.updated_at
                       )
               ) as attendees
        FROM registration r
                 LEFT JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN ticket t ON a.ticket_id = t.id
        WHERE a.email = $1
          AND r.event_id = $2
        GROUP BY r.id
        ORDER BY r.created_at DESC LIMIT 1
    `;
    const values = [email, parseInt(eventId)];

    const result = await query(sql, values);
    return result.rows[0];
};

exports.getRegistrationWEventWExtrasPurchase = async ({registrationId}) => {
    const sql = `
        SELECT jsonb_build_object(
                       'id', r.id,
                       'eventId', r.event_id,
                       'additionalFields', r.additional_fields,
                       'status', r.status,
                       'createdAt', r.created_at,
                       'updatedAt', r.updated_at,
                       'attendees', COALESCE(
                               (SELECT jsonb_agg(
                                               jsonb_build_object(
                                                       'id', a.id,
                                                       'firstName', a.first_name,
                                                       'lastName', a.last_name,
                                                       'email', a.email,
                                                       'phone', a.phone,
                                                       'ticketId', a.ticket_id,
                                                       'ticketTitle', t.title,
                                                       'qrUuid', a.qr_uuid,
                                                       'isPrimary', a.is_primary,
                                                       'createdAt', a.created_at,
                                                       'updatedAt', a.updated_at
                                               )
                                       )
                                FROM attendees a
                                         LEFT JOIN ticket t ON a.ticket_id = t.id
                                WHERE a.registration_id = r.id), '[]' ::jsonb
                                    )
               )                 AS registration,
               jsonb_build_object(
                       'id', e.id,
                       'name', e.name,
                       'startDate', e.start_datetime,
                       'endDate', e.end_datetime,
                       'location', e.location
               )                 AS event,
               COALESCE(jsonb_build_object(
                                'id', ep.id,
                                'qrUuid', ep.qr_uuid,
                                'extrasData', ep.extras_data,
                                'status', ep.status,
                                'scannedAt', ep.scanned_at
                        ), NULL) AS extrasPurchase

        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 LEFT JOIN extras_purchase ep ON ep.registration_id = r.id
        WHERE r.id = $1 LIMIT 1
    `;
    const result = await query(sql, [registrationId]);
    return result.rows[0];
};

exports.getRegistrationWithAttendees = async ({registrationId}) => {
    // Get registration with event and club info
    const registrationSql = `
        SELECT r.*,
               e.name     as event_name,
               e.club_id,
               c.name     as club_name,
               c.location as club_location
        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 JOIN club c ON e.club_id = c.id
        WHERE r.id = $1;`;
    const registrationResult = await query(registrationSql, [registrationId]);

    if (!registrationResult.rows[0]) {
        return null;
    }

    // Get attendees with ticket info
    const attendeesSql = `
        SELECT a.*
        FROM attendees a
                 LEFT JOIN ticket t ON a.ticket_id = t.id
        WHERE a.registration_id = $1
        ORDER BY a.is_primary DESC, a.id ASC;`;
    const attendeesResult = await query(attendeesSql, [registrationId]);

    const registration = registrationResult.rows[0];
    registration.attendees = attendeesResult.rows;

    return registration;
};

// Get all attendees for an event (flattened structure - one row per attendee)
exports.getAttendees = async ({eventId, sortBy = "registration"}) => {
    const sql = `
        SELECT r.id         as registration_id,
               r.event_id   as event_id,
               r.additional_fields,
               r.status     as registration_status,
               r.created_at as registration_created_at,
               r.updated_at as registration_updated_at,
               a.id         as attendee_id,
               a.first_name,
               a.last_name,
               a.email,
               a.phone,
               a.ticket_id,
               t.title      as ticket_title,
               a.qr_uuid,
               a.is_primary,
               a.created_at as attendee_created_at,
               a.updated_at as attendee_updated_at,
               c.id         as checkin_id,
               c.created_at as checkin_time
        FROM registration r
                 INNER JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN ticket t ON a.ticket_id = t.id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.event_id = $1
        ORDER BY CASE WHEN $2 = 'checkin' THEN c.created_at END DESC,
                 CASE WHEN $2 = 'status' THEN r.status END DESC,
                 CASE WHEN $2 = 'registration' OR $2 IS NULL THEN r.created_at END DESC
    `;

    const result = await query(sql, [eventId, sortBy]);

    return result.rows;
};

// Search attendees by keyword (flattened structure - one row per attendee)
exports.searchAttendees = async ({
                                     eventId,
                                     searchKeyword,
                                     sortBy = "registration",
                                 }) => {
    if (!searchKeyword || searchKeyword.trim() === "") {
        return await exports.getAttendees({eventId, sortBy});
    }

    const keyword = `%${searchKeyword.trim()}%`;

    const sql = `
        SELECT r.id         as registration_id,
               r.event_id   as event_id,
               r.additional_fields,
               r.status     as registration_status,
               r.created_at as registration_created_at,
               r.updated_at as registration_updated_at,
               a.id         as attendee_id,
               a.first_name,
               a.last_name,
               a.email,
               a.phone,
               a.ticket_id,
               t.title      as ticket_title,
               a.qr_uuid,
               a.is_primary,
               a.created_at as attendee_created_at,
               a.updated_at as attendee_updated_at,
               c.id         as checkin_id,
               c.created_at as checkin_time
        FROM registration r
                 INNER JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN ticket t ON a.ticket_id = t.id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.event_id = $1
          AND r.status = true
          AND (
            a.first_name ILIKE $2 OR
                a.last_name ILIKE $2 OR
                a.email ILIKE $2 OR
                a.phone ILIKE $2
            )
        ORDER BY CASE WHEN $3 = 'checkin' THEN c.created_at END DESC,
                 CASE WHEN $3 = 'status' THEN r.status END DESC,
                 CASE WHEN $3 = 'registration' OR $3 IS NULL THEN r.created_at END DESC
    `;

    const result = await query(sql, [eventId, keyword, sortBy]);

    return result.rows;
};

exports.removeRegistration = async ({eventId, registrationId}) => {
    const sql = `
        DELETE
        FROM registration
        WHERE id = $1
          AND event_id = $2 RETURNING *
    `;
    const result = await query(sql, [registrationId, eventId]);
    return result.rows[0];
};

exports.validateExtrasQrCode = async ({id, qrUuid, eventId}) => {
    const sql = `
        SELECT *, r.id as r_id, ep.id as id
        FROM registration r
                 LEFT JOIN extras_purchase ep ON r.id = ep.registration_id
        WHERE ep.id = $1
          AND r.event_id = $2
          AND r.status = true
    `;
    const result = await query(sql, [id, eventId]);
    const extrasPurchase = result.rows[0];

    if (!extrasPurchase || extrasPurchase.qrUuid != qrUuid) {
        throw new CustomError("Invalid QR Code", 401, extrasPurchase);
    } else if (extrasPurchase.status === true) {
        throw new CustomError("Already Redeemed", 401, extrasPurchase);
    }
    return extrasPurchase;
};

exports.scanByExtrasPurchaseId = async ({qrCodeData, eventId}) => {
    const {id, qrUuid} = JSON.parse(qrCodeData);
    const extrasPurchase = await exports.validateExtrasQrCode({
        id,
        qrUuid,
        eventId,
    });
    const payload = {id: extrasPurchase.id, status: true};
    const updatedExtrasPurchase = await eventService.updateExtrasPurchaseStatus({
        payload,
    });
    return updatedExtrasPurchase;
};

exports.downloadAttendees = async ({eventId}) => {
    const attendees = await exports.getAttendees({eventId});
    const formQuestions = await formService.getFormQuestions({eventId});

    if (attendees.length === 0)
        throw new CustomError("No data available for report!", 404);

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Attendee Report");

    const sheet_columns = [
        {header: "Registration ID", key: "registration_id", width: 15},
        {header: "Name", key: "name", width: 25},
        {header: "Email", key: "email", width: 25},
        {header: "Phone", key: "phone", width: 20},
        {header: "Registration Time", key: "registration_time", width: 25},
        {header: "Checkin Time", key: "checkin_time", width: 25},
        {header: "Checkin Status", key: "checkin_status", width: 20},
        {header: "Registration Status", key: "registration_status", width: 20},
        {header: "Ticket Title", key: "ticket_title", width: 25},
    ];

    if (formQuestions.length > 0) {
        formQuestions.forEach((q) => {
            sheet_columns.push({
                header: q.text,
                key: `qId_${q.id}`,
                width: 30,
            });
        });
    }

    worksheet.columns = sheet_columns;

    attendees.forEach((item) => {
        const rowData = {
            registration_id: item.registrationId,
            name: `${item.firstName || ""} ${item.lastName || ""}`.trim(),
            email: item.email || "",
            phone: item.phone || "",
            registration_time: item.registrationCreatedAt
                ? formatTime(item.registrationCreatedAt)
                : "",
            checkin_time: item.checkinTime ? formatTime(item.checkinTime) : "",
            checkin_status: item.checkinId ? "Checked-in" : "Pending",
            registration_status: item.registrationStatus ? "Active" : "Inactive",
            ticket_title: item.ticketTitle || "N/A",
        };

        // Handle dynamic form questions from additional_fields
        const additionalFields = item.additionalFields || {};
        Object.keys(additionalFields).forEach((key) => {
            const value = additionalFields[key];
            if (value && typeof value === "string" && value.trim()) {
                rowData[`additional_${key}`] = value;
            }
        });

        worksheet.addRow(rowData);
    });

    return workbook;
};

// Initialize registration with extras and payment intent
exports.initRegistration = async (payload) => {
    const {newRegistration, extrasIds} = payload;

    if (!newRegistration) {
        throw new CustomError("New registration data is required", 400);
    }

    const savedRegistration = await exports.defaultSave({
        payload: newRegistration,
    });

    let savedExtrasPurchase = null;
    if (extrasIds?.length) {
        savedExtrasPurchase = await eventService.saveExtrasPurchase({
            extrasIds: extrasIds,
            registrationId: savedRegistration.id,
        });
    }

    const {clientSecret} = await stripeService.createPaymentIntent({
        payload: {
            savedRegistration,
            savedExtrasPurchase,
            extrasIds: extrasIds,
        },
    });

    let responseMsg = null;
    if (clientSecret === "no-stripe") {
        // For free events, we'll handle email sending after payment success
        // increase registration_count in event
        await eventService.increaseRegistrationCount({
            eventId: savedRegistration.eventId,
        });
    }

    return {
        savedRegistration,
        clientSecret,
    };
};

// Complete free registration (no payment required)
exports.completeFreeRegistration = async ({payload}) => {
    const {attendees, selectedTickets, registration, eventId} = payload;

    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new CustomError("Attendees are required", 400);
    }

    if (
        !selectedTickets ||
        !Array.isArray(selectedTickets) ||
        selectedTickets.length === 0
    ) {
        throw new CustomError("Selected tickets are required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // Verify all tickets are free
    const hasPaidTickets = selectedTickets.some((ticket) => ticket.unitPrice > 0);
    if (hasPaidTickets) {
        throw new CustomError(
            "Cannot process free registration with paid tickets",
            400,
        );
    }

    // Check for duplicate email registrations for this event
    for (const attendee of attendees) {
        const existingRegistration = await exports.getRegistrationByEmail({
            email: attendee.email,
            eventId,
        });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    try {
        // 1. Create registration record
        const savedRegistration = await exports.save({
            eventId,
            status: true, // Free registrations are immediately active
            additionalFields: registration?.additionalFields || {},
        });

        // 2. Create attendees
        const attendeesWithRegistrationId = attendees.map((attendee) => ({
            ...attendee,
            registrationId: savedRegistration.id,
        }));

        const savedAttendees = await attendeesService.createAttendees({
            registrationId: savedRegistration.id,
            attendees: attendeesWithRegistrationId,
        });

        // 3. Create order record for free registration
        const totalAmount = selectedTickets.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0,
        );

        // Get event data to access currency
        const event = await eventService.getEventById({eventId});
        if (!event) {
            throw new CustomError("Event not found", 404);
        }

        const savedOrder = await orderService.save({
            payload: {
                orderNumber: orderService.generateOrderNumber(),
                totalAmount: totalAmount,
                currency: event.currency,
                paymentStatus: "free", // Free orders are immediately paid
                items: selectedTickets,
                registrationId: savedRegistration.id,
                eventId,
            },
        });

        // 4. Reduce ticket stock
        for (const item of selectedTickets) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
            });
        }

        // 5. Increase registration count in event
        await eventService.increaseRegistrationCount({
            eventId: eventId,
        });

        // 6. Send confirmation emails to all attendees (async, don't wait)
        savedAttendees.forEach(async (attendee) => {
            try {
                // Fire and forget - don't await
                emailService
                    .sendTicketsByRegistrationId({
                        registrationId: savedRegistration.id,
                        attendeeId: attendee.id,
                    })
                    .catch((error) => {
                        console.error(`Failed to send email to ${attendee.email}:`, error);
                        // Don't fail the registration if email fails
                    });
            } catch (error) {
                console.error(`Failed to queue email for ${attendee.email}:`, error);
                // Don't fail the registration if email fails
            }
        });

        return {
            registrationId: savedRegistration.id,
            orderId: savedOrder.id,
            attendees: savedAttendees,
            order: savedOrder, // Include the complete order data
            status: true,
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        throw new CustomError("Failed to complete free registration", 500);
    }
};

// Get complete free registration confirmation data including order details
exports.getFreeRegistrationConfirmation = async ({registrationId}) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    try {
        // 1. Get registration with attendees
        const registration = await exports.getRegistration({
            registrationId,
            isLoggedIn: false,
        });
        if (!registration) {
            throw new CustomError("Registration not found", 404);
        }

        // 2. Get order data for this registration
        const order = await orderService.getOrderByRegistrationId({
            registrationId,
        });
        if (!order) {
            throw new CustomError("Order not found for this registration", 404);
        }

        // 4. Get ticket details for attendees
        const attendeesWithTickets = await Promise.all(
            registration.attendees.map(async (attendee) => {
                if (attendee.ticketId) {
                    const ticket = await ticketService.getTicketById({
                        ticketId: attendee.ticketId,
                    });
                    return {
                        ...attendee,
                        ticketTitle: ticket?.title || "Unknown Ticket",
                        unitPrice: ticket?.price || 0,
                    };
                }
                return attendee;
            }),
        );

        // 5. Return complete data structure
        return {
            registration: {
                id: registration.id,
                eventId: registration.eventId,
                status: registration.status,
                additionalFields: registration.additionalFields,
                createdAt: registration.createdAt,
                updatedAt: registration.updatedAt,
            },
            attendees: attendeesWithTickets,
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                currency: order.currency,
                paymentStatus: order.paymentStatus,
                items: order.items,
                registrationId: order.registrationId,
                eventId: order.eventId,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            },
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }
        throw new CustomError(
            "Failed to retrieve free registration confirmation data",
            500,
        );
    }
};
