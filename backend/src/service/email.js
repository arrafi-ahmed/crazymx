const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const {generateQrCode, appInfo, generateQrData} = require("../others/util");
const {formatTime} = require("../others/util");
const {
    formatInTimezone,
    formatLongDate,
    formatEventDateTimeRange,
    getTimezoneAbbreviation,
} = require("../others/dateUtils");
const {
    isGroupTicket,
    getQrMessage,
    getEmailSubject,
    isRegistrantDetails,
} = require("../utils/ticketUtils");
const {createTransport} = require("nodemailer");
const registrationService = require("./registration");
const CustomError = require("../model/CustomError");
const attendeesService = require("./attendees");
const {query} = require("../db");

const {SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, VUE_BASE_URL} =
    process.env;

// Only create transporter if SMTP credentials are provided
let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
}
const processAttachments = async (attachments = []) => {
    const result = [];

    for (const attachment of attachments) {
        if (attachment?.type === "qrcode") {
            result.push({
                filename: attachment.filename || "qrcode.png",
                content: attachment.content,
                cid: attachment.cid || "attachmentQrCode", // must match src="cid:attachmentQrCode"
                encoding: attachment.encoding || "base64",
            });
        } else if (attachment?.type === "pdf") {
            result.push({
                filename: attachment.filename || "attachment.pdf",
                content: Buffer.from(attachment.content.output(), "binary"),
            });
        } else {
            result.push(attachment); // add as-is if not QR
        }
    }
    return result;
};

exports.sendMail = async ({to, subject, html, attachments}) => {
    // If no SMTP configuration, log the email instead of sending
    if (!transporter) {
        return {messageId: "mock-message-id"};
    }

    const mailOptions = {
        from: `${appInfo.name} <${SMTP_USER}>`,
        to,
        // bcc: '',
        subject,
        html,
        attachments: attachments?.length
            ? await processAttachments(attachments)
            : [],
    };
    return transporter.sendMail(mailOptions);
};

const emailTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "eventTicketEmail.html",
);
const emailTemplateSource = fs.readFileSync(emailTemplatePath, "utf8");

// Register Handlebars helper for currency formatting
handlebars.registerHelper('formatCurrency', function(amount, currency) {
    const currencySymbols = {
        'USD': '$',
        'GBP': '£',
        'EUR': '€',
        'JPY': '¥',
        'INR': '₹',
    };
    const symbol = currencySymbols[currency] || currency;
    const value = (amount / 100).toFixed(2);
    return `${symbol}${value}`;
});

const compileTicketTemplate = handlebars.compile(emailTemplateSource);

