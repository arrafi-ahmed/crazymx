const {VUE_BASE_URL, STRIPE_SECRET} = process.env;
const stripe = require("stripe")(STRIPE_SECRET);
const {query} = require("../db");
const CustomError = require("../model/CustomError");
const registrationService = require("./registration");
const eventService = require("./event");
const ticketService = require("./ticket");
const emailService = require("./email");
const tempRegistrationService = require("./tempRegistration");
const orderService = require("./order");
const {v4: uuidv4} = require("uuid");
const {defaultCurrency} = require("../others/util");
const sponsorshipService = require("./sponsorship");
const attendeesService = require("./attendees");

exports.createProduct = async ({payload}) => {
    const createdProduct = await stripe.products.create(payload);
    return createdProduct;
};

exports.updateProduct = async ({id, payload}) => {
    const updatedProduct = await stripe.products.update(id, payload);
    return updatedProduct;
};

exports.deleteProduct = async ({id}) => {
    const deletedProduct = await stripe.products.del(id);
    return deletedProduct;
};

exports.retrieveProduct = async ({id}) => {
    const retrievedProduct = await stripe.products.retrieve(id);
    return retrievedProduct;
};

exports.createPrice = async ({payload}) => {
    const createdPrice = await stripe.prices.create(payload);
    return createdPrice;
};

exports.updatePrice = async ({id, payload}) => {
    const updatedPrice = await stripe.prices.update(id, payload);
    return updatedPrice;
};

exports.createProductPrice = async ({product, price}) => {
    //create stripe product
    const insertedProduct = await exports.createProduct({
        payload: product,
    });
    price.product = insertedProduct.id;
    //create stripe price
    const insertedPrice = await exports.createPrice({
        payload: price,
    });
    return {insertedProduct, insertedPrice};
};

exports.createPaymentIntent = async ({
                                         payload: {savedRegistration, savedExtrasPurchase, extrasIds},
                                     }) => {
    const lineItems = [];
    let subtotal = 0;

    // Get event to get currency and tax configuration
    const event = await eventService.getEventById({
        eventId: savedRegistration.eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Get event tickets price
    const tickets = await ticketService.getTicketsByEventId({
        eventId: savedRegistration.eventId,
    });
    const eventTicketPrice = tickets.length > 0 ? tickets[0].price : 0; // Assuming one ticket per event for registration
    if (eventTicketPrice > 0) {
        subtotal += eventTicketPrice;
    }

    // Get extras prices
    if (extrasIds?.length > 0) {
        const extras = await eventService.getExtrasByIds({extrasIds});
        extras.forEach((item) => {
            if (item.price > 0) {
                subtotal += item.price;
            }
        });
    }

    if (subtotal <= 0) {
        return {clientSecret: "no-stripe"};
    }

    // Calculate tax if configured
    let totalAmount = subtotal;
    const taxType = event.taxType || event.tax_type;
    const taxAmountConfig = event.taxAmount || event.tax_amount;
    
    if (taxType && taxAmountConfig && subtotal > 0) {
        const type = taxType.toLowerCase();
        const amount = Number(taxAmountConfig);
        
        if (type === 'percent' && amount > 0) {
            const taxAmount = Math.round((subtotal * amount) / 100);
            totalAmount += taxAmount;
        } else if (type === 'fixed' && amount > 0) {
            // amount expected in cents
            totalAmount += Math.round(amount);
        }
    }

    // Create payment intent (tax already calculated manually above)
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount), // Total includes tax if configured
        currency: eventCurrency,
        metadata: {
            registrationId: savedRegistration.id,
            registrationUuid: savedRegistration.qrUuid,
            extrasPurchaseId: savedExtrasPurchase?.id,
            eventId: savedRegistration.eventId,
        },
    });

    return {clientSecret: paymentIntent.client_secret};
};

