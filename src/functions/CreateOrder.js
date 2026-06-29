const { app } = require('@azure/functions');
const crypto = require('crypto');
const { insertPendingOrder } = require('../db');

app.http('CreateOrder', {
    methods: ['POST'],
    authLevel: 'anonymous',

    handler: async (request, context) => {
        context.log('CreateOrder function received a request.');

        const order = await request.json();

        const orderId = crypto.randomUUID();
        const correlationId =
            request.headers.get("x-correlation-id") || crypto.randomUUID();

        const createdAt = new Date().toISOString();

        const sqlAndOutboxMessage = {
            orderId,
            customerId: order.customerId,
            productId: order.productId,
            quantity: order.quantity,
            status: 'Pending',
            createdAt,
            correlationId,
            

            outboxMessageId: crypto.randomUUID(),
            messageType: "ProcessOrder",
            payload: {
                orderId,
                customerId: order.customerId,
                productId: order.productId,
                quantity: order.quantity,
                correlationId
            }
        };

        // Insert the order into the database and create an outbox message
        await insertPendingOrder(sqlAndOutboxMessage);

        context.log(JSON.stringify({
            eventType: "OrderPendingInsertedAndOutboxMessageCreated",
            orderId,
            customerId: order.customerId,
            productId: order.productId,
            quantity: order.quantity,
            status: "Pending",
            correlationId
        }));

        return {
            status: 202,
            jsonBody: {
                orderId,
                status: 'Pending',
                message: 'Order accepted and stored. Processing will be triggered by the outbox publisher.',
                correlationId
            }
        };
    }
});