exports.sendTicketByAttendeeId = async ({attendeeId}) => {
    // Get the specific attendee by attendeeId first
    const attendee = await attendeesService.getAttendeeById({attendeeId});

    if (!attendee) {
        throw new CustomError("Attendee not found", 404);
    }

    // Now get the registration data using the registrationId from the attendee
    const {registration, event, extrasPurchase} =
        await registrationService.getRegistrationWEventWExtrasPurchase({
            registrationId: attendee.registrationId,
        });

    // Get user timezone from registration dedicated columns
    const userTimezone = registration.userTimezone || 'UTC';
    const timezoneAbbr = getTimezoneAbbreviation(userTimezone);

    // Get order details and total quantity
    const orderSql = `
        SELECT o.total_amount,
               COALESCE(SUM((item->>'quantity')::int), 0) AS total_tickets,
               jsonb_agg(
                   jsonb_build_object(
                       'ticketTitle', COALESCE(item->>'title', 'Ticket'),
                       'quantity', COALESCE((item->>'quantity')::int, 0),
                       'unitPrice', COALESCE((item->>'unitPrice')::int, 0)
                   )
               ) AS items_detail
        FROM orders o, jsonb_array_elements(o.items) AS item
        WHERE o.registration_id = $1
        GROUP BY o.total_amount
    `;
    const orderResult = await query(orderSql, [registration.id]);
    const totalTickets = orderResult.rows[0]?.totalTickets || 1;
    const orderItems = orderResult.rows[0]?.itemsDetail || [];
    const hasMultipleTicketTypes = orderItems.length > 1;
    
    // Calculate payment summary
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalAmount = orderResult.rows[0]?.totalAmount || subtotal;
    // No tax on free orders
    const taxAmount = subtotal === 0 ? 0 : totalAmount - subtotal;

    // Determine if group ticket using utility
    const isGroup = isGroupTicket({
        saveAllAttendeesDetails: event?.config?.saveAllAttendeesDetails,
        totalQuantity: totalTickets
    });

    // Generate QR code
    const attachments = [];
    const qrCodeMain = await generateQrData({
        registrationId: attendee.registrationId,
        attendeeId: attendee.id,
        qrUuid: attendee.qrUuid,
    });
    attachments.push({type: "qrcode", content: qrCodeMain, cid: "qrCodeMain"});

    // Add extras QR if primary attendee
    if (attendee.isPrimary && extrasPurchase?.id && extrasPurchase.extrasData?.length) {
        const qrCodeExtras = await generateQrCode({id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid});
        attachments.push({type: "qrcode", content: qrCodeExtras, cid: "qrCodeExtras"});
    }

    // Format dates
    const eventDateDisplay = formatEventDateTimeRange(
        event.startDate,
        event.endDate,
        userTimezone,
        event.config || {}
    );
    const registrationTime = formatLongDate(registration.createdAt, userTimezone);

    // Build email template data
    const html = compileTicketTemplate({
        eventName: event.name,
        name: `${attendee.firstName} ${attendee.lastName}`,
        email: attendee.email,
        phone: attendee.phone || "",
        location: event.location,
        registrationTime,
        eventDateDisplay,
        ticketType: hasMultipleTicketTypes ? null : (attendee.ticketTitle || orderItems[0]?.ticketTitle),
        quantity: hasMultipleTicketTypes ? null : (isGroup ? totalTickets : 1),
        isGroupTicket: isGroup,
        isRegistrantDetails: isRegistrantDetails(isGroup),
        hasMultipleTicketTypes,
        showTicketsSection: isGroup && hasMultipleTicketTypes, // Only show for group tickets with multiple types
        groupMessage: getQrMessage(isGroup),
        orderItems,
        currency: event.currency || 'USD',
        subtotal,
        taxAmount,
        totalAmount,
        extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
        appName: appInfo.name,
        userTimezone,
        timezoneAbbr,
    });

    return exports.sendMail({
        to: attendee.email,
        subject: getEmailSubject(isGroup, event.name),
        html,
        attachments,
    });
};

