const CustomError = require("../model/CustomError");
const {query} = require("../db");

exports.save = async ({payload, currentUser}) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    // Remove id from payload if it's null or undefined to let database auto-generate
    const {id, ...ticketData} = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!ticketData.title || !ticketData.title.trim()) {
        throw new CustomError("Title is required", 400);
    }

    if (ticketData.price == null || ticketData.price < 0) {
        throw new CustomError("Valid price is required", 400);
    }

    if (!ticketData.eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const newTicket = {
        ...ticketData,
        eventId: payload.eventId,
        // Map camelCase to snake_case for database
        current_stock: payload.currentStock || payload.current_stock || 0,
        max_stock: payload.maxStock || payload.max_stock || 100,
    };

    // If updating existing ticket (id exists), use upsert
    if (id) {
        const sql = `
            INSERT INTO ticket (id, title, description, price, current_stock, max_stock, event_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) ON CONFLICT (id) DO
            UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                current_stock = EXCLUDED.current_stock,
                max_stock = EXCLUDED.max_stock,
                event_id = EXCLUDED.event_id
                RETURNING
                id,
                title,
                description,
                price,
                current_stock as "currentStock",
                max_stock as "maxStock",
                event_id as "eventId",
                created_at as "createdAt"
        `;
        const values = [
            id,
            newTicket.title,
            newTicket.description,
            newTicket.price,
            newTicket.current_stock,
            newTicket.max_stock,
            newTicket.eventId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update ticket", 500);
        }

        return result.rows[0];
    } else {
        // If creating new ticket, don't include id
        const sql = `
            INSERT INTO ticket (title, description, price, current_stock, max_stock, event_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING 
                id,
                title,
                description,
                price,
                current_stock as "currentStock",
                max_stock as "maxStock",
                event_id as "eventId",
                created_at as "createdAt"
        `;
        const values = [
            newTicket.title,
            newTicket.description,
            newTicket.price,
            newTicket.current_stock,
            newTicket.max_stock,
            newTicket.eventId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create ticket", 500);
        }

        return result.rows[0];
    }
};

exports.getTicketsByEventId = async ({eventId}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT id,
               title,
               description,
               price,
               current_stock as "currentStock",
               max_stock     as "maxStock",
               event_id      as "eventId",
               created_at    as "createdAt"
        FROM ticket
        WHERE event_id = $1
        ORDER BY price ASC
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

exports.getTicketById = async ({ticketId}) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    const sql = `
        SELECT id,
               title,
               description,
               price,
               current_stock as "currentStock",
               max_stock     as "maxStock",
               event_id      as "eventId",
               created_at    as "createdAt"
        FROM ticket
        WHERE id = $1
    `;
    const result = await query(sql, [ticketId]);

    if (!result.rows[0]) {
        throw new CustomError("Ticket not found", 404);
    }

    return result.rows[0];
};

exports.updateStock = async ({ticketId, quantity}) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    if (!quantity || quantity <= 0) {
        throw new CustomError("Valid quantity is required", 400);
    }

    const sql = `
        UPDATE ticket
        SET current_stock = current_stock - $1
        WHERE id = $2
          AND current_stock >= $1 RETURNING 
            id,
            title,
            description,
            price,
            current_stock as "currentStock",
            max_stock as "maxStock",
            event_id as "eventId",
            created_at as "createdAt"
    `;
    const result = await query(sql, [quantity, ticketId]);

    if (result.rows.length === 0) {
        throw new CustomError("Insufficient stock or ticket not found", 400);
    }

    return result.rows[0];
};

exports.removeTicket = async ({ticketId, eventId}) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        DELETE
        FROM ticket
        WHERE id = $1
          AND event_id = $2 RETURNING *
    `;
    const result = await query(sql, [ticketId, eventId]);

    if (!result.rows[0]) {
        throw new CustomError("Ticket not found or access denied", 404);
    }

    return result.rows[0];
};
