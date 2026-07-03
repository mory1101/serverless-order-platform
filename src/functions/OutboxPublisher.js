const { app } = require("@azure/functions");
const {
  getPendingOutboxMessages,
  markOutboxMessagePublished,
  markOutboxMessageFailed,
} = require("../db");
const { ServiceBusClient } = require("@azure/service-bus");
const { DefaultAzureCredential } = require("@azure/identity");

app.http('OutboxPublisher', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'admin/outbox/publish',

  handler: async (request, context) => {
    context.log("OutboxPublisher started.");

    const credential = new DefaultAzureCredential();
    const fullyQualifiedNamespace = process.env.ServiceBusConnection__fullyQualifiedNamespace;

    const serviceBusClient = new ServiceBusClient(
      fullyQualifiedNamespace,
      credential,
    );

    const sender = serviceBusClient.createSender('orders');

    try {
      
      const messages = await getPendingOutboxMessages();

      for (const message of messages) {
        try {
            //get the payload from the message and send it to the Service Bus queue
          context.log('Messages received from Outbox:', JSON.stringify(message));

          const payload = JSON.parse(message.Payload);

          await sender.sendMessages({
            body: payload,
            correlationId: message.CorrelationId,
            messageId: message.Id,
          });

          await markOutboxMessagePublished(message.Id);

          context.log(
            JSON.stringify({
              eventType: "OutboxMessagePublished",
              outboxMessageId: message.Id,
              correlationId: message.CorrelationId,
            }),
          );
        } catch (error) {
          await markOutboxMessageFailed(message.Id, error);

          context.log(
            JSON.stringify({
              eventType: "OutboxMessagePublishFailed",
              outboxMessageId: message.Id,
              correlationId: message.CorrelationId,
              error: error.message,
            }),
          );
        }
      }
    } finally {
      await sender.close();
      await serviceBusClient.close();
    }
  },
});
