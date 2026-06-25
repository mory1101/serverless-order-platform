const { app } = require('@azure/functions');
const { updateOrderStatus, markOrderFailed } = require('../db');
const { ServiceBusClient } = require('@azure/service-bus');

app.serviceBusQueue('ProcessOrder', {
    connection: 'ServiceBusConnection',
    queueName: 'orders',

    handler: async (message, context) => {
        const orderId = message.orderId;
        const deliveryCount = context.triggerMetadata.deliveryCount;

        try {
            context.log(JSON.stringify({
                eventType: "OrderReceivedFromQueue",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId,
                deliveryCount: deliveryCount
            }));

            await updateOrderStatus(orderId, 'Processing');
            context.log(JSON.stringify({
                eventType: "OrderProcessingStartedByConsumerFunction",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId
            }));

            // Simulated failure
            

            await new Promise(resolve => setTimeout(resolve, 5000));

            await updateOrderStatus(orderId, 'Processed');
            context.log(JSON.stringify({
                eventType: "OrderProcessedbyConsumerFunction",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId
            }));

        } catch (error) {
            await markOrderFailed(orderId, error.message, deliveryCount);
            context.log(`Order ${orderId} marked Failed`);

            
        }
    }
});