exports.createOrderPaymentIntent = async ({
                                              payload: {orderId, items, customerEmail, registrationId},
                                          }) => {
    let subtotal = 0;

    // Calculate subtotal from items
    items.forEach((item) => {
        subtotal += item.unitPrice * item.quantity;
    });

    if (subtotal <= 0) {
        return {clientSecret: "no-stripe"};
    }

    // Get event currency and tax configuration from registration
    const registration = await registrationService.getRegistrationById({
        registrationId: registrationId,
    });
    const event = await eventService.getEventById({
        eventId: registration.eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Calculate tax if configured
    let totalAmount = subtotal;
    const taxType = event.taxType || event.tax_type;
    const taxAmountConfig = event.taxAmount || event.tax_amount;
    
    if (taxType && taxAmountConfig && subtotal > 0) {
        const type = taxType.toLowerCase();
        const amount = Number(taxAmountConfig);
        
        if (type === 'percent' && amount > 0) {
            const taxAmount = Math.round((subtotal * amount) / 100);
            totalAmount += taxAmount;
        } else if (type === 'fixed' && amount > 0) {
            // amount expected in cents
            totalAmount += Math.round(amount);
        }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: eventCurrency,
        receipt_email: customerEmail,
        metadata: {
            orderId: orderId,
            registrationId: registrationId, // Add registrationId for webhook
        },
    });

    return {clientSecret: paymentIntent.client_secret};
};

exports.createExtrasPaymentIntent = async ({
                                               payload: {extrasIds, registrationId, customerEmail, eventId},
                                           }) => {
    // Get event currency and tax configuration
    const event = await eventService.getEventById({
        eventId: eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Get extras prices
    const extras = await eventService.getExtrasByIds({extrasIds});
    let subtotal = 0;

    extras.forEach((item) => {
        if (item.price > 0) {
            subtotal += item.price;
        }
    });

    if (subtotal <= 0) {
        return {clientSecret: "no-stripe"};
    }

    // Calculate tax if configured
    let totalAmount = subtotal;
    const taxType = event.taxType || event.tax_type;
    const taxAmountConfig = event.taxAmount || event.tax_amount;
    
    if (taxType && taxAmountConfig && subtotal > 0) {
        const type = taxType.toLowerCase();
        const amount = Number(taxAmountConfig);
        
        if (type === 'percent' && amount > 0) {
            const taxAmount = Math.round((subtotal * amount) / 100);
            totalAmount += taxAmount;
        } else if (type === 'fixed' && amount > 0) {
            // amount expected in cents
            totalAmount += Math.round(amount);
        }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: eventCurrency,
        receipt_email: customerEmail,
        metadata: {
            registrationId: registrationId,
            extrasIds: extrasIds,
            eventId: eventId,
            type: "extras",
        },
    });

    return {clientSecret: paymentIntent.client_secret};
};

// Create extras payment intent with validation
exports.createExtrasPaymentIntentWithValidation = async (payload) => {
    const {extrasIds, registrationId, customerEmail, eventId} = payload;

    // Validate inputs
    if (!extrasIds || !Array.isArray(extrasIds) || extrasIds.length === 0) {
        throw new CustomError("Extras IDs are required", 400);
    }
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }
    if (!customerEmail) {
        throw new CustomError("Customer email is required", 400);
    }
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // Create Stripe payment intent
    const {clientSecret} = await exports.createExtrasPaymentIntent({
        payload: {
            extrasIds,
            registrationId,
            customerEmail,
            eventId,
        },
    });

    return {clientSecret};
};

// Create simple payment intent with metadata for simplified flow
exports.createSimplePaymentIntent = async ({amount, metadata, eventId}) => {
    let currency = defaultCurrency.code;

    // If eventId is provided, get the event's currency
    if (eventId) {
        try {
            const event = await eventService.getEventById({eventId});
            if (event && event.currency) {
                currency = event.currency.toLowerCase();
            }
        } catch (error) {
            console.warn(`Failed to get event currency for eventId ${eventId}, using default:`, error.message);
        }
    }

    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency,
        metadata: metadata,
        automatic_payment_methods: {
            enabled: true,
        },
    });

    return paymentIntent;
};

