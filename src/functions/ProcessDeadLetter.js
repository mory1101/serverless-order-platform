const { app } = require('@azure/functions');
const { updateOrderStatus } = require('../db');

app.serviceBusQueue('ProcessDeadLetter', {
    connection: 'ServiceBusConnection',
    queueName: 'orders/$DeadLetterQueue',

    handler: async (message, context) => {
        const orderId = message.orderId;

        context.log('=================================');
        context.log(`Dead-letter message received for order: ${orderId}`);
        context.log(`Message: ${JSON.stringify(message)}`);

        await updateOrderStatus(orderId, 'DeadLettered');

        context.log(`Order ${orderId} marked DeadLettered`);
        context.log('=================================');
    }
});