const { app } = require('@azure/functions');

app.serviceBusQueue('ProcessOrder', {
    connection: 'ServiceBusConnection',
    queueName: 'orders',

    handler: async (message, context) => {
        context.log('=================================');
        context.log(`Received Order: ${message.orderId}`);
        context.log(`Customer: ${message.customerId}`);
        context.log(`Status: ${message.status}`);

        context.log('Marking order Processing');
        throw new Error("Simulated processing failure");

        await new Promise(resolve =>
            setTimeout(resolve, 5000)
        );

        context.log('Marking order Processed');
        context.log('=================================');
    }
});