// Get registration data from payment intent metadata
exports.getRegistrationFromPaymentIntentMetadata = async (paymentIntentId) => {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Handle new temporary storage approach
    if (paymentIntent.metadata.sessionId) {
        try {
            // Retrieve temporary registration data
            const sessionData = await tempRegistrationService.getTempRegistration(
                paymentIntent.metadata.sessionId,
            );

            if (!sessionData) {
                console.error(
                    "No temporary registration data found for session:",
                    paymentIntent.metadata.sessionId,
                );
                throw new CustomError(
                    "No registration data found in payment intent",
                    400,
                );
            }

            // Get event data to access currency
            const event = await eventService.getEventById({eventId: sessionData.eventId});
            if (!event) {
                throw new CustomError("Event not found", 404);
            }

            if (
                !sessionData.attendees ||
                !Array.isArray(sessionData.attendees) ||
                sessionData.attendees.length === 0
            ) {
                throw new CustomError("Invalid attendees data structure", 400);
            }

            // Create registration record
            const registrationResult = await registrationService.save({
                eventId: sessionData.eventId,
                clubId: sessionData.clubId,
                additionalFields: {}, // Empty for now, can be enhanced later
            });

            // Save all attendees at once
            const attendees = sessionData.attendees;

            const savedAttendees = await attendeesService.createAttendees({
                registrationId: registrationResult.id,
                attendees: attendees,
                additionalFields: {},
            });

            // Create order record
            const orderNumber = orderService.generateOrderNumber();
            const totalAmount = sessionData.selectedTickets.reduce(
                (sum, item) => sum + item.unitPrice * item.quantity,
                0,
            );

            const orderResult = await orderService.save({
                payload: {
                    orderNumber,
                    totalAmount,
                    currency: event.currency,
                    paymentStatus: "paid",
                    stripePaymentIntentId: paymentIntentId,
                    items: sessionData.selectedTickets,
                    registrationId: registrationResult.id,
                    eventId: sessionData.eventId,
                    clubId: sessionData.clubId,
                },
            });

            // Update payment intent metadata with new data
            await stripe.paymentIntents.update(paymentIntentId, {
                metadata: {
                    registrationId: registrationResult.id.toString(),
                    qrUuid: savedAttendees[0]?.qrUuid || "",
                    orderId: orderResult.id.toString(),
                    orderNumber,
                    totalAmount: totalAmount.toString(),
                    eventId: sessionData.eventId.toString(),
                    clubId: sessionData.clubId.toString(),
                },
            });

            // Reduce ticket stock
            for (const item of sessionData.selectedTickets) {
                await ticketService.updateStock({
                    ticketId: item.ticketId,
                    quantity: item.quantity,
                });
            }

            // Increase registration count in event
            await eventService.increaseRegistrationCount({
                eventId: sessionData.eventId,
            });

            // Send confirmation emails to all attendees (async, don't wait)
            savedAttendees.forEach(async (attendee) => {
                emailService
                    .sendTicketsByRegistrationId({
                        registrationId: registrationResult.id,
                        attendeeId: attendee.id,
                    })
                    .catch((error) => {
                        console.error(`Failed to send email to ${attendee.email}:`, error);
                    });
            });

            // Note: Temporary data will be cleaned up by cronjob later
            // await tempRegistrationService.deleteTempRegistration(paymentIntent.metadata.sessionId);

            // Return the complete registration data with all attendees
            const result = {
                id: registrationResult.id,
                eventId: sessionData.eventId,
                clubId: sessionData.clubId,
                status: true,
                attendees: savedAttendees.map((attendee) => ({
                    id: attendee.id,
                    isPrimary: attendee.is_primary,
                    firstName: attendee.first_name,
                    lastName: attendee.last_name,
                    email: attendee.email,
                    phone: attendee.phone,
                    ticketId: attendee.ticket_id,
                    qrUuid: attendee.qr_uuid,
                })),
                orderId: orderResult.id,
                orderNumber: orderNumber,
                totalAmount: totalAmount,
                createdAt: registrationResult.createdAt,
                updatedAt: registrationResult.updatedAt,
            };

            return result;
        } catch (error) {
            console.error(
                "Error processing payment intent with temporary storage:",
                error,
            );
            if (error instanceof CustomError) {
                throw error;
            }
            throw new CustomError(
                `Failed to process registration from payment intent: ${error.message}`,
                500,
            );
        }
    }

    // Handle existing approach (fallback)
    if (!paymentIntent.metadata.registrationId) {
        throw new CustomError("No registration data found in payment intent", 400);
    }

    // Use metadata instead of database query since we have all the data we need
    const result = {
        id: parseInt(paymentIntent.metadata.registrationId),
        qrUuid: paymentIntent.metadata.qrUuid,
        status: true, // Payment succeeded, so status is true
        eventId: parseInt(paymentIntent.metadata.eventId),
        clubId: parseInt(paymentIntent.metadata.clubId),
    };

    return result;
};

