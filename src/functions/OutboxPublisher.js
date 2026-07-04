const { app } = require("@azure/functions");
const {
    getPendingOutboxMessages,
    markOutboxMessagePublished,
    markOutboxMessageFailed,
} = require("../db");
const { ServiceBusClient } = require("@azure/service-bus");
const { DefaultAzureCredential } = require("@azure/identity");

app.http("OutboxPublisher", {
    methods: ["GET"],
    authLevel: "anonymous",
    route: "admin/outbox/publish",

    handler: async (request, context) => {
        context.log("OutboxPublisher started.");

        const credential = new DefaultAzureCredential();
        const fullyQualifiedNamespace =
      process.env.ServiceBusConnection__fullyQualifiedNamespace ||
      process.env.servicebusconnection__fullyqualifiednamespace;

        if (!fullyQualifiedNamespace) {
            context.log("Missing Service Bus fully qualified namespace setting.");

            return {
                status: 500,
                jsonBody: {
                    status: "Failed",
                    error: "Missing Service Bus namespace configuration.",
                },
            };
        }

        const serviceBusClient = new ServiceBusClient(
            fullyQualifiedNamespace,
            credential
        );

        const sender = serviceBusClient.createSender("orders");

        let publishedCount = 0;
        let failedCount = 0;

        try {
            const messages = await getPendingOutboxMessages();

            for (const message of messages) {
                try {
                    context.log("Message received from Outbox:", JSON.stringify(message));

                    const payload = JSON.parse(message.Payload);

                    await sender.sendMessages({
                        body: payload,
                        correlationId: message.CorrelationId,
                        messageId: String(message.Id),
                    });

                    await markOutboxMessagePublished(message.Id);
                    publishedCount++;

                    context.log(
                        JSON.stringify({
                            eventType: "OutboxMessagePublished",
                            outboxMessageId: message.Id,
                            correlationId: message.CorrelationId,
                        })
                    );
                } catch (error) {
                    failedCount++;

                    await markOutboxMessageFailed(message.Id, error.message);

                    context.log(
                        JSON.stringify({
                            eventType: "OutboxMessagePublishFailed",
                            outboxMessageId: message.Id,
                            correlationId: message.CorrelationId,
                            error: error.message,
                        })
                    );
                }
            }

            return {
                status: 200,
                jsonBody: {
                    status: "Completed",
                    totalMessages: messages.length,
                    publishedCount,
                    failedCount,
                },
            };
        } catch (error) {
            context.log(`OutboxPublisher failed: ${error.message}`);

            return {
                status: 500,
                jsonBody: {
                    status: "Failed",
                    error: error.message,
                },
            };
        } finally {
            await sender.close();
            await serviceBusClient.close();
        }
    },
});