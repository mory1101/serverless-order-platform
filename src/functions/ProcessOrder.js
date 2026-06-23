const { app } = require('@azure/functions');
const { updateOrderStatus, markOrderFailed } = require('../db');

app.serviceBusQueue('ProcessOrder', {
    connection: 'ServiceBusConnection',
    queueName: 'orders',

    handler: async (message, context) => {
        const orderId = message.orderId;
        const deliveryCount = context.triggerMetadata.deliveryCount;

        try {
            context.log(`Received Order: ${orderId}`);
            context.log(`DeliveryCount: ${deliveryCount}`);

            await updateOrderStatus(orderId, 'Processing');
            context.log(`Order ${orderId} marked Processing`);

            // Simulated failure
            

            await new Promise(resolve => setTimeout(resolve, 5000));

            await updateOrderStatus(orderId, 'Processed');
            context.log(`Order ${orderId} marked Processed`);

        } catch (error) {
            await markOrderFailed(orderId, error.message, deliveryCount);
            context.log(`Order ${orderId} marked Failed`);

            
        }
    }
});