// Create sponsorship payment intent
exports.createSponsorshipPaymentIntent = async ({
                                                    packageId,
                                                    amount,
                                                    currency,
                                                    sponsorEmail,
                                                    eventId,
                                                }) => {
    if (amount <= 0) {
        return {clientSecret: "no-stripe"};
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        receipt_email: sponsorEmail,
        metadata: {
            packageId: packageId,
            eventId: eventId,
            type: "sponsorship",
        },
        automatic_payment_methods: {
            enabled: true,
        },
    });

    return {clientSecret: paymentIntent.client_secret};
};

// Create secure payment intent with temporary storage
exports.createSecurePaymentIntent = async ({
                                               attendees,
                                               selectedTickets,
                                               registration,
                                           }) => {
    // Validate required data
    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new CustomError("Missing required payment data", 400);
    }

    // Validate attendee data
    if (
        !selectedTickets ||
        !Array.isArray(selectedTickets) ||
        selectedTickets.length === 0
    ) {
        throw new CustomError("At least one selected ticket is required", 400);
    }

    if (!registration || !registration.eventId) {
        throw new CustomError("Registration data with event ID is required", 400);
    }

    // Validate each attendee
    for (const attendee of attendees) {
        if (
            !attendee.email ||
            !attendee.firstName ||
            !attendee.lastName ||
            !attendee.phone
        ) {
            throw new CustomError(
                "All attendees must have email, first name, last name, and phone",
                400,
            );
        }
    }

    // Check if any attendee already exists for this event
    for (const attendee of attendees) {
        const existingRegistration =
            await registrationService.getRegistrationByEmail({
                email: attendee.email,
                eventId: registration.eventId,
            });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    try {
        // Generate unique session ID
        const sessionId = uuidv4();

        // Get event data to access currency
        const event = await eventService.getEventById({eventId: registration.eventId});
        if (!event) {
            throw new CustomError("Event not found", 404);
        }

        // Calculate total amount from backend prices
        let totalAmount = 0;
        const validatedItems = [];

        // Get tickets from database to validate prices
        const dbTickets = await ticketService.getTicketsByEventId({
            eventId: registration.eventId,
        });
        const ticketMap = new Map(dbTickets.map((ticket) => [ticket.id, ticket]));

        for (const frontendItem of selectedTickets) {
            const dbTicket = ticketMap.get(frontendItem.ticketId);

            if (!dbTicket) {
                throw new CustomError(`Ticket ${frontendItem.ticketId} not found`, 404);
            }

            // Validate quantity
            if (frontendItem.quantity <= 0 || frontendItem.quantity > 10) {
                throw new CustomError(
                    `Invalid quantity for ticket ${dbTicket.title}`,
                    400,
                );
            }

            // Validate stock availability
            if (dbTicket.currentStock < frontendItem.quantity) {
                throw new CustomError(`Insufficient stock for ${dbTicket.title}`, 400);
            }

            // Use backend price, not frontend price
            const itemTotal = dbTicket.price * frontendItem.quantity;
            totalAmount += itemTotal;

            validatedItems.push({
                ticketId: dbTicket.id,
                title: dbTicket.title,
                unitPrice: dbTicket.price,
                quantity: frontendItem.quantity,
                currentStock: dbTicket.currentStock,
            });
        }

        // Apply event-level tax if configured (from database columns)
        // Only apply tax if subtotal > 0
        if (totalAmount > 0) {
            const taxType = event.taxType || event.tax_type;
            const taxAmountConfig = event.taxAmount || event.tax_amount;
            
            if (taxType && taxAmountConfig) {
                const type = taxType.toLowerCase();
                const amount = Number(taxAmountConfig);
                
                if (type === 'percent' && amount > 0) {
                    const taxAmount = Math.round((totalAmount * amount) / 100);
                    totalAmount += taxAmount;
                } else if (type === 'fixed' && amount > 0) {
                    // amount expected in cents
                    totalAmount += Math.round(amount);
                }
            }
        }

        // Validate amount
        if (totalAmount <= 0) {
            throw new CustomError("Invalid payment amount", 400);
        }
        // Create payment intent with session ID only
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount), // Convert to cents
            currency: event.currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                sessionId: sessionId,
                eventId: registration.eventId.toString(),
                paymentType: "paid", // Mark as paid registration
                // validatedItems: JSON.stringify(validatedItems)
            },
        });

        // Prepare order data for temp storage with updated stripePaymentIntentId
        const orders = {
            orderNumber: orderService.generateOrderNumber(),
            totalAmount: totalAmount,
            currency: event.currency,
            paymentStatus: "pending",
            stripePaymentIntentId: paymentIntent.id, // Updated with actual payment intent ID
            items: validatedItems,
            registrationId: null, // Will be set after registration creation
            eventId: registration.eventId,
        };

        // Store attendee data temporarily with prepared order data
        await tempRegistrationService.storeTempRegistration({
            sessionId,
            attendees,
            registration,
            selectedTickets,
            orders, // Add prepared order data with stripePaymentIntentId
            eventId: registration.eventId,
        });

        return {
            paymentIntent,
            totalAmount,
            sessionId,
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        throw new CustomError("Failed to create secure payment intent", 500);
    }
};

