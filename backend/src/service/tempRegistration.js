const {query} = require("../db");
const CustomError = require("../model/CustomError");

// Store temporary registration data
exports.storeTempRegistration = async (payload) => {
    const {
        sessionId,
        attendees,
        registration,
        selectedTickets,
        eventId,
        orders,
    } = payload;

    try {
        // Validate input data
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
            throw new CustomError(
                "Attendees are required and must be a non-empty array",
                400,
            );
        }
        if (!registration) {
            throw new CustomError("Registration data is required", 400);
        }
        if (!selectedTickets || !Array.isArray(selectedTickets)) {
            throw new CustomError(
                "Selected tickets are required and must be an array",
                400,
            );
        }
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        const queryText = `
            INSERT INTO temp_registration
            (session_id, attendees, registration, selected_tickets, orders, event_id, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (session_id) DO
            UPDATE SET
                attendees = EXCLUDED.attendees,
                registration = EXCLUDED.registration,
                selected_tickets = EXCLUDED.selected_tickets,
                orders = EXCLUDED.orders,
                event_id = EXCLUDED.event_id,
                expires_at = EXCLUDED.expires_at
        `;

        await query(queryText, [
            sessionId,
            JSON.stringify(attendees),
            JSON.stringify(registration),
            JSON.stringify(selectedTickets),
            JSON.stringify(orders),
            eventId,
            expiresAt,
        ]);

        return true;
    } catch (error) {
        console.error("Error storing temporary attendee data:", error);
        throw error;
    }
};

// Retrieve temporary registration data
exports.getTempRegistration = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT *
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }

        const row = result.rows[0];

        const tempRegistration = {
            ...row,
        };

        return tempRegistration;
    } catch (error) {
        console.error("Error retrieving temporary registration data:", error);
        throw error;
    }
};

exports.getTempRegistrationWAttendees = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT tr.*,
                   jsonb_build_object(
                       'id', e.id,
                       'name', e.name,
                       'currency', e.currency,
                       'config', e.config
                   ) AS event,
                   COALESCE(
                           jsonb_agg(
                                   jsonb_build_object(
                                           'id', a.id,
                                           'registration_id', a.registration_id,
                                           'is_primary', a.is_primary,
                                           'first_name', a.first_name,
                                           'last_name', a.last_name,
                                           'email', a.email,
                                           'phone', a.phone,
                                           'ticket_id', a.ticket_id,
                                           'qr_uuid', a.qr_uuid,
                                           'created_at', a.created_at,
                                           'updated_at', a.updated_at
                                   )
                           ) FILTER(WHERE a.id IS NOT NULL), '[]' ::jsonb
                   ) AS attendees
            FROM temp_registration tr
                     JOIN event e ON tr.event_id = e.id
                     LEFT JOIN attendees a
                               ON tr.session_id = a.session_id
            WHERE tr.session_id = $1
            GROUP BY tr.session_id, tr.event_id, tr.registration, tr.selected_tickets, tr.orders, e.id, e.name, e.config;
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }
        return result.rows[0];
    } catch (error) {
        console.error("Error retrieving temporary registration data:", error);
        throw error;
    }
};

// Update session activity and extend expiration
exports.updateSessionActivity = async (sessionId, extendHours = 24) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // First get the current session to validate it exists
        const currentSession = await exports.getTempRegistration(sessionId);
        if (!currentSession) {
            throw new CustomError("Session not found or expired", 404);
        }

        // Calculate new expiration time
        const newExpiresAt = new Date(Date.now() + extendHours * 60 * 60 * 1000);

        const queryText = `
            UPDATE temp_registration
            SET expires_at = $1
            WHERE session_id = $2
        `;

        await query(queryText, [newExpiresAt, sessionId]);

        return {
            sessionId,
            newExpiresAt,
            extended: true,
        };
    } catch (error) {
        console.error("Error updating session activity:", error);
        throw error;
    }
};

// Get session status without returning full data
exports.getSessionStatus = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT session_id, event_id, expires_at, created_at
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            return {
                sessionId,
                valid: false,
                exists: false,
            };
        }

        const row = result.rows[0];
        return {
            sessionId: row.session_id,
            valid: true,
            exists: true,
            eventId: row.event_id,
            expiresAt: row.expires_at,
            createdAt: row.created_at,
        };
    } catch (error) {
        console.error("Error getting session status:", error);
        throw error;
    }
};

// Get temporary registration data by session ID (for success page)
exports.getTempRegistrationBySessionId = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // Get temp registration data
        const tempQuery = `
            SELECT *
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const tempResult = await query(tempQuery, [sessionId]);

        if (tempResult.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }

        const tempRow = tempResult.rows[0];
        const tempRegistration = {
            ...tempRow,
        };

        // Get actual registration data for all attendees with this email and event
        const attendeeQuery = `
            SELECT r.id         as registration_id,
                   r.event_id,
                   r.status     as registration_status,
                   r.additional_fields,
                   r.created_at as registration_created_at,
                   r.updated_at as registration_updated_at,
                   a.id         as attendee_id,
                   a.first_name,
                   a.last_name,
                   a.email,
                   a.phone,
                   a.ticket_id,
                   a.qr_uuid,
                   a.is_primary,
                   a.created_at as attendee_created_at,
                   a.updated_at as attendee_updated_at,
                   t.title      as ticket_title,
                   t.price      as ticket_price
            FROM registration r
                     INNER JOIN attendees a ON r.id = a.registration_id
                     LEFT JOIN ticket t ON a.ticket_id = t.id
            WHERE a.email = $1
              AND r.event_id = $2
            ORDER BY r.created_at DESC, a.is_primary DESC
        `;

        const attendeeResult = await query(attendeeQuery, [
            tempRow.attendees[0]?.email,
            tempRow.event_id,
        ]);

        // Group attendees by registration
        const registrations = {};
        attendeeResult.rows.forEach((row) => {
            const regId = row.registration_id;
            if (!registrations[regId]) {
                registrations[regId] = {
                    id: row.registration_id,
                    eventId: row.event_id,
                    status: row.registration_status,
                    additionalFields: row.additional_fields || {},
                    createdAt: row.registration_created_at,
                    updatedAt: row.registration_updated_at,
                    attendees: [],
                };
            }

            registrations[regId].attendees.push({
                id: row.attendee_id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email,
                phone: row.phone,
                ticketId: row.ticket_id,
                ticketTitle: row.ticket_title,
                ticketPrice: row.ticket_price,
                qrUuid: row.qr_uuid,
                isPrimary: row.is_primary,
                createdAt: row.attendee_created_at,
                updatedAt: row.attendee_updated_at,
            });
        });

        return {
            tempRegistration,
            registrations: Object.values(registrations),
        };
    } catch (error) {
        console.error(
            "Error retrieving temporary registration data by session ID:",
            error,
        );
        throw error;
    }
};
