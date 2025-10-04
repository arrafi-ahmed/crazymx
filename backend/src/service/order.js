const CustomError = require("../model/CustomError");
const {query} = require("../db");
const {v4: uuidv4} = require("uuid");
const stripeService = require("../service/stripe");
const ticketService = require("./ticket");
const registrationService = require("./registration");
const attendeesService = require("./attendees");
const emailService = require("./email");
const eventService = require("./event");

exports.save = async ({payload}) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    // Validate required fields
    if (!payload.orderNumber || !payload.orderNumber.trim()) {
        throw new CustomError("Order number is required", 400);
    }

    if (payload.totalAmount == null) {
        throw new CustomError("Valid total amount is required", 400);
    }

    if (!payload.registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    if (!payload.eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        INSERT INTO orders (order_number, total_amount, currency, payment_status, stripe_payment_intent_id, items,
                            registration_id, event_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *;`;

    const result = await query(sql, [
        payload.orderNumber,
        payload.totalAmount,
        payload.currency || "USD",
        payload.paymentStatus || "pending",
        payload.stripePaymentIntentId,
        JSON.stringify(payload.items || []),
        payload.registrationId,
        payload.eventId,
    ]);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create order", 500);
    }

    return result.rows[0];
};

exports.getOrderById = async ({orderId}) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE id = $1
    `;
    const result = await query(sql, [orderId]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.updatePaymentStatus = async ({
                                         orderId,
                                         paymentStatus,
                                         stripePaymentIntentId = null,
                                     }) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    if (!paymentStatus || !paymentStatus.trim()) {
        throw new CustomError("Payment status is required", 400);
    }

    const sql = `
        UPDATE orders
        SET payment_status           = $1,
            stripe_payment_intent_id = $2,
            updated_at               = NOW()
        WHERE id = $3 RETURNING *
    `;
    const result = await query(sql, [
        paymentStatus,
        stripePaymentIntentId,
        orderId,
    ]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.getOrderWithItems = async ({orderId}) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    const sql = `
        SELECT o.*,
               jsonb_build_object(
                       'attendees', COALESCE(
                       (SELECT jsonb_agg(
                                       jsonb_build_object(
                                               'id', a.id,
                                               'firstName', a.first_name,
                                               'lastName', a.last_name,
                                               'email', a.email,
                                               'phone', a.phone,
                                               'ticketId', a.ticket_id,
                                               'qrUuid', a.qr_uuid,
                                               'isPrimary', a.is_primary
                                       )
                               )
                        FROM attendees a
                        WHERE a.registration_id = r.id), '[]' ::jsonb
                                    ),
                       'additionalFields', r.additional_fields
               ) as customer_data
        FROM orders o
                 LEFT JOIN registration r ON o.registration_id = r.id
        WHERE o.id = $1
    `;
    const result = await query(sql, [orderId]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.getOrdersByEventId = async ({eventId}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE event_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

// Generate unique order number
exports.generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    // const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}`;
};

// Create order with validation and payment intent
exports.createOrderWithPayment = async ({
                                            registrationId,
                                            items,
                                            totalAmount,
                                        }) => {
    // Validate required fields
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new CustomError(
            "Items are required and must be a non-empty array",
            400,
        );
    }

    // Get registration data to access customer information

    const registration = await registrationService.getRegistration({
        registrationId: registrationId,
        isLoggedIn: true,
    });

    if (!registration) {
        throw new CustomError("Registration not found", 404);
    }

    // Validate stock availability

    for (const item of items) {
        const ticket = await ticketService.getTicketById({
            ticketId: item.ticketId,
        });
        if (!ticket || ticket.currentStock < item.quantity) {
            throw new CustomError("Insufficient stock for one or more tickets", 400);
        }
    }

    // Use provided totalAmount or calculate it
    let finalTotalAmount = totalAmount;

    if (!finalTotalAmount || isNaN(finalTotalAmount)) {
        // Calculate total amount from items
        finalTotalAmount = 0;
        items.forEach((item, index) => {
            const unitPrice = Number(item.unitPrice || item.price || 0);
            const quantity = Number(item.quantity || 1);

            if (isNaN(unitPrice) || unitPrice < 0) {
                throw new CustomError(
                    `Invalid unitPrice for item ${index}: ${item.unitPrice || item.price}`,
                    400,
                );
            }

            if (isNaN(quantity) || quantity <= 0) {
                throw new CustomError(
                    `Invalid quantity for item ${index}: ${item.quantity}`,
                    400,
                );
            }

            finalTotalAmount += unitPrice * quantity;
        });
    } else {
        finalTotalAmount = Number(finalTotalAmount);
    }

    if (finalTotalAmount < 0) {
        throw new CustomError("Invalid total amount", 400);
    }

    // Get event currency
    const event = await eventService.getEventById({
        eventId: registration.eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Create order with items
    const orderData = {
        orderNumber: exports.generateOrderNumber(),
        totalAmount: finalTotalAmount,
        currency: eventCurrency,
        paymentStatus: "pending",
        items,
        registrationId,
        eventId: registration.eventId,
        clubId: registration.clubId,
    };

    const savedOrder = await exports.save({payload: orderData});

    // Get registration data to get email from primary attendee

    const attendees = await attendeesService.getAttendeesByRegistrationId({
        registrationId: registrationId,
    });
    const primaryAttendee = attendees.find((a) => a.isPrimary) || attendees[0];
    const customerEmail = primaryAttendee ? primaryAttendee.email : "";

    // Create Stripe payment intent
    const {clientSecret} = await stripeService.createOrderPaymentIntent({
        payload: {
            orderId: savedOrder.id,
            items: items,
            customerEmail: customerEmail,
            registrationId: registrationId,
        },
    });

    // If it's a free order (no-stripe), update payment status and send email
    if (clientSecret === "no-stripe") {
        await exports.updatePaymentStatus({
            orderId: savedOrder.id,
            paymentStatus: "paid",
        });

        // Update registration status to paid
        if (savedOrder && savedOrder.registrationId) {
            const sql = `
                UPDATE registration
                SET status = true
                WHERE id = $1
            `;
            await query(sql, [savedOrder.registrationId]);
        }

        // Update ticket stock
        for (const item of items) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
            });
        }

        // Send confirmation email (async, don't wait)
        emailService
            .sendTicketsByRegistrationId({
                registrationId: registrationId,
            })
            .catch((error) => {
                console.error("Failed to send email for free order:", error);
            });
    }

    return {
        order: savedOrder,
        clientSecret,
    };
};

// Update payment status with stock update
exports.updatePaymentStatusWithStockUpdate = async ({
                                                        orderId,
                                                        paymentStatus,
                                                        stripePaymentIntentId,
                                                    }) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }
    if (!paymentStatus) {
        throw new CustomError("Payment status is required", 400);
    }

    const updatedOrder = await exports.updatePaymentStatus({
        orderId,
        paymentStatus,
        stripePaymentIntentId,
    });

    // If payment successful, update ticket stock
    if (paymentStatus === "paid") {
        const orderWithItems = await exports.getOrderWithItems({orderId});

        for (const item of orderWithItems.items) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
            });
        }
    }

    return updatedOrder;
};

exports.getOrderByRegistrationId = async ({registrationId}) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE registration_id = $1
        ORDER BY created_at DESC LIMIT 1
    `;
    const result = await query(sql, [registrationId]);

    if (result.rows.length === 0) {
        return null; // No order found for this registration
    }

    return result.rows[0];
};