// Check payment status and get processed registration data
exports.checkPaymentStatus = async ({paymentIntent}) => {
    if (!paymentIntent) {
        throw new CustomError("Payment intent ID required", 400);
    }

    try {
        // Get payment intent from Stripe
        const stripePaymentIntent =
            await stripe.paymentIntents.retrieve(paymentIntent);

        // Check if payment has been processed by webhook
        if (
            stripePaymentIntent.metadata.processed === "true" &&
            stripePaymentIntent.metadata.registrationId
        ) {
            // Get registration data from database
            const registration = await registrationService.getRegistrationById({
                registrationId: stripePaymentIntent.metadata.registrationId,
            });

            if (!registration) {
                throw new CustomError("Registration not found", 404);
            }

            return {
                processed: true,
                registrationId: registration.id,
                eventId: registration.eventId,
                clubId: registration.clubId,
                status: registration.status,
                attendees: registration.attendees || [],
                orderId: stripePaymentIntent.metadata.orderId,
                orderNumber: stripePaymentIntent.metadata.orderNumber,
                totalAmount: stripePaymentIntent.metadata.totalAmount,
            };
        } else {
            // Payment not yet processed
            return {
                processed: false,
                message: "Payment is being processed",
            };
        }
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }
        throw new CustomError("Failed to check payment status", 500);
    }
};

