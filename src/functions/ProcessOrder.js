const { app, output } = require("@azure/functions");
const { updateOrderStatus, markOrderFailed } = require("../db");
const { ServiceBusClient } = require("@azure/service-bus");

// Event Grid output binding
const eventGridOutput = output.eventGrid({
    connection: "myawesometopic"
});

app.serviceBusQueue("ProcessOrder", {
    connection: "ServiceBusConnection",
    queueName: "orders",

    // Register the output binding
    extraOutputs: [eventGridOutput],

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

            await updateOrderStatus(orderId, "Processing");

            context.log(JSON.stringify({
                eventType: "OrderProcessingStartedByConsumerFunction",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId
            }));

            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 5000));

            await updateOrderStatus(orderId, "Processed");

            context.log(JSON.stringify({
                eventType: "OrderProcessedByConsumerFunction",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId
            }));

            // Publish to Event Grid
            context.extraOutputs.set(eventGridOutput, {
                id: message.correlationId,
                eventType: "OrderProcessed",
                subject: `orders/${orderId}`,
                eventTime: new Date().toISOString(),
                dataVersion: "1.0",
                data: {
                    orderId: message.orderId,
                    customerId: message.customerId,
                    status: "Processed",
                    correlationId: message.correlationId
                }
            });

            context.log(JSON.stringify({
                eventType: "OrderProcessedAndPublishedToEventGrid",
                orderId: message.orderId,
                customerId: message.customerId,
                correlationId: message.correlationId
            }));

        } catch (error) {

            await markOrderFailed(orderId, error.message, deliveryCount);

            context.log(JSON.stringify({
                eventType: "OrderProcessingFailed",
                orderId,
                correlationId: message.correlationId,
                error: error.message
            }));

            throw error;
        }
    }
});