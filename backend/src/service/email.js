const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const {generateQrCode, appInfo, generateQrData} = require("../others/util");
const {formatTime, formatDateToMonDD, formatEventDateTime} = require("../others/util");
const {createTransport} = require("nodemailer");
const registrationService = require("./registration");
const CustomError = require("../model/CustomError");
const attendeesService = require("./attendees");

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

    const attachments = [];

    // Generate QR code for this specific attendee
    const qrCodeMain = await generateQrData({
        registrationId: attendee.registrationId,
        attendeeId: attendee.id,
        qrUuid: attendee.qrUuid,
    });
    attachments.push({
        type: "qrcode",
        content: qrCodeMain,
        cid: "qrCodeMain",
    });

    // Add extras QR code if this is the primary attendee and extras exist
    let qrCodeExtras = null;
    if (
        attendee.isPrimary &&
        extrasPurchase?.id &&
        extrasPurchase.extrasData?.length
    ) {
        qrCodeExtras = await generateQrCode({
            id: extrasPurchase.id,
            qrUuid: extrasPurchase.qrUuid,
        });
        attachments.push({
            type: "qrcode",
            content: qrCodeExtras,
            cid: "qrCodeExtras",
        });
    }

    const isSingleDay = event?.config?.isSingleDayEvent === true || event?.config?.isSingleDayEvent === 'true';
    const isAllDay = event?.config?.isAllDay === true || event?.config?.isAllDay === 'true';
    const dateFormat = event?.config?.dateFormat || "MM/DD/YYYY HH:mm";
    const sameDay = event?.startDate && event?.endDate
        ? new Date(event.startDate).toDateString() === new Date(event.endDate).toDateString()
        : false;

    const eventDateDisplay = (() => {
        if (!event?.startDate && !event?.endDate) return 'Date TBA';

        // For all-day events, remove time from format
        const formatToUse = isAllDay ? dateFormat.replace(/ HH:mm|HH:mm/g, '') : dateFormat;

        if ((isSingleDay || sameDay) && event?.startDate) {
            return formatEventDateTime(event.startDate, formatToUse);
        }
        if (event?.startDate && event?.endDate) {
            return `${formatEventDateTime(event.startDate, formatToUse)} – ${formatEventDateTime(event.endDate, formatToUse)}`;
        }
        return event?.startDate ? formatEventDateTime(event.startDate, formatToUse) : formatEventDateTime(event.endDate, formatToUse);
    })();

    const html = compileTicketTemplate({
        eventName: event.name,
        name: `${attendee.firstName} ${attendee.lastName}`,
        email: attendee.email,
        phone: attendee.phone || "",
        location: event.location,
        registrationTime: formatTime(registration.createdAt),
        eventDateDisplay,
        extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
        appName: appInfo.name,
    });

    // Send email only to this specific attendee
    return exports.sendMail({
        to: attendee.email,
        subject: `🎟️ Ticket for ${event.name} - ${attendee.firstName} ${attendee.lastName}`,
        html,
        attachments,
    });
};