exports.webhook = async (req) => {
    let data;
    let eventType;
    const isDev = process.env.NODE_ENV !== "production";
    // Check if webhook signing is configured.
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!isDev && !webhookSecret) {
        throw new CustomError("Missing STRIPE_WEBHOOK_SECRET in production", 500);
    }
    if (webhookSecret) {
        // Retrieve the event by verifying the signature using the raw body and secret.
        let event;
        let signature = req.headers["stripe-signature"];

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                signature,
                webhookSecret,
            );
        } catch (err) {
            throw new CustomError(err.message, 400, err);
        }
        // Extract the object from the event.
        data = event.data;
        eventType = event.type;
    } else if (isDev) {
        // Webhook signing is recommended, but if the secret is not configured in `config.js`,
        // retrieve the event data directly from the request body.
        data = req.body.data;
        eventType = req.body.type;
    } else {
        throw new CustomError(
            "Invalid webhook configuration. Check environment and STRIPE_WEBHOOK_SECRET.",
            500,
        );
    }

    let responseMsg = "";
    switch (eventType) {
        // payment intent succeeded
        case "payment_intent.succeeded":
            const paymentIntentSucceeded = data.object;

            // Validate metadata types - ensure all values are strings
            const metadata = paymentIntentSucceeded.metadata;
            for (const [key, value] of Object.entries(metadata)) {
                if (typeof value !== "string") {
                    // Skip processing this payment intent if metadata is invalid
                    responseMsg = `Invalid metadata type for key ${key}`;
                    break;
                }
            }

            if (responseMsg) {
                break;
            }

            // Handle new temporary storage approach
            if (paymentIntentSucceeded.metadata.sessionId) {
                // Check if this is a free registration that was already processed
                if (paymentIntentSucceeded.metadata.paymentType === "free") {
                    responseMsg = "Free registration already processed by frontend";
                    break;
                }
                try {
                    // Retrieve and destructure temporary registration data
                    const sessionData = await tempRegistrationService.getTempRegistration(
                        paymentIntentSucceeded.metadata.sessionId,
                    );

                    if (!sessionData) {
                        console.error(
                            "No temporary registration data found for session:",
                            paymentIntentSucceeded.metadata.sessionId,
                        );
                        throw new CustomError(
                            "No registration data found in payment intent",
                            400,
                        );
                    }

                    // Destructure all table data from temp registration
                    const {attendees, registration, selectedTickets, orders, eventId} =
                        sessionData;

                    // Get event data to access currency
                    const event = await eventService.getEventById({eventId});
                    if (!event) {
                        throw new CustomError("Event not found", 404);
                    }

                    // Validate attendees data
                    if (
                        !attendees ||
                        !Array.isArray(attendees) ||
                        attendees.length === 0
                    ) {
                        throw new CustomError("Invalid attendees data structure", 400);
                    }

                    // 1. Save registration first with timezone data
                    const registrationResult = await registrationService.save({
                        eventId: eventId,
                        status: true,
                        additionalFields: registration?.additionalFields || {},
                        userTimezone: registration?.userTimezone || 'UTC',
                        timezoneOffset: registration?.timezoneOffset || 0,
                    });

                    // 2. Update attendees with registration_id and save
                    const attendeesWithRegistrationId = attendees.map((attendee) => ({
                        ...attendee,
                        registrationId: registrationResult.id,
                        sessionId: paymentIntentSucceeded.metadata.sessionId,
                    }));
                    const savedAttendees = await attendeesService.createAttendees({
                        registrationId: registrationResult.id,
                        attendees: attendeesWithRegistrationId,
                    });

                    // 3. Update orders data with registrationId and save
                    let orderResult;
                    if (orders) {
                        // Use prepared orders data
                        const orderData = {
                            ...orders,
                            registrationId: registrationResult.id,
                            paymentStatus: "paid",
                        };

                        orderResult = await orderService.save({
                            payload: orderData,
                        });
                    } else {
                        // Fallback: Create order manually
                        const orderData = {
                            orderNumber: orderService.generateOrderNumber(),
                            totalAmount: selectedTickets.reduce(
                                (sum, item) => sum + item.unitPrice * item.quantity,
                                0,
                            ),
                            currency: event.currency,
                            paymentStatus: "paid",
                            stripePaymentIntentId: paymentIntentSucceeded.id,
                            items: selectedTickets,
                            registrationId: registrationResult.id,
                            eventId: eventId,
                        };

                        orderResult = await orderService.save({
                            payload: orderData,
                        });
                    }

                    // Update payment intent metadata with new data
                    await stripe.paymentIntents.update(paymentIntentSucceeded.id, {
                        metadata: {
                            registrationId: registrationResult.id.toString(),
                            qrUuid: savedAttendees[0]?.qrUuid || "",
                            orderId: orderResult.id.toString(),
                            orderNumber: orderResult.orderNumber,
                            totalAmount: orderResult.totalAmount,
                            eventId: eventId.toString(),
                            processed: "true", // Mark as processed
                        },
                    });

                    // Reduce ticket stock using orders data if available, otherwise fallback to selectedTickets
                    const itemsToReduce = orders?.items || selectedTickets;
                    for (const item of itemsToReduce) {
                        await ticketService.updateStock({
                            ticketId: item.ticketId,
                            quantity: item.quantity,
                        });
                    }

                    // Increase registration count in event
                    await eventService.increaseRegistrationCount({
                        eventId: eventId,
                    });

                    // Send confirmation emails to all attendees (async, don't wait)
                    emailService
                        .sendTicketsByRegistrationId({
                            registrationId: registrationResult.id,
                        })
                        .catch((error) => {
                            console.error(
                                `Failed to send emails for registration ${registrationResult.id}:`,
                                error,
                            );
                        });

                    // Note: Temporary data will be cleaned up by cronjob later
                    // await tempRegistrationService.deleteTempRegistration(paymentIntentSucceeded.metadata.sessionId);
                } catch (error) {
                    console.error(
                        "Error processing payment intent with temporary storage:",
                        error,
                    );
                    if (error instanceof CustomError) {
                        throw error;
                    }
                    throw new CustomError(
                        `Failed to process registration from payment intent: ${error.message}`,
                        500,
                    );
                }
            }

            // Handle sponsorship payment
            if (paymentIntentSucceeded.metadata.type === "sponsorship") {
                // For new sponsorship flow, we need to create the sponsorship record
                // The frontend will handle this after successful payment
            }

            // Handle extras-only payment
            if (paymentIntentSucceeded.metadata.type === "extras") {
                const extrasIds = JSON.parse(paymentIntentSucceeded.metadata.extrasIds);
                const registrationId = paymentIntentSucceeded.metadata.registrationId;

                // Create extras purchase record
                await eventService.saveExtrasPurchase({
                    extrasIds: extrasIds,
                    registrationId: registrationId,
                    status: true,
                });

                // Send confirmation email (async, don't wait)
                emailService
                    .sendTicketsByRegistrationId({
                        registrationId: registrationId,
                    })
                    .catch((error) => {
                        console.error("Failed to send email for extras payment:", error);
                    });
            }

            responseMsg = "Payment successful!";
            break;

        // fired immediately when customer cancel subscription
        case "customer.subscription.updated":
            break;

        // fired at end of period when subscription expired
        case "customer.subscription.deleted":
            break;

        // subscription auto renewal succeeded
        case "invoice.paid":
            break;

        // subscription auto renewal failed
        case "invoice.payment_failed":
            break;

        // ... handle other event types
        default:
            console.error(`Unhandled event type ${eventType}`);
    }

    return responseMsg;
};
