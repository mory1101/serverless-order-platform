const { app } = require('@azure/functions');
const crypto = require('crypto');
const { ServiceBusClient } = require('@azure/service-bus');
const { insertPendingOrder } = require('../db');

app.http('CreateOrder', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('CreateOrder function received a request.');

        const order = await request.json();

        const orderId = crypto.randomUUID();

        const queueMessage = {
            orderId,
            customerId: order.customerId,
            productId: order.productId,
            quantity: order.quantity,
            status: 'Pending',
            createdAt: new Date().toISOString()
        };

        await insertPendingOrder(queueMessage);

        context.log(`Order ${orderId} inserted into SQL as Pending`);

        const sbClient = new ServiceBusClient(
            process.env.ServiceBusConnection
        );

        const sender = sbClient.createSender('orders');

        await sender.sendMessages({
            body: queueMessage
        });

        await sender.close();
        await sbClient.close();

        context.log('Message to be queued:', JSON.stringify(queueMessage));

        return {
            status: 202,
            jsonBody: {
                orderId: orderId,
                status: 'Pending',
                message: 'Order accepted for processing',
                receivedOrder: order
            }
        };
    }
});