exports.sendTicketsByRegistrationId = async ({registrationId}) => {
    // Get registration data with event and extras
    const {registration, event, extrasPurchase} = await registrationService.getRegistrationWEventWExtrasPurchase({
        registrationId,
    });

    // Get all attendees for this registration
    const attendees = await attendeesService.getAttendeesByRegistrationId({
        registrationId: registration.id,
    });

    if (!attendees || attendees.length === 0) {
        throw new CustomError("No attendees found for this registration", 404);
    }

    const results = [];

    // If saving only primary attendee details, send a single email to primary including total attendees
    const saveAll = event?.config?.saveAllAttendeesDetails === true || event?.config?.saveAllAttendeesDetails === 'true';
    if (!saveAll) {
        const primary = attendees.find(a => a.isPrimary) || attendees[0];
        if (!primary) {
            throw new CustomError("Primary attendee not found", 404);
        }

        // compute totalAttendees from orders
        const totalAttendees = await (() => (async () => {
            const {query} = require('../db');
            const sql = `
                SELECT COALESCE(SUM((item->>'quantity')::int), 0) AS total_attendees
                FROM orders o
                         CROSS JOIN LATERAL jsonb_array_elements(o.items) AS item
                WHERE o.registration_id = $1
            `;
            const r = await query(sql, [registration.id]);
            return r.rows?.[0]?.total_attendees || 0;
        })())();

        // Generate QR code for the primary attendee only
        const attachments = [];
        const qrCodeMain = await generateQrData({
            registrationId: primary.registrationId,
            attendeeId: primary.id,
            qrUuid: primary.qrUuid,
        });
        attachments.push({type: 'qrcode', content: qrCodeMain, cid: 'qrCodeMain'});

        // Extras QR if applicable
        if (extrasPurchase?.id && extrasPurchase.extrasData?.length) {
            const qrCodeExtras = await generateQrCode({id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid});
            attachments.push({type: 'qrcode', content: qrCodeExtras, cid: 'qrCodeExtras'});
        }

        const isSingleDay = event?.config?.isSingleDayEvent === true || event?.config?.isSingleDayEvent === 'true';
        const isAllDay = event?.config?.isAllDay === true || event?.config?.isAllDay === 'true';
        const dateFormat = event?.config?.dateFormat || "MM/DD/YYYY HH:mm";
        const sameDay = event?.startDate && event?.endDate
            ? new Date(event.startDate).toDateString() === new Date(event.endDate).toDateString()
            : false;

        const eventDateDisplay = (() => {
            if (!event?.startDate && !event?.endDate) return 'Date TBA';

            // For all-day events, remove time from format
            const formatToUse = isAllDay ? dateFormat.replace(/ HH:mm|HH:mm/g, '') : dateFormat;

            if ((isSingleDay || sameDay) && event?.startDate) {
                return formatEventDateTime(event.startDate, formatToUse);
            }
            if (event?.startDate && event?.endDate) {
                return `${formatEventDateTime(event.startDate, formatToUse)} – ${formatEventDateTime(event.endDate, formatToUse)}`;
            }
            return event?.startDate ? formatEventDateTime(event.startDate, formatToUse) : formatEventDateTime(event.endDate, formatToUse);
        })();

        const html = compileTicketTemplate({
            eventName: event.name,
            name: `${primary.firstName} ${primary.lastName}`,
            email: primary.email,
            phone: primary.phone || "",
            location: event.location,
            registrationTime: formatTime(registration.createdAt),
            eventDateDisplay,
            extrasList: extrasPurchase?.extrasData || [],
            appName: appInfo.name,
        });

        const sent = await exports.sendMail({
            to: primary.email,
            subject: `🎟️ Tickets for ${event.name}`,
            html,
            attachments,
        });

        return {
            registrationId,
            totalAttendees,
            successfulEmails: 1,
            failedEmails: 0,
            results: [{attendeeId: primary.id, email: primary.email, messageId: sent.messageId, success: true}],
        };
    }

    // Send email to each attendee
    for (const attendee of attendees) {
        try {
            const attachments = [];

            // Generate QR code for this specific attendee
            const qrCodeMain = await generateQrData({
                registrationId: attendee.registrationId,
                attendeeId: attendee.id,
                qrUuid: attendee.qrUuid,
            });
            attachments.push({
                type: "qrcode",
                content: qrCodeMain,
                cid: "qrCodeMain",
            });

            // Add extras QR code if this is the primary attendee and extras exist
            let qrCodeExtras = null;
            if (
                attendee.isPrimary &&
                extrasPurchase?.id &&
                extrasPurchase.extrasData?.length
            ) {
                qrCodeExtras = await generateQrCode({
                    id: extrasPurchase.id,
                    qrUuid: extrasPurchase.qrUuid,
                });
                attachments.push({
                    type: "qrcode",
                    content: qrCodeExtras,
                    cid: "qrCodeExtras",
                });
            }

            const isSingleDayEach = event?.config?.isSingleDayEvent === true || event?.config?.isSingleDayEvent === 'true';
            const isAllDayEach = event?.config?.isAllDay === true || event?.config?.isAllDay === 'true';
            const dateFormatEach = event?.config?.dateFormat || "MM/DD/YYYY HH:mm";
            const sameDayEach = event?.startDate && event?.endDate
                ? new Date(event.startDate).toDateString() === new Date(event.endDate).toDateString()
                : false;

            const eventDateDisplayEach = (() => {
                if (!event?.startDate && !event?.endDate) return 'Date TBA';

                // For all-day events, remove time from format
                const formatToUse = isAllDayEach ? dateFormatEach.replace(/ HH:mm|HH:mm/g, '') : dateFormatEach;

                if ((isSingleDayEach || sameDayEach) && event?.startDate) {
                    return formatEventDateTime(event.startDate, formatToUse);
                }
                if (event?.startDate && event?.endDate) {
                    return `${formatEventDateTime(event.startDate, formatToUse)} – ${formatEventDateTime(event.endDate, formatToUse)}`;
                }
                return event?.startDate ? formatEventDateTime(event.startDate, formatToUse) : formatEventDateTime(event.endDate, formatToUse);
            })();

            const html = compileTicketTemplate({
                eventName: event.name,
                name: `${attendee.firstName} ${attendee.lastName}`,
                email: attendee.email,
                phone: attendee.phone || "",
                location: event.location,
                registrationTime: formatTime(registration.createdAt),
                eventDateDisplay: eventDateDisplayEach,
                extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
                appName: appInfo.name,
            });

            // Send email to this specific attendee
            const result = await exports.sendMail({
                to: attendee.email,
                subject: `🎟️ Ticket for ${event.name} - ${attendee.firstName} ${attendee.lastName}`,
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