exports.sendTicketsByRegistrationId = async ({registrationId}) => {
    // Get registration data with event and extras
    const {registration, event, extrasPurchase} = await registrationService.getRegistrationWEventWExtrasPurchase({
        registrationId,
    });

    // Get user timezone from registration
    const userTimezone = registration.userTimezone || 'UTC';
    const timezoneAbbr = getTimezoneAbbreviation(userTimezone);

    // Get all attendees for this registration
    const attendees = await attendeesService.getAttendeesByRegistrationId({
        registrationId: registration.id,
    });

    if (!attendees || attendees.length === 0) {
        throw new CustomError("No attendees found for this registration", 404);
    }

    // Get order details and total quantity from orders table
    const orderSql = `
        SELECT o.total_amount,
               COALESCE(SUM((item->>'quantity')::int), 0) AS total_tickets,
               jsonb_agg(
                   jsonb_build_object(
                       'ticketTitle', COALESCE(item->>'title', 'Ticket'),
                       'quantity', COALESCE((item->>'quantity')::int, 0),
                       'unitPrice', COALESCE((item->>'unitPrice')::int, 0)
                   )
               ) AS items_detail
        FROM orders o, jsonb_array_elements(o.items) AS item
        WHERE o.registration_id = $1
        GROUP BY o.total_amount
    `;
    const orderResult = await query(orderSql, [registration.id]);
    const totalTickets = orderResult.rows[0]?.totalTickets || 1;
    const orderItems = orderResult.rows[0]?.itemsDetail || [];
    const hasMultipleTicketTypes = orderItems.length > 1;
    
    // Calculate payment summary
    const subtotal = orderItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalAmount = orderResult.rows[0]?.totalAmount || subtotal;
    // No tax on free orders
    const taxAmount = subtotal === 0 ? 0 : totalAmount - subtotal;

    // Determine if group ticket using utility
    const isGroup = isGroupTicket({
        saveAllAttendeesDetails: event?.config?.saveAllAttendeesDetails,
        totalQuantity: totalTickets
    });

    // Format dates
    const eventDateDisplay = formatEventDateTimeRange(
        event.startDate,
        event.endDate,
        userTimezone,
        event.config || {}
    );
    const registrationTime = formatLongDate(registration.createdAt, userTimezone);

    // If group ticket, send single email to primary
    if (isGroup) {
        const primary = attendees.find(a => a.isPrimary) || attendees[0];
        if (!primary) {
            throw new CustomError("Primary attendee not found", 404);
        }

        // Generate QR code
        const attachments = [];
        const qrCodeMain = await generateQrData({
            registrationId: primary.registrationId,
            attendeeId: primary.id,
            qrUuid: primary.qrUuid,
        });
        attachments.push({type: 'qrcode', content: qrCodeMain, cid: 'qrCodeMain'});

        // Add extras QR if applicable
        if (extrasPurchase?.id && extrasPurchase.extrasData?.length) {
            const qrCodeExtras = await generateQrCode({id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid});
            attachments.push({type: 'qrcode', content: qrCodeExtras, cid: 'qrCodeExtras'});
        }

        const html = compileTicketTemplate({
            eventName: event.name,
            name: `${primary.firstName} ${primary.lastName}`,
            email: primary.email,
            phone: primary.phone || "",
            location: event.location,
            registrationTime,
            eventDateDisplay,
            ticketType: hasMultipleTicketTypes ? null : (primary.ticketTitle || orderItems[0]?.ticketTitle),
            quantity: hasMultipleTicketTypes ? null : totalTickets,
            isGroupTicket: isGroup,
            isRegistrantDetails: isRegistrantDetails(isGroup),
            hasMultipleTicketTypes,
            showTicketsSection: isGroup && hasMultipleTicketTypes, // Only show for group tickets with multiple types
            groupMessage: getQrMessage(isGroup),
            orderItems,
            currency: event.currency || 'USD',
            subtotal,
            taxAmount,
            totalAmount,
            extrasList: extrasPurchase?.extrasData || [],
            appName: appInfo.name,
            userTimezone,
            timezoneAbbr,
        });

        const sent = await exports.sendMail({
            to: primary.email,
            subject: getEmailSubject(isGroup, event.name),
            html,
            attachments,
        });

        return {
            registrationId,
            totalAttendees: totalTickets,
            successfulEmails: 1,
            failedEmails: 0,
            results: [{attendeeId: primary.id, email: primary.email, messageId: sent.messageId, success: true}],
        };
    }

    // Send individual emails to each attendee
    const results = [];
    for (const attendee of attendees) {
        try {
            // Generate QR code
            const attachments = [];
            const qrCodeMain = await generateQrData({
                registrationId: attendee.registrationId,
                attendeeId: attendee.id,
                qrUuid: attendee.qrUuid,
            });
            attachments.push({type: "qrcode", content: qrCodeMain, cid: "qrCodeMain"});

            // Add extras QR if primary attendee
            if (attendee.isPrimary && extrasPurchase?.id && extrasPurchase.extrasData?.length) {
                const qrCodeExtras = await generateQrCode({id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid});
                attachments.push({type: "qrcode", content: qrCodeExtras, cid: "qrCodeExtras"});
            }

            // Find the attendee's specific ticket price
            const attendeeTicket = orderItems.find(item => item.ticketTitle === attendee.ticketTitle) || orderItems[0];
            const attendeeTicketPrice = attendeeTicket?.unitPrice || 0;
            
            const html = compileTicketTemplate({
                eventName: event.name,
                name: `${attendee.firstName} ${attendee.lastName}`,
                email: attendee.email,
                phone: attendee.phone || "",
                location: event.location,
                registrationTime,
                eventDateDisplay,
                ticketType: attendee.ticketTitle || attendeeTicket?.ticketTitle,
                quantity: 1,
                isGroupTicket: false,
                isRegistrantDetails: isRegistrantDetails(false),
                hasMultipleTicketTypes,
                showTicketsSection: false, // Never show tickets section for individual attendee emails
                groupMessage: getQrMessage(false),
                orderItems,
                currency: event.currency || 'USD',
                subtotal: attendeeTicketPrice,
                taxAmount: 0,
                totalAmount: attendeeTicketPrice,
                extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
                appName: appInfo.name,
                userTimezone,
                timezoneAbbr,
            });

            const result = await exports.sendMail({
                to: attendee.email,
                subject: getEmailSubject(false, event.name),
                html,
                attachments,
            });

            results.push({
                attendeeId: attendee.id,
                email: attendee.email,
                messageId: result.messageId,
                success: true,
            });
        } catch (error) {
            console.error(`Failed to send email to attendee ${attendee.id}:`, error);
            results.push({
                attendeeId: attendee.id,
                email: attendee.email,
                error: error.message,
                success: false,
            });
        }
    }

    return {
        registrationId,
        totalAttendees: attendees.length,
        successfulEmails: results.filter(r => r.success).length,
        failedEmails: results.filter(r => !r.success).length,
        results,
    };
};