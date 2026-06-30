const { app } = require('@azure/functions');
const { checkSqlHealth } = require('../db');
const { ServiceBusClient } = require('@azure/service-bus');
const { DefaultAzureCredential } = require('@azure/identity');

app.http('HealthCheck', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',

    handler: async (request, context) => {
        const checks = {
            app: 'Healthy',
            sql: 'Unknown',
            serviceBus: 'Unknown',
            eventGridConfig: 'Unknown'
        };

        let overallStatus = 'Healthy';

        try {
            await checkSqlHealth();
            checks.sql = 'Healthy';
        } catch (error) {
            checks.sql = 'Unhealthy';
            overallStatus = 'Unhealthy';
        }

        let serviceBusClient;
        let receiver;

        try {
            const namespace = process.env.ServiceBusConnection__fullyQualifiedNamespace;

            if (!namespace) {
                throw new Error('Missing ServiceBusConnection__fullyQualifiedNamespace');
            }

            serviceBusClient = new ServiceBusClient(
                namespace,
                new DefaultAzureCredential()
            );

            receiver = serviceBusClient.createReceiver('orders');

            await receiver.peekMessages(1);

            checks.serviceBus = 'Healthy';
        } catch (error) {
            checks.serviceBus = 'Unhealthy';
            overallStatus = 'Unhealthy';
            context.log(`Service Bus health check failed: ${error.message}`);
        } finally {
            if (receiver) {
                await receiver.close();
            }

            if (serviceBusClient) {
                await serviceBusClient.close();
            }
        }

        checks.eventGridConfig =
            process.env.myawesometopic__topicEndpointUri
                ? 'Healthy'
                : 'Unhealthy';

        if (checks.eventGridConfig === 'Unhealthy') {
            overallStatus = 'Unhealthy';
        }

        return {
            status: overallStatus === 'Healthy' ? 200 : 503,
            jsonBody: {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                checks
            }
        };
    }
});