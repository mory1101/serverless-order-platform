const { app } = require('@azure/functions');
const crypto = require('crypto');
const { ServiceBusClient } = require('@azure/service-bus');
const { insertPendingOrder } = require('../db');
const { DefaultAzureCredential } = require('@azure/identity');

app.http('CreateOrder', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('CreateOrder function received a request.');

        const order = await request.json();

        const orderId = crypto.randomUUID();
        const correlationId =
         request.headers.get("x-correlation-id") || crypto.randomUUID();

        const queueMessage = {
            orderId,
            customerId: order.customerId,
            productId: order.productId,
            quantity: order.quantity,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            correlationId: correlationId
        };

        await insertPendingOrder(queueMessage);

        context.log(JSON.stringify({
            eventType: "OrderPendingInsertedDatabase",
            orderId,
            customerId: order.customerId,
            productId: order.productId,
            quantity: order.quantity,
            status: "Pending",
            correlationId: correlationId
        }));

        const fullyQualifiedNamespace =
            process.env.ServiceBusConnection__fullyQualifiedNamespace;

         const sbClient = new ServiceBusClient(
            fullyQualifiedNamespace,
            new DefaultAzureCredential()
        );

        const sender = sbClient.createSender('orders');

        await sender.sendMessages({
            body: queueMessage
        });

        await sender.close();
        await sbClient.close();

        context.log(JSON.stringify({
            eventType: "OrderSentToQueueAndAwaitingProcessing",
            orderId,
            customerId: order.customerId,
            queue: "orders",
            correlationId: correlationId
        }));

        return {
            status: 202,
            jsonBody: {
                orderId: orderId,
                status: 'Pending',
                message: 'Order sent to queue ,database and awaiting consumption processing',
                receivedOrder: order,
                correlationId: correlationId
            }
        };
    }
});